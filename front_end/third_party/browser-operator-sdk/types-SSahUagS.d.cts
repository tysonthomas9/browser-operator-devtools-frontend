/**
 * LLM types for browser-compatible implementation
 * Extracted from front_end/panels/ai_chat/LLM/LLMTypes.ts
 */
/**
 * LLM Provider types
 */
type LLMProvider = 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'litellm' | 'custom';
/**
 * Message content types
 */
type MessageContent = string | Array<{
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
    };
}>;
/**
 * LLM Message format
 */
interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: MessageContent;
    name?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
}
/**
 * Tool call structure
 */
interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
/**
 * OpenAI tool definition (wire format for API)
 * For internal tool definitions, use @browser-operator/core/tools
 */
interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
    };
}
/**
 * LLM call options
 */
interface LLMCallOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    tools?: OpenAITool[];
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    stream?: boolean;
    abortSignal?: AbortSignal;
}
/**
 * LLM response
 */
interface LLMResponse {
    text: string;
    toolCalls?: ToolCall[];
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
/**
 * Model information
 */
interface ModelInfo {
    id: string;
    name: string;
    provider: LLMProvider;
    contextWindow?: number;
    maxOutputTokens?: number;
}
/**
 * Base LLM provider interface
 */
interface ILLMProvider {
    name: LLMProvider;
    /**
     * Call LLM with messages
     */
    call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Stream LLM response
     */
    stream?(model: string, messages: LLMMessage[], options?: LLMCallOptions): AsyncIterable<string>;
    /**
     * Get available models
     */
    getModels?(): Promise<ModelInfo[]>;
}
/**
 * Provider configuration
 */
interface LLMProviderConfig {
    provider: LLMProvider;
    apiKey: string;
    endpoint?: string;
}

export type { ILLMProvider as I, LLMProvider as L, MessageContent as M, OpenAITool as O, ToolCall as T, LLMMessage as a, LLMCallOptions as b, LLMResponse as c, LLMProviderConfig as d, ModelInfo as e };
