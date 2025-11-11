// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { z } from 'zod';
import type { Tool, ToolExecutionContext } from './types.js';

/**
 * Configuration for creating a tool (following Mastra pattern)
 */
export interface CreateToolConfig<
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
   * Description of what the tool does and when to use it
   * Keep it simple - focus on WHAT and WHEN, not HOW
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
   * Execute function - receives validated input via context
   */
  execute: (ctx: ToolExecutionContext<TInput>) => Promise<TOutput>;

  /**
   * Optional metadata
   */
  metadata?: {
    category?: string;
    tags?: string[];
    requiresAuth?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Create a tool following Mastra pattern
 *
 * @example
 * ```typescript
 * import { createTool } from '@browser-operator/core/tools';
 * import { z } from 'zod';
 *
 * const weatherTool = createTool({
 *   id: 'get_weather',
 *   description: 'Get current weather for a city',
 *   inputSchema: z.object({
 *     city: z.string().describe('City name'),
 *   }),
 *   outputSchema: z.object({
 *     temperature: z.number(),
 *     conditions: z.string(),
 *   }),
 *   execute: async ({ context }) => {
 *     const { city } = context;
 *     const weather = await fetchWeather(city);
 *     return weather;
 *   },
 * });
 * ```
 */
export function createTool<
  TInput = unknown,
  TOutput = unknown,
  TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>,
  TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>,
>(
  config: CreateToolConfig<TInput, TOutput, TInputSchema, TOutputSchema>,
): Tool<TInput, TOutput, TInputSchema, TOutputSchema> {
  return {
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: config.execute,
    metadata: config.metadata,
  };
}

/**
 * Create a simple tool with JSON schema instead of Zod (for convenience)
 * This is useful when you don't need input/output validation
 *
 * @example
 * ```typescript
 * const simpleTool = createSimpleTool({
 *   id: 'hello',
 *   description: 'Say hello',
 *   execute: async () => {
 *     return { message: 'Hello!' };
 *   },
 * });
 * ```
 */
export function createSimpleTool<TInput = unknown, TOutput = unknown>(config: {
  id: string;
  description: string;
  execute: (input: TInput) => Promise<TOutput>;
  metadata?: {
    category?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}): Tool<TInput, TOutput, any, any> {
  // Use any type for schemas since we're not validating
  const anySchema = {
    parse: (val: unknown) => val,
    safeParse: (val: unknown) => ({ success: true, data: val }),
  } as any;

  return {
    id: config.id,
    description: config.description,
    inputSchema: anySchema,
    outputSchema: anySchema,
    execute: async (ctx) => {
      return config.execute(ctx.context);
    },
    metadata: config.metadata,
  };
}
