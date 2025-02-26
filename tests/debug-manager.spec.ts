import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState } from "../src/fluent-state";
import { DebugManager } from "../src/debug-manager";
import { LogLevel, LogEntry, PerformanceMetric } from "../src/types";
import { suppressConsole } from "./helpers/console-suppressor";

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
    it("should be initialized with FluentState instance", () => {
      const newFluentState = new FluentState();
      expect(newFluentState.debug).to.be.instanceOf(DebugManager);
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
});
