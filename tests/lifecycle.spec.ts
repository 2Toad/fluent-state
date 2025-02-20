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

  describe("start()", () => {
    it("should trigger lifecycle events in correct order", () => {
      const sequence: string[] = [];
      const state = fs.from("initial");

      fs.observe(Lifecycle.BeforeTransition, () => sequence.push("before")).observe(Lifecycle.AfterTransition, () => sequence.push("after"));

      state.onEnter(() => sequence.push("enter"));
      fs.when("initial").do(() => sequence.push("handler"));

      fs.start();
      expect(sequence).to.deep.equal(["enter", "after", "handler"]);
    });

    it("should execute multiple observers for each lifecycle event", () => {
      const sequence: string[] = [];
      fs.from("initial");

      fs.observe(Lifecycle.AfterTransition, () => sequence.push("after1")).observe(Lifecycle.AfterTransition, () => sequence.push("after2"));

      fs.start();
      expect(sequence).to.deep.equal(["after1", "after2"]);
    });

    it("should trigger AfterTransition with null previous state", () => {
      const transitions: Array<[State | null, State]> = [];
      fs.observe(Lifecycle.AfterTransition, (prev, curr) => transitions.push([prev, curr]));

      fs.from("initial");
      fs.start();

      expect(transitions.length).to.equal(1);
      expect(transitions[0][0]).to.be.null;
      expect(transitions[0][1].name).to.equal("initial");
    });

    it("should support chaining multiple observers", () => {
      const results: string[] = [];
      fs.from("initial");

      fs.observe(Lifecycle.AfterTransition, () => results.push("first"))
        .observe(Lifecycle.AfterTransition, () => results.push("second"))
        .observe(Lifecycle.AfterTransition, () => results.push("third"));

      fs.start();
      expect(results).to.deep.equal(["first", "second", "third"]);
    });
  });
});

describe("Observer Pattern Edge Cases", () => {
  it("should allow adding and removing observers dynamically", () => {
    const fs = new FluentState();
    let observerCalled = false;

    const observer = () => {
      observerCalled = true;
    };

    fs.observe(Lifecycle.AfterTransition, observer);
    fs.from("start").to("end");

    fs.transition("end");
    expect(observerCalled).to.be.true;

    observerCalled = false;
    fs.observer.remove(Lifecycle.AfterTransition, observer);

    fs.transition("start");
    expect(observerCalled).to.be.false;
  });

  it("should execute observers in the correct order", () => {
    const fs = new FluentState();
    const callOrder: string[] = [];

    fs.observe(Lifecycle.AfterTransition, () => callOrder.push("first"));
    fs.observe(Lifecycle.AfterTransition, () => callOrder.push("second"));

    fs.from("start").to("end");
    fs.transition("end");

    expect(callOrder).to.deep.equal(["first", "second"]);
  });
});
