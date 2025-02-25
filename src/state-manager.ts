import { IStateManager, StateListener, StateManagerConfig, StateManagerMetrics } from "./types";

/**
 * Manages state updates and notifies listeners of changes.
 * Includes performance optimizations like batching, memoization, and metrics collection.
 *
 * @template T - The type of the state object.
 */
export class StateManager<T extends object> implements IStateManager<T> {
  private state: T;
  private listeners: StateListener<T>[] = [];
  private config: StateManagerConfig<T>;
  private batchTimer: NodeJS.Timeout | null = null;
  private batchedUpdates: Partial<T>[] = [];
  private memoizedValues: Map<string, unknown> = new Map();
  private memoizationDependencies: Map<string, string[]> = new Map();

  // Metrics tracking
  private lastUpdateTime: number = 0;
  private updateTimes: number[] = [];
  private updateDurations: number[] = [];
  private equalityCheckDurations: number[] = [];
  private memoizationDurations: number[] = [];
  private derivationDurations: number[] = [];

  /**
   * Creates a new StateManager instance.
   *
   * @param initialState - The initial state object
   * @param config - Configuration options for performance optimizations
   */
  constructor(initialState: T, config: StateManagerConfig<T> = {}) {
    this.state = initialState;
    this.config = {
      batchUpdates: config.batchUpdates ?? false,
      batchTimeWindow: config.batchTimeWindow ?? 50,
      enableMemoization: config.enableMemoization ?? false,
      areEqual: config.areEqual ?? this.defaultAreEqual,
      metrics: config.metrics ?? { enabled: false },
    };

    if (this.config.metrics?.enabled) {
      this.lastUpdateTime = Date.now();
    }
  }

  /**
   * Gets the current state.
   *
   * @returns The current state object
   */
  getState(): T {
    return this.state;
  }

