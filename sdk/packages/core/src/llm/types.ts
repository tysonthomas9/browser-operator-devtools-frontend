/**
 * LLM types for browser-compatible implementation
 * Extracted from front_end/panels/ai_chat/LLM/LLMTypes.ts
 */

/**
 * LLM Provider types
 */
export type LLMProvider = 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'litellm' | 'custom';

/**
 * Message content types
 */
export type MessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

/**
 * LLM Message format
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * Tool call structure
 */
export interface ToolCall {
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
export interface OpenAITool {
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
export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  tools?: OpenAITool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * LLM response
 */
export interface LLMResponse {
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
export interface ModelInfo {
  id: string;
  name: string;
  provider: LLMProvider;
  contextWindow?: number;
  maxOutputTokens?: number;
}

/**
 * Base LLM provider interface
 */
export interface ILLMProvider {
  name: LLMProvider;

  /**
   * Call LLM with messages
   */
  call(model: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;

  /**
   * Stream LLM response
   */
  stream?(
    model: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): AsyncIterable<string>;

  /**
   * Get available models
   */
  getModels?(): Promise<ModelInfo[]>;
}

/**
 * Provider configuration
 */
export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  endpoint?: string;
}
