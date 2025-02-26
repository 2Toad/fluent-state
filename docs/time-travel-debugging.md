# Time Travel Debugging

Time travel debugging is a powerful feature that allows you to navigate through the history of state transitions in your state machine. This enables you to explore how your application state evolved over time, debug issues by revisiting problematic states, and analyze the context changes that led to specific behaviors.

## Overview

The time travel debugging feature in FluentState integrates with the transition history system to provide:

1. **State Navigation**: Move back and forth through previously recorded states
2. **Context Inspection**: Examine the context data at any point in history
3. **Timeline Visualization**: Generate visual representations of state transitions
4. **Context Diffing**: Analyze differences between states
5. **Non-destructive Debugging**: Temporarily revert to past states without affecting the actual application

## Enabling Time Travel Debugging

Time travel debugging requires history tracking to be enabled. You can enable it when creating your FluentState instance:

```typescript
import { FluentState } from "@2toad/fluent-state";

// Create a state machine with history and time travel enabled
const fs = new FluentState({
  initialState: "idle",
  enableHistory: true,
  debug: {
    timeTravel: {
      maxSnapshots: 50,
      trackContextChanges: true
    }
  }
});
```

Alternatively, you can enable it later:

```typescript
// Enable history tracking first (if not already enabled)
fs.enableHistory();

// Configure time travel
fs.debug.configureTimeTravel({
  maxSnapshots: 50
});
```

## Using Time Travel Debugging

### Navigating Through State History

Once you have accumulated some state transitions, you can navigate through them:

```typescript
// Travel to a specific point in history by index (0 is most recent)
fs.travelToHistoryIndex(2);

// Travel to a specific point by timestamp
fs.travelToTimestamp(1623456789000);

// Move to the previous state
fs.previousHistoryState();

// Move to the next state
fs.nextHistoryState();

// Return to the current state
fs.returnToCurrentState();
```

### Checking Time Travel Mode

You can check if you're currently in time travel mode:

```typescript
if (fs.isInTimeTravelMode()) {
  console.log("Currently viewing a past state");
} else {
  console.log("Viewing current state");
}
```

### Working with Snapshots

Time travel functions return snapshot objects that contain the state and context at that point in time:

```typescript
// Travel to a specific point and get the snapshot
const snapshot = fs.travelToHistoryIndex(1);
if (snapshot) {
  console.log(`State: ${snapshot.state}`);
  console.log(`Timestamp: ${new Date(snapshot.timestamp).toLocaleString()}`);
  console.log(`Context: ${JSON.stringify(snapshot.context)}`);
}
```

You can also access all snapshots:

```typescript
const timeTravel = fs.getTimeTravel();
const allSnapshots = timeTravel.getAllSnapshots();
```

### Analyzing Context Changes

Time travel debugging allows you to analyze how context changed between states:

```typescript
const timeTravel = fs.getTimeTravel();

// Get two snapshots
const olderSnapshot = timeTravel.travelToIndex(2);
const newerSnapshot = timeTravel.travelToIndex(1);

if (olderSnapshot && newerSnapshot) {
  // Compare contexts
  const diff = timeTravel.getDiff(
    olderSnapshot.context,
    newerSnapshot.context,
    olderSnapshot.timestamp,
    newerSnapshot.timestamp
  );
  
  console.log("Added properties:", diff.added);
  console.log("Removed properties:", diff.removed);
  console.log("Changed properties:", diff.changed);
}
```

## Timeline Visualization

One of the most powerful features of time travel debugging is the ability to generate timeline visualizations of your state transitions:

### Mermaid Timeline

```typescript
// Generate a Mermaid timeline diagram
const mermaidTimeline = fs.generateTimeline({
  format: "mermaid",
  maxTransitions: 10,
  includeContext: true
});

// Output to a markdown file or render with a Mermaid library
console.log(mermaidTimeline);
```

Example output:

```mermaid
timeline
    title State Transition Timeline

    section 10:15:30
        Initial → idle : ✅
    
    section 10:15:45
        idle → loading : ✅
        Context: {"id":123,"progress":0}
    
    section 10:16:02 👉 Current
        loading → success : ✅
        Context: {"id":123,"progress":100,"result":"Complete"}
```

### DOT Timeline

```typescript
// Generate a DOT timeline diagram
const dotTimeline = fs.generateTimeline({
  format: "dot",
  maxTransitions: 10,
  includeContext: true,
  styles: {
    currentState: "fillcolor=\"#ff9\", style=\"filled,rounded\"",
    successfulTransition: "fillcolor=\"#afa\", style=\"filled,rounded\"",
    failedTransition: "fillcolor=\"#faa\", style=\"filled,rounded\""
  }
});
```

This can be rendered with Graphviz to create a detailed visualization of your state transitions.

### SVG Timeline

```typescript
// Generate SVG instructions
const svgInstructions = fs.generateTimeline({
  format: "svg",
  maxTransitions: 15
});

// Follow the instructions to generate an SVG file
```

## Advanced Configuration

Time travel debugging can be customized with several options:

```typescript
fs.debug.configureTimeTravel({
  // Maximum number of snapshots to keep
  maxSnapshots: 50,
  
  // Whether to automatically apply snapshots when created
  autoApply: false,
  
  // Whether to track context changes between snapshots
  trackContextChanges: true
});
```

## Integration with Developer Tools

Time travel debugging is designed to integrate with developer tools:

