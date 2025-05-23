# Auto-transitions

Auto-transitions allow you to define conditions that automatically trigger state transitions when met. This is particularly useful for implementing state machines that need to react to changes in your application's state.

## When to Use Auto-transitions

Auto-transitions are most effective when:

1. **Reactive State Changes**: Your state transitions depend on data changes rather than direct user actions
   ```typescript
   // Good use case: Automatically transition to error state when retries exceed limit
   fs.from("retry").to("error", (_, context) => context.retries >= 3);

   // Less ideal: User clicking a button (use regular transitions instead)
   fs.from("form").to("submitted", (_, context) => context.buttonClicked);
   ```

2. **Complex State Dependencies**: Transitions depend on multiple conditions or computed values
   ```typescript
   fs.from("active")
     .to("suspended", (_, context) => 
       context.violations > 3 && context.lastWarning < Date.now() - 24*60*60*1000
     );
   ```

3. **Asynchronous State Updates**: State changes that depend on async operations
   ```typescript
   fs.from("processing")
     .to("complete", async (_, context) => {
       const status = await checkStatus(context.jobId);
       return status === "done";
     });
   ```

4. **Chain Reactions**: When one state change should trigger a series of transitions
   ```typescript
   fs.from("uploading")
     .to("processing", (_, context) => context.uploadComplete)
     .from("processing")
     .to("validating", (_, context) => context.processComplete)
     .from("validating")
     .to("complete", (_, context) => context.isValid);
   ```

Consider using regular transitions when:
- Transitions are triggered by direct user actions
- State changes are simple and immediate
- You don't need reactive behavior
- You want more explicit control over transition timing

## Basic Usage

Auto-transitions are defined using the `to` or `or` methods when creating state transitions:

```typescript
interface AppState {
  status: "loading" | "error" | "success";
  retries: number;
}

const fs = new FluentState<AppState>();

fs.from("retry")
  .to<AppState>("failed", (state, context) => context.retries >= 3)
  .or<AppState>("success", (state, context) => context.status === "success");
```

## Enhanced Auto-transition Configuration

Auto-transitions can be configured with additional options using the `AutoTransitionConfig` interface:

```typescript
interface AutoTransitionConfig<TContext = unknown> {
  condition: (state: State, context: TContext) => boolean | Promise<boolean>;
  targetState: string;
  priority?: number;  // Higher numbers = higher priority
  debounce?: number;  // Delay in milliseconds before transition occurs
  retryConfig?: {     // Retry failed transitions
    maxAttempts: number;
    delay: number;
  };
}
```

### Priority-based Transitions

When multiple auto-transitions are defined for a state, you can control their evaluation order using priorities:

```typescript
fs.from("start")
  .to<AppState>("critical", {
    condition: (_, ctx) => ctx.severity === "critical",
    targetState: "critical",
    priority: 3  // Highest priority, evaluated first
  })
  .or<AppState>("warning", {
    condition: (_, ctx) => ctx.severity === "warning",
    targetState: "warning",
    priority: 2  // Medium priority
  })
  .or<AppState>("info", {
    condition: (_, ctx) => ctx.severity === "info",
    targetState: "info",
    priority: 1  // Lowest priority
  });
```

Key features of priority-based transitions:

1. **Evaluation Order**: Transitions are evaluated in descending priority order (highest to lowest).
2. **Default Priority**: When priority is not specified, it defaults to 0.
3. **Equal Priority Behavior**: For transitions with equal priority, the original definition order is maintained.
4. **Early Exit**: Evaluation stops after the first successful transition, regardless of remaining transitions.

Example with mixed priorities:

