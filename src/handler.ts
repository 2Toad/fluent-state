import { Event } from "./event";
import { EventHandler } from "./types";

/**
 * Represents a handler for state transitions.
 * This class is part of the internal implementation of the fluent callback API,
 * allowing for method chaining when defining state callbacks.
 */
export class Handler {
  event: Event;

  constructor(event: Event) {
    this.event = event;
  }

  /**
   * Continues the callback chain for a different state after using `and()`.
   * This method delegates to Event.when(), allowing the chain to continue
   * after adding multiple callbacks for the current state.
   *
   * @param name - The name of the next state to define callbacks for.
   * @returns A new Event object for the specified state.
   */
  when(name: string): Event {
    return this.event.when(name);
  }

  /**
   * Adds another callback handler for the current state in the chain.
   * The handler will be executed when the state machine enters this state.
   * Multiple handlers can be chained using this method repeatedly.
   *
   * @param handler - The callback function to execute when entering the state.
   * @returns A Handler object that allows chaining additional callbacks.
   */
  and(handler: EventHandler): Handler {
    return this.event.do(handler);
  }
}
