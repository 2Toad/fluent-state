# Transition Groups

Transition Groups provide a powerful way to organize and manage related transitions within a state machine. They allow you to group transitions based on functionality, enable or disable sets of transitions as a unit, and apply common configuration to multiple transitions.

## Overview

Transition Groups offer several key benefits:

1. **Organization**: Group transitions by feature, workflow, or responsibility
2. **Collective Management**: Enable, disable, or configure multiple transitions at once
3. **Modularity**: Create reusable transition patterns that can be imported/exported
4. **Hierarchical Configuration**: Create parent-child relationships where child groups inherit configuration from parents
5. **Dynamic Configuration**: Define configuration values as functions that adapt to application state at runtime
6. **Tagging**: Further organize transitions within groups using tags
7. **Runtime Control**: Selectively activate or deactivate parts of your state machine

## Features

### 1. Group Creation and Management

#### Creating Groups

```typescript
// Create a group with a simple name
const mainFlow = fluentState.createGroup("main");

// Create a namespaced group
const authFlow = fluentState.createGroup("auth:login");
```

Groups can be retrieved, queried, and removed:

```typescript
// Get a group by name
const group = fluentState.group("main");

// Check if a group exists
if (fluentState.groups.has("main")) {
  // Do something with the group
}

// Get all groups
const allGroups = fluentState.getAllGroups();

// Remove a group
fluentState.removeGroup("main");
```

### 2. Transition Definition and Organization

Transition Groups use a fluent API for defining transitions:

```typescript
// Define transitions with a fluent API
group
  .from("stateA")
  .to("stateB", {
    condition: (state, context) => context.isValid,
    priority: 10
  })
  .or("stateC", {
    condition: (state, context) => !context.isValid,
    priority: 5
  });

// Add transitions directly
group.addTransition("stateA", "stateD", {
  condition: () => true,
  targetState: "stateD"
});
```

Check and manage transitions:

```typescript
// Check if a transition exists
if (group.hasTransition("stateA", "stateB")) {
  // Do something
}

// Get the configuration for a transition
const config = group.getEffectiveConfig("stateA", "stateB");

// Remove a transition
group.removeTransition("stateA", "stateB");
```

### 3. Group-level Configuration

Transition Groups allow you to set configuration options that apply to all transitions in the group:

```typescript
group.withConfig({
  // Set priority for all transitions in this group
  priority: 10,
  
  // Apply debounce to all transitions
  debounce: 200,
  
  // Configure retry behavior
  retryConfig: {
    maxAttempts: 3,
    delay: 100
  }
});
```

Individual transitions can override group-level settings:

```typescript
group
  .from("stateA")
  .to("stateB", {
    // Override group priority for this specific transition
    priority: 20,
    condition: () => true
  });
```

### 4. Configuration Inheritance

Transition Groups support parent-child relationships where child groups inherit configuration from their parents:

```typescript
// Create a parent group with base configuration
const parentGroup = fluentState.createGroup("checkout-flow")
  .withConfig({
    priority: 10,
    debounce: 200,
    retryConfig: {
      maxAttempts: 3,
      delay: 100
    }
  });

// Create a child group that inherits from parent
const childGroup = parentGroup.createChildGroup("payment-processing");

// Or set parent after creation
const anotherChild = fluentState.createGroup("shipping");
anotherChild.setParent(parentGroup);

// Check parent-child relationships
const parent = childGroup.getParent(); // Returns parentGroup
const children = parentGroup.getChildGroups(); // Returns array of child groups
```

Child groups inherit all configuration from parent groups, but can override specific settings:

```typescript
// Override some settings, inherit others
childGroup.withConfig({
  priority: 20, // Override parent's priority
  // Will inherit parent's debounce and retryConfig
});
```

Inheritance supports multi-level hierarchies, with configurations cascading from ancestors to descendants:

```typescript
// Create three-level hierarchy
const grandchildGroup = childGroup.createChildGroup("special-payment");

// Configuration resolution follows the chain:
// grandchildGroup <- childGroup <- parentGroup
```

