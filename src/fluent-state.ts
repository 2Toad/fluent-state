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
      throw new Error("Please specify the state you wish to transition to");
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

    const nextState = this.setState(nextStateName);

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
      throw new Error(`Unknown state: "${name}"`);
    }

    return new Event(state);
  }

  remove(name: string): void {
    this.states.delete(name);
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
      throw new Error(`Invalid state "${name}"`);
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
