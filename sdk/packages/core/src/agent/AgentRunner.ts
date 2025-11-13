/**
 * AgentRunner - Advanced multi-iteration agent execution engine
 *
 * Provides enhanced error recovery, detailed session tracking, and progress events
 * for complex agentic workflows.
 */

import type {
  AgentRunnerConfig,
  RunOptions,
  RunResult,
  AgentSession,
  SessionMessage,
  ToolCallRecord,
  ToolResultRecord,
  ProgressEvent,
  InternalMessage,
  ParsedAction,
} from './runner-types.js';
import type { LLMMessage, LLMCallOptions } from '../llm/index.js';
import { executeToolCall, RuntimeContext, toolsToOpenAIFunctions } from '../tools/index.js';

/**
 * AgentRunner class for advanced multi-iteration agent execution
 */
export class AgentRunner {
  private config: AgentRunnerConfig;
  private runtimeContext: RuntimeContext;

  constructor(config: AgentRunnerConfig) {
    this.config = config;
    this.runtimeContext = new RuntimeContext(config.runtimeContext);
  }

  /**
   * Execute the agent with a user message
   */
  async run(input: string, options?: RunOptions): Promise<RunResult> {
    // Create session
    const session: AgentSession = {
      sessionId: options?.sessionId || this.generateSessionId(),
      status: 'running',
      startTime: new Date(),
      iterationCount: 0,
      messages: [],
      toolCalls: [],
      toolResults: [],
      model: this.config.model,
      maxIterations: options?.maxIterations ?? this.config.maxIterations ?? 10,
      metadata: this.config.metadata,
    };

    // Emit session started event
    this.emitProgress(options?.onProgress, {
      type: 'session_started',
      sessionId: session.sessionId,
      timestamp: new Date(),
      data: { session },
    });

    try {
      // Add user message
      const userMessage: SessionMessage = {
        id: this.generateMessageId(),
        role: 'user',
        content: input,
        timestamp: new Date(),
      };
      session.messages.push(userMessage);

      // Execute iterations
      const result = await this.executeIterations(session, options);

      // Complete session
      session.status = result.success ? 'completed' : 'error';
      session.endTime = new Date();

      // Emit session completed event
      this.emitProgress(options?.onProgress, {
        type: 'session_completed',
        sessionId: session.sessionId,
        timestamp: new Date(),
        data: { session, reason: session.terminationReason },
      });

      return { ...result, session };
    } catch (error) {
      // Handle unexpected errors
      session.status = 'error';
      session.endTime = new Date();
      session.terminationReason = 'error';

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit session completed event
      this.emitProgress(options?.onProgress, {
        type: 'session_completed',
        sessionId: session.sessionId,
        timestamp: new Date(),
        data: { session, reason: 'error', error: errorMessage },
      });

      return {
        success: false,
        error: errorMessage,
        session,
      };
    }
  }

