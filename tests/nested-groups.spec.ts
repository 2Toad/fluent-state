import { expect } from "chai";
import { FluentState } from "../src/fluent-state";
import { TransitionGroup } from "../src/transition-group";
import * as sinon from "sinon";

describe("Nested Groups and Composition", () => {
  let fsm: FluentState;
  let parentGroup: TransitionGroup;
  let childGroup1: TransitionGroup;
  let childGroup2: TransitionGroup;
  let grandchildGroup: TransitionGroup;

  beforeEach(() => {
    fsm = new FluentState();
    fsm._addState("s1");
    fsm._addState("s2");
    fsm._addState("s3");
    fsm._addState("s4");

    // Create a hierarchy of groups
    parentGroup = fsm.createGroup("parent");
    childGroup1 = parentGroup.createChildGroup("child1");
    childGroup2 = parentGroup.createChildGroup("child2");
    grandchildGroup = childGroup1.createChildGroup("grandchild");
  });

  describe("Hierarchy Navigation", () => {
    it("should correctly identify parent-child relationships", () => {
      expect(childGroup1.getParent()).to.equal(parentGroup);
      expect(childGroup2.getParent()).to.equal(parentGroup);
      expect(grandchildGroup.getParent()).to.equal(childGroup1);
      expect(parentGroup.getParent()).to.be.undefined;
    });

    it("should retrieve all child groups", () => {
      const parentChildren = parentGroup.getChildGroups();
      expect(parentChildren).to.have.length(2);
      expect(parentChildren).to.include(childGroup1);
      expect(parentChildren).to.include(childGroup2);

      const child1Children = childGroup1.getChildGroups();
      expect(child1Children).to.have.length(1);
      expect(child1Children[0]).to.equal(grandchildGroup);

      const child2Children = childGroup2.getChildGroups();
      expect(child2Children).to.have.length(0);
    });

    it("should retrieve all descendants", () => {
      const descendants = parentGroup.getAllDescendants();
      expect(descendants).to.have.length(3);
      expect(descendants).to.include(childGroup1);
      expect(descendants).to.include(childGroup2);
      expect(descendants).to.include(grandchildGroup);

      const child1Descendants = childGroup1.getAllDescendants();
      expect(child1Descendants).to.have.length(1);
      expect(child1Descendants[0]).to.equal(grandchildGroup);
    });

    it("should retrieve the hierarchy path", () => {
      const grandchildPath = grandchildGroup.getHierarchyPath();
      expect(grandchildPath).to.have.length(3);
      expect(grandchildPath[0]).to.equal(parentGroup);
      expect(grandchildPath[1]).to.equal(childGroup1);
      expect(grandchildPath[2]).to.equal(grandchildGroup);

      const parentPath = parentGroup.getHierarchyPath();
      expect(parentPath).to.have.length(1);
      expect(parentPath[0]).to.equal(parentGroup);
    });

    it("should retrieve the root group", () => {
      expect(grandchildGroup.getRoot()).to.equal(parentGroup);
      expect(childGroup1.getRoot()).to.equal(parentGroup);
      expect(parentGroup.getRoot()).to.equal(parentGroup);
    });

    it("should retrieve sibling groups", () => {
      const child1Siblings = childGroup1.getSiblings();
      expect(child1Siblings).to.have.length(1);
      expect(child1Siblings[0]).to.equal(childGroup2);

      const parentSiblings = parentGroup.getSiblings();
      expect(parentSiblings).to.have.length(0);
    });
  });

  describe("Configuration Inheritance", () => {
    beforeEach(() => {
      // Set up configuration at different levels
      parentGroup.withConfig({
        priority: 1,
        debounce: 100,
        retryConfig: {
          maxAttempts: 3,
          delay: 50,
        },
      });

      childGroup1.withConfig({
        priority: 2,
        debounce: 200,
      });

      grandchildGroup.withConfig({
        priority: 3,
      });
    });

    it("should inherit configuration from ancestors", () => {
      // Add transitions to test configuration inheritance
      grandchildGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      const config = grandchildGroup.getEffectiveConfig("s1", "s2");

      // Should use own configuration when available
      expect(config?.priority).to.equal(3);

      // Should inherit from parent when not overridden
      expect(config?.debounce).to.equal(200);

      // Should inherit from grandparent when not overridden at any level
      expect(config?.retryConfig?.maxAttempts).to.equal(3);
      expect(config?.retryConfig?.delay).to.equal(50);
    });

    it("should override inherited configuration at each level", () => {
      // Update child configuration to override retry settings
      childGroup1.withConfig({
        retryConfig: {
          maxAttempts: 5,
          delay: 100,
        },
      });

      // Add transitions to test configuration inheritance
      grandchildGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      const config = grandchildGroup.getEffectiveConfig("s1", "s2");

      // Should inherit the overridden values from the closest ancestor
      expect(config?.retryConfig?.maxAttempts).to.equal(5);
      expect(config?.retryConfig?.delay).to.equal(100);
    });
  });

  describe("Cascading Operations", () => {
    it("should cascade enable operations to children", () => {
      // Disable all groups first
      parentGroup.disable();
      childGroup1.disable();
      childGroup2.disable();
      grandchildGroup.disable();

      // Verify all are disabled
      expect(parentGroup.isEnabled()).to.be.false;
      expect(childGroup1.isEnabled()).to.be.false;
      expect(childGroup2.isEnabled()).to.be.false;
      expect(grandchildGroup.isEnabled()).to.be.false;

      // Enable parent with cascade
      parentGroup.enable({ cascade: true });

      // Verify all are enabled
      expect(parentGroup.isEnabled()).to.be.true;
      expect(childGroup1.isEnabled()).to.be.true;
      expect(childGroup2.isEnabled()).to.be.true;
      expect(grandchildGroup.isEnabled()).to.be.true;
    });

    it("should cascade disable operations to children", () => {
      // Verify all are enabled by default
      expect(parentGroup.isEnabled()).to.be.true;
      expect(childGroup1.isEnabled()).to.be.true;
      expect(childGroup2.isEnabled()).to.be.true;
      expect(grandchildGroup.isEnabled()).to.be.true;

      // Disable parent with cascade
      parentGroup.disable({ cascade: true });

      // Verify all are disabled
      expect(parentGroup.isEnabled()).to.be.false;
      expect(childGroup1.isEnabled()).to.be.false;
      expect(childGroup2.isEnabled()).to.be.false;
      expect(grandchildGroup.isEnabled()).to.be.false;
    });

    it("should cascade temporary disable operations to children", () => {
      // Setup fake timers
      const clock = sinon.useFakeTimers();

      try {
        // Verify all are enabled by default
        expect(parentGroup.isEnabled()).to.be.true;
        expect(childGroup1.isEnabled()).to.be.true;
        expect(childGroup2.isEnabled()).to.be.true;
        expect(grandchildGroup.isEnabled()).to.be.true;

        // Temporarily disable parent with cascade
        parentGroup.disableTemporarily(100, undefined, { cascade: true });

        // Verify all are disabled
        expect(parentGroup.isEnabled()).to.be.false;
        expect(childGroup1.isEnabled()).to.be.false;
        expect(childGroup2.isEnabled()).to.be.false;
        expect(grandchildGroup.isEnabled()).to.be.false;

        // Fast-forward time
        clock.tick(150);

        // Verify all are enabled again
        expect(parentGroup.isEnabled()).to.be.true;
        expect(childGroup1.isEnabled()).to.be.true;
        expect(childGroup2.isEnabled()).to.be.true;
        expect(grandchildGroup.isEnabled()).to.be.true;
      } finally {
        // Restore original timers
        clock.restore();
      }
    });

    it("should not cascade operations when not requested", () => {
      // Disable parent without cascade
      parentGroup.disable();

      // Verify only parent is disabled
      expect(parentGroup.isEnabled()).to.be.false;
      expect(childGroup1.isEnabled()).to.be.true;
      expect(childGroup2.isEnabled()).to.be.true;
      expect(grandchildGroup.isEnabled()).to.be.true;
    });
  });

  describe("Group Cloning", () => {
    beforeEach(() => {
      // Set up configuration and transitions
      parentGroup.withConfig({
        priority: 1,
        debounce: 100,
      });

      parentGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      childGroup1.addTransition("s2", "s3", {
        condition: () => true,
        targetState: "s3",
      });
    });

    it("should clone a group with its configuration", () => {
      const newFsm = new FluentState();
      newFsm._addState("s1");
      newFsm._addState("s2");
      newFsm._addState("s3");

      const clonedGroup = parentGroup.clone("cloned-parent", newFsm);

      // Verify configuration was copied
      expect(clonedGroup.getFullName()).to.equal("cloned-parent");

      const config = clonedGroup.getEffectiveConfig("s1", "s2");
      expect(config?.priority).to.equal(1);
      expect(config?.debounce).to.equal(100);

      // Verify transitions were copied
      expect(clonedGroup.hasTransition("s1", "s2")).to.be.true;
    });

    it("should clone a group with its children when requested", () => {
      const newFsm = new FluentState();
      newFsm._addState("s1");
      newFsm._addState("s2");
      newFsm._addState("s3");

      const clonedGroup = parentGroup.clone("cloned-parent", newFsm, true);

      // Verify children were cloned
      const children = clonedGroup.getChildGroups();
      expect(children).to.have.length(2);

      // Find the cloned child1
      const clonedChild1 = children.find((child) => child.getFullName() === "child1");
      expect(clonedChild1).to.exist;

      // Verify child transitions were copied
      expect(clonedChild1!.hasTransition("s2", "s3")).to.be.true;

      // Verify parent-child relationship
      expect(clonedChild1!.getParent()).to.equal(clonedGroup);
    });
  });

  describe("Group Composition", () => {
    let templateGroup: TransitionGroup;

    beforeEach(() => {
      // Create a template group with configuration and transitions
      templateGroup = fsm.createGroup("template");
      templateGroup.withConfig({
        priority: 5,
        debounce: 300,
        retryConfig: {
          maxAttempts: 3,
          delay: 100,
        },
      });

      templateGroup.addTransition("s1", "s4", {
        condition: () => true,
        targetState: "s4",
      });

      // Add event handlers and middleware
      templateGroup.onTransition(() => {
        /* empty handler */
      });
      templateGroup.middleware((from, to, proceed) => {
        proceed();
      });
    });

    it("should compose with another group's configuration", () => {
      const newGroup = fsm.createGroup("composed");

      // Compose with template group
      newGroup.compose(templateGroup, {
        mergeConfig: true,
        copyTransitions: false,
        copyEventHandlers: false,
        copyMiddlewares: false,
      });

      // Add a transition to test configuration
      newGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Verify configuration was merged using getEffectiveConfig
      const config = newGroup.getEffectiveConfig("s1", "s2");
      expect(config?.priority).to.equal(5);
      expect(config?.debounce).to.equal(300);
      expect(config?.retryConfig?.maxAttempts).to.equal(3);
      expect(config?.retryConfig?.delay).to.equal(100);

      // Verify transitions were not copied
      expect(newGroup.hasTransition("s1", "s4")).to.be.false;
    });

    it("should compose with another group's transitions", () => {
      const newGroup = fsm.createGroup("composed");

      // Compose with template group
      newGroup.compose(templateGroup, {
        mergeConfig: false,
        copyTransitions: true,
        copyEventHandlers: false,
        copyMiddlewares: false,
      });

      // Verify transitions were copied
      expect(newGroup.hasTransition("s1", "s4")).to.be.true;

      // Add a transition to test configuration
      newGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Verify configuration was not merged using getEffectiveConfig
      const config = newGroup.getEffectiveConfig("s1", "s2");
      expect(config?.priority).to.be.undefined;
      expect(config?.debounce).to.be.undefined;
      expect(config?.retryConfig).to.be.undefined;
    });

    it("should not override existing configuration during composition", () => {
      const newGroup = fsm.createGroup("composed");

      // Set some existing configuration
      newGroup.withConfig({
        priority: 10,
        debounce: 500,
      });

      // Compose with template group
      newGroup.compose(templateGroup, {
        mergeConfig: true,
      });

      // Add a transition to test configuration
      newGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      // Verify existing configuration was not overridden using getEffectiveConfig
      const config = newGroup.getEffectiveConfig("s1", "s2");
      expect(config?.priority).to.equal(10);
      expect(config?.debounce).to.equal(500);

      // But missing configuration was added
      expect(config?.retryConfig?.maxAttempts).to.equal(3);
      expect(config?.retryConfig?.delay).to.equal(100);
    });
  });

  describe("Serialization and Deserialization", () => {
    beforeEach(() => {
      // Add some transitions
      parentGroup.addTransition("s1", "s2", {
        condition: () => true,
        targetState: "s2",
      });

      childGroup1.addTransition("s2", "s3", {
        condition: () => true,
        targetState: "s3",
      });

      grandchildGroup.addTransition("s3", "s4", {
        condition: () => true,
        targetState: "s4",
      });
    });

    it("should serialize and deserialize nested group hierarchies", () => {
      // Serialize all groups
      const serialized = fsm.exportGroups();

      // Create a new state machine
      const newFsm = new FluentState();
      newFsm._addState("s1");
      newFsm._addState("s2");
      newFsm._addState("s3");
      newFsm._addState("s4");

      // Create condition maps for deserialization
      const conditionMaps = {
        parent: {
          s1: { s2: () => true },
        },
        child1: {
          s2: { s3: () => true },
        },
        grandchild: {
          s3: { s4: () => true },
        },
      };

      // Import the serialized groups
      newFsm.importGroups(serialized, conditionMaps);

      // Verify groups were recreated
      const newParent = newFsm.group("parent");
      const newChild1 = newFsm.group("child1");
      const newGrandchild = newFsm.group("grandchild");

      expect(newParent).to.exist;
      expect(newChild1).to.exist;
      expect(newGrandchild).to.exist;

      // Verify parent-child relationships were restored
      expect(newChild1?.getParent()).to.equal(newParent);
      expect(newGrandchild?.getParent()).to.equal(newChild1);

      // Verify transitions were restored
      expect(newParent?.hasTransition("s1", "s2")).to.be.true;
      expect(newChild1?.hasTransition("s2", "s3")).to.be.true;
      expect(newGrandchild?.hasTransition("s3", "s4")).to.be.true;
    });
  });
});
