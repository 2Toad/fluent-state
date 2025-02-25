import { expect } from "chai";
import * as sinon from "sinon";
import { FluentState, TransitionGroup } from "../src";

describe("Event Handling", () => {
  let fs: FluentState;
  let group: TransitionGroup;

  beforeEach(() => {
    fs = new FluentState({
      initialState: "idle",
    });

    // Create a transition group
    group = fs.createGroup("main");

    // Define transitions
    group.from("idle").to("running");

    group.from("running").to("paused").to("stopped");

    group.from("paused").to("running").to("stopped");
  });

  describe("Transition Events", () => {
    it("should trigger onTransition handlers when a transition occurs", async () => {
      const transitionHandler = sinon.spy();
      group.onTransition(transitionHandler);

      await fs.transition("running");

      expect(transitionHandler.calledOnce).to.be.true;
      expect(transitionHandler.calledWith("idle", "running", undefined)).to.be.true;
    });

    it("should pass context to transition handlers", async () => {
      const context = { userId: "123", isPremium: true };
      const transitionHandler = sinon.spy();
      group.onTransition(transitionHandler);

      await fs.transition("running", context);

      expect(transitionHandler.calledWith("idle", "running", context)).to.be.true;
    });

    it("should support multiple transition handlers", async () => {
      const handler1 = sinon.spy();
      const handler2 = sinon.spy();

      group.onTransition(handler1);
      group.onTransition(handler2);

      await fs.transition("running");

      expect(handler1.calledOnce).to.be.true;
      expect(handler2.calledOnce).to.be.true;
    });

    it("should support one-time transition handlers", async () => {
      const handler = sinon.spy();

      group.onceTransition(handler);

      await fs.transition("running");
      await fs.transition("paused");

      expect(handler.calledOnce).to.be.true;
      expect(handler.calledWith("idle", "running", undefined)).to.be.true;
    });

    it("should allow removing transition handlers", async () => {
      const handler = sinon.spy();

      group.onTransition(handler);
      await fs.transition("running");

      group.offTransition(handler);
      await fs.transition("paused");

      expect(handler.calledOnce).to.be.true;
    });

    it("should bubble transition events to parent groups", async () => {
      const parentHandler = sinon.spy();
      const childHandler = sinon.spy();

      const childGroup = group.createChildGroup("child");
      childGroup.from("running").to("stopped");

      group.onTransition(parentHandler);
      childGroup.onTransition(childHandler);

      await fs.transition("running");
      await fs.transition("stopped");

      expect(childHandler.calledOnce).to.be.true;
      expect(childHandler.calledWith("running", "stopped", undefined)).to.be.true;
      expect(parentHandler.callCount).to.equal(3);
    });
  });

  describe("Enable/Disable Events", () => {
    it("should trigger onEnable handler when a group is enabled", () => {
      const enableHandler = sinon.spy();

      group.disable();
      group.onEnable(enableHandler);
      group.enable();

      expect(enableHandler.calledOnce).to.be.true;
    });

    it("should trigger onDisable handler when a group is disabled", () => {
      const disableHandler = sinon.spy();

      group.onDisable(disableHandler);
      group.disable({ preventManualTransitions: true });

      expect(disableHandler.calledOnce).to.be.true;
      expect(disableHandler.calledWith(true, undefined)).to.be.true;
    });

    it("should not trigger enable/disable handlers if the state doesn't change", () => {
      const enableHandler = sinon.spy();
      const disableHandler = sinon.spy();

      // Already enabled by default
      group.onEnable(enableHandler);
      group.enable();

      // Disable then try to disable again
      group.onDisable(disableHandler);
      group.disable();
      group.disable();

      expect(enableHandler.called).to.be.false;
      expect(disableHandler.calledOnce).to.be.true;
    });

    it("should support one-time enable/disable handlers", () => {
      const enableHandler = sinon.spy();
      const disableHandler = sinon.spy();

      group.disable();
      group.onceEnable(enableHandler);
      group.onceDisable(disableHandler);

      group.enable();
      group.disable();
      group.enable();

      expect(enableHandler.calledOnce).to.be.true;
      expect(disableHandler.calledOnce).to.be.true;
    });

    it("should allow removing enable/disable handlers", () => {
      const enableHandler = sinon.spy();
      const disableHandler = sinon.spy();

      group.disable();

      group.onEnable(enableHandler);
      group.onDisable(disableHandler);

      group.offEnable(enableHandler);
      group.offDisable(disableHandler);

      group.enable();
      group.disable();

      expect(enableHandler.called).to.be.false;
      expect(disableHandler.called).to.be.false;
    });

    it("should bubble enable/disable events to parent groups", () => {
      const parentEnableHandler = sinon.spy();
      const parentDisableHandler = sinon.spy();
      const childEnableHandler = sinon.spy();
      const childDisableHandler = sinon.spy();

      const childGroup = group.createChildGroup("child");

      group.onEnable(parentEnableHandler);
      group.onDisable(parentDisableHandler);
      childGroup.onEnable(childEnableHandler);
      childGroup.onDisable(childDisableHandler);

      childGroup.disable();
      childGroup.enable();

      expect(childEnableHandler.calledOnce).to.be.true;
      expect(childDisableHandler.calledOnce).to.be.true;
      expect(parentEnableHandler.calledOnce).to.be.true;
      expect(parentDisableHandler.calledOnce).to.be.true;
    });
  });
});
