# FluentState Roadmap

This document outlines planned improvements and potential features for the FluentState library.

## 1. Enhanced Auto-transition Configuration
Dependencies: None

Extend the `AutoTransitionConfig` interface with more control over transition behavior:

```typescript
interface AutoTransitionConfig<TContext = unknown> {
  condition: (state: State, context: TContext) => boolean | Promise<boolean>;
  targetState: string;
  // New properties:
  priority?: number;  // Higher priority transitions are evaluated first
  debounce?: number; // Delay evaluation by specified milliseconds
  retryConfig?: {     // Retry failed transitions
    maxAttempts: number;
    delay: number;
  };
}
```

Benefits:
- Better control over transition order and timing
- Improved handling of race conditions
- Automatic retry for transient failures

User Story:
As a developer using FluentState in a complex application,
I want to have fine-grained control over how auto-transitions are evaluated and executed,
So that I can handle race conditions, prioritize certain transitions, and make my state machine more resilient to transient failures.

Acceptance Criteria:

1. Priority-based Transitions
   - When multiple auto-transitions are possible from a state, they are evaluated in order of priority (highest to lowest)
   - Transitions with the same priority are evaluated in the order they were defined
   - Transitions without a priority value default to priority 0
   - Only the first successful transition (highest priority) is executed

2. Debounced Transitions
   - When a debounce value is set, the transition evaluation waits for the specified milliseconds after the last context update
   - If another context update occurs during the debounce period, the timer resets
   - Debounced transitions maintain their priority order when evaluated
   - Resources (timers) are properly cleaned up when the state changes or the state machine is destroyed

3. Retry Configuration
   - Failed transition attempts (where condition throws an error) are retried up to maxAttempts times
   - Each retry attempt waits for the specified delay in milliseconds
   - Retries stop immediately if the condition returns false (vs throwing an error)
   - Retry attempts are logged for debugging purposes
   - The state machine remains responsive to other transitions during retry delays

Example Usage:
```typescript
// Priority example
fs.from("reviewing")
  .to<Document>("approved", {
    condition: (_, doc) => doc.approvals >= 2,
    priority: 2  // Checked first
  })
  .to<Document>("rejected", {
    condition: (_, doc) => doc.rejections >= 1,
    priority: 1  // Checked second
  });

// Debounce example
fs.from("typing")
  .to<SearchState>("searching", {
    condition: (_, state) => state.query.length >= 3,
    debounce: 300  // Wait 300ms after last keystroke
  });

// Retry example
fs.from("connecting")
  .to<ApiState>("connected", {
    condition: async (_, state) => {
      const response = await checkConnection(state.endpoint);
      return response.isConnected;
    },
    retryConfig: {
      maxAttempts: 3,
      delay: 1000  // Wait 1 second between attempts
    }
  });
```

## 2. Transition History
Dependencies: None

Add a system for tracking and querying transition history:

```typescript
class TransitionHistory {
  private history: Array<{
    from: string;
    to: string;
    timestamp: number;
    context: unknown;
    success: boolean;
  }> = [];

  add(entry: TransitionHistoryEntry): void;
  getLastTransition(): TransitionHistoryEntry | null;
  getTransitionsForState(stateName: string): TransitionHistoryEntry[];
  clear(): void;
}
```

Benefits:
- Debug complex state flows
- Audit state changes
- Time travel debugging capabilities
- Analytics and monitoring

User Story:
As a developer working with complex state machines in FluentState,
I want to track and query the history of state transitions,
So that I can debug issues, audit state changes, implement time travel debugging, and gather analytics about my application's state flow.

Acceptance Criteria:

1. Transition Recording
   - All state transitions are recorded with their source state, target state, timestamp, context data, and success status
   - Transitions are stored in chronological order
   - Failed transition attempts are also recorded with appropriate success status
   - The history can be configured to have a maximum size limit to prevent memory issues
   - When the size limit is reached, oldest entries are removed first

2. History Querying
   - Developers can retrieve the most recent transition with getLastTransition()
   - Developers can query transitions related to a specific state with getTransitionsForState()
   - Query results maintain the chronological order of transitions
   - The API provides a way to clear the history when needed

