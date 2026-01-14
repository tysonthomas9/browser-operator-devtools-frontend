// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {RunAppArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const RUN_APP_SCHEMA = {
  name: 'sandbox_run_app',
  description: 'Run a sandbox app in the browser. Builds if needed, then renders in a full-screen iframe. The app will hot-reload on file changes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID to run',
      },
    },
    required: ['appId'],
  },
};

/**
 * RunAppTool - Runs an app in an iframe
 */
export async function runApp(args: RunAppArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate app exists
    const app = controller.getApp(args.appId);
    if (!app) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    // Run app
    const iframeId = await controller.runApp(args.appId);

    return {
      success: true,
      data: {
        appId: args.appId,
        iframeId,
        isRunning: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
