import { State } from "./state";
import { Event } from "./event";
import { Observer } from "./observer";
import { Lifecycle } from "./enums";
import { LifeCycleHandler } from "./types";
import { FluentStatePlugin } from "./types";
import { TransitionError, StateError } from "./types";

export class FluentState {
  readonly states: Map<string, State> = new Map();

  state: State;

  readonly observer: Observer = new Observer();

  private middlewares: ((prev: State | null, next: string, transition: () => void) => void)[] = [];

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
        this.middlewares.push(plugin as (prev: State | null, next: string, transition: () => void) => void);
      } else {
        (plugin as (fluentState: FluentState) => void)(this);
      }
    } else {
      // It's a plugin object with an install method
      plugin.install(this);
    }
    return this;
  }

  from(name: string): State {
    let state = this._getState(name);

    if (!state) {
      state = this._addState(name);
      this.state = state;
    }

    return state;
  }

  /**
   * Starts the state machine and triggers the initial state.
   * This method should be called after all states have been defined and transitions have been configured.
   * It will trigger the `onEnter` and `AfterTransition` events for the initial state.
   */
  start(): FluentState {
    if (this.state) {
      this.state._triggerEnter(null);
      this.observer.trigger(Lifecycle.AfterTransition, null, this.state);
      this.state.handlers.forEach((handler) => handler(null, this.state));
    }
    return this;
  }

  can(name: string): boolean {
    return this.state && this.state.can(name);
  }

  /**
   * Transitions to a new state.
   *
   * Lifecycle events within the transition process occur in this order:
   * BeforeTransition -> FailedTransition -> AfterTransition -> State-specific handlers
   *
   * @param names - The name(s) of the state(s) to transition to. If multiple are provided, one is chosen randomly.
   * @returns true if the transition was successful, false otherwise.
   */
  transition(...names: string[]): boolean {
    if (!names.length) {
      throw new TransitionError(`No target state specified. Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    const currentState = this.state;
    const nextStateName = names.length === 1 ? names[0] : names[Math.floor(Math.random() * names.length)];

    if (!this._runMiddlewares(currentState, nextStateName)) {
      return false;
    }
    return this._executeTransition(currentState, nextStateName);
  }

  next(...exclude: string[]): boolean {
    const name = this.state._getRandomTransition(exclude);
    return name ? this.transition(name) : false;
  }

  when(name: string): Event {
    const state = this._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    return new Event(state);
  }

  remove(name: string): void {
    const stateToRemove = this._getState(name);
    if (!stateToRemove) return;

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

  clear(): void {
    this.states.clear();
    this.state = null;
  }

  has(name: string): boolean {
    return !!this._getState(name);
  }

  observe(event: Lifecycle, handler: LifeCycleHandler): FluentState {
    this.observer.add(event, handler);
    return this;
  }

  setState(name: string): State {
    const state = this._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    this.state = state;
    return state;
  }

  _addState(name: string): State {
    let state = this._getState(name);
    if (state) {
      return state;
    }

    state = new State(name, this);
    this.states.set(name, state);
    return state;
  }

  _getState(name: string): State {
    return this.states.get(name);
  }

  private _runMiddlewares(currentState: State, nextStateName: string): boolean {
    let index = 0;
    let shouldProceed = false;

    const runNextMiddleware = () => {
      shouldProceed = true;
    };

    while (index < this.middlewares.length) {
      shouldProceed = false;
      const middleware = this.middlewares[index++];
      middleware(currentState, nextStateName, runNextMiddleware);
      if (!shouldProceed) {
        return false; // Middleware blocked the transition
      }
    }
    return true;
  }

  private _executeTransition(currentState: State, nextStateName: string): boolean {
    // BeforeTransition must occur first to allow for any pre-transition logic or validation,
    // and to provide an opportunity to cancel the transition if necessary.
    const results = this.observer.trigger(Lifecycle.BeforeTransition, currentState, nextStateName);
    if (results.includes(false)) {
      return false;
    }

    // FailedTransition must occur next to allow for any failed transition logic, including whether
    // the transition has been cancelled.
    if (!this.can(nextStateName)) {
      this.observer.trigger(Lifecycle.FailedTransition, currentState, nextStateName);
      return false;
    }

    const nextState = this._getState(nextStateName);

    // Trigger exit hook before state change
    currentState._triggerExit(nextState);

    this.setState(nextStateName);

    // Trigger enter hook after state change but before AfterTransition
    nextState._triggerEnter(currentState);

    // AfterTransition is triggered after the state has changed but before any state-specific handlers.
    // This allows for any general post-transition logic.
    this.observer.trigger(Lifecycle.AfterTransition, currentState, nextState);

    // State-specific handlers are executed last. These are defined using `when().do()` and
    // are meant for actions that should occur specifically after entering this new state.
    this.state.handlers.forEach((handler) => handler(currentState, nextState));

    return true;
  }
}

export const fluentState = new FluentState();
export default fluentState;
