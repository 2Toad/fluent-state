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

// Check if a group is enabled
const isEnabled = group.isEnabled(); // false

// Re-enable a group
group.enable();

// Temporarily disable a group
group.disableTemporarily(5000, () => {
  console.log("Group has been re-enabled after 5 seconds");
});
```

### 8. Automatic Cleanup

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

### 9. Serialization and Deserialization

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