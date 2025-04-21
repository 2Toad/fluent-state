import { AutoTransitionConfig, SerializedTransitionGroup, TransitionHistoryEntry, AutoTransitionEvaluationConfig } from "./types";
import { FluentState } from "./fluent-state";
import { TransitionGroupMetrics, TransitionGroupSnapshot } from "./types";

// Define event handler types
export type TransitionHandler = (fromState: string, toState: string, context?: unknown) => void;
export type EnableHandler = (context?: unknown) => void;
export type DisableHandler = (preventManualTransitions: boolean, context?: unknown) => void;
// Define group middleware type
export type GroupTransitionMiddleware = (fromState: string, toState: string, proceed: () => void, context?: unknown) => void | Promise<void>;

/**
 * Configuration options for a transition group.
 */
export interface TransitionGroupConfig {
  /** Priority for all transitions in this group (higher values evaluated first) */
  priority?: number | ((context: unknown) => number);
  /** Debounce setting for all transitions in this group (in milliseconds) */
  debounce?: number | ((context: unknown) => number);
  /** Retry configuration for all transitions in this group */
  retryConfig?: {
    maxAttempts: number | ((context: unknown) => number);
    delay: number | ((context: unknown) => number);
  };
  /** Configuration for controlling when transitions in this group are evaluated */
  evaluationConfig?: AutoTransitionEvaluationConfig;
}

/**
 * Represents a group of related transitions that can be managed collectively.
 * Provides methods to add transitions, configure behavior, and enable/disable the group.
 */
export class TransitionGroup {
  /** The unique name of this transition group */
  readonly name: string;

  /** Optional namespace for categorizing groups */
  readonly namespace?: string;

  /** Reference to the parent FluentState instance */
  private fluentState: FluentState;

  /** Reference to the parent group if this is a child group */
  private parentGroup?: TransitionGroup;

  /** Child groups that inherit configuration from this group */
  private childGroups: Set<TransitionGroup> = new Set();

  /** Whether this group is currently enabled */
  private enabled: boolean = true;

  /** When disabled, whether to also prevent manual transitions */
  private preventManualTransitions: boolean = false;

  /** Optional predicate function to determine if the group is enabled based on context */
  private enablePredicate?: (context: unknown) => boolean;

  /** Configuration for this group */
  private config: TransitionGroupConfig = {};

  /** Map of transitions in this group, organized by source state */
  private transitions: Map<string, Map<string, AutoTransitionConfig>> = new Map();

  /** Map of tags to transitions, for organizing transitions into sub-categories */
  private tagsMap: Map<string, Set<[string, string]>> = new Map();

  /** Timeout for temporary disabling */
  private temporaryDisableTimeout?: NodeJS.Timeout;

  /** Event handlers for transitions in this group */
  private transitionHandlers: TransitionHandler[] = [];

  /** One-time event handlers for transitions in this group */
  private onceTransitionHandlers: TransitionHandler[] = [];

  /** Event handlers for when this group is enabled */
  private enableHandlers: EnableHandler[] = [];

  /** One-time event handlers for when this group is enabled */
  private onceEnableHandlers: EnableHandler[] = [];

  /** Event handlers for when this group is disabled */
  private disableHandlers: DisableHandler[] = [];

  /** One-time event handlers for when this group is disabled */
  private onceDisableHandlers: DisableHandler[] = [];

  /** Middleware functions for intercepting transitions in this group */
  private middlewares: GroupTransitionMiddleware[] = [];

  /** Metrics for tracking transition performance and frequency */
  private metrics: TransitionGroupMetrics;

  /** History of snapshots taken for this group */
  private snapshots: TransitionGroupSnapshot[] = [];

  /** Maximum number of snapshots to keep in history */
  private maxSnapshots = 10;

  /**
   * Creates a new TransitionGroup.
   *
   * @param name - The unique name for this group (can include namespace with ':' separator)
   * @param fluentState - The parent FluentState instance
   * @param parentGroup - Optional parent group for configuration inheritance
   */
  constructor(name: string, fluentState: FluentState, parentGroup?: TransitionGroup) {
    // Handle namespaced group names (e.g., "authentication:login")
    const parts = name.split(":");
    if (parts.length > 1) {
      this.namespace = parts[0];
      this.name = parts.slice(1).join(":");
    } else {
      this.name = name;
    }

    this.fluentState = fluentState;

    // Set parent group if provided
    if (parentGroup) {
      this.setParent(parentGroup);
    }

    this.initializeMetrics();
  }

  /**
   * Gets the full name of this group, including namespace if available.
   *
   * @returns The full group name
   */
  getFullName(): string {
    return this.namespace ? `${this.namespace}:${this.name}` : this.name;
  }

  /**
   * Sets a parent group for this group to inherit configuration from.
   *
   * @param parentGroup - The parent transition group
   * @returns This group instance for chaining
   */
  setParent(parentGroup: TransitionGroup): TransitionGroup {
    // Remove from previous parent if exists
    if (this.parentGroup) {
      this.parentGroup.childGroups.delete(this);
    }

    this.parentGroup = parentGroup;
    parentGroup.childGroups.add(this);
    return this;
  }

  /**
   * Gets the parent group of this group.
   *
   * @returns The parent group or undefined if none exists
   */
  getParent(): TransitionGroup | undefined {
    return this.parentGroup;
  }

  /**
   * Creates a child group that inherits configuration from this group.
   *
   * @param name - The name for the child group
   * @returns The new child group
   */
  createChildGroup(name: string): TransitionGroup {
    // Create the child group with this as the parent and register it with the FluentState instance
    const childGroup = this.fluentState.createGroup(name, this);
    return childGroup;
  }

  /**
   * Gets all child groups of this group.
   *
   * @returns Array of child groups
   */
  getChildGroups(): TransitionGroup[] {
    return Array.from(this.childGroups);
  }

  /**
   * Gets all descendant groups (children, grandchildren, etc.) of this group.
   *
   * @returns Array of all descendant groups in a flattened structure
   */
  getAllDescendants(): TransitionGroup[] {
    const descendants: TransitionGroup[] = [];

    // Add immediate children
    const children = this.getChildGroups();
    descendants.push(...children);

    // Recursively add their descendants
    for (const child of children) {
      descendants.push(...child.getAllDescendants());
    }

    return descendants;
  }

  /**
   * Gets the hierarchy path from root to this group.
   *
   * @returns Array of groups from root to this group (inclusive)
   */
  getHierarchyPath(): TransitionGroup[] {
    const path: TransitionGroup[] = [this];
    let current = this.parentGroup;

    while (current) {
      path.unshift(current);
      current = current.getParent();
    }

    return path;
  }

