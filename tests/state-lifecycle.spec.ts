import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState, State, Lifecycle } from "../src";

describe("State Lifecycle Events", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
  });

  it("should execute onEnter when a state is entered", async () => {
    const logs: string[] = [];
    const addToLogs = (item: string): void => {
      logs.push(item);
    };

    fs.from("isAuthenticated")
      .onEnter(() => {
        addToLogs("Entering isAuthenticated");
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed").onEnter(() => {
      addToLogs("Entering hasBeenWelcomed");
    });

    await fs.start();
    await fs.transition("hasBeenWelcomed");
    expect(logs).to.deep.equal(["Entering isAuthenticated", "Entering hasBeenWelcomed"]);
  });

  it("should execute onExit when a state is exited", async () => {
    const logs: string[] = [];
    const addToLogs = (item: string): void => {
      logs.push(item);
    };

    fs.from("isAuthenticated")
      .onExit(() => {
        addToLogs("Exiting isAuthenticated");
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed")
      .onExit(() => {
        addToLogs("Exiting hasBeenWelcomed");
      })
      .to("isEmailVerified");

    await fs.transition("hasBeenWelcomed");
    await fs.transition("isEmailVerified");
    expect(logs).to.deep.equal(["Exiting isAuthenticated", "Exiting hasBeenWelcomed"]);
  });

  it("should execute multiple onEnter handlers for the same state", async () => {
    const logs: string[] = [];
    const addToLogs = (item: string): void => {
      logs.push(item);
    };

    fs.from("isAuthenticated")
      .onEnter(() => {
        addToLogs("First enter handler");
      })
      .onEnter(() => {
        addToLogs("Second enter handler");
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed");

    await fs.start();
    await fs.transition("hasBeenWelcomed");
    expect(logs).to.deep.equal(["First enter handler", "Second enter handler"]);
  });

  it("should execute multiple onExit handlers for the same state", async () => {
    const logs: string[] = [];
    const addToLogs = (item: string): void => {
      logs.push(item);
    };

    fs.from("isAuthenticated")
      .onExit(() => {
        addToLogs("First exit handler");
      })
      .onExit(() => {
        addToLogs("Second exit handler");
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed");

    await fs.transition("hasBeenWelcomed");
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
      fs.from("mainApp").to("isAuthenticated");
      fs.from("login").to("isAuthenticated");
      fs.from("signup").to("isAuthenticated");
    });

    it("should call onEnter() only once when transitioning from login", async () => {
      await fs.transition("login");
      await fs.transition("isAuthenticated");
      expect(enterSpy.calledOnce).to.be.true;
    });

    it("should call onEnter() only once when transitioning from signup", async () => {
      await fs.transition("signup");
      await fs.transition("isAuthenticated");
      expect(enterSpy.calledOnce).to.be.true;
    });

    it("should call onEnter() again if the state is exited and re-entered", async () => {
      await fs.transition("login");
      await fs.transition("isAuthenticated");
      expect(enterSpy.calledOnce).to.be.true;

      await fs.transition("mainApp");
      expect(exitSpy.calledOnce).to.be.true;

      await fs.transition("isAuthenticated");
      expect(enterSpy.calledTwice).to.be.true;
    });

    it("should not call onExit() if state remains the same", async () => {
      await fs.transition("login");
      await fs.transition("signup");
      expect(exitSpy.called).to.be.false;
    });
  });

  it("should re-trigger onEnter when a state is re-entered", async () => {
    const logs: string[] = [];
    const addToLogs = (item: string): void => {
      logs.push(item);
    };

    fs.from("isAuthenticated")
      .onEnter(() => {
        addToLogs("Entering isAuthenticated");
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed").to("isAuthenticated");

    await fs.start();
    await fs.transition("hasBeenWelcomed");
    await fs.transition("isAuthenticated");
    expect(logs).to.deep.equal(["Entering isAuthenticated", "Entering isAuthenticated"]);
  });

  it("should execute onEnter and onExit handlers in correct order", async () => {
    const sequence: string[] = [];
    const addToSequence = (item: string): void => {
      sequence.push(item);
    };

    fs.from("isAuthenticated")
      .onEnter(() => {
        addToSequence("isAuthenticated enter");
      })
      .onExit(() => {
        addToSequence("isAuthenticated exit");
      })
      .to("hasBeenWelcomed");

    fs.from("hasBeenWelcomed")
      .onEnter(() => {
        addToSequence("hasBeenWelcomed enter");
      })
      .onExit(() => {
        addToSequence("hasBeenWelcomed exit");
      });

    await fs.transition("hasBeenWelcomed");
    expect(sequence).to.deep.equal(["isAuthenticated exit", "hasBeenWelcomed enter"]);
  });

  it("should execute state-specific handlers after onEnter", async () => {
    const logs: string[] = [];
    const addToLogs = (item: string): void => {
      logs.push(item);
    };

    fs.from("initial").onEnter(() => {
      addToLogs("enter initial");
    });
    fs.when("initial").do(() => {
      addToLogs("handler initial");
    });

    await fs.start();
    expect(logs).to.deep.equal(["enter initial", "handler initial"]);
  });

  it("should pass correct states to handlers", async () => {
    const handlerCalls: Array<[State | null, State]> = [];
    const addToHandlerCalls = (prev: State | null, curr: State): void => {
      handlerCalls.push([prev, curr]);
    };

    fs.from("initial");
    fs.when("initial").do((prev, curr) => {
      addToHandlerCalls(prev, curr);
    });

    await fs.start();
    expect(handlerCalls.length).to.equal(1);
    expect(handlerCalls[0][0]).to.be.null;
    expect(handlerCalls[0][1].name).to.equal("initial");
  });

  describe("start()", () => {
    it("should trigger onEnter for initial state", async () => {
      const logs: string[] = [];
      const addToLogs = (item: string): void => {
        logs.push(item);
      };

      fs.from("initial").onEnter(() => {
        addToLogs("enter initial");
      });
      await fs.start();
      expect(logs).to.deep.equal(["enter initial"]);
    });

    it("should trigger state-specific handlers with null previous state", async () => {
      const handlerCalls: Array<[State | null, State]> = [];
      const addToHandlerCalls = (prev: State | null, curr: State): void => {
        handlerCalls.push([prev, curr]);
      };

      fs.from("initial");
      fs.when("initial").do((prev, curr) => {
        addToHandlerCalls(prev, curr);
      });

      await fs.start();
      expect(handlerCalls.length).to.equal(1);
      expect(handlerCalls[0][0]).to.be.null;
      expect(handlerCalls[0][1].name).to.equal("initial");
    });

    it("should do nothing if no initial state is set", async () => {
      const logs: string[] = [];
      await fs.start();
      expect(logs).to.be.empty;
    });
  });
});
