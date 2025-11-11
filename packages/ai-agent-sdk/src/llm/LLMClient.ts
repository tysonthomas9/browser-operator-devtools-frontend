// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo, RetryConfig } from './LLMTypes.js';
import { LLMProviderRegistry } from './LLMProviderRegistry.js';
import { LLMResponseParser } from './LLMResponseParser.js';
import { createLogger } from '../observability/Logger.js';

const logger = createLogger('LLMClient');

/**
 * Configuration for individual LLM providers
 */
export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  providerURL?: string; // Optional: for LiteLLM endpoint or custom OpenAI endpoint
}

/**
 * Configuration for the LLM client
 */
export interface LLMClientConfig {
  providers: LLMProviderConfig[];
}

/**
 * Request structure for LLM calls
 */
export interface LLMCallRequest {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  systemPrompt: string;
  tools?: any[];
  temperature?: number;
  retryConfig?: Partial<RetryConfig>;
  agentName?: string; // Name of the calling agent for provider-specific routing
}

/**
 * Main LLM client coordinator that provides a unified interface for agents
 *
 * The LLMClient is a singleton that manages provider instances and routes
 * LLM calls to the appropriate provider based on configuration.
 *
 * @example
 * ```typescript
 * // Initialize the client with providers
 * const client = LLMClient.getInstance();
 * await client.initialize({
 *   providers: [
 *     { provider: 'openai', apiKey: 'sk-...' },
 *     { provider: 'litellm', apiKey: '', providerURL: 'http://localhost:4000' }
 *   ]
 * });
 *
 * // Make a call
 * const response = await client.call({
 *   provider: 'openai',
 *   model: 'gpt-4.1-2025-04-14',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   systemPrompt: 'You are a helpful assistant.',
 *   temperature: 0.7
 * });
 * ```
 */
