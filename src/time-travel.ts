import { FluentState } from "./fluent-state";
import { TransitionHistory } from "./transition-history";
import { ContextDiff, TimeSnapshot, TimelineOptions, TimeTravelOptions, TransitionHistoryEntry } from "./types";

/**
 * Manages time-travel debugging capabilities, allowing developers to navigate
 * through the history of state transitions and visually track state changes.
 */
export class TimeTravel {
  private fluentState: FluentState;
  private history: TransitionHistory;
  private snapshots: TimeSnapshot[] = [];
  private maxSnapshots: number;
  private currentSnapshotIndex: number | null = null;
  private trackContextChanges: boolean;
  private _isTimeTravelMode = false;
  private originalState: string | null = null;
  private originalContext: unknown = null;

  /**
   * Creates a new TimeTravel instance
   *
   * @param fluentState - The FluentState instance to manage time travel for
   * @param history - The transition history to use for time travel
   * @param options - Configuration options for time travel debugging
   */
  constructor(fluentState: FluentState, history: TransitionHistory, options?: TimeTravelOptions) {
    this.fluentState = fluentState;
    this.history = history;
    this.maxSnapshots = options?.maxSnapshots ?? 50;
    this.trackContextChanges = options?.trackContextChanges ?? true;
  }

  /**
   * Travel to a specific point in history by index
   *
   * @param index - The index in history to travel to (0 is most recent)
   * @returns The time snapshot at the specified index, or null if index is invalid
   */
  travelToIndex(index: number): TimeSnapshot | null {
    if (index < 0 || index >= this.history.size()) {
      return null;
    }

    const allTransitions = this.history.getHistory();
    const transition = allTransitions[index];

    if (!transition) {
      return null;
    }

    return this.createAndApplySnapshot(transition.to, transition.context, transition.timestamp, index);
  }

  /**
   * Travel to a specific point in history by timestamp
   *
   * @param timestamp - The timestamp to travel to
   * @returns The time snapshot at the specified timestamp, or null if not found
   */
  travelToTimestamp(timestamp: number): TimeSnapshot | null {
    const allTransitions = this.history.getHistory();

    // Find the closest transition to the given timestamp
    let closestIndex = -1;
    let closestDiff = Number.MAX_SAFE_INTEGER;

    allTransitions.forEach((transition, index) => {
      const diff = Math.abs(transition.timestamp - timestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = index;
      }
    });

    if (closestIndex === -1) {
      return null;
    }

    return this.travelToIndex(closestIndex);
  }

  /**
   * Travel to the next state in history
   *
   * @returns The next time snapshot, or null if at the end of history
   */
  next(): TimeSnapshot | null {
    if (this.currentSnapshotIndex === null) {
      return this.travelToIndex(0);
    }

    if (this.currentSnapshotIndex <= 0) {
      return null; // Already at the most recent state
    }

    return this.travelToIndex(this.currentSnapshotIndex - 1);
  }

  /**
   * Travel to the previous state in history
   *
   * @returns The previous time snapshot, or null if at the beginning of history
   */
  previous(): TimeSnapshot | null {
    if (this.currentSnapshotIndex === null) {
      return this.travelToIndex(0);
    }

    if (this.currentSnapshotIndex >= this.history.size() - 1) {
      return null; // Already at the oldest state
    }

    return this.travelToIndex(this.currentSnapshotIndex + 1);
  }

  /**
   * Return to the current (most recent) state
   *
   * @returns True if successfully returned to current state
   */
  returnToCurrent(): boolean {
    if (!this._isTimeTravelMode) {
      return true; // Already in current state
    }

    this._isTimeTravelMode = false;
    this.currentSnapshotIndex = null;

    // Restore the original state
    if (this.originalState !== null) {
      try {
        this.fluentState.setState(this.originalState);

        // Get the current state object
        const stateObj = this.fluentState.getCurrentState();
        if (stateObj && this.originalContext) {
          // Update the context
          stateObj.updateContext(this.originalContext);
        }

        return true;
      } catch (error) {
        console.error("Failed to return to current state:", error);
        return false;
      }
    }

    return false;
  }

  /**
   * Checks if currently in time travel mode
   *
   * @returns True if in time travel mode, false otherwise
   */
  isTimeTravelMode(): boolean {
    return this._isTimeTravelMode;
  }

