import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState, State } from "../src";

describe("State Lifecycle Events", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should execute onEnter when a state is entered", () => {
    const logs: string[] = [];
    fs.from("isAuthenticated")
      .onEnter(() => logs.push("Entering isAuthenticated"))
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed").onEnter(() => logs.push("Entering hasBeenWelcomed"));

    fs.transition("hasBeenWelcomed");
    expect(logs).to.deep.equal(["Entering isAuthenticated", "Entering hasBeenWelcomed"]);
  });

  it("should execute onExit when a state is exited", () => {
    const logs: string[] = [];
    fs.from("isAuthenticated")
      .onExit(() => logs.push("Exiting isAuthenticated"))
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed")
      .onExit(() => logs.push("Exiting hasBeenWelcomed"))
      .to("isEmailVerified");

    fs.transition("hasBeenWelcomed");
    fs.transition("isEmailVerified");
    expect(logs).to.deep.equal(["Exiting isAuthenticated", "Exiting hasBeenWelcomed"]);
  });

  it("should execute multiple onEnter handlers for the same state", () => {
    const logs: string[] = [];
    fs.from("isAuthenticated")
      .onEnter(() => logs.push("First enter handler"))
      .onEnter(() => logs.push("Second enter handler"))
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed");

    fs.transition("hasBeenWelcomed");
    expect(logs).to.deep.equal(["First enter handler", "Second enter handler"]);
  });

  it("should execute multiple onExit handlers for the same state", () => {
    const logs: string[] = [];
    fs.from("isAuthenticated")
      .onExit(() => logs.push("First exit handler"))
      .onExit(() => logs.push("Second exit handler"))
      .to("hasBeenWelcomed");

    fs.transition("hasBeenWelcomed");
    expect(logs).to.deep.equal(["First exit handler", "Second exit handler"]);
  });

  describe("Fluent-State: onEnter should trigger only once per entry", () => {
    let enterSpy: sinon.SinonSpy;
    let exitSpy: sinon.SinonSpy;

    beforeEach(() => {
      fs.clear();
      enterSpy = sinon.spy();
      exitSpy = sinon.spy();

      fs.from("isAuthenticated").onEnter(enterSpy).onExit(exitSpy).to("mainApp");

      fs.from("login").to("isAuthenticated");
      fs.from("signup").to("isAuthenticated");
    });

    it("should call onEnter() only once when transitioning from login", () => {
      fs.transition("login");
      expect(enterSpy.calledOnce).to.be.true;
    });

    it("should call onEnter() only once when transitioning from signup", () => {
      fs.transition("signup");
      expect(enterSpy.calledOnce).to.be.true;
    });

    it("should call onEnter() again if the state is exited and re-entered", () => {
      fs.transition("login");
      expect(enterSpy.calledOnce).to.be.true;

      fs.transition("mainApp");
      expect(exitSpy.calledOnce).to.be.true;

      fs.transition("login");
      expect(enterSpy.calledTwice).to.be.true;
    });

    it("should not call onEnter() multiple times if already in state", () => {
      fs.transition("login");
      fs.transition("signup");
      expect(enterSpy.callCount).to.equal(1);
    });

    it("should not call onExit() if state remains the same", () => {
      fs.transition("login");
      fs.transition("signup");
      expect(exitSpy.notCalled).to.be.true;
    });
  });

  it("should re-trigger onEnter when a state is re-entered", () => {
    const logs: string[] = [];
    fs.from("isAuthenticated")
      .onEnter(() => logs.push("Entering isAuthenticated"))
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed").to("isAuthenticated");

    fs.transition("hasBeenWelcomed");
    fs.transition("isAuthenticated");
    expect(logs).to.deep.equal(["Entering isAuthenticated", "Entering isAuthenticated"]);
  });

  it("should execute lifecycle events in the correct order", () => {
    const sequence: string[] = [];

    fs.from("isAuthenticated")
      .onEnter(() => sequence.push("isAuthenticated enter"))
      .onExit(() => sequence.push("isAuthenticated exit"))
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed")
      .onEnter(() => sequence.push("hasBeenWelcomed enter"))
      .onExit(() => sequence.push("hasBeenWelcomed exit"));

    fs.transition("isAuthenticated"); // 🔥 Explicitly enter the initial state
    fs.transition("hasBeenWelcomed"); // Move to next state

    expect(sequence).to.deep.equal([
      "isAuthenticated enter", // ✅ Enters after explicit transition
      "isAuthenticated exit", // ✅ Exits before transitioning
      "hasBeenWelcomed enter", // ✅ Enters the new state after exit
    ]);
  });

  it("should provide correct state references in handlers", () => {
    let exitNextState: State | null = null;
    let enterPrevState: State | null = null;

    fs.from("isAuthenticated")
      .onExit((nextState: State) => {
        exitNextState = nextState;
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed").onEnter((prevState: State | null) => {
      enterPrevState = prevState;
    });

    fs.transition("hasBeenWelcomed");

    expect(exitNextState).to.not.be.null;
    expect(enterPrevState).to.not.be.null;
    expect(exitNextState!.name).to.equal("hasBeenWelcomed");
    expect(enterPrevState!.name).to.equal("isAuthenticated");
  });
});
