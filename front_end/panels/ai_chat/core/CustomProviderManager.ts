// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from './Logger.js';

const logger = createLogger('CustomProviderManager');

/**
 * Configuration for a custom provider
 */
export interface CustomProviderConfig {
  id: string;           // Unique identifier (e.g., "custom:z-ai")
  name: string;         // Display name (e.g., "Z.AI")
  baseURL: string;      // Base URL (e.g., "https://api.z.ai/api/coding/paas/v4")
  models: string[];     // Available models
  enabled: boolean;     // Whether the provider is enabled
  createdAt: number;    // Timestamp when created
  updatedAt: number;    // Timestamp when last updated
}

/**
 * Manager for custom OpenAI-compatible providers
 * Handles CRUD operations and localStorage persistence
 */
export class CustomProviderManager {
  private static readonly STORAGE_KEY = 'ai_chat_custom_providers';
  private static readonly ID_PREFIX = 'custom:';

  /**
   * Generate a unique ID from a provider name
   */
  private static generateId(name: string): string {
    // Convert name to lowercase, replace spaces with hyphens, remove special chars
    const sanitized = name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `${CustomProviderManager.ID_PREFIX}${sanitized}`;
  }

  /**
   * Validate provider configuration
   */
  private static validateConfig(config: Partial<CustomProviderConfig>): {valid: boolean, errors: string[]} {
    const errors: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Provider name is required');
    }

    if (!config.baseURL || config.baseURL.trim().length === 0) {
      errors.push('Base URL is required');
    } else {
      // Validate URL format
      try {
        const url = new URL(config.baseURL);
        if (!url.protocol.startsWith('http')) {
          errors.push('Base URL must use HTTP or HTTPS protocol');
        }
      } catch (e) {
        errors.push('Base URL is not a valid URL');
      }
    }

