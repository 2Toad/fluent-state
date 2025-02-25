import { FluentState } from "../fluent-state";
import { StateManagerMetrics } from "../types";

// Example: Using performance optimizations in a real-world scenario
// This example demonstrates a shopping cart with frequent updates

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  couponCode?: string;
  shippingAddress?: string;
}

// Create a state machine with performance optimizations
const cartMachine = new FluentState({
  initialState: "browsing",
  stateManagerConfig: {
    // Enable batching for rapid updates (e.g., quickly adding multiple items)
    batchUpdates: true,
    batchTimeWindow: 100, // 100ms batching window

    // Enable memoization for derived values (e.g., cart total)
    enableMemoization: true,

    // Custom equality function to prevent unnecessary updates
    areEqual: (prev, next) => {
      if (prev === next) return true;

      // For cart items, only consider it changed if items actually changed
      if (Array.isArray(prev["items"]) && Array.isArray(next["items"])) {
        const prevItems = prev["items"] as CartItem[];
        const nextItems = next["items"] as CartItem[];

        if (prevItems.length !== nextItems.length) return false;

        // Check if any items changed
        return prevItems.every((item, index) => {
          // Make sure index is within bounds and is a valid array index
          if (index < 0 || index >= nextItems.length || !Number.isInteger(index)) {
            return false;
          }

          // Use Array.prototype methods to safely access elements
          const nextItem = Array.prototype.at.call(nextItems, index);
          return item.id === nextItem.id && item.quantity === nextItem.quantity && item.price === nextItem.price;
        });
      }

      return false;
    },

    // Enable performance metrics collection
    metrics: {
      enabled: true,
      measureUpdates: true,
      measureMemory: true,
      measureComputations: true,
      onMetrics: (metrics: StateManagerMetrics) => {
        console.log("Cart Performance Metrics:");
        console.log(`- Update frequency: ${metrics.updateFrequency.toFixed(2)}ms`);
        console.log(`- Update duration: ${metrics.updateDuration.toFixed(2)}ms`);
        console.log(`- Update count: ${metrics.updateCount}`);

        if (metrics.memoryUsage) {
          console.log(`- State size: ${(metrics.memoryUsage.stateSize / 1024).toFixed(2)}KB`);
          console.log(`- Memoized size: ${(metrics.memoryUsage.memoizedSize / 1024).toFixed(2)}KB`);
        }

        if (metrics.computationDuration) {
          console.log(`- Equality checks: ${metrics.computationDuration.equality.toFixed(2)}ms`);
          console.log(`- Memoization: ${metrics.computationDuration.memoization.toFixed(2)}ms`);
          console.log(`- Derivations: ${metrics.computationDuration.derivations.toFixed(2)}ms`);
        }

        // Performance warning
        if (metrics.updateDuration > 16) {
          // More than 16ms (60fps threshold)
          console.warn("Performance warning: Updates taking longer than 16ms");
        }
      },
    },
  },
});

// Define states and transitions
cartMachine.from("browsing").to<CartState>("cart", {
  condition: (_, context) => context.items && context.items.length > 0,
  targetState: "cart",
});

cartMachine.from("cart").to<CartState>("checkout", {
  condition: (_, context) => context.items && context.items.length > 0 && !!context.shippingAddress,
  targetState: "checkout",
});

cartMachine.from("cart").to<CartState>("browsing", {
  condition: (_, context) => !context.items || context.items.length === 0,
  targetState: "browsing",
});

cartMachine.from("checkout").to<CartState>("payment", {
  condition: (_, context) => context.items && context.items.length > 0 && !!context.shippingAddress,
  targetState: "payment",
});

cartMachine.from("checkout").to<CartState>("cart", {
  condition: (_, context) => !context.shippingAddress,
  targetState: "cart",
});

// Initialize the cart state
const cartState = cartMachine.state;
cartState.updateContext<CartState>({
  items: [],
});

// Example: Derive a computed value with memoization
function getCartTotal(state: CartState): number {
  console.log("Computing cart total..."); // This will only log when actually computed
  return state.items.reduce((total, item) => total + item.price * item.quantity, 0);
}

// Function to get cart total with memoization
function getMemoizedCartTotal(): number {
  return cartState["stateManager"]["derive"](
    "cartTotal",
    (state: CartState) => {
      return getCartTotal(state as CartState);
    },
    ["items"],
  );
}

// Simulate user actions
async function simulateShoppingSession() {
  console.log("Starting shopping session...");

  // Add first item
  const currentItems = cartState.getContext<CartState>().items || [];
  cartState.updateContext<CartState>({
    items: [...currentItems, { id: "1", name: "Product 1", price: 19.99, quantity: 1 }],
  });

  console.log("Current state:", cartMachine.state.name);
  console.log("Cart total:", getMemoizedCartTotal());

  // Add second item (should trigger batch update)
  setTimeout(() => {
    const currentItems = cartState.getContext<CartState>().items || [];
    cartState.updateContext<CartState>({
      items: [...currentItems, { id: "2", name: "Product 2", price: 29.99, quantity: 1 }],
    });

    console.log("Current state:", cartMachine.state.name);
    console.log("Cart total:", getMemoizedCartTotal());

    // Update quantity (should use custom equality)
    setTimeout(() => {
      const currentItems = cartState.getContext<CartState>().items || [];
      const updatedItems = currentItems.map((item) => (item.id === "1" ? { ...item, quantity: 2 } : item));

      cartState.updateContext<CartState>({
        items: updatedItems,
      });

      console.log("Current state:", cartMachine.state.name);
      console.log("Cart total:", getMemoizedCartTotal());

      // Add shipping address to proceed to checkout
      setTimeout(() => {
        cartState.updateContext<CartState>({
          shippingAddress: "123 Main St, Anytown, USA",
        });

        console.log("Current state:", cartMachine.state.name);
        console.log("Cart total:", getMemoizedCartTotal()); // Should use memoized value

        // Empty cart to go back to browsing
        setTimeout(() => {
          cartState.updateContext<CartState>({
            items: [],
          });

          console.log("Current state:", cartMachine.state.name);
          console.log("Cart total:", getMemoizedCartTotal());
        }, 1000);
      }, 1000);
    }, 1000);
  }, 50); // Within batch window
}

// Run the simulation
simulateShoppingSession().catch(console.error);
