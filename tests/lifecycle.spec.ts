import { expect } from "chai";
import { FluentState, State } from "../src";
import { Lifecycle } from "../src/enums";

describe("Lifecycle Events", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

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

  it("should trigger FailedTransition event when transitioning to an unknown state", () => {
    fs.from("vegetable").to("diced");

    fs.observe(Lifecycle.FailedTransition, (currentState: State, targetState: string) => {
      expect(currentState).to.deep.equal(fs.state);
      expect(currentState.name).to.equal("vegetable");
      expect(targetState).to.equal("unknown");
    });

    fs.transition("unknown");
  });

  it("should stop transition if BeforeTransition observer returns false", () => {
    fs.from("vegetable").to("diced");

    fs.observe(Lifecycle.BeforeTransition, () => false);

    expect(fs.transition("diced")).to.equal(false);
    expect(fs.state.name).to.equal("vegetable");
  });

  it("should chain multiple lifecycle observers", () => {
    fs.from("vegetable").to("diced");

    const results: string[] = [];
    fs.observe(Lifecycle.FailedTransition, () => results.push("failed"))
      .observe(Lifecycle.FailedTransition, () => results.push("multiple hooks allowed"))
      .observe(Lifecycle.AfterTransition, () => results.push("complete"));

    fs.transition("diced");
    expect(results).to.deep.equal(["complete"]);
  });
});
