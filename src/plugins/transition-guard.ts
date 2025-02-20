import { FluentState } from "../fluent-state";
import { Lifecycle } from "../enums";
import { FluentStatePlugin } from "../types";
import { State } from "../state";

export type TransitionMiddlewareHandler = (currentState: State | null, nextStateName: string, proceed: () => void) => void;

/**
 * Creates a transition guard plugin that allows intercepting and controlling state transitions.
 *
 * @example
 * ```typescript
 * // Create and use the plugin
 * fluentState.use(createTransitionGuard((prev, next, proceed) => {
 *   console.log(`Checking transition: ${prev?.name} → ${next}`);
 *   if (next === 'mainApp' && !userHasAccess()) {
 *     console.log("Access Denied!");
 *     return;
 *   }
 *   proceed();
 * }));
 * ```
 *
 * @param handler - A function that receives the current state, the next state name, and a proceed function.
 *                  The proceed function must be called to allow the transition to continue.
 * @returns A FluentStatePlugin that can be used with the FluentState instance.
 */
export function createTransitionGuard(handler: TransitionMiddlewareHandler): FluentStatePlugin {
  return (fluentState: FluentState) => {
    fluentState.observe(Lifecycle.BeforeTransition, (currentState, nextStateName) => {
      let proceeded = false;

      try {
        handler(currentState, nextStateName, () => {
          proceeded = true;
        });
      } catch (error) {
        console.error("Error in transition guard:", error);
      }

      return proceeded;
    });
  };
}
