# Fluent State 🔄

![GitHub Release](https://img.shields.io/github/v/release/2Toad/fluent-state)
[![Downloads](https://img.shields.io/npm/dm/@2toad/fluent-state.svg)](https://www.npmjs.com/package/@2toad/fluent-state)
[![Build status](https://github.com/2toad/fluent-state/actions/workflows/ci.yml/badge.svg)](https://github.com/2Toad/fluent-state/actions/workflows/nodejs.yml)

A fluent JavaScript [State Machine](./state-machine.md) (with TypeScript support)

## Getting Started

Install package

```Shell
npm i @2toad/fluent-state
```

## Usage

```JavaScript
import { fluentState } from '@2toad/fluent-state';
// or
const { fluentState } = require('@2toad/fluent-state');
```

```JavaScript
fluentState
  .from('vegetable').to('diced').or('pickled')
  .from('diced').to('salad').or('trash');

fluentState
  .when('diced').do(() => console.log('diced'));

fluentState.transition('diced');
// or
fluentState.next();
```

## API

### Properties

#### state: State;
The current state

### Methods

#### from(name: string): State
Adds a state

```JavaScript
// Add the 'vegetable' state
fluentState.from('vegetable');
```

#### to(name: string): Transition
Adds a transition to a state

```JavaScript
fluentState
  .from('vegetable') // Add the 'vegetable' state
  .to('diced');      // add the 'diced' state, with a transtion from 'vegetable'
```

#### or(name: string): Transition
Adds a transition to a state

```JavaScript
fluentState
  .from('vegetable') // Add the 'vegetable' state
  .to('diced')       // add the 'diced' state, with a transtion from 'vegetable'
  .or('pickled')     // add the 'pickled' state, with a transtion from 'vegetable'
  .or('discarded');  // add the 'discarded' state, with a transtion from 'vegetable'
```

#### setState(name: string): void
Explicitly set the state without triggering a transition

```JavaScript
fluentState.setState('diced');
```

> NOTE: the state is initially set to the first state you add via `from()`, and it is implicitly set when you transition to a new state via `transition()` or `next()`

#### has(name: string): boolean
Returns true if the state exists

```JavaScript
fluentState.has('vegetable');
```

### remove(name: string): void
Removes a state (and all of its transitions)

```JavaScript
fluentState.remove('vegetable');
```

#### clear(): void
Removes all states

```JavaScript
fluentState.clear();
```

#### transition(...names: string[]): boolean
- Transitions to another state.
- If multiple states are specified, a state is chosen at random.
- Returns `true` upon success.

```JavaScript
// Transition to the 'diced' state
fluentState.transition('diced');

// Transition to the 'diced' or 'discarded' state (selected at random)
fluentState.transition('diced', 'discarded');
```

#### next(...exclude: string[]): boolean
- If the current state contains a single transition, that state is transitioned to.
- If the current state contains multiple transitions, a transition is selected at random.
  - With the option to exclude specified states from the random selection.
- Returns `true` upon success.

```JavaScript
fluentState.next();

// A random state, excluding 'pickled' and 'discarded'
fluentState.next('pickled', 'discarded');
```

### Callbacks
You can add callbacks to any state

#### when(name: string): Event
Specifies the state you want to add a callback to

```JavaScript
fluentState.when('diced');
```

#### do(handler: (previousState: State, fluentState: FluentState) => any): Handler
Adds a callback

```JavaScript
fluentState
  .when('diced')
  .do((previousState, fluentState) => {
    console.log(`Transitioned from "${previousState.name}"`);
  });
```

#### and(handler: (previousState: State, fluentState: FluentState) => any): Handler
Adds another callback

```JavaScript
fluentState
  .when('diced')
  .do(() => console.log('Transitioned to "diced"'))
  .and((previousState, fluentState) => {
    console.log(`Transitioned from "${previousState.name}"`);
  });
```

> And of course it's all chainable

```JavaScript
fluentState
  .when('diced').do(() => console.log('Transitioned to "diced"'))
  .when('pickled').do(() => console.log('Transitioned to "pickled"'));
```

### Lifecycle
You can hook into the state machine lifecycle via the `observe` method.

```JavaScript
fluentState.observe(Lifecycle.BeforeTransition, (currentState, newState) => {
  // You can prevent the transition by returning false from this event
  return false;
});

// Chainable
fluentState
  .observe(Lifecycle.FailedTransition, () => console.log('Transition failed'))
  .observe(Lifecycle.FailedTransition, () => console.log('Multiple hooks allowed on each event'))
  .observe(Lifecycle.AfterTransition, () => console.log('Transition complete'));
```

#### Events

**Order**: BeforeTransition -> FailedTransition -> AfterTransition

- **BeforeTransition**
  ```ts
  (currentState: State, nextState: string): boolean
  ```
- **FailedTransition**
  ```ts
  (currentState: State, targetState: string): void
  ```

- **AfterTransition**
  ```ts
  (previousState: State, currentState: State): void
  ```

## Contributing 🤝

So you want to contribute to the Fluent State project? Fantastic! Please read the [Contribute](./contribute.md) doc to get started.