export class LLMClient {
  private static instance: LLMClient | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): LLMClient {
    if (!LLMClient.instance) {
      LLMClient.instance = new LLMClient();
    }
    return LLMClient.instance;
  }

  /**
   * Initialize the LLM client with provider configurations
   *
   * This method must be called before making any LLM calls. It registers
   * the configured providers with the LLMProviderRegistry.
   *
   * @param config - Configuration specifying which providers to initialize
   */
  async initialize(config: LLMClientConfig): Promise<void> {
    logger.info('Initializing LLM client with providers:', config.providers.map(p => p.provider));

    // Clear existing providers
    LLMProviderRegistry.clear();

    // Register providers based on configuration
    for (const providerConfig of config.providers) {
      try {
        let providerInstance;

        // Dynamic imports to support optional providers
        switch (providerConfig.provider) {
          case 'openai': {
            const { OpenAIProvider } = await import('./OpenAIProvider.js');
            providerInstance = new OpenAIProvider(providerConfig.apiKey);
            break;
          }
          case 'litellm': {
            const { LiteLLMProvider } = await import('./LiteLLMProvider.js');
            providerInstance = new LiteLLMProvider(
              providerConfig.apiKey,
              providerConfig.providerURL
            );
            break;
          }
          case 'groq': {
            const { GroqProvider } = await import('./GroqProvider.js');
            providerInstance = new GroqProvider(providerConfig.apiKey);
            break;
          }
          case 'openrouter': {
            const { OpenRouterProvider } = await import('./OpenRouterProvider.js');
            providerInstance = new OpenRouterProvider(providerConfig.apiKey);
            break;
          }
          case 'browseroperator': {
            const { BrowserOperatorProvider } = await import('./BrowserOperatorProvider.js');
            providerInstance = new BrowserOperatorProvider(
              providerConfig.apiKey || null,
              providerConfig.providerURL  // Optional override for testing
            );
            break;
          }
          default:
            logger.warn(`Unknown provider type: ${providerConfig.provider}`);
            continue;
        }

        LLMProviderRegistry.registerProvider(providerConfig.provider, providerInstance);
        logger.info(`Registered ${providerConfig.provider} provider`);
      } catch (error) {
        logger.error(`Failed to initialize ${providerConfig.provider} provider:`, error);
      }
    }

    this.initialized = true;
    logger.info('LLM client initialization complete');
  }

  /**
   * Check if the client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LLMClient must be initialized before use. Call initialize() first.');
    }
  }

  /**
   * Main method for LLM calls with request object
   *
   * @param request - Complete request specification including provider, model, messages, etc.
   * @returns Promise resolving to the LLM response
   */
  async call(request: LLMCallRequest): Promise<LLMResponse> {
    this.ensureInitialized();

    const provider = LLMProviderRegistry.getProvider(request.provider);

    if (!provider) {
      throw new Error(`Provider ${request.provider} not available. Available providers: ${LLMProviderRegistry.getRegisteredProviders().join(', ')}`);
    }

    logger.debug(`Using ${request.provider} provider for model ${request.model}`);

    // Build messages array with required system prompt
    let messages = [...request.messages];

    // Add system prompt - always required
    const hasSystemMessage = messages.some(msg => msg.role === 'system');
    if (!hasSystemMessage) {
      messages.unshift({
        role: 'system',
        content: request.systemPrompt
      });
    }

    // Build options
    const options: LLMCallOptions = {};
    if (request.temperature !== undefined) {
      options.temperature = request.temperature;
    }
    if (request.tools) {
      options.tools = request.tools;
    }
    if (request.retryConfig) {
      options.retryConfig = request.retryConfig;
    }
    // Forward agent name for provider-specific routing
    if ((request as any).agentName) {
      options.agentName = (request as any).agentName;
    }

    return provider.callWithMessages(request.model, messages, options);
  }


  /**
   * Parse response into standardized action structure
   */
  parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse> {
    return LLMResponseParser.parseResponse(response);
  }

  /**
   * Get all available models from all providers
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    this.ensureInitialized();
    return LLMProviderRegistry.getAllModels();
  }

  /**
   * Get models for a specific provider
   */
  async getModelsByProvider(provider: LLMProvider): Promise<ModelInfo[]> {
    this.ensureInitialized();
    return LLMProviderRegistry.getModelsByProvider(provider);
  }

  /**
   * Test connection to a specific model
   */
  async testConnection(provider: LLMProvider, modelId: string): Promise<{success: boolean, message: string}> {
    this.ensureInitialized();

    const providerInstance = LLMProviderRegistry.getProvider(provider);

    if (!providerInstance) {
      return {
        success: false,
        message: `Provider ${provider} not available`
      };
    }

    if (providerInstance.testConnection) {
      return providerInstance.testConnection(modelId);
    }

    // Fallback test: simple call
    try {
      const response = await this.call({
        provider,
        model: modelId,
        messages: [{ role: 'user', content: 'Please respond with "OK" to test the connection.' }],
        systemPrompt: 'You are a helpful assistant for testing purposes.',
        temperature: 0.1
      });

      return {
        success: true,
        message: `Connected successfully. Response: ${response.text || 'No text response'}`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Refresh models for a specific provider or all providers
   */
  async refreshProviderModels(provider?: LLMProvider): Promise<void> {
    this.ensureInitialized();

    if (provider) {
      const providerInstance = LLMProviderRegistry.getProvider(provider);
      if (providerInstance) {
        try {
          await providerInstance.getModels();
          logger.info(`Refreshed models for ${provider} provider`);
        } catch (error) {
          logger.error(`Failed to refresh models for ${provider}:`, error);
        }
      }
    } else {
      // Refresh all providers
      const providers = LLMProviderRegistry.getRegisteredProviders();
      for (const providerType of providers) {
        await this.refreshProviderModels(providerType);
      }
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    initialized: boolean;
    providersCount: number;
    providers: LLMProvider[];
  } {
    const registryStats = LLMProviderRegistry.getStats();
    return {
      initialized: this.initialized,
      ...registryStats
    };
  }
}
