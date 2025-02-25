/**
 * Enumeration of lifecycle events that can be observed in the state machine.
 * These events are used to trigger custom logic at different stages of the state transition process.
 */
export enum Lifecycle {
  BeforeTransition,
  FailedTransition,
  AfterTransition,
}
