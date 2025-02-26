# Logging and Monitoring in FluentState

This document details the logging and monitoring capabilities of FluentState.

## Overview

FluentState provides comprehensive logging and performance monitoring capabilities to help developers debug their state machines, track transitions, and identify performance bottlenecks. These features are designed to be:

- **Disabled by default** - No performance impact when not needed
- **Configurable** - Granular control over what gets logged
- **Extensible** - Support for custom loggers and formatters
- **Informative** - Detailed context about state machine operations

## Default Behavior

By default, logging is disabled (set to `'none'`) to ensure the library has minimal overhead in production environments. You must explicitly enable logging by setting the appropriate log level in the FluentState configuration.

## Configuration

Logging and monitoring can be configured when creating a FluentState instance:

```typescript
const machine = new FluentState({
  initialState: "idle",
  debug: {
    // Set log level (none, error, warn, info, debug)
    logLevel: "info",
    
    // Enable performance measurement
    measurePerformance: true,
    
    // Custom log formatter
    logFormat: (entry) => `[${entry.level}] ${entry.message}`,
    
    // Custom log handlers
    logHandlers: [myCustomLogger]
  }
});
```

Or after creation:

```typescript
// Set log level
machine.debug.setLogLevel("debug");

// Enable performance measurement
machine.debug.enablePerformanceMeasurement(true);

// Add a custom logger
machine.debug.addLogger(myCustomLogger);

// Set a custom log formatter
machine.debug.setLogFormatter(myFormatter);
```

## Log Levels

FluentState supports the following log levels, in order of increasing verbosity:

1. **`none`** - Logging is completely disabled
2. **`error`** - Only error messages are logged
3. **`warn`** - Errors and warnings are logged
4. **`info`** - Errors, warnings, and important information are logged
5. **`debug`** - All messages including detailed debugging information are logged

When a log level is set, all messages at that level and lower (less verbose) are logged. For example, setting the log level to `'info'` will log info, warn, and error messages, but not debug messages.

## What Gets Logged

Depending on the log level, the following information is logged:

### Error Level (`'error'`)
- Failed transitions
- Invalid state configurations
- Plugin errors
- Context update failures

### Warning Level (`'warn'`)
- Blocked transitions
- Deprecated API usage
- Non-critical configuration issues
- Group disabling that blocks transitions

### Info Level (`'info'`)
- Successful transitions
- State machine initialization
- Group creation and management
- History tracking operations

### Debug Level (`'debug'`)
- Transition evaluations (before they're executed)
- Context updates
- Performance metrics
- Middleware execution
- Detailed state changes

## Performance Metrics

When `measurePerformance` is enabled, FluentState collects timing information for various operations:

- **Transition Evaluation** - Time spent determining if a transition is valid
- **Condition Execution** - Time spent executing transition conditions
- **Context Updates** - Time spent updating the context before and after transitions

These metrics can be accessed programmatically:

```typescript
// Get all metrics for transition evaluations
const transitionMetrics = machine.debug.getMetrics("transitionEvaluation");

// Get average execution time for a specific transition
const avgTime = machine.debug.getAverageMetric("transitionEvaluation", "idle->loading");
```

## Custom Loggers

You can add custom loggers to process log entries in any way you need:

```typescript
// Add a custom logger that sends logs to a server
machine.debug.addLogger((entry) => {
  sendToAnalyticsServer({
    level: entry.level,
    message: entry.message,
    timestamp: entry.timestamp,
    data: entry.context
  });
});
```

Custom loggers receive a `LogEntry` object with the following properties:

```typescript
interface LogEntry {
  timestamp: number;  // Timestamp when the log was created
  level: LogLevel;    // Log level (error, warn, info, debug)
  message: string;    // The log message
  context?: unknown;  // Optional context data
}
```

## Log Formatting

The default log format includes a timestamp, log level, message, and context (if available):

```
[2023-04-15T12:34:56.789Z] [INFO] Transition: idle → loading | Context: {"userId":"123"}
```

You can customize this format by providing a formatter function:

```typescript
machine.debug.setLogFormatter((entry) => {
  return `${new Date(entry.timestamp).toISOString()} - ${entry.level.toUpperCase()}: ${entry.message}`;
});
```

## Examples

### Basic Logging

```typescript
// Enable info-level logging
const machine = new FluentState({
  initialState: "idle",
  debug: {
    logLevel: "info"
  }
});

// This will be logged at info level
machine.transition("loading");
```

### Detailed Debugging

```typescript
// Enable detailed debugging
machine.debug.setLogLevel("debug");

// Add a custom logger to save logs
const logs: LogEntry[] = [];
machine.debug.addLogger((entry) => logs.push(entry));

// This will generate multiple debug log entries
machine.transition("loading", { userId: "123" });

// Now you can analyze the logs
const contextLogs = logs.filter(log => log.context && JSON.stringify(log.context).includes("userId"));
```

### Performance Monitoring

```typescript
// Enable performance measurement
machine.debug.enablePerformanceMeasurement(true);

// Perform some operations
for (let i = 0; i < 100; i++) {
  machine.transition("loading");
  machine.transition("idle");
}

// Analyze performance
const metrics = machine.debug.getMetrics("transitionEvaluation");
console.log("Average transition time:", 
  Array.from(metrics.entries())
    .map(([key, times]) => ({
      transition: key,
      avgTime: times.reduce((sum, time) => sum + time, 0) / times.length
    }))
);
```

## Best Practices

1. **Use the appropriate log level**
   - Use `'error'` or `'warn'` in production
   - Use `'info'` or `'debug'` during development

2. **Disable logging in production**
   - Set `logLevel: 'none'` in production environments
   - Or conditionally configure based on environment: 
     ```typescript
     logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'none'
     ```

3. **Use custom loggers for persistence**
   - Console logs are ephemeral
   - Add custom loggers for important logs that need to be preserved

4. **Performance considerations**
   - Debug-level logging can impact performance
   - Consider using more selective logging in performance-critical applications
   - Use `measurePerformance` judiciously in production

## Conclusion

The logging and monitoring features in FluentState provide powerful debugging capabilities while maintaining flexibility and performance. By default, these features have no impact on performance as they're disabled, but when enabled, they offer deep insight into the state machine's behavior and performance characteristics. 