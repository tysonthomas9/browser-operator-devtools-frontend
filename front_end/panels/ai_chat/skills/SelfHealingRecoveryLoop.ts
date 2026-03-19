// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import { LLMConfigurationManager } from '../core/LLMConfigurationManager.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { SelfHealingMCQGenerator } from './SelfHealingMCQGenerator.js';
import { SelfHealingValidator } from './SelfHealingValidator.js';
import { SelfHealingContextCapture } from './SelfHealingContextCapture.js';
import { getAccessibilityTree } from '../common/utils.js';
import type {
  ExecutionContext,
  ElementOption,
  RecoveryAttempt,
  SelfHealingResult,
  SelectorSuggestion,
  SelfHealingOptions,
  DEFAULT_SELF_HEALING_CONFIG,
} from './types/SelfHealingTypes.js';
import type { LLMMessage } from '../LLM/LLMTypes.js';

const logger = createLogger('SelfHealingRecoveryLoop');

const RECOVERY_SYSTEM_PROMPT = `You are helping fix a broken web automation selector. The original selector failed to find the expected element.

Your task is to:
1. Analyze the error and understand what element was being targeted
2. Review the available elements from the accessibility tree
3. Select the most appropriate replacement element
4. Provide the correct selector

You MUST respond in valid JSON format:
{
  "selectedOption": "A",
  "selector": "button:has-text(\\"Submit\\")",
  "reasoning": "The original selector targeted a submit button. Option A is a button with 'Submit' text which matches the intent.",
  "confidence": 0.9
}

Rules:
- selectedOption must be one of the provided options (A, B, C, etc.)
- selector must be a valid CSS selector or Playwright-style selector
- confidence is a number between 0 and 1
- Be concise but thorough in your reasoning`;

/**
 * Orchestrates the self-healing recovery loop.
 * Uses LLM to suggest selector fixes and validates them.
 */
export class SelfHealingRecoveryLoop {
  private maxAttempts: number;
  private conversationHistory: LLMMessage[] = [];
  private mcqGenerator: SelfHealingMCQGenerator;
  private validator: SelfHealingValidator;
  private contextCapture: SelfHealingContextCapture;

  constructor(options: SelfHealingOptions = {}) {
    this.maxAttempts = options.maxAttempts || 5;
    this.mcqGenerator = new SelfHealingMCQGenerator();
    this.validator = new SelfHealingValidator(options.validationTimeout);
    this.contextCapture = new SelfHealingContextCapture();
  }

  /**
   * Run the recovery loop to find a working selector.
   * @param target The SDK target
   * @param context The execution context with error details
   * @returns Recovery result with healed selector or failure info
   */
  async recover(
    target: SDK.Target.Target,
    context: ExecutionContext
  ): Promise<SelfHealingResult> {
    const startTime = Date.now();
    const attempts: RecoveryAttempt[] = [];
    this.conversationHistory = [];

    logger.info('Starting self-healing recovery', {
      errorType: context.errorType,
      failingSelector: context.failingSelector.substring(0, 50),
    });

    // Get LLM configuration
    const configManager = LLMConfigurationManager.getInstance();
    const config = configManager.getConfiguration();

    if (!config.provider || !config.mainModel) {
      logger.warn('LLM not configured, cannot perform self-healing');
      return {
        success: false,
        attempts: [],
        finalError: 'LLM not configured',
        disableFunction: false,
        healingTimeMs: Date.now() - startTime,
        originalSelector: context.failingSelector,
        errorType: context.errorType,
      };
    }

    for (let i = 1; i <= this.maxAttempts; i++) {
      logger.debug(`Recovery attempt ${i}/${this.maxAttempts}`);

      try {
        // Refresh accessibility tree for each attempt
        const treeResult = await getAccessibilityTree(target);
        context.accessibilityTree = treeResult.simplified;

        // Generate MCQ options from current page state
        const options = this.mcqGenerator.generateOptions(
          context.accessibilityTree,
          context,
          5 // Max options
        );

        if (options.length === 0) {
          logger.warn('No MCQ options generated, page may have changed');
          continue;
        }

        // Ask LLM to select the correct element
        const suggestion = await this.askLLMForSelector(
          context,
          options,
          attempts,
          config.provider,
          config.mainModel
        );

        if (!suggestion) {
          logger.warn('No suggestion from LLM');
          continue;
        }

        // Validate the suggested selector
        const validation = await this.validator.validate(
          target,
          suggestion.selector,
          context
        );

        const attempt: RecoveryAttempt = {
          attemptNumber: i,
          suggestedSelector: suggestion.selector,
          selectedOption: suggestion.selectedOption,
          reasoning: suggestion.reasoning,
          validation,
          success: validation.passed,
          timestamp: new Date().toISOString(),
        };
        attempts.push(attempt);

        if (validation.passed) {
          logger.info('Self-healing successful', {
            attempt: i,
            selector: suggestion.selector.substring(0, 50),
          });

          return {
            success: true,
            healedSelector: suggestion.selector,
            attempts,
            disableFunction: false,
            healingTimeMs: Date.now() - startTime,
            originalSelector: context.failingSelector,
            errorType: context.errorType,
          };
        }

        // Add validation feedback to conversation for next attempt
        this.addValidationFeedback(suggestion, validation);
      } catch (error) {
        logger.error('Error in recovery attempt', { attempt: i, error });
      }
    }

    // All attempts failed
    logger.warn('Self-healing failed after all attempts', {
      attempts: attempts.length,
    });

    return {
      success: false,
      attempts,
      finalError: `Failed to heal after ${this.maxAttempts} attempts`,
      disableFunction: true, // Consider disabling the broken function
      healingTimeMs: Date.now() - startTime,
      originalSelector: context.failingSelector,
      errorType: context.errorType,
    };
  }

