import { expect } from "chai";
import { spy } from "sinon";
import { FluentState, State } from "../src";

describe("Callbacks", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should add a callback", async () => {
    fs.from("vegetable").to("diced");

    let result = false;
    fs.when("diced").do(() => {
      result = true;
    });

    await fs.transition("diced");
    expect(result).to.equal(true);
  });

  it("should add multiple callbacks", async () => {
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

    await fs.transition("diced");
    expect(result1).to.equal(true);
    expect(result2).to.equal(true);
  });

  it("should execute callbacks in order", async () => {
    const calls: number[] = [];
    const addToCallOrder = (num: number): void => {
      calls.push(num);
    };

    const callback1 = spy();
    const callback2 = spy();

    fs.from("vegetable").to("diced");
    fs.when("diced")
      .do(async () => {
        callback1();
        addToCallOrder(1);
      })
      .and(async () => {
        callback2();
        addToCallOrder(2);
      });

    await fs.transition("diced");
    expect(callback1.callCount).to.equal(1);
    expect(callback2.callCount).to.equal(1);
    expect(calls).to.deep.equal([1, 2]);
  });

  it("should execute callbacks with correct parameters", async () => {
    fs.from("vegetable").to("diced");

    let previousStateName: string | undefined;
    let currentStateName: string | undefined;
    fs.when("diced").do((prevState: State, currentState: State) => {
      previousStateName = prevState.name;
      currentStateName = currentState.name;
    });

    await fs.transition("diced");
    expect(previousStateName).to.equal("vegetable");
    expect(currentStateName).to.equal("diced");
  });

  it("should chain multiple callback definitions", async () => {
    fs.from("vegetable").to("diced").or("pickled");
    fs.from("diced").to("pickled");

    let diced = false;
    let pickled = false;

    fs.when("diced")
      .do(() => {
        diced = true;
      })
      .when("pickled")
      .do(() => {
        pickled = true;
      });

    await fs.transition("diced");
    expect(diced).to.equal(true);
    expect(pickled).to.equal(false);

    await fs.transition("pickled");
    expect(pickled).to.equal(true);
  });
});
