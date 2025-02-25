# State Manager

The State Manager is a core component of FluentState that handles state storage, updates, and notifications. It provides a flexible and efficient way to manage application state, with powerful features for optimizing performance and controlling state updates.

## Overview

The State Manager is responsible for:

1. **Storing state data**: Maintains the current state of your application
2. **Processing updates**: Handles state changes and notifies listeners
3. **Managing subscriptions**: Allows components to subscribe to state changes
4. **Optimizing performance**: Provides features to minimize unnecessary updates and computations

## Basic Usage

### Creating a State Manager

The State Manager is typically created automatically when you instantiate a FluentState machine, but you can also access it directly:

```typescript
import { FluentState } from 'fluent-state';

// Create a FluentState instance
const fs = new FluentState({
  initialState: 'idle'
});

// Access the state manager through the state object
const state = fs.state;
const stateManager = state.stateManager;
```

### Managing State

```typescript
// Get the current state
const currentState = stateManager.getState();

// Update the state
stateManager.setState({ count: 1 });

// Subscribe to state changes
const unsubscribe = stateManager.subscribe((state) => {
  console.log('State updated:', state);
});

// Later, unsubscribe when no longer needed
unsubscribe();
```

### Deriving Values from State

```typescript
// Derive a value from state
const doubleCount = stateManager.derive(
  'doubleCount',
  (state) => state.count * 2,
  ['count'] // Dependencies
);

// The derived value will update when dependencies change
stateManager.setState({ count: 5 });
console.log(stateManager.derive('doubleCount', state => state.count * 2, ['count'])); // 10
```

### Accessing State in Transitions

When using FluentState's state machine, you can access the state context in transition conditions:

```typescript
fs.from('idle')
  .to('active', {
    condition: (_, context) => context.count > 0
  });

// Update the context to trigger the transition
state.context.count = 5;
```

## Performance Optimizations

FluentState provides several performance optimization features to help you build efficient state management solutions for your applications. These optimizations are designed to reduce unnecessary computations, minimize memory usage, and improve overall application performance.

## Configuration

Performance optimizations can be configured when creating a new FluentState instance:

```typescript
import { FluentState } from 'fluent-state';

const fs = new FluentState({
  initialState: 'idle',
  stateManagerConfig: {
    // Performance optimization options
    batchUpdates: true,
    batchTimeWindow: 50, // milliseconds
    enableMemoization: true,
    areEqual: customEqualityFunction,
    metrics: {
      enabled: true,
      measureUpdates: true,
      measureMemory: true,
      measureComputations: true,
      onMetrics: (metrics) => console.log('State Manager Metrics:', metrics)
    }
  }
});
```

You can also configure the state manager outside of the `FluenState` constructor via the `configureStateManager` method:

```typescript
import { FluentState, fluentState } from 'fluent-state';

// For a new instance
const fs = new FluentState();
fs.configureStateManager({
  batchUpdates: true,
  batchTimeWindow: 50,
  enableMemoization: true
});

// Or for the default instance
fluentState.configureStateManager({
  batchUpdates: true,
  batchTimeWindow: 50,
  enableMemoization: true
});
```

This method is particularly useful when working with the default instance, as it allows you to configure the state manager without creating a new instance. It also supports method chaining:

```typescript
fluentState
  .configureStateManager({
    batchUpdates: true,
    enableMemoization: true
  })
  .from('idle')
  .to('running');
```

## Batched Updates

Batched updates allow multiple state changes to be processed together in a single update cycle, reducing the number of renders and computations triggered by state changes.

### How It Works

When batching is enabled, state updates are collected within a specified time window and then processed together as a single update. This is particularly useful for scenarios where multiple state properties are updated in quick succession.

### Configuration Options

- `batchUpdates`: Boolean flag to enable/disable update batching (default: `false`)
- `batchTimeWindow`: Time window in milliseconds for batching updates (default: `50`)

### Example

```typescript
// Enable batched updates with a 50ms window
const fs = new FluentState({
  initialState: 'idle',
  stateManagerConfig: {
    batchUpdates: true,
    batchTimeWindow: 50
  }
});

// These updates will be batched together
state.context.count = 1;
state.context.name = 'test';
state.context.count = 2;

// After 50ms, a single update will be processed with the final state:
// { count: 2, name: 'test' }
```

## Memoization Support