```typescript
interface AppState {
  errors: number;
  warnings: number;
  isActive: boolean;
}

fs.from("monitoring")
  // High priority: Check critical errors first
  .to<AppState>("error", {
    condition: (_, ctx) => ctx.errors > 0,
    targetState: "error",
    priority: 2
  })
  // Medium priority: Check warnings
  .or<AppState>("warning", {
    condition: (_, ctx) => ctx.warnings > 0,
    targetState: "warning",
    priority: 1
  })
  // Default priority (0): Basic state check
  .or<AppState>("inactive", (_, ctx) => !ctx.isActive);
```

#### Best Practices for Priority-based Transitions

1. **Priority Scale**
   - Use a consistent scale (e.g., 0-5) across your application
   - Reserve higher priorities for critical state changes
   - Document your priority levels in comments

2. **Logical Grouping**
   ```typescript
   // Critical system states (Priority 3)
   .to("error", { condition: errorCheck, priority: 3 })
   .or("systemFailure", { condition: failureCheck, priority: 3 })
   
   // Warning states (Priority 2)
   .or("diskWarning", { condition: diskCheck, priority: 2 })
   .or("memoryWarning", { condition: memoryCheck, priority: 2 })
   
   // Normal operations (Priority 1)
   .or("active", { condition: activeCheck, priority: 1 })
   .or("standby", { condition: standbyCheck, priority: 1 })
   ```

3. **Condition Complexity**
   - Keep high-priority conditions simple and fast
   - Place complex or time-consuming conditions at lower priorities
   ```typescript
   .to("error", {
     condition: () => isSystemCritical(), // Simple, fast check
     priority: 3
   })
   .or("warning", {
     condition: async () => await complexAnalysis(), // Complex check
     priority: 1
   })
   ```

4. **Testing Considerations**
   - Test priority ordering explicitly
   - Verify that higher priority transitions block lower ones
   - Test equal-priority transition ordering
   ```typescript
   it("should evaluate high priority before low", async () => {
     const fs = new FluentState();
     fs.from("start")
       .to("high", { condition: () => true, priority: 2 })
       .or("low", { condition: () => true, priority: 1 });
     
     await fs.start();
     expect(fs.state.name).to.equal("high");
   });
   ```

### Retry Transitions

You can configure auto-transitions to automatically retry when their condition functions throw errors. This is particularly useful for:

1. **Handling transient failures**: When conditions depend on network requests or other operations that might temporarily fail
2. **Improving resilience**: Making your state machine more robust against intermittent issues
3. **Simplifying error handling**: Avoiding complex try/catch blocks in your condition functions

```typescript
fs.from("connecting")
  .to<NetworkState>("connected", {
    condition: async (_, state) => {
      const response = await checkConnection(state.endpoint);
      return response.isConnected;
    },
    targetState: "connected",
    retryConfig: {
      maxAttempts: 3,     // Try up to 3 times
      delay: 1000         // Wait 1 second between attempts
    }
  });
```

#### Key Features of Retry Configuration

1. **Automatic Retries**: When a condition function throws an error, it will be retried automatically up to `maxAttempts` times.
2. **Delay Between Attempts**: Each retry attempt waits for the specified `delay` in milliseconds before executing.
3. **Early Exit on False**: If the condition returns `false` (as opposed to throwing an error), retries stop immediately.
4. **Detailed Logging**: Retry attempts and failures are logged for debugging purposes.
5. **Final Error Reporting**: If all retry attempts fail, a final error is logged with details.

#### Examples

**Basic Retry Configuration:**
```typescript
fs.from("loading")
  .to<DataState>("ready", {
    condition: async (_, ctx) => {
      const data = await fetchData(ctx.dataUrl);
      return data.status === "complete";
    },
    targetState: "ready",
    retryConfig: {
      maxAttempts: 3,
      delay: 2000  // 2 seconds between attempts
    }
  });
```

