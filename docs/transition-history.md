# Transition History

The Transition History feature provides a way to track, query, and analyze state transitions in your FluentState state machine. This is particularly useful for debugging complex state flows, auditing state changes, implementing time travel debugging, and gathering analytics about your application's state behavior.

## Enabling Transition History

Transition history tracking is disabled by default. To enable it, call `fluentState.enableHistory()` or pass the `enableHistory` option when creating your FluentState instance:

```typescript
import { FluentState } from "@2toad/fluent-state";

// Create a state machine with history enabled
const fs = new FluentState({
  initialState: "idle",
  enableHistory: true
});
```

## Configuration Options

You can customize the behavior of the transition history with the following options:

```typescript
import { FluentState } from "@2toad/fluent-state";

const fs = new FluentState({
  initialState: "idle",
  enableHistory: true,
  historyOptions: {
    // Maximum number of entries to keep in history (default: 100)
    maxSize: 50,
    // Whether to include context data in history entries (default: true)
    includeContext: true
  }
});
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxSize` | number | 100 | Maximum number of transition entries to keep in history. When this limit is reached, the oldest entries are removed first. |
| `includeContext` | boolean | true | Whether to include context data in transition history entries. Disable this if your context contains sensitive information or large objects that would consume too much memory. |
| `contextFilter` | function | null | Optional function to filter sensitive data from context during serialization. This function should return a sanitized version of the context. |

## Transition History Entries

Each transition entry in the history contains the following information:

```typescript
interface TransitionHistoryEntry {
  // The source state name
  from: string;
  // The target state name
  to: string;
  // Timestamp when the transition occurred
  timestamp: number;
  // Context data at the time of transition (if includeContext is true)
  context: unknown;
  // Whether the transition was successful
  success: boolean;
}
```

## Accessing Transition History

Once you've enabled history tracking, you can access the history through the `history` property of your FluentState instance:

```typescript
// Get the most recent transition
const lastTransition = fs.history.getLastTransition();
console.log(`Last transition: ${lastTransition.from} -> ${lastTransition.to}`);

// Get all transitions involving a specific state
const runningTransitions = fs.history.getTransitionsForState("running");
console.log(`Running state was involved in ${runningTransitions.length} transitions`);

// Get all transition history entries
const allTransitions = fs.history.getAll();
```

## API Reference

### `TransitionHistory` Class

#### Methods

| Method | Description |
|--------|-------------|
| `getLastTransition()` | Returns the most recent transition entry, or `null` if history is empty. |
| `getTransitionsForState(stateName: string)` | Returns an array of transition entries involving the specified state (either as source or target). |
| `getAll()` | Returns an array of all transition history entries. |
| `clear()` | Clears all transition history. |
| `toJSON(options?: SerializationOptions)` | Converts the transition history to a JSON string. Accepts optional serialization options to override the default configuration. |
| `static fromJSON(json: string, options?: TransitionHistoryOptions)` | Creates a new TransitionHistory instance from a JSON string. |

### `SerializationOptions` Interface

| Property | Type | Description |
|----------|------|-------------|
| `contextFilter` | function | Function to filter sensitive data from context during serialization. This overrides the contextFilter set in TransitionHistoryOptions. |
| `includeContext` | boolean | Whether to include context data in the serialized output. This overrides the includeContext setting in TransitionHistoryOptions. |

## Examples

### Basic Usage

```typescript
import { FluentState } from "@2toad/fluent-state";

// Create a state machine with history enabled
const fs = new FluentState({
  initialState: "idle",
  enableHistory: true
});

// Define states and transitions
fs.from("idle").to("running");
fs.from("running").to("paused");
fs.from("paused").to("stopped");

// Start the state machine
await fs.start();

// Perform transitions
await fs.transition("running");
await fs.transition("paused");
await fs.transition("stopped");

// Get the transition history
const history = fs.history.getAll();
console.log(`Performed ${history.length} transitions`);

// Analyze transitions
history.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.from} -> ${entry.to} (${entry.success ? 'success' : 'failed'})`);
});
```

### Debugging Failed Transitions

```typescript
import { FluentState } from "@2toad/fluent-state";

const fs = new FluentState({
  initialState: "idle",
  enableHistory: true
});

// Define states and transitions
fs.from("idle").to("running");
fs.from("running").to("completed");

// Start the state machine
await fs.start();

// Attempt some transitions
await fs.transition("running");
await fs.transition("paused"); // This will fail as "paused" is not a valid transition from "running"

// Get failed transitions
const allTransitions = fs.history.getAll();
const failedTransitions = allTransitions.filter(entry => !entry.success);

console.log("Failed transitions:");
failedTransitions.forEach(entry => {
  console.log(`Attempted to transition from ${entry.from} to ${entry.to} at ${new Date(entry.timestamp).toLocaleString()}`);
  console.log(`Context at time of failure:`, entry.context);
});
```

### Time Travel Debugging

```typescript
import { FluentState } from "@2toad/fluent-state";

const fs = new FluentState({
  initialState: "idle",
  enableHistory: true
});

// Define states and transitions
fs.from("idle").to("running");
fs.from("running").to("paused");
fs.from("paused").to("running");
fs.from("running").to("completed");

// Start the state machine and perform transitions
await fs.start();
await fs.transition("running");
await fs.transition("paused");
await fs.transition("running");
await fs.transition("completed");