When a transition's configuration is evaluated, the most specific (nearest ancestor's) value is used.

### 5. Dynamic Configuration

Transition Groups support dynamic configuration values that are evaluated at runtime based on context:

```typescript
group.withConfig({
  // Dynamic priority based on context
  priority: (context) => context.isPriority ? 10 : 5,
  
  // Dynamic debounce based on system load
  debounce: (context) => context.systemLoad > 0.8 ? 500 : 100,
  
  // Dynamic retry settings
  retryConfig: {
    maxAttempts: (context) => context.isImportant ? 5 : 3,
    delay: (context) => context.networkSpeed === 'slow' ? 200 : 50
  }
});
```

When retrieving a transition's configuration, provide the context to evaluate dynamic values:

```typescript
// Get configuration with context evaluation
const appContext = { 
  isPriority: true,
  systemLoad: 0.9,
  isImportant: true,
  networkSpeed: 'slow'
};

const config = group.getEffectiveConfig("stateA", "stateB", appContext);
// config.priority will be 10
// config.debounce will be 500
// config.retryConfig.maxAttempts will be 5
// config.retryConfig.delay will be 200
```

If you don't provide a context when getting configuration, dynamic values will be undefined:

```typescript
// Without context, dynamic values aren't evaluated
const staticConfig = group.getEffectiveConfig("stateA", "stateB");
// Dynamic values will be undefined
```

Dynamic configuration works with inheritance - a child group can override a parent's static value with a dynamic one, or vice versa:

```typescript
parentGroup.withConfig({
  priority: 10 // Static
});

childGroup.withConfig({
  priority: (context) => context.userLevel === 'vip' ? 20 : 5 // Dynamic
});
```

Note that dynamic configuration functions are not serialized. When serializing a group with dynamic configuration, only static values will be included.

### 6. Transition Tagging

Tags provide an additional level of organization within groups:

```typescript
// Add tags when creating transitions
group
  .from("review")
  .withTags("approval", "critical")
  .to("approved", {
    condition: () => true
  })
  .withTags("rejection")
  .or("rejected", {
    condition: () => false
  });

// Add tags to existing transitions
group.addTagsToTransition("review", "approved", ["important"]);

// Get transitions by tag
const approvalTransitions = group.getTransitionsByTag("approval");
// Returns: [["review", "approved"], ["review", "rejected"]]

// Get tags for a transition
const tags = group.getTagsForTransition("review", "approved");
// Returns: ["approval", "critical", "important"]

// Remove a tag
group.removeTagFromTransition("review", "approved", "important");
```

### 7. Enabling and Disabling Groups

Transition Groups can be enabled or disabled to control which transitions are active:

```typescript
// Disable a group
group.disable();

// Disable a group and prevent manual transitions as well
group.disable({ preventManualTransitions: true });

// Check if a group is enabled
const isEnabled = group.isEnabled(); // false

// Check if manual transitions are allowed
const canTransition = group.allowsManualTransitions(); // false

// Re-enable a group (also clears preventManualTransitions setting)
group.enable();

// Temporarily disable a group
group.disableTemporarily(5000, () => {
  console.log("Group has been re-enabled after 5 seconds");
});

// Temporarily disable with prevention of manual transitions
group.disableTemporarily(5000, undefined, { preventManualTransitions: true });
```

Groups can also be conditionally enabled based on context data, using predicate functions:

```typescript
// Set a predicate that enables the group only for premium users
group.setEnablePredicate((context) => context.userType === 'premium');

// Check if the group is enabled in a specific context
const appContext = { userType: 'regular' };
const isPremiumEnabled = group.isEnabled(appContext); // false

// Clear the predicate function
group.clearEnablePredicate();
```

When using predicates and manual transitions, there are a few important behaviors to understand:

