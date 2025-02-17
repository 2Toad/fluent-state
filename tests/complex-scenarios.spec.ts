import { expect } from "chai";
import { FluentState } from "../src";
import { Lifecycle } from "../src/enums";

function setupBasicStateMachine(fs: FluentState) {
  // prettier-ignore
  fs.from("vegetable").to("diced").or("pickled")
    .from("diced").to("salad").or("trash");
}

describe("Complex Scenarios", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
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
