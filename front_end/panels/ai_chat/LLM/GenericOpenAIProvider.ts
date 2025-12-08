// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import { LLMRetryManager } from './LLMErrorHandler.js';
import { LLMResponseParser } from './LLMResponseParser.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('GenericOpenAIProvider');

/**
 * Generic OpenAI-compatible model information
 */
export interface GenericOpenAIModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  [key: string]: any;
}

export interface GenericOpenAIModelsResponse {
  object: string;
  data: GenericOpenAIModel[];
}

/**
 * Configuration for a custom provider instance
 */
export interface CustomProviderConfig {
  id: string;           // Unique identifier (e.g., "custom:z-ai")
  name: string;         // Display name (e.g., "Z.AI")
  baseURL: string;      // Base URL (e.g., "https://api.z.ai/api/coding/paas/v4")
  apiKey?: string;      // Optional API key
  models?: string[];    // Optional cached model list
}

/**
 * Generic OpenAI-compatible provider implementation
 * Works with any API that follows the OpenAI API format
 * https://platform.openai.com/docs/api-reference
 */
export class GenericOpenAIProvider extends LLMBaseProvider {
  private static readonly CHAT_COMPLETIONS_PATH = '/chat/completions';
  private static readonly MODELS_PATH = '/models';

  readonly name: LLMProvider;
  private readonly providerId: string;
  private readonly displayName: string;
  private readonly baseURL: string;

  constructor(config: CustomProviderConfig, apiKey?: string) {
    super();
    this.providerId = config.id;
    this.displayName = config.name;
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey || config.apiKey || '';
    // Use the provider ID as the name, but it will be treated as a custom provider
    this.name = this.providerId as LLMProvider;
  }

  private apiKey: string;

  /**
   * Get the provider's unique identifier
   */
  getProviderId(): string {
    return this.providerId;
  }

  /**
   * Get the provider's display name
   */
  getDisplayName(): string {
    return this.displayName;
  }

  /**
   * Get the chat completions endpoint URL
   */
  private getChatEndpoint(): string {
    return `${this.baseURL}${GenericOpenAIProvider.CHAT_COMPLETIONS_PATH}`;
  }

  /**
   * Get the models endpoint URL
   */
  private getModelsEndpoint(): string {
    return `${this.baseURL}${GenericOpenAIProvider.MODELS_PATH}`;
  }

