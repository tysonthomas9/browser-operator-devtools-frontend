/**
 * Main Agent class
 * Extracted and adapted from front_end/panels/ai_chat/agent_framework/AgentRunner.ts
 */

import { generateText, streamText, type CoreMessage } from 'ai';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentState,
  ChatMessage,
  ChatMessageEntity,
  ExecutionOptions,
  ToolCall,
  ToolSet,
} from '../types/index.js';
import { AgentEventEmitter } from '../events/index.js';
import {
  createInitialState,
  createUserMessage,
  addMessage,
  setError,
  cloneState,
} from '../state/index.js';
import {
  executeOnStart,
  executeOnIteration,
  executeOnToolCall,
  executeOnToolResult,
  executeOnFinish,
  executeOnError,
} from '../hooks/index.js';

/**
 * Agent class for executing LLM-based agents with tools
 */
export class Agent<TTools extends ToolSet = ToolSet> {
  private config: AgentConfig<TTools>;
  private eventEmitter: AgentEventEmitter;
  private sessionId: string;

  constructor(config: AgentConfig<TTools>) {
    this.config = config;
    this.eventEmitter = new AgentEventEmitter();
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate text response
   */
  async generateText(
    input: string,
    options?: ExecutionOptions
  ): Promise<AgentResult> {
    const state = createInitialState();
    const context = this.createContext(state);

    try {
      // Execute onStart hook
      await executeOnStart(this.config.hooks, context);
      this.eventEmitter.emitStart(context);

      // Add user message
      const userMessage = createUserMessage(input, ChatMessageEntity.USER);
      context.state = addMessage(context.state, userMessage);

      // Convert messages to AI SDK format
      const messages = this.convertToAIMessages(context.state.messages);

      // Call LLM
      const result = await generateText({
        model: this.config.model,
        messages,
        tools: this.config.tools,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        maxSteps: options?.maxIterations ?? this.config.maxIterations ?? 10,
        abortSignal: options?.abortSignal,
        system: this.config.instructions,
      });

      // Process result
      const agentResult: AgentResult = {
        text: result.text,
        toolCalls: result.toolCalls?.map((tc) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          arguments: tc.args as Record<string, unknown>,
        })),
        finishReason: this.mapFinishReason(result.finishReason),
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
        state: context.state,
      };

      // Execute onFinish hook
      await executeOnFinish(this.config.hooks, context, agentResult);
      this.eventEmitter.emitFinish(context, agentResult);

      return agentResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.state = setError(context.state, err);

      await executeOnError(this.config.hooks, context, err);
      this.eventEmitter.emitError(context, err);

      throw err;
    }
  }

  /**
   * Stream text response
   */
  async streamText(
    input: string,
    options?: ExecutionOptions
  ): Promise<AsyncIterable<string>> {
    const state = createInitialState();
    const context = this.createContext(state);

    try {
      await executeOnStart(this.config.hooks, context);
      this.eventEmitter.emitStart(context);

      const userMessage = createUserMessage(input, ChatMessageEntity.USER);
      context.state = addMessage(context.state, userMessage);

      const messages = this.convertToAIMessages(context.state.messages);

      const result = await streamText({
        model: this.config.model,
        messages,
        tools: this.config.tools,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        maxSteps: options?.maxIterations ?? this.config.maxIterations ?? 10,
        abortSignal: options?.abortSignal,
        system: this.config.instructions,
      });

      return result.textStream;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.state = setError(context.state, err);

      await executeOnError(this.config.hooks, context, err);
      this.eventEmitter.emitError(context, err);

      throw err;
    }
  }

  /**
   * Subscribe to agent events
   */
  on<E extends keyof AgentEventMap>(
    event: E,
    handler: (payload: AgentEventMap[E]) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from agent events
   */
  off<E extends keyof AgentEventMap>(
    event: E,
    handler: (payload: AgentEventMap[E]) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig<TTools> {
    return { ...this.config };
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Create agent context
   */
  private createContext(state: AgentState): AgentContext {
    return {
      state: cloneState(state),
      config: this.config,
      sessionId: this.sessionId,
      variables: new Map(),
    };
  }

  /**
   * Convert chat messages to AI SDK format
   */
  private convertToAIMessages(messages: ChatMessage[]): CoreMessage[] {
    return messages
      .filter((msg) => msg.entity === ChatMessageEntity.USER || msg.entity === ChatMessageEntity.MODEL)
      .map((msg) => {
        if (msg.entity === ChatMessageEntity.USER) {
          return {
            role: 'user' as const,
            content: msg.text,
          };
        } else {
          return {
            role: 'assistant' as const,
            content: msg.text,
          };
        }
      });
  }

  /**
   * Map AI SDK finish reason to agent finish reason
   */
  private mapFinishReason(
    reason: string
  ): 'stop' | 'length' | 'tool-calls' | 'error' | 'max-iterations' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool-calls':
        return 'tool-calls';
      case 'error':
        return 'error';
      case 'max-steps':
        return 'max-iterations';
      default:
        return 'stop';
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Re-export types for convenience
import type { AgentEventMap } from '../events/index.js';
export type { AgentConfig, AgentResult, AgentContext, AgentState, ExecutionOptions };
