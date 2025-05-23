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
  /** Configuration options for debugging */
  debug?: DebugConfig;
}

/**
 * Log levels for the debugging system
 */
export type LogLevel = "none" | "error" | "warn" | "info" | "debug";

/**
 * Configuration for graph visualization options
 */
export interface GraphConfig {
  /**
   * Output format for the generated graph
   */
  format: "mermaid" | "dot" | "svg";

  /**
   * Visualization options
   */
  options?: {
    /**
     * Whether to show transition conditions in the graph
     */
    showConditions?: boolean;

    /**
     * Whether to group states by their transition groups
     */
    groupClusters?: boolean;

    /**
     * Whether to include state metadata in the graph
     */
    showMetadata?: boolean;

    /**
     * Whether to highlight the current state
     */
    highlightCurrent?: boolean;

    /**
     * Whether to show transition history
     */
    showHistory?: boolean;

    /**
     * Custom styles for graph elements
     */
    styles?: {
      /**
       * Styles for transition groups
       */
      groups?: Record<string, string>;

      /**
       * Styles for states
       */
      states?: Record<string, string>;

      /**
       * Styles for transitions
       */
      transitions?: Record<string, string>;
    };
  };
}

/**
 * Configuration for debugging and development tools
 */
export interface DebugConfig {
  /** Log level for the debug manager */
  logLevel?: LogLevel;

  /** Whether to measure and collect performance metrics */
  measurePerformance?: boolean;

  /** Custom log formatting function */
  logFormat?: (entry: LogEntry) => string;

  /** Custom log handlers to receive log entries */
  logHandlers?: ((entry: LogEntry) => void)[];

  /** Whether to keep transition history */
  keepHistory?: boolean;

  /** Maximum number of transition history entries to keep */
  historySize?: number;

  /** Whether to include context data in transition history */
  includeContextInHistory?: boolean;

  /** Filter function to remove sensitive data from context before storing in history */
  contextFilter?: (context: unknown) => unknown;

  /**
   * Configuration for exporting the state machine
   * Can be:
   * - A string specifying the format ('json', 'yaml', or 'js')
   * - true to enable with default settings
   * - A function to completely customize the export process
   */
  exportConfig?: "json" | "yaml" | "js" | boolean | (() => string);

  /**
   * Configuration for graph visualization
   */
  generateGraph?: GraphConfig;

  /** Configuration for time travel debugging */
  timeTravel?: TimeTravelOptions;

  /** Whether to automatically validate the state machine and warn about issues */
  autoValidate?: boolean;

  /** Only validate when state changes (not when states are added) */
  validateOnStateChangesOnly?: boolean;

  /** Configuration options for validation */
  validateOptions?: {
    /** Minimum severity level for warnings */
    severity?: "info" | "warn" | "error";
    /** Specific types of warnings to check for */
    types?: StateWarningType[];
  };
}

/**
 * Configuration options for debugging logs
 */
export interface LogConfig {
  /** Log level to use */
  logLevel?: LogLevel;
  /** Whether to measure and log performance metrics */
  measurePerformance?: boolean;
  /** Custom log format function */
  logFormat?: (entry: LogEntry) => string;
  /** Whether to automatically validate the state machine */
  autoValidate?: boolean;
  /** Only validate when state changes (not when states are added) */
  validateOnStateChangesOnly?: boolean;
  /** Configuration options for validation */
  validateOptions?: {
    /** Minimum severity level for warnings */
    severity?: "info" | "warn" | "error";
    /** Specific types of warnings to check for */
    types?: StateWarningType[];
  };
}

/**
 * Structure of a log entry
 */
export interface LogEntry {
  /** Timestamp when the log entry was created */
  timestamp: number;
  /** Log level of the entry */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Optional context data */
  context?: unknown;
}

/**
 * Structure of a performance metric
 */
export interface PerformanceMetric {
  /** Timestamp when the metric was recorded */
  timestamp: number;
  /** Category of the metric */
  category: "transitionEvaluation" | "conditionExecution" | "contextUpdate";
  /** Name of the specific operation */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Optional additional details */
  details?: Record<string, unknown>;
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
 * Configuration for controlling when and how auto-transitions are evaluated
 */
export interface AutoTransitionEvaluationConfig {
  /**
   * Only evaluate when these context properties change
   * Can use dot notation for deep properties (e.g., 'user.profile.name')
   * Can use array notation for indexed properties (e.g., 'items[0].status')
   */
  watchProperties?: string[];

  /**
   * Skip evaluation if these conditions are met
   * Function receives the full context object for decision making
   */
  skipIf?: (context: unknown) => boolean;

  /**
   * Custom evaluation timing strategy
   * - 'immediate': Evaluate transitions synchronously after context changes (default)
   * - 'nextTick': Defer evaluation to the next event loop tick
   * - 'idle': Use requestIdleCallback (or polyfill) to evaluate during idle periods
   */
  evaluationStrategy?: "immediate" | "nextTick" | "idle";
}

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
  /**
   * Configuration for controlling when this auto-transition is evaluated
   */
  evaluationConfig?: AutoTransitionEvaluationConfig;
}

/**
 * A function that determines if a transition should occur based on the current state and context.
 *
 * @template TContext - The type of context object used in the condition function.
 */
export type AutoTransition<TContext = unknown> = (state: State, context: TContext) => boolean | Promise<boolean>;

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
  preventManualTransitions?: boolean;
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
  childGroups?: string[]; // Names of child groups for hierarchical organization
}

/**
 * Snapshot of a transition group's state at a point in time.
 * Used for debugging and testing purposes.
 */