3. Integration with State Machine
   - Transition history recording is optional and can be enabled/disabled
   - History recording has minimal performance impact on the state machine
   - The history is accessible through the state machine instance
   - History is properly maintained even during complex transition scenarios (e.g., auto-transitions, conditional transitions)

4. Serialization Support
   - Transition history can be serialized to JSON for storage or transmission
   - Sensitive context data can be filtered during serialization
   - Serialized history can be imported back into a TransitionHistory instance

Example Usage:
```typescript
// Enable history tracking
const machine = new StateMachine({
  initialState: "idle",
  enableHistory: true,
  historyOptions: {
    maxSize: 100,
    includeContext: true
  }
});

// Later, query the history
const lastTransition = machine.history.getLastTransition();
console.log(`Last transition: ${lastTransition.from} -> ${lastTransition.to}`);

// Get all transitions involving the "processing" state
const processingTransitions = machine.history.getTransitionsForState("processing");
console.log(`Processing state was involved in ${processingTransitions.length} transitions`);

// Export history for debugging
const serializedHistory = JSON.stringify(machine.history);
```

## 3. Batch Context Updates
Dependencies: 
- Enhanced Auto-transition Configuration (for proper handling of debounced transitions during batch updates)
- State Manager Performance Optimizations (for batching configuration)

Add support for batching multiple context updates:

```typescript
// In State class
async batchUpdate<T>(updates: Partial<T>[], options?: {
  // Only trigger auto-transitions after all updates are applied
  evaluateAfterComplete?: boolean;
  // Abort batch if any update fails
  atomic?: boolean;
}): Promise<boolean>;
```

Benefits:
- Improved performance for multiple updates
- Atomic updates when needed
- Reduced unnecessary transition evaluations

## 4. Conditional Auto-transition Evaluation
Dependencies:
- Enhanced Auto-transition Configuration (for priority and timing control)

More granular control over when auto-transitions are evaluated:

```typescript
interface AutoTransitionEvaluationConfig {
  // Only evaluate when these context properties change
  watchProperties?: string[];
  // Skip evaluation if these conditions are met
  skipIf?: (context: unknown) => boolean;
  // Custom evaluation timing
  evaluationStrategy?: 'immediate' | 'nextTick' | 'idle';
}
```

Benefits:
- Better performance through selective evaluation
- More predictable transition behavior
- Optimized for different use cases

## 5. Transition Groups
Dependencies:
- Enhanced Auto-transition Configuration (for group-level configuration inheritance)

Organize related transitions into manageable groups:

```typescript
class TransitionGroup {
  constructor(name: string);
  addTransition(from: string, to: string, config?: AutoTransitionConfig): void;
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
}

// Usage example
const uploadFlow = new TransitionGroup('upload');
uploadFlow.addTransition('idle', 'uploading', { /* config */ });
uploadFlow.addTransition('uploading', 'processing', { /* config */ });
fs.addGroup(uploadFlow);
```

Benefits:
- Better organization of complex state machines
- Ability to enable/disable groups of transitions
- Improved maintainability

User Story:
As a developer working with complex state machines in FluentState,
I want to organize related transitions into logical groups that can be managed collectively,
So that I can better structure my application's state flow, enable/disable sets of transitions as a unit, and improve the maintainability of my state machine.

Acceptance Criteria:

1. Group Creation and Management
   - ✅ Developers can create transition groups using a fluent API: `fluentState.createGroup('groupName')`
   - ✅ Groups can be chained with additional configuration: `fluentState.createGroup('groupName').withConfig({ priority: 2 })`
   - ✅ Groups can be retrieved using a fluent method: `fluentState.group('groupName')`
   - ✅ Return `null` or throw a specific error when a group is not found
   - ✅ The API prevents duplicate group names within the same state machine
   - ✅ Groups can be removed using a fluent method: `fluentState.removeGroup('groupName')`
   - ✅ Provide a mechanism to list all available groups: `fluentState.getAllGroups()`
   - ✅ Support for group namespaces or categories (e.g., `authentication:login`, `authentication:register`)
   - ✅ Option to initialize groups from a serialized configuration object

