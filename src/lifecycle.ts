import { Lifecycle } from "./enums";
import { State } from "./state";
import { BeforeTransitionHandler, FailedTransitionHandler, AfterTransitionHandler, LifeCycleHandler } from "./types";

/**
 * Interface for executing lifecycle event handlers.
 * This interface defines the method for executing lifecycle event handlers.
 */
interface LifecycleHandlerExecutor {
  execute(handler: LifeCycleHandler, prevState: State, currentState: State | string): Promise<boolean>;
}

/**
 * Executes before transition handlers.
 * This class implements the LifecycleHandlerExecutor interface and provides the logic for executing before transition handlers.
 */
class BeforeTransitionExecutor implements LifecycleHandlerExecutor {
  async execute(handler: BeforeTransitionHandler, prevState: State, currentState: string): Promise<boolean> {
    return await handler(prevState, currentState);
  }
}

/**
 * Executes failed transition handlers.
 * This class implements the LifecycleHandlerExecutor interface and provides the logic for executing failed transition handlers.
 */
class FailedTransitionExecutor implements LifecycleHandlerExecutor {
  async execute(handler: FailedTransitionHandler, prevState: State, currentState: string): Promise<boolean> {
    await handler(prevState, currentState);
    return true;
  }
}

/**
 * Executes after transition handlers.
 * This class implements the LifecycleHandlerExecutor interface and provides the logic for executing after transition handlers.
 */
class AfterTransitionExecutor implements LifecycleHandlerExecutor {
  async execute(handler: AfterTransitionHandler, prevState: State, currentState: State): Promise<boolean> {
    await handler(prevState, currentState);
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
