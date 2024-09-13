import { Lifecycle } from "./enums";
import { State } from "./state";
import { LifeCycleHandler } from "./types";
import { LifecycleHandlerFactory } from "./lifecycle";

export class Observer {
  observers: Map<Lifecycle, LifeCycleHandler[]> = new Map();

  add(event: Lifecycle, handler: LifeCycleHandler): void {
    const handlers = this.getEvent(event) || [];
    handlers.push(handler);
    this.observers.set(event, handlers);
  }

  trigger(event: Lifecycle, prevState: State, currentState: State | string): boolean[] {
    const handlers = this.getEvent(event);
    if (!handlers) {
      return [];
    }

    const executor = LifecycleHandlerFactory.createExecutor(event);
    return handlers.map((handler) => executor.execute(handler, prevState, currentState));
  }

  private getEvent(name: Lifecycle): LifeCycleHandler[] | undefined {
    return this.observers.get(name);
  }
}
