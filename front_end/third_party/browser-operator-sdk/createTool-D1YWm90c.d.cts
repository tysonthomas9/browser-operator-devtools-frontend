import { z } from 'zod';
import { d as ToolExecutionContext, T as Tool } from './utils-CPLTWdHl.cjs';

/**
 * Configuration for creating a tool (following Mastra pattern)
 */
interface CreateToolConfig<TInput = unknown, TOutput = unknown, TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>, TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>> {
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
declare function createTool<TInput = unknown, TOutput = unknown, TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>, TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>>(config: CreateToolConfig<TInput, TOutput, TInputSchema, TOutputSchema>): Tool<TInput, TOutput, TInputSchema, TOutputSchema>;
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
declare function createSimpleTool<TInput = unknown, TOutput = unknown>(config: {
    id: string;
    description: string;
    execute: (input: TInput) => Promise<TOutput>;
    metadata?: {
        category?: string;
        tags?: string[];
        [key: string]: unknown;
    };
}): Tool<TInput, TOutput, any, any>;

export { type CreateToolConfig as C, createSimpleTool as a, createTool as c };
