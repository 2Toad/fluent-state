import { FluentState } from "../fluent-state";

/**
 * This example demonstrates two new features for Transition Groups:
 * 1. Tagging transitions for sub-categorization
 * 2. Automatic removal of transitions from groups when states are removed from the state machine
 */

// Create a state machine for a workflow application
const workflow = new FluentState({
  initialState: "draft",
});

// Create a group for the main approval flow
const mainApprovalFlow = workflow.createGroup("approval").withConfig({
  priority: 10,
});

// Create a group for the review flow
const reviewFlow = workflow.createGroup("review").withConfig({
  priority: 5,
});

// Define states and transitions with tags for the main approval flow
mainApprovalFlow
  .from("draft")
  .withTags("edit", "initial")
  .to("review", {
    condition: () => true,
    targetState: "review",
  });

mainApprovalFlow
  .from("review")
  .withTags("approval", "critical")
  .to("approved", {
    condition: () => true,
    targetState: "approved",
  })
  .withTags("approval", "rejection")
  .or("rejected", {
    condition: () => false,
    targetState: "rejected",
  });

mainApprovalFlow
  .from("approved")
  .withTags("publication")
  .to("published", {
    condition: () => true,
    targetState: "published",
  });

// Define states and transitions with tags for the review flow
reviewFlow
  .from("review")
  .withTags("review", "request-changes")
  .to("changes-requested", {
    condition: () => true,
    targetState: "changes-requested",
  });

reviewFlow
  .from("changes-requested")
  .withTags("review", "resubmission")
  .to("review", {
    condition: () => true,
    targetState: "review",
  });

// Log all available tags in the groups
console.log("--- Available tags in the main approval flow ---");
const approvalTags = new Set<string>();
workflow
  .group("approval")!
  .serialize()
  .transitions.forEach((transition) => {
    if (transition.tags) {
      transition.tags.forEach((tag) => approvalTags.add(tag));
    }
  });
console.log([...approvalTags]);

console.log("\n--- Available tags in the review flow ---");
const reviewTags = new Set<string>();
workflow
  .group("review")!
  .serialize()
  .transitions.forEach((transition) => {
    if (transition.tags) {
      transition.tags.forEach((tag) => reviewTags.add(tag));
    }
  });
console.log([...reviewTags]);

// Find transitions with specific tags
console.log("\n--- Transitions with 'approval' tag ---");
const approvalTransitions = workflow.group("approval")!.getTransitionsByTag("approval");
approvalTransitions.forEach(([from, to]) => {
  console.log(`From: ${from} -> To: ${to}`);
});

// Demonstrate state removal cleanup
console.log("\n--- Before removing 'changes-requested' state ---");
console.log(`Transitions in review flow: ${workflow.group("review")!.serialize().transitions.length}`);

// Remove a state
console.log("\n--- Removing 'changes-requested' state ---");
workflow.remove("changes-requested");

// Check transitions after state removal
console.log("\n--- After removing 'changes-requested' state ---");
console.log(`Transitions in review flow: ${workflow.group("review")!.serialize().transitions.length}`);

// The group should no longer have transitions involving the removed state
const remainingTransitions = workflow.group("review")!.serialize().transitions;
console.log("Remaining transitions in review flow:");
remainingTransitions.forEach((transition) => {
  console.log(`From: ${transition.from} -> To: ${transition.to}`);
});

// Check that tags for the removed transitions are also cleaned up
console.log("\n--- Tags in review flow after state removal ---");
const remainingTags = new Set<string>();
workflow
  .group("review")!
  .serialize()
  .transitions.forEach((transition) => {
    if (transition.tags) {
      transition.tags.forEach((tag) => remainingTags.add(tag));
    }
  });
console.log([...remainingTags]);