    if (!config.models || config.models.length === 0) {
      errors.push('At least one model is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load all custom providers from localStorage
   */
  static loadProviders(): CustomProviderConfig[] {
    try {
      const stored = localStorage.getItem(CustomProviderManager.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const providers = JSON.parse(stored);
      if (!Array.isArray(providers)) {
        logger.error('Invalid custom providers data in localStorage');
        return [];
      }

      logger.debug('Loaded custom providers:', providers);
      return providers;
    } catch (error) {
      logger.error('Failed to load custom providers:', error);
      return [];
    }
  }

  /**
   * Save providers to localStorage
   */
  private static saveProviders(providers: CustomProviderConfig[]): void {
    try {
      localStorage.setItem(CustomProviderManager.STORAGE_KEY, JSON.stringify(providers));
      logger.debug('Saved custom providers:', providers);
    } catch (error) {
      logger.error('Failed to save custom providers:', error);
      throw new Error('Failed to save custom providers to storage');
    }
  }

  /**
   * Get a provider by ID
   */
  static getProvider(id: string): CustomProviderConfig | null {
    const providers = CustomProviderManager.loadProviders();
    return providers.find(p => p.id === id) || null;
  }

  /**
   * Get a provider by name
   */
  static getProviderByName(name: string): CustomProviderConfig | null {
    const providers = CustomProviderManager.loadProviders();
    return providers.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Check if a provider ID exists
   */
  static providerExists(id: string): boolean {
    return CustomProviderManager.getProvider(id) !== null;
  }

  /**
   * Check if a provider name exists
   */
  static providerNameExists(name: string, excludeId?: string): boolean {
    const providers = CustomProviderManager.loadProviders();
    return providers.some(p =>
      p.name.toLowerCase() === name.toLowerCase() &&
      p.id !== excludeId
    );
  }

  /**
   * Add a new custom provider
   */
  static addProvider(config: Omit<CustomProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): CustomProviderConfig {
    // Validate config
    const validation = CustomProviderManager.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
    }

    // Check if name already exists
    if (CustomProviderManager.providerNameExists(config.name)) {
      throw new Error(`A provider with the name "${config.name}" already exists`);
    }

    // Generate ID and timestamps
    const id = CustomProviderManager.generateId(config.name);
    const now = Date.now();

    const newProvider: CustomProviderConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Load existing providers and add new one
    const providers = CustomProviderManager.loadProviders();
    providers.push(newProvider);

    // Save back to localStorage
    CustomProviderManager.saveProviders(providers);

    logger.info('Added custom provider:', newProvider);
    return newProvider;
  }

  /**
   * Update an existing custom provider
   */
  static updateProvider(id: string, updates: Partial<Omit<CustomProviderConfig, 'id' | 'createdAt'>>): CustomProviderConfig {
    const providers = CustomProviderManager.loadProviders();
    const index = providers.findIndex(p => p.id === id);

    if (index === -1) {
      throw new Error(`Provider with ID "${id}" not found`);
    }

    const existingProvider = providers[index];

    // If name is being changed, check for conflicts
    if (updates.name && updates.name !== existingProvider.name) {
      if (CustomProviderManager.providerNameExists(updates.name, id)) {
        throw new Error(`A provider with the name "${updates.name}" already exists`);
      }
    }

    // Merge updates with existing provider
    const updatedProvider: CustomProviderConfig = {
      ...existingProvider,
      ...updates,
      id, // Preserve ID
      createdAt: existingProvider.createdAt, // Preserve creation time
      updatedAt: Date.now(),
    };

    // Validate the updated config
    const validation = CustomProviderManager.validateConfig(updatedProvider);
    if (!validation.valid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
    }

    // Update the provider in the array
    providers[index] = updatedProvider;

    // Save back to localStorage
    CustomProviderManager.saveProviders(providers);

    logger.info('Updated custom provider:', updatedProvider);
    return updatedProvider;
  }

  /**
   * Delete a custom provider
   */
  static deleteProvider(id: string): boolean {
    const providers = CustomProviderManager.loadProviders();
    const index = providers.findIndex(p => p.id === id);

    if (index === -1) {
      logger.warn(`Attempted to delete non-existent provider: ${id}`);
      return false;
    }

    // Remove the provider
    providers.splice(index, 1);

    // Save back to localStorage
    CustomProviderManager.saveProviders(providers);

    // Also clean up the API key from localStorage
    const apiKeyStorageKey = `ai_chat_custom_${id}_api_key`;
    localStorage.removeItem(apiKeyStorageKey);

    logger.info('Deleted custom provider:', id);
    return true;
  }

  /**
   * List all custom providers
   */
  static listProviders(): CustomProviderConfig[] {
    return CustomProviderManager.loadProviders();
  }

  /**
   * List all enabled custom providers
   */
  static listEnabledProviders(): CustomProviderConfig[] {
    return CustomProviderManager.loadProviders().filter(p => p.enabled);
  }

  /**
   * Enable or disable a provider
   */
  static setProviderEnabled(id: string, enabled: boolean): void {
    CustomProviderManager.updateProvider(id, { enabled });
  }

  /**
   * Check if a provider ID is a custom provider
   */
  static isCustomProvider(providerId: string): boolean {
    return providerId.startsWith(CustomProviderManager.ID_PREFIX);
  }

  /**
   * Clear all custom providers (mainly for testing/reset)
   */
  static clearAllProviders(): void {
    localStorage.removeItem(CustomProviderManager.STORAGE_KEY);

    // Also clean up all custom provider API keys
    const providers = CustomProviderManager.loadProviders();
    providers.forEach(provider => {
      const apiKeyStorageKey = `ai_chat_custom_${provider.id}_api_key`;
      localStorage.removeItem(apiKeyStorageKey);
    });

    logger.info('Cleared all custom providers');
  }

  /**
   * Get the storage key for a custom provider's API key
   */
  static getApiKeyStorageKey(providerId: string): string {
    return `ai_chat_custom_${providerId}_api_key`;
  }

  /**
   * Get the API key for a custom provider
   */
  static getApiKey(providerId: string): string | null {
    const key = CustomProviderManager.getApiKeyStorageKey(providerId);
    return localStorage.getItem(key);
  }

  /**
   * Set the API key for a custom provider
   */
  static setApiKey(providerId: string, apiKey: string): void {
    const key = CustomProviderManager.getApiKeyStorageKey(providerId);
    localStorage.setItem(key, apiKey);
  }
}
