// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { z } from 'zod';

/**
 * Runtime context that can be passed to tools for request-specific values
 */
export interface ToolRuntimeContext {
  /**
   * Get a value from the runtime context by key
   */
  get<T = unknown>(key: string): T | undefined;

  /**
   * Set a value in the runtime context
   */
  set<T = unknown>(key: string, value: T): void;

  /**
   * Check if a key exists in the runtime context
   */
  has(key: string): boolean;
}

/**
 * Execution context passed to tool execute functions
 */
export interface ToolExecutionContext<TInput> {
  /**
   * The validated input arguments for the tool
   */
  context: TInput;

  /**
   * Runtime context for request-specific values (e.g., user tier, auth tokens)
   */
  runtimeContext?: ToolRuntimeContext;

  /**
   * Abort signal for cancelling long-running operations
   */
  abortSignal?: AbortSignal;
}

/**
 * Result of a tool execution
 */
export interface ToolResult<TOutput> {
  /**
   * The output data from the tool
   */
  output: TOutput;

  /**
   * Optional metadata about the execution
   */
  metadata?: {
    /**
     * Execution time in milliseconds
     */
    executionTime?: number;

    /**
     * Any additional metadata
     */
    [key: string]: unknown;
  };
}

/**
 * Tool definition following Mastra pattern with Zod schemas
 */
export interface Tool<
  TInput = unknown,
  TOutput = unknown,
  TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>,
  TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>,
> {
  /**
   * Unique identifier for the tool
   */
  id: string;

  /**
   * Human-readable description of what the tool does and when to use it.
   * Keep it simple and focused on WHAT and WHEN.
   */
  description: string;

  /**
   * Zod schema for input validation
   */
  inputSchema: TInputSchema;

  /**
   * Zod schema for output validation
   */
  outputSchema: TOutputSchema;

  /**
   * Execute the tool with validated input
   */
  execute: (ctx: ToolExecutionContext<TInput>) => Promise<TOutput>;

  /**
   * Optional metadata about the tool
   */
  metadata?: {
    /**
     * Category for organizing tools
     */
    category?: string;

    /**
     * Tags for searchability
     */
    tags?: string[];

    /**
     * Whether the tool requires authentication
     */
    requiresAuth?: boolean;

    /**
     * Any additional metadata
     */
    [key: string]: unknown;
  };
}

/**
 * Tool call from LLM (OpenAI function calling format)
 */
export interface ToolCall {
  /**
   * Unique ID for this tool call
   */
  id: string;

  /**
   * The name/ID of the tool to call
   */
  name: string;

  /**
   * Arguments as JSON string
   */
  arguments: string;
}

/**
 * Tool call result to send back to LLM
 */
export interface ToolCallResult {
  /**
   * The tool call ID this is a result for
   */
  toolCallId: string;

  /**
   * The result as a string
   */
  result: string;

  /**
   * Whether the tool call succeeded
   */
  success: boolean;

  /**
   * Optional error message if failed
   */
  error?: string;
}

/**
 * Tool set type for agent configuration
 */
export type ToolSet = Record<string, Tool<any, any, any, any>>;

/**
 * Convert tool to OpenAI function definition format
 */
export interface OpenAIFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Whether to validate output
   */
  validateOutput?: boolean;

  /**
   * Custom abort signal
   */
  abortSignal?: AbortSignal;

  /**
   * Runtime context values
   */
  runtimeContext?: Record<string, unknown>;
}
