import { FluentState } from "./fluent-state";
import { Transition } from "./transition";
import { EventHandler, EnterEventHandler, ExitEventHandler, AutoTransitionConfig, AutoTransition, IStateManager, StateManagerConfig } from "./types";
import { StateManager } from "./state-manager";

/**
 * Represents a distinct state in the state machine.
 * A state can have multiple outgoing transitions to other states,
 * and supports lifecycle hooks (enter/exit) and event handlers.
 */
export class State {
  /** Reference to the parent FluentState instance */
  fluentState: FluentState;

  /** The unique identifier for this state */
  name: string;

  /** List of state names that this state can transition to */
  transitions: string[] = [];

  /** Event handlers for state transitions */
  handlers: EventHandler[] = [];

  /** Handlers executed when entering this state */
  enterEventHandlers: EnterEventHandler[] = [];

  /** Handlers executed when exiting this state */
  exitEventHandlers: ExitEventHandler[] = [];

  /** Configuration for automatic transitions based on conditions */
  private autoTransitions: AutoTransitionConfig[] = [];

  /** State manager for handling context updates */
  private stateManager: IStateManager<unknown>;

  /** Cleanup function for state manager subscription */
  private unsubscribe?: () => void;

  /** Flag to track if we're currently evaluating transitions */
  private isEvaluating = false;

  /** Map of debounce timers for transitions with debounce values */
  private debounceTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(name: string, fluentState: FluentState) {
    this.fluentState = fluentState;
    this.name = name;

    // Initialize state manager with configuration from FluentState if available
    const stateManagerConfig = fluentState["stateManagerConfig"] as StateManagerConfig<unknown> | undefined;
    this.stateManager = new StateManager({}, stateManagerConfig);

    // Don't automatically subscribe to state changes
    // We'll evaluate transitions only when explicitly called
  }

  /**
   * Creates a transition from this state to another state.
   * If the target state doesn't exist, it will be created.
   *
   * @param name - The name of the target state to transition to.
   * @param config - Optional auto-transition configuration or condition function
   * @returns A Transition object that can be used to chain additional state configurations.
   */
  to<TContext>(name: string, config?: AutoTransitionConfig<TContext> | AutoTransition<TContext>): Transition {
    this.fluentState._addState(name);

    if (config) {
      // If config is a function, treat it as a condition
      if (typeof config === "function") {
        this.autoTransitions.push({
          condition: config,
          targetState: name,
        });
      } else {
        // Otherwise it's a full config object
        this.autoTransitions.push({
          condition: config.condition,
          targetState: name,
          priority: config.priority,
          debounce: config.debounce,
          retryConfig: config.retryConfig,
        });
      }
    }

    return this._addTransition(name);
  }

  /**
   * Sets a custom state manager for this state.
   *
   * @param stateManager - The state manager to use
   */
  setStateManager<T>(stateManager: IStateManager<T>): void {
    // Clean up existing subscription if any
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.stateManager = stateManager;
  }

  /**
   * Updates the context in the state manager.
   * This will trigger evaluation of auto-transitions.
   *
   * @param update - Partial update to apply to the context
   */
  updateContext<T>(update: Partial<T>): void {
    const currentState = this.stateManager.getState() as T;
    this.stateManager.setState({ ...currentState, ...update });

    // Check if we're still the current state in the state machine
    // This prevents evaluation if the state has already been exited
    if (this.fluentState.getCurrentState()?.name === this.name) {
      // Evaluate transitions after context update
      this.evaluateAutoTransitions(this.stateManager.getState());
    }
  }