2. Transition Definition and Organization
   - ✅ Transitions can be added to a group using a fluent syntax: `group.from('stateA').to('stateB', config)`
   - ✅ Multiple transitions can be chained: `group.from('stateA').to('stateB').or('stateC')`
   - ✅ The group maintains direct references to the original Transition objects rather than recreating them
   - ✅ Transitions in a group are properly registered with the FluentState instance
   - ✅ Transitions can be removed using a fluent method: `group.removeTransition('stateA', 'stateB')`
   - ✅ When a state is removed from the state machine, any transitions involving that state are automatically removed from all groups
   - ✅ Method to check if a specific transition belongs to a group: `group.hasTransition('stateA', 'stateB')`
   - ✅ Support for transition tagging within groups for sub-categorization

3. Group-level Configuration
   - ✅ Group-level configuration can be set using a fluent API: `group.withConfig({ priority: 2, debounce: 300 })`
   - ✅ Individual transition configurations override group-level configurations when both are specified
   - ✅ Configuration options include:
     - ✅ Priority levels for all transitions in the group
     - ✅ Debounce settings for all transitions in the group
     - ✅ Retry configuration for all transitions in the group
   - ✅ Support for configuration inheritance between related groups
   - ✅ Provide a method to get the effective configuration for a transition: `group.getEffectiveConfig('stateA', 'stateB')`
   - ✅ Support for dynamic configuration that can change based on application state

4. Group Enabling/Disabling
   - ✅ Groups can be enabled or disabled using fluent methods: `group.enable()` and `group.disable()`
   - ✅ The enabled state can be queried: `group.isEnabled()`
   - ✅ When a group is disabled, none of its transitions are evaluated during auto-transition evaluation
   - ✅ When a group is disabled, manual transitions within the group are still possible (unless explicitly prevented)
   - ✅ Add an option to also prevent manual transitions when a group is disabled
   - ✅ Enabling a previously disabled group immediately makes its transitions available for evaluation
   - ✅ The API provides a fluent way to temporarily disable a group: `group.disableTemporarily(duration)`
   - ✅ Provide a restoration callback for when a temporarily disabled group is re-enabled
   - ✅ Support for conditionally enabled groups based on a predicate function

5. Event Handling
   - Groups can have event handlers attached using a fluent API:
     - `group.onTransition((from, to) => { /* handler */ })`
     - `group.onEnable(() => { /* handler */ })`
     - `group.onDisable(() => { /* handler */ })`
   - Event handlers receive relevant context about the event (states involved, transition configuration, etc.)
   - Multiple handlers can be chained: `group.onTransition(handler1).onTransition(handler2)`
   - Add support for removing event handlers: `group.offTransition(handler)`
   - Add support for one-time event handlers: `group.onceTransition(handler)`
   - Support for event bubbling between nested groups
   - Add group-level middleware that can intercept and modify transitions

6. Integration with Existing Features
   - Transition groups work seamlessly with the existing transition history feature
   - History entries include the group name for transitions that belong to a group
   - Transition groups are compatible with the debugging and visualization tools
   - Groups can be visualized as clusters in state machine diagrams
   - ✅ Support for serialization and deserialization of group definitions
   - Integration with the proposed logging system to provide group-specific logging

7. Performance Considerations
   - Adding transitions to groups does not significantly impact performance
   - Enabling/disabling groups is an efficient operation
   - The implementation optimizes for minimal overhead during transition evaluation
   - Memory usage scales reasonably with the number of groups and transitions
   - Provide a memory usage report method for groups: `fluentState.getGroupsMemoryUsage()`
   - Support for lazy initialization of groups to improve startup performance
   - Consider a compiled mode where group structures are optimized after definition
   - Support batch operations for improved performance when manipulating multiple groups

8. Nested Groups and Composition
   - Support for defining groups within groups for hierarchical organization
   - Child groups inherit configuration from parent groups unless overridden
   - Enable/disable operations cascade to child groups
   - Provide methods to navigate the group hierarchy: `group.parent()`, `group.children()`
   - Support for composition patterns to reuse group definitions across state machines

9. Testing and Debugging Support
   - Provide snapshot capabilities for group state: `group.createSnapshot()`
   - Support for mocking groups during testing
   - Support for time-travel debugging with group state rollback
   - Add group-specific debugging tools and visualizations
   - Provide metrics on group transition frequency and performance

