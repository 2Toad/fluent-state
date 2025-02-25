import { expect } from "chai";
import { FluentState, TransitionHistory, TransitionHistoryOptions, SerializationOptions } from "../src";
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

  describe("Serialization", () => {
    it("should serialize transition history to JSON", async () => {
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

      // Perform transitions
      await fs.transition("running");
      await fs.transition("paused");

      // Serialize the history
      const json = fs.history!.toJSON();

      // Parse the JSON to verify its structure
      const parsed = JSON.parse(json);

      // Verify the serialized history
      expect(parsed).to.be.an("array");
      expect(parsed.length).to.equal(3); // Initial + 2 transitions
      expect(parsed[0].from).to.equal("running");
      expect(parsed[0].to).to.equal("paused");
      expect(parsed[0].success).to.be.true;
    });

    it("should filter sensitive context data during serialization", async () => {
      // Create a state machine with history enabled and a context filter
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
        historyOptions: {
          contextFilter: (context: any) => {
            if (!context) return context;
            // Create a filtered copy without sensitive data
            const filtered = { ...context };
            if (filtered.user) {
              // Remove sensitive user data but keep id
              filtered.user = { id: filtered.user.id };
            }
            return filtered;
          },
        },
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Update context with sensitive data and perform transition
      fs.state.updateContext({
        status: "ready",
        user: { id: 123, name: "Test User", email: "test@example.com", password: "secret" },
      });
      await fs.transition("running");

      // Serialize the history
      const json = fs.history!.toJSON();
      const parsed = JSON.parse(json);

      // Verify sensitive data is filtered
      expect(parsed[0].context.user).to.deep.equal({ id: 123 });
      expect(parsed[0].context.user.name).to.be.undefined;
      expect(parsed[0].context.user.email).to.be.undefined;
      expect(parsed[0].context.user.password).to.be.undefined;
      expect(parsed[0].context.status).to.equal("ready");
    });

    it("should override context filter during serialization", async () => {
      // Create a state machine with history enabled and a default context filter
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
        historyOptions: {
          contextFilter: (context: any) => {
            if (!context) return context;
            return { filtered: "default" };
          },
        },
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Update context and perform transition
      fs.state.updateContext({ status: "ready", sensitive: true });
      await fs.transition("running");

      // Serialize with a custom filter that overrides the default
      const json = fs.history!.toJSON({
        contextFilter: (context: any) => {
          if (!context) return context;
          return { filtered: "custom", status: context.status };
        },
      });

      const parsed = JSON.parse(json);

      // Verify custom filter was applied
      expect(parsed[0].context.filtered).to.equal("custom");
      expect(parsed[0].context.status).to.equal("ready");
      expect(parsed[0].context.sensitive).to.be.undefined;
    });

    it("should exclude context data during serialization if specified", async () => {
      // Create a state machine with history enabled
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      // Define states and transitions
      fs.from("idle").to("running");

      // Start the state machine
      await fs.start();

      // Update context and perform transition
      fs.state.updateContext({ status: "ready", sensitive: true });
      await fs.transition("running");

      // Serialize without context
      const json = fs.history!.toJSON({ includeContext: false });
      const parsed = JSON.parse(json);

      // Verify context is excluded
      expect(parsed[0].context).to.be.undefined;
    });

    it("should import serialized history with fromJSON", async () => {
      // Create a state machine and generate some history
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      fs.from("idle").to("running");
      await fs.start();
      await fs.transition("running");

      // Serialize the history
      const json = fs.history!.toJSON();

      // Create a new history instance from the JSON
      const importedHistory = TransitionHistory.fromJSON(json);

      // Verify the imported history
      const entries = importedHistory.getAll();
      expect(entries.length).to.equal(2); // Initial + 1 transition
      expect(entries[0].from).to.equal("idle");
      expect(entries[0].to).to.equal("running");
      expect(entries[0].success).to.be.true;
    });

    it("should apply options when importing serialized history", async () => {
      // Create a state machine and generate some history
      const fs = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      fs.from("idle").to("running");
      await fs.start();
      fs.state.updateContext({ sensitive: true });
      await fs.transition("running");

      // Serialize the history
      const json = fs.history!.toJSON();

      // Import with custom options
      const importedHistory = TransitionHistory.fromJSON(json, {
        maxSize: 5,
        includeContext: true,
        contextFilter: (context: any) => {
          if (!context) return context;
          return { filtered: true };
        },
      });

      // Verify the imported history
      const entries = importedHistory.getAll();
      expect(entries.length).to.equal(2);

      // Verify the context is preserved during import
      expect(entries[0].context).to.deep.include({ sensitive: true });

      // Serialize the imported history to verify the filter is applied
      const reserializedJson = importedHistory.toJSON();
      const reparsed = JSON.parse(reserializedJson);

      // Verify the filter is applied on re-serialization
      expect(reparsed[0].context).to.deep.equal({ filtered: true });
    });

    it("should handle invalid JSON gracefully", () => {
      // Try to import invalid JSON
      const importedHistory = TransitionHistory.fromJSON("invalid json");

      // Should return an empty history instance
      expect(importedHistory.getAll().length).to.equal(0);
    });
  });
});
