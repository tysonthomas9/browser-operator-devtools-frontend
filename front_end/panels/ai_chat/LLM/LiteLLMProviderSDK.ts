// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * LiteLLM Provider - SDK Adapter
 *
 * This is an adapter that wraps the Browser Operator SDK's LiteLLMProvider
 * to work with DevTools' LLMProviderInterface.
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('LiteLLMProvider');

/**
 * LiteLLM provider implementation using Browser Operator SDK
 * Supports local/self-hosted models via LiteLLM proxy
 */
export class LiteLLMProvider extends LLMBaseProvider {
  readonly name: LLMProvider = 'litellm';
  private sdkProvider: SDK.LLM.LiteLLMProvider;

  constructor(endpoint?: string, apiKey?: string) {
    super();
    this.sdkProvider = new SDK.LLM.LiteLLMProvider(endpoint || 'http://localhost:4000', apiKey || '');
    logger.info(`Initialized LiteLLM provider with SDK (endpoint: ${endpoint || 'http://localhost:4000'})`);
  }

  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    try {
      logger.debug(`Calling LiteLLM model ${modelName} with ${messages.length} messages`);

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
      logger.error('LiteLLM call failed:', error);
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
    // LiteLLM proxies can host various models
    // Return common Ollama models as examples
    return [
      {
        id: 'llama3.2',
        name: 'Llama 3.2 (Local)',
        provider: 'litellm',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: false,
        },
      },
      {
        id: 'mistral',
        name: 'Mistral (Local)',
        provider: 'litellm',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: false,
        },
      },
      {
        id: 'codellama',
        name: 'Code Llama (Local)',
        provider: 'litellm',
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: false,
          structured: false,
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
    // LiteLLM often doesn't require credentials for local use
    return { isValid: true, message: 'LiteLLM proxy configured' };
  }

  getCredentialStorageKeys(): {apiKey?: string, endpoint?: string} {
    return {
      apiKey: 'ai_chat_litellm_api_key',
      endpoint: 'ai_chat_litellm_endpoint'
    };
  }
}
