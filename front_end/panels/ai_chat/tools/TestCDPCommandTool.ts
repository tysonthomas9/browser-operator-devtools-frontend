// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { Tool } from './Tools.js';
import { createLogger } from '../core/Logger.js';
import { TestExecutor } from '../mini_apps/apps/qa_agent/TestExecutor.js';
import type { CDPCommand, TestStep, StepResult, TestStepType } from '../mini_apps/apps/qa_agent/types.js';

const logger = createLogger('TestCDPCommandTool');

export interface TestCDPCommandArgs {
  cdpCommand: CDPCommand;
  description: string;
  timeout?: number;
}

export interface TestCDPCommandResult {
  success: boolean;
  status: 'passed' | 'failed';
  error?: string;
  screenshot?: string;  // Base64 PNG on failure
  duration: number;
  suggestion?: string;  // Remediation hint if failed
}

/**
 * Tool that executes a single CDP command and returns success/failure feedback.
 * Used by QATestGeneratorAgent to verify generated commands work.
 *
 * This enables a feedback loop where the agent can:
 * 1. Generate a CDP command
 * 2. Test it with this tool
 * 3. If it fails, read the error and suggestion
 * 4. Adjust the command and retry
 * 5. Only include verified working steps in the final output
 */
export class TestCDPCommandTool implements Tool<TestCDPCommandArgs, TestCDPCommandResult> {
  name = 'test_cdp_command';
  description = `Test a CDP command by executing it immediately on the current page. Returns success/failure with error details and screenshot on failure. Use this to verify each generated command works before including it in the final test.

IMPORTANT: Always test your generated CDP commands with this tool. Only include steps that pass testing in your final output.

Returns:
- success: boolean - Whether the command executed successfully
- status: 'passed' | 'failed'
- error: string (if failed) - Error message explaining what went wrong
- screenshot: string (if failed) - Base64 PNG screenshot showing page state
- suggestion: string (if failed) - Hint on how to fix the command`;

  schema = {
    type: 'object' as const,
    properties: {
      cdpCommand: {
        type: 'object',
        description: `The CDP command to execute. Use ONE of these command types:

NAVIGATION:
  { "navigate": { "url": "https://...", "waitUntil": "load|domcontentloaded|networkidle" } }

MOUSE ACTIONS:
  { "click": { "xpath": "//button[@id='submit']", "selector": "#submit", "text": "Submit" } }
  { "hover": { "xpath": "...", "selector": "...", "text": "..." } }

FORM INPUT:
  { "fill": { "xpath": "...", "selector": "...", "value": "text to fill" } }
  { "type": { "xpath": "...", "selector": "...", "value": "text", "delay": 50 } }
  { "press": { "xpath": "...", "key": "Enter|Tab|Escape" } }
  { "clear": { "xpath": "...", "selector": "..." } }

FORM CONTROLS:
  { "check": { "xpath": "...", "selector": "..." } }
  { "uncheck": { "xpath": "...", "selector": "..." } }
  { "selectOption": { "xpath": "...", "value": "optionValue", "label": "Option Text" } }

SCROLL:
  { "scroll": { "direction": "up|down|left|right|top|bottom", "amount": 300 } }
  { "scrollIntoView": { "xpath": "...", "selector": "...", "block": "center" } }

WAITS:
  { "wait": { "type": "load|networkidle|selector|hidden|timeout", "selector": "...", "timeout": 5000 } }

ASSERTIONS:
  { "assert": { "type": "visible|hidden|exists|textContains|urlContains|...", "selector": "...", "expected": "value" } }

SCREENSHOT:
  { "screenshot": { "fullPage": true|false } }`,
      },
      description: {
        type: 'string',
        description: 'Human-readable description of what this command does',
      },
      timeout: {
        type: 'number',
        description: 'Optional timeout in milliseconds (default: 30000)',
      },
    },
    required: ['cdpCommand', 'description'],
  };

  private executor = new TestExecutor();

