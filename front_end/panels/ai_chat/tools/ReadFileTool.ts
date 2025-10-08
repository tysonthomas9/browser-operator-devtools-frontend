// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import { FileStorageManager, type StoredFile } from './FileStorageManager.js';

const logger = createLogger('Tool:ReadFile');

export interface ReadFileArgs {
  fileName: string;
  reasoning: string;
}

export interface ReadFileResult {
  success: boolean;
  fileName?: string;
  content?: string;
  mimeType?: string;
  size?: number;
  createdAt?: number;
  updatedAt?: number;
  error?: string;
}

export class ReadFileTool implements Tool<ReadFileArgs, ReadFileResult> {
  name = 'read_file';
  description = 'Reads the full content and metadata for a file stored in the current session.';

  schema = {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: 'Name of the file to read'
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why the file needs to be read'
      }
    },
    required: ['fileName', 'reasoning']
  };

  async execute(args: ReadFileArgs, _ctx?: LLMContext): Promise<ReadFileResult> {
    logger.info('Executing read file', { fileName: args.fileName });
    const manager = FileStorageManager.getInstance();

    try {
      const file: StoredFile | null = await manager.readFile(args.fileName);
      if (!file) {
        return {
          success: false,
          error: `File "${args.fileName}" was not found in the current session.`
        };
      }

      return {
        success: true,
        fileName: file.fileName,
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };
    } catch (error: any) {
      logger.error('Failed to read file', { fileName: args.fileName, error: error?.message });
      return {
        success: false,
        error: error?.message || 'Failed to read file.'
      };
    }
  }
}