  /**
   * Gets the root group (topmost ancestor) in the hierarchy.
   *
   * @returns The root group (this group if it has no parent)
   */
  getRoot(): TransitionGroup {
    if (!this.parentGroup) {
      return this;
    }

    return this.parentGroup.getRoot();
  }

  /**
   * Gets sibling groups (groups that share the same parent).
   *
   * @returns Array of sibling groups (excluding this group)
   */
  getSiblings(): TransitionGroup[] {
    if (!this.parentGroup) {
      return [];
    }

    return this.parentGroup.getChildGroups().filter((group) => group !== this);
  }

  /**
   * Sets configuration options for this group.
   * These will be applied to all transitions in the group unless overridden.
   *
   * @param config - Configuration options
   * @returns This group instance for chaining
   */
  withConfig(config: TransitionGroupConfig): TransitionGroup {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Begins defining transitions from a specific state.
   *
   * @param fromState - The source state name
   * @returns A transition builder for chaining
   */
  from(fromState: string): TransitionBuilder {
    return new TransitionBuilder(this, fromState);
  }

  /**
   * Adds a transition to this group.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @param config - Optional configuration for this transition
   * @param tags - Optional array of tags to categorize this transition
   * @returns This group instance for chaining
   */
  addTransition(fromState: string, toState: string, config?: AutoTransitionConfig, tags?: string[]): TransitionGroup {
    // Ensure the states exist
    if (!this.fluentState.states.has(fromState)) {
      this.fluentState._addState(fromState);
    }

    if (!this.fluentState.states.has(toState)) {
      this.fluentState._addState(toState);
    }

    // Apply group configuration if available
    const mergedConfig: AutoTransitionConfig = {
      ...(config || { condition: () => true }),
      targetState: toState,
    };

    // Apply group priority if set and not overridden
    if (this.config.priority !== undefined && mergedConfig.priority === undefined) {
      // When merging, we can only use static values here (functions will be evaluated at runtime)
      if (typeof this.config.priority !== "function") {
        mergedConfig.priority = this.config.priority;
      }
    }

    // Apply group debounce if set and not overridden
    if (this.config.debounce !== undefined && mergedConfig.debounce === undefined) {
      // When merging, we can only use static values here (functions will be evaluated at runtime)
      if (typeof this.config.debounce !== "function") {
        mergedConfig.debounce = this.config.debounce;
      }
    }

    // Apply group retry config if set and not overridden
    if (this.config.retryConfig !== undefined && mergedConfig.retryConfig === undefined) {
      // When merging, we can only use static values here (functions will be evaluated at runtime)
      if (typeof this.config.retryConfig.maxAttempts !== "function" && typeof this.config.retryConfig.delay !== "function") {
        mergedConfig.retryConfig = {
          maxAttempts: this.config.retryConfig.maxAttempts as number,
          delay: this.config.retryConfig.delay as number,
        };
      }
    }

    // Initialize map for source state if needed
    if (!this.transitions.has(fromState)) {
      this.transitions.set(fromState, new Map());
    }

    // Store the transition
    this.transitions.get(fromState)!.set(toState, mergedConfig);

    // Register the transition with the source state
    const sourceState = this.fluentState.states.get(fromState)!;
    sourceState._addTransition(toState);

    // Add tags if provided
    if (tags && tags.length > 0) {
      this.addTagsToTransition(fromState, toState, tags);
    }

    return this;
  }

  /**
   * Removes a transition from this group.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @returns This group instance for chaining
   */
  removeTransition(fromState: string, toState: string): TransitionGroup {
    if (this.transitions.has(fromState)) {
      this.transitions.get(fromState)!.delete(toState);

      // If this was the last transition from this state, clean up
      if (this.transitions.get(fromState)!.size === 0) {
        this.transitions.delete(fromState);
      }

      // Remove this transition from all tags
      this.tagsMap.forEach((transitions, tag) => {
        transitions.delete([fromState, toState]);
        if (transitions.size === 0) {
          this.tagsMap.delete(tag);
        }
      });
    }

    return this;
  }

  /**
   * Add tags to an existing transition.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @param tags - Array of tags to add to the transition
   * @returns This group instance for chaining
   */
  addTagsToTransition(fromState: string, toState: string, tags: string[]): TransitionGroup {
    if (!this.hasTransition(fromState, toState)) {
      return this;
    }

    const transitionPair: [string, string] = [fromState, toState];

    tags.forEach((tag) => {
      if (!this.tagsMap.has(tag)) {
        this.tagsMap.set(tag, new Set());
      }
      this.tagsMap.get(tag)!.add(transitionPair);
    });

    return this;
  }

  /**
   * Remove a tag from a transition.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @param tag - The tag to remove
   * @returns This group instance for chaining
   */
  removeTagFromTransition(fromState: string, toState: string, tag: string): TransitionGroup {
    if (this.tagsMap.has(tag)) {
      // We need to find the entry by comparing individual elements
      // since direct array comparison by reference won't work
      const transitions = this.tagsMap.get(tag)!;
      const toRemove = Array.from(transitions).find((pair) => pair[0] === fromState && pair[1] === toState);

      if (toRemove) {
        transitions.delete(toRemove);

        // Clean up empty tag sets
        if (transitions.size === 0) {
          this.tagsMap.delete(tag);
        }
      }
    }
    return this;
  }

  /**
   * Get all transitions with a specific tag.
   *
   * @param tag - The tag to filter by
   * @returns Array of transitions [fromState, toState] with the specified tag
   */
  getTransitionsByTag(tag: string): Array<[string, string]> {
    return this.tagsMap.has(tag) ? Array.from(this.tagsMap.get(tag)!) : [];
  }

  /**
   * Get all tags for a specific transition.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @returns Array of tags associated with the transition
   */
  getTagsForTransition(fromState: string, toState: string): string[] {
    const result: string[] = [];

    this.tagsMap.forEach((transitions, tag) => {
      for (const t of transitions) {
        if (t[0] === fromState && t[1] === toState) {
          result.push(tag);
          break;
        }
      }
    });

    return result;
  }

  /**
   * Checks if a specific transition exists in this group.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @returns True if the transition exists in this group
   */
  hasTransition(fromState: string, toState: string): boolean {
    const transitions = this.transitions.get(fromState);
    return transitions ? transitions.has(toState) : false;
  }

  /**
   * Checks if this group has any transitions from the given state.
   *
   * @param fromState - The source state name to check
   * @returns True if the group has any transitions from this state
   */
  hasTransitionsFromState(fromState: string): boolean {
    // Check if the transitions map has the fromState as a key
    // and if it has any transitions defined
    const transitions = this.transitions.get(fromState);
    return !!transitions && transitions.size > 0;
  }

  /**
   * Evaluates a dynamic configuration value if it's a function, otherwise returns the static value.
   *
   * @param value - The configuration value or function
   * @param context - The context to pass to the function
   * @returns The evaluated configuration value
   */
  private evaluateConfigValue<T>(value: T | ((context: unknown) => T), context: unknown): T {
    if (typeof value === "function") {
      return (value as (context: unknown) => T)(context);
    }
    return value;
  }

  /**
   * Gets the effective configuration for a transition, including inherited configuration from parent groups.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @param context - Optional context for evaluating dynamic configuration
   * @returns The transition configuration or undefined if not found
   */
  getEffectiveConfig(fromState: string, toState: string, context?: unknown): AutoTransitionConfig | undefined {
    if (!this.hasTransition(fromState, toState)) {
      return undefined;
    }

    const transitionConfig = this.transitions.get(fromState)!.get(toState)!;
    const result: AutoTransitionConfig = { ...transitionConfig };

    // Build the configuration inheritance chain
    // Start with this group's config
    const effectiveConfig: TransitionGroupConfig = {};

    // Collect parent configs in correct order (from most distant ancestor to this group)
    const configChain: TransitionGroupConfig[] = [this.config];
    let currentParent = this.parentGroup;
    while (currentParent) {
      configChain.unshift(currentParent.config);
      currentParent = currentParent.getParent();
    }

    // Apply configs in order (from oldest ancestor to this group)
    // This ensures more recent configurations override older ones
    for (const groupConfig of configChain) {
      // Apply more recent config (override older ones)
      if (groupConfig.priority !== undefined) {
        effectiveConfig.priority = groupConfig.priority;
      }

      if (groupConfig.debounce !== undefined) {
        effectiveConfig.debounce = groupConfig.debounce;
      }

      if (groupConfig.retryConfig !== undefined) {
        if (!effectiveConfig.retryConfig) {
          effectiveConfig.retryConfig = { ...groupConfig.retryConfig };
        } else {
          // Apply individual retry config properties, allowing partial overrides
          if (groupConfig.retryConfig.maxAttempts !== undefined) {
            effectiveConfig.retryConfig.maxAttempts = groupConfig.retryConfig.maxAttempts;
          }
          if (groupConfig.retryConfig.delay !== undefined) {
            effectiveConfig.retryConfig.delay = groupConfig.retryConfig.delay;
          }
        }
      }

      // Apply evaluation config if present
      if (groupConfig.evaluationConfig) {
        if (!effectiveConfig.evaluationConfig) {
          effectiveConfig.evaluationConfig = { ...groupConfig.evaluationConfig };
        } else {
          // Merge watchProperties arrays
          if (groupConfig.evaluationConfig.watchProperties) {
            if (!effectiveConfig.evaluationConfig.watchProperties) {
              effectiveConfig.evaluationConfig.watchProperties = [...groupConfig.evaluationConfig.watchProperties];
            } else {
              // Add any properties that aren't already in the list
              for (const prop of groupConfig.evaluationConfig.watchProperties) {
                if (!effectiveConfig.evaluationConfig.watchProperties.includes(prop)) {
                  effectiveConfig.evaluationConfig.watchProperties.push(prop);
                }
              }
            }
          }

          // More recently defined skipIf overrides earlier ones
          if (groupConfig.evaluationConfig.skipIf) {
            effectiveConfig.evaluationConfig.skipIf = groupConfig.evaluationConfig.skipIf;
          }

          // More recently defined evaluation strategy overrides earlier ones
          if (groupConfig.evaluationConfig.evaluationStrategy) {
            effectiveConfig.evaluationConfig.evaluationStrategy = groupConfig.evaluationConfig.evaluationStrategy;
          }
        }
      }
    }

    // Apply effective group config to the transition if not overridden by the transition itself
    if (effectiveConfig.priority !== undefined && result.priority === undefined) {
      // If dynamic configuration and context is provided, evaluate it
      if (context !== undefined) {
        result.priority = this.evaluateConfigValue(effectiveConfig.priority, context);
      } else {
        result.priority =
          typeof effectiveConfig.priority === "function"
            ? undefined // Can't evaluate functions without context
            : effectiveConfig.priority;
      }
    }

    if (effectiveConfig.debounce !== undefined && result.debounce === undefined) {
      if (context !== undefined) {
        result.debounce = this.evaluateConfigValue(effectiveConfig.debounce, context);
      } else {
        result.debounce = typeof effectiveConfig.debounce === "function" ? undefined : effectiveConfig.debounce;
      }
    }

    if (effectiveConfig.retryConfig !== undefined && result.retryConfig === undefined) {
      if (context !== undefined) {
        result.retryConfig = {
          maxAttempts: this.evaluateConfigValue(effectiveConfig.retryConfig.maxAttempts, context),
          delay: this.evaluateConfigValue(effectiveConfig.retryConfig.delay, context),
        };
      } else if (typeof effectiveConfig.retryConfig.maxAttempts !== "function" && typeof effectiveConfig.retryConfig.delay !== "function") {
        result.retryConfig = {
          maxAttempts: effectiveConfig.retryConfig.maxAttempts as number,
          delay: effectiveConfig.retryConfig.delay as number,
        };
      }
    }

    // Apply evaluation config if applicable
    if (effectiveConfig.evaluationConfig && !result.evaluationConfig) {
      result.evaluationConfig = { ...effectiveConfig.evaluationConfig };
    }

    return result;
  }

  /**
   * Enables this group and optionally all its descendants.
   *
   * @param options - Optional settings for enabling the group
   * @returns This group instance for chaining
   */
  enable(options?: { cascade?: boolean }): TransitionGroup {
    const wasDisabled = !this.enabled;
    this.enabled = true;
    this.preventManualTransitions = false; // Reset when enabling

    // Clear any temporary disable timeout
    if (this.temporaryDisableTimeout) {
      clearTimeout(this.temporaryDisableTimeout);
      this.temporaryDisableTimeout = undefined;
    }

    // Trigger enable event handlers if the state actually changed
    if (wasDisabled) {
      this._triggerEnableHandlers();
    }

    // Cascade enable to all child groups if requested
    if (options?.cascade) {
      for (const child of this.getChildGroups()) {
        child.enable(options);
      }
    }

    return this;
  }

  /**
   * Disables this group, preventing its transitions from being evaluated.
   *
   * @param options - Optional settings for how the group is disabled
   * @returns This group instance for chaining
   */
  disable(options?: { preventManualTransitions?: boolean; cascade?: boolean }): TransitionGroup {
    const wasEnabled = this.enabled;
    this.enabled = false;

    // Set prevention of manual transitions if specified
    if (options?.preventManualTransitions) {
      this.preventManualTransitions = true;
    }

    // Clear any temporary disable timeout
    if (this.temporaryDisableTimeout) {
      clearTimeout(this.temporaryDisableTimeout);
      this.temporaryDisableTimeout = undefined;
    }

    // Trigger disable event handlers if the state actually changed
    if (wasEnabled) {
      this._triggerDisableHandlers(this.preventManualTransitions);
    }

    // Cascade disable to all child groups if requested
    if (options?.cascade) {
      for (const child of this.getChildGroups()) {
        child.disable(options);
      }
    }

    return this;
  }

  /**
   * Temporarily disables this group for the specified duration.
   *
   * @param duration - Duration in milliseconds to disable the group
   * @param callback - Optional callback to execute when the group is re-enabled
   * @param options - Optional settings for how the group is disabled
   * @returns This group instance for chaining
   */
  disableTemporarily(duration: number, callback?: () => void, options?: { preventManualTransitions?: boolean; cascade?: boolean }): TransitionGroup {
    // Call disable with the provided options
    this.disable(options);

    this.temporaryDisableTimeout = setTimeout(() => {
      this.enable({ cascade: options?.cascade });
      if (callback) {
        callback();
      }
    }, duration);

    return this;
  }

  /**
   * Checks if this group is currently enabled.
   * If a predicate function is set, it will be evaluated with the provided context.
   *
   * @param context - Optional context for evaluating the enable predicate
   * @returns True if the group is enabled
   */
  isEnabled(context?: unknown): boolean {
    // If explicitly disabled, always return false
    if (!this.enabled) {
      return false;
    }

    // If predicate function exists and context is provided, evaluate it
    if (this.enablePredicate && context !== undefined) {
      return this.enablePredicate(context);
    }

    // Otherwise, use the explicit enabled state
    return this.enabled;
  }

  /**
   * Check if manual transitions are allowed for this group.
   * This method considers the following cases:
   * 1. If the group is enabled (base flag and predicate if present), manual transitions are allowed
   * 2. If the group is explicitly disabled with preventManualTransitions=true, manual transitions are blocked
   * 3. If the group is disabled only due to a predicate returning false, manual transitions are still allowed
   * 4. If the group is explicitly disabled but preventManualTransitions=false, manual transitions are allowed
   *
   * @param context - Optional context to evaluate the predicate
   * @returns true if manual transitions are allowed, false otherwise
   */
  allowsManualTransitions(context?: unknown): boolean {
    // If we're explicitly disabled, check the preventManualTransitions flag
    if (!this.enabled) {
      return !this.preventManualTransitions;
    }

    // Even if the predicate would disable the group with the given context,
    // manual transitions are still allowed (this differs from isEnabled)
    if (this.enablePredicate && context !== undefined) {
      // We're only checking the predicate to be thorough, but we still return true
      // since manual transitions are allowed even when disabled by a predicate
      this.enablePredicate(context);
    }

    return true;
  }

  /**
   * Sets a predicate function that dynamically determines if the group is enabled
   * based on the provided context at runtime.
   *
   * @param predicate - Function that returns true if the group should be enabled
   * @returns This group instance for chaining
   */
  setEnablePredicate(predicate: (context: unknown) => boolean): TransitionGroup {
    this.enablePredicate = predicate;
    return this;
  }

  /**
   * Clears any previously set enable predicate, reverting to the explicit enabled state.
   *
   * @returns This group instance for chaining
   */
  clearEnablePredicate(): TransitionGroup {
    this.enablePredicate = undefined;
    return this;
  }

  /**
   * Serializes this group to a plain object representation.
   * Note that transition conditions and dynamic configuration functions are not serialized as they are functions.
   *
   * @returns Serialized representation of this group
   */
  serialize(): SerializedTransitionGroup {
    const serializedTransitions: SerializedTransitionGroup["transitions"] = [];

    // Convert the nested map structure to a flat array
    this.transitions.forEach((toMap, fromState) => {
      toMap.forEach((config, toState) => {
        // Omit the condition function from serialized output
        const { condition: _, ...serializableConfig } = config;

        serializedTransitions.push({
          from: fromState,
          to: toState,
          config: serializableConfig,
          tags: this.getTagsForTransition(fromState, toState),
        });
      });
    });

    // Serialize static config properties only
    const serializableConfig: SerializedTransitionGroup["config"] = {};

    if (this.config.priority !== undefined && typeof this.config.priority !== "function") {
      serializableConfig.priority = this.config.priority;
    }

    if (this.config.debounce !== undefined && typeof this.config.debounce !== "function") {
      serializableConfig.debounce = this.config.debounce;
    }

    if (this.config.retryConfig !== undefined) {
      const retryConfig: { maxAttempts?: number; delay?: number } = {};
      if (typeof this.config.retryConfig.maxAttempts !== "function") {
        retryConfig.maxAttempts = this.config.retryConfig.maxAttempts as number;
      }
      if (typeof this.config.retryConfig.delay !== "function") {
        retryConfig.delay = this.config.retryConfig.delay as number;
      }
      if (Object.keys(retryConfig).length > 0) {
        serializableConfig.retryConfig = retryConfig as { maxAttempts: number; delay: number };
      }
    }

    return {
      name: this.name,
      namespace: this.namespace,
      enabled: this.enabled,
      preventManualTransitions: this.preventManualTransitions,
      config: serializableConfig,
      transitions: serializedTransitions,
      parentGroup: this.parentGroup ? this.parentGroup.getFullName() : undefined,
      childGroups: this.getChildGroups().map((child) => child.getFullName()),
    };
  }

  /**
   * Initializes this group from a serialized representation.
   * Note that transition conditions and dynamic configuration functions need to be provided separately.
   *
   * @param serialized - Serialized group data
   * @param conditionMap - Map of condition functions for transitions
   * @returns This group instance for chaining
   */
  deserialize(
    serialized: SerializedTransitionGroup,
    conditionMap: Record<string, Record<string, AutoTransitionConfig["condition"]>> = {},
  ): TransitionGroup {
    // Apply basic group properties
    this.enabled = serialized.enabled;
    this.preventManualTransitions = serialized.preventManualTransitions || false;
    this.config = { ...serialized.config };

    // Add all transitions
    serialized.transitions.forEach(({ from, to, config, tags }) => {
      // Try to find condition in the provided map using safe property access
      let condition: AutoTransitionConfig["condition"] | undefined;

      if (Object.prototype.hasOwnProperty.call(conditionMap, from)) {
        const fromMap = conditionMap[from];
        if (Object.prototype.hasOwnProperty.call(fromMap, to)) {
          condition = fromMap[to];
        }
      }

      // If no condition is provided, use a default one
      if (!condition) {
        condition = () => true;
      }

      // Add the transition with the merged config
      this.addTransition(
        from,
        to,
        {
          ...config,
          condition,
          targetState: to,
        },
        tags,
      );
    });

    return this;
  }

  /**
   * Removes all transitions involving a specific state.
   * This is used when a state is removed from the state machine.
   *
   * @param stateName - The name of the state being removed
   * @returns This group instance for chaining
   */
  removeTransitionsInvolvingState(stateName: string): TransitionGroup {
    // Remove transitions where this state is the source
    if (this.transitions.has(stateName)) {
      this.transitions.delete(stateName);
    }

    // Remove transitions where this state is the target
    this.transitions.forEach((toStates, fromState) => {
      if (toStates.has(stateName)) {
        toStates.delete(stateName);

        // If there are no more transitions from this state, clean up
        if (toStates.size === 0) {
          this.transitions.delete(fromState);
        }
      }
    });

    // Update tags - we need to properly identify transitions to remove
    this.tagsMap.forEach((transitions, tag) => {
      // Create a new array to hold transitions to remove
      const transitionsToRemove: Array<[string, string]> = [];

      // Find all transitions involving the removed state
      transitions.forEach((transition) => {
        if (transition[0] === stateName || transition[1] === stateName) {
          transitionsToRemove.push(transition);
        }
      });

      // Remove them from this tag
      transitionsToRemove.forEach((transition) => {
        transitions.delete(transition);
      });

      // Clean up empty tag sets
      if (transitions.size === 0) {
        this.tagsMap.delete(tag);
      }
    });

    return this;
  }

  /**
   * Registers a handler function to be called when a transition occurs in this group.
   *
   * @param handler - Function to call when a transition occurs
   * @returns This group instance for chaining
   */
  onTransition(handler: TransitionHandler): TransitionGroup {
    this.transitionHandlers.push(handler);
    return this;
  }

  /**
   * Registers a one-time handler function to be called the next time a transition occurs in this group.
   * The handler is automatically removed after it's called once.
   *
   * @param handler - Function to call when a transition occurs
   * @returns This group instance for chaining
   */
  onceTransition(handler: TransitionHandler): TransitionGroup {
    this.onceTransitionHandlers.push(handler);
    return this;
  }

  /**
   * Removes a previously registered transition handler.
   *
   * @param handler - The handler function to remove
   * @returns This group instance for chaining
   */
  offTransition(handler: TransitionHandler): TransitionGroup {
    // Remove from regular handlers
    const index = this.transitionHandlers.indexOf(handler);
    if (index !== -1) {
      this.transitionHandlers.splice(index, 1);
    }

    // Remove from once handlers if present
    const onceIndex = this.onceTransitionHandlers.indexOf(handler);
    if (onceIndex !== -1) {
      this.onceTransitionHandlers.splice(onceIndex, 1);
    }

    return this;
  }

  /**
   * Registers a handler function to be called when this group is enabled.
   *
   * @param handler - Function to call when the group is enabled
   * @returns This group instance for chaining
   */
  onEnable(handler: EnableHandler): TransitionGroup {
    this.enableHandlers.push(handler);
    return this;
  }

  /**
   * Registers a one-time handler function to be called the next time this group is enabled.
   * The handler is automatically removed after it's called once.
   *
   * @param handler - Function to call when the group is enabled
   * @returns This group instance for chaining
   */
  onceEnable(handler: EnableHandler): TransitionGroup {
    this.onceEnableHandlers.push(handler);
    return this;
  }

  /**
   * Removes a previously registered enable handler.
   *
   * @param handler - The handler function to remove
   * @returns This group instance for chaining
   */
  offEnable(handler: EnableHandler): TransitionGroup {
    // Remove from regular handlers
    const index = this.enableHandlers.indexOf(handler);
    if (index !== -1) {
      this.enableHandlers.splice(index, 1);
    }

    // Remove from once handlers if present
    const onceIndex = this.onceEnableHandlers.indexOf(handler);
    if (onceIndex !== -1) {
      this.onceEnableHandlers.splice(onceIndex, 1);
    }

    return this;
  }

  /**
   * Registers a handler function to be called when this group is disabled.
   *
   * @param handler - Function to call when the group is disabled
   * @returns This group instance for chaining
   */
  onDisable(handler: DisableHandler): TransitionGroup {
    this.disableHandlers.push(handler);
    return this;
  }

  /**
   * Registers a one-time handler function to be called the next time this group is disabled.
   * The handler is automatically removed after it's called once.
   *
   * @param handler - Function to call when the group is disabled
   * @returns This group instance for chaining
   */
  onceDisable(handler: DisableHandler): TransitionGroup {
    this.onceDisableHandlers.push(handler);
    return this;
  }

  /**
   * Removes a previously registered disable handler.
   *
   * @param handler - The handler function to remove
   * @returns This group instance for chaining
   */
  offDisable(handler: DisableHandler): TransitionGroup {
    // Remove from regular handlers
    const index = this.disableHandlers.indexOf(handler);
    if (index !== -1) {
      this.disableHandlers.splice(index, 1);
    }

    // Remove from once handlers if present
    const onceIndex = this.onceDisableHandlers.indexOf(handler);
    if (onceIndex !== -1) {
      this.onceDisableHandlers.splice(onceIndex, 1);
    }

    return this;
  }

  /**
   * Triggers transition event handlers for a specific transition.
   * This is intended to be called by the FluentState instance when a transition in this group occurs.
   *
   * @param fromState - The source state of the transition
   * @param toState - The target state of the transition
   * @param context - Optional context for the transition
   */
  _triggerTransitionHandlers(fromState: string, toState: string, context?: unknown): void {
    // Execute regular handlers
    for (const handler of this.transitionHandlers) {
      handler(fromState, toState, context);
    }

    // Execute and remove one-time handlers
    const onceHandlers = [...this.onceTransitionHandlers];
    this.onceTransitionHandlers = [];
    for (const handler of onceHandlers) {
      handler(fromState, toState, context);
    }

    // Bubble event to parent group if exists
    if (this.parentGroup) {
      this.parentGroup._triggerTransitionHandlers(fromState, toState, context);
    }
  }

  /**
   * Triggers enable event handlers.
   * This is called internally when the group is enabled.
   *
   * @param context - Optional context for the event
   */
  private _triggerEnableHandlers(context?: unknown): void {
    // Execute regular handlers
    for (const handler of this.enableHandlers) {
      handler(context);
    }

    // Execute and remove one-time handlers
    const onceHandlers = [...this.onceEnableHandlers];
    this.onceEnableHandlers = [];
    for (const handler of onceHandlers) {
      handler(context);
    }

    // Bubble event to parent group if exists
    if (this.parentGroup) {
      this.parentGroup._triggerEnableHandlers(context);
    }
  }

  /**
   * Triggers disable event handlers.
   * This is called internally when the group is disabled.
   *
   * @param preventManualTransitions - Whether manual transitions are prevented
   * @param context - Optional context for the event
   */
  private _triggerDisableHandlers(preventManualTransitions: boolean, context?: unknown): void {
    // Execute regular handlers
    for (const handler of this.disableHandlers) {
      handler(preventManualTransitions, context);
    }

    // Execute and remove one-time handlers
    const onceHandlers = [...this.onceDisableHandlers];
    this.onceDisableHandlers = [];
    for (const handler of onceHandlers) {
      handler(preventManualTransitions, context);
    }

    // Bubble event to parent group if exists
    if (this.parentGroup) {
      this.parentGroup._triggerDisableHandlers(preventManualTransitions, context);
    }
  }

  /**
   * Adds a middleware function that can intercept and control transitions within this group.
   * Middleware functions are executed in the order they are added.
   * A middleware must call the proceed function to allow the transition to continue.
   * If proceed is not called, the transition is blocked.
   *
   * @param middleware - Function that receives source state, target state, context, and a proceed function
   * @returns This group instance for chaining
   *
   * @example
   * ```typescript
   * group.middleware((from, to, proceed, context) => {
   *   if (to === 'sensitive' && !context?.isAuthenticated) {
   *     // Block the transition by not calling proceed
   *     console.log('Authentication required');
   *   } else {
   *     // Allow the transition to continue
   *     proceed();
   *   }
   * });
   * ```
   */
  middleware(middleware: GroupTransitionMiddleware): TransitionGroup {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Removes a previously registered middleware function.
   *
   * @param middleware - The middleware function to remove
   * @returns This group instance for chaining
   */
  removeMiddleware(middleware: GroupTransitionMiddleware): TransitionGroup {
    const index = this.middlewares.indexOf(middleware);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
    }
    return this;
  }

  /**
   * Runs all middleware functions for this group.
   * This is called internally when a transition within this group is being evaluated.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @param context - Optional context for the transition
   * @returns Promise that resolves to true if all middleware allow the transition, false otherwise
   * @internal
   */
  async _runMiddleware(fromState: string, toState: string, context?: unknown): Promise<boolean> {
    if (this.middlewares.length === 0) return true;

    for (const middleware of this.middlewares) {
      let shouldProceed = false;
      try {
        await middleware(
          fromState,
          toState,
          () => {
            shouldProceed = true;
          },
          context,
        );
      } catch (error) {
        console.error(`Error in group "${this.getFullName()}" middleware:`, error);
        return false; // Block transition on error for safety
      }

      if (!shouldProceed) {
        return false; // Middleware blocked the transition
      }
    }
    return true;
  }

  /**
   * Gets all transitions in this group.
   *
   * @returns An array of [fromState, toState] pairs representing all transitions in this group
   */
  getAllTransitions(): Array<[string, string]> {
    const result: Array<[string, string]> = [];

    for (const [fromState, toStates] of this.transitions.entries()) {
      for (const toState of toStates.keys()) {
        result.push([fromState, toState]);
      }
    }

    return result;
  }

  /**
   * Gets the history of transitions for this group.
   *
   * @returns An array of transition history entries for this group, or null if history is not enabled
   */
  getTransitionHistory(): TransitionHistoryEntry[] | null {
    if (!this.fluentState.history) {
      return null;
    }

    return this.fluentState.history.getTransitionsForGroup(this.getFullName());
  }

  /**
   * Creates a copy of this group and its configuration.
   * This is useful for reusing group definitions across state machines.
   *
   * @param newName - Optional new name for the copied group
   * @param targetFluentState - The target FluentState instance to create the copy in
   * @param copyChildren - Whether to also copy child groups (default: false)
   * @returns The newly created copy of this group
   */
  clone(newName: string | undefined = undefined, targetFluentState: FluentState = this.fluentState, copyChildren: boolean = false): TransitionGroup {
    // Use the current name if no new name is provided
    const name = newName || this.name;

    // Create a new group in the target FluentState
    const newGroup = targetFluentState.createGroup(name);

    // Copy configuration
    newGroup.withConfig(this.config);
    newGroup.enabled = this.enabled;
    newGroup.preventManualTransitions = this.preventManualTransitions;

    if (this.enablePredicate) {
      newGroup.setEnablePredicate(this.enablePredicate);
    }

    // Copy transitions
    this.transitions.forEach((toMap, fromState) => {
      toMap.forEach((config, toState) => {
        // Ensure the states exist in the target FluentState
        if (!targetFluentState.has(fromState)) {
          targetFluentState._addState(fromState);
        }
        if (!targetFluentState.has(toState)) {
          targetFluentState._addState(toState);
        }

        // Add the transition with its tags
        const tags = this.getTagsForTransition(fromState, toState);
        newGroup.addTransition(fromState, toState, { ...config }, tags);
      });
    });

    // Copy event handlers
    this.transitionHandlers.forEach((handler) => newGroup.onTransition(handler));
    this.enableHandlers.forEach((handler) => newGroup.onEnable(handler));
    this.disableHandlers.forEach((handler) => newGroup.onDisable(handler));

    // Copy middlewares
    this.middlewares.forEach((middleware) => newGroup.middleware(middleware));

    // Recursively copy children if requested
    if (copyChildren) {
      this.getChildGroups().forEach((childGroup) => {
        const newChildGroup = childGroup.clone(undefined, targetFluentState, true);
        newChildGroup.setParent(newGroup);
      });
    }

    return newGroup;
  }

  /**
   * Applies a composition pattern to this group.
   * This allows reusing predefined group configurations and transitions.
   *
   * @param compositionGroup - The group to compose with this group
   * @param options - Options for how to apply the composition
   * @returns This group instance for chaining
   */
  compose(
    compositionGroup: TransitionGroup,
    options: {
      mergeConfig?: boolean;
      copyTransitions?: boolean;
      copyEventHandlers?: boolean;
      copyMiddlewares?: boolean;
    } = {
      mergeConfig: true,
      copyTransitions: true,
      copyEventHandlers: false,
      copyMiddlewares: false,
    },
  ): TransitionGroup {
    // Merge configuration if requested
    if (options.mergeConfig) {
      // Only merge properties that don't already exist
      if (this.config.priority === undefined && compositionGroup.config.priority !== undefined) {
        this.config.priority = compositionGroup.config.priority;
      }

      if (this.config.debounce === undefined && compositionGroup.config.debounce !== undefined) {
        this.config.debounce = compositionGroup.config.debounce;
      }

      if (compositionGroup.config.retryConfig && !this.config.retryConfig) {
        this.config.retryConfig = { ...compositionGroup.config.retryConfig };
      } else if (compositionGroup.config.retryConfig && this.config.retryConfig) {
        if (this.config.retryConfig.maxAttempts === undefined && compositionGroup.config.retryConfig.maxAttempts !== undefined) {
          this.config.retryConfig.maxAttempts = compositionGroup.config.retryConfig.maxAttempts;
        }

        if (this.config.retryConfig.delay === undefined && compositionGroup.config.retryConfig.delay !== undefined) {
          this.config.retryConfig.delay = compositionGroup.config.retryConfig.delay;
        }
      }
    }

    // Copy transitions if requested
    if (options.copyTransitions) {
      compositionGroup.transitions.forEach((toMap, fromState) => {
        toMap.forEach((config, toState) => {
          // Only add if the transition doesn't already exist
          if (!this.hasTransition(fromState, toState)) {
            // Ensure the states exist in this FluentState
            if (!this.fluentState.has(fromState)) {
              this.fluentState._addState(fromState);
            }
            if (!this.fluentState.has(toState)) {
              this.fluentState._addState(toState);
            }

            // Add the transition with its tags
            const tags = compositionGroup.getTagsForTransition(fromState, toState);
            this.addTransition(fromState, toState, { ...config }, tags);
          }
        });
      });
    }

    // Copy event handlers if requested
    if (options.copyEventHandlers) {
      compositionGroup.transitionHandlers.forEach((handler) => this.onTransition(handler));
      compositionGroup.enableHandlers.forEach((handler) => this.onEnable(handler));
      compositionGroup.disableHandlers.forEach((handler) => this.onDisable(handler));
    }

    // Copy middlewares if requested
    if (options.copyMiddlewares) {
      compositionGroup.middlewares.forEach((middleware) => this.middleware(middleware));
    }

    return this;
  }

  /**
   * Creates a snapshot of the current state of this transition group.
   * @param label Optional label to identify this snapshot
   * @returns The created snapshot
   */
  public createSnapshot(label?: string): TransitionGroupSnapshot {
    // Helper to safely get a number value from a potentially function property
    const getNumberValue = (value?: number | ((context: unknown) => number)): number | undefined => {
      if (typeof value === "number") {
        return value;
      }
      return undefined; // Skip function values as they can't be serialized
    };

    const snapshot: TransitionGroupSnapshot = {
      name: this.name,
      namespace: this.namespace,
      label,
      enabled: this.enabled,
      preventManualTransitions: this.preventManualTransitions,
      config: {
        priority: getNumberValue(this.config.priority),
        debounce: getNumberValue(this.config.debounce),
        retryConfig: this.config.retryConfig
          ? {
              maxAttempts: getNumberValue(this.config.retryConfig.maxAttempts) || 0,
              delay: getNumberValue(this.config.retryConfig.delay) || 0,
            }
          : undefined,
      },
      transitions: Array.from(this.transitions.entries()).flatMap(([from, toMap]) =>
        Array.from(toMap.entries()).map(([to]) => {
          // Get tags for this transition from the tagsMap
          const transitionTags: string[] = [];
          this.tagsMap.forEach((transitions, tag) => {
            for (const t of transitions) {
              if (t[0] === from && t[1] === to) {
                transitionTags.push(tag);
                break;
              }
            }
          });

          return {
            from,
            to,
            tags: transitionTags,
          };
        }),
      ),
      timestamp: Date.now(),
      parentGroup: this.parentGroup?.name,
      childGroups: Array.from(this.childGroups).map((g) => g.name),
    };

    // Add to snapshots history, maintaining the max limit
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Retrieves all snapshots for this transition group.
   * @returns Array of snapshots
   */
  public getSnapshots(): TransitionGroupSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clears all snapshots for this transition group.
   */
  public clearSnapshots(): void {
    this.snapshots = [];
  }

  /**
   * Sets the maximum number of snapshots to keep in history.
   * @param max Maximum number of snapshots
   */
  public setMaxSnapshots(max: number): void {
    if (max < 1) {
      throw new Error("Maximum number of snapshots must be at least 1");
    }
    this.maxSnapshots = max;

    // Trim existing snapshots if needed
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }
  }

  /**
   * Gets the current metrics for this transition group.
   * @returns The current metrics
   */
  public getMetrics(): TransitionGroupMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets the metrics for this transition group.
   */
  public resetMetrics(): void {
    this.initializeMetrics();
  }

  /**
   * Initializes the metrics tracking for this transition group.
   * Called during construction and when resetting metrics.
   */
  private initializeMetrics(): void {
    this.metrics = {
      name: this.name,
      namespace: this.namespace,
      transitionAttempts: 0,
      successfulTransitions: 0,
      failedTransitions: 0,
      averageTransitionTime: 0,
      transitionFrequency: {},
      collectionStartTime: Date.now(),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Updates metrics after a transition attempt.
   * @param from Source state
   * @param to Target state
   * @param success Whether the transition was successful
   * @param duration Time taken for the transition in milliseconds
   */
  private updateMetrics(from: string, to: string, success: boolean, duration: number): void {
    // Update attempt counts
    this.metrics.transitionAttempts++;
    if (success) {
      this.metrics.successfulTransitions++;
    } else {
      this.metrics.failedTransitions++;
    }

    // Update average transition time
    const totalTransitions = this.metrics.successfulTransitions + this.metrics.failedTransitions;
    this.metrics.averageTransitionTime = (this.metrics.averageTransitionTime * (totalTransitions - 1) + duration) / totalTransitions;

    // Update transition frequency
    if (!this.metrics.transitionFrequency[from]) {
      this.metrics.transitionFrequency[from] = {};
    }
    if (!this.metrics.transitionFrequency[from][to]) {
      this.metrics.transitionFrequency[from][to] = 0;
    }
    this.metrics.transitionFrequency[from][to]++;

    // Update most frequent transition
    const currentCount = this.metrics.transitionFrequency[from][to];
    if (!this.metrics.mostFrequentTransition || currentCount > this.metrics.mostFrequentTransition.count) {
      this.metrics.mostFrequentTransition = {
        from,
        to,
        count: currentCount,
      };
    }

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
  }

  /**
   * Attempts to transition to the specified state.
   * This method will check if the group is enabled and run any middleware before performing the transition.
   *
   * @param to - The target state name
   * @param context - Optional context for the transition
   * @returns Promise that resolves to true if the transition was successful, false otherwise
   */
  public transition(to: string, context?: unknown): Promise<boolean> {
    const startTime = performance.now();
    const currentState = this.fluentState.getCurrentState();
    const from = currentState.name; // Get the name string from the State object

    return new Promise<boolean>((resolve) => {
      // Check if the group is enabled
      if (!this.isEnabled(context)) {
        this.updateMetrics(from, to, false, performance.now() - startTime);
        resolve(false);
        return;
      }

      // Run middleware
      this._runMiddleware(from, to, context)
        .then((middlewareResult) => {
          if (!middlewareResult) {
            this.updateMetrics(from, to, false, performance.now() - startTime);
            resolve(false);
            return;
          }

          // Perform the transition
          this.fluentState
            .transition(to, context)
            .then((success) => {
              const duration = performance.now() - startTime;
              this.updateMetrics(from, to, success, duration);
              resolve(success);
            })
            .catch(() => {
              const duration = performance.now() - startTime;
              this.updateMetrics(from, to, false, duration);
              resolve(false);
            });
        })
        .catch(() => {
          const duration = performance.now() - startTime;
          this.updateMetrics(from, to, false, duration);
          resolve(false);
        });
    });
  }

  /**
   * Configures when and how transitions in this group should be evaluated.
   *
   * @param config - Configuration for controlling transition evaluation
   * @returns This group instance for chaining
   */
  withEvaluationConfig(config: AutoTransitionEvaluationConfig): TransitionGroup {
    this.config.evaluationConfig = {
      ...this.config.evaluationConfig,
      ...config,
    };
    return this;
  }

  /**
   * Configures transitions in this group to only evaluate when specified properties change.
   *
   * @param properties - Property paths to watch for changes
   * @returns This group instance for chaining
   */
  watchProperties(...properties: string[]): TransitionGroup {
    return this.withEvaluationConfig({
      watchProperties: properties,
    });
  }

  /**
   * Configures transitions in this group to skip evaluation when the provided condition is true.
   *
   * @param skipFn - Function that returns true when evaluation should be skipped
   * @returns This group instance for chaining
   */
  skipIf(skipFn: (context: unknown) => boolean): TransitionGroup {
    return this.withEvaluationConfig({
      skipIf: skipFn,
    });
  }

  /**
   * Sets the evaluation timing strategy for transitions in this group.
   *
   * @param strategy - Timing strategy for transitions in this group
   * @returns This group instance for chaining
   */
  evaluateOn(strategy: "immediate" | "nextTick" | "idle"): TransitionGroup {
    return this.withEvaluationConfig({
      evaluationStrategy: strategy,
    });
  }
}

/**
 * Helper class for building transitions with a fluent API.
 */
export class TransitionBuilder {
  private group: TransitionGroup;
  private fromState: string;
  private lastToState?: string;
  private currentTags: string[] = [];
  private lastTransitionIndex?: number;

  constructor(group: TransitionGroup, fromState: string) {
    this.group = group;
    this.fromState = fromState;
  }

  /**
   * Adds tags to use for subsequent transitions.
   *
   * @param tags - The tags to apply to the next transition
   * @returns This builder instance for chaining
   */
  withTags(...tags: string[]): TransitionBuilder {
    this.currentTags = tags;
    return this;
  }

  /**
   * Adds a transition to the target state.
   *
   * @param toState - The target state name
   * @param config - Optional configuration for this transition
   * @returns This builder instance for chaining
   */
  to<TContext = unknown>(toState: string, config?: AutoTransitionConfig<TContext>): TransitionBuilder {
    this.group.addTransition(this.fromState, toState, config, this.currentTags);
    this.lastToState = toState;

    // Track index of this transition for later configuration
    const fromMap = this.group["transitions"].get(this.fromState);
    if (fromMap) {
      this.lastTransitionIndex = fromMap.size - 1;
    }

    this.currentTags = []; // Reset tags after use
    return this;
  }

  /**
   * Adds an alternative transition from the same source state.
   * Must be called after to().
   *
   * @param toState - The alternative target state name
   * @param config - Optional configuration for this transition
   * @returns This builder instance for chaining
   */
  or<TContext = unknown>(toState: string, config?: AutoTransitionConfig<TContext>): TransitionBuilder {
    if (!this.lastToState) {
      throw new Error("or() must be called after to()");
    }

    this.group.addTransition(this.fromState, toState, config, this.currentTags);
    this.lastToState = toState;

    // Track index of this transition for later configuration
    const fromMap = this.group["transitions"].get(this.fromState);
    if (fromMap) {
      this.lastTransitionIndex = fromMap.size - 1;
    }

    this.currentTags = []; // Reset tags after use
    return this;
  }

  /**
   * Configures when and how the last added transition should be evaluated.
   *
   * @param config - Configuration for controlling transition evaluation
   * @returns This builder instance for chaining
   */
  withEvaluationConfig(config: AutoTransitionEvaluationConfig): TransitionBuilder {
    if (!this.lastToState) {
      throw new Error("withEvaluationConfig() must be called after to() or or()");
    }

    // Get the transitions map
    const fromMap = this.group["transitions"].get(this.fromState);
    if (!fromMap) return this;

    // Get the transition config
    const transitionConfig = fromMap.get(this.lastToState);
    if (transitionConfig) {
      // Set or merge the evaluation config
      transitionConfig.evaluationConfig = {
        ...transitionConfig.evaluationConfig,
        ...config,
      };
    }

    return this;
  }

  /**
   * Configures the last added transition to only evaluate when specified properties change.
   *
   * @param properties - Property paths to watch for changes
   * @returns This builder instance for chaining
   */
  watchProperties(...properties: string[]): TransitionBuilder {
    return this.withEvaluationConfig({
      watchProperties: properties,
    });
  }

  /**
   * Configures the last added transition to skip evaluation when the provided condition is true.
   *
   * @param skipFn - Function that returns true when evaluation should be skipped
   * @returns This builder instance for chaining
   */
  skipIf(skipFn: (context: unknown) => boolean): TransitionBuilder {
    return this.withEvaluationConfig({
      skipIf: skipFn,
    });
  }

  /**
   * Sets the evaluation timing strategy for the last added transition.
   *
   * @param strategy - Timing strategy for the transition
   * @returns This builder instance for chaining
   */
  evaluateOn(strategy: "immediate" | "nextTick" | "idle"): TransitionBuilder {
    return this.withEvaluationConfig({
      evaluationStrategy: strategy,
    });
  }
}
