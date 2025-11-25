// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { LLMProviderInterface } from './LLMProvider.js';
import type { LLMProvider, ModelInfo } from './LLMTypes.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { LiteLLMProvider } from './LiteLLMProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { BrowserOperatorProvider } from './BrowserOperatorProvider.js';
import { CerebrasProvider } from './CerebrasProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GoogleAIProvider } from './GoogleAIProvider.js';

const logger = createLogger('LLMProviderRegistry');

/**
 * Registry for managing LLM providers with distributed model ownership
 */
export class LLMProviderRegistry {
  private static providers = new Map<LLMProvider, LLMProviderInterface>();

  /**
   * Register a provider instance
   */
  static registerProvider(providerType: LLMProvider, providerInstance: LLMProviderInterface): void {
    logger.info(`Registering provider: ${providerType}`);
    this.providers.set(providerType, providerInstance);
  }

  /**
   * Get a provider by type
   */
  static getProvider(providerType: LLMProvider): LLMProviderInterface | undefined {
    return this.providers.get(providerType);
  }

  /**
   * Check if a provider is registered
   */
  static hasProvider(providerType: LLMProvider): boolean {
    return this.providers.has(providerType);
  }

  /**
   * Get all models from all registered providers
   */
  static async getAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    
    for (const [providerType, provider] of this.providers.entries()) {
      try {
        const providerModels = await provider.getModels();
        allModels.push(...providerModels);
        logger.debug(`Got ${providerModels.length} models from ${providerType}`);
      } catch (error) {
        logger.warn(`Failed to get models from ${providerType}:`, error);
      }
    }
    
