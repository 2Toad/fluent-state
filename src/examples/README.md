# FluentState Examples

This directory contains example implementations demonstrating various features of FluentState.

## Performance Optimizations Example

The `performance-optimizations.ts` file demonstrates how to use the performance optimization features of FluentState:

- Batched updates
- Memoization of derived values
- Custom equality checking
- Performance metrics collection and reporting

### Running the Example

To run the example:

```bash
# Compile the TypeScript files
npm run build

# Run the example
node dist/examples/performance-optimizations.js
```

### What to Expect

The example simulates a shopping cart with various state updates:

1. Adding items to the cart (triggering state transitions)
2. Batching multiple rapid updates
3. Using custom equality checking to prevent unnecessary updates
4. Memoizing computed values (cart total)
5. Collecting and reporting performance metrics

You should see console output showing:
- The current state of the state machine
- The cart total (with indication of when it's recomputed vs. memoized)
- Performance metrics after each update

### Key Concepts Demonstrated

1. **Batched Updates**
   - Multiple updates within a time window are batched into a single update
   - Reduces unnecessary re-renders and improves performance

2. **Memoization**
   - Computed values are cached and only recalculated when dependencies change
   - The cart total is only recalculated when the items array changes

3. **Custom Equality Checking**
   - Prevents unnecessary updates when state is structurally equivalent
   - Custom logic for determining when the cart items have meaningfully changed

4. **Performance Metrics**
   - Tracks update frequency, duration, and count
   - Measures memory usage of state and memoized values
   - Times computation of equality checks, memoization, and derivations
   - Provides warnings when updates exceed performance thresholds 