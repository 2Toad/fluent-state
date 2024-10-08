import { Lifecycle } from "./enums";
import { State } from "./state";
import { BeforeTransitionHandler, FailedTransitionHandler, AfterTransitionHandler, LifeCycleHandler } from "./types";

interface LifecycleHandlerExecutor {
  execute(handler: LifeCycleHandler, prevState: State, currentState: State | string): boolean;
}

class BeforeTransitionExecutor implements LifecycleHandlerExecutor {
  execute(handler: BeforeTransitionHandler, prevState: State, currentState: string): boolean {
    return handler(prevState, currentState);
  }
}

class FailedTransitionExecutor implements LifecycleHandlerExecutor {
  execute(handler: FailedTransitionHandler, prevState: State, currentState: string): boolean {
    handler(prevState, currentState);
    return true;
  }
}

class AfterTransitionExecutor implements LifecycleHandlerExecutor {
  execute(handler: AfterTransitionHandler, prevState: State, currentState: State): boolean {
    handler(prevState, currentState);
    return true;
  }
}

export class LifecycleHandlerFactory {
  static createExecutor(event: Lifecycle): LifecycleHandlerExecutor {
    switch (event) {
      case Lifecycle.BeforeTransition:
        return new BeforeTransitionExecutor();
      case Lifecycle.FailedTransition:
        return new FailedTransitionExecutor();
      case Lifecycle.AfterTransition:
        return new AfterTransitionExecutor();
      default:
        throw new Error(`Lifecycle Factory Error: Unknown lifecycle: ${event}`);
    }
  }
}