```typescript
// When a group is explicitly disabled but preventManualTransitions is false (default),
// manual transitions are still allowed
group.disable();
const allowsManual1 = group.allowsManualTransitions(); // true

// When a group is explicitly disabled and preventManualTransitions is true,
// manual transitions are blocked
group.disable({ preventManualTransitions: true });
const allowsManual2 = group.allowsManualTransitions(); // false

// When a group is disabled only because a predicate returns false,
// manual transitions are still allowed
group.enable(); // First enable the group
group.setEnablePredicate((context) => context.isPremium);
const context = { isPremium: false };
const isEnabled = group.isEnabled(context); // false (disabled by predicate)
const allowsManual3 = group.allowsManualTransitions(context); // true (manual transitions still allowed)
```

It's important to understand the difference between `isEnabled()` and `allowsManualTransitions()`:

- `isEnabled(context)` checks both the explicit enabled flag AND evaluates the predicate function (if any)
- `allowsManualTransitions(context)` only checks the preventManualTransitions flag when the group is explicitly disabled

This means that even if a group would be disabled by a predicate for a given context (i.e., `isEnabled(context)` returns `false`), manual transitions are still allowed unless the group was explicitly disabled with `preventManualTransitions: true`.

The predicate function is evaluated at runtime when checking if a group is enabled. This allows for dynamic, context-aware enabling and disabling of groups.

### 8. Event Handling

Transition Groups support a powerful event handling system that lets you respond to transitions, enabling, and disabling events. All event handlers provide a fluent API for easy chaining.

#### Transition Events

You can register handlers to be notified when transitions occur in a group:

```typescript
// Register a handler for transitions
group.onTransition((fromState, toState, context) => {
  console.log(`Transition from ${fromState} to ${toState}`);
  console.log('Context:', context);
});

// Register a one-time handler (removed after first call)
group.onceTransition((fromState, toState, context) => {
  console.log(`First transition from ${fromState} to ${toState}`);
});

// Remove a previously registered handler
group.offTransition(handlerFunction);
```

#### Enable/Disable Events

You can also register handlers for when groups are enabled or disabled:

```typescript
// Register enable handler
group.onEnable((context) => {
  console.log('Group enabled with context:', context);
});

// Register disable handler
group.onDisable((preventManualTransitions, context) => {
  console.log(`Group disabled (preventManualTransitions=${preventManualTransitions})`);
  console.log('Context:', context);
});

// Register one-time handlers
group.onceEnable(handler);
group.onceDisable(handler);

// Remove handlers
group.offEnable(enableHandler);
group.offDisable(disableHandler);
```

#### Event Bubbling

Events automatically bubble up to parent groups, allowing you to handle events at different levels of your group hierarchy:

```typescript
// Create parent and child groups
const parentGroup = fs.createGroup("parent");
const childGroup = parentGroup.createChildGroup("child");

// Register handlers at each level
parentGroup.onTransition((from, to) => {
  console.log(`Parent saw transition from ${from} to ${to}`);
});

childGroup.onTransition((from, to) => {
  console.log(`Child saw transition from ${from} to ${to}`);
});

// When a transition occurs in the child group, both handlers will fire
// Child handlers fire first, then parent handlers
```

This event bubbling applies to all types of events (transitions, enabling, disabling), allowing for centralized event handling in parent groups.

#### Practical Use Cases

Event handlers are useful for a variety of purposes:

1. **Logging**: Track state changes throughout your application
2. **Analytics**: Send events to analytics services when important transitions occur
3. **UI Updates**: Trigger UI refreshes when certain transitions happen
4. **Syncing**: Keep external systems in sync with your state machine
5. **Notifications**: Alert users or systems when specific states are reached

```typescript
// Example: Tracking user flow in an analytics system
const checkoutGroup = fs.createGroup("checkout");

checkoutGroup.onTransition((from, to, context) => {
  if (to === "purchased") {
    analytics.track("Purchase Completed", {
      orderId: context.orderId,
      amount: context.totalAmount,
      previousStep: from
    });
  }
});

// Example: Feature flag system events
const betaFeaturesGroup = fs.createGroup("betaFeatures");

betaFeaturesGroup.onEnable(() => {
  logger.info("Beta features enabled");
  notifyAdmins("Beta features are now active");
});

betaFeaturesGroup.onDisable((preventManual) => {
  logger.info(`Beta features disabled (manual transitions ${preventManual ? 'prevented' : 'allowed'})`);
  notifyAdmins("Beta features have been deactivated");
});
```

