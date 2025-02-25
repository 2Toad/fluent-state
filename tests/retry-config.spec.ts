import { expect } from "chai";
import * as chai from "chai";
import * as spies from "chai-spies";
import { FluentState } from "../src";
import * as sinon from "sinon";
import { suppressConsole } from "./helpers";

chai.use(spies);

describe("Retry Configuration", () => {
  let fs: FluentState;

  beforeEach(() => {
    fs = new FluentState();
  });

  afterEach(() => {
    fs.clear();
    chai.spy.restore();
    sinon.restore();
  });

  it("should retry failed transitions up to maxAttempts times", async () => {
    // Create states
    fs._addState("initial");
    fs._addState("connected");
    fs.state = fs._getState("initial")!;

    // Mock console methods
    const logStub = sinon.stub(console, "log");
    const errorStub = sinon.stub(console, "error");

    // Track number of attempts
    let attempts = 0;

    // Configure a transition with retry
    fs.from("initial").to<any>("connected", {
      condition: async () => {
        attempts++;
        // Fail on first two attempts, succeed on third
        if (attempts < 3) {
          throw new Error("Connection failed");
        }
        return true;
      },
      targetState: "connected",
      retryConfig: {
        maxAttempts: 3,
        delay: 10, // Small delay for tests
      },
    });

    // Trigger the auto-transition
    await fs.state.evaluateAutoTransitions({});

    // Should have attempted 3 times (2 failures, 1 success)
    expect(attempts).to.equal(3);

    // Should have logged 2 retry attempts
    expect(logStub.callCount).to.be.at.least(2);

    // Should have transitioned to connected state
    expect(fs.state.name).to.equal("connected");
  });

  it("should stop retrying if condition returns false", async () => {
    let attempts = 0;
    const fs = new FluentState();

    // Suppress console output
    const { flags, restore } = suppressConsole();

    // Define auto-transition with retry
    fs.from("disconnected").to<any>("connected", {
      condition: async () => {
        attempts++;
        // Throw on first attempt, return false on second
        if (attempts === 1) {
          throw new Error("Connection failed");
        }
        return false; // Return false on second attempt
      },
      targetState: "connected",
      retryConfig: {
        maxAttempts: 3,
        delay: 10,
      },
    });

    // Trigger the auto-transition
    await fs.state.evaluateAutoTransitions({});

    // Should have attempted 2 times (1 error, 1 false return)
    expect(attempts).to.equal(2);
    expect(flags.errorLogged).to.be.true;

    // Restore console functions
    restore();
  });

  it("should exhaust all retries and fail if errors persist", async () => {
    let attemptsA = 0;
    let attemptsB = 0;
    const fs = new FluentState();

    // Suppress console output
    const { flags, restore } = suppressConsole();

    // First transition - will succeed after retries
    fs.from("initial").to<any>("success", {
      condition: async () => {
        attemptsA++;
        return attemptsA >= 2; // Succeed on second attempt
      },
      targetState: "success",
      retryConfig: {
        maxAttempts: 2,
        delay: 10,
      },
      priority: 1, // Lower priority
    });

    // Second transition - will always fail
    fs.from("initial").to<any>("error", {
      condition: async () => {
        attemptsB++;
        throw new Error("Always fails");
      },
      targetState: "error",
      retryConfig: {
        maxAttempts: 2,
        delay: 10,
      },
      priority: 2, // Higher priority, evaluated first
    });

    // Trigger the auto-transitions
    await fs.state.evaluateAutoTransitions({});

    // Higher priority transition should be attempted first
    expect(attemptsB).to.equal(2); // Should have tried twice
    expect(attemptsA).to.equal(1); // Should have tried once and succeeded
    expect(fs.state.name).to.equal("initial");
    expect(flags.errorLogged).to.be.true;

    // Restore console functions
    restore();
  });

  it("should work with multiple transitions with different retry configs", async () => {
    // Create states
    fs._addState("initial");
    fs._addState("success");
    fs._addState("error");
    fs.state = fs._getState("initial")!;

    // Suppress console output
    const { flags, restore } = suppressConsole();

    let attemptsA = 0;
    let attemptsB = 0;

    // First transition - will succeed after retries
    fs.from("initial").to<any>("success", {
      condition: async () => {
        attemptsA++;
        if (attemptsA === 1) {
          throw new Error("First attempt failed");
        }
        return true; // Succeed on second attempt
      },
      targetState: "success",
      retryConfig: {
        maxAttempts: 2,
        delay: 10,
      },
      priority: 1, // Lower priority
    });

    // Second transition - will always fail
    fs.from("initial").to<any>("error", {
      condition: async () => {
        attemptsB++;
        throw new Error("Always fails");
      },
      targetState: "error",
      retryConfig: {
        maxAttempts: 2,
        delay: 10,
      },
      priority: 2, // Higher priority, evaluated first
    });

    // Trigger the auto-transitions
    await fs.state.evaluateAutoTransitions({});

    // Higher priority transition should be attempted first and fail
    expect(attemptsB).to.equal(2); // Should have tried twice
    // Lower priority transition should be attempted next and succeed
    expect(attemptsA).to.equal(2); // Should have tried twice
    expect(fs.state.name).to.equal("success");
    expect(flags.errorLogged).to.be.true;

    // Restore console functions
    restore();
  });
});
