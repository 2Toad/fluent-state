import { State } from "./state";
import { Event } from "./event";
import { Observer } from "./observer";
import { Lifecycle } from "./enums";
import { LifeCycleHandler } from "./types";

export class FluentState {
  states: Map<string, State> = new Map();

  state: State;

  observer: Observer = new Observer();

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
    return this.state.can(name);
  }

  /**
   * Transitions to a new state.
   *
   * Lifecycle events within the transition process occur in this order:
   * BeforeTransition -> FailedTransition -> AfterTransition -> State-specific handlers
   *
   * This order ensures that:
   * 1. Pre-transition checks can be performed (BeforeTransition)
   * 2. Failed transitions are properly handled (FailedTransition)
   * 3. Post-transition logic is executed (AfterTransition)
   * 4. State-specific actions are performed last
   *
   * This separation provides a clear distinction between the transition process itself
   * and any side effects that should occur after entering a new state.
   *
   * @param names - The name(s) of the state(s) to transition to. If multiple are provided, one is chosen randomly.
   * @returns true if the transition was successful, false otherwise.
   */
  transition(...names: string[]): boolean {
    if (!names.length) {
      throw new Error("Transition error: No target state specified");
    }

    const currentState = this.state;
    const nextStateName = names.length === 1 ? names[0] : names[Math.floor(Math.random() * names.length)];

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

  next(...exclude: string[]): boolean {
    const name = this.state._getRandomTransition(exclude);
    return name ? this.transition(name) : false;
  }

  when(name: string): Event {
    const state = this._getState(name);
    if (!state) {
      throw new Error(`When error: Unknown state: "${name}"`);
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
      throw new Error(`SetState Error: Unknown state: "${name}"`);
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
}

export const fluentState = new FluentState();
export default fluentState;
