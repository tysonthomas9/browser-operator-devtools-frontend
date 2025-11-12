'use strict';

// src/events/EventEmitter.ts
var EventEmitter = class {
  events = /* @__PURE__ */ new Map();
  /**
   * Subscribe to an event
   */
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, /* @__PURE__ */ new Set());
    }
    this.events.get(event).add(handler);
    return this;
  }
  /**
   * Unsubscribe from an event
   */
  off(event, handler) {
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
  once(event, handler) {
    const onceHandler = (data) => {
      this.off(event, onceHandler);
      handler(data);
    };
    return this.on(event, onceHandler);
  }
  /**
   * Emit an event
   */
  emit(event, data) {
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
  removeAllListeners(event) {
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
  listenerCount(event) {
    return this.events.get(event)?.size ?? 0;
  }
};

// src/events/index.ts
var AgentEvent = /* @__PURE__ */ ((AgentEvent2) => {
  AgentEvent2["START"] = "agent:start";
  AgentEvent2["ITERATION"] = "agent:iteration";
  AgentEvent2["TOOL_CALL"] = "agent:tool-call";
  AgentEvent2["TOOL_RESULT"] = "agent:tool-result";
  AgentEvent2["FINISH"] = "agent:finish";
  AgentEvent2["ERROR"] = "agent:error";
  AgentEvent2["STATE_CHANGE"] = "agent:state-change";
  return AgentEvent2;
})(AgentEvent || {});
var AgentEventEmitter = class extends EventEmitter {
  /**
   * Emit start event
   */
  emitStart(context) {
    this.emit("agent:start" /* START */, { context });
  }
  /**
   * Emit iteration event
   */
  emitIteration(context, iteration) {
    this.emit("agent:iteration" /* ITERATION */, { context, iteration });
  }
  /**
   * Emit tool call event
   */
  emitToolCall(context, toolCall) {
    this.emit("agent:tool-call" /* TOOL_CALL */, { context, toolCall });
  }
  /**
   * Emit tool result event
   */
  emitToolResult(context, result, toolCallId) {
    this.emit("agent:tool-result" /* TOOL_RESULT */, { context, result, toolCallId });
  }
  /**
   * Emit finish event
   */
  emitFinish(context, result) {
    this.emit("agent:finish" /* FINISH */, { context, result });
  }
  /**
   * Emit error event
   */
  emitError(context, error) {
    this.emit("agent:error" /* ERROR */, { context, error });
  }
  /**
   * Emit state change event
   */
  emitStateChange(context) {
    this.emit("agent:state-change" /* STATE_CHANGE */, { context });
  }
};
var globalEventBus = null;
function getGlobalEventBus() {
  if (!globalEventBus) {
    globalEventBus = new AgentEventEmitter();
  }
  return globalEventBus;
}
function resetGlobalEventBus() {
  globalEventBus = null;
}

exports.AgentEvent = AgentEvent;
exports.AgentEventEmitter = AgentEventEmitter;
exports.EventEmitter = EventEmitter;
exports.getGlobalEventBus = getGlobalEventBus;
exports.resetGlobalEventBus = resetGlobalEventBus;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map