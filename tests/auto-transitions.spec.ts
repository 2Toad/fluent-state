import { expect } from "chai";
import * as chai from "chai";
import * as spies from "chai-spies";
import { FluentState } from "../src";

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
      interface AppState {
        user: { isLoggedIn: boolean; lastActive: number };
      }

      // Simulate a basic state manager
      class StateManager {
        private state: AppState;
        private listeners: ((state: AppState) => void)[] = [];

        constructor() {
          this.state = {
            user: { isLoggedIn: true, lastActive: Date.now() },
          };
        }

        subscribe(listener: (state: AppState) => void) {
          this.listeners.push(listener);
          return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
          };
        }

        setState(newState: Partial<AppState>) {
          this.state = { ...this.state, ...newState };
          this.listeners.forEach((listener) => listener(this.state));
        }

        getState() {
          return this.state;
        }
      }

      const stateManager = new StateManager();

      fs.from("active").to<AppState>("inactive", (_, context) => {
        const inactiveTime = Date.now() - context.user.lastActive;
        return inactiveTime > 100;
      });

      // Set up auto-transition evaluation on state changes
      stateManager.subscribe((state) => {
        fs.state.evaluateAutoTransitions(state);
      });

      await fs.start();
      // Initial evaluation with current state
      await fs.state.evaluateAutoTransitions(stateManager.getState());
      expect(fs.state.name).to.equal("active");

      // Simulate user inactivity
      await new Promise((resolve) => setTimeout(resolve, 150));
      stateManager.setState({
        user: { isLoggedIn: true, lastActive: Date.now() - 200 },
      });

      // Give time for the state update to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));
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
      console.log("ℹ️  The following error is expected as part of the error handling test:");
      const consoleSpy = chai.spy.on(console, "error");

      fs.from("start").to("end", () => {
        throw new Error("Test error");
      });

      await fs.start();
      expect(fs.state.name).to.equal("start");
      expect(consoleSpy).to.have.been.called.with("Error in auto-transition condition");
    });

    it("should continue evaluating other conditions after error", async () => {
      fs.from("start")
        .to("error", () => {
          throw new Error("Test error");
        })
        .or("end", () => true);

      await fs.start();
      expect(fs.state.name).to.equal("end");
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
});
