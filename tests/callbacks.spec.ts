import { expect, use, spy } from "chai";
import * as spies from "chai-spies";
import { FluentState, State } from "../src";

use(spies);

describe("Callbacks", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

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

  it("should execute callbacks in order", () => {
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

  it("should chain multiple callback definitions", () => {
    fs.from("vegetable").to("diced").or("pickled");
    fs.from("diced").to("pickled");

    let diced = false;
    let pickled = false;

    fs.when("diced")
      .do(() => (diced = true))
      .when("pickled")
      .do(() => (pickled = true));

    fs.transition("diced");
    expect(diced).to.equal(true);
    expect(pickled).to.equal(false);

    fs.transition("pickled");
    expect(pickled).to.equal(true);
  });
});
