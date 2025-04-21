import { State } from "./state";
import { Event } from "./event";
import { Observer } from "./observer";
import {
  LifeCycleHandler,
  FluentStatePlugin,
  Lifecycle,
  TransitionError,
  StateError,
  FluentStateOptions,
  TransitionHistoryOptions,
  StateManagerConfig,
  DebugConfig,
  LogLevel,
  LogEntry,
  GraphConfig,
  SerializedTransitionGroup,
  AutoTransitionConfig,
  TimeSnapshot,
  TimelineOptions,
  StateWarningType,
  StateWarning,
} from "./types";
import { TransitionHistory } from "./transition-history";
import { TransitionGroup } from "./transition-group";
import { DebugManager } from "./debug-manager";
import { TimeTravel } from "./time-travel";

/**
 * The main class for building and managing a state machine.
 * Provides a fluent interface for defining states and transitions.
 */
export class FluentState {
  /** A map of all states in the state machine */
  readonly states: Map<string, State> = new Map();

  /** A map of all transition groups in the state machine */
  readonly groups: Map<string, TransitionGroup> = new Map();

  /** The current state of the state machine */
  state: State;

  /** The initial state name from options */
  private _initialState?: string;

  /** The observer for handling lifecycle events */
  readonly observer: Observer = new Observer();

  /** The history of state transitions */
  history?: TransitionHistory;

  /** Debugging tools and logging manager */
  readonly debug: DebugManager;

  /** Whether transition history tracking is enabled */
  private historyEnabled: boolean;

  /** Configuration for the state manager */
  private stateManagerConfig?: StateManagerConfig<unknown>;

  /** Middleware functions that intercept transitions */
  private middlewares: ((prev: State | null, next: string, transition: () => void) => void | Promise<void>)[] = [];

  /**
   * Configuration for graph visualization
   * @private
   */
  private _graphConfig?: DebugConfig["generateGraph"];

  /** Whether the state machine is in time travel mode */
  private _inTimeTravelMode: boolean = false;

  /**
   * Creates a new FluentState instance.
   *
   * @param options - Configuration options for the state machine
   */
  constructor(options: FluentStateOptions = {}) {
    this.historyEnabled = options.enableHistory ?? false;
    this.stateManagerConfig = options.stateManagerConfig;

    // Store the initial state name
    this._initialState = options.initialState;

    // Initialize the debug manager
    this.debug = new DebugManager(this);

    // Configure debug settings if provided
    if (options.debug) {
      this.configureDebug(options.debug);
    }

    if (this.historyEnabled) {
      this.history = new TransitionHistory({
        maxSize: options.historyOptions?.maxSize ?? 100,
        includeContext: options.historyOptions?.includeContext ?? true,
        contextFilter: options.historyOptions?.contextFilter,
      });
    }

    if (options.initialState) {
      this.state = this._addState(options.initialState);
    }
  }

  /**
   * Configure the debug manager with the provided settings.
   *
   * @param config - Debug configuration settings.
   * @returns The FluentState instance for method chaining.
   */
  configureDebug(config: DebugConfig = {}): FluentState {
    if (config.logLevel !== undefined) {
      this.debug.configureLogging({ logLevel: config.logLevel });
    }

    if (config.measurePerformance !== undefined) {
      this.debug.configureLogging({ measurePerformance: config.measurePerformance });
    }

    if (config.logFormat) {
      this.debug.configureLogging({ logFormat: config.logFormat });
    }

    // Add custom log handlers
    if (Array.isArray(config.logHandlers)) {
      for (const handler of config.logHandlers) {
        this.debug.addLogger(handler);
      }
    }

    // Configure history if specified
    if (config.keepHistory || config.historySize !== undefined || config.includeContextInHistory !== undefined) {
      const options: { maxSize?: number; includeContext?: boolean; contextFilter?: (context: unknown) => unknown } = {};

      if (config.historySize !== undefined) {
        options.maxSize = config.historySize;
      }

      if (config.includeContextInHistory !== undefined) {
        options.includeContext = config.includeContextInHistory;
      }

      if (config.contextFilter) {
        options.contextFilter = config.contextFilter;
      }

      this.debug.enableHistoryTracking(config.keepHistory !== false, options);
    }

    // Configure time travel if specified
    if (config.timeTravel) {
      // Make sure history is enabled for time travel
      if (!this.historyEnabled && !config.keepHistory) {
        this.debug.enableHistoryTracking(true);
      }
      this.debug.configureTimeTravel(config.timeTravel);
    }

    // Configure automatic validation if specified
    if (config.autoValidate !== undefined) {
      this.debug.configureLogging({
        autoValidate: config.autoValidate,
        validateOnStateChangesOnly: config.validateOnStateChangesOnly,
        validateOptions: config.validateOptions,
      });
    }

    return this;
  }