**Combining Retry with Priority:**
```typescript
fs.from("initializing")
  // Critical connection - retry quickly but fewer times
  .to<SystemState>("connected", {
    condition: async (_, ctx) => await establishPrimaryConnection(ctx),
    targetState: "connected",
    priority: 3,
    retryConfig: {
      maxAttempts: 2,
      delay: 500  // Fast retry for critical connection
    }
  })
  // Fallback connection - retry more times with longer delays
  .or<SystemState>("fallbackConnected", {
    condition: async (_, ctx) => await establishFallbackConnection(ctx),
    targetState: "fallbackConnected",
    priority: 2,
    retryConfig: {
      maxAttempts: 5,
      delay: 2000  // Longer delay for fallback
    }
  });
```

**Handling Different Error Types:**
```typescript
fs.from("authenticating")
  .to<AuthState>("authenticated", {
    condition: async (_, ctx) => {
      try {
        const authResult = await authenticate(ctx.credentials);
        return authResult.success;
      } catch (error) {
        // For certain errors, we don't want to retry
        if (error.code === "INVALID_CREDENTIALS") {
          return false; // This will stop retries
        }
        // For other errors (network, server, etc.), throw to trigger retry
        throw error;
      }
    },
    targetState: "authenticated",
    retryConfig: {
      maxAttempts: 3,
      delay: 1000
    }
  });
```

#### Best Practices for Retry Configuration

1. **Choose Appropriate Retry Counts**
   - Use fewer retries (1-3) for user-facing operations to avoid long waits
   - Use more retries (3-5) for background operations or critical system functions
   - Consider the likelihood of transient failures when setting retry counts

2. **Set Reasonable Delays**
   - For quick operations, use shorter delays (100-500ms)
   - For network operations, use longer delays (1000-5000ms)
   - Consider implementing exponential backoff for more advanced scenarios

3. **Combine with Other Features**
   ```typescript
   fs.from("processing")
     .to<JobState>("complete", {
       condition: async (_, ctx) => await checkJobStatus(ctx.jobId),
       targetState: "complete",
       priority: 2,
       retryConfig: {
         maxAttempts: 3,
         delay: 1000
       },
       debounce: 500  // Wait for stability before checking
     });
   ```

4. **Testing Considerations**
   - Test both successful retries and exhausted retries
   - Verify that false returns stop retries immediately
   - Test interactions with priority and debounce settings
   ```typescript
   it("should retry and eventually succeed", async () => {
     // Setup state machine with retry config
     let attempts = 0;
     fs.from("initial").to("success", {
       condition: () => {
         attempts++;
         if (attempts < 3) throw new Error("Temporary failure");
         return true;
       },
       retryConfig: { maxAttempts: 3, delay: 10 }
     });
     
     await fs.start();
     await fs.state.evaluateAutoTransitions({});
     
     expect(attempts).to.equal(3);
     expect(fs.state.name).to.equal("success");
   });
   ```

### Debounced Transitions

You can delay transitions by specifying a debounce period in milliseconds. This is useful for:

1. **Reducing state thrashing**: When your context data changes rapidly or frequently
2. **Waiting for stabilization**: When you want to ensure a condition persists before transitioning
3. **Batching updates**: When multiple context changes should result in a single transition

```typescript
interface UserActivity {
  idle: boolean;
  lastAction: number;
}

fs.from("active")
  .to<UserActivity>("idle", {
    condition: (_, ctx) => ctx.idle && Date.now() - ctx.lastAction > 5000,
    targetState: "idle",
    debounce: 2000  // Wait 2 seconds after condition is true before transitioning
  });
```

#### Key Features of Debounced Transitions

1. **Delayed Execution**: The transition only occurs after the specified debounce period has elapsed.
2. **Timer Reset**: If the context is updated during the debounce period, the timer is reset.
3. **Condition Re-evaluation**: When the debounce period completes, the condition is re-evaluated before transitioning.
4. **Cleanup on Exit**: Timers are automatically cleaned up when exiting a state to prevent memory leaks.
5. **Priority Respect**: Transition priorities are still respected for debounced transitions.

#### Examples

