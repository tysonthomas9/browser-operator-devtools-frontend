// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo, MessageContent } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import { LLMRetryManager } from './LLMErrorHandler.js';
import { LLMResponseParser } from './LLMResponseParser.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('GoogleAIProvider');

/**
 * Google AI model information
 */
export interface GoogleAIModel {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
}

export interface GoogleAIModelsResponse {
  models: GoogleAIModel[];
}

/**
 * Google AI Provider implementation using Gemini API
 * https://ai.google.dev/gemini-api/docs
 */
export class GoogleAIProvider extends LLMBaseProvider {
  private static readonly API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  readonly name: LLMProvider = 'googleai';

  constructor(private readonly apiKey: string) {
    super();
  }

  /**
   * Get the generate content endpoint URL for a specific model
   */
  private getGenerateContentEndpoint(modelName: string): string {
    // Model name format: "models/gemini-2.5-pro" or just "gemini-2.5-pro"
    const normalizedModel = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
    return `${GoogleAIProvider.API_BASE_URL}/${normalizedModel}:generateContent?key=${this.apiKey}`;
  }

  /**
   * Get the models list endpoint URL
   */
  private getModelsEndpoint(): string {
    return `${GoogleAIProvider.API_BASE_URL}/models?key=${this.apiKey}`;
  }

  /**
   * Convert MessageContent to Google AI format
   */
  private convertContentToGoogleAI(content: MessageContent | undefined): any {
    if (!content) {
      return { text: '' };
    }

    if (typeof content === 'string') {
      return { text: content };
    }

    if (Array.isArray(content)) {
      // Convert multimodal content
      return content.map(item => {
        if (item.type === 'text') {
          return { text: item.text };
        } else if (item.type === 'image_url') {
          // Google AI uses inline_data for images
          const url = item.image_url.url;
          if (url.startsWith('data:')) {
            // Extract mime type and base64 data
            const matches = url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              return {
                inline_data: {
                  mime_type: matches[1],
                  data: matches[2]
                }
              };
            }
          }
          // For URLs, Google AI expects blob_uri (not supported in all cases)
          logger.warn('Image URLs are not fully supported, use base64 data URLs instead');
          return { text: '[Image URL not supported in this format]' };
        }
        return { text: String(item) };
      });
    }

