// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { FileStorageManager } from './readFile.js';

/**
 * Input schema for list files tool
 */
export const listFilesInputSchema = z.object({
  reasoning: z.string().describe('Explanation for why the file list is needed'),
});

/**
 * File summary schema
 */
export const fileSummarySchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/**
 * Output schema for list files tool
 */
export const listFilesOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    files: z.array(fileSummarySchema),
    count: z.number(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type ListFilesInput = z.infer<typeof listFilesInputSchema>;
export type ListFilesOutput = z.infer<typeof listFilesOutputSchema>;
export type FileSummary = z.infer<typeof fileSummarySchema>;

/**
 * Tool for listing all files in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * const result = await agent.generateText({
 *   prompt: "Show me all files in the session",
 *   tools: { listFiles },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
export const listFiles = createTool({
  id: 'list_files',
  description: 'Lists all files created during the current session along with their metadata.',
  inputSchema: listFilesInputSchema,
  outputSchema: listFilesOutputSchema,
  metadata: {
    category: 'file_operations',
    tags: ['file', 'storage', 'list'],
    requiresRuntime: ['fileStorageManager'],
  },
  execute: async ({ context, runtimeContext }): Promise<ListFilesOutput> => {
    const { reasoning } = context as ListFilesInput;

    // Get file storage manager from runtime context
    const fileStorageManager = runtimeContext?.get<FileStorageManager>('fileStorageManager');

    if (!fileStorageManager) {
      return {
        success: false,
        error: 'FileStorageManager not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      const files = await fileStorageManager.listFiles();

      return {
        success: true,
        files,
        count: files.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to list files.',
      };
    }
  },
});
