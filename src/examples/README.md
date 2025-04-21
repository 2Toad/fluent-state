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

## Transition Groups Example

The `transition-groups.ts` file demonstrates how to create and manage groups of transitions:

- Creating basic transition groups
- Working with namespaced groups
- Enabling and disabling groups
- Serializing and deserializing groups

### Key Concepts Demonstrated

1. **Group Creation and Configuration**
   - Creating groups with different priorities and configs
   - Adding transitions to specific groups

2. **Namespaces**
   - Using namespaces to organize groups (e.g., "media:upload")
   - Retrieving groups by namespaced names

3. **Enable/Disable Management**
   - Disabling and enabling groups
   - Temporarily disabling groups with automatic re-enabling

4. **Serialization**
   - Exporting group configurations
   - Recreating groups from serialized data
   - Handling function serialization with condition maps

## Configuration Inheritance Example

The `configuration-inheritance.ts` file demonstrates hierarchical configuration inheritance and dynamic configuration:

- Creating parent-child relationships between groups
- Inheriting and overriding configuration
- Dynamic configuration based on context

### Key Concepts Demonstrated

1. **Configuration Hierarchy**
   - Parent groups provide baseline configuration
   - Child groups can inherit or override parent settings
   - Multi-level inheritance chains

2. **Dynamic Configuration**
   - Using functions instead of static values for configuration
   - Adapting configuration based on system context
   - Performance optimization through dynamic settings

3. **Configuration Evaluation**
   - Resolving the effective configuration at runtime
   - Static vs. dynamic configuration resolution

## Nested Groups Example

The `nested-groups.ts` file demonstrates complex group hierarchies and operations:

- Creating multi-level group hierarchies
- Cascading operations through group hierarchies
- Group composition and cloning
- Navigating group relationships

### Key Concepts Demonstrated

1. **Group Hierarchies**
   - Parent, child, and grandchild group relationships
   - Inheritance of configuration through hierarchies

2. **Cascading Operations**
   - Enabling/disabling groups with cascade option
   - Propagating changes through the hierarchy

3. **Group Composition**
   - Creating template groups
   - Composing groups to inherit transitions and configuration

4. **Hierarchy Navigation**
   - Getting hierarchy paths, children, and descendants
   - Working with siblings and finding the root group

5. **Serialization and Cloning**
   - Exporting entire hierarchies
   - Cloning groups to different state machines

## Transition Groups with Tags Example

The `transition-groups-with-tags.ts` file demonstrates tagging transitions and automatic cleanup:

- Adding tags to transitions for categorization
- Finding transitions by tags
- Automatic cleanup when states are removed

### Key Concepts Demonstrated

1. **Transition Tagging**
   - Adding semantic tags to transitions
   - Using multiple tags for a single transition

2. **Tag-Based Retrieval**
   - Finding all available tags in a group
   - Retrieving transitions that match specific tags

3. **Automatic Cleanup**
   - Automatic removal of transitions when states are removed
   - Cleanup of associated tags 

## Conditional Auto-transition Evaluation Example

The `conditional-evaluation.ts` file demonstrates how to control when auto-transitions are evaluated:

- Fine-grained control over transition evaluation
- Property-based evaluation triggering
- Conditional evaluation skipping
- Different evaluation timing strategies

### Running the Example

To run the example:

```bash
# Compile the TypeScript files
npm run build

# Run the example
node dist/examples/conditional-evaluation.js
```

### What to Expect

The example simulates a form validation and submission flow:

1. User filling out a form with debounced email validation
2. Form validation that only runs when specific properties change
3. Validation that is skipped when the app is offline
4. Form submission using different evaluation timing strategies

You should see console output showing:
- The state transitions as the user interacts with the form
- How watchProperties affects which context updates trigger evaluation
- How skipIf prevents validation when offline
- How different evaluation strategies affect when transitions are processed

### Key Concepts Demonstrated

1. **Property-based Evaluation Triggering**
   - Using `watchProperties` to specify which context properties trigger evaluation
   - Support for deep property paths using dot notation
   - Performance optimization by avoiding unnecessary evaluations

2. **Conditional Evaluation Skipping**
   - Using `skipIf` to bypass evaluation when certain conditions are met
   - Early exit from evaluation to improve performance
   - Manual transitions still work even when auto-transitions are skipped

3. **Evaluation Timing Strategies**
   - `immediate` strategy (default) for synchronous evaluation
   - `nextTick` strategy to defer evaluation to the next event loop tick
   - `idle` strategy to use browser idle time for non-critical transitions

4. **Integration with Other Features**
   - Combining with debounce for improved user experience
   - Working with complex state objects and nested properties
   - Comprehensive state machine example showing real-world usage 