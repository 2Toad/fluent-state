import { State } from "./state";
import { AutoTransitionCondition } from "./types";

/**
 * Represents a transition between states in the state machine.
 * A transition defines a possible change from a source state to a target state.
 */
export class Transition {
  /** The state that this transition belongs to */
  state: State;

  /** The unique identifier for this transition */
  name: string;

  constructor(name: string, state: State) {
    this.state = state;
    this.name = name;
  }

  /**
   * Creates a source state and establishes a transition to the current state.
   *
   * @param name - The name of the source state to create.
   * @returns The source State object that can transition to this state.
   */
  from(name: string): State {
    return this.state.fluentState.from(name);
  }

  /**
   * Adds an alternative target state that can be transitioned to from the source state.
   * This creates a new transition path in the state machine, allowing for multiple possible
   * target states from a single source state.
   *
   * @param name - The name of the alternative target state.
   * @param autoTransition - Optional condition for automatic transition to this state.
   * @returns A new Transition object representing this alternative path.
   */
  or(name: string, autoTransition?: AutoTransitionCondition): Transition {
    return this.state.to(name, autoTransition);
  }
}
