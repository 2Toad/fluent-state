import { FluentState } from "./fluent-state";
import { State } from "./state";
import { LogLevel, LogEntry, LogConfig, PerformanceMetric, TransitionHistoryEntry } from "./types";
import { TransitionHistory } from "./transition-history";

/**
 * Manages debugging capabilities for FluentState including logging, metrics, and visualization.
 */
export class DebugManager {
  private fluentState: FluentState;
  private logLevel: LogLevel = "none";
  private measurePerformance: boolean = false;
  private customLoggers: ((entry: LogEntry) => void)[] = [];
  private metricCollectors: ((metric: PerformanceMetric) => void)[] = [];
  private logFormat: (entry: LogEntry) => string = this.defaultLogFormat;
  private localHistory?: TransitionHistory;
  private historyEnabled: boolean = false;

  // Store performance metrics
  private metrics: {
    transitionEvaluation: Map<string, number[]>;
    conditionExecution: Map<string, number[]>;
    contextUpdate: Map<string, number[]>;
  } = {
    transitionEvaluation: new Map(),
    conditionExecution: new Map(),
    contextUpdate: new Map(),
  };

  constructor(fluentState: FluentState) {
    this.fluentState = fluentState;
  }

  /**
   * Configure debug logging settings
   *
   * @param config - The logging configuration
   * @returns The DebugManager instance for chaining
   */
  configureLogging(config: LogConfig): DebugManager {
    if (config.logLevel !== undefined) {
      this.logLevel = config.logLevel;
    }

    if (config.measurePerformance !== undefined) {
      this.measurePerformance = config.measurePerformance;
    }

    if (config.logFormat) {
      this.logFormat = config.logFormat;
    }

    return this;
  }

  /**
   * Enable or disable transition history tracking
   *
   * @param enable - Whether to enable history tracking
   * @param options - Optional configuration for the history tracker
   * @returns The DebugManager instance for chaining
   */
  enableHistoryTracking(
    enable: boolean = true,
    options?: {
      maxSize?: number;
      includeContext?: boolean;
      contextFilter?: (context: unknown) => unknown;
    },
  ): DebugManager {
    this.historyEnabled = enable;

    if (enable && !this.localHistory) {
      this.localHistory = new TransitionHistory(options);
      this.debug("Enabled local history tracking in DebugManager");
    }

    return this;
  }

  /**
   * Configure history tracking options
   *
   * @param options - Configuration options for history tracking
   * @returns The DebugManager instance for chaining
   */
  configureHistory(options: { maxSize?: number; includeContext?: boolean; contextFilter?: (context: unknown) => unknown }): DebugManager {
    if (!this.historyEnabled) {
      this.enableHistoryTracking(true, options);
      return this;
    }

    if (!this.localHistory) {
      this.localHistory = new TransitionHistory(options);
      return this;
    }

    if (options.maxSize !== undefined) {
      this.localHistory.setMaxSize(options.maxSize);
    }

    if (options.includeContext !== undefined) {
      this.localHistory.includeContextData(options.includeContext);
    }

    if (options.contextFilter) {
      this.localHistory.setContextFilter(options.contextFilter);
    }

    return this;
  }

  /**
   * Get access to the transition history
   *
   * @returns The TransitionHistory instance or undefined if history is disabled
   */
  getHistory(): TransitionHistory | undefined {
    // Try to use the FluentState's history if available,
    // otherwise fall back to the local history
    return this.fluentState.history || this.localHistory;
  }

