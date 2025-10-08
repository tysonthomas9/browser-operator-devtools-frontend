// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import { FileStorageManager, type StoredFile } from './FileStorageManager.js';

const logger = createLogger('Tool:UpdateFile');

export interface UpdateFileArgs {
  fileName: string;
  content: string;
  append?: boolean;
  reasoning: string;
}

export interface UpdateFileResult {
  success: boolean;
  fileId?: string;
  message?: string;
  error?: string;
}

export class UpdateFileTool implements Tool<UpdateFileArgs, UpdateFileResult> {
  name = 'update_file';
  description = 'Updates an existing file in the current session. Can either replace the content or append to it.';

  schema = {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: 'Name of the file to update'
      },
      content: {
        type: 'string',
        description: 'New content to write to the file'
      },
      append: {
        type: 'boolean',
        description: 'Whether to append the content instead of replacing it (default: false)'
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why this update is needed'
      }
    },
    required: ['fileName', 'content', 'reasoning']
  };

  async execute(args: UpdateFileArgs, _ctx?: LLMContext): Promise<UpdateFileResult> {
    logger.info('Executing update file', { fileName: args.fileName, append: args.append === true });
    const manager = FileStorageManager.getInstance();

    try {
      const file: StoredFile = await manager.updateFile(args.fileName, args.content, args.append === true);
      const action = args.append ? 'Appended to' : 'Updated';
      return {
        success: true,
        fileId: file.id,
        message: `${action} file "${file.fileName}" (${file.size} bytes).`
      };
    } catch (error: any) {
      logger.error('Failed to update file', { fileName: args.fileName, error: error?.message });
      return {
        success: false,
        error: error?.message || 'Failed to update file.'
      };
    }
  }
}
