// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import { getAccessibilityTree } from '../common/utils.js';
import { SelfHealingErrorClassifier } from './SelfHealingErrorClassifier.js';
import type { ExecutionContext, HealableErrorType } from './types/SelfHealingTypes.js';

const logger = createLogger('SelfHealingContextCapture');

/**
 * Captures execution context for self-healing recovery.
 * Gathers all necessary information to help the LLM understand
 * what went wrong and suggest fixes.
 */
export class SelfHealingContextCapture {
  private classifier: SelfHealingErrorClassifier;

  constructor() {
    this.classifier = new SelfHealingErrorClassifier();
  }

  /**
   * Capture full execution context at error point.
   * @param target The SDK target for page interaction
   * @param error The error that occurred
   * @param sourceCode The skill source code
   * @param locals Local variables at time of error (if available)
   * @returns Complete execution context for recovery
   */
  async captureContext(
    target: SDK.Target.Target,
    error: Error,
    sourceCode: string,
    locals: Record<string, unknown> = {}
  ): Promise<ExecutionContext> {
    logger.info('Capturing execution context for self-healing');

    // Get current page URL
    const pageUrl = await this.getPageUrl(target);

    // Get accessibility tree
    let accessibilityTree = '';
    try {
      const treeResult = await getAccessibilityTree(target);
      accessibilityTree = treeResult.simplified;
    } catch (treeError) {
      logger.warn('Failed to get accessibility tree', { error: treeError });
      accessibilityTree = 'Failed to capture accessibility tree';
    }

    // Classify error
    const errorType = this.classifier.classify(error) || 'element_not_found';

    // Extract failing selector
    const failingSelector = this.classifier.extractSelector(error, sourceCode) || '';

    // Extract line number from stack trace
    const lineNumber = this.extractLineNumber(error);

    // Extract action type
    const actionType = this.classifier.extractActionType(error, sourceCode);

    // Filter locals to serializable values
    const filteredLocals = this.filterLocals(locals);

    const context: ExecutionContext = {
      sourceCode,
      lineNumber,
      locals: filteredLocals,
      failingSelector,
      pageUrl,
      accessibilityTree,
      errorMessage: error.message,
      errorType,
      actionType,
    };

    logger.info('Context captured', {
      errorType,
      failingSelector: failingSelector.substring(0, 50),
      hasAccessibilityTree: accessibilityTree.length > 0,
    });

    return context;
  }

  /**
   * Capture minimal context for quick classification.
   */
  async captureMinimalContext(
    target: SDK.Target.Target,
    error: Error,
    sourceCode: string
  ): Promise<{ errorType: HealableErrorType | null; failingSelector: string | null }> {
    const errorType = this.classifier.classify(error);
    const failingSelector = this.classifier.extractSelector(error, sourceCode);

    return { errorType, failingSelector };
  }

  /**
   * Get the current page URL.
   */
  private async getPageUrl(target: SDK.Target.Target): Promise<string> {
    try {
      const runtimeAgent = target.runtimeAgent();
      const result = await runtimeAgent.invoke_evaluate({
        expression: 'window.location.href',
        returnByValue: true,
      });
      return result.result?.value || '';
    } catch (error) {
      logger.warn('Failed to get page URL', { error });
      return '';
    }
  }

  /**
   * Extract line number from error stack trace.
   */
  private extractLineNumber(error: Error): number | undefined {
    if (!error.stack) {
      return undefined;
    }

    // Look for line numbers in stack trace
    // Format: "at <function> (<source>:<line>:<col>)" or "at <source>:<line>:<col>"
    const stackLines = error.stack.split('\n');

    for (const line of stackLines) {
      // Try to find line number in various formats
      const match = line.match(/:(\d+):\d+\)?$/);
      if (match) {
        return parseInt(match[1], 10);
      }

      // Also try format without column
      const simpleMatch = line.match(/:(\d+)\)?$/);
      if (simpleMatch) {
        return parseInt(simpleMatch[1], 10);
      }
    }

    return undefined;
  }

  /**
   * Filter locals to only serializable values and truncate large strings.
   */
  private filterLocals(locals: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    const maxStringLength = 500;
    const maxArrayLength = 10;

    for (const [key, value] of Object.entries(locals)) {
      try {
        if (value === null || value === undefined) {
          filtered[key] = value;
        } else if (typeof value === 'string') {
          filtered[key] = value.length > maxStringLength
            ? value.substring(0, maxStringLength) + '...'
            : value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          filtered[key] = value;
        } else if (Array.isArray(value)) {
          filtered[key] = value.slice(0, maxArrayLength).map(item => {
            if (typeof item === 'string' && item.length > maxStringLength) {
              return item.substring(0, maxStringLength) + '...';
            }
            if (typeof item === 'object') {
              return '[Object]';
            }
            return item;
          });
          if (value.length > maxArrayLength) {
            (filtered[key] as unknown[]).push(`... (${value.length - maxArrayLength} more)`);
          }
        } else if (typeof value === 'object') {
          // Shallow copy of object with limited depth
          filtered[key] = this.shallowSerialize(value);
        }
        // Skip functions and other non-serializable types
      } catch {
        // Skip values that can't be processed
        filtered[key] = '[unserializable]';
      }
    }

    return filtered;
  }

  /**
   * Create a shallow serializable representation of an object.
   */
  private shallowSerialize(obj: object): Record<string, string> {
    const result: Record<string, string> = {};
    const maxKeys = 10;
    let keyCount = 0;

    for (const [key, value] of Object.entries(obj)) {
      if (keyCount >= maxKeys) {
        result['...'] = `(${Object.keys(obj).length - maxKeys} more keys)`;
        break;
      }

      if (value === null) {
        result[key] = 'null';
      } else if (value === undefined) {
        result[key] = 'undefined';
      } else if (typeof value === 'string') {
        result[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        result[key] = String(value);
      } else if (typeof value === 'function') {
        result[key] = '[Function]';
      } else if (Array.isArray(value)) {
        result[key] = `[Array(${value.length})]`;
      } else {
        result[key] = '[Object]';
      }

      keyCount++;
    }

    return result;
  }

  /**
   * Get source code context around a specific line.
   */
  getSourceContext(sourceCode: string, lineNumber: number, contextLines: number = 3): string {
    const lines = sourceCode.split('\n');

    if (lineNumber < 1 || lineNumber > lines.length) {
      return sourceCode;
    }

    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length, lineNumber + contextLines);

    const contextParts: string[] = [];

    for (let i = startLine; i < endLine; i++) {
      const lineNum = i + 1;
      const prefix = lineNum === lineNumber ? '>>> ' : '    ';
      contextParts.push(`${prefix}${lineNum.toString().padStart(3)}: ${lines[i]}`);
    }

    return contextParts.join('\n');
  }
}