  /**
   * The format to use when exporting configuration
   * @private
   */
  private _configExportFormat: "json" | "yaml" | "js" = "json";

  /**
   * Exports the complete state machine configuration.
   * This is the implementation of the exportConfig property in DebugConfig.
   *
   * @param options Optional export configuration that overrides the default format
   * @returns The serialized state machine configuration
   */
  exportConfig(options?: {
    format?: "json" | "yaml" | "js";
    indent?: number;
    includeStates?: boolean;
    includeTransitions?: boolean;
    includeGroups?: boolean;
    includeSettings?: boolean;
    pretty?: boolean;
    redactSecrets?: boolean | ((key: string, value: unknown) => boolean);
    omitKeys?: string[];
    includeHistory?: boolean;
    historyLimit?: number;
  }): string {
    // If format is not specified in options, use the configured format
    const exportOptions = {
      ...options,
      format: options?.format || this._configExportFormat,
    };

    return this.debug.exportConfig(exportOptions);
  }

  /**
   * Exports a minimal configuration that can be used to recreate this state machine.
   *
   * @param options Optional export configuration
   * @returns The serialized recreation configuration
   */
  exportRecreationConfig(options?: {
    format?: "json" | "yaml" | "js";
    indent?: number;
    pretty?: boolean;
    redactSecrets?: boolean | ((key: string, value: unknown) => boolean);
    omitKeys?: string[];
    withComments?: boolean;
  }): string {
    // If format is not specified in options, use the configured format
    const exportOptions = {
      ...options,
      format: options?.format || this._configExportFormat,
    };

    return this.debug.exportRecreationConfig(exportOptions);
  }

  /**
   * Exports the state machine as fluent JavaScript code that can recreate it.
   *
   * @param options Optional export configuration
   * @returns JavaScript code that can recreate the state machine
   */
  exportAsFluentCode(options?: {
    includeImports?: boolean;
    variableName?: string;
    withComments?: boolean;
    redactSecrets?: boolean | ((key: string, value: unknown) => boolean);
    omitKeys?: string[];
    indent?: number;
  }): string {
    return this.debug.exportAsFluentCode(options);
  }

  /**
   * Set the log level for the debug manager.
   *
   * @param level - The log level to set
   * @returns The FluentState instance for chaining
   */
  setLogLevel(level: LogLevel): FluentState {
    this.debug.setLogLevel(level);
    return this;
  }

  /**
   * Add a custom log handler.
   *
   * @param handler - Function that will receive log entries
   * @returns The FluentState instance for chaining
   */
  addLogHandler(handler: (entry: LogEntry) => void): FluentState {
    this.debug.addLogger(handler);
    return this;
  }

  /**
   * Enable performance measurement.
   *
   * @param enable - Whether to enable performance measurement
   * @returns The FluentState instance for chaining
   */
  enablePerformanceMeasurement(enable: boolean = true): FluentState {
    this.debug.enablePerformanceMeasurement(enable);
    return this;
  }

  /**
   * Enables transition history tracking.
   *
   * @param options - Configuration options for the transition history
   * @returns The FluentState instance for chaining
   */
  enableHistory(options?: TransitionHistoryOptions): FluentState {
    this.historyEnabled = true;
    this.history = new TransitionHistory(options);
    return this;
  }

  /**
   * Configures the state manager with the provided options.
   *
   * @param config - The configuration for the state manager
   * @returns The FluentState instance for chaining
   */
  configureStateManager(config: StateManagerConfig<unknown>): FluentState {
    this.stateManagerConfig = config;
    return this;
  }

