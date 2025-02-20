import { expect } from "chai";
import { FluentState } from "../src/fluent-state";
import { createTransitionGuard } from "../src/plugins/transition-guard";

// Test suite for transition guard

describe("Transition Guard", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should allow transitions when proceed is called", () => {
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      proceed();
    });

    fs.use(middleware);
    fs.from("start").to("end");

    expect(fs.transition("end")).to.be.true;
    expect(fs.state.name).to.equal("end");
  });

  it("should block transitions when proceed is not called", () => {
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      // Do not call proceed
    });

    fs.use(middleware);
    fs.from("start").to("end");

    expect(fs.transition("end")).to.be.false;
    expect(fs.state.name).to.equal("start");
  });

  it("should handle errors in middleware gracefully", () => {
    const middleware = createTransitionGuard(() => {
      throw new Error("Middleware error");
    });

    fs.use(middleware);
    fs.from("start").to("end");

    expect(fs.transition("end")).to.be.false;
    expect(fs.state.name).to.equal("start");
  });

  it("should correctly influence transitions within a flow", () => {
    const log: string[] = [];
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      log.push(`Attempting transition: ${currentState?.name || "null"} -> ${nextStateName}`);
      if (nextStateName !== "blocked") {
        proceed();
      } else {
        log.push("Transition blocked");
      }
    });

    fs.use(middleware);
    fs.from("start").to("middle").or("blocked").from("middle").to("end");

    expect(fs.transition("middle")).to.be.true;
    expect(fs.state.name).to.equal("middle");
    expect(log).to.include("Attempting transition: start -> middle");

    expect(fs.transition("blocked")).to.be.false;
    expect(fs.state.name).to.equal("middle");
    expect(log).to.include("Attempting transition: middle -> blocked");
    expect(log).to.include("Transition blocked");

    expect(fs.transition("end")).to.be.true;
    expect(fs.state.name).to.equal("end");
    expect(log).to.include("Attempting transition: middle -> end");
  });
});

describe("Middleware Edge Cases", () => {
  // TODO: check this failing test once we implement https://github.com/2Toad/fluent-state/issues/66
  // it("should handle asynchronous operations in middleware", async () => {
  //   const fs = new FluentState();
  //   const middleware = createTransitionGuard(async (currentState, nextStateName, proceed) => {
  //     console.log('Middleware started');
  //     await new Promise((resolve) => setTimeout(resolve, 200));
  //     console.log('Middleware completed, calling proceed()');
  //     proceed();
  //     console.log('Proceed called, checking state:', fs.state.name);
  //   });

  //   fs.use(middleware);
  //   fs.from("start").to("end");

  //   console.log('Transition initiated');
  //   const result = await new Promise((resolve) => {
  //     fs.transition("end");
  //     setTimeout(() => {
  //       console.log('Checking state:', fs.state.name);
  //       resolve(fs.state.name === "end");
  //     }, 400);
  //   });
  //   console.log('Final state:', fs.state.name);

  //   expect(result).to.be.true;
  //   expect(fs.state.name).to.equal("end");
  // });

  it("should handle state machine modifications during middleware execution", () => {
    const fs = new FluentState();
    const middleware = createTransitionGuard((currentState, nextStateName, proceed) => {
      fs.from("dynamic").to("end");
      proceed();
    });

    fs.use(middleware);
    fs.from("start").to("dynamic");

    expect(fs.transition("dynamic")).to.be.true;
    expect(fs.state.name).to.equal("dynamic");

    expect(fs.transition("end")).to.be.true;
    expect(fs.state.name).to.equal("end");
  });
});