### 9. Group-Level Middleware

Transition Groups support middleware functions that can intercept, validate, or modify transitions before they occur. Middleware provides a powerful mechanism for implementing cross-cutting concerns like validation, logging, authorization, or data transformation.

Unlike event handlers that are called after a transition occurs, middleware runs before the transition and can allow, block, or modify the transition.

#### Adding and Removing Middleware

```typescript
// Add middleware to a group
group.middleware((fromState, toState, proceed, context) => {
  // Validate the transition
  if (shouldAllowTransition(fromState, toState, context)) {
    // Allow the transition to continue
    proceed();
  } else {
    // Block the transition by not calling proceed()
    console.log(`Blocked transition from ${fromState} to ${toState}`);
  }
});

// Add another middleware - these run in the order they're added
group.middleware((fromState, toState, proceed, context) => {
  // Log all transitions
  console.log(`Transition attempt: ${fromState} -> ${toState}`);
  // Allow the transition
  proceed();
});

// Remove middleware
group.removeMiddleware(middlewareFunction);
```

#### Middleware Execution Flow

Middleware functions are executed in the order they are added. Each middleware must explicitly call the `proceed()` function to allow the transition to continue to the next middleware or to execute the transition if it's the last middleware in the chain.

If any middleware doesn't call `proceed()`, the transition is blocked, and subsequent middleware in the chain will not run.

```typescript
// Detailed middleware execution flow
group.middleware((fromState, toState, proceed, context) => {
  console.log("First middleware running");
  
  // Asynchronous operations are supported
  setTimeout(() => {
    console.log("After async operation");
    proceed(); // Continue to next middleware
  }, 100);
});

group.middleware((fromState, toState, proceed, context) => {
  console.log("Second middleware running");
  // If first middleware doesn't call proceed(), this won't run
  proceed(); // Continue to the transition
});

// If all middleware call proceed(), the transition executes
```

#### Modifying Context Data

Middleware can modify the context data passed to transitions, allowing for data transformation or enrichment:

```typescript
// Middleware that modifies context
group.middleware((fromState, toState, proceed, context) => {
  if (context) {
    // Add timestamp to all transitions
    context.transitionTimestamp = Date.now();
    
    // Add tracking info
    context.transitionInfo = {
      from: fromState,
      to: toState,
      user: getCurrentUser()
    };
  }
  proceed();
});
```

#### Error Handling

Errors in middleware are caught and handled gracefully. By default, if a middleware throws an error, the transition is blocked for safety:

```typescript
// Error handling in middleware
group.middleware((fromState, toState, proceed, context) => {
  try {
    // Some operation that might throw
    const result = validateTransition(fromState, toState, context);
    if (result.valid) {
      proceed();
    }
  } catch (error) {
    console.error("Error in middleware:", error);
    // Not calling proceed() blocks the transition
  }
});
```

#### Asynchronous Middleware

Middleware functions can be asynchronous, allowing for API calls, database lookups, or other async operations:

```typescript
// Async middleware with async/await
group.middleware(async (fromState, toState, proceed, context) => {
  try {
    // Asynchronous operation
    const isAuthorized = await checkPermission(context.userId, toState);
    
    if (isAuthorized) {
      proceed();
    } else {
      logAuthFailure(context.userId, fromState, toState);
      // Not calling proceed() blocks the transition
    }
  } catch (error) {
    console.error("Authorization check failed:", error);
    // Not calling proceed() blocks the transition
  }
});
```

#### Middleware vs. Event Handlers

It's important to understand the difference between middleware and event handlers:

