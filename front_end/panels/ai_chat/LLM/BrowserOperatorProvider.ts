// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import { LLMRetryManager } from './LLMErrorHandler.js';
import { LLMResponseParser } from './LLMResponseParser.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('BrowserOperatorProvider');

/**
 * BrowserOperator provider implementation
 *
 * Connects to the BrowserOperator API server which acts as a unified proxy
 * for multiple LLM providers (OpenAI, Cerebras, Groq).
 *
 * Features:
 * - Agent-based semantic routing via X-Agent header
 * - Model abstraction using main/mini/nano aliases
 * - Built-in retry and fallback handled by API server
 * - OpenAI-compatible API
 */
export class BrowserOperatorProvider extends LLMBaseProvider {
  private static readonly DEFAULT_BASE_URL = 'https://api.browseroperator.io/v1';
  private static readonly CHAT_COMPLETIONS_PATH = '/chat/completions';
  private static readonly HEALTH_PATH = '/health';

  readonly name: LLMProvider = 'browseroperator';

  constructor(
    private readonly apiKey: string | null,
    private readonly baseUrl?: string  // Optional override for testing only
  ) {
    super();
  }

  /**
   * Constructs the full endpoint URL - hardcoded to localhost
   */
  private getEndpoint(): string {
    // Use provided baseUrl only for testing, otherwise use hardcoded default
    const baseUrl = this.baseUrl || BrowserOperatorProvider.DEFAULT_BASE_URL;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    return `${cleanBaseUrl}${BrowserOperatorProvider.CHAT_COMPLETIONS_PATH}`;
  }

  /**
   * Gets the health check endpoint URL
   */
  private getHealthEndpoint(): string {
    const baseUrl = this.baseUrl || BrowserOperatorProvider.DEFAULT_BASE_URL;
    const cleanUrl = baseUrl.replace(/\/v1\/?$/, '');
    return `${cleanUrl}${BrowserOperatorProvider.HEALTH_PATH}`;
  }

  /**
   * Converts LLMMessage format to OpenAI-compatible format
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
   * Makes a request to the BrowserOperator API server
   */
  private async makeAPIRequest(payloadBody: any, agentName?: string): Promise<any> {
    try {
      const endpoint = this.getEndpoint();

      // Use agent name directly from calling agent, fallback to 'default'
      const selectedAgent = agentName || 'default';

      logger.info('=== BrowserOperator API Request ===');
      logger.info('Endpoint:', endpoint);
      logger.info('Agent (X-Agent header):', selectedAgent);
      logger.info('Model:', payloadBody.model);
      logger.info('Message count:', payloadBody.messages?.length || 0);
      logger.info('Has tools:', !!payloadBody.tools);
      logger.info('Temperature:', payloadBody.temperature);

      // Log full request payload (useful for debugging)
      logger.debug('Full request payload:', JSON.stringify(payloadBody, null, 2));

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Agent': selectedAgent,
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      };

      logger.debug('Request headers:', requestHeaders);

      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payloadBody),
      });
      const duration = Date.now() - startTime;

      logger.info(`Response status: ${response.status} ${response.statusText}`);
      logger.info(`Response time: ${duration}ms`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error('=== BrowserOperator API Error ===');
        logger.error(`Status: ${response.status} ${response.statusText}`);
        logger.error('Error data: ' + JSON.stringify(errorData, null, 2));
        throw new Error(`BrowserOperator API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      logger.info('=== BrowserOperator API Response ===');
      logger.info('Response time:', `${duration}ms`);
      logger.info('Choices count:', data.choices?.length || 0);

      if (data.usage) {
        logger.info('Token usage:', {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens
        });
      }

      // Log first choice content preview
      if (data.choices?.[0]) {
        const firstChoice = data.choices[0];
        if (firstChoice.message?.content) {
          const contentPreview = firstChoice.message.content.substring(0, 200);
          logger.info('Response preview:', contentPreview + (firstChoice.message.content.length > 200 ? '...' : ''));
        }
        if (firstChoice.message?.tool_calls) {
          logger.info('Tool calls:', firstChoice.message.tool_calls.length);
        }
      }

      // Log full response in debug mode
      logger.debug('Full response:', JSON.stringify(data, null, 2));

      return data;
    } catch (error) {
      logger.error('=== BrowserOperator API Request Failed ===');
      logger.error('Error:', error);
      throw error;
    }
  }

  /**
   * Processes the BrowserOperator response and converts to LLMResponse format
   */
  private processBrowserOperatorResponse(data: any): LLMResponse {
    const result: LLMResponse = {
      rawResponse: data
    };

    if (!data?.choices || data.choices.length === 0) {
      throw new Error('No choices in BrowserOperator response');
    }

    const choice = data.choices[0];
    const message = choice.message;

    if (!message) {
      throw new Error('No message in BrowserOperator choice');
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
   * Call the BrowserOperator API with messages
   */
  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    return LLMRetryManager.simpleRetry(async () => {
      logger.debug('Calling BrowserOperator with messages...', { model: modelName, messageCount: messages.length });

      // Construct payload body in OpenAI Chat Completions format
      const payloadBody: any = {
        model: modelName, // Use model alias (main/mini/nano)
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

      logger.info('Request payload:', payloadBody);

      // Extract agent name from options (set by AgentRunner)
      const agentName = options?.agentName;

      const data = await this.makeAPIRequest(payloadBody, agentName);
      return this.processBrowserOperatorResponse(data);
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
   * Get all models supported by this provider
   * Returns static list of model aliases - API server handles provider-specific mapping
   */
  async getModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'main',
        name: 'Auto',
        provider: 'browseroperator' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: true
        }
      },
      {
        id: 'mini',
        name: 'Auto',
        provider: 'browseroperator' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: true
        }
      },
      {
        id: 'nano',
        name: 'Auto',
        provider: 'browseroperator' as LLMProvider,
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
   * Test the BrowserOperator connection with a health check
   */
  async testConnection(modelName: string): Promise<{success: boolean, message: string}> {
    logger.debug('Testing BrowserOperator connection...');

    try {
      const healthUrl = this.getHealthEndpoint();
      logger.debug('Health check URL:', healthUrl);

      const response = await fetch(healthUrl);

      if (!response.ok) {
        return {
          success: false,
          message: `Health check failed: ${response.statusText}`
        };
      }

      const data = await response.json();

      // Also test a simple chat completion
      const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';
      const testResponse = await this.call(modelName, testPrompt, '', {
        temperature: 0.1,
      });

      if (testResponse.text?.toLowerCase().includes('connection')) {
        return {
          success: true,
          message: `Successfully connected to BrowserOperator API server. Health: ${data.status}`,
        };
      }
      return {
        success: true,
        message: `Connected to BrowserOperator, but received unexpected response: ${testResponse.text || 'No response'}`,
      };
    } catch (error) {
      logger.error('BrowserOperator connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate that required credentials are available for BrowserOperator
   * No credentials needed - endpoint is hardcoded
   */
  validateCredentials(): {isValid: boolean, message: string, missingItems?: string[]} {
    return {
      isValid: true,
      message: `BrowserOperator configured with endpoint: ${BrowserOperatorProvider.DEFAULT_BASE_URL}. Agent routing is automatic.`
    };
  }

  /**
   * Get the storage keys this provider uses for credentials
   * Returns empty object since endpoint and agent are hardcoded/automatic
   */
  getCredentialStorageKeys(): {apiKey?: string} {
    return {
      apiKey: 'ai_chat_browseroperator_api_key' // Optional API key for authentication
    };
  }
}
