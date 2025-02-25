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

## Further Reading

- [API](./docs/api.md)
- Fluent State is a non-hierarchial state machine. For more information on its architecture and how it operates, please refer to the [State Machine](./docs/state-machine.md) documentation.
- Fluent State has a flexible plugin architecture. See the [Plugins](./docs/plugins.md) documentation for more details.

## Contributing 🤝

So you want to contribute to the Fluent State project? Fantastic! Please read the [Contribute](./docs/contribute.md) doc to get started.