// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import type { StoredToolConfig, ToolDependency } from '../core/ToolStorageManager.js';

const logger = createLogger('DynamicJavaScriptTool');

/**
 * A dynamic tool that executes user-defined JavaScript code in the page context.
 * Created from StoredToolConfig for each custom tool.
 */
export class DynamicJavaScriptTool implements Tool<Record<string, unknown>, unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };

  private readonly config: StoredToolConfig;

  constructor(config: StoredToolConfig) {
    this.config = config;
    this.name = config.name;
    this.description = config.description;
    this.schema = config.schema;
  }

  async execute(args: Record<string, unknown>, ctx?: LLMContext): Promise<unknown> {
    const { code, timeout = 10000, dependencies = [], hasPageAccess } = this.config;

    logger.info(`Executing custom tool: ${this.name}`, { argsKeys: Object.keys(args) });

    // Get page target
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      if (hasPageAccess) {
        return { error: 'No page target available. Navigate to a page first.' };
      }
      // For non-page tools, we still need a target for execution
      return { error: 'No execution context available.' };
    }

    const runtimeAgent = target.runtimeAgent();

    try {
      // Load dependencies first
      if (dependencies.length > 0) {
        const loadResult = await this.loadDependencies(runtimeAgent, dependencies);
        if (loadResult.error) {
          return loadResult;
        }
      }

      // Build the execution wrapper
      const wrappedCode = this.buildWrappedCode(code, args, ctx);

      // Execute in page context
      const result = await runtimeAgent.invoke_evaluate({
        expression: wrappedCode,
        returnByValue: true,
        awaitPromise: true,
        timeout: Math.min(timeout, 30000),
        includeCommandLineAPI: false, // Security: disable DevTools CLI
      });

      // Handle execution errors
      if (result.exceptionDetails) {
        const errorMessage = result.exceptionDetails.text || 'Execution error';
        const stack = result.exceptionDetails.exception?.description || '';

        logger.error(`Custom tool "${this.name}" execution failed:`, errorMessage);

        return {
          error: errorMessage,
          stack: stack,
        };
      }

      // Return result
      const resultValue = result.result?.value;
      logger.info(`Custom tool "${this.name}" executed successfully`);

      return resultValue;

    } catch (error) {
      logger.error(`Custom tool "${this.name}" threw exception:`, error);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load external dependencies via dynamic script injection
   */
  private async loadDependencies(
    runtimeAgent: ReturnType<SDK.Target.Target['runtimeAgent']>,
    dependencies: ToolDependency[]
  ): Promise<{ error?: string }> {

    for (const dep of dependencies) {
      logger.info(`Loading dependency: ${dep.name} from ${dep.url}`);

      const loadScript = `
        (function() {
          return new Promise(function(resolve, reject) {
            // Check if already loaded
            if (typeof window['${dep.globalName}'] !== 'undefined') {
              resolve({ loaded: true, cached: true });
              return;
            }

            // Create script element
            var script = document.createElement('script');
            script.src = ${JSON.stringify(dep.url)};
            script.async = true;

            script.onload = function() {
              if (typeof window['${dep.globalName}'] !== 'undefined') {
                resolve({ loaded: true, cached: false });
              } else {
                reject(new Error('Library loaded but global "${dep.globalName}" not found'));
              }
            };

            script.onerror = function() {
              reject(new Error('Failed to load script: ${dep.url}'));
            };

            document.head.appendChild(script);
          });
        })()
      `;

      try {
        const result = await runtimeAgent.invoke_evaluate({
          expression: loadScript,
          returnByValue: true,
          awaitPromise: true,
          timeout: 15000, // 15 seconds for script load
        });

        if (result.exceptionDetails) {
          return {
            error: `Failed to load dependency "${dep.name}": ${result.exceptionDetails.text}`,
          };
        }

        const loadResult = result.result?.value as { loaded: boolean; cached: boolean } | undefined;
        if (loadResult?.loaded) {
          logger.info(`Dependency "${dep.name}" loaded (cached: ${loadResult.cached})`);
        }

      } catch (error) {
        return {
          error: `Failed to load dependency "${dep.name}": ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {};
  }

  /**
   * Build the wrapped code that will be executed in page context
   */
  private buildWrappedCode(
    userCode: string,
    args: Record<string, unknown>,
    ctx?: LLMContext
  ): string {
    // Create a safe context object (no sensitive data like API keys)
    const safeCtx = {
      provider: ctx?.provider,
      model: ctx?.model,
      miniModel: ctx?.miniModel,
    };

    // Wrap user code in async IIFE with args and ctx available
    return `
      (async function() {
        'use strict';

        // Tool arguments (validated against schema)
        const args = ${JSON.stringify(args)};

        // Execution context (provider, model info)
        const ctx = ${JSON.stringify(safeCtx)};

        try {
          // User code execution
          ${userCode}
        } catch (error) {
          return {
            error: error.message || String(error),
            stack: error.stack || ''
          };
        }
      })()
    `;
  }

  /**
   * Get the tool configuration
   */
  getConfig(): StoredToolConfig {
    return this.config;
  }
}

/**
 * Create a DynamicJavaScriptTool from a StoredToolConfig
 */
export function createDynamicTool(config: StoredToolConfig): DynamicJavaScriptTool {
  return new DynamicJavaScriptTool(config);
}