1. **Timing**: Middleware runs *before* a transition occurs and can prevent it. Event handlers run *after* a transition has already occurred.
2. **Control Flow**: Middleware can block transitions by not calling `proceed()`. Event handlers can't prevent a transition that has already happened.
3. **Chaining**: Middleware execution is sequential and conditional on previous middleware allowing the transition. All event handlers are always executed for a transition.
4. **Purpose**: Middleware is for validation, authorization, or modifying transitions. Event handlers are for responding to transitions after they occur.

#### Practical Use Cases

Middleware is useful for various scenarios:

1. **Validation**: Ensure transitions meet certain criteria before allowing them
2. **Authorization**: Check if the user has permission to make a transition
3. **Rate Limiting**: Prevent too many transitions in a short time
4. **Logging**: Record details about transition attempts
5. **Data Transformation**: Modify or augment context data for transitions
6. **Integration**: Connect with external systems before state changes

```typescript
// Example: Authorization middleware
const authMiddleware = (fromState, toState, proceed, context) => {
  // Only allow admin users to transition to sensitive states
  if (toState === "admin-panel" && context?.user?.role !== "admin") {
    console.warn(`User ${context?.user?.id} attempted unauthorized access to admin panel`);
    return; // Block by not calling proceed()
  }
  
  // Allow the transition for authorized users
  proceed();
};

// Add the middleware to the group
adminGroup.middleware(authMiddleware);

// Example: Data transformation middleware
const dataEnrichmentMiddleware = (fromState, toState, proceed, context) => {
  // Enrich context with additional data
  if (context) {
    context.previousState = fromState;
    context.transitionTimestamp = Date.now();
    context.environment = process.env.NODE_ENV;
  }
  proceed();
};

// Add the middleware to all groups
allGroups.forEach(group => group.middleware(dataEnrichmentMiddleware));
```

### 10. Automatic Cleanup

When a state is removed from the state machine, all transitions involving that state are automatically removed from all groups:

```typescript
// Before removing state 'review'
group.hasTransition("a", "review"); // true
group.hasTransition("review", "b"); // true

// Remove state 'review'
fluentState.remove("review");

// After removal
group.hasTransition("a", "review"); // false
group.hasTransition("review", "b"); // false
```

This cleanup also includes removing tags associated with the removed transitions.

### 11. Serialization and Deserialization

Transition Groups can be serialized for storage or transmission:

```typescript
// Serialize a group
const serialized = group.serialize();

// Export all groups
const allGroupsData = fluentState.exportGroups();
```

And later deserialized:

```typescript
// Create a group from serialized data
const conditionMap = {
  stateA: {
    stateB: (state, context) => context.isValid
  }
};
const newGroup = fluentState.createGroupFromConfig(serialized, conditionMap);

// Import multiple groups
fluentState.importGroups(
  allGroupsData, 
  conditionMaps, 
  { 
    skipExisting: true, 
    replaceExisting: false 
  }
);
```

Note that since functions can't be serialized, you need to provide condition functions separately when deserializing.

### 12. Integration with Transition History

Transition Groups are fully integrated with FluentState's transition history feature, allowing you to track and analyze transitions by group:

```typescript
// Create a state machine with history enabled
const fs = new FluentState({
  initialState: "idle",
  enableHistory: true
});

// Create a group
const authGroup = fs.createGroup("auth");

// Add transitions to the group
authGroup
  .from("idle")
  .to("authenticating", {
    condition: (_, context) => context.credentials !== null,
    targetState: "authenticating"
  })
  .from("authenticating")
  .to("authenticated", {
    condition: (_, context) => context.isAuthenticated,
    targetState: "authenticated"
  })
  .or("error", {
    condition: (_, context) => context.authError !== null,
    targetState: "error"
  });

// Start the state machine
await fs.start();

// Perform transitions
await fs.transition("authenticating", { credentials: { username: "user", password: "pass" } });
await fs.transition("authenticated", { isAuthenticated: true });

// Get all transitions in the group
const allTransitions = authGroup.getAllTransitions();
// Returns: [["idle", "authenticating"], ["authenticating", "authenticated"], ["authenticating", "error"]]

// Get transition history for this group
const groupHistory = authGroup.getTransitionHistory();
// Returns an array of transition history entries for this group
```

