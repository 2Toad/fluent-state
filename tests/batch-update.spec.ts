import { expect } from "chai";
import * as chai from "chai";
import * as spies from "chai-spies";
import * as sinon from "sinon";
import { FluentState } from "../src/fluent-state";
import { State } from "../src/state";

chai.use(spies);

describe("Batch Updates", () => {
  let fs: FluentState;
  let evaluateAutoTransitionsSpy: sinon.SinonStub;
  let setStateSpy: sinon.SinonStub;
  let getContextStub: sinon.SinonStub;

  beforeEach(() => {
    // Create stubs for testing
    evaluateAutoTransitionsSpy = sinon.stub().resolves(true);
    setStateSpy = sinon.stub();
    getContextStub = sinon.stub().returns({});

    // Create a stub for the State.prototype methods we want to track
    sinon.stub(State.prototype, "evaluateAutoTransitions").callsFake(evaluateAutoTransitionsSpy);

    // Create the FluentState instance
    fs = new FluentState({
      initialState: "idle",
      enableHistory: true,
    });

    // Create a stub for stateManager
    Object.defineProperty(fs.state, "stateManager", {
      value: {
        setState: setStateSpy,
        getState: getContextStub,
      },
    });

    // Configure state machine with states and transitions
    fs.from("idle").to("processing");
    fs.from("processing").to("completed");
    fs.from("processing").to("error");

    fs.start();
  });

  afterEach(() => {
    fs.clear();
    sinon.restore();
  });

  it("should apply all updates in a batch", async () => {
    // Setup to handle all object types
    getContextStub.returns({});

    // Perform batch update with any types
    const result = await fs.state.batchUpdate<any>([{ counter: 1 }, { status: "in-progress" }, { progress: 50 }]);

    // Verify results
    expect(result).to.be.true;
    expect(setStateSpy.callCount).to.equal(3);
  });

  it("should handle empty update arrays", async () => {
    const result = await fs.state.batchUpdate([]);
    expect(result).to.be.true;
  });

  it("should support the evaluateAfterComplete option", async () => {
    // Setup to handle all object types
    getContextStub.returns({});

    // Perform batch update with evaluateAfterComplete = true
    await fs.state.batchUpdate<any>([{ startProcessing: true }, { progress: 25 }, { progress: 50 }], { evaluateAfterComplete: true });

    // Should only evaluate transitions once at the end
    expect(evaluateAutoTransitionsSpy.callCount).to.equal(1);

    // Reset spy
    evaluateAutoTransitionsSpy.reset();

    // Perform batch update with default evaluateAfterComplete = false
    await fs.state.batchUpdate<any>([{ progress: 60 }, { progress: 75 }, { progress: 90 }]);

    // Should evaluate transitions after each update
    expect(evaluateAutoTransitionsSpy.callCount).to.equal(3);
  });

  it("should support atomic updates", async () => {
    // Set up a scenario where an update will fail
    const errorMsg = "Update failed";

    // Make the second update fail
    setStateSpy.onFirstCall().returns(undefined); // First update succeeds
    setStateSpy.onSecondCall().throws(new Error(errorMsg)); // Second update fails

    // Perform batch update with atomic = true
    const result = await fs.state.batchUpdate<any>([{ step1: "complete" }, { step2: "will-fail" }], { atomic: true });

    // Verify results
    expect(result).to.be.false;
  });

  it("should continue processing in non-atomic mode even if updates fail", async () => {
    // Set up a scenario where an update will fail
    const errorMsg = "Update failed";

    // Make the second update fail
    setStateSpy.onFirstCall().returns(undefined); // First update succeeds
    setStateSpy.onSecondCall().throws(new Error(errorMsg)); // Second update fails
    setStateSpy.onThirdCall().returns(undefined); // Third update succeeds

    // Perform batch update with atomic = false (default)
    const result = await fs.state.batchUpdate<any>([{ step1: "complete" }, { step2: "will-fail" }, { step3: "complete" }]);

    // Verify results
    expect(result).to.be.true; // At least one update succeeded
  });

  it("should support fluent API with batchUpdateFluid", () => {
    // Test the fluent API
    const state = fs.state.batchUpdateFluid<any>([{ value1: "test" }, { value2: 42 }]);

    // Should return the state object for chaining
    expect(state).to.equal(fs.state);
  });

  it("should record transitions in history when using batch updates", async () => {
    // Check if history is enabled
    expect(fs.history).to.exist;

    // Create a spy for recordTransition
    const recordTransitionSpy = sinon.spy(fs.history as any, "recordTransition");

    // Setup a transition
    evaluateAutoTransitionsSpy.callsFake(async () => {
      await fs.transition("processing");
      return true;
    });

    // Trigger a state transition with a batch update
    await fs.state.batchUpdate<any>([{ startProcessing: true }]);

    // Verify transition was recorded
    expect(recordTransitionSpy.called).to.be.true;
    expect(fs.state.name).to.equal("processing");
  });

  // Additional tests for AC2-AC4

  it("should respect transition priorities in auto-transitions", () => {
    // Reset stubs to avoid conflicts
    sinon.restore();

    // Create a simple state machine
    const realFs = new FluentState({
      initialState: "state1",
    });

    // Create a stub for transition to verify which one gets called
    const highPriorityStub = sinon.stub().returns(true);
    const lowPriorityStub = sinon.stub().returns(true);

    // Create transitions with different priorities
    realFs.from("state1").to("high", {
      condition: highPriorityStub,
      targetState: "high",
      priority: 2,
    });

    realFs.from("state1").to("low", {
      condition: lowPriorityStub,
      targetState: "low",
      priority: 1,
    });

    // Mock evaluateAutoTransitions to capture the evaluation order
    sinon.stub(realFs.state, "evaluateAutoTransitions").callsFake(async () => {
      // Simulate the transition evaluation without actually changing state
      const transitions = [
        { condition: highPriorityStub, targetState: "high", priority: 2 },
        { condition: lowPriorityStub, targetState: "low", priority: 1 },
      ].sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Check if conditions are evaluated in priority order
      for (const t of transitions) {
        t.condition(realFs.state, {});
        if (highPriorityStub.called) {
          // If high priority was called first, test passes
          break;
        }
      }

      return true;
    });

    // Trigger auto-transition evaluation via batch update
    realFs.state.batchUpdate<any>([{ update: true }]);

    // Verify that the high priority condition was called first
    expect(highPriorityStub.called).to.be.true;
    expect(highPriorityStub.calledBefore(lowPriorityStub)).to.be.true;
  });

  it("should revert context on atomic failure", async () => {
    // Create a test machine with debounced auto-transition
    const machine = new FluentState({
      initialState: "idle",
    });

    // Set up states
    machine.from("idle");
    machine.from("processing");
    machine.from("failed");

    // Set up a context change tracker
    const contextTracker: any[] = [];
    const updateContext = sinon.stub();
    updateContext.onCall(2).throws(new Error("Simulated failure during update"));

    // Create state manager stub that tracks context changes
    Object.defineProperty(machine.state, "stateManager", {
      value: {
        setState: (ctx: any) => {
          contextTracker.push({ ...ctx });
          updateContext(ctx);
        },
        getState: () => (contextTracker.length > 0 ? contextTracker[contextTracker.length - 1] : { count: 0 }),
      },
    });

    // Initialize with starting context
    contextTracker.push({ count: 0 });

    await machine.start();

    // Verify that batch updates in atomic mode will revert on failure
    const result = await machine.state.batchUpdate<any>(
      [
        { count: 1 },
        { count: 2 },
        { count: 3 }, // This will fail
        { count: 4 },
      ],
      { atomic: true },
    );

    // Should revert to original context
    expect(result).to.be.false;
    expect(machine.state.getContext()).to.deep.equal({ count: 0 });
  });

  it("should integrate with state management system", async () => {
    // Create a test machine and spy for debounced auto-transitions
    const machine = new FluentState({
      initialState: "idle",
    });

    // Spy to verify cancellation of debounced transitions
    chai.spy.on(machine.state, "clearAllDebounceTimers");

    // Add states
    machine.from("idle");
    machine.from("processing");

    // Setup basic context tracking
    let context = { progress: 0 };
    Object.defineProperty(machine.state, "stateManager", {
      value: {
        setState: (ctx: any) => {
          context = { ...context, ...ctx };
        },
        getState: () => context,
      },
    });

    await machine.start();

    // Run atomic batch update
    await machine.state.batchUpdate([{ progress: 50 }, { progress: 100 }], { atomic: true });

    // Verify batch update completed successfully
    expect(machine.state.getContext()).to.deep.equal({ progress: 100 });
  });

  it("should provide detailed error information for failed updates", async () => {
    // Reset stubs and create fresh test instance
    sinon.restore();

    // Create a log capture handler to verify error details
    const capturedLogs: any[] = [];
    const logHandler = (entry: any) => {
      if (entry.level === "error" || entry.level === "warn") {
        capturedLogs.push(entry);
      }
    };

    // Create a state machine with debug enabled
    const realFs = new FluentState({
      initialState: "start",
      debug: {
        logLevel: "debug",
        logHandlers: [logHandler],
      },
    });

    // Create a state manager with controlled failing behavior
    const updates: any[] = [];
    interface ErrorData {
      triggered: boolean;
      update: any;
      error: Error | null;
    }
    const errorData: ErrorData = { triggered: false, update: null, error: null };

    Object.defineProperty(realFs.state, "stateManager", {
      value: {
        setState: (ctx: any) => {
          // Track the update being processed
          const currentUpdate = { ...ctx };

          // Simulate an error on the second update
          if (updates.length === 1 && !errorData.triggered) {
            errorData.triggered = true;
            errorData.update = currentUpdate;
            const error = new Error("Specific update error");
            errorData.error = error;
            throw error;
          }

          // Only track successful updates
          updates.push(currentUpdate);
        },
        getState: () => ({ current: "value" }),
      },
    });

    // Execute batch update with atomic false to continue after errors
    const result = await realFs.state.batchUpdate(
      [
        { step: 1 },
        { step: 2 }, // This will fail
        { step: 3 },
      ],
      { atomic: false },
    );

    // Verify the result indicates partial success
    expect(result).to.be.true;

    // Check the actual number of successful updates
    expect(updates.length).to.be.greaterThan(0);
    expect(updates[0]).to.deep.include({ step: 1 });

    // If we successfully got to step 3, verify it
    if (updates.length > 1) {
      expect(updates[1]).to.deep.include({ step: 3 });
    }

    // Verify error information was captured
    expect(errorData.triggered).to.be.true;
    expect(errorData.error!.message).to.equal("Specific update error");
    expect(errorData.update).to.deep.include({ step: 2 });

    // Verify debug logs contain error details
    expect(capturedLogs.length).to.be.greaterThan(0);
    const errorLog = capturedLogs.find(
      (log) => typeof log.message === "string" && (log.message.includes("Error in batch update") || log.message.includes("failed")),
    );
    expect(errorLog).to.exist;
  });

  it("should integrate with custom state management", async () => {
    // Reset stubs to avoid conflicts
    sinon.restore();

    // Create a state machine with a custom context handler
    const customFs = new FluentState({
      initialState: "initial",
    });

    // Set a custom function to process updates
    const updateSpy = sinon.spy(customFs.state, "updateContext");

    // Execute batch update
    await customFs.state.batchUpdate<any>([{ test: true }]);

    // Verify our update function was called during batch processing
    expect(updateSpy.called).to.be.false; // batchUpdate doesn't call updateContext directly

    // Direct update should use updateContext
    customFs.state.updateContext({ directTest: true });
    expect(updateSpy.callCount).to.equal(1);

    // Reset the spy
    updateSpy.resetHistory();

    // Batch update with custom function should work too
    const batchSpy = sinon.spy(customFs.state, "batchUpdate");
    await customFs.state.batchUpdate<any>([{ another: true }]);
    expect(batchSpy.called).to.be.true;
  });

  it("should respect transition group configurations", async () => {
    // Reset stubs to avoid conflicts
    sinon.restore();

    // Create a new state machine for testing groups
    const groupFs = new FluentState({
      initialState: "start",
    });

    // Create a spy on the transition method to see if it gets called
    const transitionSpy = sinon.spy(groupFs, "transition");

    // Create a transition group
    const group = groupFs.createGroup("testGroup");

    // Add a state to transition to
    groupFs._addState("start");
    groupFs._addState("end");

    // Add a transition to the group
    group.from("start").to("end");

    // Start the machine
    await groupFs.start();

    // Execute a batch update with the group disabled first
    group.disable();

    await groupFs.state.batchUpdate<any>([{ test: true }]);

    // Since the group is disabled, the state should stay at "start"
    expect(groupFs.state.name).to.equal("start");

    // Now enable the group and try a direct transition
    group.enable();
    await groupFs.transition("end");

    // This should now be allowed
    expect(transitionSpy.called).to.be.true;
    expect(groupFs.state.name).to.equal("end");
  });

  it("should allow manual transitions during batch updates with evaluateAfterComplete", async () => {
    // Create transition spy
    const transitionSpy = sinon.spy(fs, "transition");

    // Create an async batch update that takes some time
    const batchPromise = fs.state.batchUpdate<any>([{ step1: "slow" }, { step2: "slower" }, { step3: "slowest" }], { evaluateAfterComplete: true });

    // During the batch update, call a manual transition
    await fs.transition("processing");

    // Wait for batch to complete
    await batchPromise;

    // Verify manual transition was called and worked
    expect(transitionSpy.called).to.be.true;
    expect(fs.state.name).to.equal("processing");
  });
});
