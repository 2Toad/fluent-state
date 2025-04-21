# Batch Updates

Batch updates provide a powerful way to apply multiple context changes to your state machine at once, with precise control over transaction behavior and transition evaluation timing.

## Overview

When working with complex state machines, you often need to update multiple properties within your context simultaneously. The batch update API provides several key benefits:

- **Performance Optimization**: Reduces unnecessary transition evaluations
- **Atomic Operations**: All-or-nothing updates with automatic rollback
- **Controlled Evaluation Timing**: Evaluate transitions only after all updates are applied
- **Flexible Error Handling**: Continue processing after failures or roll back on any error

## Basic Usage

The simplest way to use batch updates is to provide an array of partial context updates:

```typescript
await stateMachine.currentState.batchUpdate([
  { counter: 1 },
  { status: 'processing' },
  { progress: 0.5 }
]);
```

Each object in the array represents a partial update to apply. Updates are processed in sequence, in the order provided.

## Configuration Options

### Evaluation Timing

By default, auto-transitions are evaluated after each individual update. If you want to defer transition evaluation until all updates are complete, use the `evaluateAfterComplete` option:

```typescript
await stateMachine.currentState.batchUpdate(
  [
    { step: 1 },
    { step: 2 },
    { step: 3 }
  ],
  { evaluateAfterComplete: true }
);
```

This can significantly improve performance for large batches by:
- Avoiding unnecessary intermediate transitions
- Reducing the number of transition evaluations
- Preventing visual flicker in UI applications

### Atomic Updates

For all-or-nothing operations, use the `atomic` option:

```typescript
const success = await stateMachine.currentState.batchUpdate(
  [
    { payment: 'processed' },
    { inventory: 'reserved' },
    { shipping: 'scheduled' }
  ],
  { atomic: true }
);

if (success) {
  console.log('Order processed successfully');
} else {
  console.log('Order processing failed');
}
```

When `atomic` is set to `true`:
- If any update fails, all previous updates are reverted
- The method returns `false` to indicate failure
- Debounced transitions are canceled to ensure consistency
- The state machine returns to its original state

## Error Handling

### Non-Atomic Mode

In non-atomic mode (the default), errors are logged but processing continues:

```typescript
try {
  const result = await stateMachine.currentState.batchUpdate([
    { step1: 'complete' },
    { step2: 'will-fail' },
    { step3: 'should-still-process' }
  ]);
  
  console.log(`Batch update ${result ? 'partially succeeded' : 'completely failed'}`);
} catch (error) {
  // This won't be called in non-atomic mode
}
```

The method returns `true` if at least one update succeeded, otherwise `false`.

### Atomic Mode

In atomic mode, an error will cause the entire batch to fail:

```typescript
try {
  const result = await stateMachine.currentState.batchUpdate(
    [
      { step1: 'complete' },
      { step2: 'will-fail' },
      { step3: 'wont-process' }
    ],
    { atomic: true }
  );
  
  // If we get here, the result will be true
  console.log('All updates succeeded');
} catch (error) {
  console.error('Batch update failed:', error);
  console.error(`Failed at update index: ${error.index}`, error.update);
}
```

When using atomic mode with debug features enabled, the error object contains detailed information about which update failed and why.

## Integration with Other Features

### Debounced Transitions

Batch updates properly manage debounced transitions:

- In non-atomic mode, debounced transitions for each successful update are preserved
- In atomic mode with failure, all debounced transitions are canceled when reverting

Example with debounced transitions:

```typescript
// Define a state with debounced transitions
machine.from("typing")
  .to<SearchState>("searching", {
    condition: (_, state) => state.query.length >= 3,
    debounce: 300  // Wait 300ms after last keystroke
  });

// Update the search query in a batch
await machine.state.batchUpdate([
  { query: 'p' },
  { query: 'pr' },
  { query: 'pro' },
  { query: 'prog' },
  { query: 'progr' },
  { query: 'progra' },
  { query: 'program' }
]);

// The debounced transition will fire once after the entire batch,
// rather than triggering for each keystroke
```

### Transition Groups

Batch updates respect transition group configurations, including priorities and enabled/disabled state:

