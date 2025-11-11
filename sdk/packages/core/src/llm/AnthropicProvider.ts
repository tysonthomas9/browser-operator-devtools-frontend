/**
 * Anthropic provider implementation for Claude models
 * Browser-compatible using fetch() API
 * https://docs.anthropic.com/en/api/messages
 */

import { BaseLLMProvider } from './BaseProvider.js';
import type { LLMMessage, LLMCallOptions, LLMResponse } from './types.js';

export class AnthropicProvider extends BaseLLMProvider {
  override name = 'anthropic' as const;

  private static readonly DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
  private static readonly ANTHROPIC_VERSION = '2023-06-01';

  constructor(apiKey: string, endpoint?: string) {
    super(apiKey, endpoint || AnthropicProvider.DEFAULT_ENDPOINT);
  }

  async call(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    // Anthropic separates system messages from the messages array
    const { systemMessage, conversationMessages } = this.extractSystemMessage(messages);

    const body: any = {
      model,
      messages: this.convertToAnthropicFormat(conversationMessages),
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options?.topP !== undefined) {
      body.top_p = options.topP;
    }

    if (options?.tools && options.tools.length > 0) {
      body.tools = this.convertToolsToAnthropicFormat(options.tools);
    }

    const response = await this.makeRequest(
      this.endpoint!,
      body,
      options,
      this.getAnthropicHeaders()
    );
    const data = await response.json();

    return this.parseResponse(data);
  }

  override async *stream(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): AsyncIterable<string> {
    const { systemMessage, conversationMessages } = this.extractSystemMessage(messages);

    const body: any = {
      model,
      messages: this.convertToAnthropicFormat(conversationMessages),
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options?.tools && options.tools.length > 0) {
      body.tools = this.convertToolsToAnthropicFormat(options.tools);
    }

    const response = await this.makeRequest(
      this.endpoint!,
      body,
      options,
      this.getAnthropicHeaders()
    );

    // Anthropic uses a different streaming format
    yield* this.parseAnthropicStream(response);
  }

  /**
   * Get Anthropic-specific headers
   */
  private getAnthropicHeaders(): Record<string, string> {
    return {
      'anthropic-version': AnthropicProvider.ANTHROPIC_VERSION,
      'x-api-key': this.apiKey,
      'Authorization': '', // Remove Authorization header, Anthropic uses x-api-key
    };
  }

  /**
   * Extract system message from messages array
   * Anthropic requires system messages to be passed separately
   */
  private extractSystemMessage(messages: LLMMessage[]): {
    systemMessage?: string;
    conversationMessages: LLMMessage[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const systemMessage = systemMessages.map((m) => m.content).join('\n') || undefined;

    return { systemMessage, conversationMessages };
  }

  /**
   * Convert messages to Anthropic format
   */
  private convertToAnthropicFormat(messages: LLMMessage[]): any[] {
    return messages.map((msg) => {
      // Handle tool results
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || '',
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            },
          ],
        };
      }

      // Handle assistant messages with tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const content: any[] = [];

        // Add text content if present
        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content,
          });
        }

        // Add tool use blocks
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input:
              typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments,
          });
        }

        return {
          role: msg.role,
          content,
        };
      }

      // Regular message
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  /**
   * Convert OpenAI-style tools to Anthropic format
   */
  private convertToolsToAnthropicFormat(tools: any[]): any[] {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
  }

  /**
   * Parse Anthropic streaming response
   */
  private async *parseAnthropicStream(response: Response): AsyncIterable<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              // Anthropic streaming events
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                yield parsed.delta.text;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  protected extractStreamContent(chunk: any): string | null {
    // Not used for Anthropic (has custom streaming parser)
    return null;
  }

  private parseResponse(data: any): LLMResponse {
    if (data.type === 'error') {
      throw new Error(`Anthropic API error: ${data.error?.message || 'Unknown error'}`);
    }

    let text = '';
    const toolCalls: any[] = [];

    // Parse content blocks
    for (const block of data.content || []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapStopReason(data.stop_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  private mapStopReason(
    reason: string | undefined
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
