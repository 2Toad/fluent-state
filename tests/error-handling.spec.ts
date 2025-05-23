import { expect } from "chai";
import { FluentState } from "../src";
import { TransitionError } from "../src/types";

describe("Error Handling", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should return false when transitioning to an unknown state", async () => {
    fs.from("vegetable").to("diced");
    const result = await fs.transition("unknown");
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

  it("should handle asynchronous transitions", async () => {
    fs.from("vegetable").to("diced");
    fs.when("diced").do(() => new Promise((resolve) => setTimeout(resolve, 10)));

    const result = await fs.transition("diced");
    expect(result).to.be.true;
    expect(fs.state.name).to.equal("diced");
  });

  it("should throw an error when transitioning without a target state", async () => {
    fs.from("vegetable").to("diced");
    try {
      await fs.transition();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).to.be.instanceOf(TransitionError);
      expect(error.message).to.include("No target state specified");
    }
  });
});
