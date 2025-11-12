import { B as BaseLLMProvider } from '../OpenAIProvider-iNYdLE4U.js';
export { O as OpenAIProvider } from '../OpenAIProvider-iNYdLE4U.js';
import { a as LLMMessage, b as LLMCallOptions, c as LLMResponse } from '../types-SSahUagS.js';
export { I as ILLMProvider, L as LLMProvider, d as LLMProviderConfig, M as MessageContent, e as ModelInfo, O as OpenAITool, T as ToolCall } from '../types-SSahUagS.js';

/**
 * Anthropic provider implementation for Claude models
 * Browser-compatible using fetch() API
 * https://docs.anthropic.com/en/api/messages
 */

declare class AnthropicProvider extends BaseLLMProvider {
    name: "anthropic";
    private static readonly DEFAULT_ENDPOINT;
    private static readonly ANTHROPIC_VERSION;
    constructor(apiKey: string, endpoint?: string);
    call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    stream(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
    /**
     * Get Anthropic-specific headers
     */
    private getAnthropicHeaders;
    /**
     * Extract system message from messages array
     * Anthropic requires system messages to be passed separately
     */
    private extractSystemMessage;
    /**
     * Convert messages to Anthropic format
     */
    private convertToAnthropicFormat;
    /**
     * Convert OpenAI-style tools to Anthropic format
     */
    private convertToolsToAnthropicFormat;
    /**
     * Parse Anthropic streaming response
     */
    private parseAnthropicStream;
    protected extractStreamContent(chunk: any): string | null;
    private parseResponse;
    private mapStopReason;
}

/**
 * Groq provider implementation
 * Browser-compatible using fetch() API
 * Groq uses OpenAI-compatible API format
 * https://console.groq.com/docs/api-reference
 */

declare class GroqProvider extends BaseLLMProvider {
    name: "groq";
    private static readonly DEFAULT_ENDPOINT;
    constructor(apiKey: string, endpoint?: string);
    call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    stream(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
    /**
     * Convert messages to Groq format
     * Ensures tool call arguments are strings and tool messages have string content
     */
    private convertMessages;
    protected extractStreamContent(chunk: any): string | null;
    private parseResponse;
    private mapFinishReason;
}

/**
 * OpenRouter provider implementation
 * Browser-compatible using fetch() API
 * OpenRouter provides access to multiple LLM providers through a unified API
 * https://openrouter.ai/docs/api-reference
 */

declare class OpenRouterProvider extends BaseLLMProvider {
    name: "openrouter";
    private static readonly DEFAULT_ENDPOINT;
    constructor(apiKey: string, endpoint?: string);
    call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    stream(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
    /**
     * Get OpenRouter-specific headers
     */
    private getOpenRouterHeaders;
    /**
     * Check if model doesn't support temperature parameter
     * Some OpenAI models accessed through OpenRouter don't support temperature
     */
    private shouldExcludeTemperature;
    protected extractStreamContent(chunk: any): string | null;
    private parseResponse;
    private mapFinishReason;
}

/**
 * LiteLLM provider implementation
 * Browser-compatible using fetch() API
 * LiteLLM provides a proxy to access multiple LLM providers with OpenAI-compatible API
 * https://docs.litellm.ai/docs/
 */

declare class LiteLLMProvider extends BaseLLMProvider {
    name: "litellm";
    private static readonly DEFAULT_ENDPOINT;
    constructor(apiKey: string, endpoint?: string);
    call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    stream(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
    protected extractStreamContent(chunk: any): string | null;
    private parseResponse;
    private mapFinishReason;
}

export { AnthropicProvider, BaseLLMProvider, GroqProvider, LLMCallOptions, LLMMessage, LLMResponse, LiteLLMProvider, OpenRouterProvider };
