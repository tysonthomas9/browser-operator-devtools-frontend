/**
 * Event system for agent execution
 * Extracted and adapted from front_end/panels/ai_chat/core/AgentService.ts
 */

import EventEmitter from 'eventemitter3';
import type { AgentContext, AgentResult, ToolCall } from '../types/index.js';

/**
 * Agent event types
 */
export enum AgentEvent {
  START = 'agent:start',
  ITERATION = 'agent:iteration',
  TOOL_CALL = 'agent:tool-call',
  TOOL_RESULT = 'agent:tool-result',
  FINISH = 'agent:finish',
  ERROR = 'agent:error',
  STATE_CHANGE = 'agent:state-change',
}

/**
 * Event payloads
 */
export interface AgentEventMap {
  [AgentEvent.START]: { context: AgentContext };
  [AgentEvent.ITERATION]: { context: AgentContext; iteration: number };
  [AgentEvent.TOOL_CALL]: { context: AgentContext; toolCall: ToolCall };
  [AgentEvent.TOOL_RESULT]: { context: AgentContext; result: unknown; toolCallId: string };
  [AgentEvent.FINISH]: { context: AgentContext; result: AgentResult };
  [AgentEvent.ERROR]: { context: AgentContext; error: Error };
  [AgentEvent.STATE_CHANGE]: { context: AgentContext };
}

/**
 * Agent event emitter
 */
export class AgentEventEmitter extends EventEmitter<AgentEventMap> {
  /**
   * Emit start event
   */
  emitStart(context: AgentContext): void {
    this.emit(AgentEvent.START, { context });
  }

  /**
   * Emit iteration event
   */
  emitIteration(context: AgentContext, iteration: number): void {
    this.emit(AgentEvent.ITERATION, { context, iteration });
  }

  /**
   * Emit tool call event
   */
  emitToolCall(context: AgentContext, toolCall: ToolCall): void {
    this.emit(AgentEvent.TOOL_CALL, { context, toolCall });
  }

  /**
   * Emit tool result event
   */
  emitToolResult(context: AgentContext, result: unknown, toolCallId: string): void {
    this.emit(AgentEvent.TOOL_RESULT, { context, result, toolCallId });
  }

  /**
   * Emit finish event
   */
  emitFinish(context: AgentContext, result: AgentResult): void {
    this.emit(AgentEvent.FINISH, { context, result });
  }

  /**
   * Emit error event
   */
  emitError(context: AgentContext, error: Error): void {
    this.emit(AgentEvent.ERROR, { context, error });
  }

  /**
   * Emit state change event
   */
  emitStateChange(context: AgentContext): void {
    this.emit(AgentEvent.STATE_CHANGE, { context });
  }
}

/**
 * Global event bus instance
 */
let globalEventBus: AgentEventEmitter | null = null;

/**
 * Get or create global event bus
 */
export function getGlobalEventBus(): AgentEventEmitter {
  if (!globalEventBus) {
    globalEventBus = new AgentEventEmitter();
  }
  return globalEventBus;
}

/**
 * Reset global event bus (for testing)
 */
export function resetGlobalEventBus(): void {
  globalEventBus = null;
}
