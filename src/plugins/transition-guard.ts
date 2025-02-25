import { FluentState } from "../fluent-state";
import { FluentStatePlugin, Lifecycle } from "../types";
import { State } from "../state";

export type TransitionMiddlewareHandler = (currentState: State | null, nextStateName: string, proceed: () => void) => void | Promise<void>;

/**
 * Creates a transition guard plugin that allows intercepting and controlling state transitions.
 * The guard can perform synchronous or asynchronous operations before deciding to proceed.
 *
 * @example
 * ```typescript
 * // Synchronous guard
 * fluentState.use(createTransitionGuard((prev, next, proceed) => {
 *   if (next === 'mainApp' && !userHasAccess()) {
 *     return; // Block transition
 *   }
 *   proceed(); // Allow transition
 * }));
 *
 * // Asynchronous guard
 * fluentState.use(createTransitionGuard(async (prev, next, proceed) => {
 *   const hasAccess = await checkUserPermissions();
 *   if (hasAccess) {
 *     proceed();
 *   }
 * }));
 * ```
 *
 * @param handler - A function that receives the current state, the next state name, and a proceed function.
 *                 The handler can be async and must call proceed() to allow the transition to continue.
 * @returns A FluentStatePlugin that can be used with the FluentState instance.
 */
export function createTransitionGuard(handler: TransitionMiddlewareHandler): FluentStatePlugin {
  return (fluentState: FluentState) => {
    fluentState.observe(Lifecycle.BeforeTransition, async (currentState, nextStateName) => {
      let proceeded = false;

      try {
        await handler(currentState, nextStateName, () => {
          proceeded = true;
        });
      } catch (error) {
        console.error("Error in transition guard", error);
      }

      return proceeded;
    });
  };
}
