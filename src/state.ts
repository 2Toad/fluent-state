import { FluentState } from './fluent-state';
import { Transition } from './transition';

export class State {
  fluentState: FluentState;
  name: string;
  transitions: string[] = [];
  handlers: Function[] = [];

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

  _getRandomTransition(exclude: string[] = []): string {
    if (!this.transitions.length) {
      console.warn(`No states to transition to from "${this.name}"`);
      return;
    }

    const transitions = this.transitions.filter(x => !exclude.includes(x));
    if (!transitions.length) {
      console.warn(`No states to transition to from "${this.name}", after excluding: "${exclude.join('", "')}"`);
      return;
    }

    const index = Math.floor(Math.random() * transitions.length);
    return transitions[index];
  }

  _addHandler(handler: Function): void {
    this.handlers.push(handler);
  }

  _addTransition(name: string): Transition {
    const transition = new Transition(name, this);

    if (!this.hasTransition(name)) {
      this.transitions.push(name);
    }

    return transition;
  }

  private hasTransition(name: string): boolean {
    return this.transitions.indexOf(name) >= 0;
  }
}
