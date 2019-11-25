# Fluent State

[![GitHub version](https://badge.fury.io/gh/2Toad%2Ffluent-state.svg)](https://badge.fury.io/gh/2Toad%2Ffluent-state)
[![Downloads](https://img.shields.io/npm/dm/@2toad/fluent-state.svg)](https://www.npmjs.com/package/@2toad/fluent-state)
[![Build Status](https://travis-ci.org/2Toad/fluent-state.svg?branch=master)](https://travis-ci.org/2Toad/fluent-state)

A fluent JavaScript State Machine (with TypeScript support)

## Getting Started

Install package

```
npm i @2toad/fluent-state
```

## Usage

```
import { fluentState } from '@2toad/fluent-state';
// or
var fluentState = require('@2toad/fluent-state').fluentState;

fluentState
  .from('vegetable').to('diced').or('pickled')
  .from('diced').to('salad').or('trash');

fluentState
  .when('diced').do(() => console.log('diced'));

fluenState.transition('diced');
// or
fluenState.next();
```

## API

### Properties

#### state: State;
The current state

### Methods

#### from(name: string): State
Adds a state

```
// Add the 'vegetable' state
fluentState.from('vegetable');
```

#### to(name: string): Transition
Adds a transition to a state

```
fluentState
  .from('vegetable') // Add the 'vegetable' state
  .to('diced');      // add the 'diced' state, with a transtion from 'vegetable'
```

#### or(name: string): Transition
Adds a transition to a state

```
fluentState
  .from('vegetable') // Add the 'vegetable' state
  .to('diced')       // add the 'diced' state, with a transtion from 'vegetable'
  .or('pickled')     // add the 'pickled' state, with a transtion from 'vegetable'
  .or('discarded');  // add the 'discarded' state, with a transtion from 'vegetable'
```

#### setState(name: string): void
Explicitly set the state without triggering a transition

```
fluentState.setState('diced');
```

> NOTE: the state is initially set to the first state you add via `from()`, and it is implicitly set when you transition to a new state via `transition()` or `next()`

#### has(name: string): boolean {
Returns true if the state exists

```
fluentState.has('vegetable');
```

### remove(name: string): void
Removes a state (and all of its transitions)

```
fluentState.remove('vegetable');
```

#### clear(): void
Removes all states

```
fluentState.clear();
```

#### transition(...names: string[]): boolean
- Transitions to another state.
- If multiple names are specified, a name is chosen at random.
- Returns `true` upon success.

```
// Transition to the 'diced' state
fluentState.transition('diced');

// Transition to the 'diced' or 'discarded' state (selected at random)
fluentState.transition('diced', 'discarded');
```

#### next(exclude?: string[]): boolean
- If the current state contains a single transition, that state is transitioned to.
- If the current state contains multiple transitions, a transition is selected at random (with the option to exclude states from the selection).
- Returns `true` upon success.

```
fluentState.next();

// A random state, excluding 'pickled' and 'discarded'
fluentState.next(['pickled', 'discarded']);
```

### Callbacks
You can add callbacks to any state

#### when(name: string): Event
Specifies the state you want to add a callback to

```
fluentState.when('diced');
```

#### do(handler: (previousState: State, fluentState: FluentState) => any): Handler
Adds a callback

```
fluentState
  .when('diced')
  .do((previousState, fluentState) => {
    console.log(`Transitioned from "${previousState.name}"`);
  });
```

#### and(handler: (previousState: State, fluentState: FluentState) => any): Handler
Adds another callback

```
fluentState
  .when('diced')
  .do(() => console.log('Transitioned to "diced"'))
  .and((previousState, fluentState) => {
    console.log(`Transitioned from "${previousState.name}"`);
  });
```

> And of course it's all chainable

```
fluentState
  .when('diced').do(() => console.log('Transitioned to "diced"'))
  .when('pickled').do(() => console.log('Transitioned to "pickled"'));
```

### Lifecycle
You can hook into the state machine lifecycle via the `observe` method.

```
fluentState.observe(Lifecycle.BeforeTransition, (currentState, newState) => {
  // You can prevent the transition by returning false from this event
  return false;
});

// Chainable
fluentState
  .observe(Lifecycle.TransitionFailed, () => console.log('Transition failed'))
  .observe(Lifecycle.TransitionFailed, () => console.log('Multiple hooks allowed on each event'))
  .observe(Lifecycle.AfterTransition, () => console.log('Transition complete'));
```

#### Events

1. BeforeTransition: (currentState: State, newState: string) => { /* return false to stop the lifecycle */ }
2. TransitionFailed: (currentState: State, newState: string) => {}
3. AfterTransition: (previousState: State, currentState: State) => {}
