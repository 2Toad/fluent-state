import { expect } from "chai";
import * as chai from "chai";
import * as spies from "chai-spies";
import { FluentState } from "../src";
import { AutoTransitionConfig } from "../src/types";
import * as sinon from "sinon";
import { suppressConsole } from "./helpers";

chai.use(spies);

describe("Auto Transitions", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
    chai.spy.restore();
  });

  describe("Automatic Triggering", () => {
    it("should auto-transition immediately after entering a state", async () => {
      fs.from("start").to("end", () => true);
      await fs.start();
      expect(fs.state.name).to.equal("end");
    });

    it("should chain multiple auto-transitions", async () => {
      fs.from("start")
        .to("processing", () => true)
        .from("processing")
        .to("completed", () => true);

      await fs.start();
      expect(fs.state.name).to.equal("completed");
    });

    it("should stop chain when condition is not met", async () => {
      fs.from("start")
        .to("processing", () => true)
        .from("processing")
        .to("completed", () => false);

      await fs.start();
      expect(fs.state.name).to.equal("processing");
    });
  });

  describe("Manual Context Evaluation", () => {
    it("should transition based on context", async () => {
      interface AppState {
        quality: number;
      }

      fs.from("active").to<AppState>("archived", (state, context) => context.quality < 0);

      await fs.start();
      expect(fs.state.name).to.equal("active");

      await fs.state.evaluateAutoTransitions({ quality: -1 });
      expect(fs.state.name).to.equal("archived");
    });

    it("should evaluate multiple conditions in order", async () => {
      interface AppState {
        quality: number;
        premium: boolean;
      }

      fs.from("active")
        .to<AppState>("premium", (state, context: AppState) => context.premium === true)
        .or<AppState>("archived", (state, context: AppState) => context.quality < 0);

      await fs.start();

      // Premium condition should win since it's evaluated first
      await fs.state.evaluateAutoTransitions({ quality: -1, premium: true });
      expect(fs.state.name).to.equal("premium");
    });

    it("should handle async conditions", async () => {
      interface AppState {
        status: string;
      }

      fs.from("processing").to<AppState>("completed", async (state, context) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return context.status === "done";
      });

      await fs.start();
      await fs.state.evaluateAutoTransitions({ status: "done" });
      expect(fs.state.name).to.equal("completed");
    });
  });

  describe("Integration with State Management", () => {
    it("should work with simple state objects", async () => {
      interface AppState {
        count: number;
      }

      // Create a simple state object
      const state: AppState = { count: 0 };

      fs.from("active").to<AppState>("exceeded", (_, context) => context.count > 10);

      await fs.start();
      expect(fs.state.name).to.equal("active");

      // Simulate state updates
      for (let i = 0; i < 12; i++) {
        state.count++;
        await fs.state.evaluateAutoTransitions(state);
      }

      expect(fs.state.name).to.equal("exceeded");
    });

    it("should work with custom state management", async () => {
      // Create a simple state machine with two states
      fs.from("active").to("inactive");
      await fs.start();
      expect(fs.state.name).to.equal("active");

      // Create a simple state manager
      const stateManager = {
        state: { status: "active" },
        listeners: [],

        subscribe(listener) {
          this.listeners.push(listener);
          return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
          };
        },

        setState(newState) {
          this.state = { ...this.state, ...newState };
          this.listeners.forEach((listener) => listener(this.state));
        },

        getState() {
          return this.state;
        },
      };

      // Create a condition function that checks the status
      const condition = (_, context) => context.status === "inactive";

      // Add a transition with the condition
      fs.from("active").to("inactive", condition);

      // Verify initial state
      expect(fs.state.name).to.equal("active");

      // Update state to trigger transition
      stateManager.setState({ status: "inactive" });

      // Manually evaluate auto-transitions with the new state
      await fs.state.evaluateAutoTransitions(stateManager.getState());

      // Verify the transition occurred
      expect(fs.state.name).to.equal("inactive");
    });

    it("should handle multiple state updates", async () => {
      interface AppState {
        status: "loading" | "error" | "success";
        retries: number;
      }

      const initialState: AppState = {
        status: "loading",
        retries: 0,
      };

      // Define transitions with clear conditions
      fs.from("retry").to<AppState>("failed", (_, context) => context.retries >= 3);

      // Set initial state and initialize state manager
      fs.setState("retry");
      fs.state.updateContext(initialState);
      await fs.start();

      // Update state and check transitions
      const updates = [{ retries: 1 }, { retries: 2 }, { retries: 3 }];

      for (const update of updates) {
        fs.state.updateContext(update);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(fs.state.name).to.equal("failed");
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in conditions gracefully", async () => {
      // Suppress console output
      const { flags, restore } = suppressConsole();

      fs.from("start").to("end", () => {
        throw new Error("Test error");
      });

      await fs.start();
      expect(fs.state.name).to.equal("start");
      expect(flags.errorLogged).to.be.true;

      // Restore console functions
      restore();
    });

    it("should continue evaluating other conditions after error", async () => {
      // Suppress console output
      const { flags, restore } = suppressConsole();

      fs.from("start")
        .to("error", () => {
          throw new Error("Test error");
        })
        .or("end", () => true);

      await fs.start();
      expect(fs.state.name).to.equal("end");
      expect(flags.errorLogged).to.be.true;

      // Restore console functions
      restore();
    });
  });

  describe("Manual Transitions", () => {
    it("should not block manual transitions", async () => {
      fs.from("start")
        .to("auto-end", () => false)
        .or("manual-end");

      await fs.start();
      await fs.transition("manual-end");
      expect(fs.state.name).to.equal("manual-end");
    });

    it("should evaluate auto-transitions after manual transition", async () => {
      fs.from("start")
        .to("middle", () => false)
        .from("middle")
        .to("end", () => true);

      await fs.start();
      await fs.transition("middle");
      expect(fs.state.name).to.equal("end");
    });
  });

  describe("Priority-based Transitions", () => {
    it("should evaluate transitions in order of priority (highest to lowest)", async () => {
      interface TestState {
        value: number;
      }

      const fs = new FluentState();
      fs.from("start")
        .to<TestState>("low", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "low",
          priority: 1,
        } as AutoTransitionConfig<TestState>)
        .from("start")
        .to<TestState>("high", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "high",
          priority: 2,
        } as AutoTransitionConfig<TestState>);

      await fs.start();
      await fs.state.evaluateAutoTransitions({ value: 1 });
      expect(fs.state.name).to.equal("high");
    });

    it("should maintain definition order for equal priorities", async () => {
      interface TestState {
        value: number;
      }

      const fs = new FluentState();
      fs.from("start")
        .to<TestState>("second", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "second",
          priority: 1,
        } as AutoTransitionConfig<TestState>)
        .from("start")
        .to<TestState>("first", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "first",
          priority: 2,
        } as AutoTransitionConfig<TestState>)
        .from("start")
        .to<TestState>("third", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "third",
          priority: 1,
        } as AutoTransitionConfig<TestState>);

      await fs.start();
      await fs.state.evaluateAutoTransitions({ value: 1 });
      expect(fs.state.name).to.equal("first");
    });

    it("should default to priority 0 when not specified", async () => {
      interface TestState {
        value: number;
      }

      const fs = new FluentState();
      fs.from("start")
        .to<TestState>("explicit-zero", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "explicit-zero",
          priority: 0,
        } as AutoTransitionConfig<TestState>)
        .from("start")
        .to<TestState>("implicit-zero", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "implicit-zero",
        } as AutoTransitionConfig<TestState>)
        .from("start")
        .to<TestState>("high", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "high",
          priority: 1,
        } as AutoTransitionConfig<TestState>);

      await fs.start();
      await fs.state.evaluateAutoTransitions({ value: 1 });
      expect(fs.state.name).to.equal("high");
    });

    it("should only execute the first successful transition", async () => {
      interface TestState {
        value: number;
      }

      const fs = new FluentState();
      const spy = sinon.spy();

      // Create a state machine with two transitions from "start"
      // Both transitions have conditions that would succeed, but only the higher priority one should be evaluated
      fs.from("start").to<TestState>("first", {
        condition: (_, ctx) => {
          spy();
          return ctx?.value > 0; // Only return true when context has value property
        },
        targetState: "first",
        priority: 2,
      } as AutoTransitionConfig<TestState>);

      fs.from("start").to<TestState>("second", {
        condition: (_, ctx) => {
          spy();
          return ctx?.value > 0; // Only return true when context has value property
        },
        targetState: "second",
        priority: 1,
      } as AutoTransitionConfig<TestState>);

      // Start in the "start" state and evaluate transitions
      await fs.start();
      await fs.state.evaluateAutoTransitions({ value: 1 });

      // The spy should only be called once because we should stop after the first successful transition
      expect(spy.callCount).to.equal(3); // Two calls during start() (both return false) and one call during explicit evaluation
      expect(fs.state.name).to.equal("first");
    });

    it("should continue evaluating when higher priority transitions fail", async () => {
      interface TestState {
        value: number;
      }

      const fs = new FluentState();
      fs.from("start")
        .to<TestState>("high", {
          condition: (_, ctx) => ctx.value > 10,
          targetState: "high",
          priority: 2,
        } as AutoTransitionConfig<TestState>)
        .from("start")
        .to<TestState>("low", {
          condition: (_, ctx) => ctx.value > 0,
          targetState: "low",
          priority: 1,
        } as AutoTransitionConfig<TestState>);

      await fs.start();
      await fs.state.evaluateAutoTransitions({ value: 5 });
      expect(fs.state.name).to.equal("low");
    });
  });

  describe("Debounced Transitions", () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      fs = new FluentState();
      // Use Sinon's fake timers to control time
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      fs.clear();
      clock.restore();
      chai.spy.restore();
    });

    it("should delay transition when debounce is specified", async () => {
      // Setup
      interface TestState {
        value: number;
      }

      fs.from("idle").to<TestState>("active", {
        condition: (_, context) => context.value > 5,
        targetState: "active",
        debounce: 200, // 200ms debounce
      });

      await fs.start();
      expect(fs.state.name).to.equal("idle");

      // Update context but the transition shouldn't happen immediately
      fs.state.updateContext<TestState>({ value: 10 });

      // Verify state hasn't changed yet
      expect(fs.state.name).to.equal("idle");

      // Advance time by 100ms (not enough to trigger transition)
      await clock.tickAsync(100);
      expect(fs.state.name).to.equal("idle");

      // Advance to full debounce time
      await clock.tickAsync(100);
      expect(fs.state.name).to.equal("active");
    });

    it("should reset debounce timer on new context updates", async () => {
      // Setup
      interface TestState {
        value: number;
      }

      fs.from("idle").to<TestState>("active", {
        condition: (_, context) => context.value > 5,
        targetState: "active",
        debounce: 200, // 200ms debounce
      });

      await fs.start();

      // First update
      fs.state.updateContext<TestState>({ value: 10 });

      // Wait 150ms (not enough to trigger transition)
      await clock.tickAsync(150);
      expect(fs.state.name).to.equal("idle");

      // Second update resets timer
      fs.state.updateContext<TestState>({ value: 15 });

      // Wait another 150ms (not enough for the new timer)
      await clock.tickAsync(150);
      expect(fs.state.name).to.equal("idle");

      // Wait for the remaining time
      await clock.tickAsync(50);
      expect(fs.state.name).to.equal("active");
    });

    it("should respect transition priority order in debounced transitions", async () => {
      // Setup: Two transitions with different priorities
      interface TestState {
        status: string;
      }

      // Lower priority transition (default = 0)
      fs.from("idle").to<TestState>("warning", {
        condition: (_, context) => context.status === "error warning",
        targetState: "warning",
        debounce: 100,
      });

      // Higher priority transition (1 > 0)
      fs.from("idle").to<TestState>("error", {
        condition: (_, context) => context.status === "error warning",
        targetState: "error",
        priority: 1,
        debounce: 100,
      });

      await fs.start();

      // Update context to satisfy both conditions simultaneously
      fs.state.updateContext<TestState>({ status: "error warning" });

      // Verify state hasn't changed yet
      expect(fs.state.name).to.equal("idle");

      // Both transitions are debounced, wait for them to trigger
      await clock.tickAsync(100);

      // Higher priority transition should win
      expect(fs.state.name).to.equal("error");
    });

    it("should properly clean up debounce timers when exiting state", async () => {
      // Setup
      interface TestState {
        value: number;
      }

      fs.from("idle").to<TestState>("debounced", {
        condition: (_, context) => context.value > 5,
        targetState: "debounced",
        debounce: 200,
      });

      fs.from("idle").to("immediate", {
        condition: () => true,
        targetState: "immediate",
      });

      await fs.start();

      // Trigger the debounced transition
      fs.state.updateContext<TestState>({ value: 10 });

      // Manually transition away before debounce completes
      await fs.transition("immediate");
      expect(fs.state.name).to.equal("immediate");

      // Advance time past the debounce period
      await clock.tickAsync(200);

      // The state should still be "immediate" - debounced transition should not happen
      expect(fs.state.name).to.equal("immediate");
    });

    it("should not trigger debounced transitions if condition becomes false during wait", async () => {
      // Setup
      interface TestState {
        value: number;
      }

      fs.from("idle").to<TestState>("active", {
        condition: (_, context) => context.value > 5,
        targetState: "active",
        debounce: 200,
      });

      await fs.start();

      // Initial update - should trigger transition after debounce
      fs.state.updateContext<TestState>({ value: 10 });

      // Wait 150ms
      await clock.tickAsync(150);

      // Change context so condition becomes false
      fs.state.updateContext<TestState>({ value: 2 });

      // Complete the debounce period
      await clock.tickAsync(50);

      // Transition should not happen because condition is now false
      expect(fs.state.name).to.equal("idle");
    });

    it("should process non-debounced transitions immediately even when debounced ones are pending", async () => {
      // Setup a state machine with a simple state flow
      fs.from("idle");
      await fs.start();

      // Add a non-debounced transition first
      fs.from("idle").to("processing", {
        condition: () => true,
        targetState: "processing",
      });

      // We need to explicitly trigger auto-transition evaluation
      await fs.state.evaluateAutoTransitions({});

      // Now the non-debounced transition should have happened
      expect(fs.state.name).to.equal("processing");

      // Now add a debounced transition from processing
      fs.from("processing").to("completed", {
        condition: () => true,
        targetState: "completed",
        debounce: 100,
      });

      // We need to explicitly trigger auto-transition evaluation again
      fs.state.evaluateAutoTransitions({});

      // State shouldn't change yet because of the debounce
      expect(fs.state.name).to.equal("processing");

      // Advance the timer to trigger the debounced transition
      await clock.tickAsync(100);

      // Now the debounced transition should have happened
      expect(fs.state.name).to.equal("completed");
    });
  });
});