    return { text: String(content) };
  }

  /**
   * Converts LLMMessage format to Google AI contents format
   */
  private convertMessagesToGoogleAI(messages: LLMMessage[]): { contents: any[], tools?: any[] } {
    const contents: any[] = [];
    let systemInstruction: string | undefined;

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Google AI uses systemInstruction separately
        systemInstruction = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        continue;
      }

      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: Array.isArray(this.convertContentToGoogleAI(msg.content))
            ? this.convertContentToGoogleAI(msg.content)
            : [this.convertContentToGoogleAI(msg.content)]
        });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Convert tool calls
          const functionCalls = msg.tool_calls.map(tc => ({
            functionCall: {
              name: tc.function.name,
              args: typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments
            }
          }));
          contents.push({
            role: 'model',
            parts: functionCalls
          });
        } else {
          // Regular assistant message
          contents.push({
            role: 'model',
            parts: Array.isArray(this.convertContentToGoogleAI(msg.content))
              ? this.convertContentToGoogleAI(msg.content)
              : [this.convertContentToGoogleAI(msg.content)]
          });
        }
      } else if (msg.role === 'tool') {
        // Tool response
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || 'unknown_function',
              response: {
                result: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
              }
            }
          }]
        });
      }
    }

    // Add system instruction as the first message if present
    if (systemInstruction) {
      contents.unshift({
        role: 'user',
        parts: [{ text: systemInstruction }]
      });
    }

    return { contents };
  }

  /**
   * Convert OpenAI tool format to Google AI function declarations
   */
  private convertToolsToGoogleAI(tools: any[]): any {
    const functionDeclarations = tools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: tool.function.parameters || { type: 'object', properties: {} }
        };
      }
      return null;
    }).filter(Boolean);

    return functionDeclarations.length > 0 ? [{
      function_declarations: functionDeclarations
    }] : undefined;
  }

  /**
   * Makes a request to the Google AI API
   */
  private async makeAPIRequest(endpoint: string, payloadBody: any): Promise<any> {
    try {
      logger.debug('Making Google AI API request to:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error('Google AI API error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Google AI API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      logger.info('Google AI Response:', data);

      if (data.usageMetadata) {
        logger.info('Google AI Usage:', {
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount
        });
      }

      return data;
    } catch (error) {
      logger.error('Google AI API request failed:', error);
      throw error;
    }
  }

  /**
   * Processes the Google AI response and converts to LLMResponse format
   */
  private processGoogleAIResponse(data: any): LLMResponse {
    const result: LLMResponse = {
      rawResponse: data
    };

    if (!data?.candidates || data.candidates.length === 0) {
      throw new Error('No candidates in Google AI response');
    }

    const candidate = data.candidates[0];
    const content = candidate.content;

    if (!content || !content.parts || content.parts.length === 0) {
      throw new Error('No content parts in Google AI candidate');
    }

    const part = content.parts[0];

    // Check for function call
    if (part.functionCall) {
      result.functionCall = {
        name: part.functionCall.name,
        arguments: part.functionCall.args || {}
      };
    } else if (part.text) {
      // Plain text response
      result.text = part.text.trim();
    }

    return result;
  }

  /**
   * Call the Google AI API with messages
   */
  async callWithMessages(
    modelName: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    return LLMRetryManager.simpleRetry(async () => {
      logger.debug('Calling Google AI with messages...', { model: modelName, messageCount: messages.length });

      // Convert messages to Google AI format
      const { contents } = this.convertMessagesToGoogleAI(messages);

      // Construct payload body
      const payloadBody: any = {
        contents,
      };

      // Add generation config
      const generationConfig: any = {};
      if (options?.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
      }
      if (Object.keys(generationConfig).length > 0) {
        payloadBody.generationConfig = generationConfig;
      }

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        const tools = this.convertToolsToGoogleAI(options.tools);
        if (tools) {
          payloadBody.tools = tools;
        }
      }

      logger.info('Request payload:', payloadBody);

      const data = await this.makeAPIRequest(
        this.getGenerateContentEndpoint(modelName),
        payloadBody
      );
      return this.processGoogleAIResponse(data);
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
   * Fetch available models from Google AI API
   */
  async fetchModels(): Promise<GoogleAIModel[]> {
    logger.debug('Fetching available Google AI models...');

    try {
      const response = await fetch(this.getModelsEndpoint(), {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        logger.error('Google AI models API error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Google AI models API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data: GoogleAIModelsResponse = await response.json();
      logger.debug('Google AI Models Response:', data);

      if (!data?.models || !Array.isArray(data.models)) {
        throw new Error('Invalid models response format');
      }

      // Filter to only models that support generateContent
      return data.models.filter(model =>
        model.supportedGenerationMethods &&
        model.supportedGenerationMethods.includes('generateContent')
      );
    } catch (error) {
      logger.error('Failed to fetch Google AI models:', error);
      throw error;
    }
  }

  /**
   * Get all models supported by this provider
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      // Fetch models from Google AI API
      const googleModels = await this.fetchModels();

      return googleModels.map(model => {
        // Extract simple model ID from full name (e.g., "models/gemini-2.5-pro" -> "gemini-2.5-pro")
        const modelId = model.name.replace('models/', '');

        return {
          id: modelId,
          name: model.displayName || modelId,
          provider: 'googleai' as LLMProvider,
          capabilities: {
            functionCalling: this.modelSupportsFunctionCalling(modelId),
            reasoning: this.modelSupportsReasoning(modelId),
            vision: this.modelSupportsVision(modelId),
            structured: true
          }
        };
      });
    } catch (error) {
      logger.warn('Failed to fetch models from Google AI API, using default list:', error);

      // Return default list of known Google AI models as fallback
      return this.getDefaultModels();
    }
  }

  /**
   * Check if a model supports function calling based on its ID
   */
  private modelSupportsFunctionCalling(modelId: string): boolean {
    // Most Gemini models support function calling
    return modelId.includes('gemini');
  }

  /**
   * Check if a model supports reasoning based on its ID
   */
  private modelSupportsReasoning(modelId: string): boolean {
    // Gemini 2.5 Pro and later support thinking mode
    return modelId.includes('gemini-2.5') || modelId.includes('gemini-2.0');
  }

  /**
   * Check if a model supports vision based on its ID
   */
  private modelSupportsVision(modelId: string): boolean {
    // Most Gemini models support vision except for text-only variants
    return modelId.includes('gemini') && !modelId.includes('text');
  }

  /**
   * Get default list of known Google AI models
   */
  private getDefaultModels(): ModelInfo[] {
    return [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'googleai' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: true,
          vision: true,
          structured: true
        }
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'googleai' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: true,
          vision: true,
          structured: true
        }
      },
      {
        id: 'gemini-2.5-nano',
        name: 'Gemini 2.5 Nano',
        provider: 'googleai' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: false,
          vision: true,
          structured: true
        }
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'googleai' as LLMProvider,
        capabilities: {
          functionCalling: true,
          reasoning: true,
          vision: true,
          structured: true
        }
      }
    ];
  }

  /**
   * Test the Google AI connection with a simple completion request
   */
  async testConnection(modelName: string): Promise<{success: boolean, message: string}> {
    logger.debug('Testing Google AI connection...');

    try {
      const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';

      const response = await this.call(modelName, testPrompt, '', {
        temperature: 0.1,
      });

      if (response.text?.toLowerCase().includes('connection')) {
        return {
          success: true,
          message: `Successfully connected to Google AI with model ${modelName}`,
        };
      }
      return {
        success: true,
        message: `Connected to Google AI, but received unexpected response: ${response.text || 'No response'}`,
      };
    } catch (error) {
      logger.error('Google AI connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate that required credentials are available for Google AI
   */
  validateCredentials(): {isValid: boolean, message: string, missingItems?: string[]} {
    const storageKeys = this.getCredentialStorageKeys();
    const apiKey = localStorage.getItem(storageKeys.apiKey!);

    if (!apiKey) {
      return {
        isValid: false,
        message: 'Google AI API key is required. Please add your API key in Settings.',
        missingItems: ['API Key']
      };
    }

    return {
      isValid: true,
      message: 'Google AI credentials are configured correctly.'
    };
  }

  /**
   * Get the storage keys this provider uses for credentials
   */
  getCredentialStorageKeys(): {apiKey: string} {
    return {
      apiKey: 'ai_chat_googleai_api_key'
    };
  }
}
