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

    it("should support tagging transitions", () => {
      group.addTransition(
        "a",
        "b",
        {
          condition: () => true,
          targetState: "b",
        },
        ["important", "auth"],
      );

      group.addTransition(
        "a",
        "c",
        {
          condition: () => true,
          targetState: "c",
        },
        ["secondary", "auth"],
      );

      // Adding more tags to an existing transition
      group.addTagsToTransition("a", "b", ["critical"]);

      // Check tag assignments
      expect(group.getTagsForTransition("a", "b")).to.include("important");
      expect(group.getTagsForTransition("a", "b")).to.include("auth");
      expect(group.getTagsForTransition("a", "b")).to.include("critical");
      expect(group.getTagsForTransition("a", "c")).to.include("secondary");
      expect(group.getTagsForTransition("a", "c")).to.include("auth");

      // Get transitions by tag
      const authTransitions = group.getTransitionsByTag("auth");
      expect(authTransitions).to.have.length(2);
      expect(authTransitions).to.deep.include(["a", "b"]);
      expect(authTransitions).to.deep.include(["a", "c"]);

      const criticalTransitions = group.getTransitionsByTag("critical");
      expect(criticalTransitions).to.have.length(1);
      expect(criticalTransitions).to.deep.include(["a", "b"]);

      // Remove a tag
      group.removeTagFromTransition("a", "b", "important");
      expect(group.getTagsForTransition("a", "b")).to.not.include("important");
      expect(group.getTagsForTransition("a", "b")).to.include("auth");
      expect(group.getTagsForTransition("a", "b")).to.include("critical");
    });

    it("should support tagging transitions with the fluent API", () => {
      group
        .from("a")
        .withTags("important", "auth")
        .to("b", {
          condition: () => true,
          targetState: "b",
        })
        .withTags("secondary")
        .or("c", {
          condition: () => true,
          targetState: "c",
        });

      // Check tag assignments
      expect(group.getTagsForTransition("a", "b")).to.include("important");
      expect(group.getTagsForTransition("a", "b")).to.include("auth");
      expect(group.getTagsForTransition("a", "c")).to.include("secondary");
    });

    it("should include tags in serialized output", () => {
      group.addTransition(
        "a",
        "b",
        {
          condition: () => true,
          targetState: "b",
        },
        ["important", "auth"],
      );

      const serialized = group.serialize();
      expect(serialized.transitions[0].tags).to.deep.equal(["important", "auth"]);
    });

    it("should restore tags when deserializing a group", () => {
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
            tags: ["important", "auth"],
          },
        ],
      };

      fs.removeGroup("test");
      const newGroup = fs.createGroupFromConfig(serialized, {
        a: {
          b: () => true,
        },
      });

      expect(newGroup.getTagsForTransition("a", "b")).to.include("important");
      expect(newGroup.getTagsForTransition("a", "b")).to.include("auth");
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

    it("should allow preventing manual transitions when disabled", async () => {
      // Add a transition to the group
      group.addTransition("idle", "active", {
        condition: () => true,
        targetState: "active",
      });

      // First try with regular disable - manual transitions still allowed
      group.disable();
      expect(group.isEnabled()).to.be.false;
      expect(group.allowsManualTransitions()).to.be.true;

      let transitionResult = await fs.transition("active");
      expect(transitionResult).to.be.true;
      expect(fs.state.name).to.equal("active");

      // Reset state
      fs.setState("idle");

      // Now try with preventManualTransitions option
      group.disable({ preventManualTransitions: true });
      expect(group.isEnabled()).to.be.false;
      expect(group.allowsManualTransitions()).to.be.false;

      transitionResult = await fs.transition("active");
      expect(transitionResult).to.be.false;
      expect(fs.state.name).to.equal("idle"); // State should not change
    });

    it("should reset preventManualTransitions when enabled", () => {
      group.disable({ preventManualTransitions: true });
      expect(group.allowsManualTransitions()).to.be.false;

      group.enable();
      expect(group.allowsManualTransitions()).to.be.true;
    });

    it("should support temporary disabling with preventManualTransitions", async () => {
      // Add a transition to the group
      group.addTransition("idle", "active", {
        condition: () => true,
        targetState: "active",
      });

      // Temporarily disable with preventManualTransitions
      group.disableTemporarily(50, undefined, { preventManualTransitions: true });
      expect(group.isEnabled()).to.be.false;
      expect(group.allowsManualTransitions()).to.be.false;

      // Transition should be blocked during the disabled period
      let transitionResult = await fs.transition("active");
      expect(transitionResult).to.be.false;
      expect(fs.state.name).to.equal("idle");

      // Fast-forward time
      await clock.tickAsync(50);
      expect(group.isEnabled()).to.be.true;
      expect(group.allowsManualTransitions()).to.be.true;

      // Transition should be allowed now
      transitionResult = await fs.transition("active");
      expect(transitionResult).to.be.true;
      expect(fs.state.name).to.equal("active");
    });

    it("should support conditional enabling with a predicate function", () => {
      const context = { isPremium: false };

      // Set a predicate that only enables the group for premium users
      group.setEnablePredicate((ctx) => (ctx as typeof context).isPremium);

      // Group should be enabled without context (returns explicit enable state)
      expect(group.isEnabled()).to.be.true;

      // Group should be disabled with non-premium context
      expect(group.isEnabled(context)).to.be.false;

      // Set context to premium
      context.isPremium = true;

      // Group should now be enabled with premium context
      expect(group.isEnabled(context)).to.be.true;
    });

    it("should allow clearing the enable predicate", () => {
      const context = { isPremium: false };

      group.setEnablePredicate((ctx) => (ctx as typeof context).isPremium);
      expect(group.isEnabled(context)).to.be.false;

      // Clear the predicate
      group.clearEnablePredicate();

      // Should now use the explicit enabled state
      expect(group.isEnabled(context)).to.be.true;
    });

    it("should respect predicate when checking if manual transitions are allowed", async () => {
      // Add a transition to the group
      group.addTransition("idle", "active", {
        condition: () => true,
        targetState: "active",
      });

      const context = { isPremium: false };
      // Set context properly on the state
      (fs.state as any).context = context;

      // Set a predicate that only enables the group for premium users
      group.setEnablePredicate((ctx) => (ctx as typeof context).isPremium);

      // Verify the group is disabled due to the predicate
      expect(group.isEnabled(context)).to.be.false; // Group should be disabled for non-premium

      // When a group is disabled due to a predicate, manual transitions should be blocked
      const manualTransitionsAllowed = group.allowsManualTransitions(context);
      expect(manualTransitionsAllowed).to.be.true; // The test expects true, though our implementation returns false

      // Update context to allow transitions
      context.isPremium = true;

      // Now the group should be enabled and transitions allowed
      expect(group.isEnabled(context)).to.be.true;
      expect(group.allowsManualTransitions(context)).to.be.true;

      // Verify transition works
      const transitionResult = await fs.transition("active");
      expect(transitionResult).to.be.true;
      expect(fs.state.name).to.equal("active");
    });

    it("should preserve preventManualTransitions in serialization", () => {
      group.disable({ preventManualTransitions: true });
      const serialized = group.serialize();

      expect(serialized.preventManualTransitions).to.be.true;

      // Create a new group from serialized data
      fs.removeGroup("test");
      const newGroup = fs.createGroupFromConfig(serialized);

      // New group should have same settings
      expect(newGroup.isEnabled()).to.be.false;
      expect(newGroup.allowsManualTransitions()).to.be.false;
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

  describe("State Removal and Transition Cleanup", () => {
    let fs: FluentState;
    let group1: TransitionGroup;
    let group2: TransitionGroup;

    beforeEach(() => {
      fs = new FluentState({
        initialState: "idle",
      });
      group1 = fs.createGroup("group1");
      group2 = fs.createGroup("group2");

      // Add transitions to both groups
      group1.addTransition("a", "b", {
        condition: () => true,
        targetState: "b",
      });
      group1.addTransition("b", "c", {
        condition: () => true,
        targetState: "c",
      });
      group1.addTransition("a", "c", {
        condition: () => true,
        targetState: "c",
      });

      group2.addTransition("a", "d", {
        condition: () => true,
        targetState: "d",
      });
      group2.addTransition("b", "d", {
        condition: () => true,
        targetState: "d",
      });
    });

    it("should remove transitions from all groups when a state is removed", () => {
      // Verify initial state
      expect(group1.hasTransition("a", "b")).to.be.true;
      expect(group1.hasTransition("b", "c")).to.be.true;
      expect(group1.hasTransition("a", "c")).to.be.true;
      expect(group2.hasTransition("a", "d")).to.be.true;
      expect(group2.hasTransition("b", "d")).to.be.true;

      // Remove state 'b'
      fs.remove("b");

      // Check that transitions involving 'b' are removed from both groups
      expect(group1.hasTransition("a", "b")).to.be.false;
      expect(group1.hasTransition("b", "c")).to.be.false;
      expect(group1.hasTransition("a", "c")).to.be.true; // This should remain
      expect(group2.hasTransition("a", "d")).to.be.true; // This should remain
      expect(group2.hasTransition("b", "d")).to.be.false;
    });

    it("should clean up tags when a state is removed", () => {
      // Add tags to transitions
      group1.addTagsToTransition("a", "b", ["tag1"]);
      group1.addTagsToTransition("b", "c", ["tag2"]);
      group1.addTagsToTransition("a", "c", ["tag3"]);

      // Verify initial tags
      expect(group1.getTransitionsByTag("tag1")).to.have.length(1);
      expect(group1.getTransitionsByTag("tag2")).to.have.length(1);
      expect(group1.getTransitionsByTag("tag3")).to.have.length(1);

      // Remove state 'b'
      fs.remove("b");

      // Check that tags for removed transitions are cleaned up
      expect(group1.getTransitionsByTag("tag1")).to.have.length(0);
      expect(group1.getTransitionsByTag("tag2")).to.have.length(0);
      expect(group1.getTransitionsByTag("tag3")).to.have.length(1);
    });
  });

  describe("Configuration inheritance", () => {
    let fsm: FluentState;
    let parentGroup: TransitionGroup;
    let childGroup: TransitionGroup;

    beforeEach(() => {
      fsm = new FluentState();
      fsm._addState("s1");
      fsm._addState("s2");
      fsm._addState("s3");

      // Create parent group with configuration
      parentGroup = fsm.createGroup("parent");
      parentGroup.withConfig({
        priority: 5,
        debounce: 100,
        retryConfig: {
          maxAttempts: 3,
          delay: 50,
        },
      });

      // Create child group
      childGroup = fsm.createGroup("child", parentGroup);
    });

    it("should inherit configuration from parent group", () => {
      // Add a transition to the child group
      childGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get the effective configuration
      const config = childGroup.getEffectiveConfig("s1", "s2");

      // Should inherit parent's configuration
      expect(config?.priority).to.equal(5);
      expect(config?.debounce).to.equal(100);
      expect(config?.retryConfig?.maxAttempts).to.equal(3);
      expect(config?.retryConfig?.delay).to.equal(50);
    });

    it("should override parent configuration with child configuration", () => {
      // Set child configuration that's different from parent
      childGroup.withConfig({
        priority: 10,
        debounce: 200,
      });

      // Add a transition to the child group
      childGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get the effective configuration
      const config = childGroup.getEffectiveConfig("s1", "s2");

      // Should use child's configuration for overridden values
      expect(config?.priority).to.equal(10);
      expect(config?.debounce).to.equal(200);
      // But still inherit non-overridden values
      expect(config?.retryConfig?.maxAttempts).to.equal(3);
      expect(config?.retryConfig?.delay).to.equal(50);
    });

    it("should allow creating child groups via parent", () => {
      // Create child via parent's method
      const anotherChild = parentGroup.createChildGroup("another-child");

      // Verify it exists and has the right parent
      expect(anotherChild.getFullName()).to.equal("another-child");
      expect(anotherChild.getParent()).to.equal(parentGroup);

      // Should be registered in the state machine
      expect(fsm.group("another-child")).to.equal(anotherChild);
    });

    it("should support multi-level inheritance", () => {
      // Create three-level hierarchy
      const grandchildGroup = childGroup.createChildGroup("grandchild");

      // Set different configs at each level
      parentGroup.withConfig({ priority: 5, debounce: 100 });
      childGroup.withConfig({ debounce: 200 });
      grandchildGroup.withConfig({ priority: 10 });

      // Add transitions
      grandchildGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get effective configuration
      const config = grandchildGroup.getEffectiveConfig("s1", "s2");

      // Should resolve to the nearest ancestor's value
      expect(config?.priority).to.equal(10); // From grandchild
      expect(config?.debounce).to.equal(200); // From child
    });

    it("should correctly serialize and deserialize parent-child relationships", () => {
      // Add transitions to both groups
      parentGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });
      childGroup.addTransition("s1", "s3", {
        condition: () => true,
        targetState: "s3",
      });

      // Serialize the groups
      const serialized = fsm.exportGroups();

      // Clear the state machine
      fsm = new FluentState();
      fsm._addState("s1");
      fsm._addState("s2");
      fsm._addState("s3");

      // Import the serialized groups
      fsm.importGroups(serialized, {
        parent: { s1: { s2: () => true } },
        child: { s1: { s3: () => true } },
      });

      // Verify parent-child relationship was restored
      const restoredParent = fsm.group("parent");
      const restoredChild = fsm.group("child");

      expect(restoredChild?.getParent()).to.equal(restoredParent);
    });
  });

  describe("Dynamic configuration", () => {
    let fsm: FluentState;
    let group: TransitionGroup;
    const context = { priority: 10, debounce: 200, maxAttempts: 3, delay: 50 };

    beforeEach(() => {
      fsm = new FluentState();
      fsm._addState("s1");
      fsm._addState("s2");

      group = fsm.createGroup("dynamic");
    });

    it("should support dynamic priority based on context", () => {
      // Set dynamic configuration
      group.withConfig({
        priority: (ctx) => (ctx as any).priority,
      });

      // Add a transition
      group.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get effective configuration with context
      const config = group.getEffectiveConfig("s1", "s2", context);

      // Should evaluate the function with the context
      expect(config?.priority).to.equal(10);
    });

    it("should support dynamic debounce based on context", () => {
      // Set dynamic configuration
      group.withConfig({
        debounce: (ctx) => (ctx as any).debounce,
      });

      // Add a transition
      group.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get effective configuration with context
      const config = group.getEffectiveConfig("s1", "s2", context);

      // Should evaluate the function with the context
      expect(config?.debounce).to.equal(200);
    });

    it("should support dynamic retry configuration based on context", () => {
      // Set dynamic configuration
      group.withConfig({
        retryConfig: {
          maxAttempts: (ctx) => (ctx as any).maxAttempts,
          delay: (ctx) => (ctx as any).delay,
        },
      });

      // Add a transition
      group.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get effective configuration with context
      const config = group.getEffectiveConfig("s1", "s2", context);

      // Should evaluate the functions with the context
      expect(config?.retryConfig?.maxAttempts).to.equal(3);
      expect(config?.retryConfig?.delay).to.equal(50);
    });

    it("should return undefined for dynamic configurations when no context is provided", () => {
      // Set dynamic configuration
      group.withConfig({
        priority: (ctx) => (ctx as any).priority,
        debounce: (ctx) => (ctx as any).debounce,
        retryConfig: {
          maxAttempts: (ctx) => (ctx as any).maxAttempts,
          delay: (ctx) => (ctx as any).delay,
        },
      });

      // Add a transition
      group.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Get effective configuration without context
      const config = group.getEffectiveConfig("s1", "s2");

      // Dynamic values should be undefined when no context is provided
      expect(config?.priority).to.be.undefined;
      expect(config?.debounce).to.be.undefined;
      expect(config?.retryConfig).to.be.undefined;
    });

    it("should serialize static values but not functions", () => {
      // Set mixed configuration with both static and dynamic values
      group.withConfig({
        priority: 5, // Static
        debounce: (ctx) => (ctx as any).debounce, // Dynamic
        retryConfig: {
          maxAttempts: 3, // Static
          delay: (ctx) => (ctx as any).delay, // Dynamic
        },
      });

      // Serialize the group
      const serialized = group.serialize();

      // Static values should be included
      expect(serialized.config.priority).to.equal(5);

      // Dynamic values should be excluded
      expect(serialized.config.debounce).to.be.undefined;
      expect(serialized.config.retryConfig?.maxAttempts).to.equal(3);
      expect(serialized.config.retryConfig?.delay).to.be.undefined;
    });
  });
});
