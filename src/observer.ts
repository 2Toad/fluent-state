import { Lifecycle } from "./enums";

export class Observer {
  observers: Map<Lifecycle, Function[]> = new Map();

  add(event: Lifecycle, handler: Function): void {
    const functions = this.getEvent(event) || [];
    functions.push(handler);
    this.observers.set(event, functions);
  }

  trigger(event: Lifecycle, ...params: any): any[] {
    const functions = this.getEvent(event);
    if (!functions) {
      return [];
    }

    const results = [];
    functions.forEach((x) => {
      const result = x(...params);
      results.push(result);
    });
    return results;
  }

  private getEvent(name: Lifecycle): Function[] {
    return this.observers.get(name);
  }
}
