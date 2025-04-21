import { State } from "./state";
import { AutoTransition, AutoTransitionEvaluationConfig } from "./types";

/**
 * Represents a transition between states in the state machine.
 * A transition defines a possible change from a source state to a target state.
 */
export class Transition {
  /** The state that this transition belongs to */
  state: State;

  /** The unique identifier for this transition */
  name: string;

  /** The index of the transition in the state's autoTransitions array */
  private transitionIndex?: number;

  constructor(name: string, state: State) {
    this.state = state;
    this.name = name;

    // Find the index of the most recently added transition
    if (state["autoTransitions"] && state["autoTransitions"].length > 0) {
      this.transitionIndex = state["autoTransitions"].length - 1;
    }
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
  or<TContext>(name: string, autoTransition?: AutoTransition<TContext>): Transition {
    return this.state.to(name, autoTransition);
  }

  /**
   * Configures when and how this transition should be evaluated.
   *
   * @param config - Configuration for controlling transition evaluation
   * @returns This Transition instance for method chaining
   */
  withEvaluationConfig(config: AutoTransitionEvaluationConfig): Transition {
    if (this.transitionIndex === undefined || !this.state["autoTransitions"]) {
      console.warn(`Cannot configure evaluation for transition to "${this.name}" - no auto-transition defined`);
      return this;
    }

    // Get reference to the auto-transition config
    const autoTransition = this.state["autoTransitions"][this.transitionIndex];
    if (autoTransition) {
      // Set or merge the evaluation config
      autoTransition.evaluationConfig = {
        ...autoTransition.evaluationConfig,
        ...config,
      };
    }

    return this;
  }

  /**
   * Configures this transition to only evaluate when specified properties change.
   *
   * @param properties - Property paths to watch for changes
   * @returns This Transition instance for method chaining
   */
  watchProperties(...properties: string[]): Transition {
    return this.withEvaluationConfig({
      watchProperties: properties,
    });
  }

  /**
   * Configures this transition to skip evaluation when the provided condition is true.
   *
   * @param skipFn - Function that returns true when evaluation should be skipped
   * @returns This Transition instance for method chaining
   */
  skipIf(skipFn: (context: unknown) => boolean): Transition {
    return this.withEvaluationConfig({
      skipIf: skipFn,
    });
  }

  /**
   * Sets the evaluation timing strategy for this transition.
   *
   * @param strategy - Timing strategy for this transition
   * @returns This Transition instance for method chaining
   */
  evaluateOn(strategy: "immediate" | "nextTick" | "idle"): Transition {
    return this.withEvaluationConfig({
      evaluationStrategy: strategy,
    });
  }
}
