// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Anthropic Provider - SDK Adapter
 *
 * This is an adapter that wraps the Browser Operator SDK's AnthropicProvider
 * to work with DevTools' LLMProviderInterface.
 *
 * This provider is NEW - it adds direct Claude support without OpenRouter!
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('AnthropicProvider');

/**
 * Anthropic provider implementation using Browser Operator SDK
 * Provides direct access to Claude models via Anthropic API
 */
export class AnthropicProvider extends LLMBaseProvider {
  readonly name: LLMProvider = 'anthropic';
  private sdkProvider: SDK.LLM.AnthropicProvider;

  constructor(apiKey: string) {
    super();
    this.sdkProvider = new SDK.LLM.AnthropicProvider(apiKey);
    logger.info('Initialized Anthropic provider with SDK');
  }

  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    try {
      logger.debug(`Calling Anthropic model ${modelName} with ${messages.length} messages`);

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
      logger.error('Anthropic call failed:', error);
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
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true,
        },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: true,
        },
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
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

  validateCredentials(): {isValid: boolean, message: string, missingItems?: string[]} {
    if (!this.sdkProvider) {
      return {
        isValid: false,
        message: 'Anthropic API key not configured',
        missingItems: ['API Key']
      };
    }
    return { isValid: true, message: 'Anthropic credentials configured' };
  }

  getCredentialStorageKeys(): {apiKey?: string} {
    return {
      apiKey: 'ai_chat_anthropic_api_key'
    };
  }
}
