// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {WriteFileArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const WRITE_FILE_SCHEMA = {
  name: 'sandbox_write_file',
  description: 'Write or create a file in a sandbox app. Triggers auto-rebuild. Use this to create new components, modify existing code, or add assets.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID to write to',
      },
      path: {
        type: 'string',
        description: 'File path starting with / (e.g., "/src/components/Button.tsx")',
      },
      content: {
        type: 'string',
        description: 'File content (full file, not a diff)',
      },
    },
    required: ['appId', 'path', 'content'],
  },
};

/**
 * WriteFileTool - Writes a file to an app's VFS
 */
export async function writeFile(args: WriteFileArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate app exists
    if (!controller.getApp(args.appId)) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    // Validate path
    if (!args.path.startsWith('/')) {
      return {
        success: false,
        error: 'File path must start with /',
      };
    }

    // Write file (auto-triggers build)
    await controller.writeFile(args.appId, args.path, args.content);

    return {
      success: true,
      data: {
        appId: args.appId,
        path: args.path,
        size: args.content.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
