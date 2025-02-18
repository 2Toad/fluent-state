import { State } from "./state";

export type BeforeTransitionHandler = (currentState: State, nextState: string) => boolean;
export type FailedTransitionHandler = (currentState: State, targetState: string) => void;
export type AfterTransitionHandler = (previousState: State, currentState: State) => void;

export type LifeCycleHandler = BeforeTransitionHandler | FailedTransitionHandler | AfterTransitionHandler;

export type EventHandler = (previousState: State, currentState: State) => void;

export type EnterEventHandler = (previousState: State, currentState: State) => void;
export type ExitEventHandler = (currentState: State, nextState: State) => void;