  /**
   * Updates the state with the provided partial update.
   * If batching is enabled, the update may be delayed and combined with other updates.
   *
   * @param update - Partial state update to apply
   */
  setState(update: Partial<T>): void {
    if (this.config.batchUpdates) {
      this.batchedUpdates.push(update);

      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatchedUpdates();
        }, this.config.batchTimeWindow);
      }

      return;
    }

    this.applyUpdate(update);
  }

  /**
   * Subscribes a listener to state changes.
   *
   * @param listener - Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: StateListener<T>): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Derives a computed value from state and memoizes it if enabled.
   *
   * @param key - Unique key for the derived value
   * @param deriveFn - Function that computes the derived value
   * @param dependencies - Array of state property paths that the derivation depends on
   * @returns The derived value
   */
  derive<R>(key: string, deriveFn: (state: T) => R, dependencies: string[] = []): R {
    // Start measuring time if metrics are enabled
    const startTime = this.shouldMeasureComputations() ? performance.now() : 0;

    // Check if memoization is enabled
    if (this.config.enableMemoization) {
      // Measure memoization time
      const memoStart = this.shouldMeasureComputations() ? performance.now() : 0;

      // Store dependencies for this key
      this.memoizationDependencies.set(key, dependencies);

      // Check if we have a cached value and dependencies haven't changed
      if (this.memoizedValues.has(key) && !this.haveDependenciesChanged(key, dependencies)) {
        // Use the cached value
        const cachedValue = this.memoizedValues.get(key);

        // Record memoization time
        if (this.shouldMeasureComputations()) {
          const memoEnd = performance.now();
          this.memoizationDurations.push(memoEnd - memoStart);
        }

        // Record total derivation time
        if (this.shouldMeasureComputations()) {
          const endTime = performance.now();
          this.derivationDurations.push(endTime - startTime);
        }

        // Return the cached value with proper type casting
        return cachedValue as R;
      }
    }

    // Compute the derived value
    const value = deriveFn(this.state);

    // Cache the value if memoization is enabled
    if (this.config.enableMemoization) {
      this.memoizedValues.set(key, value);
    }

    // Record total derivation time
    if (this.shouldMeasureComputations()) {
      const endTime = performance.now();
      this.derivationDurations.push(endTime - startTime);
    }

    return value;
  }

  /**
   * Clears all memoized values, forcing recomputation on next access.
   */
  clearMemoizedValues(): void {
    this.memoizedValues.clear();
  }

  /**
   * Clears memoized values for specific keys.
   *
   * @param keys - Array of keys to clear
   */
  clearMemoizedKeys(keys: string[]): void {
    for (const key of keys) {
      this.memoizedValues.delete(key);
    }
  }

  /**
   * Default equality function that performs a shallow comparison.
   *
   * @param prev - Previous state
   * @param next - Next state
   * @returns Whether the states are equal
   */
  private defaultAreEqual(prev: T, next: T): boolean {
    if (prev === next) return true;

    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);

    if (prevKeys.length !== nextKeys.length) return false;

    return prevKeys.every((key) => prev[key as keyof T] === next[key as keyof T]);
  }

  /**
   * Processes all batched updates at once.
   */
  private processBatchedUpdates(): void {
    if (this.batchedUpdates.length === 0) {
      this.batchTimer = null;
      return;
    }

    // Merge all updates into a single update
    const mergedUpdate = this.batchedUpdates.reduce((acc, update) => ({ ...acc, ...update }), {});
    this.batchedUpdates = [];
    this.batchTimer = null;

    this.applyUpdate(mergedUpdate);
  }

  /**
   * Applies a state update and notifies listeners if the state has changed.
   *
   * @param update - Partial state update to apply
   */
  private applyUpdate(update: Partial<T>): void {
    const updateStartTime = this.config.metrics?.measureUpdates ? performance.now() : 0;
    const now = Date.now();

    // Check if we need to track update frequency
    if (this.config.metrics?.enabled && this.config.metrics.measureUpdates) {
      const timeSinceLastUpdate = now - this.lastUpdateTime;
      this.updateTimes.push(timeSinceLastUpdate);

      // Keep only the last 10 update times for calculating average
      if (this.updateTimes.length > 10) {
        this.updateTimes.shift();
      }

      this.lastUpdateTime = now;
    }

    // Create the new state
    const nextState = { ...this.state, ...update };

    // Check if the state has actually changed
    const equalityStartTime = this.config.metrics?.measureComputations ? performance.now() : 0;
    const hasChanged = !this.config.areEqual(this.state, nextState);

    if (this.config.metrics?.measureComputations) {
      this.equalityCheckDurations.push(performance.now() - equalityStartTime);

      // Keep only the last 10 durations
      if (this.equalityCheckDurations.length > 10) {
        this.equalityCheckDurations.shift();
      }
    }

    if (!hasChanged) {
      return;
    }

    // Update the state
    this.state = nextState;

    // Invalidate memoized values if their dependencies changed
    if (this.config.enableMemoization) {
      this.invalidateAffectedMemoizedValues(update);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(this.state));

    // Track update duration
    if (this.config.metrics?.measureUpdates) {
      const duration = performance.now() - updateStartTime;
      this.updateDurations.push(duration);

      // Keep only the last 10 durations
      if (this.updateDurations.length > 10) {
        this.updateDurations.shift();
      }
    }

    // Report metrics if enabled
    if (this.config.metrics?.enabled && this.config.metrics.onMetrics) {
      this.reportMetrics();
    }
  }

  /**
   * Checks if any dependencies for a memoized value have changed.
   *
   * @param key - The memoization key
   * @param dependencies - Array of state property paths
   * @returns Whether any dependencies have changed
   */
  private haveDependenciesChanged(key: string, dependencies: string[]): boolean {
    // Get the previously stored dependencies for this key
    const storedDependencies = this.memoizationDependencies.get(key) || [];

    // If the dependencies array has changed, consider it as changed
    // eslint-disable-next-line security/detect-object-injection -- This is a safe use of object injection
    if (storedDependencies.length !== dependencies.length || !storedDependencies.every((dep, i) => dep === dependencies[i])) {
      return true;
    }

    // Create a safe copy of dependencies to avoid object injection issues
    const safeDependencies = [...dependencies];

    // Check if any of the dependencies have changed in the state
    return safeDependencies.some((dep) => this.hasPropertyChanged(dep, this.state));
  }

  /**
   * Safely checks if a property path has changed in the state.
   *
   * @param path - The dot-notation path to check
   * @param state - The state object to check against
   * @returns Whether the property has changed
   */
  private hasPropertyChanged(path: string, state: T): boolean {
    const parts = path.split(".");
    return this.comparePropertyPath(parts, state, state);
  }

  /**
   * Recursively compares a property path between previous and next state.
   *
   * @param parts - The parts of the property path
   * @param prevState - The previous state
   * @param nextState - The next state
   * @returns Whether the property has changed
   */
  private comparePropertyPath(parts: string[], prevState: unknown, nextState: unknown): boolean {
    if (parts.length === 0) {
      return prevState !== nextState;
    }

    const current = parts[0];
    const rest = parts.slice(1);

    // If either value is not an object, we can't traverse further
    if (!prevState || typeof prevState !== "object" || !nextState || typeof nextState !== "object") {
      return prevState !== nextState;
    }

    // Convert objects to Maps for safer property access
    const prevMap = new Map(Object.entries(prevState as Record<string, unknown>));
    const nextMap = new Map(Object.entries(nextState as Record<string, unknown>));

    // Get values safely from Maps
    const prevValue = prevMap.get(current);
    const nextValue = nextMap.get(current);

    // If this is the last part, compare the values
    if (rest.length === 0) {
      return prevValue !== nextValue;
    }

    // Otherwise, continue traversing
    return this.comparePropertyPath(rest, prevValue, nextValue);
  }

  /**
   * Invalidates memoized values whose dependencies have changed.
   *
   * @param update - The partial state update
   */
  private invalidateAffectedMemoizedValues(update: Partial<T>): void {
    const updatedKeys = Object.keys(update);

    this.memoizationDependencies.forEach((dependencies, key) => {
      const isAffected = dependencies.some((dep) => {
        const topLevelProp = dep.split(".")[0];
        return updatedKeys.includes(topLevelProp);
      });

      if (isAffected) {
        this.memoizedValues.delete(key);
      }
    });
  }

  /**
   * Calculates and reports performance metrics.
   */
  private reportMetrics(): void {
    if (!this.config.metrics?.onMetrics) return;

    const metrics: StateManagerMetrics = {
      updateFrequency: this.updateTimes.length > 0 ? this.updateTimes.reduce((sum, time) => sum + time, 0) / this.updateTimes.length : 0,
      updateDuration:
        this.updateDurations.length > 0 ? this.updateDurations.reduce((sum, duration) => sum + duration, 0) / this.updateDurations.length : 0,
      updateCount: this.updateTimes.length,
    };

    // Add memory usage metrics if enabled
    if (this.config.metrics.measureMemory) {
      metrics.memoryUsage = {
        stateSize: this.approximateSize(this.state),
        memoizedSize: this.approximateSize(Object.fromEntries(this.memoizedValues)),
      };
    }

    // Add computation timing metrics if enabled
    if (this.config.metrics.measureComputations) {
      metrics.computationDuration = {
        equality:
          this.equalityCheckDurations.length > 0
            ? this.equalityCheckDurations.reduce((sum, duration) => sum + duration, 0) / this.equalityCheckDurations.length
            : 0,
        memoization:
          this.memoizationDurations.length > 0
            ? this.memoizationDurations.reduce((sum, duration) => sum + duration, 0) / this.memoizationDurations.length
            : 0,
        derivations:
          this.derivationDurations.length > 0
            ? this.derivationDurations.reduce((sum, duration) => sum + duration, 0) / this.derivationDurations.length
            : 0,
      };
    }

    this.config.metrics.onMetrics(metrics);
  }

  /**
   * Approximates the size of an object in memory.
   * This is a rough estimate based on JSON string length.
   *
   * @param obj - The object to measure
   * @returns Approximate size in bytes
   */
  private approximateSize(obj: unknown): number {
    const jsonString = JSON.stringify(obj);
    return jsonString ? jsonString.length * 2 : 0; // Rough estimate: 2 bytes per character
  }

  private shouldMeasureComputations(): boolean {
    return this.config.metrics?.measureComputations ?? false;
  }
}
