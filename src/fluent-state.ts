import { State } from './state';
import { Event } from './event';
import { Observer } from './observer';
import { Lifecycle } from './enums';

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

  transition(name: string): boolean {
    const previousState = this.state;
    const results = this.observer.trigger(Lifecycle.BeforeTransition, previousState, name);
    if (results.some(x => x === false)) { return false; }

    if (!this.can(name)) {
      this.observer.trigger(Lifecycle.TransitionFailed, previousState, name);
      return false;
    }

    this.setState(name);
    this.state.handlers.forEach(x => x(previousState, this));

    this.observer.trigger(Lifecycle.AfterTransition, previousState, this.state);
    return true;
  }

  next(exclude?: string[]): boolean {
    const name = this.state._getRandomTransition(exclude);
    return name ? this.transition(name) : false;
  }

  when(name: string): Event {
    const state = this._getState(name);
    if (!state) { throw new Error(`Unknown state: "${name}"`); }

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

  observe(event: Lifecycle, handler: Function): FluentState {
    this.observer.add(event, handler);
    return this;
  }

  setState(name: string): void {
    const state = this._getState(name);
    if (!state) { throw new Error(`Invalid state "${name}"`); }

    this.state = state;
  }

  _addState(name: string): State {
    let state = this._getState(name);
    if (state) { return state; }

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
