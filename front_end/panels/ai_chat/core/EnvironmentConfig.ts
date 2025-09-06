// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Environment Configuration Manager for AI Chat Panel
 * 
 * This module provides unified access to API keys from multiple sources:
 * 1. localStorage (user-configured, highest priority)
 * 2. Runtime environment variables (Docker runtime injection)
 * 3. Build-time environment variables (Docker build args, fallback) 
 * 4. Empty string (no configuration available)
 * 
 * SECURITY NOTICE:
 * - NEVER commit real API keys to source control
 * - Runtime injection happens at container start (not in image)
 * - Build-time injection is for LOCAL/DEV environments only
 * - Production deployments should use server-side proxy/OAuth
 * - The getBuildConfig() function returns safe defaults (no keys)
 */

import { createLogger } from './Logger.js';

// Build-time configuration interface
interface BuildTimeConfig {
  readonly apiKeys: {
    readonly openai?: string;
    readonly openrouter?: string;
    readonly groq?: string;
    readonly litellm?: string;
  };
  readonly buildTime: string;
  readonly hasKeys: boolean;
}

// Default build configuration (used when no environment config is available)
const DEFAULT_BUILD_CONFIG: BuildTimeConfig = {
  apiKeys: {},
  buildTime: 'development',
  hasKeys: false
};

// Get build configuration - replaced at Docker build for local/dev only.
// IMPORTANT: Do not commit real keys. The default returns no keys.
function getBuildConfig(): BuildTimeConfig {
  return DEFAULT_BUILD_CONFIG;
}

const BUILD_CONFIG = getBuildConfig();

const logger = createLogger('EnvironmentConfig');

// Runtime configuration interface (injected by Docker at container start)
interface RuntimeConfig {
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
  LITELLM_API_KEY?: string;
  timestamp?: string;
  source?: string;
}

// Get runtime configuration if available (from Docker runtime injection)
function getRuntimeConfig(): RuntimeConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // @ts-ignore - __RUNTIME_CONFIG__ is injected by Docker entrypoint
  if (window.__RUNTIME_CONFIG__) {
    // @ts-ignore
    const config = window.__RUNTIME_CONFIG__ as RuntimeConfig;
    console.log('Runtime config found:', {
      hasOpenAI: Boolean(config.OPENAI_API_KEY),
      hasOpenRouter: Boolean(config.OPENROUTER_API_KEY),
      hasGroq: Boolean(config.GROQ_API_KEY),
      hasLiteLLM: Boolean(config.LITELLM_API_KEY),
      timestamp: config.timestamp,
      source: config.source
    });
    return config;
  }
  
  console.log('Runtime config not found on window object');
  return null;
}

/**
 * API key providers supported by the environment configuration
 */
export type APIKeyProvider = 'openai' | 'openrouter' | 'groq' | 'litellm';

/**
 * Storage keys for localStorage API keys
 */
const STORAGE_KEYS: Record<APIKeyProvider, string> = {
  openai: 'ai_chat_api_key',
  openrouter: 'ai_chat_openrouter_api_key',
  groq: 'ai_chat_groq_api_key',
  litellm: 'ai_chat_litellm_api_key'
};

/**
 * Environment Configuration Manager
 * 
 * Provides unified access to API keys with fallback hierarchy:
 * localStorage → build-time config → empty string
 */
export class EnvironmentConfig {
  private static instance: EnvironmentConfig | null = null;
  private debugLogged = false;
  private runtimeConfig: RuntimeConfig | null = null;

  private constructor() {
    // Get runtime configuration if available
    this.runtimeConfig = getRuntimeConfig();
    
    // Auto-save runtime config to localStorage if not already present
    this.initializeFromRuntime();
    
    // Log configuration availability once for debugging
    if (!this.debugLogged) {
      logger.debug('Environment configuration initialized:', {
        hasRuntimeConfig: Boolean(this.runtimeConfig),
        hasBuildConfig: BUILD_CONFIG?.hasKeys || false,
        buildTime: BUILD_CONFIG?.buildTime || 'unknown',
        availableProviders: BUILD_CONFIG ? Object.keys(BUILD_CONFIG.apiKeys) : []
      });
      this.debugLogged = true;
    }
  }

  /**
   * Initialize API keys from runtime config if available
   * Saves runtime-injected keys to localStorage if not already present
   */
  private initializeFromRuntime(): void {
    if (!this.runtimeConfig) {
      return;
    }

    const providers: APIKeyProvider[] = ['openai', 'openrouter', 'groq', 'litellm'];
    let savedCount = 0;

    for (const provider of providers) {
      const storageKey = STORAGE_KEYS[provider];
      const existingKey = localStorage.getItem(storageKey);
      
      // Only save if not already in localStorage
      if (!existingKey || existingKey.trim() === '') {
        const runtimeKey = this.getRuntimeKey(provider);
        if (runtimeKey) {
          localStorage.setItem(storageKey, runtimeKey);
          savedCount++;
          logger.debug(`Saved runtime API key to localStorage for ${provider}`);
        }
      }
    }

    if (savedCount > 0) {
      logger.info(`Initialized ${savedCount} API keys from Docker runtime configuration`);
    }
  }

