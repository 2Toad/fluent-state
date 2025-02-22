import { Lifecycle } from "./enums";
import { State } from "./state";
import { LifeCycleHandler } from "./types";
import { LifecycleHandlerFactory } from "./lifecycle";

/**
 * Manages the registration and execution of lifecycle event handlers.
 * This class is responsible for storing and triggering event handlers for different lifecycle events.
 */
export class Observer {
  observers: Map<Lifecycle, LifeCycleHandler[]> = new Map();

  /**
   * Adds an event handler for a specific lifecycle event.
   *
   * @param event - The lifecycle event to observe.
   * @param handler - The handler function to execute when the event occurs.
   */
  add(event: Lifecycle, handler: LifeCycleHandler): void {
    const handlers = this.getEvent(event) || [];
    handlers.push(handler);
    this.observers.set(event, handlers);
  }

  /**
   * Triggers the execution of event handlers for a specific lifecycle event.
   *
   * @param event - The lifecycle event to trigger.
   * @param prevState - The previous state of the state machine.
   * @param currentState - The current state of the state machine.
   * @returns An array of boolean values indicating the success or failure of each handler.
   */
  async trigger(event: Lifecycle, prevState: State, currentState: State | string): Promise<boolean[]> {
    const handlers = this.getEvent(event);
    if (!handlers) {
      return [];
    }

    const executor = LifecycleHandlerFactory.createExecutor(event);
    const results = await Promise.all(handlers.map((handler) => executor.execute(handler, prevState, currentState)));
    return results;
  }

  /**
   * Removes an event handler for a specific lifecycle event.
   *
   * @param event - The lifecycle event to remove the handler from.
   * @param handler - The handler function to remove.
   */
  remove(event: Lifecycle, handler: LifeCycleHandler): void {
    const handlers = this.getEvent(event);
    if (handlers) {
      this.observers.set(
        event,
        handlers.filter((h) => h !== handler),
      );
    }
  }

  /**
   * Retrieves the event handlers for a specific lifecycle event.
   *
   * @param name - The name of the lifecycle event to retrieve handlers for.
   * @returns An array of event handlers for the specified lifecycle event, or undefined if no handlers exist.
   */
  private getEvent(name: Lifecycle): LifeCycleHandler[] | undefined {
    return this.observers.get(name);
  }
}
