// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import { SkillStorageManager } from './SkillStorageManager.js';
import { CDP_HELPER_LIBRARY, CHECK_HELPERS_INJECTED } from './CDPHelperLibrary.js';
import { SelfHealingErrorClassifier } from './SelfHealingErrorClassifier.js';
import { SelfHealingContextCapture } from './SelfHealingContextCapture.js';
import { SelfHealingRecoveryLoop } from './SelfHealingRecoveryLoop.js';
import { SemanticKnowledgeUpdater } from './SemanticKnowledgeUpdater.js';
import type { LearnedSkill, SkillExecutionResult, SkillSchema, HealingRecord } from './types/SkillTypes.js';
import type { SelfHealingResult } from './types/SelfHealingTypes.js';

const logger = createLogger('SkillExecutor');

const DEFAULT_TIMEOUT = 30000; // 30 seconds

interface ExecuteOptions {
  timeout?: number;
  testMode?: boolean;
  /** Enable self-healing for selector errors (default: true) */
  selfHeal?: boolean;
  /** Enable semantic knowledge updates after successful execution (default: true) */
  updateKnowledge?: boolean;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Executes learned skills in the page context with CDP helpers.
 */
export class SkillExecutor {
  private static instance: SkillExecutor | null = null;

  private constructor() {
    logger.info('Initialized SkillExecutor');
  }

  static getInstance(): SkillExecutor {
    if (!SkillExecutor.instance) {
      SkillExecutor.instance = new SkillExecutor();
    }
    return SkillExecutor.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    SkillExecutor.instance = null;
  }

  /**
   * Execute a skill with the given arguments
   */
  async executeSkill(
    skill: LearnedSkill,
    args: Record<string, unknown>,
    options: ExecuteOptions = {}
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    // Get page target (outside try to be available in catch)
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      return this.createErrorResult('No page target available. Navigate to a page first.', startTime);
    }

    // Get page URL (outside try to be available in catch)
    let pageUrl: string;
    try {
      pageUrl = await this.getPageUrl(target);
    } catch {
      return this.createErrorResult('Failed to get page URL', startTime);
    }

    try {
      // Check domain
      const pageDomain = this.extractDomain(pageUrl);

      if (!this.checkDomainMatch(skill, pageDomain)) {
        return this.createErrorResult(
          `Domain mismatch: skill is for "${skill.domain}" but current page is "${pageDomain}"`,
          startTime
        );
      }

      // Validate arguments
      const validation = this.validateArgs(args, skill.schema);
      if (!validation.valid) {
        return this.createErrorResult(validation.error || 'Invalid arguments', startTime);
      }

      // Inject helpers if needed
      await this.ensureHelpersInjected(target);

      // Execute skill
      const result = await this.compileAndExecute(target, skill.source, args, timeout);

      const executionResult: SkillExecutionResult = {
        success: true,
        output: result,
        executionTimeMs: Date.now() - startTime,
        capturedAt: new Date().toISOString(),
      };

      // Record test if in test mode
      if (options.testMode) {
        await this.recordTest(skill.id, args, executionResult, pageUrl);
      }

      // Update semantic knowledge if enabled
      if (options.updateKnowledge !== false) {
        this.updateSemanticKnowledge(skill, pageUrl, executionResult).catch(err => {
          logger.warn('Failed to update semantic knowledge', { error: err });
        });
      }

      return executionResult;

    } catch (error) {
      // Attempt self-healing for eligible errors
      if (options.selfHeal !== false && error instanceof Error) {
        const healingResult = await this.attemptSelfHealing(target, error, skill, args, timeout);

        if (healingResult && healingResult.success && healingResult.healedSelector) {
          // Retry with healed code
          const patchedSource = this.patchSkillSource(
            skill.source,
            healingResult.originalSelector,
            healingResult.healedSelector
          );

          try {
            const retryResult = await this.compileAndExecute(target, patchedSource, args, timeout);

            const successResult: SkillExecutionResult = {
              success: true,
              output: retryResult,
              executionTimeMs: Date.now() - startTime,
              capturedAt: new Date().toISOString(),
              healingApplied: true,
              healingAttempts: healingResult.attempts.length,
              healedSelector: healingResult.healedSelector,
            };

            // Record healing history (async, don't wait)
            this.recordHealingHistory(skill, healingResult, pageUrl).catch(err => {
              logger.warn('Failed to record healing history', { error: err });
            });

            // Record successful test if in test mode
            if (options.testMode) {
              await this.recordTest(skill.id, args, successResult, pageUrl);
            }

            return successResult;
          } catch (retryError) {
            logger.warn('Retry with healed selector also failed', { error: retryError });
          }
        }
      }

      const executionResult = this.createErrorResult(
        error instanceof Error ? error.message : String(error),
        startTime,
        error instanceof Error ? error.stack : undefined
      );

      // Record failed test if in test mode
      if (options.testMode) {
        await this.recordTest(skill.id, args, executionResult, pageUrl);
      }

      return executionResult;
    }
  }

