import { State } from "./state";
import { TransitionHistoryOptions, TransitionHistoryEntry } from "./types";

/**
 * Manages the history of state transitions
 */
export class TransitionHistory {
  private history: TransitionHistoryEntry[] = [];
  private maxSize: number;
  private includeContext: boolean;
  private contextFilter?: (context: unknown) => unknown;

  /**
   * Creates a new TransitionHistory instance
   *
   * @param options - Configuration options for history tracking
   */
  constructor(options?: TransitionHistoryOptions) {
    this.maxSize = options?.maxSize ?? 100;
    this.includeContext = options?.includeContext ?? true;
    this.contextFilter = options?.contextFilter;
  }

  /**
   * Records a state transition in the history
   *
   * @param fromState - The state being transitioned from
   * @param toState - The name of the state being transitioned to
   * @param context - Optional context data at the time of transition
   * @param success - Whether the transition was successful
   * @param group - Optional group name the transition belongs to
   * @param metadata - Optional additional metadata for the transition
   * @returns The TransitionHistory instance for chaining
   */
  recordTransition(
    fromState: State | null,
    toState: string,
    context?: unknown,
    success: boolean = true,
    group?: string,
    metadata?: Record<string, unknown>,
  ): TransitionHistory {
    const entry: TransitionHistoryEntry = {
      from: fromState ? fromState.name : null,
      to: toState,
      timestamp: Date.now(),
      success,
      group,
      metadata,
    };

    // Include context data if configured to do so
    if (this.includeContext && context !== undefined) {
      entry.context = this.contextFilter ? this.contextFilter(context) : context;
    }

    this.history.unshift(entry);

    // Trim history if it exceeds maximum size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(0, this.maxSize);
    }