**Basic Debounced Transition:**
```typescript
fs.from("editing")
  .to<DocumentState>("saved", {
    condition: (_, ctx) => ctx.hasChanges && ctx.autoSave,
    targetState: "saved",
    debounce: 1000  // Wait 1 second after changes before auto-saving
  });
```

**Combining Debounced and Immediate Transitions:**
```typescript
// Immediate error transition (no debounce)
fs.from("processing")
  .to<JobState>("error", {
    condition: (_, ctx) => !!ctx.error,
    targetState: "error",
    priority: 2  // Higher priority, checked first
  })
  // Debounced completion transition
  .or<JobState>("complete", {
    condition: (_, ctx) => ctx.progress >= 100,
    targetState: "complete",
    debounce: 500,  // Wait 500ms to ensure the job is really complete
    priority: 1
  });
```

**Context Updates During Debounce:**
```typescript
// This transition will reset its timer whenever status changes
fs.from("connecting")
  .to<NetworkState>("connected", {
    condition: (_, ctx) => ctx.status === "connected",
    targetState: "connected",
    debounce: 1000  // Ensure connection is stable for 1 second
  });

// Usage:
networkState.updateContext({ status: "connecting" });
// ... 500ms later
networkState.updateContext({ status: "connected" }); // Timer starts
// ... 300ms later
networkState.updateContext({ status: "connecting" }); // Timer is reset
// ... 800ms later
networkState.updateContext({ status: "connected" }); // Timer starts again
// ... 1000ms later with no updates
// State transitions to "connected"
```

#### Best Practices for Debounced Transitions

1. **Choose Appropriate Delays**
   - Use shorter delays (100-500ms) for UI responsiveness
   - Use longer delays (1000ms+) for stabilizing system states
   - Consider user experience when choosing delay values

2. **Combine with Priorities**
   ```typescript
   // Critical errors should not be debounced
   .to("error", {
     condition: errorCondition,
     priority: 2
   })
   // Status updates can be debounced
   .or("warning", {
     condition: warningCondition,
     debounce: 500,
     priority: 1
   })
   ```

3. **Testing Considerations**
   - Use mocked timers in tests (e.g., Sinon, Jest fake timers)
   - Test timer reset behavior
   - Verify condition re-evaluation
   - Ensure cleanup on state exit
   ```typescript
   it("should delay transition with debounce", async () => {
     // Setup state machine with debounced transition
     fs.from("idle").to("active", {
       condition: () => true,
       debounce: 200
     });
     
     await fs.start();
     
     // Trigger evaluation
     fs.state.evaluateAutoTransitions({});
     
     // Should still be in idle state
     expect(fs.state.name).to.equal("idle");
     
     // Advance time
     await clock.tickAsync(200);
     
     // Now should have transitioned
     expect(fs.state.name).to.equal("active");
   });
   ```

### Conditional Auto-transition Evaluation

The Conditional Auto-transition Evaluation feature gives you fine-grained control over when and how auto-transitions are evaluated. This is particularly useful for optimizing performance, creating more predictable behavior, and managing complex state machines.

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

To use evaluation configuration, add it to your transition using the `evaluationConfig` property:

```typescript
fs.from("form")
  .to<FormState>("valid", {
    condition: (_, ctx) => ctx.isValid,
    targetState: "valid",
    evaluationConfig: {
      watchProperties: ['values.email', 'values.password'],
      skipIf: (ctx) => ctx.isOffline,
      evaluationStrategy: 'nextTick'
    }
  });
```

Alternatively, you can use the fluent API's `withEvaluationConfig` method:

```typescript
fs.from("form")
  .to<FormState>("valid", (_, ctx) => ctx.isValid)
  .withEvaluationConfig({
    watchProperties: ['values.email', 'values.password']
  });
```

#### Property-based Evaluation Triggering

The `watchProperties` option allows you to specify which context properties should trigger evaluation when they change. This significantly improves performance by avoiding unnecessary evaluations.

