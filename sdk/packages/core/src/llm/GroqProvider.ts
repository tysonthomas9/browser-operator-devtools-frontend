/**
 * Groq provider implementation
 * Browser-compatible using fetch() API
 * Groq uses OpenAI-compatible API format
 * https://console.groq.com/docs/api-reference
 */

import { BaseLLMProvider } from './BaseProvider.js';
import type { LLMMessage, LLMCallOptions, LLMResponse } from './types.js';

export class GroqProvider extends BaseLLMProvider {
  override name = 'groq' as const;

  private static readonly DEFAULT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(apiKey: string, endpoint?: string) {
    super(apiKey, endpoint || GroqProvider.DEFAULT_ENDPOINT);
  }

  async call(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const body: any = {
      model,
      messages: this.convertMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty,
    };

    if (options?.tools && options.tools.length > 0) {
      // Ensure all tools have valid parameters
      body.tools = options.tools.map((tool) => {
        if (tool.type === 'function' && tool.function) {
          return {
            ...tool,
            function: {
              ...tool.function,
              parameters: tool.function.parameters || { type: 'object', properties: {} },
            },
          };
        }
        return tool;
      });

      // Groq requires tool_choice to be set when tools are provided
      body.tool_choice = options.toolChoice || 'auto';
    }

    const response = await this.makeRequest(this.endpoint!, body, options);
    const data = await response.json();

    return this.parseResponse(data);
  }

  override async *stream(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): AsyncIterable<string> {
    const body: any = {
      model,
      messages: this.convertMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((tool) => {
        if (tool.type === 'function' && tool.function) {
          return {
            ...tool,
            function: {
              ...tool.function,
              parameters: tool.function.parameters || { type: 'object', properties: {} },
            },
          };
        }
        return tool;
      });
      body.tool_choice = options.toolChoice || 'auto';
    }

    const response = await this.makeRequest(this.endpoint!, body, options);
    yield* this.parseStream(response);
  }

  /**
   * Convert messages to Groq format
   * Ensures tool call arguments are strings and tool messages have string content
   */
  private convertMessages(messages: LLMMessage[]): any[] {
    return messages.map((msg) => {
      const baseMessage: any = {
        role: msg.role,
        content: msg.content,
      };

      // Handle tool calls - ensure arguments are strings
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        baseMessage.tool_calls = msg.tool_calls.map((tc) => {
          const args = (tc.function as any).arguments;
          const argsString = typeof args === 'string' ? args : JSON.stringify(args ?? {});
          return {
            ...tc,
            function: {
              ...tc.function,
              arguments: argsString,
            },
          };
        });
      }

      // Add optional fields
      if (msg.tool_call_id) {
        baseMessage.tool_call_id = msg.tool_call_id;
      }
      if (msg.name) {
        baseMessage.name = msg.name;
      }

      // For tool role, content must be a string
      if (msg.role === 'tool' && typeof baseMessage.content !== 'string') {
        baseMessage.content = JSON.stringify(baseMessage.content ?? '');
      }

      return baseMessage;
    });
  }

  protected extractStreamContent(chunk: any): string | null {
    return chunk.choices?.[0]?.delta?.content || null;
  }

  private parseResponse(data: any): LLMResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    const message = choice.message;
    const toolCalls = message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      text: message.content || '',
      toolCalls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  private mapFinishReason(
    reason: string
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