  /**
   * Extends the state machine with a plugin.
   * A plugin can be:
   * 1. A function that takes the FluentState instance and extends it
   * 2. A transition middleware function that intercepts transitions
   * 3. An object with an install method
   *
   * @param plugin - The plugin to install
   * @returns The FluentState instance for chaining
   */
  use(plugin: FluentStatePlugin): FluentState {
    if (typeof plugin === "function") {
      // Check if it's a middleware function (3 parameters) or a plugin function (1 parameter)
      if (plugin.length === 3) {
        this.middlewares.push(plugin as (prev: State | null, next: string, transition: () => void) => void | Promise<void>);
      } else {
        (plugin as (fluentState: FluentState) => void)(this);
      }
    } else {
      // It's a plugin object with an install method
      plugin.install(this);
    }
    return this;
  }

  /**
   * Creates a state in the state machine.
   * If this is the first state added, it becomes the current state.
   *
   * @param name - The name of the state to create.
   * @returns The State object that can be used to define transitions.
   */
  from(name: string): State {
    let state = this._getState(name);

    if (!state) {
      state = this._addState(name);
      this.state = state;
    }

    return state;
  }

  /**
   * Checks if the current state can transition to the specified target state.
   *
   * @param name - The name of the target state to check.
   * @returns True if the current state can transition to the target state, false otherwise.
   */
  can(name: string): boolean {
    return this.state && this.state.can(name);
  }

  /**
   * Starts the state machine and triggers the initial state.
   * This method should be called after all states have been defined and transitions have been configured.
   * It will trigger the `onEnter` and `AfterTransition` events for the initial state.
   */
  async start(): Promise<FluentState> {
    if (this.state) {
      // Log the start of the state machine
      this.debug.info(`Starting state machine with initial state: ${this.state.name}`);

      const startTime = performance.now();

      await this.state._triggerEnter(null);
      await this.observer.trigger(Lifecycle.AfterTransition, null, this.state);
      if (this.state.handlers.length > 0) {
        await Promise.all(this.state.handlers.map((handler) => handler(null, this.state)));
      }

      // Record performance metric
      const duration = performance.now() - startTime;
      this.debug.recordMetric("transitionEvaluation", "start", duration);

      // Record the initial state as a transition from null
      if (this.historyEnabled && this.history) {
        const initialStateName = this.state.name;
        const groupWithInitialState = Array.from(this.groups.values()).find((group) =>
          group.getAllTransitions().some(([, to]) => to === initialStateName),
        );

        this.history.recordTransition(null, this.state.name, this.state.getContext(), true, groupWithInitialState?.getFullName());

        // Log the transition
        this.debug.logTransition(null, this.state.name, true, this.state.getContext());
      }
    } else {
      this.debug.warn("Attempted to start state machine without an initial state");
    }
    return this;
  }