```typescript
fs.from("form")
  .to<FormState>("valid", {
    condition: (_, form) => form.isValid,
    targetState: "valid",
    evaluationConfig: {
      watchProperties: ['values.email', 'values.password']
    }
  });
```

Key features:

1. **Dot Notation Support**: Access deep properties using dot notation: `'user.profile.name'`
2. **Array Notation Support**: Access array elements: `'items[0].status'`
3. **Performance Improvements**: Only evaluates when specified properties change, not on every context update
4. **Property Tracking**: Properly detects property additions and deletions, not just value changes

Example:

```typescript
// This transition will only be evaluated when email or password changes
fs.from("editing")
  .to<FormState>("validating", {
    condition: (_, context) => {
      return Boolean(context.values.email && context.values.password);
    },
    targetState: "validating",
    evaluationConfig: {
      watchProperties: ['values.email', 'values.password']
    }
  });

// This will not trigger evaluation because 'unrelated' is not in watchProperties
await fs.state.updateContext({ unrelated: "new data" });

// This will trigger evaluation because 'values.email' is in watchProperties
await fs.state.updateContext({ values: { email: "user@example.com" } });
```

#### Conditional Evaluation Skipping

The `skipIf` option lets you completely bypass evaluation when certain conditions are met. This is useful for avoiding unnecessary processing or preventing transitions based on system state.

```typescript
fs.from("idle")
  .to<AppState>("loading", {
    condition: (_, state) => state.hasQueuedActions,
    targetState: "loading",
    evaluationConfig: {
      skipIf: (state) => state.isOffline || state.isBatteryLow
    }
  });
```

Key features:

1. **Early Exit**: Skip conditions are evaluated before any transition conditions to avoid unnecessary work
2. **Full Context Access**: The skipIf function receives the full context object for decision making
3. **Manual Override**: Skip conditions only affect auto-transitions, not manual transitions
4. **Performance Optimization**: Completely bypasses the condition function when the skip condition is met

Example:

```typescript
// Skip validation when offline
fs.from("validating")
  .to<FormState>("valid", {
    condition: (_, context) => {
      // Complex and expensive validation
      return validateAllFields(context);
    },
    targetState: "valid", 
    evaluationConfig: {
      skipIf: (context) => (context as FormState).isOffline
    }
  });

// This will not trigger validation because we're offline
await fs.state.updateContext({ isOffline: true, values: { ... } });

// Manual transitions still work even with skipIf
await fs.transition("valid"); // This will succeed
```

#### Evaluation Timing Strategies

The `evaluationStrategy` option gives you control over when transitions are evaluated, with three strategies available:

1. **`'immediate'`**: The default; evaluates transitions synchronously after context changes
2. **`'nextTick'`**: Defers evaluation to the next event loop tick
3. **`'idle'`**: Uses requestIdleCallback (or a polyfill) to evaluate during browser idle periods

```typescript
fs.from("form")
  .to<FormState>("submitting", {
    condition: (_, ctx) => ctx.isSubmitting,
    targetState: "submitting",
    evaluationConfig: {
      evaluationStrategy: 'nextTick' // Defer to next tick
    }
  });
```

Key benefits:

1. **Responsive UI**: Defer processing-heavy transitions to avoid blocking the main thread
2. **Prioritization**: Critical transitions can use 'immediate', while non-critical ones use 'idle'
3. **Batching**: 'nextTick' allows UI updates to complete before transitions are evaluated
4. **Resource Optimization**: 'idle' helps utilize spare CPU cycles during browser idle time

Example:

```typescript
// Use nextTick for better UI responsiveness
fs.from("valid")
  .to<FormState>("submitting", {
    condition: (_, context) => context.isSubmitting,
    targetState: "submitting",
    evaluationConfig: {
      evaluationStrategy: "nextTick"
    }
  });

// Use idle time for non-critical operations
fs.from("submitting")
  .to<FormState>("success", {
    condition: async (_, context) => {
      // Long-running operation
      return await submitForm(context);
    },
    targetState: "success",
    evaluationConfig: {
      evaluationStrategy: "idle"
    }
  });
```

