// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider, PageContentAccessor } from './interfaces.js';

export const schemaExtractorInputSchema = z.object({
  schema: z.record(z.unknown()).describe('JSON schema defining the structure to extract'),
  instruction: z.string().describe('Natural language instruction for extraction'),
  reasoning: z.string().describe('Reasoning for the extraction'),
});

export const schemaExtractorOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.unknown(),
    metadata: z.object({
      progress: z.string(),
      completed: z.boolean(),
      reasoning: z.string().optional(),
      pageContext: z.string().optional(),
      missingFields: z.string().optional(),
    }).optional(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type SchemaExtractorInput = z.infer<typeof schemaExtractorInputSchema>;
export type SchemaExtractorOutput = z.infer<typeof schemaExtractorOutputSchema>;

/**
 * Tool for extracting structured data based on JSON schema
 */
export const schemaExtractor = createTool({
  id: 'extract_data',
  description: `Extracts structured data from a web page's DOM using a user-provided JSON schema and natural language instruction. Uses the page's accessibility tree for robust extraction.`,
  inputSchema: schemaExtractorInputSchema,
  outputSchema: schemaExtractorOutputSchema,
  metadata: {
    category: 'extraction',
    tags: ['extraction', 'schema', 'data', 'llm'],
    requiresRuntime: ['llmProvider', 'pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<SchemaExtractorOutput> => {
    const { schema, instruction, reasoning } = context as SchemaExtractorInput;

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
      const url = await pageAccessor.getURL();

      const systemPrompt = `You are a data extraction agent. Extract structured data from the accessibility tree according to the provided schema.

OUTPUT FORMAT: Return valid JSON matching the schema exactly.`;

      const userPrompt = `Extract data from this page:

URL: ${url}
INSTRUCTION: ${instruction}

SCHEMA:
${JSON.stringify(schema, null, 2)}

ACCESSIBILITY TREE:
${tree.substring(0, 4000)}

Return JSON matching the schema.`;

      const result = await llmProvider.generateText({
        model: 'gpt-4',
        messages: [{ role: 'user', content: userPrompt }],
        systemPrompt,
        temperature: 0,
      });

      try {
        const data = JSON.parse(result.text);
        return {
          success: true,
          data,
          metadata: {
            progress: 'complete',
            completed: true,
            reasoning: 'Data extracted successfully',
          },
        };
      } catch {
        return {
          success: false,
          error: 'Failed to parse extracted data',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Extraction failed',
      };
    }
  },
});
