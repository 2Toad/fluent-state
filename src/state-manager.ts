export interface StateListener<T> {
  (state: T): void;
}

export interface IStateManager<T> {
  getState(): T;
  setState(update: Partial<T>): void;
  subscribe(listener: StateListener<T>): () => void;
}

export class StateManager<T extends object> implements IStateManager<T> {
  private state: T;
  private listeners: StateListener<T>[] = [];

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState(): T {
    return this.state;
  }

  setState(update: Partial<T>): void {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: StateListener<T>): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
