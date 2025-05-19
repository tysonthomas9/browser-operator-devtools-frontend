// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Types for LiteLLM API request and response
 */
export interface LiteLLMCallOptions {
  tools?: any[];
  tool_choice?: any;
  systemPrompt?: string;
  temperature?: number;
  endpoint?: string; // Full endpoint URL (e.g., http://localhost:4000/v1/chat/completions)
  baseUrl?: string; // Base URL only (e.g., http://localhost:4000 or https://your-cloud-litellm.com)
}

export interface LiteLLMResponse {
  text?: string;
  functionCall?: {
    name: string,
    arguments: any,
  };
  rawResponse: any;
}

/**
 * Types for LiteLLM models endpoint
 */
export interface LiteLLMModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

export interface LiteLLMModelsResponse {
  object: string;
  data: LiteLLMModel[];
}

/**
 * Standardized structure for parsed LLM action
 */
export type ParsedLLMAction =
  | { type: 'tool_call', name: string, args: Record<string, unknown> }
  | { type: 'final_answer', answer: string }
  | { type: 'error', error: string };

/**
 * LiteLLMClient class for making requests to LiteLLM API
 */
export class LiteLLMClient {
  /**
   * Default base URL for local LiteLLM proxy
   */
  private static DEFAULT_BASE_URL = 'http://localhost:4000';

  /**
   * Default endpoint path for chat completions
   */
  private static CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

  /**
   * Endpoint path for models list
   */
  private static MODELS_PATH = '/v1/models';

  /**
   * Constructs the full endpoint URL based on provided options
   */
  private static getEndpoint(options?: LiteLLMCallOptions): string {
    // If full endpoint is provided, check if it includes the chat completions path
    if (options?.endpoint) {
      // Check if the endpoint already includes the chat completions path
      if (options.endpoint.includes('/v1/chat/completions')) {
        return options.endpoint;
      }
      // If not, treat it as a base URL and append the path
      const baseUrl = options.endpoint.replace(/\/$/, '');
      console.log(`[LiteLLMClient] Endpoint missing chat completions path, appending: ${baseUrl}${this.CHAT_COMPLETIONS_PATH}`);
      return `${baseUrl}${this.CHAT_COMPLETIONS_PATH}`;
    }

    // If base URL is provided, append the path
    if (options?.baseUrl) {
      // Remove trailing slash from base URL if present
      const baseUrl = options.baseUrl.replace(/\/$/, '');
      return `${baseUrl}${this.CHAT_COMPLETIONS_PATH}`;
    }

    // Default to local LiteLLM
    return `${this.DEFAULT_BASE_URL}${this.CHAT_COMPLETIONS_PATH}`;
  }

  /**
   * Call the LiteLLM API with the provided parameters
   */
  static async callLiteLLM(
    apiKey: string | null,
    modelName: string,
    prompt: string,
    options?: LiteLLMCallOptions
  ): Promise<LiteLLMResponse> {
    console.log('LiteLLMClient: Calling LiteLLM...');
    console.log('Model:', modelName);
    console.log('Prompt:', prompt);

    // Use standard OpenAI chat completions format
    const messages = [];

    // Add system prompt if provided
    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: prompt
    });

    // Construct payload body in standard OpenAI format
    const payloadBody: any = {
      model: modelName,
      messages,
    };

    // Add temperature if provided
    if (options?.temperature !== undefined) {
      payloadBody.temperature = options.temperature;
    }

    // Add tools if provided
    if (options?.tools) {
      payloadBody.tools = options.tools;
    }

    // Add tool_choice if provided
    if (options?.tool_choice) {
      payloadBody.tool_choice = options.tool_choice;
    }

    console.log('Request payload:', payloadBody);

    try {
      const endpoint = this.getEndpoint(options);
      console.log('Using endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(payloadBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('LiteLLM API error:', errorData);
        throw new Error(`LiteLLM API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('LiteLLM Response:', data);

      if (data.usage) {
        console.log('LiteLLM Usage: Input tokens:', data.usage.prompt_tokens, 'Output tokens:', data.usage.completion_tokens);
      }

      // Process the response in standard OpenAI format
      const result: LiteLLMResponse = {
        rawResponse: data
      };

      if (!data?.choices || data.choices.length === 0) {
        throw new Error('No choices in LiteLLM response');
      }

      const choice = data.choices[0];
      const message = choice.message;

      if (!message) {
        throw new Error('No message in LiteLLM choice');
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
            console.error('Error parsing function arguments:', error);
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
    } catch (error) {
      console.error('LiteLLM API request failed:', error);
      throw error;
    }
  }

  /**
   * Fetch available models from LiteLLM endpoint
   */
  static async fetchModels(apiKey: string | null, baseUrl?: string): Promise<LiteLLMModel[]> {
    console.log('LiteLLMClient: Fetching available models...');

    try {
      // Construct models endpoint URL
      const baseEndpoint = baseUrl || this.DEFAULT_BASE_URL;
      const modelsUrl = `${baseEndpoint.replace(/\/$/, '')}${this.MODELS_PATH}`;
      console.log('Using models endpoint:', modelsUrl);

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('LiteLLM models API error:', errorData);
        throw new Error(`LiteLLM models API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data: LiteLLMModelsResponse = await response.json();
      console.log('LiteLLM Models Response:', data);

      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid models response format');
      }

      return data.data;
    } catch (error) {
      console.error('Failed to fetch LiteLLM models:', error);
      throw error;
    }
  }

  /**
   * Test the LiteLLM connection with a simple completion request
   */
  static async testConnection(apiKey: string | null, modelName: string, baseUrl?: string): Promise<{success: boolean, message: string}> {
    console.log('LiteLLMClient: Testing connection...');

    try {
      const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';

      const options: LiteLLMCallOptions = {
        temperature: 0.1,
        baseUrl,
      };

      const response = await this.callLiteLLM(apiKey, modelName, testPrompt, options);

      if (response.text?.toLowerCase().includes('connection')) {
        return {
          success: true,
          message: `Successfully connected to LiteLLM with model ${modelName}`,
        };
      }
      return {
        success: true,
        message: `Connected to LiteLLM, but received unexpected response: ${response.text || 'No response'}`,
      };
    } catch (error) {
      console.error('LiteLLM connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Parses the raw LiteLLM response into a standardized action structure
   */
  static parseLiteLLMResponse(response: LiteLLMResponse): ParsedLLMAction {
    if (response.functionCall) {
      return {
        type: 'tool_call',
        name: response.functionCall.name,
        args: response.functionCall.arguments || {},
      };
    } if (response.text) {
      const rawContent = response.text;
      // Attempt to parse text as JSON tool call (fallback for some models)
      if (rawContent.trim().startsWith('{') && rawContent.includes('"action":"tool"')) { // Heuristic
        try {
          const contentJson = JSON.parse(rawContent);
          if (contentJson.action === 'tool' && contentJson.toolName) {
            return {
              type: 'tool_call',
              name: contentJson.toolName,
              args: contentJson.toolArgs || {},
            };
          }
            // Fallback to treating it as text if JSON structure is not a valid tool call
            return { type: 'final_answer', answer: rawContent };

        } catch (e) {
          // If JSON parsing fails, treat it as plain text
          return { type: 'final_answer', answer: rawContent };
        }
      } else {
        // Treat as plain text final answer
        return { type: 'final_answer', answer: rawContent };
      }
    } else {
      // No function call or text found
      console.error('LiteLLMClient: LLM response had no function call or text.');
      return { type: 'error', error: 'LLM returned empty response.' };
    }
  }
}