  async execute(args: TestCDPCommandArgs): Promise<TestCDPCommandResult> {
    logger.info('Testing CDP command:', args.description);

    // Create a test step from the args
    const step: TestStep = {
      id: `test-${Date.now()}`,
      type: this.inferStepType(args.cdpCommand),
      description: args.description,
      cdpCommand: args.cdpCommand,
      timeout: args.timeout || 30000,
    };

    try {
      const result: StepResult = await this.executor.executeStep(step, args.timeout);

      if (result.status === 'passed') {
        logger.info('CDP command passed:', args.description);
        return {
          success: true,
          status: 'passed',
          duration: result.duration,
        };
      } else {
        // Generate remediation suggestion based on error
        const suggestion = this.getSuggestion(result.error || '', args.cdpCommand);

        logger.warn(`CDP command failed: ${args.description}`, { error: result.error });
        return {
          success: false,
          status: 'failed',
          error: result.error,
          screenshot: result.screenshot,
          duration: result.duration,
          suggestion,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('CDP command execution error:', errorMsg);

      return {
        success: false,
        status: 'failed',
        error: errorMsg,
        duration: 0,
        suggestion: 'An unexpected error occurred. Check if the page is loaded correctly and DevTools is connected.',
      };
    }
  }

  /**
   * Infer the step type from the CDP command
   */
  private inferStepType(cmd: CDPCommand): TestStepType {
    if (cmd.navigate) {
      return 'navigate';
    }
    if (cmd.click) {
      return 'click';
    }
    if (cmd.fill) {
      return 'fill';
    }
    if (cmd.type) {
      return 'type';
    }
    if (cmd.press) {
      return 'press';
    }
    if (cmd.hover) {
      return 'hover';
    }
    if (cmd.scroll || cmd.scrollIntoView) {
      return 'scroll';
    }
    if (cmd.wait) {
      return 'wait';
    }
    if (cmd.assert) {
      return 'assert';
    }
    if (cmd.screenshot) {
      return 'screenshot';
    }
    if (cmd.clear) {
      return 'clear';
    }
    if (cmd.check || cmd.uncheck || cmd.setChecked) {
      return 'check';
    }
    if (cmd.selectOption) {
      return 'selectOption';
    }
    if (cmd.switchToFrame || cmd.switchToMainFrame) {
      return 'switchFrame';
    }
    if (cmd.setInputFiles) {
      return 'fileUpload';
    }
    if (cmd.handleDialog) {
      return 'dialog';
    }
    return 'evaluate';
  }

  /**
   * Generate a remediation suggestion based on the error
   */
  private getSuggestion(error: string, cmd: CDPCommand): string {
    const lowerError = error.toLowerCase();

    // Element not found errors
    if (lowerError.includes('element not found') || lowerError.includes('no element') || lowerError.includes('no such element')) {
      const hints = [
        'Element not found. Try these fixes:',
        '1. Use a different selector - check the page structure with get_page_content',
        '2. Use text-based lookup: { "xpath": "//*[contains(text(), \'Button Text\')]" }',
        '3. Check if element is inside an iframe - use switchToFrame first',
        '4. Add a wait command before this action to ensure element is loaded',
        '5. Use more specific xpath: "//*[@data-testid=\'...\']" or "//*[@aria-label=\'...\']"',
      ];
      return hints.join('\n');
    }

    // Timeout errors
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return `Operation timed out. Try these fixes:
1. Add a wait command before this action: { "wait": { "type": "selector", "selector": "...", "timeout": 10000 } }
2. Increase the timeout for this command
3. Check if page is still loading - use { "wait": { "type": "networkidle" } }
4. Verify the page URL is correct`;
    }

    // Visibility errors
    if (lowerError.includes('not visible') || lowerError.includes('hidden') || lowerError.includes('not displayed')) {
      return `Element is not visible. Try these fixes:
1. Scroll element into view first: { "scrollIntoView": { "xpath": "..." } }
2. Wait for element to become visible: { "wait": { "type": "selector", "selector": "..." } }
3. Check if element is behind a modal or overlay
4. The element may be dynamically shown - add appropriate wait`;
    }

    // Interactability errors
    if (lowerError.includes('not interactable') || lowerError.includes('cannot click') || lowerError.includes('not clickable')) {
      return `Element is not interactable. Try these fixes:
1. Wait for animations to complete: { "wait": { "type": "timeout", "timeout": 500 } }
2. Scroll element into view: { "scrollIntoView": { "xpath": "..." } }
3. Check for overlapping elements that may be blocking clicks
4. Element may be disabled - check its enabled state`;
    }

    // Navigation errors
    if (lowerError.includes('navigation') || lowerError.includes('navigate') || lowerError.includes('net::')) {
      return `Navigation failed. Try these fixes:
1. Verify the URL is correct and accessible
2. Wait for page load: { "wait": { "type": "load" } } or { "wait": { "type": "networkidle" } }
3. Check if there are redirects that need handling
4. The page may require authentication`;
    }

    // Assertion errors
    if (lowerError.includes('assertion') || lowerError.includes('expected')) {
      return `Assertion failed. Try these fixes:
1. Verify the expected value is correct
2. Add a wait before the assertion to ensure the page state is updated
3. Use a more flexible assertion (textContains instead of textEquals)
4. Check if the selector is targeting the correct element`;
    }

    // Frame errors
    if (lowerError.includes('frame') || lowerError.includes('iframe')) {
      return `Frame error. Try these fixes:
1. Switch to the correct frame first: { "switchToFrame": { "selector": "iframe[name='...']" } }
2. After frame operations, switch back: { "switchToMainFrame": {} }
3. Verify the iframe exists and is loaded`;
    }

    // Generic fallback
    return `Command failed. Review these options:
1. Use get_page_content to inspect the current page structure
2. Take a screenshot to see the current state
3. Verify the selector/xpath targets the correct element
4. Add appropriate wait conditions before this action
5. Check if the page requires user interaction (login, accept cookies, etc.)`;
  }
}
