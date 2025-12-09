// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from '../tools/Tools.js';
import { MemoryBlockManager } from './MemoryBlockManager.js';
import type { BlockType } from './types.js';

const logger = createLogger('Tool:UpdateMemory');

export interface UpdateMemoryArgs {
  blockType: BlockType;
  content: string;
  projectName?: string;
}

export interface UpdateMemoryResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Tool for updating memory blocks.
 */
export class UpdateMemoryTool implements Tool<UpdateMemoryArgs, UpdateMemoryResult> {
  name = 'update_memory';
  description = `Update a memory block with new content. Block types:
- "user": User preferences, name, coding style (max 20000 chars)
- "facts": Recent facts extracted from conversations (max 20000 chars)
- "project": Project-specific context (max 20000 chars each, max 4 projects)

For project blocks, you must also provide projectName.`;

  schema = {
    type: 'object',
    properties: {
      blockType: {
        type: 'string',
        enum: ['user', 'facts', 'project'],
        description: 'Type of memory block to update'
      },
      content: {
        type: 'string',
        description: 'New content for the block (replaces existing content)'
      },
      projectName: {
        type: 'string',
        description: 'Project name (required when blockType is "project")'
      }
    },
    required: ['blockType', 'content']
  };

  async execute(args: UpdateMemoryArgs, _ctx?: LLMContext): Promise<UpdateMemoryResult> {
    logger.info('Executing update memory', {
      blockType: args.blockType,
      contentLength: args.content.length,
      projectName: args.projectName
    });

    try {
      // Validate project name for project blocks
      if (args.blockType === 'project' && !args.projectName) {
        return {
          success: false,
          message: 'projectName is required for project blocks',
          error: 'projectName is required for project blocks'
        };
      }

      const manager = new MemoryBlockManager();
      await manager.updateBlock(args.blockType, args.content, args.projectName);

      const label = args.blockType === 'project'
        ? `project:${args.projectName}`
        : args.blockType;

      logger.info('Memory block updated', { label });

      return {
        success: true,
        message: `Updated ${label} block (${args.content.length} chars)`
      };
    } catch (error: any) {
      logger.error('Failed to update memory block', { error: error?.message });
      return {
        success: false,
        message: error?.message || 'Failed to update memory block',
        error: error?.message || 'Failed to update memory block'
      };
    }
  }
}