  /**
   * Converts LLMMessage format to OpenAI format
   */
  private convertMessagesToOpenAI(messages: LLMMessage[]): any[] {
    return messages.map(msg => {
      const baseMessage: any = {
        role: msg.role,
        content: msg.content
      };

      // Ensure tool call arguments are strings per OpenAI spec
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        baseMessage.tool_calls = msg.tool_calls.map(tc => {
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

      // Add optional fields if present
      if (msg.tool_call_id) {
        baseMessage.tool_call_id = msg.tool_call_id;
      }
      if (msg.name) {
        baseMessage.name = msg.name;
      }

      // For tool role, content must be a string; stringify objects/arrays
      if (msg.role === 'tool') {
        if (typeof baseMessage.content !== 'string') {
          baseMessage.content = JSON.stringify(baseMessage.content ?? '');
        }
      }

      return baseMessage;
    });
  }

  /**
   * Makes a request to the OpenAI-compatible API
   */
  private async makeAPIRequest(endpoint: string, payloadBody: any): Promise<any> {
    try {
      logger.debug(`Making ${this.displayName} API request to:`, endpoint);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if API key is provided
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error(`${this.displayName} API error:`, JSON.stringify(errorData, null, 2));
        throw new Error(`${this.displayName} API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      logger.info(`${this.displayName} Response:`, data);

      if (data.usage) {
        logger.info(`${this.displayName} Usage:`, {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        });
      }

      return data;
    } catch (error) {
      logger.error(`${this.displayName} API request failed:`, error);
      throw error;
    }
  }

  /**
   * Processes the API response and converts to LLMResponse format
   */
  private processOpenAIResponse(data: any): LLMResponse {
    const result: LLMResponse = {
      rawResponse: data
    };

    if (!data?.choices || data.choices.length === 0) {
      throw new Error(`No choices in ${this.displayName} response`);
    }

    const choice = data.choices[0];
    const message = choice.message;

    if (!message) {
      throw new Error(`No message in ${this.displayName} choice`);
    }

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function) {
        try {
          result.functionCall = {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          };
        } catch (error) {
          logger.error('Error parsing function arguments:', error);
          result.functionCall = {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments // Keep as string if parsing fails
          };
        }
      }
    } else if (message.content) {
      // Plain text response
      result.text = message.content.trim();
    }

    return result;
  }

  /**
   * Call the API with messages
   */
  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    return LLMRetryManager.simpleRetry(async () => {
      logger.debug(`Calling ${this.displayName} with messages...`, { model: modelName, messageCount: messages.length });

      // Construct payload body in OpenAI Chat Completions format
      const payloadBody: any = {
        model: modelName,
        messages: this.convertMessagesToOpenAI(messages),
      };

      // Add temperature if provided
      if (options?.temperature !== undefined) {
        payloadBody.temperature = options.temperature;
      }

      // Add tools if provided
      if (options?.tools) {
        // Ensure all tools have valid parameters
        payloadBody.tools = options.tools.map(tool => {
          if (tool.type === 'function' && tool.function) {
            return {
              ...tool,
              function: {
                ...tool.function,
                parameters: tool.function.parameters || { type: 'object', properties: {} }
              }
            };
          }
          return tool;
        });
      }

      // Ensure tool_choice is set to 'auto' when tools are present unless explicitly provided
      if (options?.tools && !options?.tool_choice) {
        payloadBody.tool_choice = 'auto';
      } else if (options?.tool_choice) {
        payloadBody.tool_choice = options.tool_choice;
      }

      // Add structured output schema if provided (forces JSON response conforming to schema)
      if (options?.outputSchema) {
        payloadBody.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'agent_response',
            strict: true,
            schema: options.outputSchema
          }
        };
        logger.debug('Using structured output with schema:', options.outputSchema);
      }

      logger.info('Request payload:', payloadBody);

      const data = await this.makeAPIRequest(this.getChatEndpoint(), payloadBody);
      return this.processOpenAIResponse(data);
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
   * Fetch available models from the API
   */
  async fetchModels(): Promise<GenericOpenAIModel[]> {
    logger.debug(`Fetching available ${this.displayName} models...`);

    try {
      const headers: Record<string, string> = {};

      // Add Authorization header if API key is provided
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.getModelsEndpoint(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error(`${this.displayName} models API error:`, JSON.stringify(errorData, null, 2));
        throw new Error(`${this.displayName} models API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data: GenericOpenAIModelsResponse = await response.json();
      logger.debug(`${this.displayName} Models Response:`, data);

      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid models response format');
      }

      return data.data;
    } catch (error) {
      logger.error(`Failed to fetch ${this.displayName} models:`, error);
      throw error;
    }
  }

  /**
   * Get all models supported by this provider
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      // Fetch models from the API
      const apiModels = await this.fetchModels();

      return apiModels.map(model => ({
        id: model.id,
        name: model.id, // Use ID as name
        provider: this.providerId as LLMProvider,
        capabilities: {
          functionCalling: true, // Assume support, can be refined later
          reasoning: false,
          vision: false,
          structured: true
        }
      }));
    } catch (error) {
      logger.warn(`Failed to fetch models from ${this.displayName} API:`, error);
      throw error; // Rethrow so caller can handle
    }
  }

  /**
   * Test the connection with a simple completion request
   */
  async testConnection(modelName?: string): Promise<{success: boolean, message: string, models?: string[]}> {
    logger.debug(`Testing ${this.displayName} connection...`);

    try {
      // First, try to fetch models
      const models = await this.fetchModels();

      if (!models || models.length === 0) {
        return {
          success: false,
          message: 'Connection successful but no models found',
        };
      }

      // If no model specified, use the first available model
      const testModel = modelName || models[0].id;

      // Try a simple completion to verify the API works
      const testPrompt = 'Respond with "OK" to confirm connection.';
      const response = await this.call(testModel, testPrompt, '', {
        temperature: 0.1,
      });

      return {
        success: true,
        message: `Successfully connected to ${this.displayName}`,
        models: models.map(m => m.id),
      };
    } catch (error) {
      logger.error(`${this.displayName} connection test failed:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate that required credentials are available
   */
  validateCredentials(): {isValid: boolean, message: string, missingItems?: string[]} {
    // For custom providers, API key is optional (some APIs don't require auth)
    // Base URL is always required
    if (!this.baseURL) {
      return {
        isValid: false,
        message: `${this.displayName} base URL is required.`,
        missingItems: ['Base URL']
      };
    }

    return {
      isValid: true,
      message: `${this.displayName} credentials are configured correctly.`
    };
  }

  /**
   * Get the storage keys this provider uses for credentials
   */
  getCredentialStorageKeys(): {apiKey?: string, endpoint?: string} {
    return {
      apiKey: `ai_chat_custom_${this.providerId}_api_key`,
      endpoint: `ai_chat_custom_${this.providerId}_endpoint`
    };
  }
}
