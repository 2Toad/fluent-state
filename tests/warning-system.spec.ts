import { expect } from "chai";
import { FluentState } from "../src/fluent-state";

describe("Warning System", () => {
  describe("Basic warning detection", () => {
    it("should detect unreachable states", () => {
      const fsm = new FluentState({ initialState: "start" });

      // Create a reachable path
      fsm.from("start").to("middle");
      fsm.from("middle").to("end");

      // Create an unreachable state
      fsm.from("unreachable").to("end");

      const warnings = fsm.validateStateMachine();

      // Find warnings of type 'unreachable-state'
      const unreachableWarnings = warnings.filter((w) => w.type === "unreachable-state");

      expect(unreachableWarnings).to.have.length(1);
      expect(unreachableWarnings[0].states).to.include("unreachable");
    });

    it("should detect dead-end states", () => {
      const fsm = new FluentState({ initialState: "start" });

      // Create a path that ends
      fsm.from("start").to("middle");
      fsm.from("middle").to("end");

      // 'end' is a dead-end state with no outgoing transitions

      const warnings = fsm.validateStateMachine();

      // Find warnings of type 'dead-end-state'
      const deadEndWarnings = warnings.filter((w) => w.type === "dead-end-state");

      expect(deadEndWarnings).to.have.length(1);
      expect(deadEndWarnings[0].states).to.include("end");
    });

    it("should detect circular transitions with no exit", () => {
      const fsm = new FluentState({ initialState: "start" });

      // Create a circular path with no exit
      fsm.from("loop1").to("loop2");
      fsm.from("loop2").to("loop3");
      fsm.from("loop3").to("loop1");

      const warnings = fsm.validateStateMachine();

      // Find warnings of type 'circular-transition'
      const circularWarnings = warnings.filter((w) => w.type === "circular-transition");

      expect(circularWarnings).to.have.length(1);
      expect(circularWarnings[0].states).to.have.members(["loop1", "loop2", "loop3"]);
    });
  });

  describe("Warning configuration", () => {
    it("should filter warnings by severity", () => {
      const fsm = new FluentState({ initialState: "start" });

      // Create a reachable path
      fsm.from("start").to("middle");
      fsm.from("middle").to("end");

      // Create an unreachable state
      fsm.from("unreachable").to("end");

      // Create a dead-end
      // 'end' is a dead-end

      // Only get 'error' level warnings
      const errorWarnings = fsm.validateStateMachine({ severity: "error" });

      // No warnings should be returned as default severity is 'warn'
      expect(errorWarnings).to.have.length(0);

      // Get all warnings
      const allWarnings = fsm.validateStateMachine();
      expect(allWarnings.length).to.be.greaterThan(0);
    });

    it("should filter warnings by type", () => {
      const fsm = new FluentState({ initialState: "start" });

      // Create a reachable path
      fsm.from("start").to("middle");
      fsm.from("middle").to("end");

      // Create an unreachable state
      fsm.from("unreachable").to("end");

      // Only get unreachable state warnings
      const unreachableWarnings = fsm.validateStateMachine({
        types: ["unreachable-state"],
      });

      expect(unreachableWarnings).to.have.length(1);
      expect(unreachableWarnings[0].type).to.equal("unreachable-state");

      // Get unreachable and dead-end warnings
      const multipleTypeWarnings = fsm.validateStateMachine({
        types: ["unreachable-state", "dead-end-state"],
      });

      expect(multipleTypeWarnings.length).to.be.greaterThan(1);
    });
  });

  describe("Automatic validation", () => {
    it("should automatically validate when configured", () => {
      const logs: string[] = [];

      const fsm = new FluentState({
        initialState: "start",
        debug: {
          logLevel: "warn",
          logHandlers: [
            (entry) => {
              if (entry.message.includes("Warning")) {
                logs.push(entry.message);
              }
            },
          ],
          // Enable automatic validation
          autoValidate: true,
        },
      });

      // Create a reachable path
      fsm.from("start").to("middle");
      fsm.from("middle").to("end");

      // Create an unreachable state
      fsm.from("unreachable").to("end");

      // Warnings should be logged automatically due to the autoValidate setting
      expect(logs.length).to.be.greaterThan(0);
      expect(logs.some((log) => log.includes("unreachable"))).to.be.true;
    });
  });
});
