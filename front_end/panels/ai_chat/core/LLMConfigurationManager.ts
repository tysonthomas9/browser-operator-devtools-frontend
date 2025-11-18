// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
// Cache break: 2025-09-18T19:00:00Z - Add skipCredentialChecks + preserve credentials + secure logging

import { createLogger } from './Logger.js';
import type { LLMProvider } from '../LLM/LLMTypes.js';
import { isCustomProvider } from '../LLM/LLMTypes.js';
import { LLMProviderRegistry } from '../LLM/LLMProviderRegistry.js';
import { CustomProviderManager } from './CustomProviderManager.js';

const logger = createLogger('LLMConfigurationManager');

/**
 * Configuration interface for LLM settings
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  endpoint?: string; // For LiteLLM
  mainModel: string;
  miniModel?: string;
  nanoModel?: string;
  systemPrompt?: string; // For conversation state override
}

/**
 * Local storage keys for LLM configuration
 */
const STORAGE_KEYS = {
  PROVIDER: 'ai_chat_provider',
  MODEL_SELECTION: 'ai_chat_model_selection',
  MINI_MODEL: 'ai_chat_mini_model',
  NANO_MODEL: 'ai_chat_nano_model',
  OPENAI_API_KEY: 'ai_chat_api_key',
  LITELLM_ENDPOINT: 'ai_chat_litellm_endpoint',
  LITELLM_API_KEY: 'ai_chat_litellm_api_key',
  GROQ_API_KEY: 'ai_chat_groq_api_key',
  OPENROUTER_API_KEY: 'ai_chat_openrouter_api_key',
  BROWSEROPERATOR_API_KEY: 'ai_chat_browseroperator_api_key',
} as const;

/**
 * Centralized LLM configuration manager with override capabilities.
 * Supports both manual mode (localStorage-based) and automated mode (override-based).
 */
export class LLMConfigurationManager {
  private static instance: LLMConfigurationManager;
  private overrideConfig?: Partial<LLMConfig>; // Override for automated mode
  private changeListeners: Array<() => void> = [];

  private constructor() {
    // Listen for localStorage changes from other tabs (manual mode)
    window.addEventListener('storage', this.handleStorageChange.bind(this));
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): LLMConfigurationManager {
    if (!LLMConfigurationManager.instance) {
      LLMConfigurationManager.instance = new LLMConfigurationManager();
    }
    return LLMConfigurationManager.instance;
  }

  /**
   * Get the current provider with override fallback
   */
  getProvider(): LLMProvider {
    if (this.overrideConfig?.provider) {
      return this.overrideConfig.provider;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER);
    return (stored as LLMProvider) || 'openai';
  }

  /**
   * Get the main model with override fallback
   */
  getMainModel(): string {
    if (this.overrideConfig?.mainModel) {
      return this.overrideConfig.mainModel;
    }
    return localStorage.getItem(STORAGE_KEYS.MODEL_SELECTION) || '';
  }

  /**
   * Get the mini model with override fallback
   */
  getMiniModel(): string {
    if (this.overrideConfig?.miniModel) {
      return this.overrideConfig.miniModel;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.MINI_MODEL) || '';
    // Fallback to mainModel if mini is not set
    if (!stored) {
      return this.getMainModel();
    }
    return stored;
  }

  /**
   * Get the nano model with override fallback
   */
  getNanoModel(): string {
    if (this.overrideConfig?.nanoModel) {
      return this.overrideConfig.nanoModel;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.NANO_MODEL) || '';
    // Fallback to miniModel, then mainModel if nano is not set
    if (!stored) {
      return this.getMiniModel() || this.getMainModel();
    }
    return stored;
  }

  /**
   * Get the API key for the current provider with override fallback
   */
  getApiKey(): string {
    if (this.overrideConfig?.apiKey) {
      return this.overrideConfig.apiKey;
    }

    const provider = this.getProvider();
    return LLMProviderRegistry.getProviderApiKey(provider);
  }

