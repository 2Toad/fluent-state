import { expect } from "chai";
import { FluentState } from "../src/fluent-state";
import { TimeTravel } from "../src/time-travel";
import { TimeSnapshot } from "../src/types";

describe("Time Travel Debugging", () => {
  let fluentState: FluentState;

  beforeEach(() => {
    fluentState = new FluentState({
      initialState: "idle",
      enableHistory: true,
    });

    // Set up a simple state machine
    fluentState.from("idle").to("loading");
    fluentState.from("loading").to("success");
    fluentState.from("loading").to("error");
    fluentState.from("error").to("idle");
    fluentState.from("success").to("idle");
  });

  describe("Basic Time Travel", () => {
    it("allows traveling to a specific point in history", async () => {
      // Create a few transitions
      await fluentState.transition("loading");

      // Add some context data
      const loadingState = fluentState.getCurrentState();
      loadingState?.updateContext({ progress: 50 });

      await fluentState.transition("success");

      const successState = fluentState.getCurrentState();
      successState?.updateContext({ data: { id: 123, name: "Test" } });

      await fluentState.transition("idle");

      // Get time travel functionality
      const timeTravel = fluentState.getTimeTravel();

      // Travel to the success state (index 1, since idle is index 0, the most recent)
      const snapshot = timeTravel.travelToIndex(1);

      // Verify we traveled to the right state
      expect(snapshot).to.not.be.null;
      expect(snapshot!.state).to.equal("success");
      expect(fluentState.getCurrentState()?.name).to.equal("success");

      // Verify context was restored
      const context = fluentState.getCurrentState()?.getContext();
      expect(context).to.deep.include({ data: { id: 123, name: "Test" } });

      // Verify we're in time travel mode
      expect(timeTravel.isTimeTravelMode()).to.be.true;
      expect(fluentState.isInTimeTravelMode()).to.be.true;
    });

    it("can navigate forward and backward through history", async () => {
      // Create a sequence of transitions
      await fluentState.transition("loading");
      await fluentState.transition("success");
      await fluentState.transition("idle");

      const timeTravel = fluentState.getTimeTravel();

      // Start time travel at the most recent state
      timeTravel.travelToIndex(0);
      expect(fluentState.getCurrentState()?.name).to.equal("idle");

      // Go back to the previous state
      const prevSnapshot = timeTravel.previous();
      expect(prevSnapshot).to.not.be.null;
      expect(prevSnapshot!.state).to.equal("success");
      expect(fluentState.getCurrentState()?.name).to.equal("success");

      // Go back again
      const prevSnapshot2 = timeTravel.previous();
      expect(prevSnapshot2).to.not.be.null;
      expect(prevSnapshot2!.state).to.equal("loading");
      expect(fluentState.getCurrentState()?.name).to.equal("loading");

      // Try to go back further (should return null as we're at the beginning)
      const nullSnapshot = timeTravel.previous();
      expect(nullSnapshot).to.be.null;
      expect(fluentState.getCurrentState()?.name).to.equal("loading");

      // Now go forward
      const nextSnapshot = timeTravel.next();
      expect(nextSnapshot).to.not.be.null;
      expect(nextSnapshot!.state).to.equal("success");

      // And forward again
      const nextSnapshot2 = timeTravel.next();
      expect(nextSnapshot2).to.not.be.null;
      expect(nextSnapshot2!.state).to.equal("idle");

      // Try to go forward further (should return null as we're at the end)
      const nullSnapshot2 = timeTravel.next();
      expect(nullSnapshot2).to.be.null;
    });

    it("can return to current state from time travel mode", async () => {
      // Create a few transitions with context
      await fluentState.transition("loading");

      const loadingState = fluentState.getCurrentState();
      loadingState?.updateContext({ progress: 75 });

      await fluentState.transition("success");

      const successState = fluentState.getCurrentState();
      successState?.updateContext({ result: "Completed" });

      // Remember the last state and context
      const finalStateName = fluentState.getCurrentState()?.name;
      const finalContext = fluentState.getCurrentState()?.getContext();

      // Time travel to a previous state
      const timeTravel = fluentState.getTimeTravel();
      timeTravel.travelToIndex(1); // Go to loading state

      expect(fluentState.getCurrentState()?.name).to.equal("loading");
      expect(fluentState.getCurrentState()?.getContext()).to.deep.include({ progress: 75 });

      // Return to current state
      const returnResult = timeTravel.returnToCurrent();

      // Verify we're back to the original state
      expect(returnResult).to.be.true;
      expect(timeTravel.isTimeTravelMode()).to.be.false;
      expect(fluentState.getCurrentState()?.name).to.equal(finalStateName);
      expect(fluentState.getCurrentState()?.getContext()).to.deep.include(finalContext);
    });
  });

  describe("Timeline Visualization", () => {
    it("generates a Mermaid timeline", async () => {
      // Create some transitions
      await fluentState.transition("loading");
      await fluentState.transition("success");
      await fluentState.transition("idle");

      // Generate a timeline visualization
      const timeline = fluentState.generateTimeline({ format: "mermaid" });

      // Verify the timeline contains the expected elements
      expect(timeline).to.include("timeline");
      expect(timeline).to.include("title State Transition Timeline");
      expect(timeline).to.include("idle → loading");
      expect(timeline).to.include("loading → success");
      expect(timeline).to.include("success → idle");
    });

    it("generates a DOT timeline", async () => {
      // Create some transitions
      await fluentState.transition("loading");
      await fluentState.transition("success");

      // Generate a timeline visualization
      const timeline = fluentState.generateTimeline({ format: "dot" });

      // Verify the timeline contains the expected elements
      expect(timeline).to.include("digraph Timeline");
      expect(timeline).to.include("rankdir=TB");
      expect(timeline).to.include("idle → loading");
      expect(timeline).to.include("loading → success");
    });

    it("includes context data when requested", async () => {
      // Create transitions with context
      await fluentState.transition("loading");

      const loadingState = fluentState.getCurrentState();
      loadingState?.updateContext({ progress: 42 });

      await fluentState.transition("success");

      // Generate a timeline with context
      const timeline = fluentState.generateTimeline({
        format: "mermaid",
        includeContext: true,
      });

      // Verify context data is included
      expect(timeline).to.include("Context");
      expect(timeline).to.include("progress");
    });
  });

  describe("Context Diffing", () => {
    it("detects added, removed, and changed properties", () => {
      // Set up an example state machine with initial context
      const fsWithContext = new FluentState({
        initialState: "idle",
        enableHistory: true,
      });

      // Create initial context
      const oldContext = {
        name: "Original",
        count: 5,
        nested: {
          value: 10,
        },
      };

      // Create updated context with 'name' changed (not removed)
      const newContext = {
        name: "Updated", // Changed from "Original" to "Updated"
        count: 5,
        added: true,
        nested: {
          value: 20,
        },
      };

      const timeTravel = fsWithContext.getTimeTravel();
      const diff = timeTravel.getDiff(oldContext, newContext, 1000, 2000);

      // Check the diff structure
      expect(diff.added).to.deep.equal({ added: true });
      // The name property is changed, not removed
      expect(diff.removed).to.deep.equal({});
      expect(diff.changed).to.have.property("name");
      expect(diff.changed.name).to.deep.equal({ from: "Original", to: "Updated" });
      expect(diff.changed).to.have.property("nested");

      // Now test a property that's actually removed
      const newerContext = {
        // name property removed
        count: 5,
        added: true,
        nested: {
          value: 20,
        },
      };

      const diff2 = timeTravel.getDiff(newContext, newerContext, 2000, 3000);
      expect(diff2.removed).to.deep.equal({ name: "Updated" });

      // Verify timestamps
      expect(diff.fromTimestamp).to.equal(1000);
      expect(diff.toTimestamp).to.equal(2000);
    });
  });

  describe("Integration with FluentState", () => {
    it("can be accessed through the FluentState API", () => {
      // Access time travel through FluentState
      const result = fluentState.travelToHistoryIndex(0);

      // Initially there's no history so this should return null
      expect(result).to.be.null;

      // Verify other methods are accessible
      expect(fluentState.isInTimeTravelMode()).to.be.false;
      expect(typeof fluentState.nextHistoryState).to.equal("function");
      expect(typeof fluentState.previousHistoryState).to.equal("function");
      expect(typeof fluentState.returnToCurrentState).to.equal("function");
      expect(typeof fluentState.generateTimeline).to.equal("function");
    });

    it("auto-enables history when time travel is used", () => {
      // Create a state machine without history enabled
      const fs = new FluentState({
        initialState: "start",
      });

      // Try to use time travel (should auto-enable history)
      fs.generateTimeline();

      // Verify history is now enabled
      expect(fs.history).to.not.be.undefined;
    });
  });
});
