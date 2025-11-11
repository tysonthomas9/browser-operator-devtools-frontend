// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { FileStorageManager } from './readFile.js';

/**
 * Input schema for delete file tool
 */
export const deleteFileInputSchema = z.object({
  fileName: z.string().describe('Name of the file to delete'),
  reasoning: z.string().describe('Explanation for why the file can be safely deleted'),
});

/**
 * Output schema for delete file tool
 */
export const deleteFileOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type DeleteFileInput = z.infer<typeof deleteFileInputSchema>;
export type DeleteFileOutput = z.infer<typeof deleteFileOutputSchema>;

/**
 * Tool for deleting files from session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * const result = await agent.generateText({
 *   prompt: "Delete the old config file",
 *   tools: { deleteFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
export const deleteFile = createTool({
  id: 'delete_file',
  description: 'Deletes a file from the current session storage.',
  inputSchema: deleteFileInputSchema,
  outputSchema: deleteFileOutputSchema,
  metadata: {
    category: 'file_operations',
    tags: ['file', 'storage', 'delete'],
    requiresRuntime: ['fileStorageManager'],
  },
  execute: async ({ context, runtimeContext }): Promise<DeleteFileOutput> => {
    const { fileName, reasoning } = context as DeleteFileInput;

    // Get file storage manager from runtime context
    const fileStorageManager = runtimeContext?.get<FileStorageManager>('fileStorageManager');

    if (!fileStorageManager) {
      return {
        success: false,
        error: 'FileStorageManager not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      await fileStorageManager.deleteFile(fileName);

      return {
        success: true,
        message: `Deleted file "${fileName}".`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to delete file.',
      };
    }
  },
});
