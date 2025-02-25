import { expect } from "chai";
import { FluentState, TransitionGroup } from "../src";
import { AutoTransitionConfig, SerializedTransitionGroup } from "../src/types";
import * as sinon from "sinon";

describe("Transition Groups", () => {
  describe("Group Creation and Management", () => {
    let fs: FluentState;

    beforeEach(() => {
      fs = new FluentState({
        initialState: "idle",
      });
    });

    it("should create a transition group with a fluent API", () => {
      const group = fs.createGroup("test");
      expect(group).to.be.an.instanceOf(TransitionGroup);
      expect(group.name).to.equal("test");
      expect(fs.groups.size).to.equal(1);
    });

    it("should throw an error when creating a group with a duplicate name", () => {
      fs.createGroup("test");
      expect(() => fs.createGroup("test")).to.throw('Group with name "test" already exists');
    });

    it("should chain configuration with withConfig", () => {
      const group = fs.createGroup("test").withConfig({
        priority: 10,
        debounce: 200,
        retryConfig: {
          maxAttempts: 3,
          delay: 100,
        },
      });

      expect(group).to.be.an.instanceOf(TransitionGroup);
      // We can't directly check the config since it's private,
      // but we can verify it by checking the effective configuration of a transition
      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });
      const config = group.getEffectiveConfig("a", "b");

      expect(config).to.exist;
      if (config) {
        expect(config.priority).to.equal(10);
        expect(config.debounce).to.equal(200);
        expect(config.retryConfig).to.deep.equal({
          maxAttempts: 3,
          delay: 100,
        });
      }
    });

    it("should retrieve a group by name", () => {
      const originalGroup = fs.createGroup("test");
      const retrievedGroup = fs.group("test");

      expect(retrievedGroup).to.equal(originalGroup);
    });

    it("should return null when getting a non-existent group", () => {
      const group = fs.group("nonexistent");
      expect(group).to.be.null;
    });

    it("should remove a group by name", () => {
      fs.createGroup("test");
      expect(fs.groups.size).to.equal(1);

      const removed = fs.removeGroup("test");
      expect(removed).to.be.true;
      expect(fs.groups.size).to.equal(0);
    });

    it("should return false when removing a non-existent group", () => {
      const removed = fs.removeGroup("nonexistent");
      expect(removed).to.be.false;
    });

    it("should list all available groups", () => {
      fs.createGroup("group1");
      fs.createGroup("group2");
      fs.createGroup("group3");

      const groups = fs.getAllGroups();
      expect(groups).to.have.length(3);

      const names = groups.map((g) => g.name);
      expect(names).to.include("group1");
      expect(names).to.include("group2");
      expect(names).to.include("group3");
    });

    it("should support namespaced groups", () => {
      const group = fs.createGroup("auth:login");
      expect(group.namespace).to.equal("auth");
      expect(group.name).to.equal("login");

      const fullName = group.getFullName();
      expect(fullName).to.equal("auth:login");
    });

    it("should properly retrieve namespaced groups", () => {
      const original = fs.createGroup("auth:login");
      const retrieved = fs.group("auth:login");

      expect(retrieved).to.not.be.null;
      if (retrieved) {
        expect(retrieved).to.equal(original);
        expect(retrieved.namespace).to.equal("auth");
        expect(retrieved.name).to.equal("login");
      }
    });

    it("should handle complex namespace patterns", () => {
      const group = fs.createGroup("module:submodule:feature");
      expect(group.namespace).to.equal("module");
      expect(group.name).to.equal("submodule:feature");

      const fullName = group.getFullName();
      expect(fullName).to.equal("module:submodule:feature");
    });

    it("should initialize groups from serialized configuration", () => {
      const serialized: SerializedTransitionGroup = {
        name: "test",
        namespace: "auth",
        enabled: true,
        config: {
          priority: 5,
          debounce: 100,
        },
        transitions: [
          {
            from: "idle",
            to: "loading",
            config: {
              targetState: "loading",
              priority: 10,
            },
          },
        ],
      };

      const conditionMap = {
        idle: {
          loading: () => true,
        },
      };

      const group = fs.createGroupFromConfig(serialized, conditionMap);
      expect(group.name).to.equal("test");
      expect(group.namespace).to.equal("auth");
      expect(group.isEnabled()).to.be.true;
      expect(group.hasTransition("idle", "loading")).to.be.true;

      const config = group.getEffectiveConfig("idle", "loading");
      if (config) {
        expect(config.priority).to.equal(10); // Check overridden priority
      }
    });
  });

  describe("Transition Definition and Organization", () => {
    let fs: FluentState;
    let group: TransitionGroup;

    beforeEach(() => {
      fs = new FluentState({
        initialState: "idle",
      });
      group = fs.createGroup("test");
    });

    it("should add transitions using from().to() fluent syntax", () => {
      group.from("a").to("b", {
        condition: () => true,
        targetState: "b",
      });

      expect(group.hasTransition("a", "b")).to.be.true;
      expect(fs.states.has("a")).to.be.true;
      expect(fs.states.has("b")).to.be.true;
    });

    it("should chain multiple targets with or()", () => {
      group
        .from("a")
        .to("b", {
          condition: () => true,
          targetState: "b",
        })
        .or("c", {
          condition: () => false,
          targetState: "c",
        });

      expect(group.hasTransition("a", "b")).to.be.true;
      expect(group.hasTransition("a", "c")).to.be.true;
    });

    it("should throw error when using or() without to() first", () => {
      const builder = group.from("a");
      expect(() => {
        (builder as any).or("c", {
          condition: () => true,
          targetState: "c",
        });
      }).to.throw("or() must be called after to()");
    });

    it("should maintain references to transitions in the group", () => {
      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });

      expect(group.hasTransition("a", "b")).to.be.true;

      // Check if the transition exists in the state machine
      const stateA = fs.states.get("a");
      if (stateA) {
        expect(stateA.transitions).to.include("b");
      }
    });

    it("should remove transitions from the group", () => {
      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });

      expect(group.hasTransition("a", "b")).to.be.true;

      group.removeTransition("a", "b");
      expect(group.hasTransition("a", "b")).to.be.false;

      // The state machine transitions should still exist
      const stateA = fs.states.get("a");
      if (stateA) {
        expect(stateA.transitions).to.include("b");
      }
    });

    it("should check if a transition exists in the group", () => {
      expect(group.hasTransition("a", "b")).to.be.false;

      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });

      expect(group.hasTransition("a", "b")).to.be.true;
      expect(group.hasTransition("a", "c")).to.be.false;
    });

    it("should get the effective configuration for a transition", () => {
      const config: AutoTransitionConfig = {
        condition: () => true,
        targetState: "b",
        priority: 5,
      };

      group.addTransition("a", "b", config);
      const effectiveConfig = group.getEffectiveConfig("a", "b");

      expect(effectiveConfig).to.deep.include(config);
    });

    it("should return undefined when getting config for non-existent transition", () => {
      const config = group.getEffectiveConfig("a", "b");
      expect(config).to.be.undefined;
    });
  });

  describe("Group-level Configuration", () => {
    let fs: FluentState;
    let group: TransitionGroup;

    beforeEach(() => {
      fs = new FluentState({
        initialState: "idle",
      });
      group = fs.createGroup("test");
    });

    it("should apply group-level configuration to transitions", () => {
      group.withConfig({
        priority: 10,
        debounce: 200,
        retryConfig: {
          maxAttempts: 3,
          delay: 100,
        },
      });

      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });

      const config = group.getEffectiveConfig("a", "b");
      if (config) {
        expect(config.priority).to.equal(10);
        expect(config.debounce).to.equal(200);
        expect(config.retryConfig).to.deep.equal({
          maxAttempts: 3,
          delay: 100,
        });
      }
    });

    it("should allow individual transitions to override group config", () => {
      group.withConfig({
        priority: 10,
        debounce: 200,
      });

      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
        priority: 20,
        debounce: 300,
      });

      const config = group.getEffectiveConfig("a", "b");
      if (config) {
        expect(config.priority).to.equal(20); // Overridden value
        expect(config.debounce).to.equal(300); // Overridden value
      }
    });

    it("should apply partial group configuration to transitions", () => {
      group.withConfig({
        priority: 10,
        // No debounce or retryConfig
      });

      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
        // No priority (should inherit)
        debounce: 300, // Custom value
      });

      const config = group.getEffectiveConfig("a", "b");
      if (config) {
        expect(config.priority).to.equal(10); // Inherited from group
        expect(config.debounce).to.equal(300); // Custom value
        expect(config.retryConfig).to.be.undefined; // Not set at any level
      }
    });
  });

  describe("Group Enabling/Disabling", () => {
    let fs: FluentState;
    let group: TransitionGroup;
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      fs = new FluentState({
        initialState: "idle",
      });
      group = fs.createGroup("test");
      // Use Sinon's fake timers
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      // Restore the clock after each test
      clock.restore();
    });

    it("should be enabled by default", () => {
      expect(group.isEnabled()).to.be.true;
    });

    it("should be disabled after calling disable()", () => {
      group.disable();
      expect(group.isEnabled()).to.be.false;
    });

    it("should be re-enabled after calling enable()", () => {
      group.disable();
      expect(group.isEnabled()).to.be.false;

      group.enable();
      expect(group.isEnabled()).to.be.true;
    });

    it("should support fluent API for enabling/disabling", () => {
      const result = group.disable().enable().disable();
      expect(result).to.equal(group);
      expect(group.isEnabled()).to.be.false;
    });

    it("should support temporary disabling with a duration", async () => {
      group.disableTemporarily(50);
      expect(group.isEnabled()).to.be.false;

      // Fast-forward time
      await clock.tickAsync(50);
      expect(group.isEnabled()).to.be.true;
    });

    it("should execute callback when temporarily disabled group is re-enabled", async () => {
      let callbackExecuted = false;

      group.disableTemporarily(50, () => {
        callbackExecuted = true;
      });

      // Fast-forward time
      await clock.tickAsync(50);
      expect(callbackExecuted).to.be.true;
    });

    it("should clear temporary disable timeout when explicitly enabled", async () => {
      group.disableTemporarily(1000);
      expect(group.isEnabled()).to.be.false;

      // Enable before timeout expires
      group.enable();
      expect(group.isEnabled()).to.be.true;

      // Fast-forward time past when the timeout would have fired
      await clock.tickAsync(1000);
      expect(group.isEnabled()).to.be.true;
    });

    it("should clear temporary disable timeout when explicitly disabled", async () => {
      let callbackExecuted = false;

      group.disableTemporarily(50, () => {
        callbackExecuted = true;
      });

      // Disable explicitly
      group.disable();

      // Fast-forward time
      await clock.tickAsync(50);
      expect(callbackExecuted).to.be.false; // Callback should not be executed
      expect(group.isEnabled()).to.be.false; // Should remain disabled
    });
  });

  describe("Serialization and Deserialization", () => {
    let fs: FluentState;
    let group: TransitionGroup;

    beforeEach(() => {
      fs = new FluentState({
        initialState: "idle",
      });
      group = fs.createGroup("test");
    });

    it("should serialize a group to a plain object", () => {
      group.withConfig({
        priority: 10,
        debounce: 200,
      });

      group.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
        priority: 20,
      });

      const serialized = group.serialize();

      expect(serialized.name).to.equal("test");
      expect(serialized.enabled).to.be.true;
      expect(serialized.config.priority).to.equal(10);
      expect(serialized.config.debounce).to.equal(200);
      expect(serialized.transitions).to.have.length(1);
      expect(serialized.transitions[0].from).to.equal("a");
      expect(serialized.transitions[0].to).to.equal("b");
      expect(serialized.transitions[0].config?.priority).to.equal(20);

      // Ensure condition function is not serialized
      if (serialized.transitions[0].config) {
        expect("condition" in serialized.transitions[0].config).to.be.false;
      }
    });

    it("should deserialize a group from a plain object", () => {
      const serialized: SerializedTransitionGroup = {
        name: "test",
        enabled: true,
        config: {
          priority: 10,
          debounce: 200,
        },
        transitions: [
          {
            from: "a",
            to: "b",
            config: {
              targetState: "b",
              priority: 20,
            },
          },
        ],
      };

      // Remove the group and recreate it from serialized data
      fs.removeGroup("test");

      const conditionMap = {
        a: {
          b: () => true,
        },
      };

      const group = fs.createGroupFromConfig(serialized, conditionMap);

      expect(group.name).to.equal("test");
      expect(group.isEnabled()).to.be.true;
      expect(group.hasTransition("a", "b")).to.be.true;

      const config = group.getEffectiveConfig("a", "b");
      if (config) {
        expect(config.priority).to.equal(20);
      }
    });

    it("should use default condition if not provided in condition map", () => {
      const serialized: SerializedTransitionGroup = {
        name: "test",
        enabled: true,
        config: {},
        transitions: [
          {
            from: "a",
            to: "b",
            config: {
              targetState: "b",
            },
          },
        ],
      };

      fs.removeGroup("test");

      // Empty condition map
      const group = fs.createGroupFromConfig(serialized, {});

      expect(group.hasTransition("a", "b")).to.be.true;

      // The default condition should always return true
      const config = group.getEffectiveConfig("a", "b");
      if (config) {
        expect(typeof config.condition).to.equal("function");
        expect(config.condition({} as any, {})).to.be.true;
      }
    });

    it("should export all groups and import them with the bulk API", () => {
      // Clear any existing groups first
      fs.getAllGroups().forEach((group) => {
        fs.removeGroup(group.getFullName());
      });

      fs.createGroup("group1").addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });
      fs.createGroup("group2").addTransition("c", "d", {
        condition: () => false,
        targetState: "d",
      });

      const exported = fs.exportGroups();
      expect(exported).to.have.length(2);

      // Create a new state machine and import the groups
      const newFs = new FluentState();

      const conditionMaps = {
        group1: {
          a: {
            b: () => true,
          },
        },
        group2: {
          c: {
            d: () => false,
          },
        },
      };

      newFs.importGroups(exported, conditionMaps);

      expect(newFs.groups.size).to.equal(2);

      const group1 = newFs.group("group1");
      const group2 = newFs.group("group2");

      expect(group1).to.not.be.null;
      expect(group2).to.not.be.null;

      if (group1) expect(group1.hasTransition("a", "b")).to.be.true;
      if (group2) expect(group2.hasTransition("c", "d")).to.be.true;
    });

    it("should handle skip and replace options when importing", () => {
      // Clear any existing groups first
      fs.getAllGroups().forEach((group) => {
        fs.removeGroup(group.getFullName());
      });

      fs.createGroup("test");

      const exported = fs.exportGroups();

      // Test skip option
      fs.importGroups(exported, {}, { skipExisting: true });
      expect(fs.groups.size).to.equal(1);

      // Test replace option
      const newGroup = {
        name: "test",
        enabled: false, // Changed
        config: {},
        transitions: [],
      };

      fs.importGroups([newGroup], {}, { replaceExisting: true });
      expect(fs.groups.size).to.equal(1);

      const group = fs.group("test");
      if (group) {
        expect(group.isEnabled()).to.be.false; // Should be replaced
      }
    });

    it("should throw error by default when importing duplicate group", () => {
      // Clear any existing groups first
      fs.getAllGroups().forEach((group) => {
        fs.removeGroup(group.getFullName());
      });

      fs.createGroup("test");

      const exported = fs.exportGroups();

      expect(() => {
        fs.importGroups(exported);
      }).to.throw('Group with name "test" already exists');
    });
  });
});