  /**
   * Validate arguments against skill schema
   */
  validateArgs(args: Record<string, unknown>, schema: SkillSchema): ValidationResult {
    // Check required properties
    const required = schema.required || [];
    for (const prop of required) {
      if (!(prop in args)) {
        return { valid: false, error: `Missing required argument: ${prop}` };
      }
    }

    // Type check provided properties
    for (const [key, value] of Object.entries(args)) {
      const propSchema = schema.properties[key];
      if (!propSchema) {
        continue; // Allow extra properties
      }

      const expectedType = propSchema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (actualType !== expectedType) {
        return {
          valid: false,
          error: `Invalid type for "${key}": expected ${expectedType}, got ${actualType}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if skill domain matches page domain (with subdomain support)
   */
  checkDomainMatch(skill: LearnedSkill, pageDomain: string): boolean {
    return SkillStorageManager.getInstance().domainMatches(skill.domain, pageDomain);
  }

  /**
   * Inject CDP helper library into page
   */
  private async ensureHelpersInjected(target: SDK.Target.Target): Promise<void> {
    const runtimeAgent = target.runtimeAgent();

    // Check if already injected
    const checkResult = await runtimeAgent.invoke_evaluate({
      expression: CHECK_HELPERS_INJECTED,
      returnByValue: true,
    });

    if (checkResult.result?.value === true) {
      return; // Already injected
    }

    // Inject helpers
    const injectResult = await runtimeAgent.invoke_evaluate({
      expression: CDP_HELPER_LIBRARY,
      returnByValue: true,
    });

    if (injectResult.exceptionDetails) {
      throw new Error(`Failed to inject helpers: ${injectResult.exceptionDetails.text}`);
    }

    logger.info('Injected CDP helper library');
  }

  /**
   * Compile and execute skill code
   */
  private async compileAndExecute(
    target: SDK.Target.Target,
    source: string,
    args: Record<string, unknown>,
    timeout: number
  ): Promise<unknown> {
    const runtimeAgent = target.runtimeAgent();

    // Wrap skill source in async IIFE with helpers and args in scope
    const wrappedCode = `
      (async function() {
        'use strict';

        const helpers = window.__skillHelpers;
        const args = ${JSON.stringify(args)};

        try {
          ${source}
        } catch (error) {
          return { __skillError: true, message: error.message, stack: error.stack };
        }
      })()
    `;

    const result = await runtimeAgent.invoke_evaluate({
      expression: wrappedCode,
      returnByValue: true,
      awaitPromise: true,
      timeout: Math.min(timeout, 30000),
      includeCommandLineAPI: false,
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Execution error');
    }

    const value = result.result?.value;

    // Check for error wrapper
    if (value && typeof value === 'object' && (value as { __skillError?: boolean }).__skillError) {
      throw new Error((value as { message: string }).message);
    }

    return value;
  }

  /**
   * Record test execution
   */
  private async recordTest(
    skillId: string,
    args: Record<string, unknown>,
    result: SkillExecutionResult,
    pageUrl: string
  ): Promise<void> {
    try {
      await SkillStorageManager.getInstance().recordTest(skillId, {
        skillId,
        args,
        result,
        pageUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn('Failed to record test:', error);
    }
  }

  /**
   * Get current page URL
   */
  private async getPageUrl(target: SDK.Target.Target): Promise<string> {
    const runtimeAgent = target.runtimeAgent();
    const result = await runtimeAgent.invoke_evaluate({
      expression: 'window.location.href',
      returnByValue: true,
    });
    return result.result?.value || '';
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(error: string, startTime: number, stack?: string): SkillExecutionResult {
    return {
      success: false,
      error,
      stack,
      executionTimeMs: Date.now() - startTime,
      capturedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Self-Healing Integration
  // ============================================================================

  /**
   * Attempt to self-heal a failed execution using LLM-driven recovery.
   */
  private async attemptSelfHealing(
    target: SDK.Target.Target,
    error: Error,
    skill: LearnedSkill,
    args: Record<string, unknown>,
    timeout: number
  ): Promise<SelfHealingResult | null> {
    // Check if error is healable
    const classifier = new SelfHealingErrorClassifier();
    const errorType = classifier.classify(error);

    if (!errorType) {
      logger.debug('Error is not healable', { message: error.message.substring(0, 100) });
      return null;
    }

    logger.info('Attempting self-healing', { errorType, skillName: skill.name });

    try {
      // Capture execution context
      const contextCapture = new SelfHealingContextCapture();
      const context = await contextCapture.captureContext(
        target,
        error,
        skill.source,
        { args }
      );

      // Run recovery loop
      const recoveryLoop = new SelfHealingRecoveryLoop();
      const result = await recoveryLoop.recover(target, context);

      logger.info('Self-healing completed', {
        success: result.success,
        attempts: result.attempts.length,
        healingTimeMs: result.healingTimeMs,
      });

      return result;
    } catch (healError) {
      logger.error('Self-healing failed with error', { error: healError });
      return null;
    }
  }

  /**
   * Patch skill source code with healed selector.
   */
  private patchSkillSource(
    source: string,
    originalSelector: string,
    healedSelector: string
  ): string {
    if (!originalSelector || !healedSelector) {
      return source;
    }

    // Escape special regex characters in the original selector
    const escaped = originalSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace the selector in the source
    // Handle both single and double quotes
    const patterns = [
      new RegExp(`(['"])${escaped}\\1`, 'g'),
      new RegExp(`\`${escaped}\``, 'g'),
    ];

    let patched = source;
    for (const pattern of patterns) {
      if (pattern.test(patched)) {
        patched = patched.replace(pattern, `"${healedSelector}"`);
        break;
      }
    }

    if (patched === source) {
      // Fallback: simple string replace
      patched = source.replace(originalSelector, healedSelector);
    }

    logger.debug('Patched skill source', {
      originalLength: source.length,
      patchedLength: patched.length,
      changed: patched !== source,
    });

    return patched;
  }

  /**
   * Record healing history for the skill.
   */
  private async recordHealingHistory(
    skill: LearnedSkill,
    healingResult: SelfHealingResult,
    pageUrl: string
  ): Promise<void> {
    if (!healingResult.success || !healingResult.healedSelector) {
      return;
    }

    const record: HealingRecord = {
      timestamp: new Date().toISOString(),
      originalSelector: healingResult.originalSelector,
      healedSelector: healingResult.healedSelector,
      attemptsNeeded: healingResult.attempts.length,
      healingTimeMs: healingResult.healingTimeMs,
      errorType: healingResult.errorType,
      pageUrl,
    };

    // Get current skill and update healing history
    const storageManager = SkillStorageManager.getInstance();
    const currentSkill = await storageManager.getSkill(skill.id);

    if (!currentSkill) {
      return;
    }

    const healingHistory = currentSkill.healingHistory || [];
    healingHistory.push(record);

    // Keep only last 10 healing records
    const trimmedHistory = healingHistory.slice(-10);

    await storageManager.updateSkill(skill.id, {
      // Note: We don't update the source automatically - user must confirm
    });

    logger.info('Recorded healing history', {
      skillId: skill.id,
      historyLength: trimmedHistory.length,
    });
  }

  // ============================================================================
  // Semantic Knowledge Integration
  // ============================================================================

  /**
   * Update semantic knowledge after successful skill execution.
   */
  private async updateSemanticKnowledge(
    skill: LearnedSkill,
    pageUrl: string,
    result: SkillExecutionResult
  ): Promise<void> {
    if (!result.success) {
      return;
    }

    try {
      const updater = SemanticKnowledgeUpdater.getInstance();
      await updater.updateKnowledge(skill.domain, {
        skillId: skill.id,
        skillName: skill.name,
        taskDescription: skill.description,
        executionResult: {
          success: result.success,
          output: result.output,
          error: result.error,
        },
        pageUrl,
      });
    } catch (error) {
      logger.warn('Failed to update semantic knowledge', { error });
    }
  }
}
