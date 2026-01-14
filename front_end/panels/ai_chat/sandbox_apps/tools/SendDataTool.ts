// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {SendDataArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const SEND_DATA_SCHEMA = {
  name: 'sandbox_send_data',
  description: 'Send a data update to a running sandbox app. The app can react to this data change. Use JSON Pointer paths like "/users/0/name".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID',
      },
      path: {
        type: 'string',
        description: 'JSON Pointer path to update (e.g., "/count", "/users/0/name")',
      },
      value: {
        description: 'The value to set at the path (any JSON-serializable value)',
      },
    },
    required: ['appId', 'path', 'value'],
  },
};

/**
 * SendDataTool - Sends data to a running app
 */
export async function sendData(args: SendDataArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate app exists and is running
    const app = controller.getApp(args.appId);
    if (!app) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    if (!app.isRunning) {
      return {
        success: false,
        error: `App "${args.appId}" is not running. Use sandbox_run_app first.`,
      };
    }

    // Send data update
    const sent = await controller.sendDataUpdate(args.appId, args.path, args.value);

    if (!sent) {
      return {
        success: false,
        error: 'Failed to send data update to app',
      };
    }

    return {
      success: true,
      data: {
        appId: args.appId,
        path: args.path,
        sent: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
