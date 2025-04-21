import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState, TransitionGroup } from "../src";
import { createTransitionGuard } from "../src/plugins/transition-guard";
import { suppressConsole } from "./helpers";

describe("Group-Level Middleware", () => {
  let fs: FluentState;
  let group: TransitionGroup;

  beforeEach(() => {
    fs = new FluentState({
      initialState: "idle",
    });

    // Create a transition group
    group = fs.createGroup("main");

    // Define transitions
    group.from("idle").to("running");
    group.from("running").to("paused").to("stopped");
    group.from("paused").to("running").to("stopped");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should allow transitions when middleware calls proceed", async () => {
    const middlewareSpy = sinon.spy((_from, _to, proceed) => {
      proceed();
    });

    group.middleware(middlewareSpy);

    const result = await fs.transition("running");

    expect(result).to.be.true;
    expect(fs.state.name).to.equal("running");
    expect(middlewareSpy.calledOnce).to.be.true;
    expect(middlewareSpy.calledWith("idle", "running")).to.be.true;
  });

  it("should block transitions when middleware doesn't call proceed", async () => {
    const middlewareSpy = sinon.spy(() => {
      // Intentionally not calling proceed
    });

    group.middleware(middlewareSpy);

    const result = await fs.transition("running");

    expect(result).to.be.false;
    expect(fs.state.name).to.equal("idle");
    expect(middlewareSpy.calledOnce).to.be.true;
  });

  it("should pass context to middleware", async () => {
    const context = { userId: "123", isPremium: true };
    const middlewareSpy = sinon.spy((_from, _to, proceed, ctx) => {
      proceed();
      expect(ctx).to.equal(context);
    });

    group.middleware(middlewareSpy);

    await fs.transition("running", context);

    expect(middlewareSpy.calledOnce).to.be.true;
    expect(middlewareSpy.args[0][3]).to.equal(context);
  });

  it("should handle errors in middleware gracefully", async () => {
    const { flags, restore } = suppressConsole();

    const middleware = sinon.spy(() => {
      throw new Error("Middleware error");
    });

    group.middleware(middleware);

    const result = await fs.transition("running");

    expect(result).to.be.false;
    expect(fs.state.name).to.equal("idle");
    expect(middleware.threw()).to.be.true;
    expect(flags.errorLogged).to.be.true;

    restore();
  });

  it("should support multiple middleware in correct order", async () => {
    const order: string[] = [];

    group.middleware((_from, _to, proceed) => {
      order.push("first");
      proceed();
    });

    group.middleware((_from, _to, proceed) => {
      order.push("second");
      proceed();
    });

    await fs.transition("running");

    expect(order).to.deep.equal(["first", "second"]);
  });

  it("should stop evaluating middleware if one blocks the transition", async () => {
    const secondMiddleware = sinon.spy((_from, _to, proceed) => {
      proceed();
    });

    group.middleware(() => {
      // First middleware blocks
    });

    group.middleware(secondMiddleware);

    const result = await fs.transition("running");

    expect(result).to.be.false;
    expect(fs.state.name).to.equal("idle");
    expect(secondMiddleware.called).to.be.false;
  });

  it("should allow removing middleware", async () => {
    const middleware = sinon.spy((_from, _to, proceed) => {
      proceed();
    });

    group.middleware(middleware);
    group.removeMiddleware(middleware);

    await fs.transition("running");

    expect(middleware.called).to.be.false;
  });

  it("should work alongside global middleware", async () => {
    const globalMiddleware = sinon.spy((_state, _next, proceed) => {
      proceed();
    });

    const groupMiddleware = sinon.spy((_from, _to, proceed) => {
      proceed();
    });

    fs.use(createTransitionGuard(globalMiddleware));
    group.middleware(groupMiddleware);

    await fs.transition("running");

    expect(globalMiddleware.calledOnce).to.be.true;
    expect(groupMiddleware.calledOnce).to.be.true;
  });

  it("should only run middleware for groups that contain the transition", async () => {
    // Create another group with different transitions
    const otherGroup = fs.createGroup("other");
    otherGroup.from("stopped").to("completed");

    const mainMiddleware = sinon.spy((_from, _to, proceed) => {
      proceed();
    });

    const otherMiddleware = sinon.spy((_from, _to, proceed) => {
      proceed();
    });

    group.middleware(mainMiddleware);
    otherGroup.middleware(otherMiddleware);

    await fs.transition("running");

    expect(mainMiddleware.calledOnce).to.be.true;
    expect(otherMiddleware.called).to.be.false;
  });

  it("should support asynchronous middleware", async () => {
    const middlewareSpy = sinon.spy(async (_from, _to, proceed) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      proceed();
    });

    group.middleware(middlewareSpy);

    const result = await fs.transition("running");

    expect(result).to.be.true;
    expect(fs.state.name).to.equal("running");
    expect(middlewareSpy.calledOnce).to.be.true;
  });

  it("should allow middleware to modify the transition context", async () => {
    // Create a context that will be modified
    interface TestContext {
      count: number;
      fromState?: string;
    }

    const context: TestContext = { count: 0 };

    group.middleware((from, _to, proceed, ctx) => {
      if (ctx) {
        (ctx as TestContext).count++;
        (ctx as TestContext).fromState = from;
      }
      proceed();
    });

    await fs.transition("running", context);

    expect(context.count).to.equal(1);
    expect(context.fromState).to.equal("idle");
  });
});
