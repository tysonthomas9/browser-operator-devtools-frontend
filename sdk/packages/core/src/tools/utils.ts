// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import type {
  Tool,
  OpenAIFunctionDefinition,
  ToolRuntimeContext,
  ToolExecutionOptions,
  ToolCallResult,
} from './types.js';

/**
 * Simple runtime context implementation
 */
export class RuntimeContext implements ToolRuntimeContext {
  private data: Map<string, unknown> = new Map();

  constructor(initialData?: Record<string, unknown>) {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        this.data.set(key, value);
      });
    }
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  set<T = unknown>(key: string, value: T): void {
    this.data.set(key, value);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  clear(): void {
    this.data.clear();
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }
}

/**
 * Convert Zod schema to OpenAI function definition format
 * This is a simplified converter - may need to be expanded for complex schemas
 */
export function zodToOpenAISchema(schema: z.ZodType<any>): {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
} {
  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodType<any>;
      properties[key] = zodTypeToJsonSchema(zodType);

      // Check if field is required
      if (!(zodType instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  // Fallback for non-object schemas
  return {
    type: 'object',
    properties: {},
  };
}

/**
 * Convert individual Zod type to JSON Schema
 */
function zodTypeToJsonSchema(zodType: z.ZodType<any>): Record<string, unknown> {
  // Handle optional
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }

  // Handle nullable
  if (zodType instanceof z.ZodNullable) {
    return {
      ...zodTypeToJsonSchema(zodType.unwrap()),
      nullable: true,
    };
  }

  // Handle string
  if (zodType instanceof z.ZodString) {
    const schema: Record<string, unknown> = { type: 'string' };
    // @ts-ignore - accessing internal description
    if (zodType.description) {
      // @ts-ignore
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle number
  if (zodType instanceof z.ZodNumber) {
    const schema: Record<string, unknown> = { type: 'number' };
    // @ts-ignore
    if (zodType.description) {
      // @ts-ignore
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle boolean
  if (zodType instanceof z.ZodBoolean) {
    const schema: Record<string, unknown> = { type: 'boolean' };
    // @ts-ignore
    if (zodType.description) {
      // @ts-ignore
      schema.description = zodType.description;
    }
    return schema;
  }

  // Handle array
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(zodType.element),
    };
  }

  // Handle enum
  if (zodType instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: zodType.options,
    };
  }

  // Handle object
  if (zodType instanceof z.ZodObject) {
    return zodToOpenAISchema(zodType);
  }

  // Default fallback
  return { type: 'string' };
}

/**
 * Convert tool to OpenAI function definition
 */
export function toolToOpenAIFunction(tool: Tool<any, any, any, any>): OpenAIFunctionDefinition {
  const parameters = zodToOpenAISchema(tool.inputSchema);

  return {
    name: tool.id,
    description: tool.description,
    parameters,
  };
}

/**
 * Convert multiple tools to OpenAI function definitions
 */
export function toolsToOpenAIFunctions(
  tools: Record<string, Tool<any, any, any, any>>,
): OpenAIFunctionDefinition[] {
  return Object.values(tools).map(toolToOpenAIFunction);
}

/**
 * Execute a tool with timeout and validation
 */
export async function executeTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput, any, any>,
  input: TInput,
  options?: ToolExecutionOptions,
): Promise<TOutput> {
  const startTime = Date.now();

  // Validate input
  const parsedInput = tool.inputSchema.parse(input);

  // Create runtime context
  const runtimeContext = new RuntimeContext(options?.runtimeContext);

  // Create abort signal with timeout
  const controller = new AbortController();
  const abortSignal = options?.abortSignal || controller.signal;

  let timeoutId: number | undefined;
  if (options?.timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout) as unknown as number;
  }

  try {
    // Execute tool
    const output = await tool.execute({
      context: parsedInput,
      runtimeContext,
      abortSignal,
    });

    // Validate output if requested
    if (options?.validateOutput !== false) {
      const parsedOutput = tool.outputSchema.parse(output);
      return parsedOutput;
    }

    return output;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Execute a tool call from LLM and return formatted result
 */
export async function executeToolCall(
  tools: Record<string, Tool<any, any, any, any>>,
  toolCallId: string,
  toolName: string,
  args: string,
  options?: ToolExecutionOptions,
): Promise<ToolCallResult> {
  try {
    // Find tool
    const tool = tools[toolName];
    if (!tool) {
      return {
        toolCallId,
        result: `Error: Tool '${toolName}' not found`,
        success: false,
        error: `Tool '${toolName}' not found`,
      };
    }

    // Parse arguments
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(args);
    } catch (error) {
      return {
        toolCallId,
        result: `Error: Invalid JSON arguments: ${String(error)}`,
        success: false,
        error: `Invalid JSON arguments: ${String(error)}`,
      };
    }

    // Execute tool
    const output = await executeTool(tool, parsedArgs, options);

    // Format result as string
    const resultString =
      typeof output === 'string' ? output : JSON.stringify(output, null, 2);

    return {
      toolCallId,
      result: resultString,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      toolCallId,
      result: `Error: ${errorMessage}`,
      success: false,
      error: errorMessage,
    };
  }
}
