# Transition Groups

Transition Groups provide a powerful way to organize and manage related transitions within a state machine. They allow you to group transitions based on functionality, enable or disable sets of transitions as a unit, and apply common configuration to multiple transitions.

## Overview

Transition Groups offer several key benefits:

1. **Organization**: Group transitions by feature, workflow, or responsibility
2. **Collective Management**: Enable, disable, or configure multiple transitions at once
3. **Modularity**: Create reusable transition patterns that can be imported/exported
4. **Tagging**: Further organize transitions within groups using tags
5. **Runtime Control**: Selectively activate or deactivate parts of your state machine

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

### 4. Transition Tagging

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

### 5. Enabling and Disabling Groups

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

### 6. Automatic Cleanup

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

### 7. Serialization and Deserialization

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

// Create a group for the main approval flow
const mainFlow = workflow.createGroup("approval").withConfig({
  priority: 10
});

// Create a group for the review flow
const reviewFlow = workflow.createGroup("review").withConfig({
  priority: 5
});

// Define states and transitions with tags for the main approval flow
mainFlow
  .from("draft")
  .withTags("edit", "initial")
  .to("review", {
    condition: (state, context) => context.isDraftComplete,
    targetState: "review"
  });

mainFlow
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

// Start the state machine
workflow.start();
```

This example demonstrates:
- Multiple transition groups for different aspects of the workflow
- Using tags to categorize transitions within groups
- Group-level configuration for priorities
- Conditional transitions based on context 