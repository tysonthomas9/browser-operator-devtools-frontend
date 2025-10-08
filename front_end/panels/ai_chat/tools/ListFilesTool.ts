// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import { FileStorageManager, type FileSummary } from './FileStorageManager.js';

const logger = createLogger('Tool:ListFiles');

export interface ListFilesArgs {
  reasoning: string;
}

export interface ListFilesResult {
  success: boolean;
  files?: FileSummary[];
  count?: number;
  error?: string;
}

export class ListFilesTool implements Tool<ListFilesArgs, ListFilesResult> {
  name = 'list_files';
  description = 'Lists all files created during the current session along with their metadata.';

  schema = {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'Explanation for why the file list is needed'
      }
    },
    required: ['reasoning']
  };

  async execute(_args: ListFilesArgs, _ctx?: LLMContext): Promise<ListFilesResult> {
    logger.info('Executing list files');
    const manager = FileStorageManager.getInstance();

    try {
      const files = await manager.listFiles();
      return {
        success: true,
        files,
        count: files.length
      };
    } catch (error: any) {
      logger.error('Failed to list files', { error: error?.message });
      return {
        success: false,
        error: error?.message || 'Failed to list files.'
      };
    }
  }
}