#### Integration with Other Features

Conditional evaluation works seamlessly with other FluentState features:

##### With Debounce

```typescript
fs.from("search")
  .to<SearchState>("searching", {
    condition: (_, ctx) => ctx.query.length >= 3,
    targetState: "searching",
    debounce: 300, // Wait 300ms after last keystroke
    evaluationConfig: {
      watchProperties: ['query'] // Only evaluate when query changes
    }
  });
```

##### With Priority

```typescript
fs.from("form")
  .to<FormState>("error", {
    condition: (_, ctx) => ctx.hasError,
    targetState: "error",
    priority: 3, // Highest priority
    evaluationConfig: {
      // Evaluate immediately for error conditions
      evaluationStrategy: 'immediate'
    }
  })
  .or<FormState>("success", {
    condition: (_, ctx) => ctx.isValid,
    targetState: "success",
    priority: 2,
    evaluationConfig: {
      // Can use idle time for success path
      evaluationStrategy: 'idle'
    }
  });
```

##### With Transition Groups

```typescript
const formGroup = fs.createGroup("form");

formGroup.withConfig({
  // Group-level evaluation config applies to all transitions in the group
  evaluationConfig: {
    skipIf: (ctx) => (ctx as FormState).isDisabled
  }
});

// Individual transitions can override or extend the group config
formGroup.from("editing")
  .to("valid", {
    condition: (_, ctx) => ctx.isValid,
    targetState: "valid",
    evaluationConfig: {
      watchProperties: ['values.email', 'values.password']
      // Inherits skipIf from group config
    }
  });
```

### Best Practices for Auto-transition Configuration

1. **Priority Scale**
   - Use a consistent scale (e.g., 0-5) across your application
   - Reserve higher priorities for critical state changes
   - Document your priority levels in comments

2. **Logical Grouping**
   ```typescript
   // Critical system states (Priority 3)
   .to("error", { condition: errorCheck, priority: 3 })
   .or("systemFailure", { condition: failureCheck, priority: 3 })
   
   // Warning states (Priority 2)
   .or("diskWarning", { condition: diskCheck, priority: 2 })
   .or("memoryWarning", { condition: memoryCheck, priority: 2 })
   
   // Normal operations (Priority 1)
   .or("active", { condition: activeCheck, priority: 1 })
   .or("standby", { condition: standbyCheck, priority: 1 })
   ```

3. **Condition Complexity**
   - Keep high-priority conditions simple and fast
   - Place complex or time-consuming conditions at lower priorities
   ```typescript
   .to("error", {
     condition: () => isSystemCritical(), // Simple, fast check
     priority: 3
   })
   .or("warning", {
     condition: async () => await complexAnalysis(), // Complex check
     priority: 1
   })
   ```

4. **Testing Considerations**
   - Test priority ordering explicitly
   - Verify that higher priority transitions block lower ones
   - Test equal-priority transition ordering
   ```typescript
   it("should evaluate high priority before low", async () => {
     const fs = new FluentState();
     fs.from("start")
       .to("high", { condition: () => true, priority: 2 })
       .or("low", { condition: () => true, priority: 1 });
     
     await fs.start();
     expect(fs.state.name).to.equal("high");
   });
   ```

## State Management Options

### Custom State Management

For most applications, especially those using modern frameworks, you should integrate with existing store libraries or state management solutions:

```typescript
interface IStateManager<T> {
  getState(): T;
  setState(update: Partial<T>): void;
  subscribe(listener: (state: T) => void): () => void;
}
```

Benefits of using custom state management:
- Single source of truth
- Existing dev tools and debugging
- Consistent state management patterns
- Additional features (actions, getters, plugins)
- Better integration with framework ecosystem

