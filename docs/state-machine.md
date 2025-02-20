# State Machine

Fluen State is a non-hierarchial state machine.

## States and Transitions

In Fluent State, a state machine consists of individual states connected by transitions.

- **State**: A distinct situation or condition of the system (e.g., "vegetable", "diced", "pickled").
- **Transition**: A connection between two states, representing a possible change from one state to another.
- **Source State**: The state where a transition starts.
- **Target State**: The state where a transition ends.

For example, in the sequence:

```
vegetable -> diced -> pickled
```

- "vegetable" is the source state for the transition to "diced"
- "diced" is the target state for the transition from "vegetable"
- "diced" is also the source state for the transition to "pickled"
- "pickled" is the target state for the transition from "diced"

## State Relationships

In a non-hierarchical state machine like Fluent State, states don't have parent-child relationships. Instead, we describe their relationships in terms of transitions:

- **Reachability**: A state is "reachable" from another if there's a direct transition between them.
  Example: "diced" is reachable from "vegetable"

- **Successor State**: A state that can be transitioned to from the current state.
  Example: "pickled" is a successor state to "diced"

- **Predecessor State**: A state that can transition to the current state.
  Example: "diced" is a predecessor state to "pickled"

- **Intermediate State**: A state that has both incoming and outgoing transitions.
  Example: "diced" is an intermediate state between "vegetable" and "pickled"

## Removing States

The `remove()` method in Fluent State removes a specified state and updates the transitions of remaining states. Here's how it works:

1. The specified state is removed from the state machine.
2. All transitions to the removed state are deleted from other states.
3. If the current state is removed the next available state is set as current.
4. Other states and their remaining transitions are kept intact.

### Intermediate State Removal

An intermediate state is a state with both incoming and outgoing transitions. When removing an intermediate state:

1. The intermediate state is removed.
2. Transitions to and from the intermediate state are removed.
3. States that were connected through the intermediate state become disconnected.

Example:
```
Before: vegetable -> diced -> pickled
After removing "diced": vegetable  pickled
```

Note: Removing a state does not automatically remove states that become unreachable. In the example above, "pickled" remains in the state machine even though it's no longer reachable from "vegetable".

This behavior preserves the independence of states and allows for potential future use, such as adding new transitions to previously unreachable states.
