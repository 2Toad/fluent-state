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

