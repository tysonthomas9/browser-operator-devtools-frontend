import { I as ILLMProvider, L as LLMProvider, b as LLMCallOptions, a as LLMMessage, c as LLMResponse } from './types-SSahUagS.cjs';

/**
 * Base LLM provider implementation
 * Browser-compatible using fetch() API
 */

declare abstract class BaseLLMProvider implements ILLMProvider {
    abstract name: LLMProvider;
    protected apiKey: string;
    protected endpoint?: string;
    constructor(apiKey: string, endpoint?: string);
    /**
     * Make HTTP request with retry logic
     */
    protected makeRequest(url: string, body: any, options?: LLMCallOptions, additionalHeaders?: Record<string, string>): Promise<Response>;
    /**
     * Parse streaming response
     */
    protected parseStream(response: Response): AsyncIterable<string>;
    /**
     * Extract content from streaming chunk (provider-specific)
     */
    protected abstract extractStreamContent(chunk: any): string | null;
    /**
     * Call LLM (must be implemented by subclass)
     */
    abstract call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Stream LLM response (optional, provider-specific)
     */
    stream(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
}

/**
 * OpenAI provider implementation
 * Browser-compatible using fetch() API
 * Extracted from front_end/panels/ai_chat/LLM/OpenAIProvider.ts
 */

declare class OpenAIProvider extends BaseLLMProvider {
    name: "openai";
    private static readonly DEFAULT_ENDPOINT;
    constructor(apiKey: string, endpoint?: string);
    call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    stream(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
    protected extractStreamContent(chunk: any): string | null;
    private parseResponse;
    private mapFinishReason;
}

export { BaseLLMProvider as B, OpenAIProvider as O };
