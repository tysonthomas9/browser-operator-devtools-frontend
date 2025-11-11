// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';

/**
 * Input schema for execute code tool
 */
export const executeCodeInputSchema = z.object({
  code: z.string().describe('JavaScript code to execute in the page context. Must be a valid expression or IIFE that returns a value.'),
  reasoning: z.string().describe('Explanation of what this code does and why you are executing it (shown to user)'),
});

/**
 * Output schema for execute code tool - returns any JSON-serializable value
 */
export const executeCodeOutputSchema = z.unknown();

export type ExecuteCodeInput = z.infer<typeof executeCodeInputSchema>;
export type ExecuteCodeOutput = unknown; // Can be any JSON-serializable value

/**
 * Interface for code executor that must be provided via runtime context
 * Handles execution of JavaScript code in a target environment (e.g., browser page, worker, etc.)
 */
export interface CodeExecutor {
  /**
   * Execute JavaScript code and return the result
   * @param code - JavaScript code to execute
   * @param options - Execution options
   * @returns The result value from code execution
   */
  execute(code: string, options?: {
    returnByValue?: boolean;
    awaitPromise?: boolean;
    timeout?: number;
  }): Promise<{
    success: boolean;
    value?: unknown;
    error?: string;
    exceptionDetails?: string;
  }>;
}

/**
 * Tool for executing arbitrary JavaScript code in a target execution context
 *
 * **Runtime Requirements:**
 * - `codeExecutor`: An instance of CodeExecutor must be provided in runtimeContext
 *
 * **Use Cases:**
 * - Extract all links from a page
 * - Get specific DOM elements with custom logic
 * - Extract table data
 * - Get computed styles
 * - Run custom JavaScript that doesn't fit schema-based extraction
 * - Check page state
 * - Extract images
 * - Get metadata
 *
 * **Important Notes:**
 * - Code executes in the target's JavaScript context with full API access
 * - Return values must be JSON-serializable (strings, numbers, objects, arrays)
 * - Use arrow functions or IIFEs for multi-line code
 * - DOM nodes cannot be returned directly - extract their properties instead
 *
 * @example
 * ```typescript
 * // Extract all links from a page
 * const result = await agent.generateText({
 *   prompt: "Get all links on the page",
 *   tools: { executeCode },
 *   runtimeContext: {
 *     codeExecutor: myCodeExecutor
 *   }
 * });
 *
 * // The agent might generate:
 * // code: "Array.from(document.links).map(a => ({text: a.textContent.trim(), href: a.href}))"
 * ```
 *
 * @example
 * ```typescript
 * // Extract product data
 * const result = await agent.generateText({
 *   prompt: "Extract all product names and prices",
 *   tools: { executeCode },
 *   runtimeContext: {
 *     codeExecutor: myCodeExecutor
 *   }
 * });
 *
 * // The agent might generate:
 * // code: "Array.from(document.querySelectorAll('.product')).map(p => ({
 * //   name: p.querySelector('.name')?.textContent,
 * //   price: p.querySelector('.price')?.textContent
 * // }))"
 * ```
 */
export const executeCode = createTool({
  id: 'execute_code',
  description: `Executes JavaScript code in the current page context and returns the raw result.

Use this tool when you need to:
- Extract all links from the page
- Get specific DOM elements with custom logic
- Extract table data
- Get computed styles
- Run custom JavaScript that doesn't fit schema-based extraction
- Check page state (document.readyState, window.location, etc.)
- Extract images
- Get metadata

The code executes in the page's JavaScript context with full DOM API access.
The raw JavaScript return value is returned directly without any parsing or wrapping.

Examples:
• Get all links: Array.from(document.links).map(a => ({text: a.textContent.trim(), href: a.href}))
• Extract product data: Array.from(document.querySelectorAll('.product')).map(p => ({name: p.querySelector('.name').textContent, price: p.querySelector('.price').textContent}))
• Get page metadata: ({title: document.title, url: location.href, images: document.images.length})
• Check element existence: !!document.querySelector('#login-button')`,
  inputSchema: executeCodeInputSchema,
  outputSchema: executeCodeOutputSchema,
  metadata: {
    category: 'execution',
    tags: ['code', 'javascript', 'dom', 'extraction'],
    requiresRuntime: ['codeExecutor'],
  },
  execute: async ({ context, runtimeContext }): Promise<ExecuteCodeOutput> => {
    const { code, reasoning } = context as ExecuteCodeInput;

    // Validate code
    if (typeof code !== 'string' || code.trim().length === 0) {
      return { error: 'Code must be a non-empty string' };
    }

    // Get code executor from runtime context
    const codeExecutor = runtimeContext?.get<CodeExecutor>('codeExecutor');

    if (!codeExecutor) {
      return {
        error: 'CodeExecutor not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      // Execute the code
      const result = await codeExecutor.execute(code, {
        returnByValue: true, // Return the actual value, not a remote object reference
        awaitPromise: true,  // Wait for promises to resolve
        timeout: 10000,      // 10 second timeout
      });

      // Check for errors
      if (!result.success) {
        return {
          error: result.error || 'Unknown error',
          exceptionDetails: result.exceptionDetails,
        };
      }

      // Return the raw result value directly
      return result.value;

    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
