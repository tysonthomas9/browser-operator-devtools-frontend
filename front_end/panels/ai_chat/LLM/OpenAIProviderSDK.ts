// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * OpenAI Provider - SDK Adapter
 *
 * This is an adapter that wraps the Browser Operator SDK's OpenAIProvider
 * to work with DevTools' LLMProviderInterface.
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('OpenAIProvider');

/**
 * OpenAI provider implementation using Browser Operator SDK
 */
export class OpenAIProvider extends LLMBaseProvider {
  readonly name: LLMProvider = 'openai';
  private sdkProvider: SDK.LLM.OpenAIProvider;

  constructor(apiKey: string) {
    super();
    this.sdkProvider = new SDK.LLM.OpenAIProvider(apiKey);
    logger.info('Initialized OpenAI provider with SDK');
  }

  /**
   * Execute a chat completion request with messages
   */
  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    try {
      logger.debug(`Calling OpenAI model ${modelName} with ${messages.length} messages`);

      // Convert DevTools messages to SDK format (they're already compatible)
      const sdkMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content || '',
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
        name: msg.name,
      }));

      // Convert DevTools options to SDK format
      const sdkOptions: SDK.LLM.LLMCallOptions = {
        tools: options?.tools,
        toolChoice: options?.tool_choice,
        temperature: options?.temperature,
        // Map other options as needed
      };

      // Call SDK provider
      const sdkResponse = await this.sdkProvider.call(modelName, sdkMessages as SDK.LLM.LLMMessage[], sdkOptions);

      // Convert SDK response to DevTools format
      const devtoolsResponse: LLMResponse = {
        text: sdkResponse.content,
        functionCall: sdkResponse.tool_calls?.[0] ? {
          name: sdkResponse.tool_calls[0].function.name,
          arguments: JSON.parse(sdkResponse.tool_calls[0].function.arguments),
        } : undefined,
        rawResponse: sdkResponse,
      };

      logger.debug('OpenAI call successful');
      return devtoolsResponse;
    } catch (error) {
      logger.error('OpenAI call failed:', error);
      throw error;
    }
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
    // Convert to messages format
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    return this.callWithMessages(modelName, messages, options);
  }

  /**
   * Get all models supported by OpenAI
   */
  async getModels(): Promise<ModelInfo[]> {
    // Return common OpenAI models
    // In production, this could fetch from API
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'o1',
        name: 'O1',
        provider: 'openai',
        capabilities: {
          functionCalling: false,
          reasoning: true,
          vision: false,
          structured: false,
        },
      },
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        provider: 'openai',
        capabilities: {
          functionCalling: false,
          reasoning: true,
          vision: false,
          structured: false,
        },
      },
    ];
  }

  /**
   * Parse response into standardized action structure
   */
  parseResponse(response: LLMResponse): any {
    if (response.functionCall) {
      return {
        action: response.functionCall.name,
        params: response.functionCall.arguments,
      };
    }

    return {
      text: response.text,
    };
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(modelId: string): Promise<{success: boolean, message: string}> {
    try {
      await this.callWithMessages(
        modelId,
        [{ role: 'user', content: 'test' }],
        { temperature: 0 }
      );
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Validate credentials
   */
  async validateCredentials(): Promise<{valid: boolean, message: string}> {
    if (!this.sdkProvider) {
      return { valid: false, message: 'API key not configured' };
    }

    try {
      await this.testConnection('gpt-4o-mini');
      return { valid: true, message: 'Credentials valid' };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Invalid credentials'
      };
    }
  }
}