  /**
   * Query transitions matching specific criteria
   *
   * @param options - Query options
   * @returns Array of matching transition history entries or empty array if history is disabled
   */
  queryTransitions(
    options: {
      state?: string;
      asSource?: boolean;
      asTarget?: boolean;
      group?: string;
      fromTimestamp?: number;
      toTimestamp?: number;
      successful?: boolean;
      metadataFilter?: (metadata: Record<string, unknown>) => boolean;
      contextFilter?: (context: unknown) => boolean;
      limit?: number;
    } = {},
  ): TransitionHistoryEntry[] {
    const history = this.getHistory();
    if (!history) return [];

    let results = history.getHistory();

    // Filter by state
    if (options.state) {
      results = history.getTransitionsForState(options.state, {
        asSource: options.asSource ?? true,
        asTarget: options.asTarget ?? true,
      });
    }

    // Filter by group
    if (options.group) {
      results = results.filter((entry) => entry.group === options.group);
    }

    // Filter by timestamp range
    if (options.fromTimestamp || options.toTimestamp) {
      results = results.filter(
        (entry) =>
          (options.fromTimestamp === undefined || entry.timestamp >= options.fromTimestamp) &&
          (options.toTimestamp === undefined || entry.timestamp <= options.toTimestamp),
      );
    }

    // Filter by success
    if (options.successful !== undefined) {
      results = results.filter((entry) => entry.success === options.successful);
    }

    // Filter by metadata
    if (options.metadataFilter) {
      results = results.filter((entry) => entry.metadata !== undefined && options.metadataFilter!(entry.metadata));
    }

    // Filter by context
    if (options.contextFilter) {
      results = results.filter((entry) => entry.context !== undefined && options.contextFilter!(entry.context));
    }

    // Apply limit if specified
    if (options.limit !== undefined && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Export transition history to JSON
   *
   * @param options - Export options
   * @returns JSON string representation of history or empty string if history is disabled
   */
  exportHistory(options?: {
    indent?: number;
    includeContext?: boolean;
    includeMetadata?: boolean;
    filter?: (entry: TransitionHistoryEntry) => boolean;
  }): string {
    const history = this.getHistory();
    if (!history) return "";

    return history.exportToJSON(options);
  }

  /**
   * Import transition history from JSON
   *
   * @param json - JSON string representation of history
   * @param options - Import options
   * @returns The DebugManager instance for chaining
   */
  importHistory(
    json: string,
    options?: {
      append?: boolean;
      validateEntries?: boolean;
    },
  ): DebugManager {
    const history = this.getHistory();

    if (!history) {
      // Create local history if none exists
      this.enableHistoryTracking(true);
      this.localHistory!.importFromJSON(json, options);
      return this;
    }

    history.importFromJSON(json, options);
    return this;
  }

  /**
   * Clear the transition history
   *
   * @returns The DebugManager instance for chaining
   */
  clearHistory(): DebugManager {
    const history = this.getHistory();
    if (history) {
      history.clear();
      this.debug("Cleared transition history");
    }
    return this;
  }

  /**
   * Get statistics about the transition history
   *
   * @returns Statistics object or undefined if history is disabled
   */
  getHistoryStats():
    | {
        totalTransitions: number;
        successfulTransitions: number;
        failedTransitions: number;
        mostFrequentStates: [string, number][];
        mostFrequentTransitions: [{ from: string | null; to: string }, number][];
        avgTransitionsPerMinute?: number;
        oldestTransition?: number;
        newestTransition?: number;
      }
    | undefined {
    const history = this.getHistory();
    if (!history || history.isEmpty()) return undefined;

    const allTransitions = history.getHistory();
    const successful = history.filter((entry) => entry.success);
    const failed = history.filter((entry) => !entry.success);

    // Calculate transitions per minute if we have more than one transition
    let avgTransitionsPerMinute: number | undefined;
    let oldestTransition: number | undefined;
    let newestTransition: number | undefined;

    if (allTransitions.length > 1) {
      // Newest is first in the array, oldest is last
      newestTransition = allTransitions[0].timestamp;
      oldestTransition = allTransitions[allTransitions.length - 1].timestamp;

      const durationMinutes = (newestTransition - oldestTransition) / (1000 * 60);
      if (durationMinutes > 0) {
        avgTransitionsPerMinute = allTransitions.length / durationMinutes;
      }
    } else if (allTransitions.length === 1) {
      newestTransition = oldestTransition = allTransitions[0].timestamp;
    }

    return {
      totalTransitions: allTransitions.length,
      successfulTransitions: successful.length,
      failedTransitions: failed.length,
      mostFrequentStates: history.getMostFrequentStates(),
      mostFrequentTransitions: history.getMostFrequentTransitions(),
      avgTransitionsPerMinute,
      oldestTransition,
      newestTransition,
    };
  }

  /**
   * Add a custom logger to receive log entries
   *
   * @param logger - Function that will receive log entries
   * @returns The DebugManager instance for chaining
   */
  addLogger(logger: (entry: LogEntry) => void): DebugManager {
    this.customLoggers.push(logger);
    return this;
  }

  /**
   * Remove a previously added logger
   *
   * @param logger - The logger function to remove
   * @returns The DebugManager instance for chaining
   */
  removeLogger(logger: (entry: LogEntry) => void): DebugManager {
    const index = this.customLoggers.indexOf(logger);
    if (index !== -1) {
      this.customLoggers.splice(index, 1);
    }
    return this;
  }

  /**
   * Add a performance metric collector
   *
   * @param collector - Function that will receive performance metrics
   * @returns The DebugManager instance for chaining
   */
  addMetricCollector(collector: (metric: PerformanceMetric) => void): DebugManager {
    this.metricCollectors.push(collector);
    return this;
  }

  /**
   * Remove a previously added metric collector
   *
   * @param collector - The collector function to remove
   * @returns The DebugManager instance for chaining
   */
  removeMetricCollector(collector: (metric: PerformanceMetric) => void): DebugManager {
    const index = this.metricCollectors.indexOf(collector);
    if (index !== -1) {
      this.metricCollectors.splice(index, 1);
    }
    return this;
  }

  /**
   * Set the current log level
   *
   * @param level - The log level to set
   * @returns The DebugManager instance for chaining
   */
  setLogLevel(level: LogLevel): DebugManager {
    this.logLevel = level;
    return this;
  }

  /**
   * Enable or disable performance measurement
   *
   * @param enable - Whether to enable performance measurement
   * @returns The DebugManager instance for chaining
   */
  enablePerformanceMeasurement(enable: boolean = true): DebugManager {
    this.measurePerformance = enable;
    return this;
  }

  /**
   * Set a custom log formatter
   *
   * @param formatter - Function that formats log entries into strings
   * @returns The DebugManager instance for chaining
   */
  setLogFormatter(formatter: (entry: LogEntry) => string): DebugManager {
    this.logFormat = formatter;
    return this;
  }

  /**
   * The default log formatter
   *
   * @param entry - The log entry to format
   * @returns A formatted log string
   */
  private defaultLogFormat(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const context = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : "";
    return `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${context}`;
  }

  /**
   * Log a message at the specified level
   *
   * @param level - The log level for this message
   * @param message - The message to log
   * @param context - Optional context data for the log entry
   */
  log(level: LogLevel, message: string, context?: unknown): void {
    // Skip if the current log level doesn't include this message
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    // Log to console based on level
    if (this.customLoggers.length === 0) {
      this.logToConsole(entry);
    }

    // Send to all custom loggers
    for (const logger of this.customLoggers) {
      try {
        logger(entry);
      } catch (error) {
        console.error("Error in custom logger:", error);
      }
    }
  }

  /**
   * Log a debug message
   *
   * @param message - The message to log
   * @param context - Optional context data
   * @returns The DebugManager instance for chaining
   */
  debug(message: string, context?: unknown): DebugManager {
    this.log("debug", message, context);
    return this;
  }

  /**
   * Log an info message
   *
   * @param message - The message to log
   * @param context - Optional context data
   * @returns The DebugManager instance for chaining
   */
  info(message: string, context?: unknown): DebugManager {
    this.log("info", message, context);
    return this;
  }

  /**
   * Log a warning message
   *
   * @param message - The message to log
   * @param context - Optional context data
   * @returns The DebugManager instance for chaining
   */
  warn(message: string, context?: unknown): DebugManager {
    this.log("warn", message, context);
    return this;
  }

  /**
   * Log an error message
   *
   * @param message - The message to log
   * @param context - Optional context data
   * @returns The DebugManager instance for chaining
   */
  error(message: string, context?: unknown): DebugManager {
    this.log("error", message, context);
    return this;
  }

  /**
   * Log a state transition
   *
   * @param fromState - The source state
   * @param toState - The target state
   * @param success - Whether the transition was successful
   * @param context - The context data for the transition
   * @returns The DebugManager instance for chaining
   */
  logTransition(fromState: State | null, toState: string, success: boolean, context?: unknown): DebugManager {
    const level = success ? "info" : "warn";
    const fromStateName = fromState ? fromState.name : "null";
    const message = success ? `Transition: ${fromStateName} → ${toState}` : `Failed transition: ${fromStateName} → ${toState}`;

    this.log(level, message, context);

    // Record in local history if enabled and FluentState doesn't have its own history
    if (this.historyEnabled && this.localHistory && !this.fluentState.history) {
      this.localHistory.recordTransition(fromState, toState, context, success);
    }

    return this;
  }

  /**
   * Record a performance metric
   *
   * @param category - The category of the metric
   * @param name - The name of the specific operation
   * @param duration - The duration in milliseconds
   * @param details - Optional additional details
   * @returns The DebugManager instance for chaining
   */
  recordMetric(
    category: "transitionEvaluation" | "conditionExecution" | "contextUpdate",
    name: string,
    duration: number,
    details?: Record<string, unknown>,
  ): DebugManager {
    if (!this.measurePerformance) return this;

    // Store the metric
    if (!this.metrics[category].has(name)) {
      this.metrics[category].set(name, []);
    }
    this.metrics[category].get(name)!.push(duration);

    // Notify metric collectors
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      category,
      name,
      duration,
      details,
    };

    for (const collector of this.metricCollectors) {
      try {
        collector(metric);
      } catch (error) {
        console.error("Error in metric collector:", error);
      }
    }

    // Log the metric at debug level
    this.debug(`Performance: ${category} - ${name} took ${duration}ms`, details);

    return this;
  }

  /**
   * Get performance metrics for a specific category
   *
   * @param category - The category of metrics to retrieve
   * @returns A map of metric names to arrays of durations
   */
  getMetrics(category: "transitionEvaluation" | "conditionExecution" | "contextUpdate"): Map<string, number[]> {
    return new Map(this.metrics[category]);
  }

  /**
   * Get average performance metrics for a specific category
   *
   * @param category - The category of metrics to retrieve
   * @returns A map of metric names to average durations
   */
  getAverageMetrics(category: "transitionEvaluation" | "conditionExecution" | "contextUpdate"): Map<string, number> {
    const result = new Map<string, number>();

    for (const [name, durations] of this.metrics[category].entries()) {
      if (durations.length === 0) continue;
      const sum = durations.reduce((a, b) => a + b, 0);
      result.set(name, sum / durations.length);
    }

    return result;
  }

  /**
   * Clear all collected metrics
   *
   * @returns The DebugManager instance for chaining
   */
  clearMetrics(): DebugManager {
    this.metrics.transitionEvaluation.clear();
    this.metrics.conditionExecution.clear();
    this.metrics.contextUpdate.clear();
    return this;
  }

  /**
   * Determine if a message at the given level should be logged
   *
   * @param level - The log level to check
   * @returns Whether the message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.logLevel === "none") return false;
    if (this.logLevel === "debug") return true;

    const levels: LogLevel[] = ["error", "warn", "info", "debug"];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);

    return messageIndex <= currentIndex;
  }

  /**
   * Log an entry to the console
   *
   * @param entry - The log entry to log
   */
  private logToConsole(entry: LogEntry): void {
    const formattedMessage = this.logFormat(entry);

    switch (entry.level) {
      case "debug":
        console.debug(formattedMessage);
        break;
      case "info":
        console.info(formattedMessage);
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        break;
    }
  }
}
