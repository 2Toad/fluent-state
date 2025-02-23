import { State } from "./state";
import { FluentState } from "./fluent-state";

export type BeforeTransitionHandler = (currentState: State, nextState: string) => boolean | Promise<boolean>;
export type FailedTransitionHandler = (currentState: State, targetState: string) => void | Promise<void> | undefined;
export type AfterTransitionHandler = (previousState: State, currentState: State) => void | Promise<void> | undefined;

export type LifeCycleHandler = BeforeTransitionHandler | FailedTransitionHandler | AfterTransitionHandler;

export type EventHandler = (previousState: State, currentState: State) => void | Promise<void> | undefined;

export type EnterEventHandler = (previousState: State, currentState: State) => void | Promise<void> | undefined;
export type ExitEventHandler = (currentState: State, nextState: State) => void | Promise<void> | undefined;

export type AutoTransitionCondition = (state: State) => boolean | Promise<boolean>;

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

/**
 * A plugin can be either:
 * 1. A function that takes the FluentState instance and extends it
 * 2. A transition middleware function that intercepts transitions
 * 3. An object that implements the Plugin interface
 */
export type FluentStatePlugin =
  | ((fluentState: FluentState) => void)
  | ((prev: State | null, next: string, transition: () => void) => void)
  | { install: (fluentState: FluentState) => void };
