// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../observability/Logger.js';
import { TracingProvider, NoOpTracingProvider, type TracingContext } from './TracingProvider.js';

const logger = createLogger('TracingConfig');
const contextLogger = createLogger('TracingContextManager');

/**
 * Configuration for tracing
 */
export interface TracingConfiguration {
  provider: 'langfuse' | 'disabled' | 'custom';
  endpoint?: string;
  publicKey?: string;
  secretKey?: string;
  customProvider?: TracingProvider; // For custom tracing implementations
}

/**
 * Singleton manager for TracingProvider instances
 */
class TracingProviderSingleton {
  private static instance: TracingProvider | null = null;
  private static config: TracingConfiguration = { provider: 'disabled' };

  static getInstance(): TracingProvider {
    if (!TracingProviderSingleton.instance) {
      TracingProviderSingleton.instance = this.createProvider();
      logger.info('Created new TracingProvider singleton instance');
    }
    return TracingProviderSingleton.instance;
  }

  static async configure(config: TracingConfiguration): Promise<void> {
    logger.info('Configuring TracingProvider', {
      provider: config.provider,
      endpoint: config.endpoint
    });

    this.config = { ...config };
    await this.refresh();
  }

  static async refresh(): Promise<void> {
    logger.info('Refreshing TracingProvider singleton instance');

    // Cleanup old instance
    if (this.instance) {
      if (typeof (this.instance as any).destroy === 'function') {
        (this.instance as any).destroy();
        logger.debug('Destroyed previous TracingProvider instance');
      }
    }

    // Create new instance
    this.instance = this.createProvider();

    // Initialize if it has an initialize method
    if (this.instance && typeof this.instance.initialize === 'function') {
      await this.instance.initialize();
      logger.debug('Initialized new TracingProvider instance');
    }
  }

  private static createProvider(): TracingProvider {
    if (this.config.provider === 'disabled') {
      logger.info('Tracing is disabled - creating NoOpTracingProvider');
      return new NoOpTracingProvider();
    }

    if (this.config.provider === 'custom' && this.config.customProvider) {
      logger.info('Using custom TracingProvider');
      return this.config.customProvider;
    }

    if (this.config.provider === 'langfuse') {
      if (!this.config.endpoint || !this.config.publicKey || !this.config.secretKey) {
        logger.warn('Langfuse tracing enabled but missing configuration, falling back to no-op');
        return new NoOpTracingProvider();
      }

      // Dynamically import LangfuseProvider to avoid circular dependencies
      try {
        // Note: This will be loaded lazily when langfuse is configured
        const LangfuseProviderModule = require('./LangfuseProvider.js');
        const LangfuseProvider = LangfuseProviderModule.LangfuseProvider;

        logger.info('Creating LangfuseProvider singleton', {
          endpoint: this.config.endpoint,
          hasPublicKey: !!this.config.publicKey,
          hasSecretKey: !!this.config.secretKey
        });

        return new LangfuseProvider(
          this.config.endpoint,
          this.config.publicKey,
          this.config.secretKey,
          true
        );
      } catch (error) {
        logger.error('Failed to load LangfuseProvider', error);
        return new NoOpTracingProvider();
      }
    }

    // Default to no-op
    logger.warn('Unknown tracing provider, falling back to no-op', { provider: this.config.provider });
    return new NoOpTracingProvider();
  }

  static reset(): void {
    if (this.instance && typeof (this.instance as any).destroy === 'function') {
      (this.instance as any).destroy();
    }
    this.instance = null;
    logger.info('Reset TracingProvider singleton');
  }

  static getConfig(): TracingConfiguration {
    return { ...this.config };
  }

  static isEnabled(): boolean {
    return this.config.provider !== 'disabled';
  }
}

/**
 * Configure tracing with a provider
 */
export async function configureTracing(config: TracingConfiguration): Promise<void> {
  await TracingProviderSingleton.configure(config);
}

/**
 * Get the current tracing configuration
 */
export function getTracingConfig(): TracingConfiguration {
  return TracingProviderSingleton.getConfig();
}

/**
 * Check if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  return TracingProviderSingleton.isEnabled();
}

/**
 * Create a tracing provider based on current configuration (singleton)
 */
export function createTracingProvider(): TracingProvider {
  return TracingProviderSingleton.getInstance();
}

/**
 * Refresh the singleton tracing provider (useful when configuration changes)
 */
export async function refreshTracingProvider(): Promise<void> {
  await TracingProviderSingleton.refresh();
}

/**
 * Reset the tracing provider (cleanup)
 */
export function resetTracingProvider(): void {
  TracingProviderSingleton.reset();
}

/**
 * Thread-local tracing context for passing context to nested tool executions
 */
class TracingContextManager {
  private static instance: TracingContextManager;
  private currentContext: TracingContext | null = null;

  private constructor() {}

  static getInstance(): TracingContextManager {
    if (!TracingContextManager.instance) {
      TracingContextManager.instance = new TracingContextManager();
    }
    return TracingContextManager.instance;
  }

  setContext(context: TracingContext | null): void {
    this.currentContext = context;
  }

  getContext(): TracingContext | null {
    return this.currentContext;
  }

  clearContext(): void {
    this.currentContext = null;
  }

  /**
   * Execute a function with a specific tracing context
   */
  async withContext<T>(context: TracingContext | null, fn: () => Promise<T>): Promise<T> {
    const previousContext = this.currentContext;
    contextLogger.debug('Setting tracing context', {
      hasContext: !!context,
      traceId: context?.traceId,
      previousContext: !!previousContext
    });

    this.setContext(context);
    try {
      return await fn();
    } finally {
      this.setContext(previousContext);
      contextLogger.debug('Restored previous tracing context', {
        hasPrevious: !!previousContext
      });
    }
  }
}

/**
 * Get the current tracing context
 */
export function getCurrentTracingContext(): TracingContext | null {
  return TracingContextManager.getInstance().getContext();
}

/**
 * Set the current tracing context
 */
export function setCurrentTracingContext(context: TracingContext | null): void {
  TracingContextManager.getInstance().setContext(context);
}

/**
 * Clear the current tracing context
 */
export function clearTracingContext(): void {
  TracingContextManager.getInstance().clearContext();
}

/**
 * Execute a function with a specific tracing context
 */
export async function withTracingContext<T>(context: TracingContext | null, fn: () => Promise<T>): Promise<T> {
  return TracingContextManager.getInstance().withContext(context, fn);
}