```typescript
// Create a custom debugging UI
const debugPanel = document.getElementById('debug-panel');

// Add previous/next buttons
const prevButton = document.createElement('button');
prevButton.textContent = '◀ Previous';
prevButton.addEventListener('click', () => {
  const snapshot = fs.previousHistoryState();
  if (snapshot) {
    updateDebugDisplay(snapshot);
  }
});

const nextButton = document.createElement('button');
nextButton.textContent = 'Next ▶';
nextButton.addEventListener('click', () => {
  const snapshot = fs.nextHistoryState();
  if (snapshot) {
    updateDebugDisplay(snapshot);
  }
});

const resetButton = document.createElement('button');
resetButton.textContent = 'Return to Current';
resetButton.addEventListener('click', () => {
  fs.returnToCurrentState();
  updateDebugDisplay(null);
});

// Update the debug display with snapshot information
function updateDebugDisplay(snapshot) {
  // Update your debug UI with snapshot information
}

// Add a timeline visualization
const timelineContainer = document.createElement('div');
timelineContainer.innerHTML = fs.generateTimeline({ format: 'mermaid' });
mermaid.init(undefined, timelineContainer);

// Add everything to the debug panel
debugPanel.appendChild(prevButton);
debugPanel.appendChild(nextButton);
debugPanel.appendChild(resetButton);
debugPanel.appendChild(timelineContainer);
```

## Best Practices

1. **Enable History with Appropriate Size**: Set a reasonable history size based on your application's needs and memory constraints.

2. **Use Time Travel Mode Temporarily**: Always return to the current state after debugging to prevent unexpected behavior.

3. **Consider Context Size**: Large context objects can consume memory. Use the `contextFilter` option in history tracking to filter out unnecessary data.

4. **Include Timestamps in Logs**: When logging issues, include the timestamp to easily correlate with time travel debugging.

5. **Generate Timelines for Documentation**: Timeline visualizations are excellent for documenting state machine behavior in reports or documentation.

6. **Include Time Travel UI in Development Mode Only**: Add time travel debugging UI only in development builds to avoid performance impacts in production.

7. **Integrate with Existing Tools**: Combine time travel debugging with state snapshots, performance metrics, and logging for comprehensive debugging.

8. **Use Context Diffing for Complex Issues**: For hard-to-track bugs, analyze context diffs between states to identify subtle changes.

## Example: Debugging a Login Flow

Here's a complete example showing how to use time travel debugging to troubleshoot a login flow:

```typescript
import { FluentState } from "@2toad/fluent-state";

// Create a login flow state machine
const loginFlow = new FluentState({
  initialState: "loggedOut",
  enableHistory: true,
  debug: {
    timeTravel: {
      maxSnapshots: 20
    }
  }
});

// Define states and transitions
loginFlow.from("loggedOut").to("authenticating");
loginFlow.from("authenticating").to("authenticated");
loginFlow.from("authenticating").to("error");
loginFlow.from("error").to("loggedOut");
loginFlow.from("authenticated").to("loggedOut");

// Add context updates
async function simulateLogin(username, password) {
  try {
    // Start login process
    const state = loginFlow.getCurrentState();
    state.updateContext({ username, timestamp: Date.now() });
    await loginFlow.transition("authenticating");
    
    // Simulate API call
    const authState = loginFlow.getCurrentState();
    authState.updateContext({ authenticating: true, startTime: Date.now() });
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate authentication result
    if (password === "correct") {
      authState.updateContext({ authenticating: false, success: true });
      await loginFlow.transition("authenticated");
    } else {
      authState.updateContext({ 
        authenticating: false, 
        success: false, 
        error: "Invalid credentials" 
      });
      await loginFlow.transition("error");
    }
  } catch (err) {
    console.error("Login flow error:", err);
  }
}

// Simulate some login attempts
async function runDemo() {
  await simulateLogin("user1", "wrong");
  await simulateLogin("user2", "correct");
  await simulateLogin("user3", "wrong");
  
  // Now debug the flow:
  console.log("Generating timeline...");
  console.log(loginFlow.generateTimeline({ includeContext: true }));
  
  // Find the failed logins
  const timeTravel = loginFlow.getTimeTravel();
  const history = loginFlow.history.getHistory();
  
  const failedLogins = history.filter(entry => 
    entry.to === "error" && entry.from === "authenticating"
  );
  
  console.log(`Found ${failedLogins.length} failed logins`);
  
  // Examine the first failed login
  if (failedLogins.length > 0) {
    const failedIndex = history.indexOf(failedLogins[0]);
    console.log(`Traveling to failed login at index ${failedIndex}`);
    
    const snapshot = timeTravel.travelToIndex(failedIndex);
    console.log("Failed login state:", snapshot);
    console.log("Context:", snapshot.context);
    
    // Go back to the state before the failure
    const prevSnapshot = timeTravel.previous();
    console.log("State before failure:", prevSnapshot);
    console.log("Context before failure:", prevSnapshot.context);
    
    // Analyze the context differences
    const diff = timeTravel.getDiff(
      prevSnapshot.context,
      snapshot.context,
      prevSnapshot.timestamp,
      snapshot.timestamp
    );
    
    console.log("Context changes that led to failure:", diff);
    
    // Return to current state
    loginFlow.returnToCurrentState();
    console.log("Returned to current state:", loginFlow.getCurrentState().name);
  }
}

runDemo();
```

By combining time travel debugging with visualization and context diffing, you can gain deep insights into your state machine's behavior and quickly identify and fix issues. 