  /**
   * Generate a visual timeline of state transitions
   *
   * @param options - Options for customizing the timeline visualization
   * @returns A string representation of the timeline in the specified format
   */
  generateTimeline(options: TimelineOptions = {}): string {
    const format = options.format || "mermaid";
    const maxTransitions = options.maxTransitions || 10;
    const allTransitions = this.history.getHistory().slice(0, maxTransitions);

    switch (format) {
      case "mermaid":
        return this.generateMermaidTimeline(allTransitions, options);
      case "dot":
        return this.generateDotTimeline(allTransitions, options);
      case "svg":
        return this.generateSvgTimeline(allTransitions, options);
      case "json":
        return JSON.stringify(allTransitions, null, 2);
      default:
        return this.generateMermaidTimeline(allTransitions, options);
    }
  }

  /**
   * Gets differences between two context objects
   *
   * @param from - Previous context object
   * @param to - Current context object
   * @param fromTimestamp - Timestamp of previous context
   * @param toTimestamp - Timestamp of current context
   * @returns An object describing the differences between contexts
   */
  getDiff(from: unknown, to: unknown, fromTimestamp: number, toTimestamp: number): ContextDiff {
    const diff: ContextDiff = {
      added: {},
      removed: {},
      changed: {},
      fromTimestamp,
      toTimestamp,
    };

    // Handle null or undefined input
    const fromObj = (from as Record<string, unknown>) || {};
    const toObj = (to as Record<string, unknown>) || {};

    // Check for added or changed properties
    for (const key in toObj) {
      if (!(key in fromObj)) {
        diff.added[key] = toObj[key];
      } else if (JSON.stringify(fromObj[key]) !== JSON.stringify(toObj[key])) {
        diff.changed[key] = {
          from: fromObj[key],
          to: toObj[key],
        };
      }
    }

    // Check for removed properties
    for (const key in fromObj) {
      if (!(key in toObj)) {
        diff.removed[key] = fromObj[key];
      }
    }

    return diff;
  }

  /**
   * Gets all time snapshots
   *
   * @returns Array of all time snapshots
   */
  getAllSnapshots(): TimeSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clears all time snapshots
   *
   * @returns The TimeTravel instance for chaining
   */
  clearSnapshots(): TimeTravel {
    this.snapshots = [];
    return this;
  }

  /**
   * Gets the current snapshot index
   *
   * @returns The current snapshot index or null if not in time travel mode
   */
  getCurrentSnapshotIndex(): number | null {
    return this.currentSnapshotIndex;
  }

  /**
   * Creates a snapshot without applying it
   *
   * @param state - The state name to create a snapshot for
   * @param context - The context data to include in the snapshot
   * @param timestamp - The timestamp for the snapshot
   * @param historyIndex - Optional index in transition history
   * @param description - Optional description of the snapshot
   * @returns The created snapshot
   */
  createSnapshot(state: string, context: unknown, timestamp: number = Date.now(), historyIndex?: number, description?: string): TimeSnapshot {
    const snapshot: TimeSnapshot = {
      state,
      context: JSON.parse(JSON.stringify(context)), // Deep copy
      timestamp,
      historyIndex,
      description,
    };

    // Add the snapshot to the list and maintain max size
    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.pop();
    }

