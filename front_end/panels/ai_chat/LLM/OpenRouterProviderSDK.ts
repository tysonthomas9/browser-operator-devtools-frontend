// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * OpenRouter Provider - SDK Adapter
 *
 * This is an adapter that wraps the Browser Operator SDK's OpenRouterProvider
 * to work with DevTools' LLMProviderInterface.
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('OpenRouterProvider');

/**
 * OpenRouter provider implementation using Browser Operator SDK
 * Provides access to 100+ models from various providers
 */
export class OpenRouterProvider extends LLMBaseProvider {
  readonly name: LLMProvider = 'openrouter';
  private sdkProvider: SDK.LLM.OpenRouterProvider;

  constructor(apiKey: string) {
    super();
    this.sdkProvider = new SDK.LLM.OpenRouterProvider(apiKey);
    logger.info('Initialized OpenRouter provider with SDK');
  }

  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    try {
      logger.debug(`Calling OpenRouter model ${modelName} with ${messages.length} messages`);

      const sdkMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content || '',
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
        name: msg.name,
      }));

      const sdkOptions: SDK.LLM.LLMCallOptions = {
        tools: options?.tools,
        toolChoice: options?.tool_choice,
        temperature: options?.temperature,
      };

      const sdkResponse = await this.sdkProvider.call(modelName, sdkMessages as SDK.LLM.LLMMessage[], sdkOptions);

      const devtoolsResponse: LLMResponse = {
        text: sdkResponse.content,
        functionCall: sdkResponse.tool_calls?.[0] ? {
          name: sdkResponse.tool_calls[0].function.name,
          arguments: JSON.parse(sdkResponse.tool_calls[0].function.arguments),
        } : undefined,
        rawResponse: sdkResponse,
      };

      return devtoolsResponse;
    } catch (error) {
      logger.error('OpenRouter call failed:', error);
      throw error;
    }
  }

  async call(
    modelName: string,
    prompt: string,
    systemPrompt: string,
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];
    return this.callWithMessages(modelName, messages, options);
  }

  async getModels(): Promise<ModelInfo[]> {
    // Return popular OpenRouter models
    return [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo (via OpenRouter)',
        provider: 'openrouter',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini Pro 1.5',
        provider: 'openrouter',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        provider: 'openrouter',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: true,
        },
      },
    ];
  }

  parseResponse(response: LLMResponse): any {
    if (response.functionCall) {
      return {
        action: response.functionCall.name,
        params: response.functionCall.arguments,
      };
    }
    return { text: response.text };
  }

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

  async validateCredentials(): Promise<{valid: boolean, message: string}> {
    try {
      await this.testConnection('anthropic/claude-3.5-sonnet');
      return { valid: true, message: 'Credentials valid' };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Invalid credentials'
      };
    }
  }
}
