// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { NavigationManager, HTMLToMarkdownConverter, PageContentAccessor } from './interfaces.js';

const fetchedContentSchema = z.object({
  url: z.string(),
  title: z.string(),
  markdownContent: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const fetcherInputSchema = z.object({
  urls: z.array(z.string()).describe('List of URLs to fetch content from'),
  reasoning: z.string().describe('Reasoning for the action, displayed to the user'),
});

export const fetcherOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    sources: z.array(fetchedContentSchema),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type FetcherInput = z.infer<typeof fetcherInputSchema>;
export type FetcherOutput = z.infer<typeof fetcherOutputSchema>;

/**
 * Tool for fetching and extracting content from multiple URLs
 */
export const fetcher = createTool({
  id: 'fetcher_tool',
  description: 'Navigates to URLs, extracts and cleans the main content, returning markdown for each source',
  inputSchema: fetcherInputSchema,
  outputSchema: fetcherOutputSchema,
  metadata: {
    category: 'web',
    tags: ['fetch', 'navigation', 'extraction', 'urls'],
    requiresRuntime: ['navigationManager', 'htmlToMarkdownConverter', 'pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext, abortSignal }): Promise<FetcherOutput> => {
    const { urls, reasoning } = context as FetcherInput;

    const navManager = runtimeContext?.get<NavigationManager>('navigationManager');
    const converter = runtimeContext?.get<HTMLToMarkdownConverter>('htmlToMarkdownConverter');
    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');

    if (!navManager || !converter || !pageAccessor) {
      return {
        success: false,
        error: 'Required runtime dependencies not available',
      };
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return {
        success: false,
        error: 'No URLs provided',
      };
    }

    const results: Array<z.infer<typeof fetchedContentSchema>> = [];

    for (const url of urls) {
      if (abortSignal?.aborted) {
        break;
      }

      try {
        const navResult = await navManager.navigateTo(url);
        if (!navResult.success) {
          results.push({
            url,
            title: '',
            markdownContent: '',
            success: false,
            error: navResult.error,
          });
          continue;
        }

        await navManager.waitForPageLoad(5000);

        const title = await pageAccessor.getTitle();
        const html = await pageAccessor.getHTML();

        const convResult = await converter.convert(html, { baseURL: url });

        if (!convResult.success || !convResult.markdown) {
          results.push({
            url,
            title,
            markdownContent: '',
            success: false,
            error: convResult.error,
          });
          continue;
        }

        results.push({
          url,
          title,
          markdownContent: convResult.markdown,
          success: true,
        });
      } catch (error: any) {
        results.push({
          url,
          title: '',
          markdownContent: '',
          success: false,
          error: error?.message || 'Failed to fetch',
        });
      }
    }

    return {
      success: true,
      sources: results,
    };
  },
});
