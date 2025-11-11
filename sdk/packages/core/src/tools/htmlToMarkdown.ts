// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { HTMLToMarkdownConverter, PageContentAccessor } from './interfaces.js';

export const htmlToMarkdownInputSchema = z.object({
  instruction: z.string().optional().describe('Natural language instruction for the extraction agent'),
  reasoning: z.string().describe('Reasoning about the extraction process displayed to the user'),
});

export const htmlToMarkdownOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    markdownContent: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type HTMLToMarkdownInput = z.infer<typeof htmlToMarkdownInputSchema>;
export type HTMLToMarkdownOutput = z.infer<typeof htmlToMarkdownOutputSchema>;

/**
 * Tool for extracting main article content and converting to Markdown
 */
export const htmlToMarkdown = createTool({
  id: 'html_to_markdown',
  description: 'Extracts the main article content from a webpage and converts it to well-formatted Markdown, removing ads, navigation, and other distracting elements.',
  inputSchema: htmlToMarkdownInputSchema,
  outputSchema: htmlToMarkdownOutputSchema,
  metadata: {
    category: 'web',
    tags: ['html', 'markdown', 'extraction', 'conversion'],
    requiresRuntime: ['htmlToMarkdownConverter', 'pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<HTMLToMarkdownOutput> => {
    const { instruction, reasoning } = context as HTMLToMarkdownInput;

    const converter = runtimeContext?.get<HTMLToMarkdownConverter>('htmlToMarkdownConverter');
    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');

    if (!converter || !pageAccessor) {
      return {
        success: false,
        error: 'HTMLToMarkdownConverter or PageContentAccessor not available in runtime context',
      };
    }

    try {
      const html = await pageAccessor.getHTML();
      const url = await pageAccessor.getURL();

      const result = await converter.convert(html, {
        instruction,
        baseURL: url,
      });

      if (!result.success || !result.markdown) {
        return {
          success: false,
          error: result.error || 'Failed to convert HTML to markdown',
        };
      }

      return {
        success: true,
        markdownContent: result.markdown,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to extract content',
      };
    }
  },
});
