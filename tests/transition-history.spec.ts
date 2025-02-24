import { expect } from "chai";
import { FluentState, TransitionHistory, TransitionHistoryOptions } from "../src";
import { fluentState } from "../src/fluent-state";

describe("Transition History", () => {
  // Reset the default instance after each test
  afterEach(() => {
    fluentState.clear();
    // @ts-ignore - Resetting private property for testing
    fluentState.historyEnabled = false;
    // @ts-ignore - Resetting property for testing
    fluentState.history = undefined;
  });

  describe("Basic functionality", () => {
    it("should record successful transitions", async () => {
      // Create a state machine with history enabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      // Define states and transitions
      fs.from("idle").to("running");
      fs.from("running").to("paused");

      // Start the state machine
      await fs.start();

      // Verify initial state is recorded
      expect(fs.history).to.exist;
      const initialTransition = fs.history!.getLastTransition();
      expect(initialTransition).to.exist;
      expect(initialTransition!.from).to.equal("null");
      expect(initialTransition!.to).to.equal("idle");
      expect(initialTransition!.success).to.equal(true);

      // Perform a transition
      await fs.transition("running");

      // Verify transition is recorded
      const runningTransition = fs.history!.getLastTransition();
      expect(runningTransition).to.exist;
      expect(runningTransition!.from).to.equal("idle");
      expect(runningTransition!.to).to.equal("running");
      expect(runningTransition!.success).to.equal(true);

      // Perform another transition
      await fs.transition("paused");

      // Verify transition is recorded
      const pausedTransition = fs.history!.getLastTransition();
      expect(pausedTransition).to.exist;
      expect(pausedTransition!.from).to.equal("running");
      expect(pausedTransition!.to).to.equal("paused");
      expect(pausedTransition!.success).to.equal(true);
    });

    it("should record failed transitions", async () => {
      // Create a state machine with history enabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Attempt an invalid transition
      await fs.transition("completed");

      // Verify failed transition is recorded
      const failedTransition = fs.history!.getLastTransition();
      expect(failedTransition).to.exist;
      expect(failedTransition!.from).to.equal("idle");
      expect(failedTransition!.to).to.equal("completed");
      expect(failedTransition!.success).to.equal(false);
    });

    it("should respect maxSize configuration", async () => {
      // Create a state machine with history enabled and small maxSize
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
        historyOptions: {
          maxSize: 2,
        },
      });

      // Define states and transitions
      fs.from("idle").to("running");
      fs.from("running").to("paused");
      fs.from("paused").to("stopped");

      // Start the state machine
      await fs.start();

      // Perform multiple transitions
      await fs.transition("running");
      await fs.transition("paused");
      await fs.transition("stopped");

      // Verify only the most recent transitions are kept
      const allTransitions = fs.history!.getAll();
      expect(allTransitions.length).to.equal(2);
      expect(allTransitions[0].to).to.equal("stopped");
      expect(allTransitions[1].to).to.equal("paused");
    });

    it("should enable history with enableHistory() method", async () => {
      // Create a state machine without history
      const fs = new FluentState({
        initialState: "idle",
      });

      // Initially, history should not be enabled
      expect(fs.history).to.be.undefined;

      // Enable history
      fs.enableHistory();

      // Now history should be enabled
      expect(fs.history).to.exist;

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Perform a transition
      await fs.transition("running");

      // Verify transition is recorded
      const transition = fs.history!.getLastTransition();
      expect(transition).to.exist;
      expect(transition!.from).to.equal("idle");
      expect(transition!.to).to.equal("running");
      expect(transition!.success).to.equal(true);
    });

    it("should configure history options with enableHistory() method", async () => {
      // Create a state machine without history
      const fs = new FluentState({
        initialState: "idle",
      });

      // Enable history with custom options
      fs.enableHistory({
        maxSize: 2,
        includeContext: false,
      });

      // Define states and transitions
      fs.from("idle").to("running");
      fs.from("running").to("paused");
      fs.from("paused").to("stopped");

      // Start the state machine
      await fs.start();

      // Update context and perform transitions
      fs.state.updateContext({ status: "ready" });
      await fs.transition("running");
      await fs.transition("paused");
      await fs.transition("stopped");

      // Verify maxSize is respected
      const allTransitions = fs.history!.getAll();
      expect(allTransitions.length).to.equal(2);
      expect(allTransitions[0].to).to.equal("stopped");
      expect(allTransitions[1].to).to.equal("paused");

      // Verify context is not included
      expect(allTransitions[0].context).to.be.undefined;
    });

    it("should support method chaining with enableHistory()", async () => {
      // Create a state machine and use method chaining
      const fs = new FluentState();

      // Enable history and define states in a chain
      fs.enableHistory().from("idle").to("running");
      fs.from("running").to("paused");

      // Start the state machine
      await fs.start();

      // Perform transitions
      await fs.transition("running");

      // Verify transition is recorded
      const transition = fs.history!.getLastTransition();
      expect(transition).to.exist;
      expect(transition!.from).to.equal("idle");
      expect(transition!.to).to.equal("running");
    });
  });

  describe("Default instance", () => {
    it("should enable history on the default instance", async () => {
      // Enable history on the default instance
      fluentState.enableHistory();

      // Define states and transitions
      fluentState.from("idle").to("running");

      // Start the state machine
      await fluentState.start();

      // Perform a transition
      await fluentState.transition("running");

      // Verify transition is recorded
      const transition = fluentState.history!.getLastTransition();
      expect(transition).to.exist;
      expect(transition!.from).to.equal("idle");
      expect(transition!.to).to.equal("running");
      expect(transition!.success).to.equal(true);
    });

    it("should configure history options on the default instance", async () => {
      // Enable history with custom options
      fluentState.enableHistory({
        maxSize: 2,
        includeContext: false,
      });

      // Define states and transitions
      fluentState.from("idle").to("running");
      fluentState.from("running").to("paused");
      fluentState.from("paused").to("stopped");

      // Start the state machine
      await fluentState.start();

      // Update context and perform transitions
      fluentState.state.updateContext({ status: "ready" });
      await fluentState.transition("running");
      await fluentState.transition("paused");
      await fluentState.transition("stopped");

      // Verify maxSize is respected
      const allTransitions = fluentState.history!.getAll();
      expect(allTransitions.length).to.equal(2);
      expect(allTransitions[0].to).to.equal("stopped");
      expect(allTransitions[1].to).to.equal("paused");

      // Verify context is not included
      expect(allTransitions[0].context).to.be.undefined;
    });

    it("should support method chaining with the default instance", async () => {
      // Use method chaining with the default instance
      fluentState.enableHistory().from("idle").to("running").from("running").to("paused");

      // Start the state machine
      await fluentState.start();

      // Perform transitions
      await fluentState.transition("running");

      // Verify transition is recorded
      const transition = fluentState.history!.getLastTransition();
      expect(transition).to.exist;
      expect(transition!.from).to.equal("idle");
      expect(transition!.to).to.equal("running");
    });
  });

  describe("Query functionality", () => {
    it("should query transitions for a specific state", async () => {
      // Create a state machine with history enabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      // Define states and transitions
      fs.from("idle").to("running");
      fs.from("running").to("paused");
      fs.from("paused").to("running");

      // Start the state machine
      await fs.start();

      // Perform multiple transitions
      await fs.transition("running");
      await fs.transition("paused");
      await fs.transition("running");

      // Query transitions for the "running" state
      const runningTransitions = fs.history!.getTransitionsForState("running");
      expect(runningTransitions.length).to.equal(3); // Two to "running" and one from "running"

      // Verify transitions are in chronological order (newest first)
      expect(runningTransitions[0].to).to.equal("running");
      expect(runningTransitions[1].from).to.equal("running");
      expect(runningTransitions[2].to).to.equal("running");
    });

    it("should clear transition history", async () => {
      // Create a state machine with history enabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Perform a transition
      await fs.transition("running");

      // Verify history has entries
      expect(fs.history!.getAll().length).to.be.greaterThan(0);

      // Clear history
      fs.history!.clear();

      // Verify history is empty
      expect(fs.history!.getAll().length).to.equal(0);
    });
  });

  describe("Context handling", () => {
    it("should include context data in transitions when enabled", async () => {
      // Create a state machine with history enabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
        historyOptions: {
          includeContext: true,
        },
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Update context and perform transition
      fs.state.updateContext({ status: "ready" });
      await fs.transition("running");

      // Verify context is included in transition
      const transition = fs.history!.getLastTransition();
      expect(transition!.context).to.exist;
      expect((transition!.context as any).status).to.equal("ready");
    });

    it("should exclude context data in transitions when disabled", async () => {
      // Create a state machine with history enabled but context disabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
        historyOptions: {
          includeContext: false,
        },
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Update context and perform transition
      fs.state.updateContext({ status: "ready" });
      await fs.transition("running");

      // Verify context is not included in transition
      const transition = fs.history!.getLastTransition();
      expect(transition!.context).to.be.undefined;
    });
  });
});
