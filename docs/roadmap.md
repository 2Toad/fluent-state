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