    return snapshot;
  }

  /**
   * Applies a snapshot to temporarily revert to a previous state
   *
   * @param snapshot - The snapshot to apply
   * @returns True if successfully applied, false otherwise
   */
  applySnapshot(snapshot: TimeSnapshot): boolean {
    if (!snapshot) {
      return false;
    }

    try {
      // Save original state if this is the first time entering time travel mode
      if (!this._isTimeTravelMode) {
        const currentState = this.fluentState.getCurrentState();
        this.originalState = currentState?.name || null;
        this.originalContext = currentState ? currentState.getContext() : null;
        this._isTimeTravelMode = true;
      }

      // Set the state without triggering transitions
      this.fluentState.setState(snapshot.state);

      // Get the state object and update context
      const stateObj = this.fluentState.getCurrentState();
      if (stateObj && snapshot.context) {
        stateObj.updateContext(snapshot.context);
      }

      // Update current snapshot index
      if (snapshot.historyIndex !== undefined) {
        this.currentSnapshotIndex = snapshot.historyIndex;
      }

      return true;
    } catch (error) {
      console.error("Failed to apply snapshot:", error);
      return false;
    }
  }

  // Private methods

  /**
   * Creates and applies a snapshot in one operation
   *
   * @param state - The state name to create a snapshot for
   * @param context - The context data to include in the snapshot
   * @param timestamp - The timestamp for the snapshot
   * @param historyIndex - Optional index in transition history
   * @param description - Optional description of the snapshot
   * @returns The created and applied snapshot
   */
  private createAndApplySnapshot(
    state: string,
    context: unknown,
    timestamp: number = Date.now(),
    historyIndex?: number,
    description?: string,
  ): TimeSnapshot {
    const snapshot = this.createSnapshot(state, context, timestamp, historyIndex, description);
    this.applySnapshot(snapshot);
    return snapshot;
  }

  /**
   * Generates a Mermaid timeline visualization
   *
   * @param transitions - The transitions to visualize
   * @param options - Visualization options
   * @returns A Mermaid timeline diagram
   */
  private generateMermaidTimeline(transitions: TransitionHistoryEntry[], options: TimelineOptions): string {
    // Styles not used in this implementation, can be added in future enhancements
    // const styles = options.styles || {};

    let mermaid = "timeline\n";
    mermaid += "    title State Transition Timeline\n\n";

    transitions.forEach((transition, index) => {
      const date = new Date(transition.timestamp);
      const time = date.toLocaleTimeString();
      const success = transition.success ? "✅" : "❌";
      const currentMarker = this.currentSnapshotIndex === index ? " 👉 Current" : "";

      mermaid += `    section ${time}${currentMarker}\n`;
      mermaid += `        ${transition.from || "Initial"} → ${transition.to} : ${success}\n`;

      if (options.includeContext && transition.context) {
        const contextStr = JSON.stringify(transition.context).substring(0, 50);
        mermaid += `        Context: ${contextStr}${contextStr.length >= 50 ? "..." : ""}\n`;
      }
    });

    return mermaid;
  }

  /**
   * Generates a DOT timeline visualization
   *
   * @param transitions - The transitions to visualize
   * @param options - Visualization options
   * @returns A DOT timeline diagram
   */
  private generateDotTimeline(transitions: TransitionHistoryEntry[], options: TimelineOptions): string {
    const styles = options.styles || {};

    let dot = "digraph Timeline {\n";
    dot += "  rankdir=TB;\n";
    dot += "  node [shape=box, style=rounded];\n";
    dot += "  edge [arrowhead=vee];\n\n";

    // Timeline track
    dot += "  // Timeline track\n";
    dot += "  node [shape=circle, width=0.3, height=0.3, fixedsize=true];\n";

    transitions.forEach((transition, index) => {
      const time = new Date(transition.timestamp).toLocaleTimeString();
      const nodeId = `t${index}`;
      const label = transition.success ? "✓" : "✗";
      const nodeColor = transition.success
        ? styles.successfulTransition || 'fillcolor="#afa", style="filled,rounded"'
        : styles.failedTransition || 'fillcolor="#faa", style="filled,rounded"';

      // Timeline points
      dot += `  ${nodeId} [label="${label}", ${nodeColor}];\n`;

      // Connect timeline points
      if (index > 0) {
        dot += `  t${index - 1} -> ${nodeId} [style=dashed];\n`;
      }

      // Highlight current state
      const isCurrentSnapshot = this.currentSnapshotIndex === index;
      const stateStyle = isCurrentSnapshot ? styles.currentState || 'fillcolor="#ffb", style="filled,rounded"' : "style=rounded";

      // State transition nodes
      dot += `  ${nodeId}_state [label="${transition.from || "Initial"} → ${transition.to}\\n${time}", ${stateStyle}];\n`;

      // Connect timeline to state
      dot += `  ${nodeId} -> ${nodeId}_state;\n`;

      // Add context if requested
      if (options.includeContext && transition.context) {
        const contextStr = JSON.stringify(transition.context).substring(0, 50);
        dot += `  ${nodeId}_context [label="Context: ${contextStr}${contextStr.length >= 50 ? "..." : ""}", shape=note];\n`;
        dot += `  ${nodeId}_state -> ${nodeId}_context [style=dotted];\n`;
      }
    });

    dot += "}\n";
    return dot;
  }

  /**
   * Generates an SVG timeline visualization
   *
   * @param transitions - The transitions to visualize
   * @param options - Visualization options
   * @returns Instructions for generating an SVG timeline
   */
  private generateSvgTimeline(transitions: TransitionHistoryEntry[], options: TimelineOptions): string {
    // Generate DOT and wrap with SVG instructions
    const dot = this.generateDotTimeline(transitions, options);

    return `/*
  SVG Timeline Generation Note:
  To render this timeline as SVG, you need to use Graphviz:

  1. Save the following DOT graph definition to a file (e.g., timeline.dot)
  2. Use the dot command to generate SVG:
     dot -Tsvg timeline.dot -o timeline.svg
*/

${dot}`;
  }
}
