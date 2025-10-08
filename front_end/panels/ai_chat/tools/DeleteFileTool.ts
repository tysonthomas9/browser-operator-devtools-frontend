// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import { FileStorageManager } from './FileStorageManager.js';

const logger = createLogger('Tool:DeleteFile');

export interface DeleteFileArgs {
  fileName: string;
  reasoning: string;
}

export interface DeleteFileResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class DeleteFileTool implements Tool<DeleteFileArgs, DeleteFileResult> {
  name = 'delete_file';
  description = 'Deletes a file from the current session storage.';

  schema = {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: 'Name of the file to delete'
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why the file can be safely deleted'
      }
    },
    required: ['fileName', 'reasoning']
  };

  async execute(args: DeleteFileArgs, _ctx?: LLMContext): Promise<DeleteFileResult> {
    logger.info('Executing delete file', { fileName: args.fileName });
    const manager = FileStorageManager.getInstance();

    try {
      await manager.deleteFile(args.fileName);
      return {
        success: true,
        message: `Deleted file "${args.fileName}".`
      };
    } catch (error: any) {
      logger.error('Failed to delete file', { fileName: args.fileName, error: error?.message });
      return {
        success: false,
        error: error?.message || 'Failed to delete file.'
      };
    }
  }
}
