/**
 * Example demonstrating configuration inheritance between transition groups
 * and dynamic configuration based on application state.
 */

import { FluentState } from "../fluent-state";

// Create a state machine for an e-commerce checkout flow
const checkout = new FluentState();

// Define our checkout states
checkout._addState("shopping");
checkout._addState("cart");
checkout._addState("shipping");
checkout._addState("payment");
checkout._addState("confirmation");
checkout._addState("complete");

// System context that will influence dynamic configuration
const systemContext = {
  userLevel: "premium", // Can be "regular" or "premium"
  serverLoad: 0.3, // 0.0 to 1.0 representing server load
  peakHours: false, // Whether we're in peak shopping hours
};

/**
 * Parent group for all checkout transitions
 * Sets baseline configuration for all checkout steps
 */
const checkoutFlow = checkout.createGroup("checkout-flow");
checkoutFlow.withConfig({
  // Higher priority for checkout transitions than other transitions
  priority: 10,

  // Use dynamic configuration for debounce based on system load
  // During high load, we increase debounce time to reduce server pressure
  debounce: (ctx) => {
    const { serverLoad } = ctx as typeof systemContext;
    // Scale debounce from 50ms at low load to 500ms at high load
    return Math.round(50 + serverLoad * 450);
  },

  // Basic retry configuration for transient errors
  retryConfig: {
    maxAttempts: 3,
    delay: 100,
  },
});

// Define basic transitions in the parent group
checkoutFlow.from("shopping").to("cart", {
  condition: () => true,
  targetState: "cart",
});

/**
 * Child group for payment processing
 * Inherits configuration from the checkout flow parent group
 */
const paymentProcessing = checkoutFlow.createChildGroup("payment-processing");
paymentProcessing.withConfig({
  // Override priority to be higher - payment is critical
  priority: 20,

  // Configure retry settings for payment specifically
  retryConfig: {
    // Dynamic max attempts based on user level
    maxAttempts: (ctx) => {
      const { userLevel } = ctx as typeof systemContext;
      return userLevel === "premium" ? 5 : 3; // More retries for premium users
    },
    // Longer delay for payment retries
    delay: 300,
  },
});

// Add payment-specific transitions
paymentProcessing.from("payment").to("confirmation", {
  condition: () => true,
  targetState: "confirmation",
});

/**
 * Special VIP fast-track group for premium customers
 * Inherits from payment processing, creating a 3-level hierarchy
 */
const vipFastTrack = paymentProcessing.createChildGroup("vip-fast-track");
vipFastTrack.withConfig({
  // No debounce for VIP users
  debounce: 0,

  // Dynamic priority that increases during peak hours
  priority: (ctx) => {
    const { peakHours } = ctx as typeof systemContext;
    return peakHours ? 50 : 30; // Even higher priority during peak hours
  },
});

// Demonstrating the inheritance hierarchy
console.log("Configuration Inheritance Example:");
console.log("-----------------------------------");

// Function to evaluate and print a group's effective configuration
function printEffectiveConfig(groupName: string, fromState: string, toState: string) {
  const group = checkout.group(groupName);

  if (group) {
    // Get configuration without context (static values only)
    const staticConfig = group.getEffectiveConfig(fromState, toState);

    // Get configuration with context (evaluates dynamic functions)
    const dynamicConfig = group.getEffectiveConfig(fromState, toState, systemContext);

    console.log(`\n${groupName} (${fromState} → ${toState}):`);
    console.log("Static config (without context):");
    console.log("  Priority:", staticConfig?.priority);
    console.log("  Debounce:", staticConfig?.debounce);
    console.log("  Retry max:", staticConfig?.retryConfig?.maxAttempts);
    console.log("  Retry delay:", staticConfig?.retryConfig?.delay);

    console.log("Dynamic config (with context):");
    console.log("  Priority:", dynamicConfig?.priority);
    console.log("  Debounce:", dynamicConfig?.debounce);
    console.log("  Retry max:", dynamicConfig?.retryConfig?.maxAttempts);
    console.log("  Retry delay:", dynamicConfig?.retryConfig?.delay);
  }
}

// Example transitions showing inheritance and dynamic configuration
checkoutFlow.from("cart").to("shipping", {
  condition: () => true,
  targetState: "shipping",
});
paymentProcessing.from("shipping").to("payment", {
  condition: () => true,
  targetState: "payment",
});
vipFastTrack.from("confirmation").to("complete", {
  condition: () => true,
  targetState: "complete",
});

// Print configurations to see inheritance and dynamic evaluation
printEffectiveConfig("checkout-flow", "cart", "shipping");
printEffectiveConfig("payment-processing", "shipping", "payment");
printEffectiveConfig("vip-fast-track", "confirmation", "complete");

// Change context values to demonstrate dynamic configuration
console.log("\n\nUpdating system context:");
console.log("-----------------------------------");
systemContext.serverLoad = 0.9; // High server load
systemContext.peakHours = true; // Now in peak hours
systemContext.userLevel = "regular"; // Change user level

// Print again with updated context
printEffectiveConfig("checkout-flow", "cart", "shipping");
printEffectiveConfig("payment-processing", "shipping", "payment");
printEffectiveConfig("vip-fast-track", "confirmation", "complete");