Example Usage:
```typescript
// Create a group for user authentication flow with fluent API
const authFlow = fluentState.createGroup('authentication')
  .withConfig({
    priority: 2,
    retryConfig: {
      maxAttempts: 3,
      delay: 1000
    }
  });

// Add transitions to the group with fluent syntax
authFlow
  .from('loggedOut').to('authenticating', {
    condition: (_, context) => context.credentials !== null
  })
  .from('authenticating').to('loggedIn', {
    condition: (_, context) => context.isAuthenticated
  })
  .or('error', {
    condition: (_, context) => context.authError !== null
  });

// Add event handlers with fluent API
authFlow
  .onTransition((from, to) => console.log(`Auth transition: ${from} -> ${to}`))
  .onEnable(() => console.log('Auth flow enabled'))
  .onDisable(() => console.log('Auth flow disabled'));

// Later, disable the entire authentication flow
fluentState.group('authentication').disable();

// Enable it again when needed
fluentState.group('authentication').enable();

// Temporarily disable for 5 minutes
fluentState.group('authentication').disableTemporarily(5 * 60 * 1000);

// Check if the group is currently enabled
const isAuthFlowEnabled = fluentState.group('authentication').isEnabled();
```

## 6. State Manager Performance Optimizations
Dependencies: None

Configuration options for optimizing state manager performance:

```typescript
interface StateManagerConfig<T> {
  // Batch multiple rapid state updates
  batchUpdates?: boolean;
  batchTimeWindow?: number;
  // Memoize computed values from state
  enableMemoization?: boolean;
  // Custom equality function for state updates
  areEqual?: (prev: T, next: T) => boolean;
  // Performance metrics collection
  metrics?: {
    enabled: boolean;
    // Track update frequency and timing
    measureUpdates?: boolean;
    // Track memory usage of state
    measureMemory?: boolean;
    // Track computation time of state derivations
    measureComputations?: boolean;
    // Callback for metrics reporting
    onMetrics?: (metrics: StateManagerMetrics) => void;
  };
}

interface StateManagerMetrics {
  // Average time between updates
  updateFrequency: number;
  // Time spent processing updates
  updateDuration: number;
  // Number of updates in the current time window
  updateCount: number;
  // Memory usage statistics
  memoryUsage?: {
    stateSize: number;
    memoizedSize: number;
  };
  // Computation timing
  computationDuration?: {
    equality: number;
    memoization: number;
    derivations: number;
  };
}
```

Benefits:
- Improved performance for rapid updates
- Memory optimization through memoization
- Custom update detection
- Performance monitoring and optimization insights
- Real-time metrics for debugging and profiling

User Story:
As a developer building a performance-critical application with FluentState,
I want to optimize how state updates are processed and monitored,
So that I can minimize performance bottlenecks, reduce unnecessary re-renders, and gain insights into my application's state management behavior.

Acceptance Criteria:

1. Batched Updates
   - Multiple state updates occurring within the configured time window are batched into a single update
   - The batchTimeWindow parameter controls how long to wait before processing batched updates
   - Batching can be enabled/disabled globally via the batchUpdates configuration option
   - Batched updates maintain the same final state as if updates were processed individually

2. Memoization Support
   - When enableMemoization is true, derived values from state are cached and only recalculated when dependencies change
   - Memoization works with both simple and complex state structures
   - Memoized values are properly invalidated when their dependencies change
   - Memory usage is optimized by clearing unused memoized values

3. Custom Equality Checking
   - Developers can provide a custom areEqual function to determine if state has actually changed
   - The custom equality function is used to prevent unnecessary updates when state is structurally equivalent
   - Default equality checking uses a shallow comparison for objects and arrays
   - Custom equality checking works with all state update methods

4. Performance Metrics
   - When metrics.enabled is true, the state manager collects performance data
   - Update frequency, duration, and count are tracked when measureUpdates is true
   - Memory usage statistics are collected when measureMemory is true
   - Computation timing for equality checks, memoization, and derivations is measured when measureComputations is true
   - Metrics are provided to the onMetrics callback for custom reporting or visualization
   - Metrics collection has minimal impact on overall performance

