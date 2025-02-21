import { expect } from "chai";
import { FluentState } from "../src/fluent-state";
import { createTransitionGuard } from "../src/plugins/transition-guard";

// Test suite for transition guard

describe("Transition Guard", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should allow transitions when proceed is called", async () => {
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      proceed();
    });

    fs.use(middleware);
    fs.from("start").to("end");

    const result = await fs.transition("end");
    expect(result).to.be.true;
    expect(fs.state.name).to.equal("end");
  });

  it("should block transitions when proceed is not called", async () => {
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      // Do not call proceed
    });

    fs.use(middleware);
    fs.from("start").to("end");

    const result = await fs.transition("end");
    expect(result).to.be.false;
    expect(fs.state.name).to.equal("start");
  });

  it("should handle errors in middleware gracefully", async () => {
    const middleware = createTransitionGuard(() => {
      throw new Error("Middleware error");
    });

    fs.use(middleware);
    fs.from("start").to("end");

    const result = await fs.transition("end");
    expect(result).to.be.false;
    expect(fs.state.name).to.equal("start");
  });

  it("should correctly influence transitions within a flow", async () => {
    const log: string[] = [];
    const addToLog = (item: string): void => {
      log.push(item);
    };

    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      addToLog(`Attempting transition: ${currentState?.name || "null"} -> ${nextStateName}`);
      if (nextStateName !== "blocked") {
        proceed();
      } else {
        addToLog("Transition blocked");
      }
    });

    fs.use(middleware);
    fs.from("start").to("middle").or("blocked").from("middle").to("end");

    const result1 = await fs.transition("middle");
    expect(result1).to.be.true;
    expect(fs.state.name).to.equal("middle");
    expect(log).to.include("Attempting transition: start -> middle");

    const result2 = await fs.transition("blocked");
    expect(result2).to.be.false;
    expect(fs.state.name).to.equal("middle");
    expect(log).to.include("Attempting transition: middle -> blocked");
    expect(log).to.include("Transition blocked");

    const result3 = await fs.transition("end");
    expect(result3).to.be.true;
    expect(fs.state.name).to.equal("end");
    expect(log).to.include("Attempting transition: middle -> end");
  });
});

describe("Middleware Edge Cases", () => {
  it("should handle asynchronous operations in middleware", async () => {
    const fs = new FluentState();
    const executionOrder: string[] = [];
    const addToOrder = (step: string): void => {
      executionOrder.push(step);
    };

    // Create an async middleware that simulates an async operation
    const middleware = createTransitionGuard(async (currentState, nextStateName, proceed) => {
      addToOrder("middleware start");

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 50));
      addToOrder("async operation complete");

      proceed();
      addToOrder("after proceed");
    });

    fs.use(middleware);
    fs.from("start").to("end");

    // Add handlers to track execution order
    fs.when("end").do(() => {
      addToOrder("state handler executed");
    });

    addToOrder("transition start");
    const result = await fs.transition("end");
    addToOrder("transition complete");

    // Verify the transition was successful
    expect(result).to.be.true;
    expect(fs.state.name).to.equal("end");

    // Verify the execution order
    expect(executionOrder).to.deep.equal([
      "transition start",
      "middleware start",
      "async operation complete",
      "after proceed",
      "state handler executed",
      "transition complete",
    ]);
  });

  it("should handle state machine modifications during middleware execution", async () => {
    const fs = new FluentState();
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      fs.from("dynamic").to("end");
      proceed();
    });

    fs.use(middleware);
    fs.from("start").to("dynamic");

    const result1 = await fs.transition("dynamic");
    expect(result1).to.be.true;
    expect(fs.state.name).to.equal("dynamic");

    const result2 = await fs.transition("end");
    expect(result2).to.be.true;
    expect(fs.state.name).to.equal("end");
  });
});
