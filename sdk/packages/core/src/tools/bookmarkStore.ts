// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { VectorDBClient, PageContentAccessor, HTMLToMarkdownConverter } from './interfaces.js';

export const bookmarkStoreInputSchema = z.object({
  title: z.string().optional().describe('Custom title for the bookmark (optional, will use page title if not provided)'),
  tags: z.array(z.string()).optional().describe('Tags to categorize the bookmark for easier discovery'),
  reasoning: z.string().describe('Reasoning for bookmarking this page, displayed to the user'),
  includeFullContent: z.boolean().optional().describe('Whether to include full page content or just a summary (default: true)'),
});

export const bookmarkStoreOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    id: z.string(),
    url: z.string(),
    title: z.string(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type BookmarkStoreInput = z.infer<typeof bookmarkStoreInputSchema>;
export type BookmarkStoreOutput = z.infer<typeof bookmarkStoreOutputSchema>;

/**
 * Tool for storing current page content as a bookmark in vector database
 */
export const bookmarkStore = createTool({
  id: 'bookmark_store',
  description: 'Stores the current page content and metadata in a vector database for later retrieval. Extracts clean markdown content and makes it searchable.',
  inputSchema: bookmarkStoreInputSchema,
  outputSchema: bookmarkStoreOutputSchema,
  metadata: {
    category: 'utilities',
    tags: ['bookmark', 'store', 'vector', 'save'],
    requiresRuntime: ['vectorDBClient', 'pageContentAccessor', 'htmlToMarkdownConverter'],
  },
  execute: async ({ context, runtimeContext }): Promise<BookmarkStoreOutput> => {
    const { title, tags = [], reasoning, includeFullContent = true } = context as BookmarkStoreInput;

    const vectorDB = runtimeContext?.get<VectorDBClient>('vectorDBClient');
    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');
    const converter = runtimeContext?.get<HTMLToMarkdownConverter>('htmlToMarkdownConverter');

    if (!vectorDB || !pageAccessor || !converter) {
      return {
        success: false,
        error: 'Required runtime dependencies not available',
      };
    }

    try {
      const url = await pageAccessor.getURL();
      const pageTitle = title || await pageAccessor.getTitle();
      const html = await pageAccessor.getHTML();

      const conversionResult = await converter.convert(html, { baseURL: url });

      if (!conversionResult.success || !conversionResult.markdown) {
        return {
          success: false,
          error: 'Failed to convert page content to markdown',
        };
      }

      const content = includeFullContent
        ? conversionResult.markdown
        : conversionResult.markdown.substring(0, 2000);

      const domain = new URL(url).hostname;

      const result = await vectorDB.store({
        content,
        metadata: {
          title: pageTitle,
          url,
          domain,
          tags,
          bookmarkedAt: new Date().toISOString(),
        },
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to store bookmark',
        };
      }

      return {
        success: true,
        id: result.id || '',
        url,
        title: pageTitle,
        message: `Bookmarked "${pageTitle}" with ${tags.length} tags`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to bookmark page',
      };
    }
  },
});
