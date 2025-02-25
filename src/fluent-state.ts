import { State } from "./state";
import { Event } from "./event";
import { Observer } from "./observer";
import {
  LifeCycleHandler,
  FluentStatePlugin,
  Lifecycle,
  TransitionError,
  StateError,
  FluentStateOptions,
  TransitionHistoryOptions,
  StateManagerConfig,
  AutoTransitionConfig,
  SerializedTransitionGroup,
} from "./types";
import { TransitionHistory } from "./transition-history";
import { TransitionGroup } from "./transition-group";

/**
 * The main class for building and managing a state machine.
 * Provides a fluent interface for defining states and transitions.
 */
export class FluentState {
  /** A map of all states in the state machine */
  readonly states: Map<string, State> = new Map();

  /** A map of all transition groups in the state machine */
  readonly groups: Map<string, TransitionGroup> = new Map();

  /** The current state of the state machine */
  state: State;

  /** The observer for handling lifecycle events */
  readonly observer: Observer = new Observer();

  /** The history of state transitions */
  history?: TransitionHistory;

  /** Whether transition history tracking is enabled */
  private historyEnabled: boolean;

  /** Configuration for the state manager */
  private stateManagerConfig?: StateManagerConfig<unknown>;

  /** Middleware functions that intercept transitions */
  private middlewares: ((prev: State | null, next: string, transition: () => void) => void | Promise<void>)[] = [];

  /**
   * Creates a new FluentState instance.
   *
   * @param options - Configuration options for the state machine
   */
  constructor(options: FluentStateOptions = {}) {
    this.historyEnabled = options.enableHistory ?? false;
    this.stateManagerConfig = options.stateManagerConfig;

    if (this.historyEnabled) {
      this.history = new TransitionHistory(options.historyOptions);
    }

    if (options.initialState) {
      this.state = this._addState(options.initialState);
    }
  }

  /**
   * Enables transition history tracking.
   *
   * @param options - Configuration options for the transition history
   * @returns The FluentState instance for chaining
   */
  enableHistory(options?: TransitionHistoryOptions): FluentState {
    this.historyEnabled = true;
    this.history = new TransitionHistory(options);
    return this;
  }

  /**
   * Configures the state manager with the provided options.
   *
   * @param config - The configuration for the state manager
   * @returns The FluentState instance for chaining
   */
  configureStateManager(config: StateManagerConfig<unknown>): FluentState {
    this.stateManagerConfig = config;
    return this;
  }

  /**
   * Extends the state machine with a plugin.
   * A plugin can be:
   * 1. A function that takes the FluentState instance and extends it
   * 2. A transition middleware function that intercepts transitions
   * 3. An object with an install method
   *
   * @param plugin - The plugin to install
   * @returns The FluentState instance for chaining
   */
  use(plugin: FluentStatePlugin): FluentState {
    if (typeof plugin === "function") {
      // Check if it's a middleware function (3 parameters) or a plugin function (1 parameter)
      if (plugin.length === 3) {
        this.middlewares.push(plugin as (prev: State | null, next: string, transition: () => void) => void | Promise<void>);
      } else {
        (plugin as (fluentState: FluentState) => void)(this);
      }
    } else {
      // It's a plugin object with an install method
      plugin.install(this);
    }
    return this;
  }

  /**
   * Creates a state in the state machine.
   * If this is the first state added, it becomes the current state.
   *
   * @param name - The name of the state to create.
   * @returns The State object that can be used to define transitions.
   */
  from(name: string): State {
    let state = this._getState(name);

    if (!state) {
      state = this._addState(name);
      this.state = state;
    }

    return state;
  }

  /**
   * Checks if the current state can transition to the specified target state.
   *
   * @param name - The name of the target state to check.
   * @returns True if the current state can transition to the target state, false otherwise.
   */
  can(name: string): boolean {
    return this.state && this.state.can(name);
  }

  /**
   * Starts the state machine and triggers the initial state.
   * This method should be called after all states have been defined and transitions have been configured.
   * It will trigger the `onEnter` and `AfterTransition` events for the initial state.
   */
  async start(): Promise<FluentState> {
    if (this.state) {
      await this.state._triggerEnter(null);
      await this.observer.trigger(Lifecycle.AfterTransition, null, this.state);
      if (this.state.handlers.length > 0) {
        await Promise.all(this.state.handlers.map((handler) => handler(null, this.state)));
      }

      // Record the initial state as a transition from null
      if (this.historyEnabled && this.history) {
        const initialStateName = this.state.name;
        const groupWithInitialState = Array.from(this.groups.values()).find((group) =>
          group.getAllTransitions().some(([, to]) => to === initialStateName),
        );

        this.history.recordTransition(null, this.state.name, this.state.getContext(), true, groupWithInitialState?.getFullName());
      }
    }
    return this;
  }