#### History Features

When transition history is enabled, the following features are available:

1. **Group Name in History**: All transition history entries include the group name for transitions that belong to a group
2. **Group-Specific History**: Use `getTransitionHistory()` on a group to get only transitions that occurred within that group
3. **Query by Group**: Use `history.getTransitionsForGroup(groupName)` to query transitions by group name
4. **Initial State Tracking**: If the initial state belongs to a group, it's recorded with the group name in history

These features enable powerful debugging, visualization, and analysis capabilities:

```typescript
// Get all transitions for a specific group
const authTransitions = fs.history.getTransitionsForGroup("auth");

// Analyze transition patterns
const successfulTransitions = authTransitions.filter(t => t.success);
const failedTransitions = authTransitions.filter(t => !t.success);

// Track transition timing
const transitionTimes = authTransitions.map(t => t.timestamp);
const averageTransitionTime = calculateAverageTimeBetween(transitionTimes);

// Visualize group transitions
const visualization = createTransitionGraph(authTransitions);
```

#### Implementation Details

The integration with transition history works by:

1. Recording the group name when transitions occur
2. Providing methods to query and analyze transitions by group
3. Including group information in serialized history data

This integration is particularly useful for:

- Debugging complex state flows
- Analyzing user journeys through your application
- Identifying bottlenecks or issues in specific workflows
- Creating visualizations of state machine behavior

When a transition belongs to multiple groups, the first matching group is recorded in the history entry.

## Advanced Patterns

### Workflow Organization

Use groups to organize complex workflows:

```typescript
// Main approval flow
const approvalFlow = fluentState.createGroup("approval");

approvalFlow
  .from("draft")
  .to("review")
  .from("review")
  .withTags("approval")
  .to("approved")
  .withTags("rejection")
  .or("rejected");

// Exception handling flow
const exceptionFlow = fluentState.createGroup("exceptions");

exceptionFlow
  .from("draft")
  .to("canceled")
  .from("review")
  .to("canceled");
```

### Feature Toggling

Use the enable/disable functionality for feature toggling:

```typescript
// Disable beta features in production
if (process.env.NODE_ENV === "production") {
  fluentState.group("betaFeatures")?.disable();
}

// Temporarily enable a special workflow during a campaign
fluentState.group("campaign")?.disableTemporarily(
  campaignDuration,
  () => notifyAdmins("Campaign workflow disabled")
);
```

### Modularity with Serialization

Create reusable transition patterns that can be imported:

```typescript
// In a shared module
export const approvalWorkflow = {
  serialized: group.serialize(),
  conditionMap: {
    draft: {
      review: (state, context) => context.isComplete
    },
    review: {
      approved: (state, context) => context.isApproved,
      rejected: (state, context) => !context.isApproved
    }
  }
};

// In the consuming application
fluentState.createGroupFromConfig(
  approvalWorkflow.serialized, 
  approvalWorkflow.conditionMap
);
```

## Best Practices

1. **Meaningful Group Names**: Choose descriptive names that reflect the purpose of the group
2. **Use Namespaces**: For larger applications, use namespaces to categorize groups (e.g., "auth:login")
3. **Group by Functionality**: Create groups based on features or workflows rather than technical concerns
4. **Use Tags for Fine-grained Organization**: When transitions serve multiple purposes, use tags to indicate their roles
5. **Clean Up Groups**: Remove groups when they're no longer needed to avoid memory leaks
6. **Apply Common Configuration**: Use group-level configuration for consistency across related transitions
7. **Feature Toggle with Groups**: Use the enable/disable functionality to implement feature toggles

## Example: Document Approval System