    return this;
  }

  /**
   * Gets the complete transition history
   *
   * @returns Array of transition history entries
   */
  getHistory(): TransitionHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Gets the last transition that occurred
   *
   * @returns The most recent transition or null if history is empty
   */
  getLastTransition(): TransitionHistoryEntry | null {
    return this.history.length > 0 ? this.history[0] : null;
  }

  /**
   * Gets all transitions for a specific state (either as source or target)
   *
   * @param stateName - The name of the state to find transitions for
   * @param asSource - When true, find transitions where this state is the source
   * @param asTarget - When true, find transitions where this state is the target
   * @returns Array of matching transition history entries
   */
  getTransitionsForState(
    stateName: string,
    options: { asSource?: boolean; asTarget?: boolean } = { asSource: true, asTarget: true },
  ): TransitionHistoryEntry[] {
    const { asSource = true, asTarget = true } = options;

    return this.history.filter((entry) => (asSource && entry.from === stateName) || (asTarget && entry.to === stateName));
  }

  /**
   * Gets all transitions belonging to a specific group
   *
   * @param groupName - The name of the group to find transitions for
   * @returns Array of matching transition history entries
   */
  getTransitionsForGroup(groupName: string): TransitionHistoryEntry[] {
    return this.history.filter((entry) => entry.group === groupName);
  }

  /**
   * Gets all successful transitions
   *
   * @returns Array of successful transition history entries
   */
  getSuccessfulTransitions(): TransitionHistoryEntry[] {
    return this.history.filter((entry) => entry.success);
  }

  /**
   * Gets all failed transitions
   *
   * @returns Array of failed transition history entries
   */
  getFailedTransitions(): TransitionHistoryEntry[] {
    return this.history.filter((entry) => !entry.success);
  }

  /**
   * Gets transitions that occurred within a specific time range
   *
   * @param startTime - Start timestamp (inclusive)
   * @param endTime - End timestamp (inclusive)
   * @returns Array of matching transition history entries
   */
  getTransitionsInTimeRange(startTime: number, endTime: number): TransitionHistoryEntry[] {
    return this.history.filter((entry) => entry.timestamp >= startTime && entry.timestamp <= endTime);
  }

  /**
   * Gets transitions matching a specific path (sequence of states)
   *
   * @param path - Array of state names representing the path to match
   * @returns Whether the path exists in the history
   */
  hasPath(path: string[]): boolean {
    if (path.length < 2 || this.history.length < path.length - 1) {
      return false;
    }

    // Look for the path in reverse chronological order (newest first)
    const reversePath = [...path].reverse();

    for (let i = 0; i <= this.history.length - (path.length - 1); i++) {
      let matchesPath = true;

      for (let j = 0; j < path.length - 1; j++) {
        const entry = this.history[i + j];
        if (entry.to !== reversePath[j] || (j < path.length - 2 && this.history[i + j + 1].to !== reversePath[j + 1])) {
          matchesPath = false;
          break;
        }
      }

      if (matchesPath) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets all transitions matching a filter function
   *
   * @param filterFn - Function to filter transitions
   * @returns Array of matching transition history entries
   */
  filter(filterFn: (entry: TransitionHistoryEntry) => boolean): TransitionHistoryEntry[] {
    return this.history.filter(filterFn);
  }

  /**
   * Gets all transitions with context data matching a filter function
   *
   * @param filterFn - Function to filter transitions by context
   * @returns Array of matching transition history entries
   */
  filterByContext(filterFn: (context: unknown) => boolean): TransitionHistoryEntry[] {
    return this.history.filter((entry) => entry.context !== undefined && filterFn(entry.context));
  }

  /**
   * Gets all transitions with metadata matching a filter function
   *
   * @param filterFn - Function to filter transitions by metadata
   * @returns Array of matching transition history entries
   */
  filterByMetadata(filterFn: (metadata: Record<string, unknown>) => boolean): TransitionHistoryEntry[] {
    return this.history.filter((entry) => entry.metadata !== undefined && filterFn(entry.metadata));
  }

  /**
   * Sets the maximum size of the history
   *
   * @param size - Maximum number of entries to keep
   * @returns The TransitionHistory instance for chaining
   */
  setMaxSize(size: number): TransitionHistory {
    this.maxSize = size;

    // Trim history if it exceeds the new maximum size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(0, this.maxSize);
    }

    return this;
  }

  /**
   * Configures whether to include context data in transition records
   *
   * @param include - Whether to include context data
   * @returns The TransitionHistory instance for chaining
   */
  includeContextData(include: boolean): TransitionHistory {
    this.includeContext = include;
    return this;
  }

  /**
   * Sets a filter function for context data
   *
   * @param filterFn - Function to filter sensitive data from context before storing
   * @returns The TransitionHistory instance for chaining
   */
  setContextFilter(filterFn: (context: unknown) => unknown): TransitionHistory {
    this.contextFilter = filterFn;
    return this;
  }

  /**
   * Clears all transition history
   *
   * @returns The TransitionHistory instance for chaining
   */
  clear(): TransitionHistory {
    this.history = [];
    return this;
  }

  /**
   * Exports the transition history to JSON
   *
   * @param options - Export options
   * @returns JSON string representation of the history
   */
  exportToJSON(options?: {
    indent?: number;
    includeContext?: boolean;
    includeMetadata?: boolean;
    filter?: (entry: TransitionHistoryEntry) => boolean;
  }): string {
    let exportData = this.history;

    // Apply filter if provided
    if (options?.filter) {
      exportData = exportData.filter(options.filter);
    }

    // Prepare data for export, possibly excluding context or metadata
    const preparedData = exportData.map((entry) => {
      const prepared: Partial<TransitionHistoryEntry> = {
        from: entry.from,
        to: entry.to,
        timestamp: entry.timestamp,
        success: entry.success,
      };

      if (entry.group) {
        prepared.group = entry.group;
      }

      if (options?.includeContext !== false && entry.context !== undefined) {
        prepared.context = entry.context;
      }

      if (options?.includeMetadata !== false && entry.metadata !== undefined) {
        prepared.metadata = entry.metadata;
      }

      return prepared;
    });

    return JSON.stringify(preparedData, null, options?.indent);
  }

  /**
   * Imports transition history from JSON
   *
   * @param json - JSON string representation of the history
   * @param options - Import options
   * @returns The TransitionHistory instance for chaining
   */
  importFromJSON(
    json: string,
    options?: {
      append?: boolean;
      validateEntries?: boolean;
    },
  ): TransitionHistory {
    try {
      const data = JSON.parse(json) as TransitionHistoryEntry[];

      // Validate entries if requested
      if (options?.validateEntries) {
        for (const entry of data) {
          if (
            typeof entry.to !== "string" ||
            (entry.from !== null && typeof entry.from !== "string") ||
            typeof entry.timestamp !== "number" ||
            typeof entry.success !== "boolean"
          ) {
            throw new Error("Invalid transition history entry format");
          }
        }
      }

      // Either append to or replace the existing history
      if (options?.append) {
        this.history = [...this.history, ...data];

        // Trim if necessary after appending
        if (this.history.length > this.maxSize) {
          this.history = this.history.slice(0, this.maxSize);
        }
      } else {
        this.history = data.slice(0, this.maxSize);
      }
    } catch (error) {
      throw new Error(`Failed to import history: ${error.message}`);
    }

    return this;
  }

  /**
   * Gets the number of transitions in the history
   *
   * @returns The number of transition records
   */
  size(): number {
    return this.history.length;
  }

  /**
   * Checks if the history is empty
   *
   * @returns True if the history contains no transitions
   */
  isEmpty(): boolean {
    return this.history.length === 0;
  }

  /**
   * Gets the states that occur most frequently in the history
   *
   * @param asTarget - Whether to count states as transition targets (default: true)
   * @param limit - Maximum number of results to return (default: 5)
   * @returns Array of [stateName, count] pairs, sorted by frequency
   */
  getMostFrequentStates(asTarget: boolean = true, limit: number = 5): [string, number][] {
    const stateCounts = new Map<string, number>();

    this.history.forEach((entry) => {
      const state = asTarget ? entry.to : entry.from || "";
      if (!state) return;

      stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
    });

    return Array.from(stateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Gets the most common transitions in the history
   *
   * @param limit - Maximum number of results to return (default: 5)
   * @returns Array of [{from, to}, count] pairs, sorted by frequency
   */
  getMostFrequentTransitions(limit: number = 5): [{ from: string | null; to: string }, number][] {
    const transitionCounts = new Map<string, number>();

    this.history.forEach((entry) => {
      const key = `${entry.from}=>${entry.to}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    });

    return Array.from(transitionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => {
        const [from, to] = key.split("=>");
        return [{ from: from === "null" ? null : from, to }, count];
      });
  }
}
