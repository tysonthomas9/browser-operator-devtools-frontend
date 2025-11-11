// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { PageContentAccessor } from './interfaces.js';

export const accessibilityTreeInputSchema = z.object({
  reasoning: z.string().describe('Reasoning for extracting accessibility tree'),
});

export const accessibilityTreeOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    simplified: z.string(),
    full: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type AccessibilityTreeInput = z.infer<typeof accessibilityTreeInputSchema>;
export type AccessibilityTreeOutput = z.infer<typeof accessibilityTreeOutputSchema>;

/**
 * Tool for extracting page accessibility tree as markdown
 */
export const accessibilityTreeToMarkdown = createTool({
  id: 'get_accessibility_tree',
  description: 'Extracts the full page accessibility tree as structured markdown, capturing all interactive elements, semantic structure, and content hierarchy.',
  inputSchema: accessibilityTreeInputSchema,
  outputSchema: accessibilityTreeOutputSchema,
  metadata: {
    category: 'web',
    tags: ['accessibility', 'tree', 'extraction', 'markdown'],
    requiresRuntime: ['pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<AccessibilityTreeOutput> => {
    const { reasoning } = context as AccessibilityTreeInput;

    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');

    if (!pageAccessor) {
      return {
        success: false,
        error: 'PageContentAccessor not available in runtime context',
      };
    }

    try {
      const tree = await pageAccessor.getAccessibilityTree();

      // Both simplified and full are the same for now
      // In the original tool, there's more processing
      return {
        success: true,
        simplified: tree,
        full: tree,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to extract accessibility tree',
      };
    }
  },
});
