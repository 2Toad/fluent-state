# Plugin Architecture for FluentState

## Overview
`FluentState` supports a flexible plugin architecture that allows for extending its functionality through plugins. Plugins can be functions or objects that enhance the state machine's capabilities.

## Plugin Types
- **Function Plugins**: Functions that either extend the `FluentState` instance or act as middleware for state transitions.
- **Object Plugins**: Objects with an `install` method that is called with the `FluentState` instance.

## Middleware
Middleware functions are a special type of plugin that intercept state transitions. They have three parameters: the previous state, the next state, and a transition function. Middleware can block transitions by not calling the transition function.

## Installation
Plugins are installed using the `use` method of the `FluentState` class. The `use` method checks the type of the plugin and either adds it to the middleware list or calls its `install` method. The method returns the `FluentState` instance, allowing for method chaining.

## Example Usage

- **Function Plugin**:
  ```typescript
  fluentState.use((fluentState) => {
    // Extend the fluentState instance
  });

  // Supports async
  fluentState.use(async (fluentState) => {
    await initializePlugin();
    // Extend the fluentState instance after async call
  });
  ```

- **Middleware Plugin**:
  ```typescript
  fluentState.use((prev, next, transition) => {
    // Intercept transition
    if (someCondition) {
      transition(); // Allow transition
    }
  });

  // Supports async
  fluentState.use(async (prev, next, transition) => {
    // Perform async validation
    const isValid = await validateTransition(prev, next);
    if (isValid) {
      transition(); // Allow transition
    }
  });
  ```

- **Object Plugin**:
  ```typescript
  const plugin = {
    install(fluentState) {
      // Extend the fluentState instance
    }
  };
  fluentState.use(plugin);

  // Supports async
  const plugin = {
    async install(fluentState) {
      await initializePlugin();
      // Extend the fluentState instance after async call
    }
  };
  fluentState.use(plugin);
  ```

## Native Plugins

### Transition Guard

- **Name**: Transition Guard
- **Purpose**: Allows intercepting and controlling state transitions by providing a middleware function.
- **Usage**:
  - The plugin is created using the `createTransitionGuard` function, which takes a handler function as an argument.
  - The handler function receives the current state, the next state name, and a `proceed` function. The `proceed` function must be called to allow the transition to continue.
- **Example**:
  ```typescript
  fluentState.use(createTransitionGuard((prev, next, proceed) => {
    console.log(`Checking transition: ${prev?.name} → ${next}`);
    if (next === 'mainApp' && !userHasAccess()) {
      console.log("Access Denied!");
      return;
    }
  }));

  // Async is supported
  fluentState.use(createTransitionGuard(async (prev, next, proceed) => {
    console.log(`Checking transition: ${prev?.name} → ${next}`);
    const hasAccess = await checkUserPermissions();
    const isValid = await validateTransition(prev, next);
    
    if (hasAccess && isValid) {
      proceed();
    }
  }));
  ```
  
