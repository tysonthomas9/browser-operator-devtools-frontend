// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {DeleteFileArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const DELETE_FILE_SCHEMA = {
  name: 'sandbox_delete_file',
  description: 'Delete a file from a sandbox app. Triggers auto-rebuild.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID',
      },
      path: {
        type: 'string',
        description: 'File path to delete (e.g., "/src/old-component.tsx")',
      },
    },
    required: ['appId', 'path'],
  },
};

/**
 * DeleteFileTool - Deletes a file from an app's VFS
 */
export async function deleteFile(args: DeleteFileArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate app exists
    if (!controller.getApp(args.appId)) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    // Delete file
    const deleted = await controller.deleteFile(args.appId, args.path);

    if (!deleted) {
      return {
        success: false,
        error: `File "${args.path}" not found in app "${args.appId}"`,
      };
    }

    return {
      success: true,
      data: {
        appId: args.appId,
        path: args.path,
        deleted: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