  /**
   * Attempts to transition to a new state.
   *
   * @param targetState - The name of the state to transition to
   * @param context - Optional context object that can be used in transition logic
   * @returns A Promise that resolves to true if the transition was successful, false otherwise
   */
  async transition(targetState?: string, context?: unknown): Promise<boolean> {
    // Start timing the transition
    const startTime = performance.now();

    // Check if target state is provided
    if (targetState === undefined) {
      this.debug.error("No target state specified for transition", {
        availableStates: Array.from(this.states.keys()),
      });
      throw new TransitionError(`No target state specified. Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    // Can't transition if there's no current state
    if (!this.state) {
      this.debug.warn("Cannot transition when there is no current state");
      return false;
    }

    const currentState = this.state;
    const fromState = currentState.name;

    this.debug.debug(`Evaluating transition: ${fromState} → ${targetState}`, context);

    // If the state doesn't exist yet, add it
    if (!this.states.has(targetState)) {
      this.debug.info(`Creating new state: ${targetState}`);
      this._addState(targetState);
    }

    // Check if any group blocks the transition
    for (const group of this.groups.values()) {
      if (group.hasTransition(fromState, targetState) && !group.isEnabled(context)) {
        this.debug.warn(`Transition ${fromState} → ${targetState} blocked: group ${group.getFullName()} is disabled`);

        if (!group.allowsManualTransitions(context)) {
          // Record the failed transition
          if (this.historyEnabled && this.history) {
            this.history.recordTransition(currentState, targetState, context, false, group.getFullName());
          }

          // Record performance metric
          const duration = performance.now() - startTime;
          this.debug.recordMetric("transitionEvaluation", `${fromState}->${targetState}`, duration, {
            blocked: true,
            blockedBy: group.getFullName(),
          });

          return false;
        }
      }
    }

    // Try to perform the transition
    const toState = this.states.get(targetState);

    // Check if the transition is valid
    if (this.state.can(targetState)) {
      // Run any middleware that could block the transition
      if (this.middlewares.length > 0 && !(await this._runMiddlewares(currentState, targetState))) {
        // Middleware blocked the transition
        this.debug.warn(`Transition ${fromState} → ${targetState} blocked by middleware`);

        if (this.historyEnabled && this.history) {
          this.history.recordTransition(currentState, targetState, context, false);
        }

        // Record performance metric
        const duration = performance.now() - startTime;
        this.debug.recordMetric("transitionEvaluation", `${fromState}->${targetState}`, duration, {
          blocked: true,
          blockedBy: "middleware",
        });

        return false;
      }

      // Find the groups that directly contain this transition
      const groupsWithTransition = Array.from(this.groups.values()).filter((group) => group.hasTransition(fromState, targetState));

      // Check if any group middleware blocks the transition
      for (const group of groupsWithTransition) {
        if (!(await group._runMiddleware(fromState, targetState, context))) {
          // Group middleware blocked the transition
          this.debug.warn(`Transition ${fromState} → ${targetState} blocked by group ${group.getFullName()} middleware`);

          if (this.historyEnabled && this.history) {
            this.history.recordTransition(currentState, targetState, context, false, group.getFullName());
          }

          // Record performance metric
          const duration = performance.now() - startTime;
          this.debug.recordMetric("transitionEvaluation", `${fromState}->${targetState}`, duration, {
            blocked: true,
            blockedBy: `group-${group.getFullName()}`,
          });

          return false;
        }
      }

      // Execute the transition with all lifecycle events
      const result = await this._executeTransition(
        currentState,
        toState!,
        groupsWithTransition.length > 0 ? groupsWithTransition[0].getFullName() : undefined,
      );

      // If successful, trigger transition handlers for groups
      if (result) {
        // Trigger transition handlers only for groups that directly contain the transition
        for (const group of groupsWithTransition) {
          group._triggerTransitionHandlers(fromState, targetState, context);
        }
      }

      // Record performance metric
      const duration = performance.now() - startTime;
      this.debug.recordMetric("transitionEvaluation", `${fromState}->${targetState}`, duration, {
        success: result,
      });

      return result;
    } else {
      this.debug.warn(`Invalid transition: ${fromState} → ${targetState}`, {
        validTransitions: this.state.transitions,
      });

      // Record the failed transition
      if (this.historyEnabled && this.history) {
        // Find if this transition belongs to any group
        const groupWithTransition = Array.from(this.groups.values()).find((group) => group.hasTransition(fromState, targetState));
        this.history.recordTransition(currentState, targetState, context, false, groupWithTransition?.getFullName());
      }

      // Record performance metric
      const duration = performance.now() - startTime;
      this.debug.recordMetric("transitionEvaluation", `${fromState}->${targetState}`, duration, {
        blocked: true,
        reason: "invalid-transition",
      });

      return false;
    }
  }

  async next(...exclude: string[]): Promise<boolean> {
    const name = this.state._getRandomTransition(exclude);
    return name ? this.transition(name) : false;
  }

  /**
   * Starts a callback chain for a specific state.
   * This is the entry point for defining state-specific callbacks that execute when entering the state.
   *
   * @param name - The name of the state to create callbacks for.
   * @returns An Event object that can be used to define callbacks using `do()` and chain them with `and()`.
   * @throws {StateError} If the specified state doesn't exist.
   */
  when(name: string): Event {
    const state = this._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    return new Event(state);
  }

  /**
   * Removes a state from the state machine.
   *
   * @param name - The name of the state to remove.
   */
  remove(name: string): void {
    const stateToRemove = this._getState(name);
    if (!stateToRemove) return;

    // Clean up any resources in the state before removing
    if (typeof stateToRemove["clearAllDebounceTimers"] === "function") {
      stateToRemove["clearAllDebounceTimers"]();
    }

    this.debug.debug(`Removing state: ${name}`);
    this.states.delete(name);

    // Remove all transitions to this state from other states
    this.states.forEach((state) => {
      state.transitions = state.transitions.filter((transition) => transition !== name);
    });

    // Remove all transitions involving this state from all groups
    this.groups.forEach((group) => {
      group.removeTransitionsInvolvingState(name);
    });

    // If we're removing the current state, set the current state to the next available state
    if (this.state === stateToRemove) {
      const nextState = this.states.values().next().value;
      this.state = nextState || null;

      if (nextState) {
        this.debug.info(`Current state removed, moved to: ${nextState.name}`);
      } else {
        this.debug.warn("Current state removed, no states remain in the machine");
      }
    }
  }

  /**
   * Clears all states from the state machine.
   */
  clear(): void {
    // Clean up any resources in states before clearing
    this.states.forEach((state) => {
      // Call internal method to clear debounce timers if it exists
      if (typeof state["clearAllDebounceTimers"] === "function") {
        state["clearAllDebounceTimers"]();
      }
    });

    this.debug.info("Clearing all states from the state machine");
    this.states.clear();
    this.state = null;
  }

  /**
   * Checks if a state exists in the state machine.
   *
   * @param name - The name of the state to check.
   * @returns True if the state exists, false otherwise.
   */
  has(name: string): boolean {
    return !!this._getState(name);
  }

  /**
   * Adds an observer for a specific lifecycle event.
   *
   * @param event - The lifecycle event to observe.
   * @param handler - The handler function to execute when the event occurs.
   * @returns The FluentState instance for chaining.
   */
  observe(event: Lifecycle, handler: LifeCycleHandler): FluentState {
    this.debug.debug(`Adding observer for lifecycle event: ${Lifecycle[event]}`);
    this.observer.add(event, handler);
    return this;
  }

  /**
   * Sets the current state of the state machine without triggering a transition.
   *
   * @param name - The name of the state to set as the current state.
   * @returns The State object that was set as the current state.
   */
  setState(name: string): State {
    const state = this._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    const prevState = this.state ? this.state.name : "null";
    this.debug.info(`Setting state directly: ${prevState} → ${name}`);
    this.state = state;
    return state;
  }

  /**
   * Adds a new state to the state machine.
   *
   * @param name - The name of the state to add.
   * @returns The State object that was added.
   */
  _addState(name: string): State {
    let state = this._getState(name);
    if (state) {
      return state;
    }

    this.debug.debug(`Adding new state: ${name}`);
    state = new State(name, this);
    this.states.set(name, state);
    return state;
  }

  /**
   * Gets a state from the state machine by name.
   *
   * @param name - The name of the state to get.
   * @returns The State object if found, null otherwise.
   */
  _getState(name: string): State | null {
    return this.states.get(name) || null;
  }

  /**
   * Gets the current state of the state machine.
   * @returns The current state, or null if the state machine hasn't been started
   */
  getCurrentState(): State | null {
    return this.state || null;
  }

  /**
   * Runs all middleware functions that intercept transitions.
   *
   * @param currentState - The current state of the state machine.
   * @param nextStateName - The name of the next state to transition to.
   * @returns True if all middlewares proceed, false otherwise.
   */
  private async _runMiddlewares(currentState: State, nextStateName: string): Promise<boolean> {
    if (this.middlewares.length === 0) return true;

    this.debug.debug(`Running ${this.middlewares.length} middleware functions for transition: ${currentState.name} → ${nextStateName}`);

    for (const middleware of this.middlewares) {
      let shouldProceed = false;
      const runNextMiddleware = () => {
        shouldProceed = true;
      };

      const middlewareStartTime = performance.now();
      await middleware(currentState, nextStateName, runNextMiddleware);
      const middlewareDuration = performance.now() - middlewareStartTime;

      this.debug.recordMetric("contextUpdate", "middleware", middlewareDuration);

      if (!shouldProceed) {
        this.debug.debug(`Middleware blocked transition: ${currentState.name} → ${nextStateName}`);
        return false; // Middleware blocked the transition
      }
    }
    return true;
  }

  /**
   * Executes a transition between two states.
   *
   * @param currentState - The current state of the state machine.
   * @param nextState - The next state to transition to.
   * @param groupName - The name of the group associated with the transition
   * @returns True if the transition was successful, false otherwise.
   */
  private async _executeTransition(currentState: State, nextState: State, groupName?: string): Promise<boolean> {
    // Get the context before transition for history recording
    const contextBeforeTransition = currentState.getContext();

    this.debug.debug(`Executing transition: ${currentState.name} → ${nextState.name}`, {
      context: contextBeforeTransition,
      group: groupName,
    });

    // BeforeTransition must occur first to allow for any pre-transition logic or validation,
    // and to provide an opportunity to cancel the transition if necessary.
    const beforeStartTime = performance.now();
    const results = await this.observer.trigger(Lifecycle.BeforeTransition, currentState, nextState.name);
    const beforeDuration = performance.now() - beforeStartTime;

    this.debug.recordMetric("contextUpdate", "beforeTransition", beforeDuration);

    if (results.includes(false)) {
      this.debug.warn(`Transition ${currentState.name} → ${nextState.name} cancelled by BeforeTransition hook`);

      // Record failed transition due to BeforeTransition hook returning false
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, false, groupName);
      }

      // Log the failed transition
      this.debug.logTransition(currentState, nextState.name, false, contextBeforeTransition);

      return false;
    }

    // FailedTransition must occur next to allow for any failed transition logic, including whether
    // the transition has been cancelled.
    if (!currentState.can(nextState.name)) {
      this.debug.warn(`Invalid transition: ${currentState.name} → ${nextState.name}`);

      const failedStartTime = performance.now();
      await this.observer.trigger(Lifecycle.FailedTransition, currentState, nextState.name);
      const failedDuration = performance.now() - failedStartTime;

      this.debug.recordMetric("contextUpdate", "failedTransition", failedDuration);

      // Record failed transition due to invalid transition
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, false, groupName);
      }

      // Log the failed transition
      this.debug.logTransition(currentState, nextState.name, false, contextBeforeTransition);

      return false;
    }

    // Trigger exit hook before state change
    const exitStartTime = performance.now();
    await currentState._triggerExit(nextState);
    const exitDuration = performance.now() - exitStartTime;

    this.debug.recordMetric("contextUpdate", "exitHook", exitDuration);
    this.debug.debug(`Exit hooks completed for state: ${currentState.name}`);

    this.setState(nextState.name);

    // Trigger enter hook after state change but before AfterTransition
    const enterStartTime = performance.now();
    await nextState._triggerEnter(currentState);
    const enterDuration = performance.now() - enterStartTime;

    this.debug.recordMetric("contextUpdate", "enterHook", enterDuration);
    this.debug.debug(`Enter hooks completed for state: ${nextState.name}`);

    // AfterTransition is triggered after the state has changed but before any state-specific handlers.
    // This allows for any general post-transition logic.
    const afterStartTime = performance.now();
    await this.observer.trigger(Lifecycle.AfterTransition, currentState, nextState);
    const afterDuration = performance.now() - afterStartTime;

    this.debug.recordMetric("contextUpdate", "afterTransition", afterDuration);

    // State-specific handlers are executed last. These are defined using `when().do()`
    if (nextState.handlers.length > 0) {
      this.debug.debug(`Executing ${nextState.handlers.length} state-specific handlers for: ${nextState.name}`);

      const handlersStartTime = performance.now();
      await Promise.all(nextState.handlers.map((handler) => handler(currentState, nextState)));
      const handlersDuration = performance.now() - handlersStartTime;

      this.debug.recordMetric("contextUpdate", "stateHandlers", handlersDuration);
    }

    // Record successful transition
    if (this.historyEnabled && this.history) {
      this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, true, groupName);
    }

    // Log the successful transition
    this.debug.logTransition(currentState, nextState.name, true, contextBeforeTransition);
    this.debug.info(`Transition completed: ${currentState.name} → ${nextState.name}`);

    return true;
  }

  /**
   * Generates a visual representation of the state machine.
   *
   * @param options - Optional configuration for the graph visualization
   * @returns A string containing the graph representation
   */
  generateGraph(options?: GraphConfig): string {
    if (!this.debug) {
      console.warn("Debug manager is not initialized. Please call configureDebug() first.");
      return "";
    }

    const graphOptions: GraphConfig = {
      format: "mermaid",
      ...this._graphConfig,
      ...options,
    };

    return this.debug.generateGraph(graphOptions);
  }

  /**
   * Creates a new transition group with the given name.
   *
   * @param name - The unique name for the group
   * @param parentGroup - Optional parent group for configuration inheritance
   * @returns The newly created group
   * @throws If a group with the same name already exists
   */
  createGroup(name: string, parentGroup?: string | TransitionGroup): TransitionGroup {
    if (this.groups.has(name)) {
      throw new StateError(`Group with name "${name}" already exists`);
    }

    let parentGroupObj: TransitionGroup | undefined;

    // If parent group is provided, find it
    if (parentGroup) {
      if (typeof parentGroup === "string") {
        parentGroupObj = this.groups.get(parentGroup);
        if (!parentGroupObj) {
          throw new StateError(`Parent group "${parentGroup}" not found`);
        }
      } else {
        parentGroupObj = parentGroup;
      }
    }

    this.debug.debug(`Creating transition group: ${name}`, { parentGroup: parentGroupObj?.getFullName() });
    const group = new TransitionGroup(name, this, parentGroupObj);
    this.groups.set(name, group);

    return group;
  }

  /**
   * Gets a transition group by name.
   *
   * @param name - The name of the group to retrieve
   * @returns The group or null if not found
   */
  group(name: string): TransitionGroup | null {
    return this.groups.get(name) || null;
  }

  /**
   * Gets all transition groups in this state machine.
   *
   * @returns An array of all transition groups
   */
  getAllGroups(): TransitionGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Removes a transition group from the state machine
   * @param name The name of the group to remove
   * @returns True if the group was removed, false if it doesn't exist
   */
  removeGroup(name: string): boolean {
    if (!this.groups.has(name)) {
      return false;
    }

    this.groups.delete(name);
    return true;
  }

  /**
   * Creates a group from a serialized configuration
   * @param config The serialized group configuration
   * @param conditionMap Optional map of condition functions with various structures
   * @returns The created transition group
   */
  createGroupFromConfig(config: SerializedTransitionGroup, conditionMap: Record<string, unknown> = {}): TransitionGroup {
    const fullName = config.namespace ? `${config.namespace}:${config.name}` : config.name;
    const group = this.createGroup(fullName);

    // Set properties from serialized configuration
    if (config.enabled === false) {
      group.disable({ preventManualTransitions: config.preventManualTransitions || false });
    }

    // Apply additional configuration to the group
    if (config.config) {
      group.withConfig(config.config);
    }

    // Populate the group from the serialized configuration
    if (config.transitions && Array.isArray(config.transitions)) {
      for (const transition of config.transitions) {
        // Try to find a condition function for this transition
        let condition: ((context: unknown) => boolean) | undefined = undefined;

        // Look for nested condition structure: conditionMap[groupName][fromState][toState]
        if (conditionMap[config.name]?.[transition.from]?.[transition.to]) {
          condition = conditionMap[config.name][transition.from][transition.to];
        }
        // Look for flat condition structure: conditionMap[fromState][toState]
        else if (conditionMap[transition.from]?.[transition.to]) {
          condition = conditionMap[transition.from][transition.to] as (context: unknown) => boolean;
        }
        // Also check for direct function: conditionMap[fromState]
        else if (typeof conditionMap[transition.from] === "function") {
          condition = conditionMap[transition.from] as (context: unknown) => boolean;
        }

        // Create a transition builder for "from" state
        const fromBuilder = group.from(transition.from);

        // Add tags if they exist
        if (transition.tags && transition.tags.length > 0) {
          fromBuilder.withTags(...transition.tags);
        }

        if (condition) {
          // Create a complete transition config with the condition and any serialized properties
          const transitionConfig: AutoTransitionConfig = {
            condition,
            targetState: transition.to,
            ...transition.config,
          };
          fromBuilder.to(transition.to, transitionConfig);
        } else {
          // Create a transition without a condition but with any serialized config
          if (transition.config) {
            const transitionConfig: AutoTransitionConfig = {
              condition: () => true,
              targetState: transition.to,
              ...transition.config,
            };
            fromBuilder.to(transition.to, transitionConfig);
          } else {
            fromBuilder.to(transition.to);
          }
        }
      }
    }

    return group;
  }

  /**
   * Exports all transition groups as serializable objects
   * @returns Array of serialized transition groups
   */
  exportGroups(): SerializedTransitionGroup[] {
    const result: SerializedTransitionGroup[] = [];

    // Export each transition group
    for (const [, group] of this.groups) {
      result.push(group.serialize());
    }

    return result;
  }

  /**
   * Imports transition groups from serialized configurations
   * @param groups Array of serialized transition groups
   * @param conditionMap Optional map of condition functions with various nested structures
   * @param options Import options
   * @returns The FluentState instance
   */
  importGroups(
    groups: SerializedTransitionGroup[],
    conditionMap: Record<string, unknown> = {},
    options: { skipExisting?: boolean; replaceExisting?: boolean } = {},
  ): this {
    const { skipExisting = false, replaceExisting = false } = options;

    // First pass: Create all groups
    const createdGroups = new Map<string, TransitionGroup>();
    for (const groupConfig of groups) {
      const groupName = groupConfig.name;

      // Check if the group already exists
      if (this.groups.has(groupName)) {
        if (skipExisting) {
          continue;
        }

        if (replaceExisting) {
          this.removeGroup(groupName);
        }
      }

      // Create the group from the configuration
      const group = this.createGroupFromConfig(groupConfig, conditionMap);
      createdGroups.set(groupName, group);
    }

    // Second pass: Set up parent-child relationships
    for (const groupConfig of groups) {
      if (groupConfig.parentGroup && createdGroups.has(groupConfig.name)) {
        const group = createdGroups.get(groupConfig.name);
        const parentGroup = this.groups.get(groupConfig.parentGroup);

        if (parentGroup) {
          // Set the parent-child relationship
          group.setParent(parentGroup);
        }
      }
    }

    return this;
  }

  /**
   * Access time travel debugging capabilities
   *
   * @returns The TimeTravel instance
   */
  getTimeTravel(): TimeTravel {
    return this.debug.getTimeTravel()!;
  }

  /**
   * Generate a timeline visualization of state transitions
   *
   * @param options - Options for customizing the timeline visualization
   * @returns A string containing the timeline representation
   */
  generateTimeline(options?: TimelineOptions): string {
    if (!this.history) {
      console.warn("Timeline generation requires history tracking. Enabling history with default options.");
      this.enableHistory();
    }

    return this.debug.generateTimeline(options || {});
  }

  /**
   * Checks if the state machine is in time travel mode
   *
   * @returns True if the state machine is in time travel mode
   */
  isInTimeTravelMode(): boolean {
    const timeTravel = this.debug.getTimeTravel();
    return timeTravel ? timeTravel.isTimeTravelMode() : false;
  }

  /**
   * Travel to a specific point in history by index
   *
   * @param index - The index in history to travel to
   * @returns The snapshot representing the state at that point in history
   */
  travelToHistoryIndex(index: number): TimeSnapshot | null {
    const timeTravel = this.getTimeTravel();
    return timeTravel.travelToIndex(index);
  }

  /**
   * Travel to a specific point in history by timestamp
   *
   * @param timestamp - The timestamp to travel to
   * @returns The snapshot representing the state at that point in history
   */
  travelToTimestamp(timestamp: number): TimeSnapshot | null {
    const timeTravel = this.getTimeTravel();
    return timeTravel.travelToTimestamp(timestamp);
  }

  /**
   * Move to the next state in history (more recent)
   *
   * @returns The next state snapshot or null if at the end of history
   */
  nextHistoryState(): TimeSnapshot | null {
    const timeTravel = this.getTimeTravel();
    return timeTravel.next();
  }

  /**
   * Move to the previous state in history (less recent)
   *
   * @returns The previous state snapshot or null if at the beginning of history
   */
  previousHistoryState(): TimeSnapshot | null {
    const timeTravel = this.getTimeTravel();
    return timeTravel.previous();
  }

  /**
   * Return to the current (most recent) state, exiting time travel mode
   *
   * @returns True if successfully returned to current state
   */
  returnToCurrentState(): boolean {
    const timeTravel = this.getTimeTravel();
    return timeTravel.returnToCurrent();
  }

  /**
   * Validates the state machine and detects potential issues.
   * Performs various checks to identify problems such as unreachable states,
   * conflicting transitions, or circular dependencies.
   *
   * @param options - Optional configuration for validation
   * @returns Array of warning objects with details about issues found
   */
  validateStateMachine(options?: { severity?: "info" | "warn" | "error"; types?: StateWarningType[]; logWarnings?: boolean }): StateWarning[] {
    const warnings = this.debug.validateStateMachine(options);

    // Optionally log the warnings
    if (options?.logWarnings) {
      for (const warning of warnings) {
        const message = `State Machine Warning: ${warning.description}`;
        switch (warning.severity) {
          case "info":
            this.debug.info(message, warning);
            break;
          case "warn":
            this.debug.warn(message, warning);
            break;
          case "error":
            this.debug.error(message, warning);
            break;
        }
      }
    }

    return warnings;
  }
}

// Create and export a default instance
export const fluentState = new FluentState();
