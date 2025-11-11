// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider } from './interfaces.js';

export const critiqueInputSchema = z.object({
  content: z.string().describe('Content to critique and improve'),
  criteria: z.string().optional().describe('Specific criteria for the critique'),
  reasoning: z.string().describe('Reasoning for requesting the critique'),
});

export const critiqueOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    critique: z.string(),
    suggestions: z.array(z.string()),
    score: z.number().min(0).max(10),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type CritiqueInput = z.infer<typeof critiqueInputSchema>;
export type CritiqueOutput = z.infer<typeof critiqueOutputSchema>;

/**
 * Tool for critiquing and providing feedback on content
 */
export const critique = createTool({
  id: 'critique',
  description: 'Provides constructive critique and improvement suggestions for any content. Uses LLM to analyze quality, identify issues, and suggest concrete improvements.',
  inputSchema: critiqueInputSchema,
  outputSchema: critiqueOutputSchema,
  metadata: {
    category: 'thinking',
    tags: ['critique', 'review', 'feedback', 'llm'],
    requiresRuntime: ['llmProvider'],
  },
  execute: async ({ context, runtimeContext }): Promise<CritiqueOutput> => {
    const { content, criteria, reasoning } = context as CritiqueInput;

    const llmProvider = runtimeContext?.get<LLMProvider>('llmProvider');

    if (!llmProvider) {
      return {
        success: false,
        error: 'LLMProvider not available in runtime context',
      };
    }

    try {
      const criteriaSection = criteria ? `\nCRITERIA: ${criteria}` : '';

      const systemPrompt = `You are a constructive critic. Analyze content and provide actionable feedback.

OUTPUT FORMAT (JSON):
{
  "critique": "Overall assessment",
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "score": 7
}`;

      const userPrompt = `Critique this content:${criteriaSection}

CONTENT:
${content}

Provide constructive feedback with a score from 0-10.`;

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
          critique: parsed.critique,
          suggestions: parsed.suggestions,
          score: parsed.score,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to parse critique result',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Critique failed',
      };
    }
  },
});
