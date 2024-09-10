import { FluentState } from "./fluent-state";
import { State } from "./state";
import { Handler } from "./handler";
import { Lifecycle } from "./enums";

export class Event {
  constructor(public state: State) {}

  when(name: string): Event {
    const state = this.state.fluentState._getState(name);
    if (!state) {
      throw new Error(`Unknown state: "${name}"`);
    }

    return new Event(state);
  }

  do(handler: (previousState: State, fluentState: FluentState) => any): Handler {
    this.state.fluentState.observe(Lifecycle.AfterTransition, (prevState, currentState) => {
      if (currentState.name === this.state.name) {
        handler(prevState, this.state.fluentState);
      }
    });
    return new Handler(this);
  }
}