  /**
   * Attempts to transition to a new state.
   *
   * @param targetState - The name of the state to transition to
   * @param context - Optional context object that can be used in transition logic
   * @returns A Promise that resolves to true if the transition was successful, false otherwise
   */
  async transition(targetState?: string, context?: unknown): Promise<boolean> {
    // Check if target state is provided
    if (targetState === undefined) {
      throw new TransitionError(`No target state specified. Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    // Can't transition if there's no current state
    if (!this.state) {
      return false;
    }

    const currentState = this.state;
    const fromState = currentState.name;

    // If the state doesn't exist yet, add it
    if (!this.states.has(targetState)) {
      this._addState(targetState);
    }

    // Check if any group blocks the transition
    for (const group of this.groups.values()) {
      if (group.hasTransition(fromState, targetState) && !group.isEnabled(context)) {
        if (!group.allowsManualTransitions(context)) {
          // Record the failed transition
          if (this.historyEnabled && this.history) {
            this.history.recordTransition(currentState, targetState, context, false, group.getFullName());
          }
          return false;
        }
      }
    }

    // Try to perform the transition
    const toState = this.states.get(targetState);

    // Check if the transition is valid
    if (this.state.can(targetState)) {
      // Run any middleware that could block the transition
      if (this.middlewares.length > 0 && !(await this._runMiddlewares(currentState, targetState))) {
        // Middleware blocked the transition
        if (this.historyEnabled && this.history) {
          this.history.recordTransition(currentState, targetState, context, false);
        }
        return false;
      }

      // Find the groups that directly contain this transition
      const groupsWithTransition = Array.from(this.groups.values()).filter((group) => group.hasTransition(fromState, targetState));

      // Check if any group middleware blocks the transition
      for (const group of groupsWithTransition) {
        if (!(await group._runMiddleware(fromState, targetState, context))) {
          // Group middleware blocked the transition
          if (this.historyEnabled && this.history) {
            this.history.recordTransition(currentState, targetState, context, false, group.getFullName());
          }
          return false;
        }
      }

      // Execute the transition with all lifecycle events
      const result = await this._executeTransition(
        currentState,
        toState!,
        groupsWithTransition.length > 0 ? groupsWithTransition[0].getFullName() : undefined,
      );

      // If successful, trigger transition handlers for groups
      if (result) {
        // Trigger transition handlers only for groups that directly contain the transition
        for (const group of groupsWithTransition) {
          group._triggerTransitionHandlers(fromState, targetState, context);
        }
      }

      return result;
    } else {
      // Record the failed transition
      if (this.historyEnabled && this.history) {
        // Find if this transition belongs to any group
        const groupWithTransition = Array.from(this.groups.values()).find((group) => group.hasTransition(fromState, targetState));
        this.history.recordTransition(currentState, targetState, context, false, groupWithTransition?.getFullName());
      }
      return false;
    }
  }

  async next(...exclude: string[]): Promise<boolean> {
    const name = this.state._getRandomTransition(exclude);
    return name ? this.transition(name) : false;
  }

  /**
   * Starts a callback chain for a specific state.
   * This is the entry point for defining state-specific callbacks that execute when entering the state.
   *
   * @param name - The name of the state to create callbacks for.
   * @returns An Event object that can be used to define callbacks using `do()` and chain them with `and()`.
   * @throws {StateError} If the specified state doesn't exist.
   */
  when(name: string): Event {
    const state = this._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    return new Event(state);
  }

  /**
   * Removes a state from the state machine.
   *
   * @param name - The name of the state to remove.
   */
  remove(name: string): void {
    const stateToRemove = this._getState(name);
    if (!stateToRemove) return;

    // Clean up any resources in the state before removing
    if (typeof stateToRemove["clearAllDebounceTimers"] === "function") {
      stateToRemove["clearAllDebounceTimers"]();
    }

    this.states.delete(name);

    // Remove all transitions to this state from other states
    this.states.forEach((state) => {
      state.transitions = state.transitions.filter((transition) => transition !== name);
    });

    // Remove all transitions involving this state from all groups
    this.groups.forEach((group) => {
      group.removeTransitionsInvolvingState(name);
    });

    // If we're removing the current state, set the current state to the next available state
    if (this.state === stateToRemove) {
      const nextState = this.states.values().next().value;
      this.state = nextState || null;
    }
  }

  /**
   * Clears all states from the state machine.
   */
  clear(): void {
    // Clean up any resources in states before clearing
    this.states.forEach((state) => {
      // Call internal method to clear debounce timers if it exists
      if (typeof state["clearAllDebounceTimers"] === "function") {
        state["clearAllDebounceTimers"]();
      }
    });

    this.states.clear();
    this.state = null;
  }

  /**
   * Checks if a state exists in the state machine.
   *
   * @param name - The name of the state to check.
   * @returns True if the state exists, false otherwise.
   */
  has(name: string): boolean {
    return !!this._getState(name);
  }

  /**
   * Adds an observer for a specific lifecycle event.
   *
   * @param event - The lifecycle event to observe.
   * @param handler - The handler function to execute when the event occurs.
   * @returns The FluentState instance for chaining.
   */
  observe(event: Lifecycle, handler: LifeCycleHandler): FluentState {
    this.observer.add(event, handler);
    return this;
  }

  /**
   * Sets the current state of the state machine without triggering a transition.
   *
   * @param name - The name of the state to set as the current state.
   * @returns The State object that was set as the current state.
   */
  setState(name: string): State {
    const state = this._getState(name);
    if (!state) {
      throw new StateError(`Unknown state: "${name}". Available states: ${Array.from(this.states.keys()).join(", ")}`);
    }

    this.state = state;
    return state;
  }

  /**
   * Adds a new state to the state machine.
   *
   * @param name - The name of the state to add.
   * @returns The State object that was added.
   */
  _addState(name: string): State {
    let state = this._getState(name);
    if (state) {
      return state;
    }

    state = new State(name, this);
    this.states.set(name, state);
    return state;
  }

  /**
   * Gets a state from the state machine by name.
   *
   * @param name - The name of the state to get.
   * @returns The State object if found, null otherwise.
   */
  _getState(name: string): State | null {
    return this.states.get(name) || null;
  }

  /**
   * Gets the current state of the state machine.
   * @returns The current state, or null if the state machine hasn't been started
   */
  getCurrentState(): State | null {
    return this.state || null;
  }

  /**
   * Runs all middleware functions that intercept transitions.
   *
   * @param currentState - The current state of the state machine.
   * @param nextStateName - The name of the next state to transition to.
   * @returns True if all middlewares proceed, false otherwise.
   */
  private async _runMiddlewares(currentState: State, nextStateName: string): Promise<boolean> {
    if (this.middlewares.length === 0) return true;

    for (const middleware of this.middlewares) {
      let shouldProceed = false;
      const runNextMiddleware = () => {
        shouldProceed = true;
      };
      await middleware(currentState, nextStateName, runNextMiddleware);
      if (!shouldProceed) {
        return false; // Middleware blocked the transition
      }
    }
    return true;
  }

  /**
   * Executes a transition between two states.
   *
   * @param currentState - The current state of the state machine.
   * @param nextState - The next state to transition to.
   * @param groupName - The name of the group associated with the transition
   * @returns True if the transition was successful, false otherwise.
   */
  private async _executeTransition(currentState: State, nextState: State, groupName?: string): Promise<boolean> {
    // Get the context before transition for history recording
    const contextBeforeTransition = currentState.getContext();

    // BeforeTransition must occur first to allow for any pre-transition logic or validation,
    // and to provide an opportunity to cancel the transition if necessary.
    const results = await this.observer.trigger(Lifecycle.BeforeTransition, currentState, nextState.name);
    if (results.includes(false)) {
      // Record failed transition due to BeforeTransition hook returning false
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, false, groupName);
      }
      return false;
    }

    // FailedTransition must occur next to allow for any failed transition logic, including whether
    // the transition has been cancelled.
    if (!currentState.can(nextState.name)) {
      await this.observer.trigger(Lifecycle.FailedTransition, currentState, nextState.name);

      // Record failed transition due to invalid transition
      if (this.historyEnabled && this.history) {
        this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, false, groupName);
      }
      return false;
    }

    // Trigger exit hook before state change
    await currentState._triggerExit(nextState);

    this.setState(nextState.name);

    // Trigger enter hook after state change but before AfterTransition
    await nextState._triggerEnter(currentState);

    // AfterTransition is triggered after the state has changed but before any state-specific handlers.
    // This allows for any general post-transition logic.
    await this.observer.trigger(Lifecycle.AfterTransition, currentState, nextState);

    // State-specific handlers are executed last. These are defined using `when().do()` and
    // are meant for actions that should occur specifically after entering this new state.
    if (nextState.handlers.length > 0) {
      await Promise.all(nextState.handlers.map((handler) => handler(currentState, nextState)));
    }

    // Record successful transition
    if (this.historyEnabled && this.history) {
      this.history.recordTransition(currentState, nextState.name, contextBeforeTransition, true, groupName);
    }

    return true;
  }

  /**
   * Creates a new transition group with the given name.
   *
   * @param name - The unique name for the group
   * @param parentGroup - Optional parent group for configuration inheritance
   * @returns The newly created group
   * @throws If a group with the same name already exists
   */
  createGroup(name: string, parentGroup?: string | TransitionGroup): TransitionGroup {
    if (this.groups.has(name)) {
      throw new StateError(`Group with name "${name}" already exists`);
    }

    let parentGroupObj: TransitionGroup | undefined;

    // If parent group is provided, find it
    if (parentGroup) {
      if (typeof parentGroup === "string") {
        parentGroupObj = this.group(parentGroup);
        if (!parentGroupObj) {
          throw new StateError(`Parent group "${parentGroup}" not found`);
        }
      } else {
        parentGroupObj = parentGroup;
      }
    }

    const group = new TransitionGroup(name, this, parentGroupObj);
    this.groups.set(name, group);

    return group;
  }

  /**
   * Creates a group from a serialized configuration.
   *
   * @param serialized - The serialized group configuration
   * @param conditionMap - Map of transition conditions by source and target state
   * @returns The created group
   */
  createGroupFromConfig(
    serialized: SerializedTransitionGroup,
    conditionMap: Record<string, Record<string, AutoTransitionConfig["condition"]>> = {},
  ): TransitionGroup {
    const fullName = serialized.namespace ? `${serialized.namespace}:${serialized.name}` : serialized.name;

    if (this.groups.has(fullName)) {
      throw new StateError(`Group with name "${fullName}" already exists`);
    }

    // Create the new group, without connecting to parent yet
    const group = new TransitionGroup(fullName, this);

    // Set up the group with the serialized data
    group.deserialize(serialized, conditionMap);

    // Add to groups map first so parent lookup can find it
    this.groups.set(fullName, group);

    // Connect to parent group if specified
    if (serialized.parentGroup && this.groups.has(serialized.parentGroup)) {
      const parentGroup = this.groups.get(serialized.parentGroup)!;
      group.setParent(parentGroup);
    }

    return group;
  }

  /**
   * Gets a transition group by name.
   *
   * @param name - The name of the group to retrieve
   * @returns The group or null if not found
   */
  group(name: string): TransitionGroup | null {
    return this.groups.get(name) || null;
  }

  /**
   * Removes a transition group by name.
   *
   * @param name - The name of the group to remove
   * @returns True if the group was found and removed, false otherwise
   */
  removeGroup(name: string): boolean {
    const group = this.groups.get(name);
    if (!group) return false;

    // The parent-child relationships will be automatically cleaned up
    // when the group is removed from the map

    return this.groups.delete(name);
  }

  /**
   * Gets all transition groups in this state machine.
   *
   * @returns An array of all transition groups
   */
  getAllGroups(): TransitionGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Exports all groups as serialized configurations.
   *
   * @returns An array of serialized group configurations
   */
  exportGroups(): SerializedTransitionGroup[] {
    return this.getAllGroups().map((group) => group.serialize());
  }

  /**
   * Imports groups from serialized configurations.
   *
   * @param groups - The serialized group configurations
   * @param conditionMaps - Map of condition functions for each group, indexed by group name
   * @param options - Import options
   * @returns This FluentState instance for chaining
   */
  importGroups(
    groups: SerializedTransitionGroup[],
    conditionMaps: Record<string, Record<string, Record<string, AutoTransitionConfig["condition"]>>> = {},
    options: {
      skipExisting?: boolean;
      replaceExisting?: boolean;
    } = {},
  ): FluentState {
    // First pass: Create all groups without setting up parent-child relationships
    const createdGroups = new Map<string, TransitionGroup>();

    for (const serialized of groups) {
      const fullName = serialized.namespace ? `${serialized.namespace}:${serialized.name}` : serialized.name;

      // Skip if the group already exists and skipExisting is true
      if (this.groups.has(fullName) && options.skipExisting) {
        continue;
      }

      // Remove existing group if replaceExisting is true
      if (this.groups.has(fullName) && options.replaceExisting) {
        this.removeGroup(fullName);
      }

      // Create the group
      const group = this.createGroup(fullName);
      const groupConditionMap = conditionMaps[fullName] || {};
      group.deserialize(serialized, groupConditionMap);

      createdGroups.set(fullName, group);
    }

    // Second pass: Set up parent-child relationships
    for (const serialized of groups) {
      const fullName = serialized.namespace ? `${serialized.namespace}:${serialized.name}` : serialized.name;

      // Skip if the group wasn't created in the first pass
      if (!createdGroups.has(fullName)) {
        continue;
      }

      const group = createdGroups.get(fullName)!;

      // Set parent if specified
      if (serialized.parentGroup && createdGroups.has(serialized.parentGroup)) {
        const parentGroup = createdGroups.get(serialized.parentGroup)!;
        group.setParent(parentGroup);
      }
    }

    return this;
  }
}

export const fluentState = new FluentState();
export default fluentState;
