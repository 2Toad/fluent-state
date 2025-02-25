# Testing and Debugging Support

FluentState provides powerful tools for testing, debugging, and monitoring your state machines. This document covers the snapshot capabilities and performance metrics features that help you understand and optimize your state transitions.

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

## Best Practices

1. **Create snapshots at key points**: Take snapshots before and after significant operations to help with debugging.

2. **Monitor metrics in production**: Regularly check metrics to identify performance issues early.

3. **Reset metrics for accurate testing**: Reset metrics before running performance tests to get clean results.

4. **Use snapshots for regression testing**: Compare snapshots before and after code changes to ensure your state machine behaves consistently.

5. **Limit snapshot history in memory-constrained environments**: Adjust `maxSnapshots` based on your application's memory constraints.

## Example: Debugging a Complex Flow

Here's an example of how to use snapshots and metrics to debug a complex checkout flow:

```typescript
// Create a checkout flow group
const checkoutFlow = fluentState.createGroup('checkout');
// ... add transitions for browsing, cart, payment, confirmation, etc.

// Take a snapshot before starting the checkout process
const initialSnapshot = checkoutFlow.createSnapshot('initial-state');

// Run the checkout process
await checkoutFlow.transition('cart');
await checkoutFlow.transition('payment');
await checkoutFlow.transition('processing');

// If an error occurs, take another snapshot
if (fluentState.getCurrentState().name === 'error') {
  const errorSnapshot = checkoutFlow.createSnapshot('error-state');
  console.log('Error occurred. Comparing snapshots:');
  console.log('Initial state:', initialSnapshot.label, initialSnapshot);
  console.log('Error state:', errorSnapshot.label, errorSnapshot);
  
  // Check metrics for clues
  const metrics = checkoutFlow.getMetrics();
  console.log('Failed transitions:', metrics.failedTransitions);
  console.log('Average transition time:', metrics.averageTransitionTime);
}
```

By combining snapshots and metrics, you can gain deep insights into your state machine's behavior and quickly identify and fix issues. 