// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider } from './interfaces.js';

export const sequentialThinkingInputSchema = z.object({
  problem: z.string().describe('Problem or question to think through'),
  steps: z.number().optional().describe('Number of thinking steps (default: 3)'),
  reasoning: z.string().describe('Reasoning for using sequential thinking'),
});

const thinkingStepSchema = z.object({
  step: z.number(),
  thought: z.string(),
  conclusion: z.string().optional(),
});

export const sequentialThinkingOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    steps: z.array(thinkingStepSchema),
    finalAnswer: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type SequentialThinkingInput = z.infer<typeof sequentialThinkingInputSchema>;
export type SequentialThinkingOutput = z.infer<typeof sequentialThinkingOutputSchema>;

/**
 * Tool for multi-step sequential thinking and reasoning
 */
export const sequentialThinking = createTool({
  id: 'sequential_thinking',
  description: 'Breaks down complex problems into sequential thinking steps, reasoning through each step before reaching a conclusion. Useful for complex decision-making and problem-solving.',
  inputSchema: sequentialThinkingInputSchema,
  outputSchema: sequentialThinkingOutputSchema,
  metadata: {
    category: 'thinking',
    tags: ['thinking', 'reasoning', 'sequential', 'llm'],
    requiresRuntime: ['llmProvider'],
  },
  execute: async ({ context, runtimeContext }): Promise<SequentialThinkingOutput> => {
    const { problem, steps = 3, reasoning } = context as SequentialThinkingInput;

    const llmProvider = runtimeContext?.get<LLMProvider>('llmProvider');

    if (!llmProvider) {
      return {
        success: false,
        error: 'LLMProvider not available in runtime context',
      };
    }

    try {
      const systemPrompt = `You are a systematic thinker. Break down problems into ${steps} sequential thinking steps.

OUTPUT FORMAT (JSON):
{
  "steps": [
    {"step": 1, "thought": "...", "conclusion": "..."},
    {"step": 2, "thought": "...", "conclusion": "..."}
  ],
  "finalAnswer": "Synthesized conclusion"
}`;

      const userPrompt = `Think through this problem in ${steps} sequential steps:

PROBLEM:
${problem}

Provide systematic reasoning for each step.`;

      const result = await llmProvider.generateText({
        model: 'gpt-4',
        messages: [{ role: 'user', content: userPrompt }],
        systemPrompt,
        temperature: 0.3,
      });

      try {
        const parsed = JSON.parse(result.text);
        return {
          success: true,
          steps: parsed.steps,
          finalAnswer: parsed.finalAnswer,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to parse thinking result',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Sequential thinking failed',
      };
    }
  },
});
