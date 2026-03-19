// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { HealableErrorType } from './types/SelfHealingTypes.js';

const logger = createLogger('SelfHealingErrorClassifier');

/**
 * Patterns for classifying errors into healable categories.
 */
const ERROR_PATTERNS: Array<{
  type: HealableErrorType;
  patterns: RegExp[];
}> = [
  {
    type: 'timeout',
    patterns: [
      /timeout/i,
      /timed out/i,
      /waiting for/i,
      /not found within/i,
      /exceeded.*ms/i,
      /element not found in time/i,
    ],
  },
  {
    type: 'strict_violation',
    patterns: [
      /strict mode/i,
      /multiple elements/i,
      /resolved to \d+ elements/i,
      /expected single element/i,
      /more than one/i,
      /ambiguous selector/i,
    ],
  },
  {
    type: 'invalid_selector',
    patterns: [
      /invalid selector/i,
      /syntax error/i,
      /not a valid selector/i,
      /selector.*invalid/i,
      /parse.*selector/i,
      /malformed/i,
    ],
  },
  {
    type: 'element_not_found',
    patterns: [
      /no element found/i,
      /element not found/i,
      /cannot find element/i,
      /null/i,
      /undefined/i,
      /does not exist/i,
      /no matching/i,
    ],
  },
  {
    type: 'stale_reference',
    patterns: [
      /stale/i,
      /detached/i,
      /removed from document/i,
      /no longer attached/i,
      /element.*removed/i,
      /dom.*changed/i,
    ],
  },
];

/**
 * Patterns for extracting selectors from error messages.
 */
const SELECTOR_EXTRACTION_PATTERNS = [
  // CSS selectors in quotes
  /selector[:\s]+['"]([^'"]+)['"]/i,
  // querySelector patterns
  /querySelector(?:All)?\(['"]([^'"]+)['"]\)/i,
  // Waiting for patterns
  /waiting for ['"]([^'"]+)['"]/i,
  // Element patterns
  /element ['"]([^'"]+)['"]/i,
  // Fallback: anything in quotes after common keywords
  /(?:find|get|select|locate|click|type|fill)[^'"]*['"]([^'"]+)['"]/i,
];

/**
 * Classifies errors and determines if they can be healed.
 */
export class SelfHealingErrorClassifier {
  /**
   * Classify an error to determine if it's healable.
   * @param error The error to classify
   * @returns The error type if healable, null if not
   */
  classify(error: Error | string): HealableErrorType | null {
    const message = typeof error === 'string' ? error : error.message;
    const normalizedMessage = message.toLowerCase();

    for (const { type, patterns } of ERROR_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          logger.debug('Classified error', { type, message: message.substring(0, 100) });
          return type;
        }
      }
    }

    // Additional heuristic checks
    if (normalizedMessage.includes('null') || normalizedMessage.includes('undefined')) {
      // Could be element not found
      return 'element_not_found';
    }

    logger.debug('Error not healable', { message: message.substring(0, 100) });
    return null;
  }

  /**
   * Check if an error is healable.
   * @param error The error to check
   * @returns True if the error can potentially be healed
   */
  isHealable(error: Error | string): boolean {
    return this.classify(error) !== null;
  }

  /**
   * Extract the failing selector from an error message or stack trace.
   * @param error The error containing selector information
   * @param sourceCode Optional source code for context
   * @returns The extracted selector or null
   */
  extractSelector(error: Error | string, sourceCode?: string): string | null {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? '' : error.stack || '';

    // Try to extract from error message first
    for (const pattern of SELECTOR_EXTRACTION_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        logger.debug('Extracted selector from message', { selector: match[1] });
        return match[1];
      }
    }

    // Try to extract from stack trace
    for (const pattern of SELECTOR_EXTRACTION_PATTERNS) {
      const match = stack.match(pattern);
      if (match && match[1]) {
        logger.debug('Extracted selector from stack', { selector: match[1] });
        return match[1];
      }
    }

    // If source code provided, try to find selector near the error location
    if (sourceCode) {
      const selectorFromSource = this.extractSelectorFromSource(sourceCode, stack);
      if (selectorFromSource) {
        return selectorFromSource;
      }
    }

    logger.debug('Could not extract selector from error');
    return null;
  }

  /**
   * Extract action type from error context.
   * @param error The error
   * @param sourceCode Optional source code
   * @returns The action type (click, type, fill, etc.) or undefined
   */
  extractActionType(error: Error | string, sourceCode?: string): string | undefined {
    const message = typeof error === 'string' ? error : error.message;

    // Look for common action keywords
    const actionPatterns = [
      { pattern: /click/i, action: 'click' },
      { pattern: /type|input/i, action: 'type' },
      { pattern: /fill/i, action: 'fill' },
      { pattern: /hover/i, action: 'hover' },
      { pattern: /focus/i, action: 'focus' },
      { pattern: /select/i, action: 'select' },
      { pattern: /check|uncheck/i, action: 'check' },
      { pattern: /scroll/i, action: 'scroll' },
      { pattern: /wait/i, action: 'wait' },
    ];

    for (const { pattern, action } of actionPatterns) {
      if (pattern.test(message)) {
        return action;
      }
    }

    // Try source code if available
    if (sourceCode) {
      for (const { pattern, action } of actionPatterns) {
        if (pattern.test(sourceCode)) {
          return action;
        }
      }
    }

    return undefined;
  }

  /**
   * Try to extract selector from source code near error location.
   */
  private extractSelectorFromSource(sourceCode: string, stack: string): string | null {
    // Try to find line number from stack
    const lineMatch = stack.match(/:(\d+):\d+/);
    if (!lineMatch) {
      return null;
    }

    const lineNumber = parseInt(lineMatch[1], 10);
    const lines = sourceCode.split('\n');

    // Look at the error line and surrounding lines
    const startLine = Math.max(0, lineNumber - 2);
    const endLine = Math.min(lines.length, lineNumber + 2);

    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      if (!line) continue;

      // Look for selector patterns in the line
      for (const pattern of SELECTOR_EXTRACTION_PATTERNS) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      // Look for helpers.* calls which often contain selectors
      const helpersMatch = line.match(/helpers\.(?:click|type|getText|waitForElement)\(['"]([^'"]+)['"]/);
      if (helpersMatch && helpersMatch[1]) {
        return helpersMatch[1];
      }
    }

    return null;
  }

  /**
   * Get a human-readable description of an error type.
   */
  getErrorTypeDescription(type: HealableErrorType): string {
    switch (type) {
      case 'timeout':
        return 'Element was not found within the timeout period';
      case 'strict_violation':
        return 'Multiple elements matched when only one was expected';
      case 'invalid_selector':
        return 'The selector syntax is invalid';
      case 'element_not_found':
        return 'The element does not exist in the DOM';
      case 'stale_reference':
        return 'The element was removed from the page';
      default:
        return 'Unknown error type';
    }
  }
}
