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

### Core Concepts
- [API Reference](./docs/api.md) - Complete API documentation
- [State Machine Architecture](./docs/state-machine.md) - Learn about Fluent State's non-hierarchical state machine design

### Key Features
- [Auto-Transitions](./docs/auto-transitions.md) - Automatic state transitions based on conditions
- [Batch Updates](./docs/batch-update.md) - Optimize performance with batched context changes
- [Transition Groups](./docs/transition-groups.md) - Organize and manage transitions collectively
- [State Manager](./docs/state-manager.md) - Performance optimizations for state management

### Debugging & Monitoring
- [Debugging Support](./docs/debugging-support.md) - General debugging features
- [Logging and Monitoring](./docs/logging-and-monitoring.md) - Track state machine behavior
- [Transition History](./docs/transition-history.md) - Record and analyze state transitions
- [Time Travel Debugging](./docs/time-travel-debugging.md) - Step through historical states
- [State Machine Visualization](./docs/state-machine-visualization.md) - Generate visual diagrams

### Extension
- [Plugins](./docs/plugins.md) - Extend functionality with plugins
- [Contributing](./docs/contribute.md) - Guidelines for contributors
- [Roadmap](./docs/roadmap.md) - Upcoming features and improvements

## Contributing 🤝

So you want to contribute to the Fluent State project? Fantastic! Please read the [Contribute](./docs/contribute.md) doc to get started.