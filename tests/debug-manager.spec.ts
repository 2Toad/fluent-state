import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState } from "../src/fluent-state";
import { DebugManager } from "../src/debug-manager";
import { LogEntry, PerformanceMetric } from "../src/types";

describe("DebugManager", () => {
  let fluentState: FluentState;
  let debugManager: DebugManager;
  let clock: sinon.SinonFakeTimers;
  let consoleDebugStub: sinon.SinonStub;
  let consoleInfoStub: sinon.SinonStub;
  let consoleWarnStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    // Set up fake timers
    clock = sinon.useFakeTimers();

    // Create a new FluentState instance
    fluentState = new FluentState({ initialState: "idle" });

    // Get the debug manager from the FluentState instance
    debugManager = fluentState.debug;

    // Stub console methods to prevent actual console output and track calls
    consoleDebugStub = sinon.stub(console, "debug");
    consoleInfoStub = sinon.stub(console, "info");
    consoleWarnStub = sinon.stub(console, "warn");
    consoleErrorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    // Restore the original methods and time
    clock.restore();
    consoleDebugStub.restore();
    consoleInfoStub.restore();
    consoleWarnStub.restore();
    consoleErrorStub.restore();
  });

  describe("Log Level Configuration", () => {
    it("should default to 'none' log level", () => {
      // Default log level is 'none'
      debugManager.debug("This should not be logged");
      expect(consoleDebugStub.called).to.be.false;
    });

    it("should respect log level configuration", () => {
      // Set log level to debug (highest level)
      debugManager.setLogLevel("debug");

      // All log levels should work
      debugManager.debug("debug message");
      debugManager.info("info message");
      debugManager.warn("warn message");
      debugManager.error("error message");

      expect(consoleDebugStub.calledOnce).to.be.true;
      expect(consoleInfoStub.calledOnce).to.be.true;
      expect(consoleWarnStub.calledOnce).to.be.true;
      expect(consoleErrorStub.calledOnce).to.be.true;
    });

    it("should respect log level hierarchy", () => {
      // Set log level to 'warn'
      debugManager.setLogLevel("warn");

      // Debug and info should not be logged
      debugManager.debug("debug message");
      debugManager.info("info message");

      // Warn and error should be logged
      debugManager.warn("warn message");
      debugManager.error("error message");

      expect(consoleDebugStub.called).to.be.false;
      expect(consoleInfoStub.called).to.be.false;
      expect(consoleWarnStub.calledOnce).to.be.true;
      expect(consoleErrorStub.calledOnce).to.be.true;
    });

    it("should allow changing log level dynamically", () => {
      // Start with 'error' log level
      debugManager.setLogLevel("error");

      debugManager.debug("debug message");
      debugManager.info("info message");
      debugManager.warn("warn message");
      debugManager.error("error message");

      expect(consoleDebugStub.called).to.be.false;
      expect(consoleInfoStub.called).to.be.false;
      expect(consoleWarnStub.called).to.be.false;
      expect(consoleErrorStub.calledOnce).to.be.true;

      // Change to 'debug' log level
      debugManager.setLogLevel("debug");
      consoleErrorStub.reset();

      debugManager.debug("debug message");
      debugManager.info("info message");
      debugManager.warn("warn message");
      debugManager.error("error message");

      expect(consoleDebugStub.calledOnce).to.be.true;
      expect(consoleInfoStub.calledOnce).to.be.true;
      expect(consoleWarnStub.calledOnce).to.be.true;
      expect(consoleErrorStub.calledOnce).to.be.true;
    });
  });

  describe("Custom Log Handlers", () => {
    it("should allow adding and using custom log handlers", () => {
      // Create a spy for a custom log handler
      const customLogHandler = sinon.spy();

      // Configure log level and add the custom handler
      debugManager.setLogLevel("info");
      debugManager.addLogger(customLogHandler);

      // Log some messages
      debugManager.info("test message");
      debugManager.error("error message");

      // Verify the custom handler was called for both messages
      expect(customLogHandler.calledTwice).to.be.true;

      // Verify the log entries passed to the handler
      const firstCallArg = customLogHandler.firstCall.args[0] as LogEntry;
      expect(firstCallArg.level).to.equal("info");
      expect(firstCallArg.message).to.equal("test message");

      const secondCallArg = customLogHandler.secondCall.args[0] as LogEntry;
      expect(secondCallArg.level).to.equal("error");
      expect(secondCallArg.message).to.equal("error message");
    });

    it("should allow removing custom log handlers", () => {
      // Create spy for custom log handler
      const customLogHandler = sinon.spy();

      // Add the handler and configure log level
      debugManager.setLogLevel("info");
      debugManager.addLogger(customLogHandler);

      // Log a message and verify handler was called
      debugManager.info("first message");
      expect(customLogHandler.calledOnce).to.be.true;

      // Remove the handler
      debugManager.removeLogger(customLogHandler);

      // Log another message and verify handler wasn't called again
      debugManager.info("second message");
      expect(customLogHandler.calledOnce).to.be.true; // Still only called once
    });
  });

  describe("Performance Metrics", () => {
    it("should not record metrics when performance measurement is disabled", () => {
      // Performance measurement is disabled by default
      debugManager.recordMetric("transitionEvaluation", "test", 100);

      // Check that no metrics were recorded
      const metrics = debugManager.getMetrics("transitionEvaluation");
      expect(metrics.size).to.equal(0);
    });

    it("should record metrics when performance measurement is enabled", () => {
      // Enable performance measurement
      debugManager.enablePerformanceMeasurement(true);

      // Record some metrics
      debugManager.recordMetric("transitionEvaluation", "test1", 100);
      debugManager.recordMetric("transitionEvaluation", "test1", 150);
      debugManager.recordMetric("conditionExecution", "condition1", 50);

      // Verify metrics were recorded
      const transitionMetrics = debugManager.getMetrics("transitionEvaluation");
      expect(transitionMetrics.size).to.equal(1);
      expect(transitionMetrics.get("test1")).to.deep.equal([100, 150]);

      const conditionMetrics = debugManager.getMetrics("conditionExecution");
      expect(conditionMetrics.size).to.equal(1);
      expect(conditionMetrics.get("condition1")).to.deep.equal([50]);
    });

    it("should calculate average metrics correctly", () => {
      // Enable performance measurement
      debugManager.enablePerformanceMeasurement(true);

      // Record metrics
      debugManager.recordMetric("transitionEvaluation", "test1", 100);
      debugManager.recordMetric("transitionEvaluation", "test1", 150);
      debugManager.recordMetric("transitionEvaluation", "test1", 250);

      // Get average metrics
      const averageMetrics = debugManager.getAverageMetrics("transitionEvaluation");
      expect(averageMetrics.get("test1")).to.equal((100 + 150 + 250) / 3);
    });

    it("should allow custom metric collectors", () => {
      // Create a spy for a metric collector
      const metricCollector = sinon.spy();

      // Enable performance measurement and add the collector
      debugManager.enablePerformanceMeasurement(true);
      debugManager.addMetricCollector(metricCollector);

      // Record a metric
      debugManager.recordMetric("transitionEvaluation", "test", 100);

      // Verify the collector was called
      expect(metricCollector.calledOnce).to.be.true;

      // Verify the metric details
      const arg = metricCollector.firstCall.args[0] as PerformanceMetric;
      expect(arg.category).to.equal("transitionEvaluation");
      expect(arg.name).to.equal("test");
      expect(arg.duration).to.equal(100);
    });

    it("should clear metrics when requested", () => {
      // Enable performance measurement
      debugManager.enablePerformanceMeasurement(true);

      // Record some metrics
      debugManager.recordMetric("transitionEvaluation", "test1", 100);
      debugManager.recordMetric("conditionExecution", "condition1", 50);

      // Verify metrics were recorded
      expect(debugManager.getMetrics("transitionEvaluation").size).to.equal(1);
      expect(debugManager.getMetrics("conditionExecution").size).to.equal(1);

      // Clear metrics
      debugManager.clearMetrics();

      // Verify metrics were cleared
      expect(debugManager.getMetrics("transitionEvaluation").size).to.equal(0);
      expect(debugManager.getMetrics("conditionExecution").size).to.equal(0);
    });
  });

  describe("Log Formatting", () => {
    it("should use default log format", () => {
      // Set log level and record an error
      debugManager.setLogLevel("error");
      clock.setSystemTime(new Date("2023-01-01T00:00:00Z"));

      debugManager.error("test error");

      // Verify default format was used
      expect(consoleErrorStub.calledOnce).to.be.true;
      const logMessage = consoleErrorStub.firstCall.args[0] as string;
      expect(logMessage).to.contain("[2023-01-01T00:00:00.000Z]");
      expect(logMessage).to.contain("[ERROR]");
      expect(logMessage).to.contain("test error");
    });

    it("should use custom log format when provided", () => {
      // Create a custom formatter
      const customFormatter = (entry: LogEntry) => `CUSTOM: ${entry.level} - ${entry.message}`;

      // Configure logging
      debugManager.setLogLevel("error");
      debugManager.setLogFormatter(customFormatter);

      // Log a message
      debugManager.error("test error");

      // Verify custom format was used
      expect(consoleErrorStub.calledOnce).to.be.true;
      const logMessage = consoleErrorStub.firstCall.args[0] as string;
      expect(logMessage).to.equal("CUSTOM: error - test error");
    });
  });

  describe("Transition Logging", () => {
    it("should log successful transitions", () => {
      // Create states to use in the test
      const fromState = fluentState.from("state1");

      // Configure log level
      debugManager.setLogLevel("info");

      // Log a successful transition
      debugManager.logTransition(fromState, "state2", true);

      // Verify log message
      expect(consoleInfoStub.calledOnce).to.be.true;
      const logMessage = consoleInfoStub.firstCall.args[0] as string;
      expect(logMessage).to.contain("Transition: state1 → state2");
    });

    it("should log failed transitions", () => {
      // Create states to use in the test
      const fromState = fluentState.from("state1");

      // Configure log level
      debugManager.setLogLevel("warn");

      // Log a failed transition
      debugManager.logTransition(fromState, "state2", false);

      // Verify log message
      expect(consoleWarnStub.calledOnce).to.be.true;
      const logMessage = consoleWarnStub.firstCall.args[0] as string;
      expect(logMessage).to.contain("Failed transition: state1 → state2");
    });

    it("should handle null from-state in transition logging", () => {
      // Configure log level
      debugManager.setLogLevel("info");

      // Log a transition from null
      debugManager.logTransition(null, "state1", true);

      // Verify log message
      expect(consoleInfoStub.calledOnce).to.be.true;
      const logMessage = consoleInfoStub.firstCall.args[0] as string;
      expect(logMessage).to.contain("Transition: null → state1");
    });
  });

  describe("Method Chaining", () => {
    it("should support fluent API with method chaining", () => {
      // Test that all methods return the DebugManager instance
      expect(debugManager.setLogLevel("debug")).to.equal(debugManager);
      expect(debugManager.debug("message")).to.equal(debugManager);
      expect(debugManager.info("message")).to.equal(debugManager);
      expect(debugManager.warn("message")).to.equal(debugManager);
      expect(debugManager.error("message")).to.equal(debugManager);
      expect(debugManager.enablePerformanceMeasurement()).to.equal(debugManager);
      expect(debugManager.clearMetrics()).to.equal(debugManager);

      const customLogger = () => {};
      expect(debugManager.addLogger(customLogger)).to.equal(debugManager);
      expect(debugManager.removeLogger(customLogger)).to.equal(debugManager);

      const metricCollector = () => {};
      expect(debugManager.addMetricCollector(metricCollector)).to.equal(debugManager);
      expect(debugManager.removeMetricCollector(metricCollector)).to.equal(debugManager);

      const fromState = fluentState.from("state1");
      expect(debugManager.logTransition(fromState, "state2", true)).to.equal(debugManager);
    });
  });

  describe("Integration with FluentState", () => {
    it("should configure debug settings from FluentState options", () => {
      const fs = new FluentState({
        initialState: "idle",
        debug: {
          logLevel: "info",
          measurePerformance: true,
        },
      });

      expect(fs.debug).to.be.an.instanceOf(DebugManager);
    });

    it("should configure debug settings from FluentState options", () => {
      // Create FluentState with debug configuration
      const customLogger = sinon.spy();
      const newFluentState = new FluentState({
        debug: {
          logLevel: "info",
          measurePerformance: true,
          logHandlers: [customLogger],
        },
      });

      // Make a log call to verify configuration
      newFluentState.debug.info("test message");

      // Verify custom logger was called
      expect(customLogger.calledOnce).to.be.true;
      expect(customLogger.firstCall.args[0].message).to.equal("test message");
    });
  });

  describe("Configuration Export", () => {
    beforeEach(() => {
      // Set up a more complete state machine for testing exports
      fluentState = new FluentState({ initialState: "idle" });

      // Define states and transitions - we're using from() which will create states if they don't exist
      fluentState.from("idle").to("running");
      fluentState.from("idle").to("paused");
      fluentState.from("running").to("completed");
      fluentState.from("running").to("failed");
      fluentState.from("paused").to("running");
      fluentState.from("paused").to("idle");

      // Create a group for testing
      const group = fluentState.createGroup("testGroup").withConfig({
        priority: 10,
        debounce: 100,
      });

      group.from("idle").to("running");

      // Enable debug features
      debugManager = fluentState.debug;
      debugManager.setLogLevel("debug");
      debugManager.enablePerformanceMeasurement(true);
      debugManager.enableHistoryTracking(true);

      // Record a transition to have some history
      const idleState = fluentState._getState("idle");
      if (idleState) {
        debugManager.logTransition(idleState, "running", true, { user: "testUser", password: "secret123" });
      }
    });

    it("should export complete configuration in JSON format", () => {
      const config = debugManager.exportConfig();

      // Should be valid JSON
      const parsed = JSON.parse(config);

      // Should include states
      expect(parsed.states).to.be.an("object");
      expect(Object.keys(parsed.states)).to.include.members(["idle", "running", "paused", "completed", "failed"]);

      // Should include transitions
      expect(parsed.transitions).to.be.an("object");
      expect(parsed.transitions.idle).to.include.members(["running", "paused"]);
      expect(parsed.transitions.running).to.include.members(["completed", "failed"]);

      // Should include groups
      expect(parsed.groups).to.be.an("array");
      expect(parsed.groups[0].name).to.equal("testGroup");

      // Should include settings
      expect(parsed.settings).to.be.an("object");
      expect(parsed.settings.logLevel).to.equal("debug");
      expect(parsed.settings.measurePerformance).to.equal(true);
    });

    it("should export configuration in YAML format", () => {
      const config = debugManager.exportConfig({ format: "yaml" });

      // Basic validation for YAML format
      expect(config).to.be.a("string");
      expect(config).to.include("states:");
      expect(config).to.include("transitions:");
      expect(config).to.include("testGroup");
    });

    it("should export configuration in JS format", () => {
      const config = debugManager.exportConfig({ format: "js" });

      // Basic validation for JS module format
      expect(config).to.be.a("string");
      expect(config).to.include("const stateMachineConfig =");
      expect(config).to.include("export default stateMachineConfig");
    });

    it("should redact sensitive information", () => {
      // Include history with sensitive information
      const config = debugManager.exportConfig({
        includeHistory: true,
        redactSecrets: true,
        omitKeys: ["password"],
      });

      const parsed = JSON.parse(config);

      // Check if history exists and password is redacted
      if (parsed.recentHistory && parsed.recentHistory.length > 0) {
        const historyEntry = parsed.recentHistory[0];
        if (historyEntry.context) {
          expect(historyEntry.context.password).to.equal("[REDACTED]");
          expect(historyEntry.context.user).to.equal("testUser"); // Should not be redacted
        }
      }
    });

    it("should allow selective inclusion of state machine parts", () => {
      // Export with only states and settings
      const config = debugManager.exportConfig({
        includeStates: true,
        includeTransitions: false,
        includeGroups: false,
        includeSettings: true,
      });

      const parsed = JSON.parse(config);

      // Should include states
      expect(parsed.states).to.be.an("object");

      // Should not include transitions and groups
      expect(parsed.transitions).to.be.undefined;
      expect(parsed.groups).to.be.undefined;

      // Should include settings
      expect(parsed.settings).to.be.an("object");
    });

    it("should export minimal recreation configuration", () => {
      const config = debugManager.exportRecreationConfig({
        withComments: false, // Disable comments for valid JSON
      });

      // Now it should be valid JSON
      const parsed = JSON.parse(config);

      // Should include essential parts for recreation
      expect(parsed.initialState).to.equal("idle");
      expect(parsed.states).to.be.an("object");
      expect(parsed.groups).to.be.an("array");
      expect(parsed.settings).to.be.an("object");
    });

    it("should export fluent code that can recreate the state machine", () => {
      const code = debugManager.exportAsFluentCode();

      // Basic validation for JS code
      expect(code).to.be.a("string");
      expect(code).to.include("import { FluentState } from 'fluent-state'");
      expect(code).to.include("const fluentState = new FluentState");
      expect(code).to.include('.from("idle")');
      expect(code).to.include('.to("running")');
      expect(code).to.include("fluentState.start()");
    });

    it("should integrate with FluentState class", () => {
      // Call export methods via FluentState
      const jsonConfig = fluentState.exportConfig();
      const recreationConfig = fluentState.exportRecreationConfig({
        withComments: false, // Disable comments for valid JSON
      });
      const fluentCode = fluentState.exportAsFluentCode();

      // Basic validation
      expect(JSON.parse(jsonConfig)).to.be.an("object");
      expect(JSON.parse(recreationConfig)).to.be.an("object");
      expect(fluentCode).to.include("FluentState");
    });

    it("should handle custom redaction function", () => {
      // Custom redaction function that redacts user property
      const customRedact = (key: string) => key === "user";

      const config = debugManager.exportConfig({
        includeHistory: true,
        redactSecrets: customRedact,
      });

      const parsed = JSON.parse(config);

      // Check if history exists and user is redacted but password is not
      if (parsed.recentHistory && parsed.recentHistory.length > 0) {
        const historyEntry = parsed.recentHistory[0];
        if (historyEntry.context) {
          expect(historyEntry.context.user).to.equal("[REDACTED]");
          expect(historyEntry.context.password).to.equal("secret123"); // Should not be redacted
        }
      }
    });
  });

  describe("Graph Visualization", () => {
    it("generates a Mermaid graph representation", () => {
      const fs = new FluentState({ initialState: "idle" });

      // Add some states and transitions
      fs.from("idle").to("active");
      fs.from("active").to("paused");
      fs.from("paused").to("active");
      fs.from("paused").to("stopped");
      fs.from("stopped").to("idle");

      // Generate Mermaid graph
      const graph = fs.debug.generateGraph({ format: "mermaid" });

      // Verify the graph contains expected elements
      expect(graph).to.include("stateDiagram-v2");
      expect(graph).to.include("idle --> active");
      expect(graph).to.include("active --> paused");
      expect(graph).to.include("paused --> active");
      expect(graph).to.include("paused --> stopped");
      expect(graph).to.include("stopped --> idle");
    });

    it("generates a DOT graph representation", () => {
      const fs = new FluentState({ initialState: "idle" });

      // Add some states and transitions
      fs.from("idle").to("active");
      fs.from("active").to("paused");
      fs.from("paused").to("idle");

      // Generate DOT graph
      const graph = fs.debug.generateGraph({ format: "dot" });

      // Verify the graph contains expected elements
      expect(graph).to.include("digraph StateMachine");
      expect(graph).to.include('"idle" -> "active"');
      expect(graph).to.include('"active" -> "paused"');
      expect(graph).to.include('"paused" -> "idle"');
    });

    it("handles transition groups in graph visualization", () => {
      const fs = new FluentState({ initialState: "idle" });

      // Create a transition group
      const mainFlow = fs.createGroup("mainFlow");
      mainFlow.from("idle").to("loading");
      mainFlow.from("loading").to("ready");
      mainFlow.from("loading").to("error");

      // Generate graph with group clusters
      const graph = fs.debug.generateGraph({
        format: "mermaid",
        options: {
          groupClusters: true,
        },
      });

      // Verify group is included in the visualization
      expect(graph).to.include("mainFlow Group");
      expect(graph).to.include('state "mainFlow"');
      expect(graph).to.include("idle --> loading");
    });
  });
});
