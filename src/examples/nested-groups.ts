import { FluentState } from "../fluent-state";

// Define interfaces for our context types
interface EcommerceContext {
  itemsAdded: number;
  proceedToCheckout: boolean;
  shippingInfoComplete: boolean;
  paymentAuthorized: boolean;
  paymentFailed: boolean;
  isVipCustomer: boolean;
  hasStoredPaymentMethod: boolean;
  resetRequested: boolean;
  retryPayment: boolean;
}

// Create a state machine for an e-commerce application
const ecommerce = new FluentState({
  initialState: "browsing",
});

// Add states
["browsing", "cart", "checkout", "payment", "confirmation", "error"].forEach((state) => {
  ecommerce._addState(state);
});

// Create a parent group for the entire checkout flow
const checkoutFlow = ecommerce.createGroup("checkout-flow").withConfig({
  priority: 1,
  debounce: 100,
  retryConfig: {
    maxAttempts: 3,
    delay: 1000,
  },
});

// Add transitions to the parent group
checkoutFlow.from("browsing").to("cart", {
  condition: (_, context: EcommerceContext) => context.itemsAdded > 0,
  targetState: "cart",
});

checkoutFlow.from("cart").to("checkout", {
  condition: (_, context: EcommerceContext) => context.proceedToCheckout,
  targetState: "checkout",
});

// Create child groups for specific parts of the checkout flow
const paymentProcessing = checkoutFlow.createChildGroup("payment-processing").withConfig({
  // Override parent's debounce setting
  debounce: 200,
  // Inherit other settings from parent
});

// Add transitions to the child group
paymentProcessing.from("checkout").to("payment", {
  condition: (_, context: EcommerceContext) => context.shippingInfoComplete,
  targetState: "payment",
});

paymentProcessing.from("payment").to("confirmation", {
  condition: (_, context: EcommerceContext) => context.paymentAuthorized,
  targetState: "confirmation",
});

paymentProcessing.from("payment").to("error", {
  condition: (_, context: EcommerceContext) => context.paymentFailed,
  targetState: "error",
});

// Create a grandchild group for VIP customers with special processing
const vipFastTrack = paymentProcessing.createChildGroup("vip-fast-track").withConfig({
  // Override priority for VIP customers
  priority: 10,
});

// Add transitions to the grandchild group
vipFastTrack.from("checkout").to("confirmation", {
  condition: (_, context: EcommerceContext) => context.isVipCustomer && context.hasStoredPaymentMethod,
  targetState: "confirmation",
});

// Example of cascading enable/disable operations
console.log("Initial state of groups:");
console.log(`Checkout flow enabled: ${checkoutFlow.isEnabled()}`);
console.log(`Payment processing enabled: ${paymentProcessing.isEnabled()}`);
console.log(`VIP fast track enabled: ${vipFastTrack.isEnabled()}`);

// Disable the entire checkout flow with cascade
console.log("\nDisabling checkout flow with cascade:");
checkoutFlow.disable({ cascade: true });
console.log(`Checkout flow enabled: ${checkoutFlow.isEnabled()}`);
console.log(`Payment processing enabled: ${paymentProcessing.isEnabled()}`);
console.log(`VIP fast track enabled: ${vipFastTrack.isEnabled()}`);

// Re-enable just the parent without cascade
console.log("\nRe-enabling checkout flow without cascade:");
checkoutFlow.enable();
console.log(`Checkout flow enabled: ${checkoutFlow.isEnabled()}`);
console.log(`Payment processing enabled: ${paymentProcessing.isEnabled()}`);
console.log(`VIP fast track enabled: ${vipFastTrack.isEnabled()}`);

// Re-enable everything with cascade
console.log("\nRe-enabling checkout flow with cascade:");
checkoutFlow.enable({ cascade: true });
console.log(`Checkout flow enabled: ${checkoutFlow.isEnabled()}`);
console.log(`Payment processing enabled: ${paymentProcessing.isEnabled()}`);
console.log(`VIP fast track enabled: ${vipFastTrack.isEnabled()}`);

// Example of group composition
// Create a template for error handling that can be reused
const errorHandlingTemplate = ecommerce.createGroup("error-handling-template").withConfig({
  retryConfig: {
    maxAttempts: 5,
    delay: 500,
  },
});

// Add generic error transitions
errorHandlingTemplate.from("error").to("browsing", {
  condition: (_, context: EcommerceContext) => context.resetRequested,
  targetState: "browsing",
});

// Create a new group and compose with the template
const specialErrorHandling = ecommerce.createGroup("special-error-handling");

// Compose with the template to inherit its configuration and transitions
specialErrorHandling.compose(errorHandlingTemplate, {
  mergeConfig: true,
  copyTransitions: true,
});

// Add additional transitions specific to this group
specialErrorHandling.from("error").to("payment", {
  condition: (_, context: EcommerceContext) => context.retryPayment,
  targetState: "payment",
});

