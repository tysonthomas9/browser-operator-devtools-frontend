/**
 * Browser-compatible event emitter
 * Simple implementation that works in both browser and Node.js
 */

type EventHandler<T = any> = (data: T) => void;

export class EventEmitter<EventMap extends Record<string, any> = Record<string, any>> {
  private events: Map<keyof EventMap, Set<EventHandler<any>>> = new Map();

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
    return this;
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this {
    const onceHandler: EventHandler<EventMap[K]> = (data) => {
      this.off(event, onceHandler);
      handler(data);
    };
    return this.on(event, onceHandler);
  }

  /**
   * Emit an event
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean {
    const handlers = this.events.get(event);
    if (!handlers || handlers.size === 0) {
      return false;
    }
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${String(event)}:`, error);
      }
    });
    return true;
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners<K extends keyof EventMap>(event?: K): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.events.get(event)?.size ?? 0;
  }
}
