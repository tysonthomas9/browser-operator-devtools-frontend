// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider, PageContentAccessor } from './interfaces.js';

export const combinedExtractionInputSchema = z.object({
  extractors: z.array(z.object({
    name: z.string(),
    schema: z.record(z.unknown()),
    instruction: z.string(),
  })).describe('Multiple extractors to run'),
  reasoning: z.string(),
});

export const combinedExtractionOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    results: z.array(z.object({
      name: z.string(),
      data: z.unknown(),
      success: z.boolean(),
      error: z.string().optional(),
    })),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type CombinedExtractionInput = z.infer<typeof combinedExtractionInputSchema>;
export type CombinedExtractionOutput = z.infer<typeof combinedExtractionOutputSchema>;

/**
 * Tool for running multiple extractions in one call
 */
export const combinedExtraction = createTool({
  id: 'combined_extraction',
  description: 'Runs multiple data extractions in a single operation, useful for extracting different types of data from the same page.',
  inputSchema: combinedExtractionInputSchema,
  outputSchema: combinedExtractionOutputSchema,
  metadata: {
    category: 'extraction',
    tags: ['extraction', 'combined', 'batch'],
    requiresRuntime: ['llmProvider', 'pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<CombinedExtractionOutput> => {
    const { extractors, reasoning } = context as CombinedExtractionInput;

    const llmProvider = runtimeContext?.get<LLMProvider>('llmProvider');
    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');

    if (!llmProvider || !pageAccessor) {
      return {
        success: false,
        error: 'Required runtime dependencies not available',
      };
    }

    try {
      const tree = await pageAccessor.getAccessibilityTree();
      const results: Array<{ name: string; data: unknown; success: boolean; error?: string }> = [];

      for (const extractor of extractors) {
        try {
          const result = await llmProvider.generateText({
            model: 'gpt-4',
            messages: [{
              role: 'user',
              content: `Extract: ${extractor.instruction}\n\nSchema: ${JSON.stringify(extractor.schema)}\n\nContent: ${tree.substring(0, 2000)}\n\nReturn JSON.`
            }],
            temperature: 0,
          });

          const data = JSON.parse(result.text);
          results.push({ name: extractor.name, data, success: true });
        } catch (error: any) {
          results.push({ name: extractor.name, data: null, success: false, error: error?.message });
        }
      }

      return { success: true, results };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Combined extraction failed' };
    }
  },
});
