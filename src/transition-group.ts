import { AutoTransitionConfig, SerializedTransitionGroup } from "./types";
import { FluentState } from "./fluent-state";

/**
 * Configuration options for a transition group.
 */
export interface TransitionGroupConfig {
  /** Priority for all transitions in this group (higher values evaluated first) */
  priority?: number;
  /** Debounce setting for all transitions in this group (in milliseconds) */
  debounce?: number;
  /** Retry configuration for all transitions in this group */
  retryConfig?: {
    maxAttempts: number;
    delay: number;
  };
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

  /** Whether this group is currently enabled */
  private enabled: boolean = true;

  /** Configuration for this group */
  private config: TransitionGroupConfig = {};

  /** Map of transitions in this group, organized by source state */
  private transitions: Map<string, Map<string, AutoTransitionConfig>> = new Map();

  /** Map of tags to transitions, for organizing transitions into sub-categories */
  private tagsMap: Map<string, Set<[string, string]>> = new Map();

  /** Timeout for temporary disabling */
  private temporaryDisableTimeout?: NodeJS.Timeout;

  /**
   * Creates a new TransitionGroup.
   *
   * @param name - The unique name for this group (can include namespace with ':' separator)
   * @param fluentState - The parent FluentState instance
   */
  constructor(name: string, fluentState: FluentState) {
    // Handle namespaced group names (e.g., "authentication:login")
    const parts = name.split(":");
    if (parts.length > 1) {
      this.namespace = parts[0];
      this.name = parts.slice(1).join(":");
    } else {
      this.name = name;
    }

    this.fluentState = fluentState;
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
      mergedConfig.priority = this.config.priority;
    }

    // Apply group debounce if set and not overridden
    if (this.config.debounce !== undefined && mergedConfig.debounce === undefined) {
      mergedConfig.debounce = this.config.debounce;
    }

    // Apply group retry config if set and not overridden
    if (this.config.retryConfig !== undefined && mergedConfig.retryConfig === undefined) {
      mergedConfig.retryConfig = this.config.retryConfig;
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
    return this.transitions.has(fromState) && this.transitions.get(fromState)!.has(toState);
  }

  /**
   * Gets the effective configuration for a transition.
   *
   * @param fromState - The source state name
   * @param toState - The target state name
   * @returns The transition configuration or undefined if not found
   */
  getEffectiveConfig(fromState: string, toState: string): AutoTransitionConfig | undefined {
    if (!this.hasTransition(fromState, toState)) {
      return undefined;
    }

    return this.transitions.get(fromState)!.get(toState);
  }

  /**
   * Enables this group, making its transitions available for evaluation.
   *
   * @returns This group instance for chaining
   */
  enable(): TransitionGroup {
    this.enabled = true;

    // Clear any temporary disable timeout
    if (this.temporaryDisableTimeout) {
      clearTimeout(this.temporaryDisableTimeout);
      this.temporaryDisableTimeout = undefined;
    }

    return this;
  }

  /**
   * Disables this group, preventing its transitions from being evaluated.
   *
   * @returns This group instance for chaining
   */
  disable(): TransitionGroup {
    this.enabled = false;

    // Clear any temporary disable timeout
    if (this.temporaryDisableTimeout) {
      clearTimeout(this.temporaryDisableTimeout);
      this.temporaryDisableTimeout = undefined;
    }

    return this;
  }

  /**
   * Temporarily disables this group for the specified duration.
   *
   * @param duration - Duration in milliseconds to disable the group
   * @param callback - Optional callback to execute when the group is re-enabled
   * @returns This group instance for chaining
   */
  disableTemporarily(duration: number, callback?: () => void): TransitionGroup {
    this.disable();

    this.temporaryDisableTimeout = setTimeout(() => {
      this.enable();
      if (callback) {
        callback();
      }
    }, duration);

    return this;
  }

  /**
   * Checks if this group is currently enabled.
   *
   * @returns True if the group is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Serializes this group to a plain object representation.
   * Note that transition conditions are not serialized as they are functions.
   *
   * @returns Serialized representation of this group
   */
  serialize(): SerializedTransitionGroup {
    const serializedTransitions: SerializedTransitionGroup["transitions"] = [];

    // Convert the nested map structure to a flat array
    this.transitions.forEach((toMap, fromState) => {
      toMap.forEach((config, toState) => {
        // Omit the condition function from serialized output
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { condition, ...serializableConfig } = config;

        serializedTransitions.push({
          from: fromState,
          to: toState,
          config: serializableConfig,
          tags: this.getTagsForTransition(fromState, toState),
        });
      });
    });

    return {
      name: this.name,
      namespace: this.namespace,
      enabled: this.enabled,
      config: { ...this.config },
      transitions: serializedTransitions,
    };
  }

  /**
   * Initializes this group from a serialized representation.
   * Note that transition conditions need to be provided separately.
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
}

/**
 * Helper class for building transitions with a fluent API.
 */
export class TransitionBuilder {
  private group: TransitionGroup;
  private fromState: string;
  private lastToState?: string;
  private currentTags: string[] = [];

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
    this.currentTags = []; // Reset tags after use
    return this;
  }
}
