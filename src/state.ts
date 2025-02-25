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