  /**
   * Execute the multi-iteration loop
   */
  private async executeIterations(
    session: AgentSession,
    options?: RunOptions
  ): Promise<Omit<RunResult, 'session'>> {
    let iteration = 0;
    const maxIterations = session.maxIterations;
    const continueOnError = this.config.continueOnError ?? true;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Check for abort
      if (options?.abortSignal?.aborted) {
        session.terminationReason = 'aborted';
        return {
          success: false,
          error: 'Execution was cancelled',
        };
      }

      session.iterationCount = iteration + 1;

      // Emit iteration started event
      this.emitProgress(options?.onProgress, {
        type: 'iteration_started',
        sessionId: session.sessionId,
        timestamp: new Date(),
        data: { iteration: iteration + 1, maxIterations },
      });

      // Convert session messages to LLM format
      const llmMessages = this.convertToLLMMessages(session.messages);

      // Build tools for LLM
      const tools = this.config.tools ? this.buildToolsForLLM(this.config.tools) : undefined;

      // Call LLM
      let llmResponse;
      try {
        const llmOptions: LLMCallOptions = {
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          tools,
          abortSignal: options?.abortSignal,
        };

        llmResponse = await this.config.provider.call(
          this.config.model,
          llmMessages,
          llmOptions
        );
      } catch (error) {
        // LLM call failed
        const errorMessage = error instanceof Error ? error.message : String(error);
        session.terminationReason = 'error';
        return {
          success: false,
          error: `LLM call failed: ${errorMessage}`,
        };
      }

      // Parse LLM response
      const parsedAction = this.parseResponse(llmResponse);

      // Handle parsed action
      if (parsedAction.type === 'final_answer') {
        // Agent provided final answer
        const assistantMessage: SessionMessage = {
          id: this.generateMessageId(),
          role: 'assistant',
          content: parsedAction.answer,
          timestamp: new Date(),
          iteration: iteration + 1,
        };
        session.messages.push(assistantMessage);

        session.terminationReason = 'final_answer';
        return {
          success: true,
          output: parsedAction.answer,
          usage: llmResponse.usage,
        };
      } else if (parsedAction.type === 'tool_call') {
        // Agent wants to call a tool
        const { name: toolName, args: toolArgs, toolCallId } = parsedAction;

        // Record tool call
        const toolCallRecord: ToolCallRecord = {
          id: toolCallId,
          toolName,
          toolArgs,
          timestamp: new Date(),
          iteration: iteration + 1,
        };
        session.toolCalls.push(toolCallRecord);

        // Emit tool call event
        this.emitProgress(options?.onProgress, {
          type: 'tool_call',
          sessionId: session.sessionId,
          timestamp: new Date(),
          data: { toolCall: toolCallRecord },
        });

        // Add assistant message with tool call
        const assistantMessage: SessionMessage = {
          id: this.generateMessageId(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          iteration: iteration + 1,
          toolCalls: [toolCallRecord],
        };
        session.messages.push(assistantMessage);

        // Execute tool
        const toolStartTime = Date.now();
        let toolResult: ToolResultRecord;

        try {
          if (!this.config.tools || !this.config.tools[toolName]) {
            throw new Error(`Tool '${toolName}' not found`);
          }

          // Execute tool using tool system
          const result = await executeToolCall(
            this.config.tools,
            toolCallId,
            toolName,
            JSON.stringify(toolArgs),
            {
              runtimeContext: Object.fromEntries(
                this.runtimeContext.keys().map((k) => [k, this.runtimeContext.get(k)])
              ),
            }
          );

          // Create tool result record
          toolResult = {
            id: this.generateMessageId(),
            toolCallId,
            toolName,
            success: result.success,
            result: result.success ? this.parseToolResult(result.result) : undefined,
            error: !result.success ? (result.error || 'Tool execution failed') : undefined,
            timestamp: new Date(),
            iteration: iteration + 1,
            duration: Date.now() - toolStartTime,
          };
        } catch (error) {
          // Tool execution error
          const errorMessage = error instanceof Error ? error.message : String(error);

          toolResult = {
            id: this.generateMessageId(),
            toolCallId,
            toolName,
            success: false,
            error: errorMessage,
            timestamp: new Date(),
            iteration: iteration + 1,
            duration: Date.now() - toolStartTime,
          };
        }

        session.toolResults.push(toolResult);

        // Emit tool result event
        this.emitProgress(options?.onProgress, {
          type: 'tool_result',
          sessionId: session.sessionId,
          timestamp: new Date(),
          data: { toolResult },
        });

        // Add tool result message
        const toolMessage: SessionMessage = {
          id: this.generateMessageId(),
          role: 'tool',
          content: toolResult.success
            ? JSON.stringify(toolResult.result)
            : `Error: ${toolResult.error}`,
          timestamp: new Date(),
          iteration: iteration + 1,
          toolCallId,
        };
        session.messages.push(toolMessage);

        // Check if we should continue after error
        if (!toolResult.success && !continueOnError) {
          session.terminationReason = 'error';
          return {
            success: false,
            error: `Tool '${toolName}' failed: ${toolResult.error}`,
          };
        }

        // Continue to next iteration
        continue;
      } else if (parsedAction.type === 'error') {
        // Failed to parse response
        session.terminationReason = 'error';
        return {
          success: false,
          error: `Failed to parse LLM response: ${parsedAction.error}`,
        };
      }
    }

    // Reached max iterations
    session.terminationReason = 'max_iterations';
    return {
      success: false,
      error: `Agent reached maximum iterations (${maxIterations}) without providing a final answer`,
    };
  }

  /**
   * Convert session messages to LLM message format
   */
  private convertToLLMMessages(messages: SessionMessage[]): LLMMessage[] {
    const llmMessages: LLMMessage[] = [];

    // Add system message if instructions provided
    if (this.config.instructions) {
      llmMessages.push({
        role: 'system',
        content: this.config.instructions,
      });
    }

    // Convert session messages
    for (const msg of messages) {
      if (msg.role === 'user') {
        llmMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        const llmMsg: LLMMessage = {
          role: 'assistant',
          content: msg.content || '', // Empty string if no content
        };

        // Add tool calls if present
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          llmMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.toolName,
              arguments: JSON.stringify(tc.toolArgs),
            },
          }));
        }

        llmMessages.push(llmMsg);
      } else if (msg.role === 'tool') {
        llmMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId,
        });
      }
    }

    return llmMessages;
  }

  /**
   * Build tools for LLM in OpenAI format
   */
  private buildToolsForLLM(tools: Record<string, any>): any[] {
    const functionDefs = toolsToOpenAIFunctions(tools);
    return functionDefs.map((fn) => ({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));
  }

  /**
   * Parse LLM response into action
   */
  private parseResponse(response: any): ParsedAction {
    try {
      // Check for tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCall = response.toolCalls[0];
        return {
          type: 'tool_call',
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
          toolCallId: toolCall.id,
        };
      }

      // Check for text response
      if (response.text) {
        return {
          type: 'final_answer',
          answer: response.text,
        };
      }

      return {
        type: 'error',
        error: 'LLM response has no tool calls or text',
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Parse tool result (try JSON, fallback to string)
   */
  private parseToolResult(result: string): unknown {
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    callback: ((event: ProgressEvent) => void) | undefined,
    event: ProgressEvent
  ): void {
    if (callback) {
      try {
        callback(event);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentRunnerConfig {
    return { ...this.config };
  }
}
