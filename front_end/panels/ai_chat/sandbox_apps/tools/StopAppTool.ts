// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const STOP_APP_SCHEMA = {
  name: 'sandbox_stop_app',
  description: 'Stop a running sandbox app and remove its iframe from the page.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID to stop',
      },
    },
    required: ['appId'],
  },
};

/**
 * StopAppTool - Stops a running app
 */
export async function stopApp(args: {appId: string}): Promise<ToolResult> {
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

    // Stop app
    await controller.stopApp(args.appId);

    return {
      success: true,
      data: {
        appId: args.appId,
        stopped: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
