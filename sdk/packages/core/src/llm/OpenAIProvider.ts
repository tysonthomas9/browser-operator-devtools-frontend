/**
 * OpenAI provider implementation
 * Browser-compatible using fetch() API
 * Extracted from front_end/panels/ai_chat/LLM/OpenAIProvider.ts
 */

import { BaseLLMProvider } from './BaseProvider.js';
import type { LLMMessage, LLMCallOptions, LLMResponse, Tool } from './types.js';

export class OpenAIProvider extends BaseLLMProvider {
  name = 'openai' as const;

  private static readonly DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

  constructor(apiKey: string, endpoint?: string) {
    super(apiKey, endpoint || OpenAIProvider.DEFAULT_ENDPOINT);
  }

  async call(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const body: any = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice;
      }
    }

    const response = await this.makeRequest(this.endpoint!, body, options);
    const data = await response.json();

    return this.parseResponse(data);
  }

  async *stream(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): AsyncIterable<string> {
    const body: any = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const response = await this.makeRequest(this.endpoint!, body, options);
    yield* this.parseStream(response);
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