  /**
   * Updates the context with multiple partial updates in a batch.
   * This method allows applying multiple updates at once and controlling
   * when auto-transitions are evaluated.
   *
   * @param updates - Array of partial context updates to apply
   * @param options - Optional configuration for the batch update
   * @returns Promise resolving to true if all updates succeeded, false otherwise
   *
   * @example
   * // Basic batch update
   * await machine.currentState.batchUpdate([
   *   { counter: 1 },
   *   { status: 'processing' },
   *   { progress: 0.5 }
   * ]);
   *
   * @example
   * // Atomic batch update with evaluation after completion
   * try {
   *   const success = await machine.currentState.batchUpdate(
   *     [
   *       { step1: 'complete' },
   *       { step2: 'complete' },
   *       { step3: 'complete' }
   *     ],
   *     {
   *       evaluateAfterComplete: true,
   *       atomic: true
   *     }
   *   );
   *
   *   if (success) {
   *     console.log('All steps completed successfully');
   *   }
   * } catch (error) {
   *   console.error('Failed to complete all steps:', error);
   * }
   */
  async batchUpdate<T>(
    updates: Partial<T>[],
    options?: {
      evaluateAfterComplete?: boolean; // Only trigger auto-transitions after all updates are applied
      atomic?: boolean; // Abort batch if any update fails and revert previous updates
    },
  ): Promise<boolean> {
    const { evaluateAfterComplete = false, atomic = false } = options || {};

    // Start performance measurement
    const startTime = performance.now();

    // Handle empty updates array
    if (!updates || updates.length === 0) {
      return true;
    }

    // Store original context for reverting if atomic and a failure occurs
    const originalContext = atomic ? this.getContext() : null;

    // Track if we should evaluate transitions
    const shouldEvaluate = this.fluentState.getCurrentState()?.name === this.name;

    // Get the groups that might be affected by transitions from this state
    const relevantGroups = Array.from(this.fluentState.groups.values()).filter((group) => group.hasTransitionsFromState(this.name));

    // Log the batch update
    this.fluentState.debug?.debug?.(`Batch update started for state: ${this.name}`, {
      updates: updates.length,
      evaluateAfterComplete,
      atomic,
      relevantGroups: relevantGroups.map((g) => g.getFullName()),
    });

    // Track errors for better reporting
    const errors: Array<{ index: number; update: Partial<T>; error: Error | unknown }> = [];

    try {
      // Track successful updates for non-atomic mode
      let anySucceeded = false;

      // Apply updates in order
      for (const [index, update] of updates.entries()) {
        try {
          const updateStartTime = performance.now();

          // Get current state before applying update
          const currentState = this.stateManager.getState() as T;

          // Apply the update using the state manager, which respects any custom equality functions
          this.stateManager.setState({ ...currentState, ...update });

          // Record update time in debug metrics
          const updateDuration = performance.now() - updateStartTime;
          this.fluentState.debug?.recordMetric?.("contextUpdate", `batchUpdate[${index}]`, updateDuration);

          // If not evaluating after complete, check transitions after each update
          if (!evaluateAfterComplete && shouldEvaluate) {
            const evalStartTime = performance.now();

            // Evaluate auto-transitions, which will respect transition priorities and debounce settings
            // because we're using the existing evaluateAutoTransitions method
            await this.evaluateAutoTransitions(this.stateManager.getState());

            const evalDuration = performance.now() - evalStartTime;
            this.fluentState.debug?.recordMetric?.("transitionEvaluation", `batchUpdate[${index}]`, evalDuration);
          }

          anySucceeded = true;
        } catch (error) {
          // Log the error and track for reporting
          this.fluentState.debug?.error?.(`Error in batch update at index ${index}`, error);
          errors.push({ index, update, error });

          if (atomic) {
            // In atomic mode, any failure means we need to revert and fail
            throw new Error(`Atomic batch update failed at index ${index}: ${error.message || error}`);
          }
          // In non-atomic mode, continue to the next update
        }
      }

      // If we're evaluating after complete, do it now
      if (evaluateAfterComplete && shouldEvaluate) {
        const finalEvalStartTime = performance.now();

        // Final evaluation of transitions with the complete updated context
        await this.evaluateAutoTransitions(this.stateManager.getState());

        const finalEvalDuration = performance.now() - finalEvalStartTime;
        this.fluentState.debug?.recordMetric?.("transitionEvaluation", "batchUpdateFinal", finalEvalDuration);
      }

      // Calculate and record total duration
      const totalDuration = performance.now() - startTime;
      this.fluentState.debug?.recordMetric?.("contextUpdate", "batchUpdateTotal", totalDuration, {
        updates: updates.length,
        success: true,
      });

      this.fluentState.debug?.info?.(`Batch update completed for state: ${this.name}`, {
        updates: updates.length,
        duration: totalDuration,
        success: true,
      });

      // In atomic mode, all updates succeeded
      // In non-atomic mode, at least one update succeeded
      return atomic ? true : anySucceeded;
    } catch (error) {
      // Calculate and record total duration for failed update
      const totalDuration = performance.now() - startTime;
      this.fluentState.debug?.recordMetric?.("contextUpdate", "batchUpdateTotal", totalDuration, {
        updates: updates.length,
        success: false,
        errors: errors.length > 0 ? errors : undefined,
      });

      this.fluentState.debug?.warn?.(`Batch update failed for state: ${this.name}`, {
        error,
        isAtomic: atomic,
        errors: errors.length > 0 ? errors : undefined,
      });

      // Atomic mode and an error occurred, revert to original context
      if (atomic && originalContext) {
        this.fluentState.debug?.info?.(`Reverting context for state: ${this.name} due to atomic batch failure`);

        // Restore original context without triggering transitions
        const revertStartTime = performance.now();
        this.stateManager.setState(originalContext);
        const revertDuration = performance.now() - revertStartTime;

        this.fluentState.debug?.recordMetric?.("contextUpdate", "batchUpdateRevert", revertDuration);

        // Also clean up any scheduled debounced transitions to ensure batch atomicity
        if (typeof this["clearAllDebounceTimers"] === "function") {
          this["clearAllDebounceTimers"]();
        }
      }

      return false;
    }
  }