    logger.info(`Total models available: ${allModels.length}`);
    return allModels;
  }

  /**
   * Get models for a specific provider
   */
  static async getModelsByProvider(providerType: LLMProvider): Promise<ModelInfo[]> {
    const provider = this.getProvider(providerType);
    if (!provider) {
      logger.warn(`Provider ${providerType} not registered`);
      return [];
    }

    try {
      const models = await provider.getModels();
      logger.debug(`Got ${models.length} models from ${providerType}`);
      return models;
    } catch (error) {
      logger.error(`Failed to get models from ${providerType}:`, error);
      return [];
    }
  }

  /**
   * Get all registered provider types
   */
  static getRegisteredProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear all registrations (useful for testing)
   */
  static clear(): void {
    this.providers.clear();
    logger.info('LLM Provider Registry cleared');
  }

  /**
   * Get registry statistics
   */
  static getStats(): {
    providersCount: number;
    providers: LLMProvider[];
  } {
    return {
      providersCount: this.providers.size,
      providers: Array.from(this.providers.keys()),
    };
  }

  /**
   * Create a temporary provider instance for utility operations
   * Used when provider isn't registered yet (e.g., during setup/validation)
   */
  private static createTemporaryProvider(
    providerType: LLMProvider,
    apiKey: string = '',
    endpoint?: string
  ): LLMProviderInterface | null {
    try {
      switch (providerType) {
        case 'openai':
          return new OpenAIProvider(apiKey);
        case 'litellm':
          return new LiteLLMProvider(apiKey, endpoint || '');
        case 'groq':
          return new GroqProvider(apiKey);
        case 'openrouter':
          return new OpenRouterProvider(apiKey);
        case 'browseroperator':
          return new BrowserOperatorProvider(null, apiKey);
        case 'cerebras':
          return new CerebrasProvider(apiKey);
        case 'anthropic':
          return new AnthropicProvider(apiKey);
        case 'googleai':
          return new GoogleAIProvider(apiKey);
        default:
          logger.warn(`Unknown provider type: ${providerType}`);
          return null;
      }
    } catch (error) {
      logger.error(`Failed to create temporary provider ${providerType}:`, error);
      return null;
    }
  }

  /**
   * Get or create a provider instance for utility operations
   * Prefers registered instance, falls back to temporary instance
   * @param providerType The type of provider to get/create
   * @param apiKey Optional API key for temporary provider creation
   * @param endpoint Optional endpoint for temporary provider creation
   */
  private static getOrCreateProvider(
    providerType: LLMProvider,
    apiKey?: string,
    endpoint?: string
  ): LLMProviderInterface | null {
    // Try to get registered provider first
    const registered = this.getProvider(providerType);
    if (registered) {
      return registered;
    }

    // Fall back to creating temporary instance with provided credentials
    return this.createTemporaryProvider(providerType, apiKey || '', endpoint);
  }

  /**
   * Get storage keys for a provider
   * Returns the localStorage keys used by the provider for credentials
   */
  static getProviderStorageKeys(providerType: LLMProvider): {apiKey?: string; endpoint?: string; [key: string]: string | undefined} {
    const provider = this.getOrCreateProvider(providerType);
    if (!provider) {
      logger.warn(`Provider ${providerType} not available`);
      return {};
    }
    return provider.getCredentialStorageKeys();
  }

  /**
   * Get API key from localStorage for a provider
   */
  static getProviderApiKey(providerType: LLMProvider): string {
    const keys = this.getProviderStorageKeys(providerType);
    if (!keys.apiKey) {
      return '';
    }
    return localStorage.getItem(keys.apiKey) || '';
  }

  /**
   * Get endpoint from localStorage for a provider (if applicable)
   */
  static getProviderEndpoint(providerType: LLMProvider): string | undefined {
    const keys = this.getProviderStorageKeys(providerType);
    if (!keys.endpoint) {
      return undefined;
    }
    return localStorage.getItem(keys.endpoint) || undefined;
  }

  /**
   * Save API key for a provider to localStorage
   */
  static saveProviderApiKey(providerType: LLMProvider, apiKey: string | null): void {
    const keys = this.getProviderStorageKeys(providerType);
    if (!keys.apiKey) {
      logger.warn(`Provider ${providerType} does not have an API key storage key`);
      return;
    }

    if (apiKey) {
      localStorage.setItem(keys.apiKey, apiKey);
      logger.debug(`Saved API key for ${providerType}`);
    } else {
      localStorage.removeItem(keys.apiKey);
      logger.debug(`Removed API key for ${providerType}`);
    }
  }

  /**
   * Save endpoint for a provider to localStorage (if applicable)
   */
  static saveProviderEndpoint(providerType: LLMProvider, endpoint: string | null): void {
    const keys = this.getProviderStorageKeys(providerType);
    if (!keys.endpoint) {
      return; // Provider doesn't use endpoint
    }

    if (endpoint) {
      localStorage.setItem(keys.endpoint, endpoint);
      logger.debug(`Saved endpoint for ${providerType}`);
    } else {
      localStorage.removeItem(keys.endpoint);
      logger.debug(`Removed endpoint for ${providerType}`);
    }
  }

  /**
   * Validate credentials for a provider
   */
  static validateProviderCredentials(providerType: LLMProvider): {isValid: boolean; message: string; missingItems?: string[]} {
    const provider = this.getOrCreateProvider(providerType);
    if (!provider) {
      return {
        isValid: false,
        message: `Provider ${providerType} not available`,
        missingItems: ['Provider support']
      };
    }

    try {
      return provider.validateCredentials();
    } catch (error) {
      logger.error(`Failed to validate credentials for ${providerType}:`, error);
      return {
        isValid: false,
        message: `Validation failed: ${error}`,
      };
    }
  }

  /**
   * Get provider credentials from localStorage
   */
  static getProviderCredentials(providerType: LLMProvider): {
    canProceed: boolean;
    apiKey: string | null;
    endpoint?: string | null;
    storageKeys?: {apiKey?: string; endpoint?: string; [key: string]: string | undefined};
  } {
    // First validate credentials
    const validation = this.validateProviderCredentials(providerType);

    if (!validation.isValid) {
      return { canProceed: false, apiKey: null };
    }

    // Get storage keys
    const storageKeys = this.getProviderStorageKeys(providerType);

    // Retrieve credentials from localStorage
    const apiKey = storageKeys.apiKey ? (localStorage.getItem(storageKeys.apiKey) || null) : null;
    const endpoint = storageKeys.endpoint ? (localStorage.getItem(storageKeys.endpoint) || null) : null;

    return {
      canProceed: true,
      apiKey,
      endpoint,
      storageKeys
    };
  }

  /**
   * Fetch models for a provider
   * Uses registered provider or creates temporary instance with given credentials
   */
  static async fetchProviderModels(
    providerType: LLMProvider,
    apiKey: string,
    endpoint?: string
  ): Promise<ModelInfo[]> {
    // Get or create provider with provided credentials
    const provider = this.getOrCreateProvider(providerType, apiKey, endpoint);
    if (!provider) {
      logger.warn(`Provider ${providerType} not available`);
      return [];
    }

    try {
      // Use getModels() which returns standardized ModelInfo[] with 'id' property
      // The provider was created with the provided apiKey, so getModels() will use it
      return await provider.getModels();
    } catch (error) {
      logger.error(`Failed to fetch models for ${providerType}:`, error);
      throw error;
    }
  }

  /**
   * Test connection for a provider
   * Creates temporary instance with given credentials to test connection
   */
  static async testProviderConnection(
    providerType: LLMProvider,
    apiKey: string,
    endpoint?: string
  ): Promise<{success: boolean; message: string}> {
    try {
      // Try to fetch models as a connection test
      await this.fetchProviderModels(providerType, apiKey, endpoint);
      return {
        success: true,
        message: `Successfully connected to ${providerType}`
      };
    } catch (error) {
      logger.error(`Connection test failed for ${providerType}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
}