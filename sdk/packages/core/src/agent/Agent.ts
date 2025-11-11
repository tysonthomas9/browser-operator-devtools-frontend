/**
 * Main Agent class - Browser-compatible
 * Extracted and adapted from front_end/panels/ai_chat/agent_framework/AgentRunner.ts
 */

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
import type { ILLMProvider, LLMMessage, LLMCallOptions } from '../llm/index.js';

/**
 * Agent class for executing LLM-based agents with tools
 * Browser-compatible - uses fetch() API
 */
export class Agent<TTools extends ToolSet = ToolSet> {
  private config: AgentConfig<TTools>;
  private eventEmitter: AgentEventEmitter;
  private sessionId: string;
  private provider: ILLMProvider;

  constructor(config: AgentConfig<TTools>, provider: ILLMProvider) {
    this.config = config;
    this.provider = provider;
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

      // Convert messages to LLM format
      const messages = this.convertToLLMMessages(context.state.messages);

      // Build tools
      const tools = this.config.tools ? this.convertToolsToLLMFormat(this.config.tools) : undefined;

      // Call LLM
      const llmOptions: LLMCallOptions = {
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        tools,
        abortSignal: options?.abortSignal,
      };

      const response = await this.provider.call(
        this.config.model,
        messages,
        llmOptions
      );

      // Process tool calls if present
      let finalResponse = response;
      let iteration = 0;
      const maxIterations = options?.maxIterations ?? this.config.maxIterations ?? 10;

      while (finalResponse.toolCalls && finalResponse.toolCalls.length > 0 && iteration < maxIterations) {
        iteration++;
        this.eventEmitter.emitIteration(context, iteration);

        // Execute tools
        for (const toolCall of finalResponse.toolCalls) {
          await executeOnToolCall(this.config.hooks, context, {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          });

          this.eventEmitter.emitToolCall(context, {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          });

          // Execute tool (stub for now - will be implemented with tool system)
          const result = await this.executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));

          await executeOnToolResult(this.config.hooks, context, result);
          this.eventEmitter.emitToolResult(context, result, toolCall.id);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });
        }

        // Call LLM again with tool results
        finalResponse = await this.provider.call(this.config.model, messages, llmOptions);
      }

      // Build agent result
      const agentResult: AgentResult = {
        text: finalResponse.text,
        toolCalls: finalResponse.toolCalls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        finishReason: this.mapFinishReason(finalResponse.finishReason, iteration >= maxIterations),
        usage: finalResponse.usage,
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
  async *streamText(
    input: string,
    options?: ExecutionOptions
  ): AsyncIterable<string> {
    const state = createInitialState();
    const context = this.createContext(state);

    try {
      await executeOnStart(this.config.hooks, context);
      this.eventEmitter.emitStart(context);

      const userMessage = createUserMessage(input, ChatMessageEntity.USER);
      context.state = addMessage(context.state, userMessage);

      const messages = this.convertToLLMMessages(context.state.messages);

      const llmOptions: LLMCallOptions = {
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        stream: true,
        abortSignal: options?.abortSignal,
      };

      if (!this.provider.stream) {
        throw new Error('Streaming not supported by this provider');
      }

      yield* this.provider.stream(this.config.model, messages, llmOptions);
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
   * Execute a tool (stub - will be implemented with tool system)
   */
  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement tool execution with tool registry
    console.warn(`Tool execution not yet implemented: ${name}`);
    return { error: 'Tool execution not implemented' };
  }

  /**
   * Convert tools to LLM format
   */
  private convertToolsToLLMFormat(tools: TTools): any[] {
    // TODO: Implement proper tool conversion
    return [];
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
   * Convert chat messages to LLM format
   */
  private convertToLLMMessages(messages: ChatMessage[]): LLMMessage[] {
    const llmMessages: LLMMessage[] = [];

    // Add system message if instructions provided
    if (this.config.instructions) {
      llmMessages.push({
        role: 'system',
        content: this.config.instructions,
      });
    }

    // Convert chat messages
    for (const msg of messages) {
      if (msg.entity === ChatMessageEntity.USER) {
        llmMessages.push({
          role: 'user',
          content: msg.text,
        });
      } else if (msg.entity === ChatMessageEntity.MODEL) {
        llmMessages.push({
          role: 'assistant',
          content: msg.text,
          tool_calls: msg.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        });
      }
    }

    return llmMessages;
  }

  /**
   * Map LLM finish reason to agent finish reason
   */
  private mapFinishReason(
    reason: string,
    reachedMaxIterations: boolean
  ): 'stop' | 'length' | 'tool-calls' | 'error' | 'max-iterations' {
    if (reachedMaxIterations) {
      return 'max-iterations';
    }

    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool-calls';
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
