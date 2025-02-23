import { expect } from "chai";
import * as chai from "chai";
import * as spies from "chai-spies";
import { FluentState } from "../src";

chai.use(spies);

describe("Auto Transitions", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
    chai.spy.restore();
  });

  it("should auto-transition when condition is met", async () => {
    fs.from("start").to("end", () => true);

    await fs.start();
    expect(fs.state.name).to.equal("end");
  });

  it("should not auto-transition when condition is not met", async () => {
    fs.from("start").to("end", () => false);

    await fs.start();
    expect(fs.state.name).to.equal("start");
  });

  it("should handle multiple auto-transitions in order", async () => {
    fs.from("start")
      .to("middle", () => false)
      .or("end", () => true);

    await fs.start();
    expect(fs.state.name).to.equal("end");
  });

  it("should handle async conditions", async () => {
    fs.from("start").to("end", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });

    await fs.start();
    expect(fs.state.name).to.equal("end");
  });

  it("should not block manual transitions", async () => {
    fs.from("start")
      .to("auto-end", () => false)
      .or("manual-end");

    await fs.start();
    await fs.transition("manual-end");

    expect(fs.state.name).to.equal("manual-end");
  });

  it("should handle errors in conditions gracefully", async () => {
    console.log("ℹ️  The following error is expected as part of the error handling test:");
    const consoleSpy = chai.spy.on(console, "error");

    fs.from("start").to("end", () => {
      throw new Error("Test error");
    });

    await fs.start();

    expect(fs.state.name).to.equal("start");
    expect(consoleSpy).to.have.been.called.with("Error in auto-transition condition");
  });
});
