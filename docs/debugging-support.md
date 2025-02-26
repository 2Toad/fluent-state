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

## Best Practices

1. **Create snapshots at key points**: Take snapshots before and after significant operations to help with debugging.

2. **Monitor metrics in production**: Regularly check metrics to identify performance issues early.

3. **Reset metrics for accurate testing**: Reset metrics before running performance tests to get clean results.

4. **Use snapshots for regression testing**: Compare snapshots before and after code changes to ensure your state machine behaves consistently.

5. **Limit snapshot history in memory-constrained environments**: Adjust `maxSnapshots` based on your application's memory constraints.

6. **Enable history tracking for critical flows**: Use the DebugManager's history tracking for important user flows to help diagnose issues.

7. **Export history data for offline analysis**: Regularly export history data for long-term analysis and pattern recognition.

8. **Use context filtering for sensitive data**: Configure context filters to remove sensitive information before storing or exporting history.

## Example: Debugging a Complex Flow

Here's an example of how to use snapshots, metrics, and history tracking to debug a complex checkout flow:

```typescript
// Create a checkout flow group
const checkoutFlow = fluentState.createGroup('checkout');
// ... add transitions for browsing, cart, payment, confirmation, etc.

// Enable history tracking
fluentState.debug.enableHistoryTracking(true);

// Take a snapshot before starting the checkout process
const initialSnapshot = checkoutFlow.createSnapshot('initial-state');

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
}
```

By combining snapshots, metrics, and history tracking, you can gain deep insights into your state machine's behavior and quickly identify and fix issues. 