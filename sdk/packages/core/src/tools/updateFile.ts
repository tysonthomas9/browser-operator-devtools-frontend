// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { FileStorageManager } from './readFile.js';

/**
 * Input schema for update file tool
 */
export const updateFileInputSchema = z.object({
  fileName: z.string().describe('Name of the file to update'),
  content: z.string().describe('New content to write to the file'),
  append: z.boolean().optional().describe('Whether to append the content instead of replacing it (default: false)'),
  reasoning: z.string().describe('Explanation for why this update is needed'),
});

/**
 * Output schema for update file tool
 * Using discriminated union for success/error cases
 */
export const updateFileOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    fileId: z.string(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type UpdateFileInput = z.infer<typeof updateFileInputSchema>;
export type UpdateFileOutput = z.infer<typeof updateFileOutputSchema>;

/**
 * Tool for updating existing files in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * // Replace content
 * const result = await agent.generateText({
 *   prompt: "Update the config file",
 *   tools: { updateFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 *
 * // Append content
 * const result = await agent.generateText({
 *   prompt: "Append to the log file",
 *   tools: { updateFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
export const updateFile = createTool({
  id: 'update_file',
  description: 'Updates an existing file in the current session. Can either replace the content or append to it.',
  inputSchema: updateFileInputSchema,
  outputSchema: updateFileOutputSchema,
  metadata: {
    category: 'file_operations',
    tags: ['file', 'storage', 'update', 'write', 'append'],
    requiresRuntime: ['fileStorageManager'],
  },
  execute: async ({ context, runtimeContext }): Promise<UpdateFileOutput> => {
    const { fileName, content, append, reasoning } = context as UpdateFileInput;

    // Get file storage manager from runtime context
    const fileStorageManager = runtimeContext?.get<FileStorageManager>('fileStorageManager');

    if (!fileStorageManager) {
      return {
        success: false,
        error: 'FileStorageManager not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      const file = await fileStorageManager.updateFile(fileName, content, append === true);
      const action = append ? 'Appended to' : 'Updated';

      return {
        success: true,
        fileId: file.id,
        message: `${action} file "${file.fileName}" (${file.size} bytes).`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to update file.',
      };
    }
  },
});
