import { expect } from "chai";
import { FluentState, State } from "../src";
import { Lifecycle } from "../src/types";

describe("Lifecycle Events", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should add an observer", async () => {
    fs.from("vegetable").to("diced");

    let result = false;
    fs.observe(Lifecycle.AfterTransition, () => {
      result = true;
    });

    await fs.next();
    expect(result).to.equal(true);
  });

  it("should stop transition", async () => {
    fs.from("vegetable").to("diced");

    fs.observe(Lifecycle.BeforeTransition, () => {
      return false;
    });

    await fs.transition("diced");
    expect(fs.state.name).to.equal("vegetable");
  });

  it("should execute multiple observers in order", async () => {
    fs.from("vegetable").to("diced");

    const results: number[] = [];
    const addToResults = (num: number): void => {
      results.push(num);
    };

    fs.observe(Lifecycle.BeforeTransition, () => {
      addToResults(1);
      return true;
    });
    fs.observe(Lifecycle.BeforeTransition, () => {
      addToResults(2);
      return true;
    });
    fs.observe(Lifecycle.AfterTransition, () => {
      addToResults(3);
    });

    await fs.transition("diced");
    expect(results).to.deep.equal([1, 2, 3]);
  });

  it("should execute multiple observers for the same lifecycle event", async () => {
    const results: string[] = [];
    const addToResults = (item: string): void => {
      results.push(item);
    };

    fs.from("vegetable").to("diced");

    fs.observe(Lifecycle.AfterTransition, () => {
      addToResults("observer1");
    });
    fs.observe(Lifecycle.AfterTransition, () => {
      addToResults("observer2");
    });

    await fs.transition("diced");
    expect(results).to.deep.equal(["observer1", "observer2"]);
  });

  it("should trigger FailedTransition event when transitioning to an unknown state", async () => {
    fs.from("vegetable").to("diced");

    fs.observe(Lifecycle.FailedTransition, (currentState: State, targetState: string) => {
      expect(currentState).to.deep.equal(fs.state);
      expect(currentState.name).to.equal("vegetable");
      expect(targetState).to.equal("unknown");
    });

    await fs.transition("unknown");
  });

  it("should stop transition if BeforeTransition observer returns false", async () => {
    fs.from("vegetable").to("diced");

    fs.observe(Lifecycle.BeforeTransition, () => false);

    const result = await fs.transition("diced");
    expect(result).to.equal(false);
    expect(fs.state.name).to.equal("vegetable");
  });

  it("should chain multiple lifecycle observers", async () => {
    fs.from("vegetable").to("diced");

    const results: string[] = [];
    const addToResults = (item: string): void => {
      results.push(item);
    };

    fs.observe(Lifecycle.FailedTransition, () => addToResults("failed"))
      .observe(Lifecycle.FailedTransition, () => addToResults("multiple hooks allowed"))
      .observe(Lifecycle.AfterTransition, () => addToResults("complete"));

    await fs.transition("diced");
    expect(results).to.deep.equal(["complete"]);
  });

  describe("start()", () => {
    it("should trigger lifecycle events in correct order", async () => {
      const sequence: string[] = [];
      const addToSequence = (item: string): void => {
        sequence.push(item);
      };

      const state = fs.from("initial");

      fs.observe(Lifecycle.BeforeTransition, () => {
        addToSequence("before");
        return true;
      }).observe(Lifecycle.AfterTransition, () => addToSequence("after"));

      state.onEnter(() => addToSequence("enter"));
      fs.when("initial").do(() => addToSequence("handler"));

      await fs.start();
      expect(sequence).to.deep.equal(["enter", "after", "handler"]);
    });

    it("should execute multiple observers for each lifecycle event", async () => {
      const sequence: string[] = [];
      const addToSequence = (item: string): void => {
        sequence.push(item);
      };

      fs.from("initial");

      fs.observe(Lifecycle.AfterTransition, () => addToSequence("after1")).observe(Lifecycle.AfterTransition, () => addToSequence("after2"));

      await fs.start();
      expect(sequence).to.deep.equal(["after1", "after2"]);
    });

    it("should trigger AfterTransition with null previous state", async () => {
      const transitions: Array<[State | null, State]> = [];
      const addToTransitions = (prev: State | null, curr: State): void => {
        transitions.push([prev, curr]);
      };

      fs.observe(Lifecycle.AfterTransition, (prev, curr) => addToTransitions(prev, curr));

      fs.from("initial");
      await fs.start();

      expect(transitions.length).to.equal(1);
      expect(transitions[0][0]).to.be.null;
      expect(transitions[0][1].name).to.equal("initial");
    });

    it("should support chaining multiple observers", async () => {
      const results: string[] = [];
      const addToResults = (item: string): void => {
        results.push(item);
      };

      fs.from("initial");

      fs.observe(Lifecycle.AfterTransition, () => addToResults("first"))
        .observe(Lifecycle.AfterTransition, () => addToResults("second"))
        .observe(Lifecycle.AfterTransition, () => addToResults("third"));

      await fs.start();
      expect(results).to.deep.equal(["first", "second", "third"]);
    });
  });
});

describe("Observer Pattern Edge Cases", () => {
  it("should allow adding and removing observers dynamically", async () => {
    const fs = new FluentState();
    let observerCalled = false;

    const observer = () => {
      observerCalled = true;
    };

    fs.observe(Lifecycle.AfterTransition, observer);
    fs.from("start").to("end");

    await fs.transition("end");
    expect(observerCalled).to.be.true;

    observerCalled = false;
    fs.observer.remove(Lifecycle.AfterTransition, observer);

    await fs.transition("start");
    expect(observerCalled).to.be.false;
  });

  it("should execute observers in the correct order", async () => {
    const fs = new FluentState();
    const callOrder: string[] = [];
    const addToCallOrder = (item: string): void => {
      callOrder.push(item);
    };

    fs.observe(Lifecycle.AfterTransition, () => addToCallOrder("first"));
    fs.observe(Lifecycle.AfterTransition, () => addToCallOrder("second"));

    fs.from("start").to("end");
    await fs.transition("end");

    expect(callOrder).to.deep.equal(["first", "second"]);
  });
});
