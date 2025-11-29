// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from '../tools/Tools.js';
import { MemoryBlockManager } from './MemoryBlockManager.js';

const logger = createLogger('Tool:SearchMemory');

export interface SearchMemoryArgs {
  query: string;
}

export interface SearchMemoryResult {
  success: boolean;
  results: Array<{
    block: string;
    matches: string[];
  }>;
  count: number;
  error?: string;
}

/**
 * Tool for searching across all memory blocks.
 */
export class SearchMemoryTool implements Tool<SearchMemoryArgs, SearchMemoryResult> {
  name = 'search_memory';
  description = 'Search across all memory blocks (user preferences, facts, projects) for relevant information. Returns matching lines from each block.';

  schema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find in memory blocks'
      }
    },
    required: ['query']
  };

  async execute(args: SearchMemoryArgs, _ctx?: LLMContext): Promise<SearchMemoryResult> {
    logger.info('Executing search memory', { query: args.query });

    try {
      const manager = new MemoryBlockManager();
      const searchResults = await manager.searchBlocks(args.query);

      const results = searchResults.map(r => ({
        block: r.block.label,
        matches: r.matches.slice(0, 5) // Limit to 5 matches per block
      }));

      logger.info('Search completed', { resultCount: results.length });

      return {
        success: true,
        results,
        count: results.length
      };
    } catch (error: any) {
      logger.error('Failed to search memory', { error: error?.message });
      return {
        success: false,
        results: [],
        count: 0,
        error: error?.message || 'Failed to search memory.'
      };
    }
  }
}