Memoization caches the results of expensive computations based on their dependencies, preventing unnecessary recalculations when the dependencies haven't changed.

### How It Works

When memoization is enabled, derived values are cached and only recomputed when their dependencies change. This is particularly useful for complex calculations or transformations that depend on specific parts of the state.

### Configuration Options

- `enableMemoization`: Boolean flag to enable/disable memoization (default: `false`)

### API

- `derive(key, deriveFn, dependencies)`: Computes and potentially caches a derived value
- `clearMemoizedValues()`: Clears all memoized values
- `clearMemoizedKeys(keys)`: Clears specific memoized values by key

### Example

```typescript
// Enable memoization
const fs = new FluentState({
  initialState: 'idle',
  stateManagerConfig: {
    enableMemoization: true
  }
});

const state = fs.state;
const stateManager = state.stateManager;

// Set initial state
state.context.count = 5;

// Define a derived value with dependencies
const doubleCount = stateManager.derive(
  'doubleCount',
  (state) => state.count * 2,
  ['count']
);
console.log(doubleCount); // 10

// This won't recompute since count hasn't changed
const cachedDoubleCount = stateManager.derive(
  'doubleCount',
  (state) => state.count * 2,
  ['count']
);
console.log(cachedDoubleCount); // 10 (from cache)

// Update a dependency
state.context.count = 10;

// This will recompute since count changed
const updatedDoubleCount = stateManager.derive(
  'doubleCount',
  (state) => state.count * 2,
  ['count']
);
console.log(updatedDoubleCount); // 20 (recomputed)

// Clear specific memoized values
stateManager.clearMemoizedKeys(['doubleCount']);

// Clear all memoized values
stateManager.clearMemoizedValues();
```

## Custom Equality Checking

Custom equality checking allows you to define how state changes are detected, providing fine-grained control over when updates are processed and listeners are notified.

### How It Works

By default, FluentState uses shallow equality to determine if the state has changed. With custom equality checking, you can provide your own function to determine when states should be considered equal, which can prevent unnecessary updates for complex state structures.

### Configuration Options

- `areEqual`: Custom function to compare previous and next state (default: shallow equality)

### Example

```typescript
// Define a custom equality function
const customEqualityFn = (prevState, nextState) => {
  // Only consider the count property for equality
  return prevState.count === nextState.count;
};

// Use custom equality checking
const fs = new FluentState({
  initialState: 'idle',
  stateManagerConfig: {
    areEqual: customEqualityFn
  }
});

const state = fs.state;

// These updates won't trigger listeners since count hasn't changed
state.context.name = 'test';
state.context.active = true;

// This update will trigger listeners since count changed
state.context.count = 10;
```

### Deep Equality Example

```typescript
// Deep equality function for nested objects
const deepEqual = (prev, next) => {
  return JSON.stringify(prev) === JSON.stringify(next);
};

const fs = new FluentState({
  initialState: 'idle',
  stateManagerConfig: {
    areEqual: deepEqual
  }
});

// This approach works well for nested objects
state.context.user = { profile: { name: 'John', age: 30 } };

// This won't trigger an update since the objects are deeply equal
state.context.user = { profile: { name: 'John', age: 30 } };

// This will trigger an update since a nested property changed
state.context.user = { profile: { name: 'Jane', age: 30 } };
```

## Performance Metrics

Performance metrics provide insights into how your state manager is performing, helping you identify bottlenecks and optimize your application.

### How It Works

When metrics are enabled, the state manager collects data about updates, memory usage, and computation times. These metrics can be accessed through a callback function.

### Configuration Options

- `metrics.enabled`: Boolean flag to enable/disable metrics collection (default: `false`)
- `metrics.measureUpdates`: Track update frequency and duration (default: `true`)
- `metrics.measureMemory`: Track memory usage (default: `true`)
- `metrics.measureComputations`: Track computation times (default: `true`)
- `metrics.onMetrics`: Callback function to receive metrics data

### Metrics Data Structure

```typescript
interface StateManagerMetrics {
  // Update metrics
  updateFrequency?: number;  // Updates per second
  updateDuration?: number;   // Average update duration in ms
  updateCount?: number;      // Total number of updates

  // Memory usage metrics
  memoryUsage?: {
    stateSize: number;       // Approximate size of state in bytes
    memoizedSize: number;    // Approximate size of memoized values in bytes
  };

  // Computation timing metrics
  computationDuration?: {
    equality: number;        // Time spent in equality checks
    memoization: number;     // Time spent in memoization
    derivations: number;     // Time spent computing derived values
  };
}
```

