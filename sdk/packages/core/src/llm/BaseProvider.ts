/**
 * Base LLM provider implementation
 * Browser-compatible using fetch() API
 */

import type { ILLMProvider, LLMProvider, LLMMessage, LLMCallOptions, LLMResponse } from './types.js';

export abstract class BaseLLMProvider implements ILLMProvider {
  abstract name: LLMProvider;

  protected apiKey: string;
  protected endpoint?: string;

  constructor(apiKey: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest(
    url: string,
    body: any,
    options?: LLMCallOptions,
    additionalHeaders?: Record<string, string>
  ): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...additionalHeaders,
      },
      body: JSON.stringify(body),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} - ${errorText}`
      );
    }

    return response;
  }

  /**
   * Parse streaming response
   */
  protected async *parseStream(response: Response): AsyncIterable<string> {
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
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = this.extractStreamContent(parsed);
              if (content) {
                yield content;
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

  /**
   * Extract content from streaming chunk (provider-specific)
   */
  protected abstract extractStreamContent(chunk: any): string | null;

  /**
   * Call LLM (must be implemented by subclass)
   */
  abstract call(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse>;

  /**
   * Stream LLM response (optional, provider-specific)
   */
  async *stream(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): AsyncIterable<string> {
    throw new Error('Streaming not implemented for this provider');
  }
}
