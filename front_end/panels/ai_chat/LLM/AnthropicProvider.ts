// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo, MessageContent } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import { LLMRetryManager } from './LLMErrorHandler.js';
import { LLMResponseParser } from './LLMResponseParser.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('AnthropicProvider');

/**
 * Anthropic provider implementation using the Messages API
 * https://docs.anthropic.com/en/api/messages
 */
export class AnthropicProvider extends LLMBaseProvider {
  private static readonly API_BASE_URL = 'https://api.anthropic.com/v1';
  private static readonly MESSAGES_PATH = '/messages';
  private static readonly MODELS_PATH = '/models';
  private static readonly API_VERSION = '2023-06-01';

  readonly name: LLMProvider = 'anthropic';

  constructor(private readonly apiKey: string) {
    super();
  }

  /**
   * Get the messages endpoint URL
   */
  private getMessagesEndpoint(): string {
    return `${AnthropicProvider.API_BASE_URL}${AnthropicProvider.MESSAGES_PATH}`;
  }

  /**
   * Get the models endpoint URL
   */
  private getModelsEndpoint(): string {
    return `${AnthropicProvider.API_BASE_URL}${AnthropicProvider.MODELS_PATH}`;
  }

  /**
   * Convert MessageContent to Anthropic format
   */
  private convertContentToAnthropic(content: MessageContent | undefined): any {
    if (!content) {
      return [];
    }

    if (typeof content === 'string') {
      return [{ type: 'text', text: content }];
    }

    if (Array.isArray(content)) {
      return content.map(item => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        } else if (item.type === 'image_url') {
          // Anthropic uses a different image format
          const url = item.image_url.url;
          if (url.startsWith('data:')) {
            // Extract mime type and base64 data
            const matches = url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: matches[1],
                  data: matches[2]
                }
              };
            }
          }
          // For URLs, Anthropic supports URL type
          return {
            type: 'image',
            source: {
              type: 'url',
              url: url
            }
          };
        }
        return { type: 'text', text: String(item) };
      });
    }

    return [{ type: 'text', text: String(content) }];
  }

  /**
   * Converts LLMMessage format to Anthropic Messages API format
   */
  private convertMessagesToAnthropic(messages: LLMMessage[]): { system?: string, messages: any[] } {
    let systemPrompt: string | undefined;
    const anthropicMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic uses a separate system parameter
        systemPrompt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        continue;
      }

      if (msg.role === 'user') {
        anthropicMessages.push({
          role: 'user',
          content: this.convertContentToAnthropic(msg.content)
        });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Convert tool calls to Anthropic format
          const toolUseBlocks = msg.tool_calls.map(tc => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments
          }));
          anthropicMessages.push({
            role: 'assistant',
            content: toolUseBlocks
          });
        } else {
          // Regular assistant message
          anthropicMessages.push({
            role: 'assistant',
            content: this.convertContentToAnthropic(msg.content)
          });
        }
      } else if (msg.role === 'tool') {
        // Tool result - Anthropic expects this in a user message with tool_result type
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }]
        });
      }
    }

    return { system: systemPrompt, messages: anthropicMessages };
  }

  /**
   * Convert OpenAI tool format to Anthropic tools format
   */
  private convertToolsToAnthropic(tools: any[]): any[] {
    return tools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          name: tool.function.name,
          description: tool.function.description || '',
          input_schema: tool.function.parameters || { type: 'object', properties: {} }
        };
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Makes a request to the Anthropic API
   */
  private async makeAPIRequest(endpoint: string, payloadBody: any, options?: { betaHeaders?: string[] }): Promise<any> {
    try {
      logger.debug('Making Anthropic API request to:', endpoint);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': AnthropicProvider.API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      };

      // Add beta headers if provided
      if (options?.betaHeaders && options.betaHeaders.length > 0) {
        headers['anthropic-beta'] = options.betaHeaders.join(',');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error('Anthropic API error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Anthropic API error: ${response.statusText} - ${errorData?.error?.message || errorData?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      logger.info('Anthropic Response:', data);

      if (data.usage) {
        logger.info('Anthropic Usage:', {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens
        });
      }

      return data;
    } catch (error) {
      logger.error('Anthropic API request failed:', error);
      throw error;
    }
  }

  /**
   * Processes the Anthropic response and converts to LLMResponse format
   */
  private processAnthropicResponse(data: any): LLMResponse {
    const result: LLMResponse = {
      rawResponse: data
    };

    if (!data?.content || data.content.length === 0) {
      throw new Error('No content in Anthropic response');
    }

    // Process content blocks
    for (const block of data.content) {
      if (block.type === 'text') {
        result.text = (result.text || '') + block.text;
      } else if (block.type === 'tool_use') {
        // First tool use becomes the function call
        if (!result.functionCall) {
          result.functionCall = {
            name: block.name,
            arguments: block.input || {}
          };
        }
      }
    }

    if (result.text) {
      result.text = result.text.trim();
    }

    return result;
  }

  /**
   * Call the Anthropic API with messages
   */
  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    return LLMRetryManager.simpleRetry(async () => {
      logger.debug('Calling Anthropic with messages...', { model: modelName, messageCount: messages.length });

      // Convert messages to Anthropic format
      const { system, messages: anthropicMessages } = this.convertMessagesToAnthropic(messages);

      // Construct payload body
      const payloadBody: any = {
        model: modelName,
        messages: anthropicMessages,
        max_tokens: 4096, // Required parameter for Anthropic
      };

      // Add system prompt if present
      if (system) {
        payloadBody.system = system;
      }

      // Add temperature if provided
      if (options?.temperature !== undefined) {
        payloadBody.temperature = options.temperature;
      }

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        payloadBody.tools = this.convertToolsToAnthropic(options.tools);
      }

      // Determine beta headers based on options
      const betaHeaders: string[] = [];
      // Add interleaved thinking if reasoning is requested
      if (options?.reasoningLevel) {
        betaHeaders.push('interleaved-thinking-2025-05-14');
      }

      logger.info('Request payload:', payloadBody);

      const data = await this.makeAPIRequest(
        this.getMessagesEndpoint(),
        payloadBody,
        { betaHeaders: betaHeaders.length > 0 ? betaHeaders : undefined }
      );
      return this.processAnthropicResponse(data);
    }, options?.retryConfig);
  }

  /**
   * Simple call method for backward compatibility
   */
  async call(
    modelName: string,
    prompt: string,
    systemPrompt: string,
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    return this.callWithMessages(modelName, messages, options);
  }

  /**
   * Parse response into standardized action structure
   */
  parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse> {
    return LLMResponseParser.parseResponse(response);
  }

  /**
   * Fetch available models from Anthropic API
   */
  async fetchModels(apiKey?: string, endpoint?: string): Promise<AnthropicModel[]> {
    logger.debug('Fetching available Anthropic models...');

    // Use provided apiKey if available, otherwise fall back to instance apiKey
    const keyToUse = apiKey || this.apiKey;

    try {
      const response = await fetch(this.getModelsEndpoint(), {
        method: 'GET',
        headers: {
          'x-api-key': keyToUse,
          'anthropic-version': AnthropicProvider.API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error('Anthropic models API error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Anthropic models API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data: AnthropicModelsResponse = await response.json();
      logger.debug('Anthropic Models Response:', data);

      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid models response format');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to fetch Anthropic models:', error);
      throw error;
    }
  }

  /**
   * Get all models supported by this provider
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      // Fetch models from Anthropic API
      const anthropicModels = await this.fetchModels();

      return anthropicModels.map(model => ({
        id: model.id,
        name: model.display_name || model.id,
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: this.modelSupportsFunctionCalling(model.id),
          reasoning: this.modelSupportsReasoning(model.id),
          vision: this.modelSupportsVision(model.id),
          structured: true, // All Anthropic models support structured outputs
        }
      }));
    } catch (error) {
      logger.warn('Failed to fetch models from API, falling back to default list:', error);
      // Fallback to hardcoded list if API call fails
      return this.getDefaultModels();
    }
  }

  /**
   * Check if a model supports function calling
   */
  private modelSupportsFunctionCalling(modelId: string): boolean {
    // All Claude 3+ models support function calling
    return modelId.includes('claude-3') || modelId.includes('claude-sonnet-4');
  }

  /**
   * Check if a model supports extended thinking/reasoning
   */
  private modelSupportsReasoning(modelId: string): boolean {
    // Claude Sonnet 4.5 and newer support extended thinking
    return modelId.includes('claude-sonnet-4.5') || modelId.includes('claude-sonnet-4-');
  }

  /**
   * Check if a model supports vision/image inputs
   */
  private modelSupportsVision(modelId: string): boolean {
    // Claude 3 Opus, Sonnet, and Haiku support vision
    // Claude Sonnet 4+ also supports vision
    return (modelId.includes('claude-3') && !modelId.includes('haiku')) ||
           modelId.includes('claude-sonnet-4');
  }

  /**
   * Get default list of known Anthropic models
   */
  private getDefaultModels(): ModelInfo[] {
    return [
      {
        id: 'claude-sonnet-4.5-20250514',
        name: 'Claude Sonnet 4.5',
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: true,
          vision: true,
          structured: true
        }
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: true,
          vision: true,
          structured: true
        }
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: true,
          vision: true,
          structured: true
        }
      },
      {
        id: 'claude-haiku-4-20250514',
        name: 'Claude Haiku 4',
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true
        }
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (Legacy)',
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true
        }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: true
        }
      }
    ];
  }

  /**
   * Test the Anthropic connection with a simple completion request
   */
  async testConnection(modelName: string): Promise<{success: boolean, message: string}> {
    logger.debug('Testing Anthropic connection...');

    try {
      const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';

      const response = await this.call(modelName, testPrompt, '', {
        temperature: 0.1,
      });

      if (response.text?.toLowerCase().includes('connection')) {
        return {
          success: true,
          message: `Successfully connected to Anthropic with model ${modelName}`,
        };
      }
      return {
        success: true,
        message: `Connected to Anthropic, but received unexpected response: ${response.text || 'No response'}`,
      };
    } catch (error) {
      logger.error('Anthropic connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate that required credentials are available for Anthropic
   */
  validateCredentials(): {isValid: boolean, message: string, missingItems?: string[]} {
    const storageKeys = this.getCredentialStorageKeys();
    const apiKey = localStorage.getItem(storageKeys.apiKey!);

    if (!apiKey) {
      return {
        isValid: false,
        message: 'Anthropic API key is required. Please add your API key in Settings.',
        missingItems: ['API Key']
      };
    }

    return {
      isValid: true,
      message: 'Anthropic credentials are configured correctly.'
    };
  }

  /**
   * Get the storage keys this provider uses for credentials
   */
  getCredentialStorageKeys(): {apiKey: string} {
    return {
      apiKey: 'ai_chat_anthropic_api_key'
    };
  }
}

/**
 * Anthropic model object from the /v1/models API
 */
interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
  type: 'model';
}

/**
 * Response from Anthropic /v1/models endpoint
 */
interface AnthropicModelsResponse {
  data: AnthropicModel[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}
