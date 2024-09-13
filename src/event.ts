import { State } from "./state";
import { Handler } from "./handler";
import { EventHandler } from "./types";

export class Event {
  constructor(public state: State) {}

  when(name: string): Event {
    const state = this.state.fluentState._getState(name);
    if (!state) {
      throw new Error(`Unknown state: "${name}"`);
    }

    return new Event(state);
  }

  do(handler: EventHandler): Handler {
    this.state._addHandler(handler);
    return new Handler(this);
  }
}
