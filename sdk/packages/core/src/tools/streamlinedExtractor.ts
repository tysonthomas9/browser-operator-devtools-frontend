// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider, PageContentAccessor } from './interfaces.js';

export const streamlinedExtractorInputSchema = z.object({
  schema: z.record(z.unknown()).describe('Simplified JSON schema for extraction'),
  instruction: z.string().describe('Brief extraction instruction'),
});

export const streamlinedExtractorOutputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.unknown(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type StreamlinedExtractorInput = z.infer<typeof streamlinedExtractorInputSchema>;
export type StreamlinedExtractorOutput = z.infer<typeof streamlinedExtractorOutputSchema>;

/**
 * Streamlined version of schema-based extractor for simpler use cases
 */
export const streamlinedExtractor = createTool({
  id: 'extract_data_simple',
  description: 'Simplified data extraction tool for quick structured data extraction from web pages.',
  inputSchema: streamlinedExtractorInputSchema,
  outputSchema: streamlinedExtractorOutputSchema,
  metadata: {
    category: 'extraction',
    tags: ['extraction', 'simple', 'data'],
    requiresRuntime: ['llmProvider', 'pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<StreamlinedExtractorOutput> => {
    const { schema, instruction } = context as StreamlinedExtractorInput;

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

      const result = await llmProvider.generateText({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: `Extract: ${instruction}\n\nSchema: ${JSON.stringify(schema)}\n\nContent: ${tree.substring(0, 3000)}\n\nReturn JSON only.`
        }],
        temperature: 0,
      });

      const data = JSON.parse(result.text);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Extraction failed' };
    }
  },
});