  /**
   * Ask LLM to suggest a selector from the MCQ options.
   */
  private async askLLMForSelector(
    context: ExecutionContext,
    options: ElementOption[],
    previousAttempts: RecoveryAttempt[],
    provider: string,
    model: string
  ): Promise<SelectorSuggestion | null> {
    try {
      // Build user message with context and options
      const userMessage = this.buildUserMessage(context, options, previousAttempts);

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      const llmClient = LLMClient.getInstance();
      const response = await llmClient.call({
        provider: provider as any,
        model,
        systemPrompt: RECOVERY_SYSTEM_PROMPT,
        messages: this.conversationHistory,
        temperature: 0.2, // Low temperature for consistent responses
      });

      if (!response.text) {
        logger.warn('Empty LLM response');
        return null;
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.text,
      });

      // Parse the response
      return this.parseResponse(response.text);
    } catch (error) {
      logger.error('Failed to get LLM suggestion', { error });
      return null;
    }
  }

  /**
   * Build the user message for the LLM.
   */
  private buildUserMessage(
    context: ExecutionContext,
    options: ElementOption[],
    previousAttempts: RecoveryAttempt[]
  ): string {
    const parts: string[] = [];

    // Error context
    parts.push('## Error Information');
    parts.push(`- **Failing Selector:** \`${context.failingSelector}\``);
    parts.push(`- **Error Type:** ${context.errorType}`);
    parts.push(`- **Error Message:** ${context.errorMessage}`);
    if (context.actionType) {
      parts.push(`- **Action:** ${context.actionType}`);
    }
    parts.push('');

    // Source context if available
    if (context.lineNumber) {
      const contextCapture = new SelfHealingContextCapture();
      const sourceContext = contextCapture.getSourceContext(
        context.sourceCode,
        context.lineNumber
      );
      parts.push('## Source Code Context');
      parts.push('```javascript');
      parts.push(sourceContext);
      parts.push('```');
      parts.push('');
    }

    // MCQ options
    parts.push('## Available Elements (Choose One)');
    parts.push(this.mcqGenerator.formatOptionsForPrompt(options));
    parts.push('');

    // Previous attempts if any
    if (previousAttempts.length > 0) {
      parts.push('## Previous Attempts');
      for (const attempt of previousAttempts) {
        parts.push(`- Attempt ${attempt.attemptNumber}: \`${attempt.suggestedSelector}\``);
        parts.push(`  - Result: ${attempt.validation.passed ? 'SUCCESS' : 'FAILED'}`);
        if (attempt.validation.failureReason) {
          parts.push(`  - Reason: ${attempt.validation.failureReason}`);
        }
      }
      parts.push('');
    }

    parts.push('Please select the best matching element and provide a valid selector.');

    return parts.join('\n');
  }

  /**
   * Parse the LLM response into a selector suggestion.
   */
  private parseResponse(response: string): SelectorSuggestion | null {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();

      // Handle markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.selectedOption || !parsed.selector) {
        logger.warn('Missing required fields in LLM response');
        return null;
      }

      return {
        selectedOption: String(parsed.selectedOption),
        selector: String(parsed.selector),
        reasoning: String(parsed.reasoning || ''),
        confidence: parseFloat(parsed.confidence) || 0.5,
      };
    } catch (error) {
      logger.warn('Failed to parse LLM response as JSON', { response: response.substring(0, 200) });

      // Try to extract information from non-JSON response
      return this.parseUnstructuredResponse(response);
    }
  }

  /**
   * Attempt to parse a non-JSON response.
   */
  private parseUnstructuredResponse(response: string): SelectorSuggestion | null {
    // Try to find option selection (e.g., "I select option A" or "A)")
    const optionMatch = response.match(/(?:select|choose|pick|option)\s*[:\s]*([A-E])|^([A-E])\)/im);
    if (!optionMatch) {
      return null;
    }

    const selectedOption = (optionMatch[1] || optionMatch[2]).toUpperCase();

    // Try to find selector in backticks or quotes
    const selectorMatch = response.match(/`([^`]+)`|"([^"]+)"|'([^']+)'/);
    const selector = selectorMatch
      ? (selectorMatch[1] || selectorMatch[2] || selectorMatch[3])
      : '';

    if (!selector) {
      return null;
    }

    return {
      selectedOption,
      selector,
      reasoning: response.substring(0, 200),
      confidence: 0.5,
    };
  }

  /**
   * Add validation feedback to conversation history.
   */
  private addValidationFeedback(
    suggestion: SelectorSuggestion,
    validation: import('./types/SelfHealingTypes.js').ValidationResult
  ): void {
    const feedbackParts: string[] = [
      'Your previous suggestion did not work.',
      '',
      `**Selector:** \`${suggestion.selector}\``,
      `**Validation Failed:** ${validation.failureReason || 'Unknown reason'}`,
      '',
      'Details:',
      `- Syntax valid: ${validation.syntaxValid}`,
      `- Finds elements: ${validation.findsElements}`,
      `- Element count: ${validation.elementCount}`,
      `- Is visible: ${validation.isVisible}`,
      `- Is interactable: ${validation.isInteractable}`,
      '',
      'Please try a different selector or option.',
    ];

    this.conversationHistory.push({
      role: 'user',
      content: feedbackParts.join('\n'),
    });
  }

  /**
   * Create a recovery result for when recovery is skipped.
   */
  static createSkippedResult(
    reason: string,
    originalSelector: string,
    errorType: import('./types/SelfHealingTypes.js').HealableErrorType
  ): SelfHealingResult {
    return {
      success: false,
      attempts: [],
      finalError: reason,
      disableFunction: false,
      healingTimeMs: 0,
      originalSelector,
      errorType,
    };
  }
}
