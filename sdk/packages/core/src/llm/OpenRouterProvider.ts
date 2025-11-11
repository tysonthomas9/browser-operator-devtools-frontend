/**
 * OpenRouter provider implementation
 * Browser-compatible using fetch() API
 * OpenRouter provides access to multiple LLM providers through a unified API
 * https://openrouter.ai/docs/api-reference
 */

import { BaseLLMProvider } from './BaseProvider.js';
import type { LLMMessage, LLMCallOptions, LLMResponse } from './types.js';

export class OpenRouterProvider extends BaseLLMProvider {
  override name = 'openrouter' as const;

  private static readonly DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(apiKey: string, endpoint?: string) {
    super(apiKey, endpoint || OpenRouterProvider.DEFAULT_ENDPOINT);
  }

  async call(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const body: any = {
      model,
      messages,
    };

    // Some models (like GPT-5, O3, O4) don't support temperature
    if (!this.shouldExcludeTemperature(model)) {
      body.temperature = options?.temperature ?? 0.7;
    }

    body.max_tokens = options?.maxTokens;
    body.top_p = options?.topP;
    body.frequency_penalty = options?.frequencyPenalty;
    body.presence_penalty = options?.presencePenalty;

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice;
      }
    }

    const response = await this.makeRequest(
      this.endpoint!,
      body,
      options,
      this.getOpenRouterHeaders()
    );
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
      messages,
      stream: true,
    };

    if (!this.shouldExcludeTemperature(model)) {
      body.temperature = options?.temperature ?? 0.7;
    }

    body.max_tokens = options?.maxTokens;

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const response = await this.makeRequest(
      this.endpoint!,
      body,
      options,
      this.getOpenRouterHeaders()
    );
    yield* this.parseStream(response);
  }

  /**
   * Get OpenRouter-specific headers
   */
  private getOpenRouterHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': 'https://browseroperator.io',
      'X-Title': 'Browser Operator',
    };
  }

  /**
   * Check if model doesn't support temperature parameter
   * Some OpenAI models accessed through OpenRouter don't support temperature
   */
  private shouldExcludeTemperature(model: string): boolean {
    const noTemperatureModels = ['openai/gpt-5', 'openai/o3', 'openai/o4'];
    return noTemperatureModels.some((pattern) => model.includes(pattern));
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
