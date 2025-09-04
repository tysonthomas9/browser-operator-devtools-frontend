// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Environment Configuration Manager for AI Chat Panel
 * 
 * This module provides unified access to API keys from multiple sources:
 * 1. localStorage (user-configured, highest priority)
 * 2. Build-time environment variables (Docker build args, fallback)
 * 3. Empty string (no configuration available)
 * 
 * The build-time configuration is generated during Docker build from
 * environment variables and provides a secure way to inject API keys
 * into the DevTools without requiring runtime configuration.
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

// Get build configuration - this will be replaced with actual config during Docker build
// The generate-env-config.js script will replace this entire function during build
function getBuildConfig(): BuildTimeConfig {
  // Build-time configuration generated from environment variables
  // Generated at: 2025-09-04T17:26:32.688Z
  return {
    "apiKeys": {
        "openai": "sk-demo-openai",
        "openrouter": "sk-or-demo-openrouter",
        "groq": "gsk_demo-groq",
        "litellm": "demo-litellm"
    },
    "buildTime": "2025-09-04T17:26:32.688Z",
    "hasKeys": true
};
}

const BUILD_CONFIG = getBuildConfig();

const logger = createLogger('EnvironmentConfig');

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

  private constructor() {
    // Log configuration availability once for debugging
    if (!this.debugLogged) {
      logger.debug('Environment configuration initialized:', {
        hasBuildConfig: BUILD_CONFIG?.hasKeys || false,
        buildTime: BUILD_CONFIG?.buildTime || 'unknown',
        availableProviders: BUILD_CONFIG ? Object.keys(BUILD_CONFIG.apiKeys) : []
      });
      this.debugLogged = true;
    }
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
   * 2. Build-time environment config (Docker build args)
   * 3. Empty string (no configuration)
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
   * @returns The source of the API key ('localStorage', 'build-time', or 'none')
   */
  getApiKeySource(provider: APIKeyProvider): 'localStorage' | 'build-time' | 'none' {
    const storageKey = STORAGE_KEYS[provider];
    const localStorageKey = localStorage.getItem(storageKey);
    
    if (localStorageKey && localStorageKey.trim() !== '') {
      return 'localStorage';
    }
    
    if (BUILD_CONFIG?.apiKeys?.[provider]) {
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