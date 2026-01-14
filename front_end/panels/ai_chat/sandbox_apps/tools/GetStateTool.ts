// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {GetStateArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const GET_STATE_SCHEMA = {
  name: 'sandbox_get_state',
  description: 'Get the current state of a sandbox app including build status, files, and app data.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID',
      },
    },
    required: ['appId'],
  },
};

/**
 * GetStateTool - Gets the state of an app
 */
export async function getState(args: GetStateArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Get app
    const app = controller.getApp(args.appId);
    if (!app) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    // Get files
    const files = controller.listFiles(args.appId);

    return {
      success: true,
      data: {
        appId: app.appId,
        name: app.name,
        isRunning: app.isRunning,
        buildStatus: app.buildStatus,
        lastBuildSuccess: app.lastBuild?.success ?? null,
        lastBuildErrors: app.lastBuild?.errors.map(e => e.message) ?? [],
        files: files.map(f => ({path: f.path, size: f.size})),
        entry: app.vfs.entry,
        appState: app.appState,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
