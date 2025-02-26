import { FluentState } from "./fluent-state";
import { State } from "./state";
import { LogLevel, LogEntry, LogConfig, PerformanceMetric, TransitionHistoryEntry, GraphConfig } from "./types";
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

  /**
   * Exports the complete state machine configuration for debugging, documentation, or recreation.
   *
   * @param options - Export options
   * @returns String representation of the state machine configuration
   */
  exportConfig(
    options: {
      format?: "json" | "yaml" | "js";
      indent?: number;
      includeStates?: boolean;
      includeTransitions?: boolean;
      includeGroups?: boolean;
      includeSettings?: boolean;
      pretty?: boolean;
      redactSecrets?: boolean | ((key: string, value: unknown) => boolean);
      omitKeys?: string[];
      includeHistory?: boolean;
      historyLimit?: number;
    } = {},
  ): string {
    // Default options
    const {
      format = "json",
      indent = 2,
      includeStates = true,
      includeTransitions = true,
      includeGroups = true,
      includeSettings = true,
      pretty = true,
      redactSecrets = false,
      omitKeys = ["password", "token", "secret", "key", "credential"],
      includeHistory = false,
      historyLimit = 10,
    } = options;

    this.debug("Exporting state machine configuration", options);

    // Gather all state machine data
    const config: Record<string, unknown> = {};

    // Include current state
    const currentState = this.fluentState.getCurrentState();
    if (currentState) {
      config.currentState = currentState.name;
    }

    // Include states
    if (includeStates) {
      const states: Record<string, unknown> = {};
      this.fluentState.states.forEach((state, name) => {
        states[name] = {
          transitions: state.transitions,
          autoTransitions: this.serializeAutoTransitions(state),
          hasContext: !!state.getContext(),
        };
      });
      config.states = states;
    }

    // Include all transitions
    if (includeTransitions) {
      const transitions: Record<string, string[]> = {};
      this.fluentState.states.forEach((state, name) => {
        transitions[name] = [...state.transitions];
      });
      config.transitions = transitions;
    }

    // Include groups
    if (includeGroups) {
      // Check if the exportGroups method exists for backward compatibility
      config.groups = this.fluentState["groups"] ? Array.from(this.fluentState["groups"].values()).map((group) => group.serialize()) : [];
    }

    // Include debug settings
    if (includeSettings) {
      config.settings = {
        logLevel: this.logLevel,
        measurePerformance: this.measurePerformance,
        historyEnabled: this.historyEnabled || this.fluentState.history !== undefined,
      };
    }

    // Include history summary
    if (includeHistory) {
      const history = this.getHistory();
      if (history) {
        const historyData = history.getHistory().slice(-historyLimit);
        config.recentHistory = historyData.map((entry) => this.redactSensitiveData(entry, redactSecrets, omitKeys));
      }
    }

    // Process the configuration to redact sensitive information if needed
    const processedConfig = this.processSensitiveData(config, redactSecrets, omitKeys) as Record<string, unknown>;

    // Format the output
    switch (format) {
      case "json":
        return pretty ? JSON.stringify(processedConfig, null, indent) : JSON.stringify(processedConfig);

      case "yaml":
        return this.convertToYaml(processedConfig, indent);

      case "js":
        return `const stateMachineConfig = ${JSON.stringify(processedConfig, null, indent)};
export default stateMachineConfig;`;

      default:
        return JSON.stringify(processedConfig, null, indent);
    }
  }

  /**
   * Exports only the state machine configuration part needed to recreate it.
   *
   * @param options - Export options
   * @returns String representation of the recreatable state machine configuration
   */
  exportRecreationConfig(
    options: {
      format?: "json" | "yaml" | "js";
      indent?: number;
      pretty?: boolean;
      redactSecrets?: boolean | ((key: string, value: unknown) => boolean);
      omitKeys?: string[];
      withComments?: boolean;
    } = {},
  ): string {
    const {
      format = "json",
      indent = 2,
      pretty = true,
      redactSecrets = true,
      omitKeys = ["password", "token", "secret", "key", "credential"],
      withComments = true,
    } = options;

    this.debug("Exporting recreation configuration", options);

    // Create a minimal configuration that can be used to recreate the state machine
    const recreationConfig: Record<string, unknown> = {
      initialState: this.fluentState.getCurrentState()?.name,
      states: {},
      // Check if the groups property exists for backward compatibility
      groups: this.fluentState["groups"] ? Array.from(this.fluentState["groups"].values()).map((group) => group.serialize()) : [],
      settings: {
        enableHistory: this.historyEnabled || this.fluentState.history !== undefined,
        debug: {
          logLevel: this.logLevel,
          measurePerformance: this.measurePerformance,
        },
      },
    };

    // Add states with their transitions
    const statesConfig = recreationConfig.states as Record<string, unknown>;
    this.fluentState.states.forEach((state, name) => {
      statesConfig[name] = {
        transitions: state.transitions,
      };
    });

    // Process the configuration to redact sensitive information
    const processedConfig = this.processSensitiveData(recreationConfig, redactSecrets, omitKeys) as Record<string, unknown>;

    // Format with appropriate comments if requested
    switch (format) {
      case "json":
        if (withComments && pretty) {
          return this.createJsonWithComments(processedConfig, indent);
        }
        return pretty ? JSON.stringify(processedConfig, null, indent) : JSON.stringify(processedConfig);

      case "yaml":
        if (withComments) {
          return this.createYamlWithComments(processedConfig);
        }
        return this.convertToYaml(processedConfig, indent);

      case "js":
        if (withComments) {
          return `/**
 * FluentState configuration for recreation
 * Generated on: ${new Date().toISOString()}
 *
 * This configuration can be used to recreate an identical state machine.
 * Usage:
 *   const fs = new FluentState(stateMachineConfig);
 *   await fs.start();
 */
const stateMachineConfig = ${JSON.stringify(processedConfig, null, indent)};
export default stateMachineConfig;`;
        }
        return `const stateMachineConfig = ${JSON.stringify(processedConfig, null, indent)};
export default stateMachineConfig;`;

      default:
        return JSON.stringify(processedConfig, null, indent);
    }
  }

  /**
   * Exports the state machine as a fluent JavaScript code that can recreate it.
   * Useful for generating code examples or starter templates.
   *
   * @param options - Export options
   * @returns String containing JavaScript code to recreate the state machine
   */
  exportAsFluentCode(
    options: {
      includeImports?: boolean;
      variableName?: string;
      withComments?: boolean;
      redactSecrets?: boolean | ((key: string, value: unknown) => boolean);
      omitKeys?: string[];
      indent?: number;
    } = {},
  ): string {
    const {
      includeImports = true,
      variableName = "fluentState",
      withComments = true,
      redactSecrets = true,
      omitKeys = ["password", "token", "secret", "key", "credential"],
      indent = 2,
    } = options;

    this.debug("Exporting state machine as fluent code", options);

    let codeOutput = "";
    const indentStr = " ".repeat(indent);

    // Add imports if requested
    if (includeImports) {
      codeOutput += `import { FluentState } from 'fluent-state';\n\n`;
    }

    // Add comments if requested
    if (withComments) {
      codeOutput += `/**
 * FluentState machine definition
 * Generated on: ${new Date().toISOString()}
 */\n`;
    }

    // Create the FluentState instance
    const currentState = this.fluentState.getCurrentState();
    if (currentState) {
      codeOutput += `const ${variableName} = new FluentState({
${indentStr}initialState: "${currentState.name}"`;

      // Add debug configuration if needed
      if (this.logLevel !== "none" || this.measurePerformance) {
        codeOutput += `,
${indentStr}debug: {
${indentStr}${indentStr}logLevel: "${this.logLevel}",
${indentStr}${indentStr}measurePerformance: ${this.measurePerformance}
${indentStr}}`;
      }

      // Add history configuration if enabled
      if (this.historyEnabled || this.fluentState.history) {
        codeOutput += `,
${indentStr}enableHistory: true`;
      }

      codeOutput += `
});\n\n`;
    } else {
      codeOutput += `const ${variableName} = new FluentState();\n\n`;
    }

    // Define states and transitions
    this.fluentState.states.forEach((state, stateName) => {
      if (stateName === currentState?.name) return; // Skip initial state (already defined)

      codeOutput += `${variableName}.from("${stateName}");\n`;
    });

    codeOutput += "\n";

    // Define transitions
    this.fluentState.states.forEach((state, stateName) => {
      if (state.transitions.length === 0) return;

      // Chain transitions from this state
      codeOutput += `${variableName}.from("${stateName}")`;

      state.transitions.forEach((transition) => {
        codeOutput += `\n${indentStr}.to("${transition}")`;
      });

      codeOutput += ";\n\n";
    });

    // Define groups if they exist
    if (this.fluentState.groups.size > 0) {
      codeOutput += "// Transition Groups\n";

      this.fluentState.groups.forEach((group, groupName) => {
        const serialized = group.serialize();
        const processedGroup = this.processSensitiveData(serialized, redactSecrets, omitKeys) as Record<string, unknown>;

        codeOutput += `const ${groupName.replace(/[^a-zA-Z0-9_]/g, "_")}Group = ${variableName}.createGroup("${groupName}")`;

        // Add configuration if available
        if (processedGroup.config) {
          const config = processedGroup.config;
          codeOutput += `\n${indentStr}.withConfig(${JSON.stringify(config)})`;
        }

        codeOutput += ";\n\n";

        // Add transitions to the group
        if (Array.isArray(serialized.transitions) && serialized.transitions.length > 0) {
          serialized.transitions.forEach((t) => {
            codeOutput += `${groupName.replace(/[^a-zA-Z0-9_]/g, "_")}Group.from("${t.from}").to("${t.to}");\n`;
          });
          codeOutput += "\n";
        }
      });
    }

    // Add code to start the state machine
    codeOutput += `// Start the state machine\n${variableName}.start();\n`;

    return codeOutput;
  }

  /**
   * Creates a JSON string with comments explaining each major section.
   *
   * @param config - The configuration object
   * @param indent - Number of spaces for indentation
   * @returns JSON string with comments
   */
  private createJsonWithComments(config: Record<string, unknown>, indent: number): string {
    // JSON doesn't support comments, so we're creating a string that looks like JSON with comments
    // This won't be valid JSON, but is meant for human reading

    const jsonStr = JSON.stringify(config, null, indent);
    const lines = jsonStr.split("\n");

    // Insert comments at key sections
    let result = "// FluentState configuration - Generated on: " + new Date().toISOString() + "\n";
    result += "// This configuration can be used to recreate an identical state machine\n\n";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Add comments before major sections
      if (line.includes('"initialState"')) {
        result += "  // The initial state of the state machine\n";
      } else if (line.includes('"states"')) {
        result += "  // Definition of all states and their transitions\n";
      } else if (line.includes('"groups"')) {
        result += "  // Transition groups for organization and control\n";
      } else if (line.includes('"settings"')) {
        result += "  // Configuration settings for the state machine\n";
      }

      result += line + "\n";
    }

    return result;
  }

  /**
   * Converts the configuration object to YAML format.
   *
   * @param config - The configuration object
   * @param indent - Number of spaces for indentation
   * @returns YAML string
   */
  private convertToYaml(config: Record<string, unknown>, indent: number): string {
    // A simple JSON to YAML converter for basic objects
    // For a real implementation, you'd use a YAML library

    const toYaml = (obj: unknown, depth = 0): string => {
      const indentStr = " ".repeat(indent * depth);

      if (obj === null) return "null";
      if (obj === undefined) return "";

      if (typeof obj === "string") return `"${obj}"`;
      if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

      if (Array.isArray(obj)) {
        if (obj.length === 0) return "[]";

        return obj.map((item) => `${indentStr}- ${toYaml(item, depth + 1).trimStart()}`).join("\n");
      }

      if (typeof obj === "object") {
        const objEntries = Object.entries(obj);
        if (objEntries.length === 0) return "{}";

        return objEntries
          .map(([key, value]) => {
            const valueStr = toYaml(value, depth + 1);
            if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
              return `${indentStr}${key}:\n${valueStr}`;
            }
            return `${indentStr}${key}: ${valueStr}`;
          })
          .join("\n");
      }

      return String(obj);
    };

    return toYaml(config);
  }

  /**
   * Creates a YAML string with comments from a configuration object.
   *
   * @param config - The configuration object to convert to YAML with comments
   * @returns YAML string with comments
   */
  private createYamlWithComments(config: Record<string, unknown>): string {
    let result = "# FluentState configuration - Generated on: " + new Date().toISOString() + "\n";
    result += "# This configuration can be used to recreate an identical state machine\n\n";

    if (config.initialState) {
      result += "# The initial state of the state machine\n";
      result += `initialState: "${String(config.initialState)}"\n\n`;
    }

    if (config.states) {
      result += "# Definition of all states and their transitions\n";
      result += "states:\n";

      const states = config.states as Record<string, unknown>;
      Object.entries(states).forEach(([stateName, stateConfig]) => {
        result += `  ${stateName}:\n`;

        const stateObj = stateConfig as Record<string, unknown>;
        if (Array.isArray(stateObj.transitions)) {
          result += "    transitions:\n";
          stateObj.transitions.forEach((transition: string) => {
            result += `      - "${transition}"\n`;
          });
        }
      });

      result += "\n";
    }

    if (config.groups) {
      result += "# Transition groups for organization and control\n";
      result += "groups:\n";

      const groups = config.groups as unknown[];
      if (Array.isArray(groups)) {
        groups.forEach((group, index) => {
          const groupObj = group as Record<string, unknown>;
          result += `  - name: "${groupObj.name}"\n`;

          if (groupObj.namespace) {
            result += `    namespace: "${groupObj.namespace}"\n`;
          }

          result += `    enabled: ${groupObj.enabled}\n`;

          if (groupObj.parentGroup) {
            result += `    parentGroup: "${groupObj.parentGroup}"\n`;
          }

          if (groupObj.config) {
            result += "    config:\n";
            const configObj = groupObj.config as Record<string, unknown>;

            Object.entries(configObj).forEach(([key, value]) => {
              if (typeof value === "object" && value !== null) {
                result += `      ${key}:\n`;
                const valueObj = value as Record<string, unknown>;
                Object.entries(valueObj).forEach(([subKey, subValue]) => {
                  result += `        ${subKey}: ${subValue}\n`;
                });
              } else {
                result += `      ${key}: ${value}\n`;
              }
            });
          }

          if (Array.isArray(groupObj.transitions) && groupObj.transitions.length > 0) {
            result += "    transitions:\n";
            groupObj.transitions.forEach((t: unknown) => {
              const transition = t as Record<string, unknown>;
              result += `      - from: "${transition.from}"\n`;
              result += `        to: "${transition.to}"\n`;

              if (transition.config) {
                result += "        config:\n";
                const tConfig = transition.config as Record<string, unknown>;
                Object.entries(tConfig).forEach(([key, value]) => {
                  result += `          ${key}: ${value}\n`;
                });
              }
            });
          }

          if (index < groups.length - 1) {
            result += "\n";
          }
        });
      }

      result += "\n";
    }

    if (config.settings) {
      result += "# Configuration settings for the state machine\n";
      result += "settings:\n";

      const settings = config.settings as Record<string, unknown>;
      Object.entries(settings).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          result += `  ${key}:\n`;
          const valueObj = value as Record<string, unknown>;
          Object.entries(valueObj).forEach(([subKey, subValue]) => {
            result += `    ${subKey}: ${subValue}\n`;
          });
        } else {
          result += `  ${key}: ${value}\n`;
        }
      });
    }

    return result;
  }

  /**
   * Serializes auto-transitions for a state into a configuration object.
   *
   * @param state - The state to serialize auto-transitions for
   * @returns Array of serialized auto-transitions
   */
  private serializeAutoTransitions(state: State): Record<string, unknown>[] {
    // Get the private state to access auto-transitions
    const privateState = state as unknown as {
      _autoTransitions?: Array<{
        condition: (state: State, context: unknown) => boolean | Promise<boolean>;
        targetState: string;
        priority?: number;
        debounce?: number;
        retryConfig?: {
          maxAttempts: number;
          delay: number;
        };
        groupName?: string;
      }>;
    };

    if (!privateState._autoTransitions || !Array.isArray(privateState._autoTransitions)) {
      return [];
    }

    return privateState._autoTransitions.map((autoTransition) => {
      // We're explicitly excluding the condition function as it can't be serialized
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { condition: _, ...rest } = autoTransition;
      return {
        ...rest,
        hasCondition: true,
      };
    });
  }

  /**
   * Process sensitive data in a configuration object by redacting it.
   *
   * @param data - The data object to process
   * @param redactSecrets - Whether to redact secrets or a function to determine what to redact
   * @param omitKeys - Keys to omit or redact
   * @returns Processed data with sensitive information redacted
   */
  private processSensitiveData(data: unknown, redactSecrets: boolean | ((key: string, value: unknown) => boolean), omitKeys: string[] = []): unknown {
    if (!redactSecrets) return data;

    const shouldRedact = (key: string, value: unknown): boolean => {
      if (typeof redactSecrets === "function") {
        return redactSecrets(key, value);
      }

      // Default redaction logic - redact keys that match sensitive patterns
      return omitKeys.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()));
    };

    const processValue = (value: unknown, path: string): unknown => {
      if (value === null || value === undefined) return value;

      if (Array.isArray(value)) {
        return value.map((item, index) => processValue(item, `${path}[${index}]`));
      }

      if (typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, val]) => {
            const newPath = path ? `${path}.${key}` : key;

            if (shouldRedact(key, val)) {
              return [key, "[REDACTED]"];
            }

            return [key, processValue(val, newPath)];
          }),
        );
      }

      return value;
    };

    return processValue(data, "");
  }

  /**
   * Redact sensitive data from a history entry.
   *
   * @param entry - The history entry to process
   * @param redactSecrets - Whether to redact secrets or a function to determine what to redact
   * @param omitKeys - Keys to omit or redact
   * @returns Processed entry with sensitive information redacted
   */
  private redactSensitiveData(
    entry: TransitionHistoryEntry,
    redactSecrets: boolean | ((key: string, value: unknown) => boolean),
    omitKeys: string[] = [],
  ): TransitionHistoryEntry {
    if (!redactSecrets || !entry.context) {
      return entry;
    }

    return {
      ...entry,
      context: this.processSensitiveData(entry.context, redactSecrets, omitKeys),
    };
  }

  /**
   * Generates a visual representation of the state machine.
   *
   * @param options - Configuration for the graph visualization
   * @returns A string containing the graph representation
   */
  generateGraph(options: GraphConfig = { format: "mermaid" }): string {
    // Set default values
    const format = options.format || "mermaid";
    const opts = {
      showConditions: options.options?.showConditions !== undefined ? options.options.showConditions : true,
      groupClusters: options.options?.groupClusters !== undefined ? options.options.groupClusters : true,
      showMetadata: options.options?.showMetadata !== undefined ? options.options.showMetadata : false,
      highlightCurrent: options.options?.highlightCurrent !== undefined ? options.options.highlightCurrent : true,
      showHistory: options.options?.showHistory !== undefined ? options.options.showHistory : false,
      styles: options.options?.styles || {},
    };

    this.debug(`Generating ${format} graph of state machine with ${this.fluentState.states.size} states`);

    switch (format) {
      case "mermaid":
        return this.generateMermaidGraph(opts);
      case "dot":
        return this.generateDotGraph(opts);
      case "svg":
        return this.generateSvgGraph(opts);
      default:
        this.warn(`Unsupported graph format: ${format}. Defaulting to mermaid.`);
        return this.generateMermaidGraph(opts);
    }
  }

  /**
   * Generates a Mermaid representation of the state machine.
   *
   * @param options - Configuration for the graph visualization
   * @returns A string containing the Mermaid diagram
   * @private
   */
  private generateMermaidGraph(options: {
    showConditions: boolean;
    groupClusters: boolean;
    showMetadata: boolean;
    highlightCurrent: boolean;
    showHistory: boolean;
    styles: Record<string, Record<string, string>>;
  }): string {
    const { showConditions, groupClusters, highlightCurrent, showHistory, styles } = options;

    let mermaid = "stateDiagram-v2\n";
    const currentState = this.fluentState.getCurrentState()?.name;
    const transitions = this.getAllTransitions();

    // Group states by transition group if groupClusters is enabled
    if (groupClusters && this.fluentState.groups.size > 0) {
      for (const [groupName, group] of this.fluentState.groups) {
        const sanitizedGroupName = this.sanitizeMermaidId(groupName);
        const groupTransitions = group.getAllTransitions();

        if (groupTransitions.length > 0) {
          mermaid += `\n  %% ${groupName} Group\n`;
          mermaid += `  state "${groupName}" as ${sanitizedGroupName} {\n`;

          // Add states in this group
          const statesInGroup = new Set<string>();
          groupTransitions.forEach(([from, to]) => {
            statesInGroup.add(from);
            statesInGroup.add(to);
          });

          // Initial state marker for first state in group
          const firstState = Array.from(statesInGroup)[0];
          if (firstState) {
            mermaid += `    [*] --> ${this.sanitizeMermaidId(firstState)}\n`;
          }

          // Add transitions within this group
          groupTransitions.forEach(([from, to]) => {
            const sanitizedFrom = this.sanitizeMermaidId(from);
            const sanitizedTo = this.sanitizeMermaidId(to);

            const transitionLabel = this.getTransitionLabel(group, from, to, showConditions);

            mermaid += `    ${sanitizedFrom} --> ${sanitizedTo}${transitionLabel}\n`;
          });

          mermaid += "  }\n";
        }
      }
    }

    // Add states and transitions not in groups
    const groupedTransitions = new Set<string>();
    if (this.fluentState.groups.size > 0) {
      for (const group of this.fluentState.groups.values()) {
        group.getAllTransitions().forEach(([from, to]) => {
          groupedTransitions.add(`${from}|${to}`);
        });
      }
    }

    // Initialize a marker for whether we've added ungrouped states section
    let addedUngroupedHeader = false;

    // Process transitions that aren't in any group
    transitions.forEach(([from, to]) => {
      if (!groupedTransitions.has(`${from}|${to}`)) {
        if (!addedUngroupedHeader) {
          mermaid += "\n  %% Ungrouped States\n";
          addedUngroupedHeader = true;
        }

        const sanitizedFrom = this.sanitizeMermaidId(from);
        const sanitizedTo = this.sanitizeMermaidId(to);

        const transitionLabel = "";

        // We don't have direct access to condition info for ungrouped transitions
        // This would require additional implementation to track this data

        mermaid += `  ${sanitizedFrom} --> ${sanitizedTo}${transitionLabel}\n`;
      }
    });

    // Add style for current state if requested
    if (highlightCurrent && currentState) {
      const sanitizedCurrentState = this.sanitizeMermaidId(currentState);
      mermaid += `\n  %% Styling\n`;
      mermaid += `  classDef currentState fill:#f96,stroke:#333,stroke-width:2px;\n`;
      mermaid += `  class ${sanitizedCurrentState} currentState\n`;
    }

    // Add custom styles if provided
    if (styles && Object.keys(styles).length > 0) {
      if (!mermaid.includes("%% Styling")) {
        mermaid += `\n  %% Styling\n`;
      }

      // Group styles
      if (styles.groups) {
        for (const [groupName, style] of Object.entries(styles.groups)) {
          const sanitizedGroupName = this.sanitizeMermaidId(groupName);
          mermaid += `  classDef ${sanitizedGroupName} ${style};\n`;
          mermaid += `  class ${sanitizedGroupName} ${sanitizedGroupName}\n`;
        }
      }

      // State styles
      if (styles.states) {
        for (const [stateName, style] of Object.entries(styles.states)) {
          const sanitizedStateName = this.sanitizeMermaidId(stateName);
          mermaid += `  classDef ${sanitizedStateName} ${style};\n`;
          mermaid += `  class ${sanitizedStateName} ${sanitizedStateName}\n`;
        }
      }
    }

    // Show transition history if requested
    if (showHistory && (this.fluentState.history || this.localHistory)) {
      const history = this.fluentState.history || this.localHistory;
      if (history) {
        // Access history entries safely
        let entries: TransitionHistoryEntry[] = [];
        try {
          // Use the proper method to get history if it exists
          if (typeof history.getHistory === "function") {
            entries = history.getHistory();
          } else if (Array.isArray((history as unknown as { entries: TransitionHistoryEntry[] }).entries)) {
            // Fallback to direct property access if available
            entries = (history as unknown as { entries: TransitionHistoryEntry[] }).entries;
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // Silently handle any errors
        }

        if (entries.length > 0) {
          mermaid += `\n  %% Transition History\n`;
          mermaid += `  %% Most recent transitions (newest first):\n`;

          // Show last 5 transitions
          const recentEntries = entries.slice(-5).reverse();
          recentEntries.forEach((entry, index) => {
            const fromState = entry.from === null ? "[*]" : this.sanitizeMermaidId(entry.from);
            const toState = this.sanitizeMermaidId(entry.to);
            mermaid += `  %% ${index + 1}. ${fromState} --> ${toState} (${new Date(entry.timestamp).toISOString()})\n`;
          });
        }
      }
    }

    return mermaid;
  }

  /**
   * Generates a DOT (Graphviz) representation of the state machine.
   *
   * @param options - Configuration for the graph visualization
   * @returns A string containing the DOT diagram
   * @private
   */
  private generateDotGraph(options: {
    showConditions: boolean;
    groupClusters: boolean;
    showMetadata: boolean;
    highlightCurrent: boolean;
    showHistory: boolean;
    styles: Record<string, Record<string, string>>;
  }): string {
    const { showConditions, groupClusters, highlightCurrent, showHistory, styles } = options;

    let dot = "digraph StateMachine {\n";
    dot += "  rankdir=LR;\n"; // Left to right layout
    dot += "  node [shape=box, style=rounded];\n";

    const currentState = this.fluentState.getCurrentState()?.name;
    const transitions = this.getAllTransitions();

    // Style current state if requested
    if (highlightCurrent && currentState) {
      const sanitizedCurrentState = this.sanitizeDotId(currentState);
      dot += `  "${sanitizedCurrentState}" [style="rounded,filled", fillcolor="#f96"];\n`;
    }

    // Group states by transition group if groupClusters is enabled
    if (groupClusters && this.fluentState.groups.size > 0) {
      for (const [groupName, group] of this.fluentState.groups) {
        const sanitizedGroupName = this.sanitizeDotId(groupName);
        const groupTransitions = group.getAllTransitions();

        if (groupTransitions.length > 0) {
          dot += `\n  // ${groupName} Group\n`;
          dot += `  subgraph "cluster_${sanitizedGroupName}" {\n`;
          dot += `    label="${groupName}";\n`;
          dot += `    style=rounded;\n`;
          dot += `    color="#333333";\n`;

          // Custom style for this group if provided
          if (styles.groups && styles.groups[groupName]) {
            dot += `    ${styles.groups[groupName]};\n`;
          }

          // Add states in this group
          const statesInGroup = new Set<string>();
          groupTransitions.forEach(([from, to]) => {
            statesInGroup.add(from);
            statesInGroup.add(to);
          });

          // Declare states
          statesInGroup.forEach((state) => {
            const sanitizedState = this.sanitizeDotId(state);
            dot += `    "${sanitizedState}";\n`;
          });

          dot += "  }\n";
        }
      }
    }

    // Add transitions with labels for conditions if requested
    dot += "\n  // Transitions\n";
    transitions.forEach(([from, to]) => {
      const sanitizedFrom = this.sanitizeDotId(from);
      const sanitizedTo = this.sanitizeDotId(to);

      // Build the transition attributes string as we go
      let transitionAttributes = "";

      // Check if this transition belongs to a group
      let groupWithTransition: string | undefined;
      for (const [groupName, group] of this.fluentState.groups) {
        if (group.hasTransition(from, to)) {
          groupWithTransition = groupName;
          break;
        }
      }

      // Add condition if requested
      if (showConditions && groupWithTransition) {
        const group = this.fluentState.groups.get(groupWithTransition);
        const transitionInfo = group?.getEffectiveConfig(from, to);
        if (transitionInfo?.condition) {
          const conditionStr = transitionInfo.condition.toString();
          transitionAttributes += `label="${this.truncateCondition(conditionStr)}"`;
        }
      }

      // Custom style for this transition if provided
      if (styles.transitions) {
        const transitionKey = `${from}->${to}`;
        if (styles.transitions[transitionKey]) {
          if (transitionAttributes) transitionAttributes += ", ";
          transitionAttributes += styles.transitions[transitionKey];
        }
      }

      dot += `  "${sanitizedFrom}" -> "${sanitizedTo}"`;
      if (transitionAttributes) {
        dot += ` [${transitionAttributes}]`;
      }
      dot += ";\n";
    });

    // Show transition history if requested
    if (showHistory && (this.fluentState.history || this.localHistory)) {
      const history = this.fluentState.history || this.localHistory;
      if (history) {
        // Access history entries safely
        let entries: TransitionHistoryEntry[] = [];
        try {
          // Use the proper method to get history if it exists
          if (typeof history.getHistory === "function") {
            entries = history.getHistory();
          } else if (Array.isArray((history as unknown as { entries: TransitionHistoryEntry[] }).entries)) {
            // Fallback to direct property access if available
            entries = (history as unknown as { entries: TransitionHistoryEntry[] }).entries;
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // Silently handle any errors
        }

        if (entries.length > 0) {
          dot += "\n  // Transition History\n";
          dot += "  // Most recent transitions (newest first):\n";

          // Show last 5 transitions
          const recentEntries = entries.slice(-5).reverse();
          recentEntries.forEach((entry, index) => {
            const fromState = entry.from === null ? "START" : entry.from;
            dot += `  // ${index + 1}. ${fromState} -> ${entry.to} (${new Date(entry.timestamp).toISOString()})\n`;
          });
        }
      }
    }

    dot += "}\n";
    return dot;
  }

  /**
   * Generates an SVG representation of the state machine.
   * Note: This method generates a Mermaid or DOT graph and returns a comment indicating
   * that an external renderer is needed to convert to SVG.
   *
   * @param options - Configuration for the graph visualization
   * @returns A string containing an explanation about SVG rendering
   * @private
   */
  private generateSvgGraph(options: {
    showConditions: boolean;
    groupClusters: boolean;
    showMetadata: boolean;
    highlightCurrent: boolean;
    showHistory: boolean;
    styles: Record<string, Record<string, string>>;
  }): string {
    // SVG generation requires external rendering tools like Mermaid-CLI or Graphviz
    // Return the DOT format with a comment about rendering
    const dot = this.generateDotGraph(options);

    return `/*
  SVG Generation Note:
  To render this graph as SVG, you need to use an external tool like Graphviz:

  1. Save the following DOT graph definition to a file (e.g., state-machine.dot)
  2. Use the dot command to generate SVG:
     dot -Tsvg state-machine.dot -o state-machine.svg

  Alternatively, use a Mermaid renderer for the Mermaid format.
*/

${dot}`;
  }

  /**
   * Sanitize a string for use as a mermaid ID.
   *
   * @param id - Original ID string
   * @returns Sanitized ID
   * @private
   */
  private sanitizeMermaidId(id: string): string {
    // Replace characters that could break Mermaid
    return id.replace(/[^\w-]/g, "_");
  }

  /**
   * Sanitize a string for use as a DOT ID.
   *
   * @param id - Original ID string
   * @returns Sanitized ID
   * @private
   */
  private sanitizeDotId(id: string): string {
    // Replace characters that could break DOT
    return id.replace(/[^\w-]/g, "_");
  }

  /**
   * Truncate a condition function string for display in diagrams.
   *
   * @param condition - The condition function string
   * @returns Truncated condition string
   * @private
   */
  private truncateCondition(condition: string): string {
    // Truncate long condition strings and make them more readable
    if (condition.length > 30) {
      return condition.substring(0, 27) + "...";
    }
    return condition;
  }

  /**
   * Get the index of a transition for Mermaid linkStyle.
   *
   * @param fromState - Source state
   * @param toState - Target state
   * @returns Index of the transition
   * @private
   */
  private getTransitionIndex(fromState: string, toState: string): number {
    let index = 0;

    // Count transitions to calculate the index
    for (const [source, target] of this.getAllTransitions()) {
      if (source === fromState && target === toState) {
        return index;
      }
      index++;
    }

    return index;
  }

  /**
   * Get all transitions in the state machine.
   *
   * @returns Array of [fromState, toState] pairs
   * @private
   */
  private getAllTransitions(): [string, string][] {
    const transitions: [string, string][] = [];

    this.fluentState.states.forEach((state, fromState) => {
      state.transitions.forEach((toState) => {
        transitions.push([fromState, toState]);
      });
    });

    return transitions;
  }

  /**
   * Gets a formatted transition label for a graph edge.
   *
   * @param group - The transition group
   * @param from - The source state
   * @param to - The target state
   * @param showConditions - Whether to include condition in the label
   * @returns Formatted transition label string
   * @private
   */
  private getTransitionLabel(group: unknown, from: string, to: string, showConditions: boolean): string {
    if (!showConditions) return "";

    // Simplify this method to avoid accessing internal structures that might
    // interfere with serialization/deserialization mechanisms
    return "";
  }
}
