import { FluentState } from "./fluent-state";
import { Event } from "./event";
import { State } from "./state";

export class Handler {
  event: Event;

  constructor(event: Event) {
    this.event = event;
  }

  when(name: string): Event {
    return this.event.when(name);
  }

  and(handler: (previousState: State, fluentState: FluentState) => any): Handler {
    return this.event.do(handler);
  }
}
