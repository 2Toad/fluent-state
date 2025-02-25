import { FluentState } from "./fluent-state";
import { Transition } from "./transition";
import { EventHandler, EnterEventHandler, ExitEventHandler, AutoTransitionConfig, AutoTransition } from "./types";
import { IStateManager, StateManager } from "./state-manager";

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

  constructor(name: string, fluentState: FluentState) {
    this.fluentState = fluentState;
    this.name = name;
    this.stateManager = new StateManager({});
    this.unsubscribe = this.stateManager.subscribe(async (context) => {
      await this.evaluateAutoTransitions(context);
    });
  }

  /**
   * Creates a transition from this state to another state.
   * If the target state doesn't exist, it will be created.
   *
   * @param name - The name of the target state to transition to.
   * @param autoTransition - Optional condition that, when true, will automatically trigger this transition.
   * @returns A Transition object that can be used to chain additional state configurations.
   */
  to<TContext>(name: string, autoTransition?: AutoTransition<TContext>): Transition {
    this.fluentState._addState(name);
    if (autoTransition) {
      this.autoTransitions.push({
        condition: autoTransition,
        targetState: name,
      });
    }

    return this._addTransition(name);
  }

  /**
   * Sets a custom state manager to handle context updates.
   * This allows users to integrate their own state management solution.
   *
   * @param stateManager - The custom state manager to use
   */
  setStateManager<T>(stateManager: IStateManager<T>): void {
    // Clean up existing subscription if any
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.stateManager = stateManager;
    this.unsubscribe = stateManager.subscribe(async (context) => {
      await this.evaluateAutoTransitions(context);
    });
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
  }

  /**
   * Gets the current context from the state manager.
   */
  getContext<T>(): T {
    return this.stateManager.getState() as T;
  }

  /**
   * Evaluates all auto-transitions with the given context.
   * This is called automatically when the context is updated,
   * but can also be called manually if needed.
   *
   * @param context - The context to evaluate transitions against
   * @returns true if a transition occurred
   */
  async evaluateAutoTransitions<TContext = unknown>(context: TContext): Promise<boolean> {
    for (const autoTransition of this.autoTransitions) {
      const transitioned = await this.evaluateAutoTransition(autoTransition, context);
      if (transitioned) return true;
    }
    return false;
  }

  /**
   * Evaluates a single auto-transition configuration
   * @returns true if transition occurred, false otherwise
   */
  private async evaluateAutoTransition<TContext>(config: AutoTransitionConfig<TContext>, context: TContext): Promise<boolean> {
    try {
      const shouldTransition = await config.condition(this, context);
      if (shouldTransition) {
        await this.fluentState.transition(config.targetState).catch((error) => {
          console.error("Auto-transition failed:", error);
        });
        return true;
      }
    } catch (error) {
      console.error("Error in auto-transition condition", error);
    }
    return false;
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
   * Triggers all enter handlers and evaluates auto-transitions.
   * Auto-transitions are evaluated in order and the first matching condition wins.
   */
  async _triggerEnter(previousState: State): Promise<void> {
    // First execute normal enter handlers
    await Promise.all(this.enterEventHandlers.map((handler) => handler(previousState, this)));

    // Then check auto-transitions with empty context
    await this.evaluateAutoTransitions({});
  }

  /**
   * Triggers all exit handlers in parallel when leaving this state.
   */
  async _triggerExit(nextState: State): Promise<void> {
    await Promise.all(this.exitEventHandlers.map((handler) => handler(this, nextState)));
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
    // eslint-disable-next-line security/detect-object-injection -- index is safely generated and transitions array is internal
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
}