```typescript
import { FluentState } from "fluent-state";

// Create a state machine for a document approval system
const workflow = new FluentState({
  initialState: "draft"
});

// System context with runtime variables
const systemContext = {
  userLevel: "admin", // Can be "user", "reviewer", or "admin"
  documentSize: 1.5, // Size in MB
  isUrgent: true
};

// Create a main group for the workflow with dynamic configuration
const mainFlow = workflow.createGroup("workflow").withConfig({
  // Higher priority for urgent documents
  priority: (ctx) => (ctx as typeof systemContext).isUrgent ? 15 : 10,
  
  // Debounce based on document size - larger docs need more time
  debounce: (ctx) => Math.round(100 + (ctx as typeof systemContext).documentSize * 50)
});

// Create a group for the main approval flow as a child of the main workflow
const approvalFlow = mainFlow.createChildGroup("approval").withConfig({
  // Inherit priority and debounce from parent, add retry config
  retryConfig: {
    maxAttempts: 3,
    delay: 100
  }
});

// Create a group for the review flow as another child
const reviewFlow = mainFlow.createChildGroup("review").withConfig({
  // Lower priority than approval flow
  priority: (ctx) => {
    // Base priority depends on user level
    let basePriority = 5;
    if ((ctx as typeof systemContext).userLevel === "admin") {
      basePriority = 8;
    }
    // Adjust for urgency (inherits dynamic behavior from parent)
    return (ctx as typeof systemContext).isUrgent ? basePriority + 5 : basePriority;
  }
});

// Define states and transitions with tags for the approval flow
approvalFlow
  .from("draft")
  .withTags("edit", "initial")
  .to("review", {
    condition: (state, context) => context.isDraftComplete,
    targetState: "review"
  });

approvalFlow
  .from("review")
  .withTags("approval", "critical")
  .to("approved", {
    condition: (state, context) => context.isApproved,
    targetState: "approved"
  })
  .withTags("approval", "rejection")
  .or("rejected", {
    condition: (state, context) => context.isRejected,
    targetState: "rejected"
  });

// Define states and transitions for the review flow
reviewFlow
  .from("review")
  .withTags("review", "request-changes")
  .to("changes-requested", {
    condition: (state, context) => context.needsChanges,
    targetState: "changes-requested"
  });

reviewFlow
  .from("changes-requested")
  .withTags("review", "resubmission")
  .to("review", {
    condition: (state, context) => context.changesSubmitted,
    targetState: "review"
  });

// Get effective configuration with context
const approvalConfig = approvalFlow.getEffectiveConfig("review", "approved", systemContext);
console.log("Approval transition configuration:");
console.log("- Priority:", approvalConfig?.priority); // 15 (from parent's dynamic config)
console.log("- Debounce:", approvalConfig?.debounce); // 175 (from parent's dynamic config)
console.log("- Retry attempts:", approvalConfig?.retryConfig?.maxAttempts); // 3 (from approvalFlow)

// Start the state machine
workflow.start();
```

This example demonstrates:
- A hierarchy of transition groups with configuration inheritance
- Dynamic configuration based on context variables
- Using tags to categorize transitions within groups
- Calculating effective configuration that combines static and dynamic values
- Runtime evaluation of configuration based on system context 

## API Reference

### Group Methods

#### Creation and Configuration

- `fluentState.createGroup(name: string, parentGroup?: string | TransitionGroup): TransitionGroup` - Creates a new transition group
- `group.withConfig(config: TransitionGroupConfig): TransitionGroup` - Sets configuration for the group
- `group.setParent(parentGroup: TransitionGroup): TransitionGroup` - Sets the parent group for inheritance
- `group.createChildGroup(name: string): TransitionGroup` - Creates a child group that inherits from this group

#### Transition Management

- `group.from(fromState: string): TransitionBuilder` - Starts defining transitions from a state
- `group.addTransition(fromState: string, toState: string, config?: AutoTransitionConfig, tags?: string[]): TransitionGroup` - Adds a transition to the group
- `group.removeTransition(fromState: string, toState: string): TransitionGroup` - Removes a transition from the group
- `group.hasTransition(fromState: string, toState: string): boolean` - Checks if a transition exists in the group
- `group.getEffectiveConfig(fromState: string, toState: string, context?: unknown): AutoTransitionConfig | undefined` - Gets the effective configuration for a transition

#### Transition Queries and History

