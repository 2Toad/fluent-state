import { State } from "./state";
import { Handler } from "./handler";
import { EventHandler, StateError } from "./types";

/**
 * Represents a chainable event handler for state transitions.
 * This class is part of the internal implementation of the fluent callback API,
 * allowing for method chaining when defining state callbacks.
 */
export class Event {
  constructor(public state: State) {}

  /**
   * Continues the callback chain for another state.
   * This allows defining callbacks for multiple states in a single chain.
   *
   * @param name - The name of the next state to define callbacks for.
   * @returns A new Event object for the specified state.
   * @throws {Error} If the specified state doesn't exist.
   */
  when(name: string): Event {
    const state = this.state.fluentState._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.state.fluentState.states.keys()).join(", ")}`);
    }

    return new Event(state);
  }

  /**
   * Adds a callback handler for the current state in the chain.
   * The handler will be executed when the state machine enters this state.
   * Multiple handlers can be chained using the returned Handler's `and()` method.
   *
   * @param handler - The callback function to execute when entering the state.
   * @returns A Handler object that allows chaining additional callbacks with `and()`.
   */
  do(handler: EventHandler): Handler {
    this.state._addHandler(handler);
    return new Handler(this);
  }
}
