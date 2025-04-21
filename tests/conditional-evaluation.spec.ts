import { expect } from "chai";
import * as chai from "chai";
import * as spies from "chai-spies";
import * as sinon from "sinon";
import { FluentState } from "../src/fluent-state";
import { State } from "../src/state";

chai.use(spies);

interface Context {
  count: number;
  user?: {
    name: string;
    profile?: {
      status: string;
    };
  };
  items: Array<{ id: number; value: string }>;
  unrelated: string;
  shouldSkip: boolean;
  needsProcessing: boolean;
  isReady: boolean;
}

describe("Conditional Auto-transition Evaluation", () => {
  let fs: FluentState;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    fs = new FluentState({
      initialState: "idle",
    });
    fs.states.get("idle")?.updateContext<Context>({
      count: 0,
      items: [{ id: 1, value: "initial" }],
      unrelated: "data",
      shouldSkip: false,
      needsProcessing: false,
      isReady: false,
    });
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    fs.clear();
    chai.spy.restore();
    clock.restore();
  });

  // --- Acceptance Criteria 1: Property-based Evaluation Triggering ---

  describe("watchProperties", () => {
    beforeEach(() => {
      fs.from("idle").to<Context>("counting", {
        targetState: "counting",
        condition: (_, ctx) => ctx.count > 0,
        evaluationConfig: {
          watchProperties: ["count"],
        },
      });
      fs.from("idle").to<Context>("deepCounting", {
        targetState: "deepCounting",
        condition: (_, ctx) => ctx.user?.profile?.status === "active",
        evaluationConfig: {
          watchProperties: ["user.profile.status"],
        },
      });
      fs.from("idle").to<Context>("itemCounting", {
        targetState: "itemCounting",
        condition: (_, ctx) => ctx.items[0]?.value === "updated",
        evaluationConfig: {
          watchProperties: ["items[0].value"],
        },
      });
      fs.from("idle").to<Context>("ready", {
        targetState: "ready",
        condition: (_, ctx) => ctx.isReady,
        evaluationConfig: {
          watchProperties: ["isReady"],
        },
      });
    });

    it("should trigger transition only when a watched property changes", async () => {
      expect(fs.state.name).to.equal("idle");
      await fs.state.updateContext<Context>({ unrelated: "new data" });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ count: 1 });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("counting");
    });

    it("should support deep property paths", async () => {
      expect(fs.state.name).to.equal("idle");
      await fs.state.updateContext<Context>({ user: { name: "test" } });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ user: { name: "test", profile: { status: "inactive" } } });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ user: { name: "test", profile: { status: "active" } } });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("deepCounting");
    });

    it("should support array notation paths", async () => {
      expect(fs.state.name).to.equal("idle");
      await fs.state.updateContext<Context>({
        items: [
          { id: 1, value: "initial" },
          { id: 2, value: "new" },
        ],
      });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ items: [{ id: 1, value: "changed" }] });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ items: [{ id: 1, value: "updated" }] });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("itemCounting");
    });

    it("should handle property addition/deletion correctly", async () => {
      await fs.state.updateContext<Context>({ isReady: true });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("ready");

      fs.setState("idle");
      fs.state.updateContext<Context>({
        count: 0,
        items: [{ id: 1, value: "initial" }],
        unrelated: "data",
        shouldSkip: false,
        needsProcessing: false,
        isReady: false,
      });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      const currentContext = fs.state.getContext<Context>();
      const newContext = { ...currentContext };
      delete (newContext as any).isReady;
      await fs.state.updateContext(newContext);
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ isReady: true });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("ready");
    });

    it("should not trigger if watched property changes but condition is false", async () => {
      await fs.state.updateContext<Context>({ count: -1 });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");
    });
  });

  // --- Acceptance Criteria 2: Conditional Evaluation Skipping ---

  describe("skipIf", () => {
    let skipIfSpy: sinon.SinonSpy;
    let conditionSpy: sinon.SinonSpy;

    beforeEach(() => {
      skipIfSpy = sinon.spy((context: unknown) => (context as Context).shouldSkip);
      conditionSpy = sinon.spy((state: State, ctx: Context) => ctx.needsProcessing);

      fs.from("idle").to<Context>("processing", {
        targetState: "processing",
        condition: conditionSpy,
        evaluationConfig: {
          skipIf: skipIfSpy,
        },
      });
    });

    it("should skip evaluation if skipIf returns true", async () => {
      await fs.state.updateContext<Context>({ shouldSkip: true, needsProcessing: true });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");
      expect(skipIfSpy.called).to.be.true;
      expect(conditionSpy.called).to.be.false;
    });

    it("should proceed with evaluation if skipIf returns false", async () => {
      await fs.state.updateContext<Context>({ shouldSkip: false, needsProcessing: true });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("processing");
      expect(skipIfSpy.called).to.be.true;
      expect(conditionSpy.called).to.be.true;
    });

    it("should not affect manual transitions", async () => {
      await fs.state.updateContext<Context>({ shouldSkip: true, needsProcessing: true });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("idle");

      const success = await fs.transition("processing");
      expect(success).to.be.true;
      expect(fs.state.name).to.equal("processing");
      expect(skipIfSpy.callCount).to.equal(1);
    });
  });

  // --- Acceptance Criteria 3: Evaluation Timing Strategies ---

  describe("evaluationStrategy", () => {
    let conditionFn: sinon.SinonSpy;

    beforeEach(() => {
      conditionFn = sinon.spy((state: State, ctx: Context) => ctx.count > 0);
    });

    // afterEach is handled globally

    it('should evaluate immediately by default (or with "immediate" strategy)', async () => {
      fs.from("idle").to<Context>("counting", {
        targetState: "counting",
        condition: conditionFn,
        evaluationConfig: {
          evaluationStrategy: "immediate",
        },
      });

      await fs.state.updateContext<Context>({ count: 1 });
      await clock.tickAsync(0);
      expect(conditionFn.called).to.be.true;
      expect(fs.state.name).to.equal("counting");
    });

    it('should defer evaluation with "nextTick" strategy', async () => {
      fs.from("idle").to<Context>("counting", {
        targetState: "counting",
        condition: conditionFn,
        evaluationConfig: {
          evaluationStrategy: "nextTick",
        },
      });

      await fs.state.updateContext<Context>({ count: 1 });
      expect(conditionFn.called).to.be.false;
      expect(fs.state.name).to.equal("idle");
      await clock.tickAsync(0);
      expect(conditionFn.called).to.be.true;
      expect(fs.state.name).to.equal("counting");
    });

    it('should defer evaluation with "idle" strategy', async () => {
      // Mock requestIdleCallback using Sinon
      const mockRequestIdleCallback = (callback: IdleRequestCallback): number => {
        const handle = setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 10);
        return handle as unknown as number;
      };
      const mockCancelIdleCallback = (handle: number) => clearTimeout(handle);

      // Temporarily assign to global scope for the test
      const originalRic = global.requestIdleCallback;
      const originalCic = global.cancelIdleCallback;
      global.requestIdleCallback = mockRequestIdleCallback;
      global.cancelIdleCallback = mockCancelIdleCallback;

      fs.from("idle").to<Context>("counting", {
        targetState: "counting",
        condition: conditionFn,
        evaluationConfig: {
          evaluationStrategy: "idle",
        },
      });

      await fs.state.updateContext<Context>({ count: 1 });
      expect(conditionFn.called).to.be.false;
      expect(fs.state.name).to.equal("idle");
      await clock.tickAsync(15);
      expect(conditionFn.called).to.be.true;
      expect(fs.state.name).to.equal("counting");

      // Clean up mocks
      global.requestIdleCallback = originalRic;
      global.cancelIdleCallback = originalCic;
    });
  });

  // --- Acceptance Criteria 4: Integration with Existing Features ---

  describe("Integration", () => {
    // beforeEach/afterEach handled globally

    it("should respect priority with watchProperties", async () => {
      fs.from("idle").to<Context>("highPriority", {
        targetState: "highPriority",
        condition: (_, ctx) => ctx.count > 0,
        priority: 2,
        evaluationConfig: { watchProperties: ["count"] },
      });
      fs.from("idle").to<Context>("lowPriority", {
        targetState: "lowPriority",
        condition: (_, ctx) => ctx.count > 0,
        priority: 1,
        evaluationConfig: { watchProperties: ["count"] },
      });

      await fs.state.updateContext<Context>({ count: 1 });
      await clock.tickAsync(10);
      expect(fs.state.name).to.equal("highPriority");
    });

    it("should work with debounce and watchProperties", async () => {
      fs.from("idle").to<Context>("counting", {
        targetState: "counting",
        condition: (_, ctx) => ctx.count > 0,
        debounce: 100,
        evaluationConfig: { watchProperties: ["count"] },
      });

      await fs.state.updateContext<Context>({ count: 1 });
      expect(fs.state.name).to.equal("idle");
      await clock.tickAsync(50);
      expect(fs.state.name).to.equal("idle");

      await fs.state.updateContext<Context>({ unrelated: "change" });
      await clock.tickAsync(50);
      expect(fs.state.name).to.equal("counting");

      fs.setState("idle");
      fs.state.updateContext<Context>({ count: 0 });
      await clock.tickAsync(100);

      await fs.state.updateContext<Context>({ count: 1 });
      await clock.tickAsync(50);
      await fs.state.updateContext<Context>({ count: 2 });
      await clock.tickAsync(50);
      expect(fs.state.name).to.equal("idle");

      await clock.tickAsync(100);
      expect(fs.state.name).to.equal("counting");
    });

    it("should work with debounce and skipIf", async () => {
      const skipIfSpy = sinon.spy((context: unknown) => (context as Context).shouldSkip);
      const conditionSpy = sinon.spy((state: State, ctx: Context) => ctx.needsProcessing);

      fs.from("idle").to<Context>("processing", {
        targetState: "processing",
        condition: conditionSpy,
        debounce: 100,
        evaluationConfig: { skipIf: skipIfSpy },
      });

      // Scenario 1: Skip becomes true during debounce
      await fs.state.updateContext<Context>({ needsProcessing: true, shouldSkip: false });
      await clock.tickAsync(50);
      await fs.state.updateContext<Context>({ shouldSkip: true });
      await clock.tickAsync(100);
      expect(fs.state.name).to.equal("idle");
      expect(skipIfSpy.called).to.be.true;
      expect(conditionSpy.called).to.be.false;

      // Scenario 2: Skip becomes false after debounce should have fired (but was skipped)
      fs.setState("idle");
      skipIfSpy.resetHistory();
      conditionSpy.resetHistory();
      await fs.state.updateContext<Context>({ needsProcessing: true, shouldSkip: true });
      await clock.tickAsync(150);
      expect(fs.state.name).to.equal("idle");
      expect(skipIfSpy.callCount).to.equal(1);
      expect(conditionSpy.called).to.be.false;

      await fs.state.updateContext<Context>({ shouldSkip: false });
      await clock.tickAsync(150);
      expect(fs.state.name).to.equal("processing");
      expect(skipIfSpy.callCount).to.equal(2);
      expect(conditionSpy.callCount).to.equal(1);
    });

    // Integration with batch updates would require the batch update feature
    // Add tests here once batch updates are implemented, verifying evaluation happens
    // after batch completion according to evaluationConfig.

    // Integration with transition groups - assuming groups can inherit/override evaluationConfig
    // Add tests here once transition groups are stable, verifying group-level config application.
  });
});