### Built-in State Manager (For Simpler Use Cases)

FluentState includes a built-in state manager for simpler scenarios:

```typescript
// Initialize state
fs.state.updateContext({
  status: "loading",
  retries: 0
});

// Update state to trigger transitions
fs.state.updateContext({ retries: 3 });

// Get current state
const currentState = fs.state.getContext();
```

The built-in state manager is ideal for:
1. Isolated components with self-contained state
2. Prototyping and testing
3. Learning and teaching state machines
4. Simple workflows without complex state requirements

Choose the built-in manager when:
- Your state is isolated to a single feature
- You don't need integration with framework tooling
- You want to minimize dependencies
- You're building a prototype or proof of concept

## Working with Auto-transitions

### Condition Functions

Condition functions receive two parameters:
- `state`: The current State object
- `context`: User-provided context object

```typescript
fs.from("active")
  .to<AppState>("inactive", (state, context) => {
    return context.status === "error";
  });
```

### Multiple Conditions

Chain conditions using `or` to define multiple possible transitions:

```typescript
fs.from("active")
  .to<AppState>("premium", (_, context) => context.isPremium)
  .or<AppState>("basic", (_, context) => context.isBasic)
  .or<AppState>("inactive", (_, context) => !context.isActive);
```

### Asynchronous Conditions

Support for async operations in condition functions:

```typescript
fs.from("processing")
  .to<AppState>("completed", async (_, context) => {
    const result = await checkStatus(context);
    return result === "done";
  });
```

### Error Handling

Auto-transitions include built-in error handling:

```typescript
fs.from("processing")
  .to("error", async (_, context) => {
    try {
      return await validateStatus(context);
    } catch (error) {
      // Error will be caught and logged
      return true; // Transition to error state
    }
  });
```

## Integration Examples

### Vue 3 Integration

#### Using Pinia

```typescript
// stores/navigation.ts
import { defineStore } from 'pinia';
import { FluentState } from '@2toad/fluent-state';

class PiniaStateManager implements IStateManager<NavigationState> {
  constructor(private store: ReturnType<typeof useNavigationStore>) {}

  getState(): NavigationState {
    return this.store.$state;
  }

  setState(update: Partial<NavigationState>): void {
    this.store.$patch(update);
  }

  subscribe(listener: (state: NavigationState) => void): () => void {
    return this.store.$subscribe((_, state) => {
      listener(state as NavigationState);
    });
  }
}

// Usage
const store = useNavigationStore();
const stateManager = new PiniaStateManager(store);
fs.state.setStateManager(stateManager);
```

#### Using Vue's Reactivity System

```typescript
import { ref, watch } from 'vue';

class Vue3StateManager implements IStateManager<AppState> {
  constructor(private state: Ref<AppState>) {}

  getState(): AppState {
    return this.state.value;
  }

  setState(update: Partial<AppState>): void {
    this.state.value = { ...this.state.value, ...update };
  }

  subscribe(listener: (state: AppState) => void): () => void {
    return watch(
      () => this.state.value,
      (newState) => listener(newState),
      { deep: true }
    );
  }
}
```

### Other Frameworks

Integration with other state management solutions:

```typescript
// Redux
store.subscribe(() => {
  fs.state.evaluateAutoTransitions(store.getState());
});

// MobX
autorun(() => {
  fs.state.evaluateAutoTransitions(myObservableState);
});

// RxJS or Reflex
myStateSubject$.subscribe((state) => {
  fs.state.evaluateAutoTransitions(state);
});
```

## Real-World Examples

### Form Wizard
```typescript
const formWizard = new FluentState<FormState>();
formWizard
  .from('step1')
  .to<FormState>('step2', (_, context) => context.step1Complete)
  .from('step2')
  .to<FormState>('step3', (_, context) => context.step2Complete)
  .from('step3')
  .to<FormState>('complete', (_, context) => context.step3Complete);
```

