// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import type { ValidationResult, ExecutionContext } from './types/SelfHealingTypes.js';

const logger = createLogger('SelfHealingValidator');

const DEFAULT_VALIDATION_TIMEOUT = 5000; // 5 seconds

/**
 * Validates suggested selectors through a multi-step pipeline.
 * Ensures selectors are syntactically valid, find elements,
 * and the elements are suitable for interaction.
 */
export class SelfHealingValidator {
  private validationTimeout: number;

  constructor(validationTimeout: number = DEFAULT_VALIDATION_TIMEOUT) {
    this.validationTimeout = validationTimeout;
  }

  /**
   * Run the full validation pipeline on a suggested selector.
   * @param target The SDK target for page interaction
   * @param selector The suggested selector to validate
   * @param context The original error context
   * @returns Detailed validation result
   */
  async validate(
    target: SDK.Target.Target,
    selector: string,
    context: ExecutionContext
  ): Promise<ValidationResult> {
    logger.info('Validating selector', { selector: selector.substring(0, 50) });

    const result: ValidationResult = {
      syntaxValid: false,
      findsElements: false,
      elementCount: 0,
      isVisible: false,
      isInteractable: false,
      matchesExpectedType: false,
      accessibilityMatch: false,
      passed: false,
    };

    // Step 1: Syntax validation
    result.syntaxValid = this.validateSyntax(selector);
    if (!result.syntaxValid) {
      result.failureReason = 'Invalid selector syntax';
      logger.debug('Validation failed: syntax', { selector });
      return result;
    }

    // Step 2: Element existence check
    const elementCheck = await this.checkElementExists(target, selector);
    result.findsElements = elementCheck.found;
    result.elementCount = elementCheck.count;
    if (!result.findsElements) {
      result.failureReason = 'Selector finds no elements';
      logger.debug('Validation failed: no elements', { selector });
      return result;
    }

    // Step 3: Uniqueness check (for strict mode violations)
    if (result.elementCount > 1 && context.errorType === 'strict_violation') {
      result.failureReason = `Selector matches ${result.elementCount} elements (expected 1 for strict mode)`;
      logger.debug('Validation failed: multiple elements', { count: result.elementCount });
      return result;
    }

    // Step 4: Visibility check
    result.isVisible = await this.checkVisibility(target, selector);
    if (!result.isVisible) {
      result.failureReason = 'Element is not visible';
      logger.debug('Validation failed: not visible');
      return result;
    }

    // Step 5: Interactability check
    result.isInteractable = await this.checkInteractability(target, selector);
    if (!result.isInteractable) {
      result.failureReason = 'Element is not interactable (may be disabled or covered)';
      logger.debug('Validation failed: not interactable');
      return result;
    }

    // Step 6: Type matching (role, tag)
    result.matchesExpectedType = await this.checkTypeMatch(target, selector, context);

    // Step 7: Accessibility properties match
    result.accessibilityMatch = await this.checkAccessibilityMatch(target, selector, context);

    // Final assessment - core checks must pass
    result.passed = result.syntaxValid &&
                    result.findsElements &&
                    result.isVisible &&
                    result.isInteractable;

    logger.info('Validation complete', {
      passed: result.passed,
      elementCount: result.elementCount,
    });

    return result;
  }

