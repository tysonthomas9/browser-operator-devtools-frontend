// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { FileStorageManager } from './readFile.js';

/**
 * Input schema for create file tool
 */
export const createFileInputSchema = z.object({
  fileName: z.string().describe('Unique name of the file to create (no path separators)'),
  content: z.string().describe('Content to write to the file'),
  mimeType: z.string().optional().describe('Optional MIME type describing the content (default: text/plain)'),
  reasoning: z.string().describe('Explanation for why this file is being created for the user'),
});

/**
 * Output schema for create file tool
 * Using discriminated union for success/error cases
 */
export const createFileOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    fileId: z.string(),
    fileName: z.string(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type CreateFileInput = z.infer<typeof createFileInputSchema>;
export type CreateFileOutput = z.infer<typeof createFileOutputSchema>;

/**
 * Tool for creating new files in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * // Use with runtime context
 * const result = await agent.generateText({
 *   prompt: "Create a config file",
 *   tools: { createFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
export const createFile = createTool({
  id: 'create_file',
  description: 'Creates a new file in the current session storage. Fails if the file already exists.',
  inputSchema: createFileInputSchema,
  outputSchema: createFileOutputSchema,
  metadata: {
    category: 'file_operations',
    tags: ['file', 'storage', 'create', 'write'],
    requiresRuntime: ['fileStorageManager'],
  },
  execute: async ({ context, runtimeContext }): Promise<CreateFileOutput> => {
    const { fileName, content, mimeType, reasoning } = context as CreateFileInput;

    // Get file storage manager from runtime context
    const fileStorageManager = runtimeContext?.get<FileStorageManager>('fileStorageManager');

    if (!fileStorageManager) {
      return {
        success: false,
        error: 'FileStorageManager not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      const file = await fileStorageManager.createFile(fileName, content, mimeType);

      return {
        success: true,
        fileId: file.id,
        fileName: file.fileName,
        message: `Created file "${file.fileName}" (${file.size} bytes).`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to create file.',
      };
    }
  },
});