  /**
   * Fluent version of batchUpdate that doesn't wait for the operation to complete.
   * This method is designed for method chaining in the fluent API pattern.
   *
   * @param updates - Array of partial context updates to apply
   * @param options - Optional configuration for the batch update
   * @returns The State instance for method chaining
   *
   * @example
   * // Method chaining with batchUpdateFluid
   * machine.currentState
   *   .batchUpdateFluid([
   *     { step: 1 },
   *     { status: 'inProgress' }
   *   ])
   *   .onExit(() => console.log('Exiting state'));
   */
  batchUpdateFluid<T>(
    updates: Partial<T>[],
    options?: {
      evaluateAfterComplete?: boolean;
      atomic?: boolean;
    },
  ): State {
    // Call the async version without awaiting
    this.batchUpdate(updates, options).catch((error) => {
      this.fluentState.debug?.error?.("Error in batchUpdateFluid", error);
    });

    // Return this for chaining
    return this;
  }

  /**
   * Gets the current context from the state manager.
   */
  getContext<T>(): T {
    return this.stateManager.getState() as T;
  }

  /**
   * Triggers all enter handlers and evaluates auto-transitions.
   * Auto-transitions are evaluated in order and the first matching condition wins.
   */
  async _triggerEnter(previousState: State): Promise<void> {
    // First execute normal enter handlers
    await Promise.all(this.enterEventHandlers.map((handler) => handler(previousState, this)));

    // Then check auto-transitions with empty context
    // Only evaluate if we have auto-transitions and we're not already transitioning
    if (this.autoTransitions.length > 0) {
      await this.evaluateAutoTransitions({});
    }
  }

  /**
   * Triggers all exit handlers in parallel when leaving this state.
   */
  async _triggerExit(nextState: State): Promise<void> {
    // Clear any debounce timers when exiting the state
    this.clearAllDebounceTimers();

    // Call all exit handlers
    for (const handler of this.exitEventHandlers) {
      await handler(this, nextState);
    }
  }

