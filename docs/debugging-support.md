# Testing and Debugging Support

FluentState provides powerful tools for testing, debugging, and monitoring your state machines. This document covers the snapshot capabilities, performance metrics features, and history tracking that help you understand and optimize your state transitions.

## Snapshots

Snapshots allow you to capture the state of a transition group at a specific point in time. This is useful for debugging, testing, and auditing purposes.

### Creating Snapshots

You can create a snapshot of a transition group using the `createSnapshot()` method:

```typescript
const mainGroup = fluentState.createGroup('mainGroup');
// ... add transitions, configure the group, etc.

// Create a snapshot
const snapshot = mainGroup.createSnapshot();

// Create a labeled snapshot for easier identification
const errorSnapshot = mainGroup.createSnapshot('error-state');
```

The snapshot contains information about the group's configuration, transitions, and current state:

```typescript
{
  name: "mainGroup",
  namespace: undefined,
  label: "error-state", // Optional label to identify this snapshot
  enabled: true,
  preventManualTransitions: false,
  config: {
    priority: 1,
    debounce: 300,
    retryConfig: {
      maxAttempts: 3,
      delay: 1000
    }
  },
  transitions: [
    { from: "idle", to: "loading", tags: ["start"] },
    { from: "loading", to: "success", tags: ["complete", "happy-path"] },
    { from: "loading", to: "error", tags: ["complete", "error-path"] },
    { from: "error", to: "idle", tags: ["reset"] }
  ],
  timestamp: 1621234567890,
  parentGroup: "parentGroup",
  childGroups: ["childGroup1", "childGroup2"]
}
```

### Managing Snapshots

FluentState maintains a history of snapshots for each group. By default, it keeps the 10 most recent snapshots, but you can change this limit:

```typescript
// Set the maximum number of snapshots to keep
mainGroup.setMaxSnapshots(5);
```

You can retrieve all snapshots for a group:

```typescript
const snapshots = mainGroup.getSnapshots();
```

And you can clear all snapshots when needed:

```typescript
mainGroup.clearSnapshots();
```

### Using Snapshots for Testing

Snapshots are particularly useful for testing. You can verify that your transition group is configured correctly and that transitions are defined as expected:

```typescript
// In your test
const snapshot = authGroup.createSnapshot();

// Verify group configuration
expect(snapshot.name).to.equal("authGroup");
expect(snapshot.enabled).to.be.true;

// Verify transitions
const loginToAuth = snapshot.transitions.find(t => 
  t.from === "loggedOut" && t.to === "authenticating");
expect(loginToAuth).to.exist;
expect(loginToAuth.tags).to.include("auth-flow");
```

## Performance Metrics

FluentState automatically collects metrics on transition performance and frequency. These metrics help you identify bottlenecks, optimize your state machine, and understand usage patterns.

### Accessing Metrics

You can access the metrics for a transition group using the `getMetrics()` method:

```typescript
const metrics = mainGroup.getMetrics();
```

The metrics object contains information about transition attempts, success rates, timing, and frequency:

```typescript
{
  name: "mainGroup",
  namespace: undefined,
  transitionAttempts: 10,
  successfulTransitions: 8,
  failedTransitions: 2,
  averageTransitionTime: 45.5, // in milliseconds
  mostFrequentTransition: {
    from: "idle",
    to: "loading",
    count: 5
  },
  transitionFrequency: {
    "idle": {
      "loading": 5
    },
    "loading": {
      "success": 3,
      "error": 2
    }
  },
  collectionStartTime: 1621234567890,
  lastUpdated: 1621234599999
}
```

### Resetting Metrics

You can reset the metrics for a group when needed:

```typescript
mainGroup.resetMetrics();
```

This is useful when you want to start collecting fresh metrics after a specific event or when testing different scenarios.

### Using Metrics for Optimization

Metrics can help you identify performance issues and optimize your state machine:

1. **Identify slow transitions**: Look at `averageTransitionTime` to find transitions that take longer than expected.

2. **Monitor success rates**: Compare `successfulTransitions` and `failedTransitions` to ensure your state machine is working reliably.

3. **Analyze usage patterns**: Use `transitionFrequency` and `mostFrequentTransition` to understand how your state machine is being used and optimize the most common paths.

4. **Detect bottlenecks**: If certain transitions have high failure rates or long execution times, you may need to optimize their conditions or add retry configurations.

## Debug Manager History Tracking

