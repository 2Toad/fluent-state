import { expect } from "chai";
import { FluentState } from "../src";

describe("Transitions", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
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

    it("should transition to a specified state", () => {
      fs.from("vegetable").to("diced");

      expect(fs.transition("diced")).to.equal(true);
      expect(fs.state.name).to.equal("diced");
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

    it("should transition to a random specified state", () => {
      fs.from("vegetable").to("diced").or("pickled").or("discarded");

      expect(fs.transition("diced", "discarded")).to.equal(true);
      expect(["diced", "discarded"].includes(fs.state.name)).to.equal(true);
    });

    it("should transition through multiple states", () => {
      fs.from("vegetable").to("diced").from("diced").to("salad");

      expect(fs.transition("diced")).to.equal(true);
      expect(fs.transition("salad")).to.equal(true);
      expect(fs.state.name).to.equal("salad");
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

    it("transition should change state", () => {
      fs.from("vegetable").to("diced");
      fs.transition("diced");
      expect(fs.state.name).to.equal("diced");
    });
  });

  describe("Edge Cases for State Transitions", () => {
    it("should handle transitions with no available states", () => {
      const fs = new FluentState();
      expect(fs.transition("nonexistent")).to.be.false;
    });

    it("should handle circular state transitions", () => {
      const fs = new FluentState();
      fs.from("A").to("B").from("B").to("A");

      expect(fs.transition("B")).to.be.true;
      expect(fs.state.name).to.equal("B");

      expect(fs.transition("A")).to.be.true;
      expect(fs.state.name).to.equal("A");
    });
  });
});
