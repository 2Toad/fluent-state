import { State } from "./state";
import { FluentState } from "./fluent-state";

/**
 * Enumeration of lifecycle events that can be observed in the state machine.
 * These events are used to trigger custom logic at different stages of the state transition process.
 */
export enum Lifecycle {
  BeforeTransition,
  FailedTransition,
  AfterTransition,
}

/**
 * Configuration options for the FluentState instance.
 */
export interface FluentStateOptions {
  /** Initial state name */
  initialState?: string;
  /** Whether to enable transition history tracking */
  enableHistory?: boolean;
  /** Configuration options for the transition history */
  historyOptions?: TransitionHistoryOptions;
  /** Configuration options for the state manager */
  stateManagerConfig?: StateManagerConfig<unknown>;
}

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
  debounce?: number; // Delay evaluation by specified milliseconds
  retryConfig?: {
    // Retry failed transitions
    maxAttempts: number;
    delay: number;
  };
  groupName?: string; // The name of the group this transition belongs to
}

/**
 * A function that determines if a transition should occur based on the current state and context.
 *
 * @template TContext - The type of context object used in the condition function.
 */
export type AutoTransition<TContext = unknown> = (state: State, context: TContext) => boolean | Promise<boolean>;

/**
 * Represents a single transition entry in the history.
 */
export interface TransitionHistoryEntry {
  /** The source state name */
  from: string;
  /** The target state name */
  to: string;
  /** Timestamp when the transition occurred */
  timestamp: number;
  /** Context data at the time of transition */
  context: unknown;
  /** Whether the transition was successful */
  success: boolean;
}

/**
 * Configuration options for the transition history.
 */
export interface TransitionHistoryOptions {
  /** Maximum number of entries to keep in history (default: 100) */
  maxSize?: number;
  /** Whether to include context data in history entries (default: true) */
  includeContext?: boolean;
  /**
   * Optional function to filter sensitive data from context during serialization.
   * This function should return a sanitized version of the context.
   */
  contextFilter?: (context: unknown) => unknown;
}

/**
 * Options for serializing transition history to JSON.
 */
export interface SerializationOptions {
  /**
   * Function to filter sensitive data from context during serialization.
   * This overrides the contextFilter set in TransitionHistoryOptions.
   */
  contextFilter?: (context: unknown) => unknown;
  /**
   * Whether to include context data in the serialized output.
   * This overrides the includeContext setting in TransitionHistoryOptions.
   */
  includeContext?: boolean;
}

/**
 * Listener function for state changes.
 *
 * @template T - The type of the state object.
 */
export interface StateListener<T> {
  (state: T): void;
}

/**
 * Configuration options for optimizing state manager performance.
 *
 * @template T - The type of the state object.
 */
export interface StateManagerConfig<T> {
  /** Whether to batch multiple rapid state updates */
  batchUpdates?: boolean;
  /** Time window in milliseconds for batching updates */
  batchTimeWindow?: number;
  /** Whether to memoize computed values from state */
  enableMemoization?: boolean;
  /** Custom equality function for state updates */
  areEqual?: (prev: T, next: T) => boolean;
  /** Performance metrics collection configuration */
  metrics?: {
    /** Whether to enable metrics collection */
    enabled: boolean;
    /** Whether to track update frequency and timing */
    measureUpdates?: boolean;
    /** Whether to track memory usage of state */
    measureMemory?: boolean;
    /** Whether to track computation time of state derivations */
    measureComputations?: boolean;
    /** Callback for metrics reporting */
    onMetrics?: (metrics: StateManagerMetrics) => void;
  };
}

/**
 * Performance metrics collected by the state manager.
 */
export interface StateManagerMetrics {
  /** Average time between updates in milliseconds */
  updateFrequency: number;
  /** Time spent processing updates in milliseconds */
  updateDuration: number;
  /** Number of updates in the current time window */
  updateCount: number;
  /** Memory usage statistics */
  memoryUsage?: {
    /** Approximate size of the state in bytes */
    stateSize: number;
    /** Approximate size of memoized values in bytes */
    memoizedSize: number;
  };
  /** Computation timing in milliseconds */
  computationDuration?: {
    /** Time spent in equality checks */
    equality: number;
    /** Time spent in memoization */
    memoization: number;
    /** Time spent in derivations */
    derivations: number;
  };
}

/**
 * Interface for managing state transitions and listeners.
 *
 * @template T - The type of the state object.
 */
export interface IStateManager<T> {
  getState(): T;
  setState(update: Partial<T>): void;
  subscribe(listener: StateListener<T>): () => void;
  derive?<R>(key: string, deriveFn: (state: T) => R, dependencies?: string[]): R;
}

/**
 * Serialized representation of a transition group.
 */
export interface SerializedTransitionGroup {
  name: string;
  namespace?: string;
  enabled: boolean;
  config: {
    priority?: number;
    debounce?: number;
    retryConfig?: {
      maxAttempts: number;
      delay: number;
    };
  };
  transitions: Array<{
    from: string;
    to: string;
    config?: Omit<AutoTransitionConfig, "condition">; // Condition functions cannot be serialized
    tags?: string[]; // Optional tags for categorizing transitions
  }>;
  parentGroup?: string; // Name of the parent group for configuration inheritance
}