### File Upload Component
```typescript
const uploadManager = new FluentState<UploadState>();
uploadManager
  .from('idle')
  .to<UploadState>('uploading', (_, context) => context.files.length > 0)
  .from('uploading')
  .to<UploadState>('complete', (_, context) => context.progress === 100)
  .or<UploadState>('error', (_, context) => !!context.error);
```

### Navigation Flow
```typescript
const navigation = new FluentState<AppState>();
navigation
  .from('login')
  .to<AppState>('loading', (_, context) => 
    context.isAuthenticated && !context.userData
  )
  .from('loading')
  .to<AppState>('error', (_, context) => !!context.error)
  .or<AppState>('dashboard', (_, context) => 
    !context.isLoading && !!context.userData
  );
```

## Best Practices

1. **Type Safety**
   - Always specify context types using generics
   - Use TypeScript interfaces for state definitions

2. **Condition Functions**
   - Keep conditions pure and focused
   - Handle async operations properly
   - Order conditions from specific to general

3. **State Management**
   - Choose between built-in and custom based on needs
   - Maintain single source of truth
   - Use appropriate tools for debugging

4. **Performance**
   - Keep condition functions lightweight
   - Avoid unnecessary state updates
   - Clean up subscriptions when components unmount

## Serialization and Deserialization

Auto-transitions can be serialized as part of transition groups. When serializing and deserializing, the priority configuration of auto-transitions is preserved, ensuring that your transition evaluation order remains consistent.

```typescript
// Create a state machine with prioritized transitions
const fs = new FluentState<AppState>();
const group = fs.createGroup("main");

group.from("idle")
  .to<AppState>("active", {
    condition: (_, ctx) => ctx.isActive,
    priority: 3  // Higher priority
  })
  .or<AppState>("waiting", {
    condition: (_, ctx) => ctx.isWaiting,
    priority: 2  // Medium priority
  })
  .or<AppState>("error", {
    condition: (_, ctx) => ctx.hasError,
    priority: 1  // Lower priority
  });

// Serialize the transition group
const serialized = group.exportJSON();

// Later, deserialize with condition functions
const newFs = new FluentState<AppState>();
const conditionMap = {
  isActive: (_, ctx: AppState) => ctx.isActive,
  isWaiting: (_, ctx: AppState) => ctx.isWaiting,
  hasError: (_, ctx: AppState) => ctx.hasError
};

newFs.importGroups(serialized, conditionMap);

// Priorities are preserved during deserialization
// Transitions will be evaluated in the same order: active (3) -> waiting (2) -> error (1)
```

When using nested condition maps with the `importGroups` method, the library will search through all levels to find the matching condition function:

```typescript
// Using nested condition maps
const nestedConditionMap = {
  stateChecks: {
    isActive: (_, ctx: AppState) => ctx.isActive,
    isWaiting: (_, ctx: AppState) => ctx.isWaiting,
  },
  errorChecks: {
    hasError: (_, ctx: AppState) => ctx.hasError
  }
};

// FluentState will search through all levels of the object to find the condition functions
newFs.importGroups(serialized, nestedConditionMap);
```

### Serialization Format

The serialized format of auto-transitions includes priority configurations:

```typescript
// Example of serialized transition with priority
{
  "from": "idle",
  "to": "active",
  "condition": "isActive",  // Condition function name to be matched in conditionMap
  "priority": 3,            // Priority is preserved
  "tags": ["important"]     // Tags are also preserved
}
```

### Best Practices for Serialization

1. **Consistent Condition Names**
   - Use descriptive names for condition functions
   - Maintain consistency between serialization and deserialization

2. **Document Condition Maps**
   - Keep a clear record of condition function names and their implementations
   - Consider storing condition maps alongside serialized state for documentation

3. **Version Control**
   - Consider adding version information to serialized data
   - Plan for backward compatibility when evolving your state machine

