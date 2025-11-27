// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
// Cache break: 2025-09-18T19:00:00Z - Add skipCredentialChecks + preserve credentials + secure logging

import { createLogger } from './Logger.js';
import type { LLMProvider } from '../LLM/LLMTypes.js';
import { isCustomProvider } from '../LLM/LLMTypes.js';
import { LLMProviderRegistry } from '../LLM/LLMProviderRegistry.js';
import { CustomProviderManager } from './CustomProviderManager.js';
import { findClosestModel } from '../LLM/FuzzyModelMatcher.js';

const logger = createLogger('LLMConfigurationManager');

/**
 * Model option interface for dropdown selections
 */
export interface ModelOption {
  value: string;
  label: string;
  type: string; // Provider ID (e.g., 'openai', 'groq', 'custom:my-provider')
}

/**
 * Default model selections for each provider
 */
export const DEFAULT_PROVIDER_MODELS: Record<string, {main: string, mini?: string, nano?: string}> = {
  openai: {
    main: 'gpt-4.1-2025-04-14',
    mini: 'gpt-4.1-mini-2025-04-14',
    nano: 'gpt-4.1-nano-2025-04-14'
  },
  litellm: {
    main: '', // Will use first available model
    mini: '',
    nano: ''
  },
  groq: {
    main: 'openai/gpt-oss-120b',
    mini: 'openai/gpt-oss-120b',
    nano: 'openai/gpt-oss-120b'
  },
  openrouter: {
    main: 'anthropic/claude-sonnet-4.5',
    mini: 'google/gemini-2.5-flash',
    nano: 'openai/gpt-oss-120b:exacto'
  },
  browseroperator: {
    main: 'main',
    mini: 'mini',
    nano: 'nano'
  },
  cerebras: {
    main: 'gpt-oss-120b',
    mini: 'gpt-oss-120b',
    nano: 'llama3.1-8b'
  },
  anthropic: {
    main: 'claude-sonnet-4-5',
    mini: 'claude-haiku-4-5',
    nano: 'claude-haiku-4-5'
  },
  googleai: {
    main: 'gemini-2.5-pro',
    mini: 'gemini-2.5-flash',
    nano: 'gemini-2.5-flash'
  }
};

/**
 * Default OpenAI models (static list for providers without fetch capability)
 */
