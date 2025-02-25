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
} from "./types";
import { TransitionHistory } from "./transition-history";

/**
 * The main class for building and managing a state machine.
 * Provides a fluent interface for defining states and transitions.
 */
export class FluentState {
  /** A map of all states in the state machine */
  readonly states: Map<string, State> = new Map();

  /** The current state of the state machine */
  state: State;

  /** The observer for handling lifecycle events */
  readonly observer: Observer = new Observer();

  /** The history of state transitions */
  history?: TransitionHistory;

  /** Whether transition history tracking is enabled */
  private historyEnabled: boolean;

  /** Configuration for the state manager */
  private stateManagerConfig?: StateManagerConfig<unknown>;

  /** Middleware functions that intercept transitions */
  private middlewares: ((prev: State | null, next: string, transition: () => void) => void | Promise<void>)[] = [];

  /**
   * Creates a new FluentState instance.
   *
   * @param options - Configuration options for the state machine
   */
  constructor(options: FluentStateOptions = {}) {
    this.historyEnabled = options.enableHistory ?? false;
    this.stateManagerConfig = options.stateManagerConfig;

    if (this.historyEnabled) {
      this.history = new TransitionHistory(options.historyOptions);
    }

    if (options.initialState) {
      this.state = this._addState(options.initialState);
    }
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
      await this.state._triggerEnter(null);
      await this.observer.trigger(Lifecycle.AfterTransition, null, this.state);
      if (this.state.handlers.length > 0) {
        await Promise.all(this.state.handlers.map((handler) => handler(null, this.state)));
      }

      // Record the initial state as a transition from null
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(null, this.state.name, this.state.getContext(), true);
      }
    }
    return this;
  }

  /**
   * Transitions to a new state.
   *
   * Lifecycle events within the transition process occur in this order:
   * BeforeTransition -> FailedTransition -> AfterTransition -> State-specific handlers
   *
   * @param names - The name(s) of the state(s) to transition to. If multiple are provided, one is chosen randomly.
   * @returns A promise that resolves to true if the transition was successful, false otherwise.
   */
  async transition(...names: string[]): Promise<boolean> {
    if (!names.length) {
      throw new TransitionError(`No target state specified. Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    const currentState = this.state;
    const nextStateName = names.length === 1 ? names[0] : names[Math.floor(Math.random() * names.length)];

    if (!(await this._runMiddlewares(currentState, nextStateName))) {
      // Record failed transition due to middleware blocking
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextStateName, currentState.getContext(), false);
      }
      return false;
    }

    const nextState = this._getState(nextStateName);
    if (!nextState) {
      await this.observer.trigger(Lifecycle.FailedTransition, currentState, nextStateName);

      // Record failed transition due to missing state
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextStateName, currentState.getContext(), false);
      }
      return false;
    }

    return this._executeTransition(currentState, nextState);
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

    this.states.delete(name);

    // Remove all transitions to this state from other states
    this.states.forEach((state) => {
      state.transitions = state.transitions.filter((transition) => transition !== name);
    });

    // If we're removing the current state, set the current state to the next available state
    if (this.state === stateToRemove) {
      const nextState = this.states.values().next().value;
      this.state = nextState || null;
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

    for (const middleware of this.middlewares) {
      let shouldProceed = false;
      const runNextMiddleware = () => {
        shouldProceed = true;
      };
      await middleware(currentState, nextStateName, runNextMiddleware);
      if (!shouldProceed) {
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
   * @returns True if the transition was successful, false otherwise.
   */
  private async _executeTransition(currentState: State, nextState: State): Promise<boolean> {
    // Get the context before transition for history recording
    const contextBeforeTransition = currentState.getContext();

    // BeforeTransition must occur first to allow for any pre-transition logic or validation,
    // and to provide an opportunity to cancel the transition if necessary.
    const results = await this.observer.trigger(Lifecycle.BeforeTransition, currentState, nextState.name);
    if (results.includes(false)) {
      // Record failed transition due to BeforeTransition hook returning false
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, false);
      }
      return false;
    }

    // FailedTransition must occur next to allow for any failed transition logic, including whether
    // the transition has been cancelled.
    if (!currentState.can(nextState.name)) {
      await this.observer.trigger(Lifecycle.FailedTransition, currentState, nextState.name);

      // Record failed transition due to invalid transition
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, false);
      }
      return false;
    }

    // Trigger exit hook before state change
    await currentState._triggerExit(nextState);

    this.setState(nextState.name);

    // Trigger enter hook after state change but before AfterTransition
    await nextState._triggerEnter(currentState);

    // AfterTransition is triggered after the state has changed but before any state-specific handlers.
    // This allows for any general post-transition logic.
    await this.observer.trigger(Lifecycle.AfterTransition, currentState, nextState);

    // State-specific handlers are executed last. These are defined using `when().do()` and
    // are meant for actions that should occur specifically after entering this new state.
    if (nextState.handlers.length > 0) {
      await Promise.all(nextState.handlers.map((handler) => handler(currentState, nextState)));
    }

    // Record successful transition
    if (this.historyEnabled && this.history) {
      this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, true);
    }

    return true;
  }
}

export const fluentState = new FluentState();
export default fluentState;
