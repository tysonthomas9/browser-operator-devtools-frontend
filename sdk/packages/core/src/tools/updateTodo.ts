// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { FileStorageManager } from './readFile.js';

/**
 * Input schema for update todo tool
 */
export const updateTodoInputSchema = z.object({
  todoList: z.string().describe('Complete markdown checklist of todos. Use "- [ ]" for incomplete items, "- [x]" for completed items. Send the ENTIRE list every time, even if only one item changed.'),
  reasoning: z.string().describe('Explanation for why the todo list is being updated'),
});

/**
 * Output schema for update todo tool
 */
export const updateTodoOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string(),
    todoCount: z.number(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;
export type UpdateTodoOutput = z.infer<typeof updateTodoOutputSchema>;

const TODO_FILENAME = 'todos.md';

/**
 * Tool for updating the todo list in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * const result = await agent.generateText({
 *   prompt: "Update the todo list with current progress",
 *   tools: { updateTodo },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
export const updateTodo = createTool({
  id: 'update_todo',
  description: 'Updates the complete todo list for tracking long-term tasks. Agent sends the entire markdown checklist every time, marking completed items with [x]. Use "- [ ]" for incomplete tasks and "- [x]" for completed tasks.',
  inputSchema: updateTodoInputSchema,
  outputSchema: updateTodoOutputSchema,
  metadata: {
    category: 'utilities',
    tags: ['todo', 'tracking', 'markdown'],
    requiresRuntime: ['fileStorageManager'],
  },
  execute: async ({ context, runtimeContext }): Promise<UpdateTodoOutput> => {
    const { todoList, reasoning } = context as UpdateTodoInput;

    // Get file storage manager from runtime context
    const fileStorageManager = runtimeContext?.get<FileStorageManager>('fileStorageManager');

    if (!fileStorageManager) {
      return {
        success: false,
        error: 'FileStorageManager not available in runtime context. Please provide it when initializing the agent.',
      };
    }

    try {
      // Validate todo list format
      const todoLines = todoList.trim().split('\n');
      const todoCount = todoLines.filter(line => line.trim().match(/^-\s+\[[ x]\]/i)).length;

      if (todoCount === 0) {
        return {
          success: false,
          error: 'Todo list must contain at least one item in format "- [ ]" or "- [x]"',
        };
      }

      // Check if file exists
      const existingFile = await fileStorageManager.readFile(TODO_FILENAME);

      if (existingFile) {
        // Update existing file
        await fileStorageManager.updateFile(TODO_FILENAME, todoList);
      } else {
        // Create new file
        await fileStorageManager.createFile(TODO_FILENAME, todoList, 'text/markdown');
      }

      return {
        success: true,
        message: `Updated todo list with ${todoCount} items.`,
        todoCount,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to update todo list.',
      };
    }
  },
});