export const DEFAULT_OPENAI_MODELS: ModelOption[] = [
  {value: 'o4-mini-2025-04-16', label: 'O4 Mini', type: 'openai'},
  {value: 'o3-mini-2025-01-31', label: 'O3 Mini', type: 'openai'},
  {value: 'gpt-5-2025-08-07', label: 'GPT-5', type: 'openai'},
  {value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini', type: 'openai'},
  {value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano', type: 'openai'},
  {value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', type: 'openai'},
  {value: 'gpt-4.1-mini-2025-04-14', label: 'GPT-4.1 Mini', type: 'openai'},
  {value: 'gpt-4.1-nano-2025-04-14', label: 'GPT-4.1 Nano', type: 'openai'},
];

/**
 * Placeholder constants for model options
 */
export const MODEL_PLACEHOLDERS = {
  ADD_CUSTOM: 'add_custom_model',
  NO_MODELS: 'no_models_available',
};

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
  // Model options storage
  ALL_MODEL_OPTIONS: 'ai_chat_all_model_options',
  MODEL_OPTIONS: 'ai_chat_model_options', // Legacy, for backward compatibility
  CUSTOM_MODELS: 'ai_chat_custom_models', // For LiteLLM custom models
} as const;

/**
 * Centralized LLM configuration manager with override capabilities.
 * Supports both manual mode (localStorage-based) and automated mode (override-based).
 */
export class LLMConfigurationManager {
  private static instance: LLMConfigurationManager;
  private overrideConfig?: Partial<LLMConfig>; // Override for automated mode
  private changeListeners: Array<() => void> = [];

  // Model options state - organized by provider
  private modelOptionsByProvider: Map<string, ModelOption[]> = new Map();
  private modelOptionsInitialized = false;

  private constructor() {
    // Listen for localStorage changes from other tabs (manual mode)
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    // Initialize model options from localStorage
    this.loadModelOptionsFromStorage();
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
   * Note: For default fallback, ensure models are fetched and selected in the UI
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

  // ============================================================================
  // Model Options Management
  // ============================================================================

  /**
   * Load model options from localStorage into memory
   */
  private loadModelOptionsFromStorage(): void {
    try {
      // Load from comprehensive storage
      const allOptionsJson = localStorage.getItem(STORAGE_KEYS.ALL_MODEL_OPTIONS);
      if (allOptionsJson) {
        const allOptions: ModelOption[] = JSON.parse(allOptionsJson);
        // Group by provider
        this.modelOptionsByProvider.clear();
        for (const option of allOptions) {
          const providerOptions = this.modelOptionsByProvider.get(option.type) || [];
          providerOptions.push(option);
          this.modelOptionsByProvider.set(option.type, providerOptions);
        }
        logger.debug('Loaded model options from storage', {
          providers: Array.from(this.modelOptionsByProvider.keys()),
          totalModels: allOptions.length
        });
      } else {
        // Initialize with defaults
        this.modelOptionsByProvider.set('openai', [...DEFAULT_OPENAI_MODELS]);
        logger.debug('Initialized with default OpenAI models');
      }
      this.modelOptionsInitialized = true;
    } catch (error) {
      logger.error('Failed to load model options from storage:', error);
      // Initialize with defaults on error
      this.modelOptionsByProvider.set('openai', [...DEFAULT_OPENAI_MODELS]);
      this.modelOptionsInitialized = true;
    }
  }

  /**
   * Get all model options across all providers
   */
  getAllModelOptions(): ModelOption[] {
    const allOptions: ModelOption[] = [];
    for (const options of this.modelOptionsByProvider.values()) {
      allOptions.push(...options);
    }
    return allOptions;
  }

  /**
   * Get model options for a specific provider
   * @param provider Provider ID (e.g., 'openai', 'groq'). If not provided, uses current provider.
   */
  getModelOptions(provider?: string): ModelOption[] {
    const targetProvider = provider || this.getProvider();
    return this.modelOptionsByProvider.get(targetProvider) || [];
  }

  /**
   * Get model options for the currently selected provider
   */
  getModelOptionsForCurrentProvider(): ModelOption[] {
    return this.getModelOptions(this.getProvider());
  }

  /**
   * Set model options for a provider
   * @param provider Provider ID
   * @param models Array of model options
   */
  setModelOptions(provider: string, models: ModelOption[]): void {
    logger.info(`Setting ${models.length} models for provider ${provider}`);
    this.modelOptionsByProvider.set(provider, models);
    this.persistModelOptionsToStorage();
    this.notifyListeners();
  }

  /**
   * Clear model options for a provider, or all providers if not specified
   * @param provider Optional provider ID to clear
   */
  clearModelOptions(provider?: string): void {
    if (provider) {
      this.modelOptionsByProvider.delete(provider);
      logger.debug(`Cleared model options for provider ${provider}`);
    } else {
      this.modelOptionsByProvider.clear();
      logger.debug('Cleared all model options');
    }
    this.persistModelOptionsToStorage();
    this.notifyListeners();
  }

  /**
   * Add a custom model option (primarily for LiteLLM)
   * @param modelName The model name to add
   * @param provider The provider type (defaults to current provider)
   */
  addCustomModelOption(modelName: string, provider?: string): void {
    const targetProvider = provider || this.getProvider();
    const providerOptions = this.modelOptionsByProvider.get(targetProvider) || [];

    // Check if model already exists
    if (providerOptions.some(m => m.value === modelName)) {
      logger.debug(`Model ${modelName} already exists for provider ${targetProvider}`);
      return;
    }

    // Create label - just use the model name (consumers can format as needed)
    const newOption: ModelOption = {
      value: modelName,
      label: modelName,
      type: targetProvider
    };

    providerOptions.push(newOption);
    this.modelOptionsByProvider.set(targetProvider, providerOptions);

    // Also save to custom models list for LiteLLM
    if (targetProvider === 'litellm') {
      this.saveCustomModelToStorage(modelName);
    }

    this.persistModelOptionsToStorage();
    this.notifyListeners();

    logger.info(`Added custom model ${modelName} for provider ${targetProvider}`);
  }

  /**
   * Remove a custom model option
   * @param modelName The model name to remove
   * @param provider The provider type (defaults to current provider)
   */
  removeCustomModelOption(modelName: string, provider?: string): void {
    const targetProvider = provider || this.getProvider();
    const providerOptions = this.modelOptionsByProvider.get(targetProvider) || [];

    const filteredOptions = providerOptions.filter(m => m.value !== modelName);
    if (filteredOptions.length === providerOptions.length) {
      logger.debug(`Model ${modelName} not found for provider ${targetProvider}`);
      return;
    }

    this.modelOptionsByProvider.set(targetProvider, filteredOptions);

    // Also remove from custom models list for LiteLLM
    if (targetProvider === 'litellm') {
      this.removeCustomModelFromStorage(modelName);
    }

    this.persistModelOptionsToStorage();
    this.notifyListeners();

    logger.info(`Removed custom model ${modelName} from provider ${targetProvider}`);
  }

  /**
   * Validate a model selection against available options
   * @param model The model value to validate
   * @param provider Optional provider to validate against (defaults to current)
   */
  validateModelSelection(model: string, provider?: string): boolean {
    if (!model) return false;
    const options = this.getModelOptions(provider);
    return options.some(opt => opt.value === model);
  }

  /**
   * Validate and fix model selections for the current provider
   * Returns the corrected selections
   */
  validateAndFixModelSelections(): { main: string; mini: string; nano: string } {
    const provider = this.getProvider();
    const available = this.getModelOptionsForCurrentProvider();
    const defaults = DEFAULT_PROVIDER_MODELS[provider] || {};

    const availableValues = available.filter(m => m.type === provider).map(m => m.value);

    const validateModel = (stored: string, defaultValue: string | undefined): string => {
      // 1. Check exact match for stored model
      if (stored && available.some(m => m.value === stored && m.type === provider)) {
        return stored;
      }

      // 2. Try fuzzy match for stored model
      if (stored) {
        const fuzzyMatch = findClosestModel(stored, availableValues);
        if (fuzzyMatch) {
          logger.info(`Fuzzy matched model '${stored}' to '${fuzzyMatch}'`);
          return fuzzyMatch;
        }
      }

      // 3. Check exact match for provider default
      if (defaultValue && available.some(m => m.value === defaultValue)) {
        return defaultValue;
      }

      // 4. Try fuzzy match for provider default
      if (defaultValue) {
        const fuzzyDefault = findClosestModel(defaultValue, availableValues);
        if (fuzzyDefault) {
          logger.info(`Fuzzy matched default '${defaultValue}' to '${fuzzyDefault}'`);
          return fuzzyDefault;
        }
      }

      // 5. Fall back to first available
      return available.length > 0 ? available[0].value : '';
    };

    const currentMain = localStorage.getItem(STORAGE_KEYS.MODEL_SELECTION) || '';
    const currentMini = localStorage.getItem(STORAGE_KEYS.MINI_MODEL) || '';
    const currentNano = localStorage.getItem(STORAGE_KEYS.NANO_MODEL) || '';

    const main = validateModel(currentMain, defaults.main);
    const mini = validateModel(currentMini, defaults.mini);
    const nano = validateModel(currentNano, defaults.nano);

    // Persist corrections if needed
    if (main !== currentMain) {
      localStorage.setItem(STORAGE_KEYS.MODEL_SELECTION, main);
      logger.info(`Corrected main model from '${currentMain}' to '${main}'`);
    }
    if (mini !== currentMini) {
      if (mini) {
        localStorage.setItem(STORAGE_KEYS.MINI_MODEL, mini);
      } else {
        localStorage.removeItem(STORAGE_KEYS.MINI_MODEL);
      }
      logger.info(`Corrected mini model from '${currentMini}' to '${mini}'`);
    }
    if (nano !== currentNano) {
      if (nano) {
        localStorage.setItem(STORAGE_KEYS.NANO_MODEL, nano);
      } else {
        localStorage.removeItem(STORAGE_KEYS.NANO_MODEL);
      }
      logger.info(`Corrected nano model from '${currentNano}' to '${nano}'`);
    }

    return { main, mini, nano };
  }

  /**
   * Persist model options to localStorage
   */
  private persistModelOptionsToStorage(): void {
    try {
      const allOptions = this.getAllModelOptions();
      localStorage.setItem(STORAGE_KEYS.ALL_MODEL_OPTIONS, JSON.stringify(allOptions));

      // Also update legacy storage for backward compatibility
      const currentProviderOptions = this.getModelOptionsForCurrentProvider();
      localStorage.setItem(STORAGE_KEYS.MODEL_OPTIONS, JSON.stringify(currentProviderOptions));
    } catch (error) {
      logger.error('Failed to persist model options to storage:', error);
    }
  }

  /**
   * Save a custom model name to the LiteLLM custom models list
   */
  private saveCustomModelToStorage(modelName: string): void {
    try {
      const customModelsJson = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODELS);
      const customModels: string[] = customModelsJson ? JSON.parse(customModelsJson) : [];
      if (!customModels.includes(modelName)) {
        customModels.push(modelName);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_MODELS, JSON.stringify(customModels));
      }
    } catch (error) {
      logger.error('Failed to save custom model to storage:', error);
    }
  }

  /**
   * Remove a custom model name from the LiteLLM custom models list
   */
  private removeCustomModelFromStorage(modelName: string): void {
    try {
      const customModelsJson = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODELS);
      if (customModelsJson) {
        const customModels: string[] = JSON.parse(customModelsJson);
        const filtered = customModels.filter(m => m !== modelName);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_MODELS, JSON.stringify(filtered));
      }
    } catch (error) {
      logger.error('Failed to remove custom model from storage:', error);
    }
  }

  // ============================================================================
  // Override Configuration
  // ============================================================================

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