import { FluentState } from "./fluent-state";
import { Transition } from "./transition";
import { EventHandler, EnterEventHandler, ExitEventHandler } from "./types";

export class State {
  fluentState: FluentState;

  name: string;

  transitions: string[] = [];

  handlers: EventHandler[] = [];
  enterEventHandlers: EnterEventHandler[] = [];
  exitEventHandlers: ExitEventHandler[] = [];

  constructor(name: string, fluentState: FluentState) {
    this.fluentState = fluentState;
    this.name = name;
  }

  to(name: string): Transition {
    this.fluentState._addState(name);
    return this._addTransition(name);
  }

  can(name: string): boolean {
    return this.hasTransition(name);
  }

  onEnter(handler: EnterEventHandler): State {
    this._addEnterHandler(handler);
    return this;
  }

  onExit(handler: ExitEventHandler): State {
    this._addExitHandler(handler);
    return this;
  }

  private hasTransition(name: string): boolean {
    return this.transitions.indexOf(name) >= 0;
  }

  async _triggerEnter(previousState: State): Promise<void> {
    await Promise.all(this.enterEventHandlers.map((handler) => handler(previousState, this)));
  }

  async _triggerExit(nextState: State): Promise<void> {
    await Promise.all(this.exitEventHandlers.map((handler) => handler(this, nextState)));
  }

  _addHandler(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  _addEnterHandler(handler: EnterEventHandler): void {
    this.enterEventHandlers.push(handler);
  }

  _addExitHandler(handler: ExitEventHandler): void {
    this.exitEventHandlers.push(handler);
  }

  _getRandomTransition(exclude: string[] = []): string {
    if (!this.transitions.length) {
      console.warn(`No states to transition to from "${this.name}"`);
      return;
    }

    const transitions = this.transitions.filter((x) => !exclude.includes(x));
    if (!transitions.length) {
      console.warn(`No states to transition to from "${this.name}", after excluding: "${exclude.join('", "')}"`);
      return;
    }

    const index = Math.floor(Math.random() * transitions.length);
    // eslint-disable-next-line security/detect-object-injection -- index is safely generated and transitions array is internal
    return transitions[index];
  }

  _addTransition(name: string): Transition {
    const transition = new Transition(name, this);

    if (!this.hasTransition(name)) {
      this.transitions.push(name);
    }

    return transition;
  }
}
