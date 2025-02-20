import { fluentState, FluentState } from "../src/fluent-state";
import { Lifecycle } from "../src/enums";
import { expect } from "chai";

describe("Plugin System", () => {
  beforeEach(() => {
    fluentState.clear();
  });

  describe("Function Plugins", () => {
    it("should execute function plugins with FluentState instance", () => {
      let pluginExecuted = false;
      const testPlugin = (fsm: FluentState) => {
        expect(fsm).to.equal(fluentState);
        pluginExecuted = true;
      };

      fluentState.use(testPlugin);
      expect(pluginExecuted).to.be.true;
    });

    it("should allow plugins to extend FluentState functionality", () => {
      const counterPlugin = (fsm: FluentState) => {
        let transitionCount = 0;
        fsm.observe(Lifecycle.AfterTransition, () => {
          transitionCount++;
        });
        // Extend with a method to get count
        (fsm as any).getTransitionCount = () => transitionCount;
      };

      fluentState.use(counterPlugin);

      // Setup state machine
      fluentState.from("start").to("middle");
      fluentState.from("middle").to("end");

      fluentState.transition("middle");
      fluentState.transition("end");

      expect((fluentState as any).getTransitionCount()).to.equal(2);
    });

    it("should support chaining multiple plugins", () => {
      const executionOrder: number[] = [];

      const plugin1 = () => {
        executionOrder.push(1);
      };
      const plugin2 = () => {
        executionOrder.push(2);
      };
      const plugin3 = () => {
        executionOrder.push(3);
      };

      fluentState.use(plugin1).use(plugin2).use(plugin3);

      expect(executionOrder).to.deep.equal([1, 2, 3]);
    });
  });

  describe("Object Plugins", () => {
    it("should execute install method of object plugins", () => {
      let installExecuted = false;
      const testPlugin = {
        install: (fsm: FluentState) => {
          expect(fsm).to.equal(fluentState);
          installExecuted = true;
        },
      };

      fluentState.use(testPlugin);
      expect(installExecuted).to.be.true;
    });

    it("should allow object plugins to maintain internal state", () => {
      const stateTrackingPlugin = {
        transitions: [] as string[],
        install: (fsm: FluentState) => {
          fsm.observe(Lifecycle.AfterTransition, (prev, curr) => {
            stateTrackingPlugin.transitions.push(`${prev?.name || "null"} -> ${curr.name}`);
          });
        },
      };

      fluentState.use(stateTrackingPlugin);

      // Setup state machine
      fluentState.from("start").to("middle");
      fluentState.from("middle").to("end");

      fluentState.start();
      fluentState.transition("middle");
      fluentState.transition("end");

      expect(stateTrackingPlugin.transitions).to.deep.equal(["null -> start", "start -> middle", "middle -> end"]);
    });

    it("should support mixing function and object plugins", () => {
      const executionOrder: string[] = [];

      const functionPlugin = () => {
        executionOrder.push("function");
      };

      const objectPlugin = {
        install: () => {
          executionOrder.push("object");
        },
      };

      fluentState
        .use(functionPlugin)
        .use(objectPlugin)
        .use(() => executionOrder.push("inline"));

      expect(executionOrder).to.deep.equal(["function", "object", "inline"]);
    });
  });

  describe("Plugin Error Handling", () => {
    it("should not affect state machine if plugin throws", () => {
      const errorPlugin = () => {
        throw new Error("Plugin error");
      };

      expect(() => fluentState.use(errorPlugin)).to.throw("Plugin error");

      // State machine should still work
      fluentState.from("start").to("end");
      expect(fluentState.transition("end")).to.be.true;
    });

    it("should continue executing plugins after error", () => {
      let secondPluginExecuted = false;

      const errorPlugin = () => {
        throw new Error("Plugin error");
      };

      const validPlugin = () => {
        secondPluginExecuted = true;
      };

      expect(() => fluentState.use(errorPlugin)).to.throw("Plugin error");
      fluentState.use(validPlugin);

      expect(secondPluginExecuted).to.be.true;
    });
  });
});