The DebugManager provides advanced history tracking capabilities that extend beyond the basic transition history. This feature allows you to track, query, and analyze transitions with more sophisticated filtering and statistics.

### Enabling History Tracking

You can enable history tracking through the DebugManager even if you haven't enabled it in the FluentState instance:

```typescript
// Enable history tracking in the debug manager
fluentState.debug.enableHistoryTracking(true);

// Configure history options
fluentState.debug.configureHistory({
  maxSize: 100,
  includeContext: true
});
```

If history is already enabled in the FluentState instance, the DebugManager will use that history instance instead of creating its own.

### Querying Transitions

The DebugManager provides powerful querying capabilities for transition history:

```typescript
// Query transitions by state
const loadingTransitions = fluentState.debug.queryTransitions({
  state: "loading"
});

// Query transitions by source state
const fromLoadingTransitions = fluentState.debug.queryTransitions({
  state: "loading",
  asSource: true,
  asTarget: false
});

// Query successful transitions
const successfulTransitions = fluentState.debug.queryTransitions({
  successful: true
});

// Query by context data
const userTransitions = fluentState.debug.queryTransitions({
  contextFilter: ctx => ctx !== undefined && (ctx as any)?.userId === "user123"
});

// Query by time range
const recentTransitions = fluentState.debug.queryTransitions({
  fromTimestamp: Date.now() - 60000, // Last minute
  toTimestamp: Date.now()
});

// Combine multiple filters
const complexQuery = fluentState.debug.queryTransitions({
  state: "loading",
  asSource: true,
  successful: true,
  contextFilter: ctx => ctx !== undefined && (ctx as any)?.userId === "user123",
  limit: 10
});
```

### History Statistics

The DebugManager can generate statistics about your transition history:

```typescript
const stats = fluentState.debug.getHistoryStats();

console.log(`Total transitions: ${stats.totalTransitions}`);
console.log(`Successful transitions: ${stats.successfulTransitions}`);
console.log(`Failed transitions: ${stats.failedTransitions}`);

// Most frequent states
console.log("Most frequent states:");
stats.mostFrequentStates.forEach(([state, count]) => {
  console.log(`${state}: ${count} occurrences`);
});

// Most frequent transitions
console.log("Most frequent transitions:");
stats.mostFrequentTransitions.forEach(([transition, count]) => {
  console.log(`${transition.from} -> ${transition.to}: ${count} occurrences`);
});

// Transitions per minute
console.log(`Average transitions per minute: ${stats.avgTransitionsPerMinute}`);
```

### Exporting and Importing History

You can export and import history data for persistence or analysis:

```typescript
// Export history to JSON
const historyJson = fluentState.debug.exportHistory();
localStorage.setItem('debugHistory', historyJson);

// Export with custom options
const filteredJson = fluentState.debug.exportHistory({
  includeContext: false,
  filter: entry => entry.success === true
});

// Import history
const savedHistory = localStorage.getItem('debugHistory');
if (savedHistory) {
  fluentState.debug.importHistory(savedHistory);
}

// Import and append to existing history
fluentState.debug.importHistory(newHistoryJson, { append: true });

// Clear history
fluentState.debug.clearHistory();
```

## Configuration Export

The Configuration Export feature allows you to serialize your entire state machine configuration, making it easy to save, share, or recreate your state machine in different environments. This is particularly useful for debugging, testing, and backup purposes.

### Exporting Complete Configuration

You can export the complete configuration of your state machine in various formats:

```typescript
// Export in JSON format (default)
const jsonConfig = fluentState.exportConfig();

// Export in YAML format for human readability
const yamlConfig = fluentState.exportConfig({ format: 'yaml' });

// Export as JavaScript code
const jsConfig = fluentState.exportConfig({ format: 'js' });
```

The exported configuration includes:
- All states
- All transitions
- All transition groups with their configurations
- Debug settings
- History settings (if enabled)

### Customizing the Export

You can customize what gets included in the export:

```typescript
// Selective export
const customConfig = fluentState.exportConfig({
  format: 'json',
  indent: 2,
  includeStates: true,
  includeTransitions: true,
  includeGroups: true,
  includeSettings: true,
  includeHistory: false,
  pretty: true
});
```

### Securing Sensitive Data

The export feature includes built-in security to protect sensitive information:

```typescript
// Redact sensitive information
const secureConfig = fluentState.exportConfig({
  redactSecrets: true,
  omitKeys: ['password', 'token', 'secret']
});

// Use custom redaction function
const customRedacted = fluentState.exportConfig({
  redactSecrets: (key, value) => {
    // Redact any key containing 'user' or 'account'
    return key.includes('user') || key.includes('account');
  }
});
```

