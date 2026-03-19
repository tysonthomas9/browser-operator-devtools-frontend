// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';

const logger = createLogger('Tool:RunGeneratedTest');

/**
 * Arguments for running a generated test script
 */
export interface RunGeneratedTestArgs {
  script: string;
}

/**
 * Result from running a test script
 */
export interface TestExecutionResult {
  success: boolean;
  passed?: boolean;
  steps?: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    error?: string;
  }>;
  error?: string;
}

/**
 * Tool for executing generated JavaScript test scripts in the inspected page.
 *
 * This tool allows the QA Test Generator Agent to run its generated test scripts
 * and verify they work correctly. If a test fails, the agent can analyze the error
 * and regenerate a corrected script.
 */
export class RunGeneratedTestTool implements Tool<RunGeneratedTestArgs, TestExecutionResult> {
  name = 'run_generated_test';
  description = `Executes a JavaScript test script in the inspected page and returns the results.

Use this tool AFTER generating a test script to verify it works correctly.

The script should be a self-contained JavaScript IIFE that:
1. Runs test steps in the page context
2. Returns a results object with: { passed: boolean, steps: [...], error?: string }

If the test FAILS, analyze the error message and fix your script:
- "Element not found: #selector" → Fix the CSS selector
- "Timeout waiting for: .element" → Add longer wait or different selector
- "Expected X, got Y" → Fix the assertion logic

IMPORTANT: Keep retrying until the test PASSES (up to 3 attempts)`;

  schema = {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'The JavaScript test script to execute. Must be a self-contained IIFE that returns a results object.',
      },
    },
    required: ['script'],
  };

  async execute(args: RunGeneratedTestArgs, _ctx?: LLMContext): Promise<TestExecutionResult> {
    const { script } = args;

    if (typeof script !== 'string' || script.trim().length === 0) {
      return { success: false, error: 'Script must be a non-empty string' };
    }

    logger.info('Executing generated test script');
    logger.debug(`Script length: ${script.length} characters`);

    // Get the main target
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      return { success: false, error: 'No page target available. Please ensure a web page is open in the inspected window.' };
    }

    try {
      // Execute the script in the page context
      const result = await target.runtimeAgent().invoke_evaluate({
        expression: script,
        returnByValue: true,
        awaitPromise: true,
        timeout: 60000, // 60 second timeout for test execution
        userGesture: true, // Allow user-gesture-gated APIs like click
      });

      // Check for exceptions during execution
      if (result.exceptionDetails) {
        const errorMessage = result.exceptionDetails.text || 'Unknown error';
        const errorStack = result.exceptionDetails.exception?.description || '';

        logger.error(`Test script execution failed: ${errorMessage}`);
        logger.debug('Exception details:', result.exceptionDetails);

        // Extract the actual error message from the stack if available
        const actualError = errorStack || errorMessage;

        return {
          success: false,
          passed: false,
          error: actualError,
        };
      }

      // Parse the results from the script
      const scriptResult = result.result.value as {
        passed?: boolean;
        steps?: Array<{ name: string; status: string; error?: string }>;
        error?: string | null;
      } | undefined;

      if (!scriptResult) {
        logger.warn('Script did not return a results object');
        return {
          success: true,
          passed: true,
          steps: [],
          error: undefined,
        };
      }

      const passed = scriptResult.passed ?? false;
      const steps = (scriptResult.steps ?? []).map(step => ({
        name: step.name,
        status: step.status as 'passed' | 'failed' | 'skipped',
        error: step.error,
      }));

      logger.info(`Test execution completed: ${passed ? 'PASSED' : 'FAILED'}, ${steps.length} steps`);

      if (!passed && scriptResult.error) {
        logger.info(`Test failure reason: ${scriptResult.error}`);
      }

      return {
        success: true,
        passed,
        steps,
        error: scriptResult.error ?? undefined,
      };

    } catch (error) {
      logger.error('Error executing test script:', error);
      return {
        success: false,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
