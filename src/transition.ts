import { State } from "./state";

export class Transition {
  state: State;

  name: string;

  constructor(name: string, state: State) {
    this.state = state;
    this.name = name;
  }

  from(name: string): State {
    return this.state.fluentState.from(name);
  }

  or(name: string): Transition {
    return this.state.to(name);
  }
}
