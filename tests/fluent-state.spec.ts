import { expect, use, spy } from "chai";
import * as spies from "chai-spies";

use(spies);

import { FluentState, State } from "../src";
import { Lifecycle } from "../src/enums";

function setupBasicStateMachine(fs: FluentState) {
  // prettier-ignore
  fs.from("vegetable").to("diced").or("pickled")
    .from("diced").to("salad").or("trash");
}

describe("fluent-state", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  describe("state creation", () => {
    it("should create a state", () => {
      fs.from("vegetable");
      expect(!!fs._getState("vegetable")).to.equal(true);
    });

    it("current state should be set to first state", () => {
      fs.from("vegetable");
      expect(fs.state.name).to.equal("vegetable");
    });

    it("should create a transition", () => {
      const transition = fs.from("vegetable").to("diced");
      expect(transition.state.can("diced")).to.equal(true);
    });

    it('should create a transition using "or"', () => {
      const transition = fs.from("vegetable").to("diced").or("pickled");
      expect(transition.state.can("pickled")).to.equal(true);
    });

    it('should create multiple transitions chaining "to" and "or"', () => {
      const transition = fs.from("vegetable").to("diced").or("pickled");
      expect(transition.state.can("diced")).to.equal(true);
      expect(transition.state.can("pickled")).to.equal(true);
    });

    it("should not create duplicate transition", () => {
      const transition = fs.from("vegetable").to("diced").or("diced");
      const count = transition.state.transitions.filter((x) => x === "diced").length;
      expect(count).to.equal(1);
    });

    it("should add a transition to an existing state", () => {
      fs.from("vegetable").to("diced");
      const transition = fs.from("vegetable").to("pickled");
      expect(transition.state.can("diced")).to.equal(true);
    });

    it("should create multiple states and transitions", () => {
      // prettier-ignore
      fs.from("vegetable").to("diced").or("pickled")
        .from("diced").to("salad").or("trash");

      expect(fs.has("vegetable")).to.equal(true);
      expect(fs.has("diced")).to.equal(true);
      expect(fs.has("pickled")).to.equal(true);
      expect(fs.has("salad")).to.equal(true);
      expect(fs.has("trash")).to.equal(true);
    });

    it("should not allow creation of duplicate states", () => {
      fs.from("vegetable").to("diced");
      fs.from("vegetable").to("pickled");

      const state = fs._getState("vegetable");
      expect(state.transitions.length).to.equal(2);
    });
  });

  describe("state removal", () => {
    it("should remove a state and update transitions correctly", () => {
      fs.from("vegetable").to("diced").or("pickled");

      fs.remove("vegetable");

      expect(fs.state.name).to.equal("diced");
      expect(fs.has("vegetable")).to.be.false;
      expect(fs.has("diced")).to.be.true;
      expect(fs.has("pickled")).to.be.true;

      // After removing "vegetable", "diced" and "pickled" should not have any transitions
      expect(fs._getState("diced").transitions).to.be.empty;
      expect(fs._getState("pickled").transitions).to.be.empty;

      // Transition to "pickled" should fail now
      expect(fs.transition("pickled")).to.be.false;
      expect(fs.state.name).to.equal("diced");

      // We can add a new transition
      fs.from("diced").to("fried");
      expect(fs.transition("fried")).to.be.true;
      expect(fs.state.name).to.equal("fried");
    });

    it("should remove a state and update transitions correctly when multiple transitions exist", () => {
      // prettier-ignore
      fs.from("vegetable").to("diced")
        .from("diced").to("pickled");

      expect(fs._getState("vegetable").transitions).to.deep.equal(["diced"]);
      expect(fs._getState("diced").transitions).to.deep.equal(["pickled"]);
      expect(fs._getState("pickled").transitions).to.be.empty;

      fs.remove("vegetable");

      expect(fs.state.name).to.equal("diced");
      expect(fs.has("vegetable")).to.be.false;
      expect(fs.has("diced")).to.be.true;
      expect(fs.has("pickled")).to.be.true;

      expect(fs._getState("diced").transitions).to.deep.equal(["pickled"]);
      expect(fs._getState("pickled").transitions).to.be.empty;

      expect(fs.transition("pickled")).to.be.true;
      expect(fs.state.name).to.equal("pickled");
    });

    it("should remove an intermediate state and update transitions correctly", () => {
      // prettier-ignore
      fs.from("vegetable").to("diced")
        .from("diced").to("pickled");

      expect(fs._getState("vegetable").transitions).to.deep.equal(["diced"]);
      expect(fs._getState("diced").transitions).to.deep.equal(["pickled"]);
      expect(fs._getState("pickled").transitions).to.be.empty;

      fs.remove("diced");

      expect(fs.state.name).to.equal("vegetable");
      expect(fs.has("vegetable")).to.be.true;
      expect(fs.has("diced")).to.be.false;
      expect(fs.has("pickled")).to.be.true;

      expect(fs._getState("vegetable").transitions).to.be.empty;

      expect(fs.next()).to.be.false;
      expect(fs.state.name).to.equal("vegetable");

      expect(fs.transition("pickled")).to.be.false;
      expect(fs.state.name).to.equal("vegetable");
    });
  });

  describe("transition creation", () => {
    it("should create a transition", () => {
      const transition = fs.from("vegetable").to("diced");
      expect(transition.state.can("diced")).to.equal(true);
    });

    it('should create a transition using "or"', () => {
      const transition = fs.from("vegetable").to("diced").or("pickled");
      expect(transition.state.can("pickled")).to.equal(true);
    });

    it('should create multiple transitions chaining "to" and "or"', () => {
      const transition = fs.from("vegetable").to("diced").or("pickled");
      expect(transition.state.can("diced")).to.equal(true);
      expect(transition.state.can("pickled")).to.equal(true);
    });

    it("should not create duplicate transition", () => {
      const transition = fs.from("vegetable").to("diced").or("diced");
      const count = transition.state.transitions.filter((x) => x === "diced").length;
      expect(count).to.equal(1);
    });

    it("should add a transition to an existing state", () => {
      fs.from("vegetable").to("diced");
      const transition = fs.from("vegetable").to("pickled");
      expect(transition.state.can("diced")).to.equal(true);
    });

    it("should create multiple states and transitions", () => {
      fs.from("vegetable").to("diced").or("pickled").from("diced").to("salad").or("trash");

      expect(fs.has("vegetable")).to.equal(true);
      expect(fs.has("diced")).to.equal(true);
      expect(fs.has("pickled")).to.equal(true);
      expect(fs.has("salad")).to.equal(true);
      expect(fs.has("trash")).to.equal(true);
    });

    it("should not allow creation of duplicate states", () => {
      fs.from("vegetable").to("diced");
      fs.from("vegetable").to("pickled");

      const state = fs._getState("vegetable");
      expect(state.transitions.length).to.equal(2);
    });
  });

  describe("state transitions", () => {
    it("should transition to the next state", () => {
      fs.from("vegetable").to("diced");

      expect(fs.next()).to.equal(true);
      expect(fs.state.name).to.equal("diced");
    });

    it("should transition to the next random state", () => {
      fs.from("vegetable").to("diced").or("pickled").or("discarded");

      expect(fs.next()).to.equal(true);
      expect(["diced", "pickled", "discarded"].includes(fs.state.name)).to.equal(true);
    });

    it("should transition to the next random state (excluding)", () => {
      fs.from("vegetable").to("diced").or("pickled").or("eaten").or("discarded");

      expect(fs.next("diced", "pickled")).to.equal(true);
      expect(["eaten", "discarded"].includes(fs.state.name)).to.equal(true);
    });

    it("should not transition to the next random state when all states have been excluded", () => {
      // Disable state machine logging during this test
      console.warn = function () {};
      fs.from("vegetable").to("diced").or("pickled");

      expect(fs.next("diced", "pickled")).to.equal(false);
      expect(fs.state.name).to.equal("vegetable");
    });

    it("should transition to a specified state", () => {
      fs.from("vegetable").to("diced");

      expect(fs.transition("diced")).to.equal(true);
    });

    it("should transition to a random specified state", () => {
      fs.from("vegetable").to("diced").or("pickled").or("discarded");

      expect(fs.transition("diced", "discarded")).to.equal(true);
      expect(["diced", "discarded"].includes(fs.state.name)).to.equal(true);
    });

    it("transition should change state", () => {
      fs.from("vegetable").to("diced");
      fs.transition("diced");
      expect(fs.state.name).to.equal("diced");
    });

    it("should not transition to an invalid state", () => {
      fs.from("vegetable").to("diced");

      expect(fs.transition("foo")).to.equal(false);
    });

    it("should not transition to an invalid state and remain in the current state", () => {
      fs.from("vegetable").to("diced");

      expect(fs.transition("chopped")).to.equal(false);
      expect(fs.state.name).to.equal("vegetable");
    });

    it("should transition through multiple states", () => {
      fs.from("vegetable").to("diced").from("diced").to("salad");

      expect(fs.transition("diced")).to.equal(true);
      expect(fs.transition("salad")).to.equal(true);
      expect(fs.state.name).to.equal("salad");
    });
  });

  describe("callbacks", () => {
    it("should add a callback", () => {
      fs.from("vegetable").to("diced");

      let result = false;
      fs.when("diced").do(() => {
        result = true;
      });

      fs.transition("diced");

      expect(result).to.equal(true);
    });

    it("should add multiple callbacks", () => {
      fs.from("vegetable").to("diced");

      let result1 = false;
      let result2 = false;
      fs.when("diced")
        .do(() => {
          result1 = true;
        })
        .and(() => {
          result2 = true;
        });

      fs.transition("diced");

      expect(result1).to.equal(true);
      expect(result2).to.equal(true);
    });

    it("should execute callbacks with correct parameters", () => {
      fs.from("vegetable").to("diced");

      let previousStateName, currentStateName;
      fs.when("diced").do((prevState: State, currentState: State) => {
        previousStateName = prevState.name;
        currentStateName = currentState.name;
      });

      fs.transition("diced");

      expect(previousStateName).to.equal("vegetable");
      expect(currentStateName).to.equal("diced");
    });

    it("should execute callbacks in order", () => {
      const fs = new FluentState();
      const calls: number[] = [];

      const callback1 = spy(() => calls.push(1));
      const callback2 = spy(() => calls.push(2));

      fs.from("vegetable").to("diced");
      fs.when("diced").do(callback1).and(callback2);

      fs.transition("diced");

      expect(callback1).to.have.been.called();
      expect(callback2).to.have.been.called();
      expect(calls).to.deep.equal([1, 2]);
    });
  });

  describe("lifecycle events", () => {
    it("should add an observer", () => {
      fs.from("vegetable").to("diced");

      let result = false;
      fs.observe(Lifecycle.AfterTransition, () => {
        result = true;
      });

      fs.next();

      expect(result).to.equal(true);
    });

    it("should stop transition", () => {
      fs.from("vegetable").to("diced");

      fs.observe(Lifecycle.BeforeTransition, () => {
        return false;
      });

      fs.transition("diced");

      expect(fs.state.name).to.equal("vegetable");
    });

    it("should execute multiple observers in order", () => {
      fs.from("vegetable").to("diced");

      const results: number[] = [];
      fs.observe(Lifecycle.BeforeTransition, () => results.push(1));
      fs.observe(Lifecycle.BeforeTransition, () => results.push(2));
      fs.observe(Lifecycle.AfterTransition, () => results.push(3));

      fs.transition("diced");

      expect(results).to.deep.equal([1, 2, 3]);
    });

    it("should execute multiple observers for the same lifecycle event", () => {
      const results: string[] = [];
      fs.from("vegetable").to("diced");

      fs.observe(Lifecycle.AfterTransition, () => {
        results.push("observer1");
      });
      fs.observe(Lifecycle.AfterTransition, () => {
        results.push("observer2");
      });

      fs.transition("diced");
      expect(results).to.deep.equal(["observer1", "observer2"]);
    });

    it("should stop transition if BeforeTransition observer returns false", () => {
      fs.from("vegetable").to("diced");

      fs.observe(Lifecycle.BeforeTransition, () => false);

      expect(fs.transition("diced")).to.equal(false);
      expect(fs.state.name).to.equal("vegetable");
    });

    it("should trigger FailedTransition event when transitioning to an unknown state", () => {
      fs.from("vegetable").to("diced");

      fs.observe(Lifecycle.FailedTransition, (currentState: State, targetState: string) => {
        expect(currentState).to.deep.equal(fs.state);
        expect(currentState.name).to.equal("vegetable");
        expect(targetState).to.equal("unknown");
      });

      fs.transition("unknown");
    });
  });

  describe("complex scenarios", () => {
    beforeEach(() => {
      setupBasicStateMachine(fs);
    });

    it("should handle a complex state machine with multiple transitions and callbacks", () => {
      // prettier-ignore
      fs.from("raw").to("chopped").or("sliced")
        .from("chopped").to("cooked").or("seasoned")
        .from("sliced").to("fried").or("baked")
        .from("cooked").to("served")
        .from("seasoned").to("grilled")
        .from("fried").to("served")
        .from("baked").to("served")
        .from("grilled").to("served");

      const stateHistory: string[] = [];
      fs.observe(Lifecycle.AfterTransition, (_prevState: any, currentState: any) => {
        stateHistory.push(currentState.name);
      });

      fs.when("served").do(() => stateHistory.push("meal complete"));

      fs.transition("sliced");
      fs.transition("fried");
      fs.transition("served");

      expect(stateHistory).to.deep.equal(["sliced", "fried", "served", "meal complete"]);
    });
  });

  describe("error handling", () => {
    it("should return false when transitioning to an unknown state", () => {
      fs.from("vegetable").to("diced");
      const result = fs.transition("unknown");
      expect(result).to.be.false;
      expect(fs.state.name).to.equal("vegetable");
    });

    it("should create a new state when creating a transition from an unknown state", () => {
      fs.from("vegetable").to("diced");
      expect(() => fs.from("unknown").to("somewhere")).to.not.throw();
      expect(fs.has("unknown")).to.be.true;
      expect(fs.has("somewhere")).to.be.true;
    });

    it("should throw an error when adding a callback to an unknown state", () => {
      expect(() => fs.when("unknown").do(() => {})).to.throw('Unknown state: "unknown"');
    });
  });

  describe("asynchronous transitions", () => {
    it("should handle asynchronous transitions", async () => {
      fs.from("vegetable").to("diced");
      fs.when("diced").do(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const result = await fs.transition("diced");
      expect(result).to.be.true;
      expect(fs.state.name).to.equal("diced");
    });
  });
});
