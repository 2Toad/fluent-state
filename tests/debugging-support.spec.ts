import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState } from "../src/fluent-state";
import { TransitionGroup } from "../src/transition-group";

describe("Testing and Debugging Support", () => {
  let fluentState: FluentState;
  let mainGroup: TransitionGroup;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    fluentState = new FluentState({ initialState: "idle" });
    mainGroup = fluentState.createGroup("mainGroup");

    // Add some transitions
    mainGroup.addTransition("idle", "loading");
    mainGroup.addTransition("loading", "success");
    mainGroup.addTransition("loading", "error");
    mainGroup.addTransition("error", "idle");

    // Add tags to some transitions
    mainGroup.addTagsToTransition("idle", "loading", ["start"]);
    mainGroup.addTagsToTransition("loading", "success", ["complete", "happy-path"]);
    mainGroup.addTagsToTransition("loading", "error", ["complete", "error-path"]);
    mainGroup.addTagsToTransition("error", "idle", ["reset"]);
  });

  afterEach(() => {
    clock.restore();
  });

  describe("Snapshot Functionality", () => {
    it("should create a snapshot of the current group state", () => {
      const snapshot = mainGroup.createSnapshot();

      expect(snapshot).to.be.an("object");
      expect(snapshot.name).to.equal("mainGroup");
      expect(snapshot.enabled).to.be.true;
      expect(snapshot.preventManualTransitions).to.be.false;
      expect(snapshot.transitions).to.be.an("array").with.lengthOf(4);

      // Verify transitions in the snapshot
      const idleToLoading = snapshot.transitions.find((t) => t.from === "idle" && t.to === "loading");
      expect(idleToLoading).to.exist;
      expect(idleToLoading?.tags).to.deep.equal(["start"]);

      const loadingToSuccess = snapshot.transitions.find((t) => t.from === "loading" && t.to === "success");
      expect(loadingToSuccess).to.exist;
      expect(loadingToSuccess?.tags).to.deep.equal(["complete", "happy-path"]);
    });

    it("should store the provided label in the snapshot", () => {
      const labeledSnapshot = mainGroup.createSnapshot("test-label");

      expect(labeledSnapshot.label).to.equal("test-label");
    });

    it("should have undefined label when no label is provided", () => {
      const unlabeledSnapshot = mainGroup.createSnapshot();

      expect(unlabeledSnapshot.label).to.be.undefined;
    });

    it("should maintain a history of snapshots up to the maximum limit", () => {
      // Set max snapshots to 3
      mainGroup.setMaxSnapshots(3);

      // Create 5 snapshots at different times
      for (let i = 0; i < 5; i++) {
        clock.tick(1000); // Advance time by 1 second
        mainGroup.createSnapshot(`snapshot-${i}`);
      }

      // Get all snapshots
      const snapshots = mainGroup.getSnapshots();

      // Should only have the 3 most recent snapshots
      expect(snapshots).to.have.lengthOf(3);

      // Verify timestamps are in ascending order
      expect(snapshots[0].timestamp).to.be.lessThan(snapshots[1].timestamp);
      expect(snapshots[1].timestamp).to.be.lessThan(snapshots[2].timestamp);

      // Verify labels are correct for the most recent snapshots
      expect(snapshots[0].label).to.equal("snapshot-2");
      expect(snapshots[1].label).to.equal("snapshot-3");
      expect(snapshots[2].label).to.equal("snapshot-4");
    });

    it("should clear all snapshots", () => {
      // Create some snapshots
      mainGroup.createSnapshot();
      mainGroup.createSnapshot();

      // Verify snapshots exist
      expect(mainGroup.getSnapshots()).to.have.lengthOf(2);

      // Clear snapshots
      mainGroup.clearSnapshots();

      // Verify snapshots are cleared
      expect(mainGroup.getSnapshots()).to.have.lengthOf(0);
    });
  });

  describe("Metrics Functionality", () => {
    it("should track transition attempts and success/failure counts", async () => {
      // Perform some transitions
      await mainGroup.transition("loading");
      await mainGroup.transition("success");
      await mainGroup.transition("unknown"); // This should fail

      const metrics = mainGroup.getMetrics();

      expect(metrics.transitionAttempts).to.equal(3);
      expect(metrics.successfulTransitions).to.equal(2);
      expect(metrics.failedTransitions).to.equal(1);
    });

    it("should track transition frequency", async () => {
      // Perform multiple transitions
      await mainGroup.transition("loading");
      await mainGroup.transition("error");
      await mainGroup.transition("idle");
      await mainGroup.transition("loading");
      await mainGroup.transition("success");

      const metrics = mainGroup.getMetrics();

      // Check transition frequency
      expect(metrics.transitionFrequency).to.be.an("object");
      expect(metrics.transitionFrequency.idle).to.be.an("object");
      expect(metrics.transitionFrequency.idle.loading).to.equal(2);
      expect(metrics.transitionFrequency.loading.error).to.equal(1);
      expect(metrics.transitionFrequency.loading.success).to.equal(1);

      // Check most frequent transition
      expect(metrics.mostFrequentTransition).to.deep.include({
        from: "idle",
        to: "loading",
        count: 2,
      });
    });

    it("should calculate average transition time", async () => {
      // Perform a transition with a delay
      const transitionPromise = mainGroup.transition("loading");
      clock.tick(50);
      await transitionPromise;

      // Perform another transition with a different delay
      const transitionPromise2 = mainGroup.transition("success");
      clock.tick(150);
      await transitionPromise2;

      const metrics = mainGroup.getMetrics();

      // Average should be approximately 100ms (average of 50ms and 150ms)
      expect(metrics.averageTransitionTime).to.be.closeTo(100, 10);
    });

    it("should reset metrics", async () => {
      // Perform some transitions
      await mainGroup.transition("loading");
      await mainGroup.transition("success");

      // Verify metrics exist
      const initialMetrics = mainGroup.getMetrics();
      expect(initialMetrics.transitionAttempts).to.equal(2);

      // Reset metrics
      mainGroup.resetMetrics();

      // Verify metrics are reset
      const resetMetrics = mainGroup.getMetrics();
      expect(resetMetrics.transitionAttempts).to.equal(0);
      expect(resetMetrics.successfulTransitions).to.equal(0);
      expect(resetMetrics.failedTransitions).to.equal(0);
      expect(resetMetrics.averageTransitionTime).to.equal(0);
    });
  });
});