### Exporting for Recreation

If you need a minimal configuration that can recreate your state machine, use the `exportRecreationConfig` method:

```typescript
// Export minimal config needed for recreation
const recreationConfig = fluentState.exportRecreationConfig();

// Export without comments for valid JSON parsing
const parsableConfig = fluentState.exportRecreationConfig({
  withComments: false
});

// Later, recreate the state machine
const savedConfig = JSON.parse(parsableConfig);
const newFluentState = new FluentState(savedConfig);
```

### Generating FluentState Code

For the most straightforward recreation, you can generate FluentState code:

```typescript
// Export as FluentState initialization code
const fluentCode = fluentState.exportAsFluentCode();

// Customize the code generation
const customFluentCode = fluentState.exportAsFluentCode({
  includeImports: true,
  variableName: 'myStateMachine',
  withComments: true,
  indent: 2
});

// The result is executable JavaScript/TypeScript code
// Example output:
/*
import { FluentState } from 'fluent-state';

const myStateMachine = new FluentState({
  initialState: 'idle'
});

// Define states and transitions
myStateMachine.from('idle').to('running');
myStateMachine.from('running').to('completed');
myStateMachine.from('running').to('failed');

// Create groups
const mainGroup = myStateMachine.createGroup('mainGroup')
  .withConfig({ priority: 10 });
mainGroup.from('idle').to('running');

// Start the state machine
myStateMachine.start();
*/
```

## Warning System

The Warning System helps identify potential issues in your state machine configuration, such as unreachable states, dead-end states, or conflicting transitions. This validation system ensures the structural integrity and usability of your state machines.

### Automatic Validation

You can enable automatic validation when creating a FluentState instance:

```typescript
const machine = new FluentState({
  initialState: 'idle',
  debug: {
    logLevel: 'warn',
    autoValidate: true,
    validateOptions: {
      severity: 'warn',
      types: ['unreachable-state', 'dead-end-state', 'circular-transition']
    }
  }
});
```

When `autoValidate` is enabled, the Warning System will:
- Perform an initial validation when the state machine is created
- Validate when new states are added
- Validate after transitions occur

### Manual Validation

You can also manually trigger validation:

```typescript
// Validate and get all warnings
const warnings = fluentState.debug.validateStateMachine();

// Validate with custom options
const criticalWarnings = fluentState.debug.validateStateMachine({
  severity: 'error',
  types: ['unreachable-state', 'circular-transition']
});
```

### Warning Types

The Warning System can detect various types of issues:

1. **Unreachable States**: States that cannot be reached from the initial state
   ```typescript
   // This state cannot be reached from any other state
   fluentState.from('orphaned-state');
   ```

2. **Dead-End States**: States with no outgoing transitions
   ```typescript
   // This state has no way to exit
   fluentState.from('dead-end');
   ```

3. **Circular Transitions**: Groups of states that form a closed loop with no exit
   ```typescript
   // This creates a circular transition with no exit
   fluentState.from('state1').to('state2');
   fluentState.from('state2').to('state3');
   fluentState.from('state3').to('state1');
   ```

4. **Redundant Transitions**: Multiple identical transitions between the same states
   ```typescript
   // This creates redundant transitions
   fluentState.from('idle').to('loading');
   fluentState.from('idle').to('loading'); // Redundant
   ```

5. **Conflicting Transitions**: The same transition defined in multiple groups
   ```typescript
   const group1 = fluentState.createGroup('group1');
   group1.from('idle').to('loading');
   
   const group2 = fluentState.createGroup('group2');
   group2.from('idle').to('loading'); // Conflicting
   ```

6. **Unused Groups**: Transition groups with no transitions defined
   ```typescript
   // This creates an unused group
   const unusedGroup = fluentState.createGroup('unused');
   ```

7. **Overlapping Conditions**: Multiple auto-transitions with potentially overlapping conditions
   ```typescript
   // These conditions might overlap
   fluentState.from('reviewing')
     .to<Document>('approved', {
       condition: (_, doc) => doc.score > 70
     })
     .to<Document>('rejected', {
       condition: (_, doc) => doc.score < 80 // Overlaps with the condition above
     });
   ```

### Filtering Warnings

You can filter warnings by severity and type:

```typescript
// Get only warnings with 'error' severity
const errorWarnings = fluentState.debug.validateStateMachine({
  severity: 'error'
});

// Get only specific types of warnings
const specificWarnings = fluentState.debug.validateStateMachine({
  types: ['unreachable-state', 'dead-end-state']
});
```

### Warning Structure

Each warning includes detailed information about the issue:

```typescript
{
  type: 'unreachable-state',
  description: 'State "orphaned" is unreachable from the initial state "idle"',
  severity: 'warn',
  states: ['orphaned'],
  transitions: [] // Only included for certain warning types
}
```

## Best Practices

1. **Create snapshots at key points**: Take snapshots before and after significant operations to help with debugging.

2. **Monitor metrics in production**: Regularly check metrics to identify performance issues early.

3. **Reset metrics for accurate testing**: Reset metrics before running performance tests to get clean results.

4. **Use snapshots for regression testing**: Compare snapshots before and after code changes to ensure your state machine behaves consistently.

5. **Limit snapshot history in memory-constrained environments**: Adjust `maxSnapshots` based on your application's memory constraints.

6. **Enable history tracking for critical flows**: Use the DebugManager's history tracking for important user flows to help diagnose issues.

7. **Export history data for offline analysis**: Regularly export history data for long-term analysis and pattern recognition.

8. **Use context filtering for sensitive data**: Configure context filters to remove sensitive information before storing or exporting history.

9. **Export state machine configurations for backups**: Regularly export your state machine configuration to enable restoration if needed.

10. **Use YAML format for human readability**: When sharing configurations with team members, the YAML format is more readable than JSON.

11. **Always use withComments: false when planning to parse**: If you need to programmatically process exported configurations, ensure the JSON is valid by setting `withComments: false`.

12. **Include redaction for sensitive data**: Always use the redaction capabilities when exporting configurations that contain sensitive information.

13. **Generate FluentState code for documentation**: The `exportAsFluentCode` method generates readable code that serves as great documentation for your state machine structure.

## Example: Debugging a Complex Flow

Here's an example of how to use snapshots, metrics, history tracking, and configuration export to debug a complex checkout flow:

```typescript
// Create a checkout flow group
const checkoutFlow = fluentState.createGroup('checkout');
// ... add transitions for browsing, cart, payment, confirmation, etc.

// Enable history tracking
fluentState.debug.enableHistoryTracking(true);

// Take a snapshot before starting the checkout process
const initialSnapshot = checkoutFlow.createSnapshot('initial-state');

// Export the initial configuration for comparison later
const initialConfig = fluentState.exportConfig({
  format: 'yaml',
  redactSecrets: true,
  omitKeys: ['password', 'cardNumber']
});
localStorage.setItem('checkoutInitialConfig', initialConfig);

// Run the checkout process
await checkoutFlow.transition('cart');
await checkoutFlow.transition('payment');
await checkoutFlow.transition('processing');

// If an error occurs, take another snapshot and analyze history
if (fluentState.getCurrentState().name === 'error') {
  const errorSnapshot = checkoutFlow.createSnapshot('error-state');
  console.log('Error occurred. Comparing snapshots:');
  console.log('Initial state:', initialSnapshot.label, initialSnapshot);
  console.log('Error state:', errorSnapshot.label, errorSnapshot);
  
  // Check metrics for clues
  const metrics = checkoutFlow.getMetrics();
  console.log('Failed transitions:', metrics.failedTransitions);
  console.log('Average transition time:', metrics.averageTransitionTime);
  
  // Analyze transition history
  const paymentTransitions = fluentState.debug.queryTransitions({
    state: 'payment',
    asSource: true
  });
  
  console.log('Payment transitions:', paymentTransitions);
  
  // Export history for further analysis
  const historyJson = fluentState.debug.exportHistory();
  localStorage.setItem('checkoutErrorHistory', historyJson);
  
  // Export the current configuration for comparison
  const errorConfig = fluentState.exportConfig({
    format: 'yaml',
    redactSecrets: true,
    omitKeys: ['password', 'cardNumber'],
    includeHistory: true
  });
  localStorage.setItem('checkoutErrorConfig', errorConfig);
  
  // Generate code for a minimal reproduction
  const reproductionCode = fluentState.exportAsFluentCode({
    includeImports: true,
    withComments: true
  });
  console.log('Reproduction code:', reproductionCode);
}
```

By combining snapshots, metrics, history tracking, and configuration export, you can gain deep insights into your state machine's behavior and quickly identify and fix issues. The exported configuration and generated code make it easy to share and reproduce the issue with your team. 