- `group.getAllTransitions(): Array<[string, string]>` - Gets all transitions in this group as [fromState, toState] pairs
- `group.getTransitionHistory(): TransitionHistoryEntry[] | null` - Gets the history of transitions for this group (requires history to be enabled)
- `group.getTransitionsByTag(tag: string): Array<[string, string]>` - Gets transitions with a specific tag

#### Tagging

- `group.addTagsToTransition(fromState: string, toState: string, tags: string[]): TransitionGroup` - Adds tags to a transition
- `group.removeTagFromTransition(fromState: string, toState: string, tag: string): TransitionGroup` - Removes a tag from a transition
- `group.getTagsForTransition(fromState: string, toState: string): string[]` - Gets all tags for a transition

#### Enabling and Disabling

- `group.enable(): TransitionGroup` - Enables the group
- `group.disable(options?: { preventManualTransitions?: boolean }): TransitionGroup` - Disables the group
- `group.disableTemporarily(duration: number, callback?: () => void, options?: { preventManualTransitions?: boolean }): TransitionGroup` - Temporarily disables the group
- `group.isEnabled(context?: unknown): boolean` - Checks if the group is enabled
- `group.allowsManualTransitions(context?: unknown): boolean` - Checks if manual transitions are allowed
- `group.setEnablePredicate(predicate: (context: unknown) => boolean): TransitionGroup` - Sets a predicate function for conditional enabling
- `group.clearEnablePredicate(): TransitionGroup` - Clears the enable predicate function

#### Event Handling

- `group.onTransition(handler: TransitionHandler): TransitionGroup` - Adds a transition event handler
- `group.onceTransition(handler: TransitionHandler): TransitionGroup` - Adds a one-time transition event handler
- `group.offTransition(handler: TransitionHandler): TransitionGroup` - Removes a transition event handler
- `group.onEnable(handler: EnableHandler): TransitionGroup` - Adds an enable event handler
- `group.onceEnable(handler: EnableHandler): TransitionGroup` - Adds a one-time enable event handler
- `group.offEnable(handler: EnableHandler): TransitionGroup` - Removes an enable event handler
- `group.onDisable(handler: DisableHandler): TransitionGroup` - Adds a disable event handler
- `group.onceDisable(handler: DisableHandler): TransitionGroup` - Adds a one-time disable event handler
- `group.offDisable(handler: DisableHandler): TransitionGroup` - Removes a disable event handler

#### Middleware

- `group.middleware(middleware: GroupTransitionMiddleware): TransitionGroup` - Adds middleware to intercept transitions
- `group.removeMiddleware(middleware: GroupTransitionMiddleware): TransitionGroup` - Removes middleware

#### Serialization

- `group.serialize(): SerializedTransitionGroup` - Serializes the group to a plain object
- `group.deserialize(serialized: SerializedTransitionGroup, conditionMap?: Record<string, Record<string, AutoTransitionConfig["condition"]>>): TransitionGroup` - Deserializes a group from a plain object

### FluentState Methods for Groups

- `fluentState.group(name: string): TransitionGroup | null` - Gets a group by name
- `fluentState.removeGroup(name: string): boolean` - Removes a group
- `fluentState.getAllGroups(): TransitionGroup[]` - Gets all groups
- `fluentState.createGroupFromConfig(serialized: SerializedTransitionGroup, conditionMap?: Record<string, Record<string, AutoTransitionConfig["condition"]>>): TransitionGroup` - Creates a group from serialized configuration
- `fluentState.exportGroups(): SerializedTransitionGroup[]` - Exports all groups as serialized configurations
- `fluentState.importGroups(groups: SerializedTransitionGroup[], conditionMaps?: Record<string, Record<string, Record<string, AutoTransitionConfig["condition"]>>>, options?: { skipExisting?: boolean; replaceExisting?: boolean }): FluentState` - Imports groups from serialized configurations

### TransitionHistory Methods for Groups

- `history.getTransitionsForGroup(groupName: string): TransitionHistoryEntry[]` - Gets all transitions belonging to a specific group 