```typescript
// Define a group
const validationGroup = machine.createGroup('validation');
validationGroup.from('inputting').to('validating', { 
  condition: ctx => ctx.value !== '', 
  priority: 2 
});

// Disable the group
validationGroup.disable();

// Even with matching conditions, transitions in this group won't fire during batch updates
await machine.state.batchUpdate([
  { value: 'test' }
]);
```

### Method Chaining with batchUpdateFluid

For fluent API usage, `batchUpdateFluid` allows method chaining without waiting for the updates to complete:

```typescript
machine.currentState
  .batchUpdateFluid([
    { step: 1 },
    { status: 'inProgress' }
  ])
  .onExit(() => console.log('Exiting state'));
```

This is particularly useful when defining state behavior all at once.

## Performance Considerations

Batch updates can significantly improve performance in several scenarios:

1. **Reducing Transition Evaluations**: With `evaluateAfterComplete: true`, transitions are evaluated only once after all updates instead of after each update
2. **Minimizing DOM Updates**: In UI applications, reducing the number of state transitions can prevent excessive re-renders
3. **Optimizing Network Operations**: When state changes trigger network requests, batching can reduce the number of calls

### Performance Comparison

Consider a typical scenario with 10 updates:

| Approach | Transition Evaluations | Render Cycles | Relative Performance |
|----------|------------------------|---------------|----------------------|
| Individual updates | 10 | Up to 10 | Baseline |
| Batch updates (default) | 10 | Up to 10 | Similar to baseline |
| Batch updates (evaluateAfterComplete) | 1 | 1 | 5-10x faster |

## Best Practices

### When to Use Batch Updates

- **Multiple Related Changes**: When multiple properties need to change together
- **Sequential Operations**: For step-by-step operations that build on each other
- **All-or-Nothing Requirements**: When changes must be applied as a unit
- **Performance Optimization**: To reduce unnecessary transition evaluations

### When to Use Atomic Mode

- **Data Consistency**: When partial updates would leave the system in an invalid state
- **Transactional Operations**: For operations that must either completely succeed or completely fail
- **Dependent Changes**: When later updates depend on earlier ones succeeding

### When to Use Non-Atomic Mode

- **Independent Changes**: When each update can succeed or fail independently
- **Partial Progress**: When partial completion is better than complete failure
- **Resilient Operations**: For operations that should continue despite some failures

## Examples

### User Registration Flow

```typescript
// Define states
machine.from("collectingInfo")
  .to("validating", ctx => ctx.email && ctx.password && ctx.name)
  .to("error", ctx => ctx.attempts > 3);

machine.from("validating")
  .to("registered", ctx => ctx.isValid)
  .to("error", ctx => !ctx.isValid);

// Process registration form
async function submitRegistration(formData) {
  return machine.state.batchUpdate(
    [
      { name: formData.name },
      { email: formData.email },
      { password: formData.password },
      { isValid: await validateUser(formData) }
    ],
    { 
      evaluateAfterComplete: true,
      atomic: true 
    }
  );
}
```

### Shopping Cart Checkout

```typescript
async function processCheckout(cart, paymentDetails) {
  try {
    const success = await machine.state.batchUpdate(
      [
        { status: 'processing' },
        { paymentVerified: await verifyPayment(paymentDetails) },
        { inventoryReserved: await reserveInventory(cart.items) },
        { orderCreated: await createOrder(cart, paymentDetails) },
        { status: 'completed' }
      ],
      { atomic: true }
    );
    
    return success;
  } catch (error) {
    console.error('Checkout failed:', error);
    return false;
  }
}
```

## Debugging Tips

When using batch updates with debugging enabled:

1. **Performance Metrics**: The debug system records detailed metrics about batch updates
2. **Error Information**: Logs include which update failed and why
3. **Context Comparison**: Original and final contexts are logged

To view detailed logs during batch updates:

```typescript
const machine = new FluentState({
  initialState: "idle",
  debug: {
    logLevel: "debug",
    measurePerformance: true
  }
});
```

## Conclusion

Batch updates provide a powerful way to manage complex state transitions in your application. By carefully using the configuration options, you can ensure data consistency, optimize performance, and handle errors gracefully. 