export interface TransitionGroupSnapshot {
  /** The name of the group */
  name: string;
  /** The namespace of the group, if any */
  namespace?: string;
  /** Optional label to identify this snapshot */
  label?: string;
  /** Whether the group was enabled at the time of the snapshot */
  enabled: boolean;
  /** Whether manual transitions were prevented at the time of the snapshot */
  preventManualTransitions: boolean;
  /** The group's configuration at the time of the snapshot */
  config: {
    priority?: number;
    debounce?: number;
    retryConfig?: {
      maxAttempts: number;
      delay: number;
    };
  };
  /** The transitions in the group at the time of the snapshot */
  transitions: Array<{
    from: string;
    to: string;
    tags?: string[];
  }>;
  /** The timestamp when the snapshot was created */
  timestamp: number;
  /** The parent group name, if any */
  parentGroup?: string;
  /** The child group names, if any */
  childGroups?: string[];
}

/**
 * Performance metrics for a transition group.
 * Used for monitoring and optimizing transition performance.
 */
export interface TransitionGroupMetrics {
  /** The name of the group */
  name: string;
  /** The namespace of the group, if any */
  namespace?: string;
  /** The total number of transitions attempted in this group */
  transitionAttempts: number;
  /** The number of successful transitions in this group */
  successfulTransitions: number;
  /** The number of failed transitions in this group */
  failedTransitions: number;
  /** Average time taken for transitions in milliseconds */
  averageTransitionTime: number;
  /** The most frequently used transition in this group */
  mostFrequentTransition?: {
    from: string;
    to: string;
    count: number;
  };
  /** Transition frequency by source-target pair */
  transitionFrequency: Record<string, Record<string, number>>;
  /** Timestamp when metrics collection started */
  collectionStartTime: number;
  /** Timestamp of the last update to these metrics */
  lastUpdated: number;
}

/**
 * Options for configuring the transition history
 */
export interface TransitionHistoryOptions {
  /** Maximum number of entries to keep in history */
  maxSize?: number;
  /** Whether to include context data in transition records */
  includeContext?: boolean;
  /** Function to filter sensitive data from context before storing */
  contextFilter?: (context: unknown) => unknown;
}

/**
 * A single transition history entry
 */
export interface TransitionHistoryEntry {
  /** The source state of the transition */
  from: string | null;
  /** The target state of the transition */
  to: string;
  /** Timestamp when the transition occurred */
  timestamp: number;
  /** Context data at the time of transition (if includeContext is true) */
  context?: unknown;
  /** Whether the transition was successful */
  success: boolean;
  /** Optional group name the transition belongs to */
  group?: string;
  /** Optional metadata for the transition */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration options for time travel debugging
 */
export interface TimeTravelOptions {
  /** Maximum number of snapshots to keep for time travel */
  maxSnapshots?: number;
  /** Whether to apply snapshots automatically when created */
  autoApply?: boolean;
  /** Whether to track context changes between snapshots */
  trackContextChanges?: boolean;
}

/**
 * Represents a snapshot of state at a specific point in time
 */
export interface TimeSnapshot {
  /** The state name at this point in time */
  state: string;
  /** The context data at this point in time */
  context: unknown;
  /** The timestamp when this snapshot was created */
  timestamp: number;
  /** Optional index in the transition history */
  historyIndex?: number;
  /** Optional description of this snapshot */
  description?: string;
  /** Metadata for this snapshot */
  metadata?: Record<string, unknown>;
}

/**
 * Options for generating timeline visualizations
 */
export interface TimelineOptions {
  /** Format for the generated timeline */
  format?: "mermaid" | "dot" | "svg" | "json";
  /** Whether to include context data in the timeline */
  includeContext?: boolean;
  /** Maximum number of transitions to include */
  maxTransitions?: number;
  /** Custom styling for the timeline visualization */
  styles?: {
    /** Style for the current state */
    currentState?: string;
    /** Style for successful transitions */
    successfulTransition?: string;
    /** Style for failed transitions */
    failedTransition?: string;
    /** Style for the timeline track */
    track?: string;
  };
}

/**
 * Difference between two context objects in a time snapshot
 */
export interface ContextDiff {
  /** Properties that were added in the newer context */
  added: Record<string, unknown>;
  /** Properties that were removed in the newer context */
  removed: Record<string, unknown>;
  /** Properties that were changed between contexts */
  changed: Record<
    string,
    {
      /** The value in the older context */
      from: unknown;
      /** The value in the newer context */
      to: unknown;
    }
  >;
  /** The older timestamp this diff compares from */
  fromTimestamp: number;
  /** The newer timestamp this diff compares to */
  toTimestamp: number;
}

/**
 * Warning types for state machine validation
 */
export type StateWarningType =
  | "unreachable-state" // State that cannot be reached from any other state
  | "conflicting-transition" // Transitions that might conflict with each other
  | "dead-end-state" // State with no outgoing transitions
  | "redundant-transition" // Multiple transitions between the same states
  | "circular-transition" // Transitions that form a circular path with no exit
  | "unused-group" // Transition group with no transitions
  | "incomplete-transition" // Transition missing source or target state
  | "overlapping-conditions"; // Multiple auto-transitions with potentially overlapping conditions

/**
 * Warning object for state machine validation
 */
export interface StateWarning {
  /** Type of the warning */
  type: StateWarningType;
  /** Description of the warning */
  description: string;
  /** Severity of the warning (info, warn, error) */
  severity: "info" | "warn" | "error";
  /** States involved in the warning */
  states?: string[];
  /** Transitions involved in the warning (from-to pairs) */
  transitions?: Array<{ from: string; to: string }>;
  /** Groups involved in the warning */
  groups?: string[];
  /** Additional metadata about the warning */
  metadata?: Record<string, unknown>;
}
