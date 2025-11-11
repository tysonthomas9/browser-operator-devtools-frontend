// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';

/**
 * Input schema for read file tool
 */
export const readFileInputSchema = z.object({
  fileName: z.string().describe('Name of the file to read'),
  reasoning: z.string().describe('Explanation for why the file needs to be read'),
});

/**
 * Output schema for read file tool
 * Using discriminated union for success/error cases
 */
export const readFileOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    fileName: z.string(),
    content: z.string(),
    mimeType: z.string(),
    size: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type ReadFileInput = z.infer<typeof readFileInputSchema>;
export type ReadFileOutput = z.infer<typeof readFileOutputSchema>;

/**
 * Interface for file storage manager that must be provided via runtime context
 * Supports all file operations: create, read, update, delete
 */
export interface FileStorageManager {
  createFile(fileName: string, content: string, mimeType?: string): Promise<{
    id: string;
    fileName: string;
    content: string;
    mimeType: string;
    size: number;
    createdAt: number;
    updatedAt: number;
  }>;

  readFile(fileName: string): Promise<{
    fileName: string;
    content: string;
    mimeType: string;
    size: number;
    createdAt: number;
    updatedAt: number;
  } | null>;

  updateFile(fileName: string, content: string): Promise<{
    id: string;
    fileName: string;
    content: string;
    mimeType: string;
    size: number;
    createdAt: number;
    updatedAt: number;
  }>;

  deleteFile(fileName: string): Promise<boolean>;

  listFiles(): Promise<Array<{
    fileName: string;
    mimeType: string;
    size: number;
    createdAt: number;
    updatedAt: number;
  }>>;
}

/**
 * Tool for reading files from session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * // Use with runtime context
 * const result = await agent.generateText({
 *   prompt: "Read the config file",
 *   tools: { readFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
export const readFile = createTool({
  id: 'read_file',
  description: 'Reads the full content and metadata for a file stored in the current session.',
  inputSchema: readFileInputSchema,
  outputSchema: readFileOutputSchema,
  metadata: {
    category: 'file_operations',
    tags: ['file', 'storage', 'read'],
    requiresRuntime: ['fileStorageManager'],
  },
  execute: async ({ context, runtimeContext }): Promise<ReadFileOutput> => {
    const { fileName, reasoning } = context as ReadFileInput;

    // Get file storage manager from runtime context
    const fileStorageManager = runtimeContext?.get<FileStorageManager>('fileStorageManager');

    if (!fileStorageManager) {
      return {
        success: false,
        error: 'FileStorageManager not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      const file = await fileStorageManager.readFile(fileName);

      if (!file) {
        return {
          success: false,
          error: `File "${fileName}" was not found in the current session.`,
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
      return {
        success: false,
        error: error?.message || 'Failed to read file.',
      };
    }
  },
});