  /**
   * Get the endpoint (primarily for LiteLLM) with override fallback
   */
  getEndpoint(): string | undefined {
    if (this.overrideConfig?.endpoint) {
      return this.overrideConfig.endpoint;
    }

    const provider = this.getProvider();
    return LLMProviderRegistry.getProviderEndpoint(provider);
  }

  /**
   * Get the complete current configuration
   */
  getConfiguration(): LLMConfig {
    return {
      provider: this.getProvider(),
      apiKey: this.getApiKey(),
      endpoint: this.getEndpoint(),
      mainModel: this.getMainModel(),
      miniModel: this.getMiniModel(),
      nanoModel: this.getNanoModel(),
      systemPrompt: this.overrideConfig?.systemPrompt,
    };
  }

  /**
   * Set override configuration (for automated mode per-request overrides)
   */
  setOverride(config: Partial<LLMConfig>): void {
    logger.info('Setting configuration override', {
      provider: config.provider,
      mainModel: config.mainModel,
      hasApiKey: !!config.apiKey,
      hasEndpoint: !!config.endpoint
    });

    this.overrideConfig = { ...config };
    this.notifyListeners();
  }

  /**
   * Clear override configuration
   */
  clearOverride(): void {
    if (this.overrideConfig) {
      logger.info('Clearing configuration override');
      this.overrideConfig = undefined;
      this.notifyListeners();
    }
  }

  /**
   * Check if override is currently active
   */
  hasOverride(): boolean {
    return !!this.overrideConfig;
  }

  /**
   * Save configuration to localStorage (for manual mode and persistent automated mode)
   */
  saveConfiguration(config: LLMConfig): void {
    logger.info('Saving configuration to localStorage', {
      provider: config.provider,
      mainModel: config.mainModel,
      hasApiKey: !!config.apiKey,
      hasEndpoint: !!config.endpoint
    });

    // Save provider
    localStorage.setItem(STORAGE_KEYS.PROVIDER, config.provider);

    // Save models
    localStorage.setItem(STORAGE_KEYS.MODEL_SELECTION, config.mainModel);
    if (config.miniModel) {
      localStorage.setItem(STORAGE_KEYS.MINI_MODEL, config.miniModel);
    } else {
      localStorage.removeItem(STORAGE_KEYS.MINI_MODEL);
    }
    if (config.nanoModel) {
      localStorage.setItem(STORAGE_KEYS.NANO_MODEL, config.nanoModel);
    } else {
      localStorage.removeItem(STORAGE_KEYS.NANO_MODEL);
    }

    // Save provider-specific settings
    this.saveProviderSpecificSettings(config);

    // Notify listeners of configuration change
    this.notifyListeners();
  }

  /**
   * Apply partial configuration updates (merges with existing configuration)
   */
  applyPartialConfiguration(partial: Partial<LLMConfig>): void {
    const current = this.loadConfiguration();

    // Merge configurations, preserving existing values where partial doesn't provide them
    const merged: LLMConfig = {
      provider: partial.provider ?? current.provider,
      mainModel: partial.mainModel ?? current.mainModel,
      miniModel: partial.miniModel ?? current.miniModel,
      nanoModel: partial.nanoModel ?? current.nanoModel,
      apiKey: partial.apiKey ?? current.apiKey,
      endpoint: partial.endpoint ?? current.endpoint,
    };

    logger.info('Applying partial configuration update', {
      current: {
        provider: current.provider,
        mainModel: current.mainModel,
        hasApiKey: !!current.apiKey
      },
      partial: {
        provider: partial.provider,
        mainModel: partial.mainModel,
        hasApiKey: !!partial.apiKey
      },
      merged: {
        provider: merged.provider,
        mainModel: merged.mainModel,
        hasApiKey: !!merged.apiKey
      }
    });

    // Save the merged configuration
    this.saveConfiguration(merged);
  }

