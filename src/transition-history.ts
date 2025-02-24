import { State } from "./state";

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
}

/**
 * Manages a history of state transitions.
 * Provides methods to record, query, and clear transition history.
 */
export class TransitionHistory {
  /** Array of transition history entries */
  private history: TransitionHistoryEntry[] = [];

  /** Configuration options */
  private options: Required<TransitionHistoryOptions>;

  /**
   * Creates a new TransitionHistory instance.
   *
   * @param options - Configuration options for the history
   */
  constructor(options: TransitionHistoryOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 100,
      includeContext: options.includeContext ?? true,
    };
  }

  /**
   * Adds a transition entry to the history.
   * If the history exceeds the maximum size, the oldest entry is removed.
   *
   * @param entry - The transition entry to add
   */
  add(entry: TransitionHistoryEntry): void {
    // Add the new entry to the beginning for chronological order (newest first)
    this.history.unshift(entry);

    // If we exceed the maximum size, remove the oldest entry
    if (this.history.length > this.options.maxSize) {
      this.history.pop();
    }
  }

  /**
   * Records a transition between states.
   *
   * @param fromState - The source state
   * @param toState - The target state name
   * @param context - The context data at the time of transition
   * @param success - Whether the transition was successful
   */
  recordTransition(fromState: State | null, toState: string, context: unknown, success: boolean): void {
    const entry: TransitionHistoryEntry = {
      from: fromState ? fromState.name : "null",
      to: toState,
      timestamp: Date.now(),
      context: this.options.includeContext ? context : undefined,
      success,
    };

    this.add(entry);
  }

  /**
   * Gets the most recent transition.
   *
   * @returns The most recent transition entry, or null if history is empty
   */
  getLastTransition(): TransitionHistoryEntry | null {
    return this.history.length > 0 ? this.history[0] : null;
  }

  /**
   * Gets all transitions involving a specific state (either as source or target).
   *
   * @param stateName - The name of the state to filter by
   * @returns An array of transition entries involving the specified state
   */
  getTransitionsForState(stateName: string): TransitionHistoryEntry[] {
    return this.history.filter((entry) => entry.from === stateName || entry.to === stateName);
  }

  /**
   * Clears all transition history.
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Gets all transition history entries.
   *
   * @returns An array of all transition history entries
   */
  getAll(): TransitionHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Converts the transition history to a JSON string.
   *
   * @returns A JSON string representation of the transition history
   */
  toJSON(): string {
    return JSON.stringify(this.history);
  }
}