### Example

```typescript
// Enable metrics collection
const fs = new FluentState({
  initialState: 'idle',
  stateManagerConfig: {
    metrics: {
      enabled: true,
      measureUpdates: true,
      measureMemory: true,
      measureComputations: true,
      onMetrics: (metrics) => {
        console.log('Update frequency:', metrics.updateFrequency, 'updates/sec');
        console.log('Average update duration:', metrics.updateDuration, 'ms');
        console.log('State size:', metrics.memoryUsage?.stateSize, 'bytes');
        console.log('Derivation time:', metrics.computationDuration?.derivations, 'ms');
      }
    }
  }
});
```

## Usage Examples

### Optimizing a Shopping Cart

```typescript
// Create a state machine with all optimizations enabled
const cart = new FluentState({
  initialState: 'shopping',
  stateManagerConfig: {
    batchUpdates: true,
    enableMemoization: true,
    areEqual: (prev, next) => {
      // Custom equality that only triggers updates when cart items or total change
      return prev.items?.length === next.items?.length && 
             prev.total === next.total;
    },
    metrics: {
      enabled: true,
      onMetrics: (metrics) => console.log('Cart Metrics:', metrics)
    }
  }
});

const state = cart.state;
const stateManager = state.stateManager;

// Add items to cart (these will be batched)
state.context.items = [...(state.context.items || []), { id: 1, name: 'Product 1', price: 10 }];
state.context.items = [...state.context.items, { id: 2, name: 'Product 2', price: 20 }];

// Derive the total price (memoized)
const totalPrice = stateManager.derive(
  'totalPrice',
  (state) => (state.items || []).reduce((sum, item) => sum + item.price, 0),
  ['items']
);

console.log('Total price:', totalPrice); // 30

// Derive a formatted cart summary (memoized)
const cartSummary = stateManager.derive(
  'cartSummary',
  (state) => {
    const count = (state.items || []).length;
    const total = (state.items || []).reduce((sum, item) => sum + item.price, 0);
    return `${count} items, total: $${total.toFixed(2)}`;
  },
  ['items']
);

console.log(cartSummary); // "2 items, total: $30.00"
```

### Real-time Data Dashboard

```typescript
// Create a state machine for a dashboard with frequent updates
const dashboard = new FluentState({
  initialState: 'active',
  stateManagerConfig: {
    batchUpdates: true,
    batchTimeWindow: 1000, // 1 second batching for real-time data
    enableMemoization: true
  }
});

const state = dashboard.state;
const stateManager = state.stateManager;

// Simulate real-time data updates
setInterval(() => {
  state.context.temperature = 20 + Math.random() * 10;
  state.context.humidity = 30 + Math.random() * 20;
  state.context.pressure = 1000 + Math.random() * 50;
  state.context.timestamp = Date.now();
}, 100);

// Derive status indicators (memoized)
setInterval(() => {
  const tempStatus = stateManager.derive(
    'temperatureStatus',
    (state) => state.temperature > 25 ? 'high' : 'normal',
    ['temperature']
  );
  
  const humidityStatus = stateManager.derive(
    'humidityStatus',
    (state) => state.humidity > 40 ? 'high' : 'normal',
    ['humidity']
  );
  
  console.log(`Temperature: ${state.context.temperature.toFixed(1)}°C (${tempStatus})`);
  console.log(`Humidity: ${state.context.humidity.toFixed(1)}% (${humidityStatus})`);
}, 1000);
```

## Best Practices

1. **Enable batching for frequent updates**: Use batched updates when multiple state properties are updated in quick succession.

2. **Use memoization for expensive computations**: Memoize derived values that require significant computation or are used frequently.

3. **Choose appropriate equality functions**: Use custom equality functions that match your application's needs - shallow equality for simple states, deep equality for nested objects.

4. **Monitor performance with metrics**: Enable metrics during development to identify bottlenecks and optimize your state management.

5. **Clear memoized values when needed**: Use `clearMemoizedKeys` or `clearMemoizedValues` to free up memory when cached values are no longer needed.

6. **Specify precise dependencies**: When using `derive()`, specify only the exact state properties that the derivation depends on for optimal memoization. 