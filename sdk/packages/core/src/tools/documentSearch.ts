// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { VectorDBClient } from './interfaces.js';

export const documentSearchInputSchema = z.object({
  query: z.string().describe('Natural language search query to find relevant documents'),
  limit: z.number().min(1).max(50).optional().describe('Maximum number of results to return (default: 10, max: 50)'),
  tags: z.array(z.string()).optional().describe('Filter results by specific tags'),
  domain: z.string().optional().describe('Filter results by domain (e.g., "github.com")'),
  reasoning: z.string().describe('Reasoning for the search, displayed to the user'),
});

const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  content: z.string(),
  relevanceScore: z.number(),
  domain: z.string(),
  tags: z.array(z.string()),
  bookmarkedAt: z.string(),
});

export const documentSearchOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    results: z.array(searchResultSchema),
    totalResults: z.number(),
    query: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type DocumentSearchInput = z.infer<typeof documentSearchInputSchema>;
export type DocumentSearchOutput = z.infer<typeof documentSearchOutputSchema>;

/**
 * Tool for searching bookmarked documents using semantic similarity
 */
export const documentSearch = createTool({
  id: 'document_search',
  description: 'Searches through previously bookmarked documents using semantic similarity. Finds relevant content based on natural language queries, not just keyword matching.',
  inputSchema: documentSearchInputSchema,
  outputSchema: documentSearchOutputSchema,
  metadata: {
    category: 'utilities',
    tags: ['search', 'vector', 'semantic', 'bookmarks'],
    requiresRuntime: ['vectorDBClient'],
  },
  execute: async ({ context, runtimeContext }): Promise<DocumentSearchOutput> => {
    const { query, limit = 10, tags, domain, reasoning } = context as DocumentSearchInput;

    const vectorDB = runtimeContext?.get<VectorDBClient>('vectorDBClient');

    if (!vectorDB) {
      return {
        success: false,
        error: 'VectorDBClient not available in runtime context',
      };
    }

    try {
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: 'Search query cannot be empty',
        };
      }

      const filter: Record<string, unknown> = {};
      if (tags && tags.length > 0) {
        filter.tags = tags;
      }
      if (domain) {
        filter.domain = domain;
      }

      const result = await vectorDB.search(query, { limit, filter });

      if (!result.success || !result.results) {
        return {
          success: false,
          error: result.error || 'Search failed',
        };
      }

      const formattedResults = result.results.map(r => ({
        id: r.id,
        title: (r.metadata.title as string) || '',
        url: (r.metadata.url as string) || '',
        content: r.content,
        relevanceScore: r.score,
        domain: (r.metadata.domain as string) || new URL((r.metadata.url as string) || '').hostname,
        tags: (r.metadata.tags as string[]) || [],
        bookmarkedAt: (r.metadata.bookmarkedAt as string) || new Date().toISOString(),
      }));

      return {
        success: true,
        results: formattedResults,
        totalResults: formattedResults.length,
        query,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to search documents',
      };
    }
  },
});