// Example of cloning a group to another state machine
const mobileEcommerce = new FluentState({
  initialState: "browsing",
});

// Add the same states
["browsing", "cart", "checkout", "payment", "confirmation", "error"].forEach((state) => {
  mobileEcommerce._addState(state);
});

// Clone the entire checkout flow hierarchy to the mobile state machine
// Remove the unused variable by not assigning it
checkoutFlow.clone("mobile-checkout-flow", mobileEcommerce, true);

// Example of navigating the hierarchy
console.log("\nHierarchy navigation:");
console.log(
  "VIP fast track hierarchy path:",
  vipFastTrack
    .getHierarchyPath()
    .map((g) => g.getFullName())
    .join(" -> "),
);
console.log(
  "Payment processing children:",
  paymentProcessing
    .getChildGroups()
    .map((g) => g.getFullName())
    .join(", "),
);
console.log(
  "Checkout flow descendants:",
  checkoutFlow
    .getAllDescendants()
    .map((g) => g.getFullName())
    .join(", "),
);
console.log("VIP fast track root:", vipFastTrack.getRoot().getFullName());
console.log(
  "Payment processing siblings:",
  paymentProcessing
    .getSiblings()
    .map((g) => g.getFullName())
    .join(", "),
);

// Example of serialization and deserialization
const serialized = ecommerce.exportGroups();
console.log("\nSerialized groups:", JSON.stringify(serialized, null, 2));

// Create a new state machine and import the groups
const newEcommerce = new FluentState();
["browsing", "cart", "checkout", "payment", "confirmation", "error"].forEach((state) => {
  newEcommerce._addState(state);
});

// Create condition maps for deserialization
interface ConditionMap {
  [groupName: string]: {
    [fromState: string]: {
      [toState: string]: (state: unknown, context: EcommerceContext) => boolean;
    };
  };
}

const conditionMaps: ConditionMap = {
  "checkout-flow": {
    browsing: {
      cart: (_, context) => context.itemsAdded > 0,
    },
    cart: {
      checkout: (_, context) => context.proceedToCheckout,
    },
  },
  "payment-processing": {
    checkout: {
      payment: (_, context) => context.shippingInfoComplete,
    },
    payment: {
      confirmation: (_, context) => context.paymentAuthorized,
      error: (_, context) => context.paymentFailed,
    },
  },
  "vip-fast-track": {
    checkout: {
      confirmation: (_, context) => context.isVipCustomer && context.hasStoredPaymentMethod,
    },
  },
  "error-handling-template": {
    error: {
      browsing: (_, context) => context.resetRequested,
    },
  },
  "special-error-handling": {
    error: {
      browsing: (_, context) => context.resetRequested,
      payment: (_, context) => context.retryPayment,
    },
  },
};

// Import the serialized groups
newEcommerce.importGroups(serialized, conditionMaps);

// Verify the hierarchy was restored
const restoredCheckoutFlow = newEcommerce.group("checkout-flow");
const restoredPaymentProcessing = newEcommerce.group("payment-processing");
const restoredVipFastTrack = newEcommerce.group("vip-fast-track");

console.log("\nRestored hierarchy:");
console.log(`Payment processing parent: ${restoredPaymentProcessing?.getParent()?.getFullName()}`);
console.log(`VIP fast track parent: ${restoredVipFastTrack?.getParent()?.getFullName()}`);
console.log(
  `Checkout flow children: ${restoredCheckoutFlow
    ?.getChildGroups()
    .map((g) => g.getFullName())
    .join(", ")}`,
);

// Example usage with context updates
const context: EcommerceContext = {
  itemsAdded: 0,
  proceedToCheckout: false,
  shippingInfoComplete: false,
  paymentAuthorized: false,
  paymentFailed: false,
  isVipCustomer: false,
  hasStoredPaymentMethod: false,
  resetRequested: false,
  retryPayment: false,
};

// Start the state machine
ecommerce.start().then(() => {
  console.log("\nInitial state:", ecommerce.state.name);

  // Update context to add items to cart
  context.itemsAdded = 2;
  ecommerce.transition(undefined, context).then(() => {
    console.log("After adding items, state:", ecommerce.state.name);

    // Proceed to checkout
    context.proceedToCheckout = true;
    ecommerce.transition(undefined, context).then(() => {
      console.log("After proceeding to checkout, state:", ecommerce.state.name);

      // Complete shipping info
      context.shippingInfoComplete = true;
      ecommerce.transition(undefined, context).then(() => {
        console.log("After completing shipping, state:", ecommerce.state.name);

        // Payment fails
        context.paymentFailed = true;
        ecommerce.transition(undefined, context).then(() => {
          console.log("After payment failure, state:", ecommerce.state.name);

          // Reset to browsing
          context.resetRequested = true;
          ecommerce.transition(undefined, context).then(() => {
            console.log("After reset, state:", ecommerce.state.name);
          });
        });
      });
    });
  });
});
