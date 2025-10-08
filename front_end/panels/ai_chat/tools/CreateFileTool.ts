// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import { FileStorageManager, type StoredFile } from './FileStorageManager.js';

const logger = createLogger('Tool:CreateFile');

export interface CreateFileArgs {
  fileName: string;
  content: string;
  mimeType?: string;
  reasoning: string;
}

export interface CreateFileResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  message?: string;
  error?: string;
}

export class CreateFileTool implements Tool<CreateFileArgs, CreateFileResult> {
  name = 'create_file';
  description = 'Creates a new file in the current session storage. Fails if the file already exists.';

  schema = {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: 'Unique name of the file to create (no path separators)'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      mimeType: {
        type: 'string',
        description: 'Optional MIME type describing the content (default: text/plain)'
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why this file is being created for the user'
      }
    },
    required: ['fileName', 'content', 'reasoning']
  };

  async execute(args: CreateFileArgs, _ctx?: LLMContext): Promise<CreateFileResult> {
    logger.info('Executing create file', { fileName: args.fileName });
    const manager = FileStorageManager.getInstance();

    try {
      const file: StoredFile = await manager.createFile(args.fileName, args.content, args.mimeType);
      return {
        success: true,
        fileId: file.id,
        fileName: file.fileName,
        message: `Created file "${file.fileName}" (${file.size} bytes).`
      };
    } catch (error: any) {
      logger.error('Failed to create file', { fileName: args.fileName, error: error?.message });
      return {
        success: false,
        error: error?.message || 'Failed to create file.'
      };
    }
  }
}
