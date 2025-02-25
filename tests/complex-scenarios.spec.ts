import { expect } from "chai";
import { FluentState } from "../src";
import { Lifecycle } from "../src/types";

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

  it("should handle a complex state machine with multiple transitions and callbacks", async () => {
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
    const addToHistory = (item: string): void => {
      stateHistory.push(item);
    };

    fs.observe(Lifecycle.AfterTransition, (_prevState: any, currentState: any) => {
      addToHistory(currentState.name);
    });

    fs.when("served").do(() => {
      addToHistory("meal complete");
    });

    await fs.transition("sliced");
    await fs.transition("fried");
    await fs.transition("served");

    expect(stateHistory).to.deep.equal(["sliced", "fried", "served", "meal complete"]);
  });
});