  /**
   * Get API key from runtime config
   */
  private getRuntimeKey(provider: APIKeyProvider): string {
    if (!this.runtimeConfig) {
      return '';
    }
    
    const keyMap: Record<APIKeyProvider, keyof RuntimeConfig> = {
      openai: 'OPENAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      groq: 'GROQ_API_KEY',
      litellm: 'LITELLM_API_KEY'
    };
    
    const key = this.runtimeConfig[keyMap[provider]];
    return (key && key.trim() !== '') ? key.trim() : '';
  }

  /**
   * Get the singleton instance of EnvironmentConfig
   */
  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Get API key for a specific provider with fallback hierarchy
   * 
   * Priority order:
   * 1. localStorage (user-configured)
   * 2. Runtime configuration (Docker runtime injection)
   * 3. Build-time environment config (Docker build args)
   * 4. Empty string (no configuration)
   * 
   * @param provider The API key provider
   * @returns The API key or empty string if not available
   */
  getApiKey(provider: APIKeyProvider): string {
    // First check localStorage (highest priority)
    const storageKey = STORAGE_KEYS[provider];
    const localStorageKey = localStorage.getItem(storageKey);
    
    if (localStorageKey && localStorageKey.trim() !== '') {
      logger.debug(`Using localStorage API key for ${provider}`);
      return localStorageKey.trim();
    }

    // Check runtime configuration (Docker runtime injection)
    const runtimeKey = this.getRuntimeKey(provider);
    if (runtimeKey) {
      logger.debug(`Using runtime API key for ${provider}`);
      // Also save to localStorage for future use
      localStorage.setItem(storageKey, runtimeKey);
      return runtimeKey;
    }

    // Fallback to build-time configuration
    if (BUILD_CONFIG?.apiKeys?.[provider]) {
      logger.debug(`Using build-time API key for ${provider}`);
      return BUILD_CONFIG.apiKeys[provider];
    }

    // No configuration available
    logger.debug(`No API key available for ${provider}`);
    return '';
  }

  /**
   * Check if an API key is available for a provider
   * 
   * @param provider The API key provider
   * @returns true if an API key is available from any source
   */
  hasApiKey(provider: APIKeyProvider): boolean {
    return this.getApiKey(provider) !== '';
  }

  /**
   * Get the source of an API key for debugging
   * 
   * @param provider The API key provider
   * @returns The source of the API key ('localStorage', 'runtime', 'build-time', or 'none')
   */
  getApiKeySource(provider: APIKeyProvider): 'localStorage' | 'runtime' | 'build-time' | 'none' {
    const storageKey = STORAGE_KEYS[provider];
    const localStorageKey = localStorage.getItem(storageKey);
    
    if (localStorageKey && localStorageKey.trim() !== '') {
      return 'localStorage';
    }
    
    if (this.getRuntimeKey(provider)) {
      return 'runtime';
    }
    
    if (typeof BUILD_CONFIG?.apiKeys?.[provider] === 'string' && 
        BUILD_CONFIG.apiKeys[provider].trim() !== '') {
      return 'build-time';
    }
    
    return 'none';
  }

  /**
   * Get storage key for a provider (for backward compatibility)
   * 
   * @param provider The API key provider
   * @returns The localStorage key used for this provider
   */
  getStorageKey(provider: APIKeyProvider): string {
    return STORAGE_KEYS[provider];
  }

  /**
   * Validate credentials for a provider
   * 
   * @param provider The API key provider
   * @returns Validation result with details
   */
  validateCredentials(provider: APIKeyProvider): {
    isValid: boolean;
    message: string;
    source?: 'localStorage' | 'build-time';
    missingItems?: string[];
  } {
    const apiKey = this.getApiKey(provider);
    const source = this.getApiKeySource(provider);
    
    if (!apiKey) {
      return {
        isValid: false,
        message: `${provider} API key is required. Please add your API key in Settings or configure environment variables.`,
        missingItems: ['API Key']
      };
    }
    
    return {
      isValid: true,
      message: `${provider} credentials are configured correctly (source: ${source}).`,
      source: source !== 'none' ? source : undefined
    };
  }

  /**
   * Get build configuration info for debugging
   * 
   * @returns Build configuration metadata
   */
  getBuildInfo(): {
    hasBuildConfig: boolean;
    buildTime: string;
    availableProviders: string[];
  } {
    return {
      hasBuildConfig: BUILD_CONFIG?.hasKeys || false,
      buildTime: BUILD_CONFIG?.buildTime || 'unknown',
      availableProviders: BUILD_CONFIG ? Object.keys(BUILD_CONFIG.apiKeys) : []
    };
  }
}

/**
 * Get the global environment configuration instance
 * 
 * @returns The EnvironmentConfig singleton
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return EnvironmentConfig.getInstance();
}