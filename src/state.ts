import { FluentState } from "./fluent-state";
import { Transition } from "./transition";
import { EventHandler, EnterEventHandler, ExitEventHandler, AutoTransitionCondition } from "./types";

interface AutoTransitionConfig {
  condition: AutoTransitionCondition;
  targetState: string;
}

/**
 * Represents a distinct state in the state machine.
 * A state can have multiple outgoing transitions to other states,
 * and supports lifecycle hooks (enter/exit) and event handlers.
 */
export class State {
  /** Reference to the parent FluentState instance */
  fluentState: FluentState;

  /** The unique identifier for this state */
  name: string;

  /** List of state names that this state can transition to */
  transitions: string[] = [];

  /** Event handlers for state transitions */
  handlers: EventHandler[] = [];

  /** Handlers executed when entering this state */
  enterEventHandlers: EnterEventHandler[] = [];

  /** Handlers executed when exiting this state */
  exitEventHandlers: ExitEventHandler[] = [];

  /** Configuration for automatic transitions based on conditions */
  private autoTransitions: AutoTransitionConfig[] = [];

  constructor(name: string, fluentState: FluentState) {
    this.fluentState = fluentState;
    this.name = name;
  }

  /**
   * Creates a transition from this state to another state.
   * If the target state doesn't exist, it will be created.
   *
   * @param name - The name of the target state to transition to.
   * @param autoTransition - Optional condition that, when true, will automatically trigger this transition.
   * @returns A Transition object that can be used to chain additional state configurations.
   */
  to(name: string, autoTransition?: AutoTransitionCondition): Transition {
    this.fluentState._addState(name);
    if (autoTransition) {
      this.autoTransitions.push({ condition: autoTransition, targetState: name });
    }

    return this._addTransition(name);
  }

  /**
   * Checks if this state can transition to the specified target state.
   *
   * @param name - The name of the target state to check.
   * @returns True if a transition exists to the target state, false otherwise.
   */
  can(name: string): boolean {
    return this.hasTransition(name);
  }

  /**
   * Adds a handler that executes when entering this state.
   * Multiple enter handlers can be added and they will execute in parallel.
   *
   * @param handler - Function to execute when entering this state.
   * @returns This State instance for method chaining.
   */
  onEnter(handler: EnterEventHandler): State {
    this.enterEventHandlers.push(handler);
    return this;
  }

  /**
   * Adds a handler that executes when exiting this state.
   * Multiple exit handlers can be added and they will execute in parallel.
   *
   * @param handler - Function to execute when exiting this state.
   * @returns This State instance for method chaining.
   */
  onExit(handler: ExitEventHandler): State {
    this.exitEventHandlers.push(handler);
    return this;
  }

  /**
   * Checks if this state has a transition to the specified state.
   */
  private hasTransition(name: string): boolean {
    return this.transitions.indexOf(name) >= 0;
  }

  /**
   * Triggers all enter handlers and evaluates auto-transitions.
   * Auto-transitions are evaluated in order and the first matching condition wins.
   */
  async _triggerEnter(previousState: State): Promise<void> {
    // First execute normal enter handlers
    await Promise.all(this.enterEventHandlers.map((handler) => handler(previousState, this)));

    // Then check auto-transitions
    for (const autoTransition of this.autoTransitions) {
      try {
        const shouldTransition = await autoTransition.condition(this);
        if (shouldTransition) {
          await this.fluentState.transition(autoTransition.targetState).catch((error) => {
            console.error("Auto-transition failed:", error);
          });
          break; // First matching condition wins
        }
      } catch (error) {
        console.error("Error in auto-transition condition", error);
      }
    }
  }

  /**
   * Triggers all exit handlers in parallel when leaving this state.
   */
  async _triggerExit(nextState: State): Promise<void> {
    await Promise.all(this.exitEventHandlers.map((handler) => handler(this, nextState)));
  }

  /**
   * Adds an event handler for state transitions.
   */
  _addHandler(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Selects a random transition from this state's available transitions.
   * Transitions specified in the exclude list will not be considered.
   *
   * @param exclude - Optional list of state names to exclude from selection.
   * @returns The name of the randomly selected target state, or undefined if no valid transitions exist.
   */
  _getRandomTransition(exclude: string[] = []): string {
    if (!this.transitions.length) {
      console.warn(`No states to transition to from "${this.name}"`);
      return;
    }

    const transitions = this.transitions.filter((x) => !exclude.includes(x));
    if (!transitions.length) {
      console.warn(`No states to transition to from "${this.name}", after excluding: "${exclude.join('", "')}"`);
      return;
    }

    const index = Math.floor(Math.random() * transitions.length);
    // eslint-disable-next-line security/detect-object-injection -- index is safely generated and transitions array is internal
    return transitions[index];
  }

  /**
   * Creates a new transition to the specified state if it doesn't exist.
   *
   * @param name - The name of the target state.
   * @returns A Transition object representing the new or existing transition.
   */
  _addTransition(name: string): Transition {
    const transition = new Transition(name, this);

    if (!this.hasTransition(name)) {
      this.transitions.push(name);
    }

    return transition;
  }
}
