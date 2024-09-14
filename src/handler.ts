import { Event } from "./event";
import { EventHandler } from "./types";

export class Handler {
  event: Event;

  constructor(event: Event) {
    this.event = event;
  }

  when(name: string): Event {
    return this.event.when(name);
  }

  and(handler: EventHandler): Handler {
    return this.event.do(handler);
  }
}
