// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import { FileStorageManager } from './FileStorageManager.js';

const logger = createLogger('Tool:UpdateTodo');

const TODO_FILENAME = 'todos.md';

export interface UpdateTodoArgs {
  todoList: string;
  reasoning: string;
}

export interface UpdateTodoResult {
  success: boolean;
  message?: string;
  todoCount?: number;
  error?: string;
}

export class UpdateTodoTool implements Tool<UpdateTodoArgs, UpdateTodoResult> {
  name = 'update_todo';
  description = 'Updates the complete todo list for tracking long-term tasks. Agent sends the entire markdown checklist every time, marking completed items with [x]. Use "- [ ]" for incomplete tasks and "- [x]" for completed tasks.';

  schema = {
    type: 'object',
    properties: {
      todoList: {
        type: 'string',
        description: 'Complete markdown checklist of todos. Use "- [ ]" for incomplete items, "- [x]" for completed items. Send the ENTIRE list every time, even if only one item changed.'
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why the todo list is being updated'
      }
    },
    required: ['todoList', 'reasoning']
  };

  async execute(args: UpdateTodoArgs, _ctx?: LLMContext): Promise<UpdateTodoResult> {
    logger.info('Executing update todo', { reasoning: args.reasoning });
    const manager = FileStorageManager.getInstance();

    try {
      // Validate todo list format
      const validation = this.validateTodoList(args.todoList);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Check if file exists
      const existingFile = await manager.readFile(TODO_FILENAME);

      let result;
      if (existingFile) {
        // Update existing file
        result = await manager.updateFile(TODO_FILENAME, args.todoList, false);
      } else {
        // Create new file
        result = await manager.createFile(TODO_FILENAME, args.todoList, 'text/markdown');
      }

      const todoCount = this.countTodos(args.todoList);
      const completedCount = this.countCompleted(args.todoList);

      return {
        success: true,
        message: `Updated todo list: ${todoCount.total} tasks (${completedCount} completed, ${todoCount.incomplete} remaining)`,
        todoCount: todoCount.total
      };
    } catch (error: any) {
      logger.error('Failed to update todo list', { error: error?.message });
      return {
        success: false,
        error: error?.message || 'Failed to update todo list.'
      };
    }
  }

  private validateTodoList(todoList: string): { valid: boolean; error?: string } {
    if (!todoList || !todoList.trim()) {
      return { valid: false, error: 'Todo list cannot be empty.' };
    }

    // Check if it contains at least one todo item
    const todoPattern = /^[\s]*-\s+\[([ x])\]/m;
    if (!todoPattern.test(todoList)) {
      return {
        valid: false,
        error: 'Todo list must contain at least one checkbox item using markdown format: "- [ ]" or "- [x]"'
      };
    }

    return { valid: true };
  }

  private countTodos(todoList: string): { total: number; incomplete: number; completed: number } {
    const lines = todoList.split('\n');
    let total = 0;
    let completed = 0;

    for (const line of lines) {
      if (line.match(/^[\s]*-\s+\[([ x])\]/)) {
        total++;
        if (line.match(/^[\s]*-\s+\[x\]/)) {
          completed++;
        }
      }
    }

    return {
      total,
      completed,
      incomplete: total - completed
    };
  }

  private countCompleted(todoList: string): number {
    const matches = todoList.match(/^[\s]*-\s+\[x\]/gm);
    return matches ? matches.length : 0;
  }
}