  /**
   * Adds an event handler for state transitions.
   */
  _addHandler(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Selects a random transition from this state's available transitions.
   * Transitions specified in the exclude list will not be considered.
   *
   * @param exclude - Optional list of state names to exclude from selection.
   * @returns The name of the randomly selected target state, or undefined if no valid transitions exist.
   */
  _getRandomTransition(exclude: string[] = []): string {
    if (!this.transitions.length) {
      console.warn(`No states to transition to from "${this.name}"`);
      return;
    }

    const transitions = this.transitions.filter((x) => !exclude.includes(x));
    if (!transitions.length) {
      console.warn(`No states to transition to from "${this.name}", after excluding: "${exclude.join('", "')}"`);
      return;
    }

    const index = Math.floor(Math.random() * transitions.length);
    return transitions[index];
  }

  /**
   * Creates a new transition to the specified state if it doesn't exist.
   *
   * @param name - The name of the target state.
   * @returns A Transition object representing the new or existing transition.
   */
  _addTransition(name: string): Transition {
    const transition = new Transition(name, this);

    if (!this.hasTransition(name)) {
      this.transitions.push(name);
    }

    return transition;
  }

  /**
   * Checks if this state can transition to the specified target state.
   *
   * @param name - The name of the target state to check.
   * @returns True if a transition exists to the target state, false otherwise.
   */
  can(name: string): boolean {
    return this.hasTransition(name);
  }

  /**
   * Adds a handler that executes when entering this state.
   * Multiple enter handlers can be added and they will execute in parallel.
   *
   * @param handler - Function to execute when entering this state.
   * @returns This State instance for method chaining.
   */
  onEnter(handler: EnterEventHandler): State {
    this.enterEventHandlers.push(handler);
    return this;
  }

  /**
   * Adds a handler that executes when exiting this state.
   * Multiple exit handlers can be added and they will execute in parallel.
   *
   * @param handler - Function to execute when exiting this state.
   * @returns This State instance for method chaining.
   */
  onExit(handler: ExitEventHandler): State {
    this.exitEventHandlers.push(handler);
    return this;
  }

  /**
   * Checks if this state has a transition to the specified state.
   */
  private hasTransition(name: string): boolean {
    return this.transitions.indexOf(name) >= 0;
  }

  /**
   * Evaluates all auto-transitions with the given context.
   * Transitions are evaluated in order of priority (highest to lowest).
   * For transitions with the same priority, the order they were defined is maintained.
   *
   * @param context - The context to evaluate transitions against
   * @returns true if a transition occurred
   */
  async evaluateAutoTransitions<TContext = unknown>(context: TContext): Promise<boolean> {
    if (this.isEvaluating) {
      return false;
    }

    // Clear any active debounce timers for immediate evaluation
    this.clearAllDebounceTimers();

    // Group transitions by whether they have debounce or not
    const nonDebouncedTransitions: AutoTransitionConfig[] = [];
    const debouncedTransitions: AutoTransitionConfig[] = [];

    // Sort transitions by priority (highest first)
    const sortedTransitions = [...this.autoTransitions].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    // Separate debounced and non-debounced transitions
    for (const transition of sortedTransitions) {
      if (transition.debounce && transition.debounce > 0) {
        debouncedTransitions.push(transition);
      } else {
        nonDebouncedTransitions.push(transition);
      }
    }

    // Process non-debounced transitions immediately
    const immediateResult = await this.processTransitions(nonDebouncedTransitions, context);
    if (immediateResult) {
      return true; // A transition happened, don't process debounced ones
    }

    // Schedule debounced transitions
    this.scheduleDebouncedTransitions(debouncedTransitions, context);

    return false;
  }

  /**
   * Process a list of transitions in priority order
   * @param transitions Transitions to process
   * @param context Context to evaluate transitions with
   * @returns Whether any transition was successful
   */
  private async processTransitions<TContext>(transitions: AutoTransitionConfig[], context: TContext): Promise<boolean> {
    this.isEvaluating = true;
    try {
      // Evaluate transitions in priority order
      for (const transition of transitions) {
        try {
          // Handle retry logic if configured
          if (transition.retryConfig && transition.retryConfig.maxAttempts > 0) {
            let attempts = 0;
            let lastError: unknown = null;

            while (attempts < transition.retryConfig.maxAttempts) {
              try {
                const shouldTransition = await transition.condition(this, context);

                // If condition returns false (vs throwing an error), stop retrying immediately
                if (!shouldTransition) {
                  break;
                }

                // Condition succeeded, attempt the transition
                await this.fluentState.transition(transition.targetState);
                return true;
              } catch (error) {
                lastError = error;
                attempts++;

                // Log retry attempt for debugging
                console.log(`Auto-transition retry attempt ${attempts}/${transition.retryConfig.maxAttempts} failed:`, error);

                // If we've reached max attempts, break out of retry loop
                if (attempts >= transition.retryConfig.maxAttempts) {
                  break;
                }

                // Wait for the specified delay before retrying
                await new Promise((resolve) => setTimeout(resolve, transition.retryConfig.delay));
              }
            }

            // If we've exhausted all retries and still failed, log the error
            if (lastError) {
              console.error("Auto-transition failed after all retry attempts:", lastError);
            }
          } else {
            // Standard non-retry behavior
            const shouldTransition = await transition.condition(this, context);
            if (shouldTransition) {
              await this.fluentState.transition(transition.targetState).catch((error) => {
                console.error("Auto-transition failed:", error);
              });
              return true;
            }
          }
        } catch (error) {
          console.error("Error in auto-transition condition", error);
          // Continue to next transition if this one errors
        }
      }
      return false;
    } finally {
      this.isEvaluating = false;
    }
  }

  /**
   * Schedule debounced transitions for later evaluation
   * @param transitions Transitions to schedule
   * @param context Context to evaluate transitions with
   */
  private scheduleDebouncedTransitions<TContext>(transitions: AutoTransitionConfig[], context: TContext): void {
    // For each debounced transition, clear existing timer and create a new one
    for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];
      const debounceTime = transition.debounce ?? 0;

      // Create a unique index for this transition
      const transitionIndex = this.autoTransitions.indexOf(transition);

      // Clear existing timer if any
      if (this.debounceTimers.has(transitionIndex)) {
        clearTimeout(this.debounceTimers.get(transitionIndex));
      }

      // Create new timer
      const timer = setTimeout(async () => {
        // Remove this timer from the map
        this.debounceTimers.delete(transitionIndex);

        // Only evaluate if we're still in this state
        if (this.fluentState.getCurrentState()?.name === this.name) {
          const shouldTransition = await transition.condition(this, context);
          if (shouldTransition) {
            await this.fluentState.transition(transition.targetState).catch((error) => {
              console.error("Debounced auto-transition failed:", error);
            });
          }
        }
      }, debounceTime);

      // Store the timer
      this.debounceTimers.set(transitionIndex, timer);
    }
  }

  /**
   * Clear all debounce timers
   */
  private clearAllDebounceTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
