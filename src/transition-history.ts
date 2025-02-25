import { State } from "./state";
import { TransitionHistoryEntry, TransitionHistoryOptions, SerializationOptions } from "./types";

/**
 * Manages a history of state transitions.
 * Provides methods to record, query, and clear transition history.
 */
export class TransitionHistory {
  /** Array of transition history entries */
  private history: TransitionHistoryEntry[] = [];

  /** Configuration options */
  private options: Required<TransitionHistoryOptions & { contextFilter: ((context: unknown) => unknown) | null }>;

  /**
   * Creates a new TransitionHistory instance.
   *
   * @param options - Configuration options for the history
   */
  constructor(options: TransitionHistoryOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 100,
      includeContext: options.includeContext ?? true,
      contextFilter: options.contextFilter ?? null,
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
   * Optionally filters sensitive context data during serialization.
   *
   * @param options - Options for serialization
   * @returns A JSON string representation of the transition history
   */
  toJSON(options: SerializationOptions = {}): string {
    // Determine whether to include context
    const includeContext = options.includeContext !== undefined ? options.includeContext : this.options.includeContext;

    // Determine which context filter to use
    const contextFilter = options.contextFilter || this.options.contextFilter;

    // Create a copy of the history for serialization
    const serializedHistory = this.history.map((entry) => {
      const serializedEntry = { ...entry };

      // Handle context based on includeContext setting
      if (!includeContext) {
        serializedEntry.context = undefined;
      }
      // Apply context filter if available and context exists
      else if (contextFilter && serializedEntry.context !== undefined) {
        serializedEntry.context = contextFilter(serializedEntry.context);
      }

      return serializedEntry;
    });

    return JSON.stringify(serializedHistory);
  }

  /**
   * Creates a TransitionHistory instance from a JSON string.
   *
   * @param json - JSON string representation of transition history
   * @param options - Configuration options for the new TransitionHistory instance
   * @returns A new TransitionHistory instance with the imported history
   */
  static fromJSON(json: string, options: TransitionHistoryOptions = {}): TransitionHistory {
    try {
      const parsedHistory = JSON.parse(json) as TransitionHistoryEntry[];

      // Create a new TransitionHistory instance with the provided options
      const history = new TransitionHistory(options);

      // Add each entry to the history in reverse order to maintain chronology
      // (since add() adds to the beginning)
      for (let i = parsedHistory.length - 1; i >= 0; i--) {
        // eslint-disable-next-line security/detect-object-injection -- index is safely generated and parsedHistory array is internal
        history.add(parsedHistory[i]);
      }

      return history;
    } catch (error) {
      console.error("Failed to parse transition history JSON:", error);
      // Return an empty history instance if parsing fails
      return new TransitionHistory(options);
    }
  }
}