  /**
   * Load configuration from localStorage
   */
  loadConfiguration(): LLMConfig {
    return {
      provider: this.getProvider(),
      apiKey: this.getApiKey(),
      endpoint: this.getEndpoint(),
      mainModel: this.getMainModel(),
      miniModel: this.getMiniModel(),
      nanoModel: this.getNanoModel(),
    };
  }

  /**
   * Add a listener for configuration changes
   */
  addChangeListener(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove a configuration change listener
   */
  removeChangeListener(listener: () => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Validate the current configuration
   * @param skipCredentialChecks When true, bypasses API key/endpoint validation for AUTOMATED_MODE
   */
  validateConfiguration(skipCredentialChecks = false): { isValid: boolean; errors: string[] } {
    const config = this.getConfiguration();
    const errors: string[] = [];

    // Check provider
    if (!config.provider) {
      errors.push('Provider is required');
    }

    // Check main model
    if (!config.mainModel) {
      errors.push('Main model is required');
    }

    // Provider-specific validation - skip credential checks in AUTOMATED_MODE
    if (!skipCredentialChecks && config.provider) {
      // Check if it's a custom provider
      if (isCustomProvider(config.provider)) {
        const customProvider = CustomProviderManager.getProvider(config.provider);
        if (!customProvider) {
          errors.push(`Custom provider ${config.provider} not found`);
        } else if (!customProvider.enabled) {
          errors.push('Provider is disabled');
        } else if (!customProvider.models || customProvider.models.length === 0) {
          errors.push('No models configured for this provider');
        }
      } else {
        // Built-in provider - use existing validation
        const validation = LLMProviderRegistry.validateProviderCredentials(config.provider as LLMProvider);
        if (!validation.isValid) {
          errors.push(validation.message);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Save provider-specific settings to localStorage
   * Only modifies settings for the active provider, preserving other providers' credentials
   */
  private saveProviderSpecificSettings(config: LLMConfig): void {
    // Check if this is a custom provider
    if (isCustomProvider(config.provider)) {
      // Use CustomProviderManager for custom providers
      if (config.apiKey) {
        CustomProviderManager.setApiKey(config.provider, config.apiKey);
      }
      // Note: endpoint/baseURL for custom providers is stored in the provider config itself
    } else {
      // Use LLMProviderRegistry for built-in providers
      LLMProviderRegistry.saveProviderApiKey(config.provider, config.apiKey || null);
      LLMProviderRegistry.saveProviderEndpoint(config.provider, config.endpoint || null);
    }
  }

  /**
   * Handle localStorage changes from other tabs
   */
  private handleStorageChange(event: StorageEvent): void {
    if (event.key && Object.values(STORAGE_KEYS).includes(event.key as any)) {
      // Get all API key storage keys from registered providers
      const sensitiveKeys = new Set<string>();
      for (const providerType of LLMProviderRegistry.getRegisteredProviders()) {
        const keys = LLMProviderRegistry.getProviderStorageKeys(providerType);
        if (keys.apiKey) {
          sensitiveKeys.add(keys.apiKey);
        }
      }

      const redacted =
        sensitiveKeys.has(event.key as any) ? '(redacted)' :
        (event.newValue ? `${event.newValue.slice(0, 8)}…` : null);
      logger.debug('Configuration changed in another tab', {
        key: event.key,
        newValue: redacted
      });
      this.notifyListeners();
    }
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    this.changeListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        logger.error('Error in configuration change listener:', error);
      }
    });
  }

  /**
   * Get debug information about current configuration state
   */
  getDebugInfo(): Record<string, any> {
    const redact = (cfg?: Partial<LLMConfig>) => cfg ? {
      ...cfg,
      apiKey: cfg.apiKey ? '(redacted)' : undefined
    } : undefined;

    return {
      hasOverride: this.hasOverride(),
      overrideConfig: redact(this.overrideConfig),
      currentConfig: redact(this.getConfiguration()),
      validation: this.validateConfiguration(),
      listenerCount: this.changeListeners.length,
    };
  }
}