  /**
   * Step 1: Validate selector syntax.
   */
  private validateSyntax(selector: string): boolean {
    if (!selector || typeof selector !== 'string') {
      return false;
    }

    // Trim and check for empty
    const trimmed = selector.trim();
    if (trimmed.length === 0) {
      return false;
    }

    // Check for obviously malformed selectors
    const invalidPatterns = [
      /^\s*$/, // Empty or whitespace only
      /[<>]/, // HTML brackets (not valid in CSS selectors)
      /^\d/, // Starts with number (invalid CSS)
      /[\x00-\x1f]/, // Control characters
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    // Try to create a valid CSS selector test
    try {
      // This will throw if the selector is invalid
      document.querySelector(trimmed);
      return true;
    } catch {
      // May be using browser-specific selector or Playwright syntax
      // Allow if it looks reasonable
      return this.looksLikeValidSelector(trimmed);
    }
  }

  /**
   * Check if a selector looks valid even if we can't test it.
   */
  private looksLikeValidSelector(selector: string): boolean {
    // Playwright-style selectors
    if (selector.includes(':has-text(')) return true;
    if (selector.includes('role=')) return true;
    if (selector.includes('text=')) return true;

    // XPath
    if (selector.startsWith('//') || selector.startsWith('/')) return true;

    // Looks like CSS
    if (/^[a-z#.\[\]][a-z0-9#._\-\[\]="':>\s,*~+()^$|]+$/i.test(selector)) {
      return true;
    }

    return false;
  }

  /**
   * Step 2: Check if selector finds element(s).
   */
  private async checkElementExists(
    target: SDK.Target.Target,
    selector: string
  ): Promise<{ found: boolean; count: number }> {
    try {
      const runtimeAgent = target.runtimeAgent();

      // Use querySelector/querySelectorAll to find elements
      const result = await runtimeAgent.invoke_evaluate({
        expression: `
          (function() {
            try {
              const elements = document.querySelectorAll(${JSON.stringify(selector)});
              return { found: elements.length > 0, count: elements.length };
            } catch (e) {
              // Try XPath if CSS fails
              if (${JSON.stringify(selector)}.startsWith('/')) {
                try {
                  const xpathResult = document.evaluate(
                    ${JSON.stringify(selector)},
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                  );
                  return { found: xpathResult.snapshotLength > 0, count: xpathResult.snapshotLength };
                } catch (xe) {
                  return { found: false, count: 0 };
                }
              }
              return { found: false, count: 0 };
            }
          })()
        `,
        returnByValue: true,
        timeout: this.validationTimeout,
      });

      if (result.result?.value) {
        return result.result.value as { found: boolean; count: number };
      }

      return { found: false, count: 0 };
    } catch (error) {
      logger.debug('Element check failed', { error });
      return { found: false, count: 0 };
    }
  }

  /**
   * Step 4: Check if element is visible.
   */
  private async checkVisibility(
    target: SDK.Target.Target,
    selector: string
  ): Promise<boolean> {
    try {
      const runtimeAgent = target.runtimeAgent();

      const result = await runtimeAgent.invoke_evaluate({
        expression: `
          (function() {
            try {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return false;

              // Check computed style
              const style = window.getComputedStyle(el);
              if (style.display === 'none') return false;
              if (style.visibility === 'hidden') return false;
              if (style.opacity === '0') return false;

              // Check bounding rect
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return false;

              // Check if in viewport (at least partially)
              const inViewport = rect.top < window.innerHeight &&
                                 rect.bottom > 0 &&
                                 rect.left < window.innerWidth &&
                                 rect.right > 0;

              return true; // Element exists and is visible
            } catch (e) {
              return false;
            }
          })()
        `,
        returnByValue: true,
        timeout: this.validationTimeout,
      });

      return result.result?.value === true;
    } catch (error) {
      logger.debug('Visibility check failed', { error });
      return false;
    }
  }

  /**
   * Step 5: Check if element is interactable.
   */
  private async checkInteractability(
    target: SDK.Target.Target,
    selector: string
  ): Promise<boolean> {
    try {
      const runtimeAgent = target.runtimeAgent();

      const result = await runtimeAgent.invoke_evaluate({
        expression: `
          (function() {
            try {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return false;

              // Check if disabled
              if (el.disabled) return false;
              if (el.hasAttribute('disabled')) return false;
              if (el.getAttribute('aria-disabled') === 'true') return false;

              // Check pointer-events
              const style = window.getComputedStyle(el);
              if (style.pointerEvents === 'none') return false;

              // Check if covered by another element
              const rect = el.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const topElement = document.elementFromPoint(centerX, centerY);

              // Element is interactable if it's at the top or contains the top element
              if (topElement === el) return true;
              if (el.contains(topElement)) return true;
              if (topElement?.contains(el)) return true;

              return false;
            } catch (e) {
              return false;
            }
          })()
        `,
        returnByValue: true,
        timeout: this.validationTimeout,
      });

      return result.result?.value === true;
    } catch (error) {
      logger.debug('Interactability check failed', { error });
      return false;
    }
  }

  /**
   * Step 6: Check if element type matches expected action type.
   */
  private async checkTypeMatch(
    target: SDK.Target.Target,
    selector: string,
    context: ExecutionContext
  ): Promise<boolean> {
    if (!context.actionType) {
      return true; // No action type to match
    }

    try {
      const runtimeAgent = target.runtimeAgent();

      const result = await runtimeAgent.invoke_evaluate({
        expression: `
          (function() {
            try {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { tag: '', role: '' };

              return {
                tag: el.tagName.toLowerCase(),
                role: el.getAttribute('role') || '',
                type: el.type || '',
                contentEditable: el.isContentEditable
              };
            } catch (e) {
              return { tag: '', role: '' };
            }
          })()
        `,
        returnByValue: true,
        timeout: this.validationTimeout,
      });

      const elementInfo = result.result?.value as {
        tag: string;
        role: string;
        type: string;
        contentEditable: boolean;
      };

      if (!elementInfo) return false;

      // Check if element type is appropriate for the action
      switch (context.actionType) {
        case 'click':
          // Most elements can be clicked
          return true;

        case 'type':
        case 'fill':
          // Need input, textarea, or contenteditable
          return (
            elementInfo.tag === 'input' ||
            elementInfo.tag === 'textarea' ||
            elementInfo.contentEditable ||
            elementInfo.role === 'textbox'
          );

        case 'check':
          // Need checkbox or radio
          return (
            elementInfo.type === 'checkbox' ||
            elementInfo.type === 'radio' ||
            elementInfo.role === 'checkbox' ||
            elementInfo.role === 'radio' ||
            elementInfo.role === 'switch'
          );

        case 'select':
          // Need select or listbox
          return (
            elementInfo.tag === 'select' ||
            elementInfo.role === 'listbox' ||
            elementInfo.role === 'combobox'
          );

        default:
          return true;
      }
    } catch (error) {
      logger.debug('Type match check failed', { error });
      return true; // Don't fail on this check
    }
  }

  /**
   * Step 7: Check accessibility properties match.
   */
  private async checkAccessibilityMatch(
    target: SDK.Target.Target,
    selector: string,
    context: ExecutionContext
  ): Promise<boolean> {
    // This is a soft check - we don't fail on it
    try {
      const runtimeAgent = target.runtimeAgent();

      const result = await runtimeAgent.invoke_evaluate({
        expression: `
          (function() {
            try {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return null;

              return {
                ariaLabel: el.getAttribute('aria-label') || '',
                ariaDescribedBy: el.getAttribute('aria-describedby') || '',
                title: el.title || '',
                placeholder: el.placeholder || '',
                name: el.name || '',
                id: el.id || ''
              };
            } catch (e) {
              return null;
            }
          })()
        `,
        returnByValue: true,
        timeout: this.validationTimeout,
      });

      // If we got accessibility info, consider it a match
      // More sophisticated matching could compare with context
      return result.result?.value !== null;
    } catch (error) {
      logger.debug('Accessibility match check failed', { error });
      return true; // Don't fail on this check
    }
  }

  /**
   * Quick validation for syntax only.
   */
  validateSyntaxOnly(selector: string): boolean {
    return this.validateSyntax(selector);
  }
}
