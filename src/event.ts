import { FluentState } from './fluent-state';
import { State } from './state';
import { Handler } from './handler';

export class Event {
  state: State;

  constructor(state: State) {
    this.state = state;
  }

  when(name: string): Event {
    const state = this.state.fluentState._getState(name);
    if (!state) { throw new Error(`Unknown state: "${name}"`); }

    return new Event(state);
  }

  do(handler: (previousState: State, fluentState: FluentState) => any): Handler {
    this.state._addHandler(handler);
    return new Handler(this);
  }
}
