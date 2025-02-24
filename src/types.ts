import { State } from "./state";
import { FluentState } from "./fluent-state";

export type BeforeTransitionHandler = (currentState: State, nextState: string) => boolean | Promise<boolean>;
export type FailedTransitionHandler = (currentState: State, targetState: string) => void | Promise<void> | undefined;
export type AfterTransitionHandler = (previousState: State, currentState: State) => void | Promise<void> | undefined;

export type LifeCycleHandler = BeforeTransitionHandler | FailedTransitionHandler | AfterTransitionHandler;

/** Handler for state-specific events */
export type EventHandler = (previousState: State | null, currentState: State) => void | Promise<void>;

/** Handler for state enter events */
export type EnterEventHandler = (previousState: State | null, currentState: State) => void | Promise<void>;

/** Handler for state exit events */
export type ExitEventHandler = (currentState: State, nextState: State) => void | Promise<void>;

/** Error thrown when a state operation fails */
export class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

/** Error thrown when a transition operation fails */
export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
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

/**
 * Configuration for an auto-transition.
 *
 * @template TContext - The type of context object used in the condition function.
 */
export interface AutoTransitionConfig<TContext = unknown> {
  condition: AutoTransition<TContext>;
  targetState: string;
  priority?: number; // Higher values are evaluated first, defaults to 0
}

/**
 * A function that determines if a transition should occur based on the current state and context.
 *
 * @template TContext - The type of context object used in the condition function.
 */
export type AutoTransition<TContext = unknown> = (state: State, context: TContext) => boolean | Promise<boolean>;