// Implement time travel by replaying transitions up to a certain point
function timeTravel(targetIndex: number) {
  const history = fs.history.getAll();
  
  // Reset to initial state
  fs.setState(history[history.length - 1].from);
  
  // Replay transitions up to the target index
  for (let i = history.length - 1; i >= targetIndex; i--) {
    const entry = history[i];
    console.log(`Replaying transition: ${entry.from} -> ${entry.to}`);
    fs.transition(entry.to);
  }
  
  console.log(`Time traveled to state: ${fs.state.name}`);
}

// Travel back to the second transition
timeTravel(1);
```

### Analytics and Monitoring

```typescript
import { FluentState } from "@2toad/fluent-state";

const fs = new FluentState({
  initialState: "idle",
  enableHistory: true
});

// Define states and transitions
fs.from("idle").to("running");
fs.from("running").to("paused");
fs.from("paused").to("running");
fs.from("running").to("completed");

// Start the state machine and perform transitions
await fs.start();

// Run the application for a while...

// Gather analytics
function generateStateAnalytics() {
  const history = fs.history.getAll();
  const stateVisits = new Map<string, number>();
  const stateTransitions = new Map<string, Map<string, number>>();
  
  // Count state visits and transitions
  history.forEach(entry => {
    if (entry.success) {
      // Count target state visits
      const visits = stateVisits.get(entry.to) || 0;
      stateVisits.set(entry.to, visits + 1);
      
      // Count transitions from->to
      const transitionKey = `${entry.from}->${entry.to}`;
      const transitions = stateTransitions.get(transitionKey) || new Map();
      const count = transitions.get(entry.to) || 0;
      transitions.set(entry.to, count + 1);
      stateTransitions.set(transitionKey, transitions);
    }
  });
  
  // Generate report
  console.log("State Machine Analytics:");
  console.log("----------------------");
  console.log("State Visits:");
  stateVisits.forEach((count, state) => {
    console.log(`${state}: ${count} visits`);
  });
  
  console.log("\nTransition Frequencies:");
  stateTransitions.forEach((transitions, fromState) => {
    transitions.forEach((count, toState) => {
      console.log(`${fromState} -> ${toState}: ${count} times`);
    });
  });
}

generateStateAnalytics();
```

### Serialization and Context Filtering

```typescript
import { FluentState } from "@2toad/fluent-state";

// Create a state machine with history enabled and context filtering
const fs = new FluentState({
  initialState: "idle",
  enableHistory: true,
  historyOptions: {
    includeContext: true,
    contextFilter: (context: any) => {
      if (!context) return context;
      // Create a filtered copy without sensitive data
      const filtered = { ...context };
      if (filtered.user) {
        // Remove sensitive user data but keep id
        filtered.user = { id: filtered.user.id };
      }
      return filtered;
    }
  }
});

// Define states and transitions
fs.from("idle").to("running");
fs.from("running").to("completed");

// Start the state machine
await fs.start();

// Update context with sensitive data
fs.state.updateContext({
  status: "ready",
  user: { 
    id: 123, 
    name: "Test User", 
    email: "test@example.com", 
    password: "secret" 
  }
});

// Perform transitions
await fs.transition("running");
await fs.transition("completed");

// Serialize the history with default options (using the configured contextFilter)
const json = fs.history.toJSON();
console.log(JSON.parse(json));
// Output will include filtered context: { status: "ready", user: { id: 123 } }

// Serialize with custom options to override the default filter
const customJson = fs.history.toJSON({
  contextFilter: (context: any) => {
    if (!context) return context;
    return { status: context.status }; // Only include status
  }
});
console.log(JSON.parse(customJson));
// Output will include only status: { status: "ready" }

// Serialize without any context
const noContextJson = fs.history.toJSON({ includeContext: false });
console.log(JSON.parse(noContextJson));
// Output will not include any context data

// Import serialized history into a new instance
const importedHistory = TransitionHistory.fromJSON(json);
console.log(importedHistory.getAll());
```

### Handling Invalid JSON

```typescript
import { TransitionHistory } from "@2toad/fluent-state";

// Try to import invalid JSON
try {
  const importedHistory = TransitionHistory.fromJSON("invalid json");
  
  // This will be an empty history instance
  console.log(`Imported history has ${importedHistory.getAll().length} entries`);
} catch (error) {
  // The fromJSON method handles errors internally, so this catch block won't execute
  console.error("This won't be reached:", error);
}
```

## Best Practices

1. **Memory Management**: For long-running applications, consider setting a reasonable `maxSize` to prevent excessive memory usage.

2. **Context Data**: If your context contains large objects or sensitive information, set `includeContext: false` to avoid storing this data in the history.

3. **Serialization**: When serializing the history for storage or transmission, be aware that the context data might contain circular references or non-serializable objects.

4. **Performance**: History tracking adds a small overhead to each transition. In performance-critical applications, consider enabling history only during development or debugging.

5. **Clearing History**: For long-running applications, periodically call `fs.history.clear()` to free up memory if you no longer need the older history entries.

## Integration with Other Features

Transition History works seamlessly with other FluentState features:

- **Auto-transitions**: Both manual and automatic transitions are recorded in the history.
- **Middleware**: Transitions blocked by middleware are recorded as failed transitions.
- **Plugins**: Custom plugins can access and utilize the transition history for advanced functionality.

## Limitations

1. The transition history is stored in memory and is not persisted across application restarts. If you need persistent history, you'll need to implement your own storage solution.

2. The history is stored in chronological order with newest entries first. This means that when the history reaches its maximum size, the oldest entries are removed.

3. Context data is stored by reference. If you modify the context object after a transition, the history entry will reflect those changes. If you need immutable history, consider deep-cloning your context data. 