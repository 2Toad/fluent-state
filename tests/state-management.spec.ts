import { expect } from "chai";
import { FluentState } from "../src";

describe("State Management", () => {
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

    it("should not create duplicate states", () => {
      fs.from("vegetable").to("diced");
      fs.from("vegetable").to("pickled");

      const state = fs._getState("vegetable");
      expect(state.transitions.length).to.equal(2);
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
  });

  describe("state removal", () => {
    it("should remove a state and update transitions correctly", () => {
      fs.from("vegetable").to("diced").or("pickled");

      fs.remove("vegetable");

      expect(fs.state.name).to.equal("diced");
      expect(fs.has("vegetable")).to.be.false;
      expect(fs.has("diced")).to.be.true;
      expect(fs.has("pickled")).to.be.true;

      expect(fs._getState("diced").transitions).to.be.empty;
      expect(fs._getState("pickled").transitions).to.be.empty;
    });

    it("should remove an intermediate state and update transitions correctly", () => {
      fs.from("vegetable").to("diced").from("diced").to("pickled");

      fs.remove("diced");

      expect(fs.state.name).to.equal("vegetable");
      expect(fs.has("vegetable")).to.be.true;
      expect(fs.has("diced")).to.be.false;
      expect(fs.has("pickled")).to.be.true;

      expect(fs._getState("vegetable").transitions).to.be.empty;
    });

    it("should remove a state and update transitions correctly when multiple transitions exist", () => {
      fs.from("vegetable").to("diced").from("diced").to("pickled");

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
  });

  describe("state utilities", () => {
    it("should check if state exists", () => {
      fs.from("vegetable");
      expect(fs.has("vegetable")).to.equal(true);
      expect(fs.has("nonexistent")).to.equal(false);
    });

    it("should clear all states", () => {
      fs.from("vegetable").to("diced");
      fs.clear();
      expect(fs.has("vegetable")).to.equal(false);
      expect(fs.has("diced")).to.equal(false);
    });

    it("should set state explicitly", () => {
      fs.from("vegetable").to("diced");
      fs.setState("diced");
      expect(fs.state.name).to.equal("diced");
    });

    it("should throw error when setting unknown state", () => {
      expect(() => fs.setState("unknown")).to.throw('SetState Error: Unknown state: "unknown"');
    });
  });
});
