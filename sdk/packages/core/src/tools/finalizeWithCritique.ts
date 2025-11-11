// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider } from './interfaces.js';

export const finalizeWithCritiqueInputSchema = z.object({
  result: z.string().describe('The result to finalize and critique'),
  criteria: z.string().optional().describe('Criteria for validation'),
  reasoning: z.string().describe('Reasoning for finalization'),
});

export const finalizeWithCritiqueOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    isValid: z.boolean(),
    critique: z.string(),
    improvements: z.array(z.string()),
    finalResult: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type FinalizeWithCritiqueInput = z.infer<typeof finalizeWithCritiqueInputSchema>;
export type FinalizeWithCritiqueOutput = z.infer<typeof finalizeWithCritiqueOutputSchema>;

/**
 * Tool for finalizing results with critique and validation
 */
export const finalizeWithCritique = createTool({
  id: 'finalize_with_critique',
  description: 'Validates and critiques a result before finalization, ensuring quality and completeness.',
  inputSchema: finalizeWithCritiqueInputSchema,
  outputSchema: finalizeWithCritiqueOutputSchema,
  metadata: {
    category: 'utilities',
    tags: ['finalize', 'critique', 'validation'],
    requiresRuntime: ['llmProvider'],
  },
  execute: async ({ context, runtimeContext }): Promise<FinalizeWithCritiqueOutput> => {
    const { result, criteria, reasoning } = context as FinalizeWithCritiqueInput;

    const llmProvider = runtimeContext?.get<LLMProvider>('llmProvider');

    if (!llmProvider) {
      return {
        success: false,
        error: 'LLMProvider not available',
      };
    }

    try {
      const criteriaSection = criteria ? `\nCRITERIA: ${criteria}` : '';

      const systemPrompt = `Validate and critique results. OUTPUT FORMAT (JSON):
{
  "isValid": true,
  "critique": "Assessment",
  "improvements": ["Improvement 1"],
  "finalResult": "Polished result"
}`;

      const response = await llmProvider.generateText({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: `Validate this result:${criteriaSection}\n\nRESULT:\n${result}\n\nProvide critique and final version.`
        }],
        systemPrompt,
        temperature: 0.3,
      });

      const parsed = JSON.parse(response.text);
      return {
        success: true,
        isValid: parsed.isValid,
        critique: parsed.critique,
        improvements: parsed.improvements,
        finalResult: parsed.finalResult,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Finalization failed' };
    }
  },
});