Example Usage:
```typescript
// Configure performance optimizations
const machine = new StateMachine({
  initialState: "idle",
  stateManagerConfig: {
    batchUpdates: true,
    batchTimeWindow: 50, // 50ms batching window
    enableMemoization: true,
    areEqual: (prev, next) => _.isEqual(prev, next), // Deep equality check
    metrics: {
      enabled: true,
      measureUpdates: true,
      measureMemory: process.env.NODE_ENV === 'development',
      measureComputations: process.env.NODE_ENV === 'development',
      onMetrics: (metrics) => {
        console.log('State Manager Metrics:', metrics);
        if (metrics.updateFrequency < 16) { // Less than 60fps
          console.warn('Performance warning: High update frequency detected');
        }
      }
    }
  }
});
```

## 7. Debugging and Development Tools
Dependencies:
- Transition History (for comprehensive debugging capabilities)
- State Manager Performance Optimizations (for performance metrics collection and reporting)
- Transition Groups (for complete state machine visualization)

Comprehensive debugging and development tools:

```typescript
interface DebugConfig {
  // Log detailed transition information
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  // Track performance metrics
  measurePerformance?: boolean;
  // Save transition history
  keepHistory?: boolean;
  historySize?: number;
  // Export state machine configuration
  exportConfig?: () => string;
  // Visualize state machine (requires Transition Groups for complete visualization)
  generateGraph?: {
    format: 'mermaid' | 'dot' | 'svg';
    options?: {
      // Include transition conditions in the graph
      showConditions?: boolean;
      // Show transition groups as clusters
      groupClusters?: boolean;
      // Include state metadata
      showMetadata?: boolean;
      // Highlight current state
      highlightCurrent?: boolean;
      // Show transition history
      showHistory?: boolean;
      // Custom styling
      styles?: {
        groups?: Record<string, string>;
        states?: Record<string, string>;
        transitions?: Record<string, string>;
      };
    };
  };
}

// Example visualization output (Mermaid format):
/*
stateDiagram-v2
  %% Upload Flow Group
  state "Upload Flow" as UploadFlow {
    [*] --> idle
    idle --> uploading: files.length > 0
    uploading --> processing: progress === 100
    processing --> complete: isValid
    processing --> error: !isValid
  }
  
  %% Auth Flow Group
  state "Auth Flow" as AuthFlow {
    [*] --> login
    login --> loading: credentials
    loading --> dashboard: validated
    loading --> error: !validated
  }
*/
```

Benefits:
- Easier debugging of complex state machines
- Performance monitoring
- Better development experience
- Visual state machine representation with:
  - Grouped states and transitions
  - Transition conditions
  - Current state highlighting
  - Historical transitions
  - Custom styling options

## Implementation Priority

Given the dependencies, here's the revised implementation order:

1. Enhanced Auto-transition Configuration (High)
   - Most immediately useful for existing users
   - Builds on current functionality
   - Required by multiple other features

2. State Manager Performance Optimizations (High)
   - Important for applications with frequent updates
   - Performance improvements benefit all users
   - Required for batch updates

3. Transition History (Medium)
   - Required for comprehensive debugging tools
   - Foundation for monitoring and analytics

4. Transition Groups (Medium)
   - Moved up in priority as it's required for complete debugging tools
   - Organizational improvement
   - Required for state machine visualization
   - Requires enhanced auto-transition configuration

5. Debugging and Development Tools (Medium)
   - Critical for adoption and maintenance
   - Helps users understand and debug their state machines
   - Builds on transition history and groups
   - Complete visualization support

6. Batch Context Updates (Medium)
   - Performance optimization for specific use cases
   - Requires auto-transition configuration and state manager optimizations

7. Conditional Auto-transition Evaluation (Low)
   - Advanced optimization
   - Requires enhanced auto-transition configuration

## Compatibility

All proposed features will:
- Maintain backward compatibility
- Be optional/opt-in
- Build upon existing plugin system
- Follow current API patterns

## Contributing

We welcome contributions to any of these features. Please:
1. Open an issue to discuss implementation details
2. Follow existing code style and patterns
3. Include tests and documentation
4. Consider backward compatibility 