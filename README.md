# Fluent State 🔄

![GitHub Release](https://img.shields.io/github/v/release/2Toad/fluent-state)
[![Downloads](https://img.shields.io/npm/dm/@2toad/fluent-state.svg)](https://www.npmjs.com/package/@2toad/fluent-state)
[![Build status](https://github.com/2toad/fluent-state/actions/workflows/ci.yml/badge.svg)](https://github.com/2Toad/fluent-state/actions/workflows/nodejs.yml)

A fluent JavaScript State Machine with full TypeScript support

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

// Perform transition
await fluentState.transition('diced');
// or
await fluentState.next();
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

#### to(name: string, autoTransition?: AutoTransition): Transition
Adds a transition to a state. Optionally accepts an auto-transition condition that, when true, will automatically trigger the transition.
The condition receives the current state and a context object that can be used to evaluate the transition.

```JavaScript
// Simple auto-transition
fluentState
  .from('vegetable')
  .to('diced');      // add the 'diced' state, with a transition from 'vegetable'

// With auto-transition
fluentState
  .from('vegetable')
  .to<AppState>('trash',       
    (state, context) => context.quality < 0 // automatically transition to 'trash' when quality is below 0
  );

// Multiple conditions using context
fluentState
  .from('vegetable')
  .to<AppState>('trash',
    (state, context) => context.quality < 0 && context.expired === true
  );

// Enhanced configuration with priorities
fluentState
  .from('vegetable')
  .to<AppState>('critical', {
    condition: (_, ctx) => ctx.quality < -10,
    targetState: 'critical',
    priority: 2  // Higher priority, evaluated first
  })
  .or<AppState>('trash', {
    condition: (_, ctx) => ctx.quality < 0,
    targetState: 'trash',
    priority: 1  // Lower priority
  });

// Evaluate transitions when your state changes
const myState = { quality: -1, expired: true };
await fluentState.state.evaluateAutoTransitions(myState);

// Works with any state management solution:

// Redux example:
store.subscribe(() => {
  fluentState.state.evaluateAutoTransitions(store.getState());
});

// MobX example:
autorun(() => {
  fluentState.state.evaluateAutoTransitions(myObservableState);
});

// Vue example:
watch(() => state.value, (newState) => {
  fluentState.state.evaluateAutoTransitions(newState);
});

// Async conditions are supported
fluentState
  .from('order')
  .to<AppState>('shipped',
    async (state, context) => {
      const status = await checkShipmentStatus(context.orderId);
      return status === 'shipped';
    }
  );
```

#### or(name: string, autoTransition?: AutoTransition): Transition
Adds an alternate transition to a state. Optionally accepts an auto-transition condition that, when true, will automatically trigger the transition.

```JavaScript
fluentState
  .from('vegetable') // Add the 'vegetable' state
  .to('diced')       // add the 'diced' state, with a transition from 'vegetable'
  .or('pickled')     // add the 'pickled' state, with a transition from 'vegetable'
  .or('discarded',   // add the 'discarded' state with auto-transition when expired
    (state) => state.expiryDate < Date.now()
  );
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

#### transition(...names: string[]): Promise<boolean>
- Transitions to another state.
- If multiple states are specified, a state is chosen at random.
- Returns `true` upon success.

```JavaScript
// Transition to the 'diced' state
await fluentState.transition('diced');

// Transition to the 'diced' or 'discarded' state (selected at random)
await fluentState.transition('diced', 'discarded');
```

#### next(...exclude: string[]): Promise<boolean>
- If the current state contains a single transition, that state is transitioned to.
- If the current state contains multiple transitions, a transition is selected at random.
  - With the option to exclude specified states from the random selection.
- Returns `true` upon success.

```JavaScript
await fluentState.next();

// A random state, excluding 'pickled' and 'discarded'
await fluentState.next('pickled', 'discarded');
```

### Callbacks
You can add callbacks to any state

#### when(name: string): Event
Specifies the state you want to add a callback to

```JavaScript
fluentState.when('diced');
```

#### do(handler: (previousState: State, fluentState: FluentState) => void | Promise<void>): Handler

```JavaScript
fluentState
  .when('diced')
  .do((previousState, fluentState) => {
    console.log(`Transitioned from "${previousState.name}"`);
  });

// Asynchronous callbacks are supported
fluentState
  .when('diced')
  .do(async (previousState, fluentState) => {
    await saveStateChange(previousState.name);
    console.log(`Transitioned from "${previousState.name}"`);
  });
```

#### and(handler: (previousState: State, fluentState: FluentState) => void | Promise<void>): Handler
Adds another callback

```JavaScript
fluentState
  .when('diced')
  .do(() => console.log('First callback'))
  .and(() => console.log('Second callback'))
  .and(async () => {
    await someAsyncOperation(); // async is supported
    console.log('Third callback');
  });
```

#### onEnter/onExit Hooks
You can add enter/exit hooks directly to states.

```JavaScript
fluentState
  .from('vegetable')
  .onEnter((previousState, currentState) => console.log(`Entering from ${previousState.name}`))
  .onExit((currentState, nextState) => console.log(`Exiting to ${nextState.name}`))
  .to('diced');
```

Multiple hooks are supported:
```JavaScript
fluentState
  .from('vegetable')
  .onEnter(() => console.log('First enter hook'))
  .onEnter(async (previousState, currentState) => {
    await logStateChange(previousState, currentState); // async is supported
  })
  .to('diced');
```

### Lifecycle
You can hook into the state machine lifecycle via the `observe` method.

```JavaScript
fluentState.observe(Lifecycle.BeforeTransition, (currentState, newState) => {
  // You can prevent the transition by returning false from this event
  return false;
});

// Async handlers are supported
fluentState.observe(Lifecycle.BeforeTransition, async (currentState, newState) => {
  // You can prevent the transition by returning false after async operations
  const isValid = await validateTransition(currentState, newState);
  return isValid;
});

// Chainable with mix of sync and async
fluentState
  .observe(Lifecycle.FailedTransition, () => console.log('Transition failed'))
  .observe(Lifecycle.FailedTransition, async () => {
    await logFailure(); // async is supported
    console.log('Multiple hooks allowed on each event');
  })
  .observe(Lifecycle.AfterTransition, () => console.log('Transition complete'));
```

#### Events

**Order**: BeforeTransition -> FailedTransition -> AfterTransition

- **BeforeTransition**
  ```ts
  (currentState: State, nextState: string) => boolean | Promise<boolean>
  ```
- **FailedTransition**
  ```ts
  (currentState: State, targetState: string) => void | Promise<void>
  ```

- **AfterTransition**
  ```ts
  (previousState: State, currentState: State) => void | Promise<void>
  ```

## Further Reading

- Fluent State is a non-hierarchial state machine. For more information on its architecture and how it operates, please refer to the [State Machine](./docs/state-machine.md) documentation.
- Fluent State has a flexible plugin architecture. See the [Plugins](./docs/plugins.md) documentation for more details.

## Contributing 🤝

So you want to contribute to the Fluent State project? Fantastic! Please read the [Contribute](./docs/contribute.md) doc to get started.