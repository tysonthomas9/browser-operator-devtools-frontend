import { AgentContext, ToolCall, AgentResult } from '../types/index.cjs';

/**
 * Browser-compatible event emitter
 * Simple implementation that works in both browser and Node.js
 */
type EventHandler<T = any> = (data: T) => void;
declare class EventEmitter<EventMap extends Record<string, any> = Record<string, any>> {
    private events;
    /**
     * Subscribe to an event
     */
    on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this;
    /**
     * Unsubscribe from an event
     */
    off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this;
    /**
     * Subscribe to an event once
     */
    once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this;
    /**
     * Emit an event
     */
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean;
    /**
     * Remove all listeners for an event, or all listeners if no event specified
     */
    removeAllListeners<K extends keyof EventMap>(event?: K): this;
    /**
     * Get the number of listeners for an event
     */
    listenerCount<K extends keyof EventMap>(event: K): number;
}

/**
 * Event system for agent execution
 * Browser-compatible implementation
 */

/**
 * Agent event types
 */
declare enum AgentEvent {
    START = "agent:start",
    ITERATION = "agent:iteration",
    TOOL_CALL = "agent:tool-call",
    TOOL_RESULT = "agent:tool-result",
    FINISH = "agent:finish",
    ERROR = "agent:error",
    STATE_CHANGE = "agent:state-change"
}
/**
 * Event payloads
 */
interface AgentEventMap {
    [AgentEvent.START]: {
        context: AgentContext;
    };
    [AgentEvent.ITERATION]: {
        context: AgentContext;
        iteration: number;
    };
    [AgentEvent.TOOL_CALL]: {
        context: AgentContext;
        toolCall: ToolCall;
    };
    [AgentEvent.TOOL_RESULT]: {
        context: AgentContext;
        result: unknown;
        toolCallId: string;
    };
    [AgentEvent.FINISH]: {
        context: AgentContext;
        result: AgentResult;
    };
    [AgentEvent.ERROR]: {
        context: AgentContext;
        error: Error;
    };
    [AgentEvent.STATE_CHANGE]: {
        context: AgentContext;
    };
}
/**
 * Agent event emitter
 */
declare class AgentEventEmitter extends EventEmitter<AgentEventMap> {
    /**
     * Emit start event
     */
    emitStart(context: AgentContext): void;
    /**
     * Emit iteration event
     */
    emitIteration(context: AgentContext, iteration: number): void;
    /**
     * Emit tool call event
     */
    emitToolCall(context: AgentContext, toolCall: ToolCall): void;
    /**
     * Emit tool result event
     */
    emitToolResult(context: AgentContext, result: unknown, toolCallId: string): void;
    /**
     * Emit finish event
     */
    emitFinish(context: AgentContext, result: AgentResult): void;
    /**
     * Emit error event
     */
    emitError(context: AgentContext, error: Error): void;
    /**
     * Emit state change event
     */
    emitStateChange(context: AgentContext): void;
}
/**
 * Get or create global event bus
 */
declare function getGlobalEventBus(): AgentEventEmitter;
/**
 * Reset global event bus (for testing)
 */
declare function resetGlobalEventBus(): void;

export { AgentEvent, AgentEventEmitter, type AgentEventMap, EventEmitter, getGlobalEventBus, resetGlobalEventBus };
