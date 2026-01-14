// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {BuildAppArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const BUILD_APP_SCHEMA = {
  name: 'sandbox_build_app',
  description: 'Trigger an explicit build of a sandbox app. Usually not needed as writes auto-trigger builds, but useful to force a rebuild or check for errors.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID to build',
      },
    },
    required: ['appId'],
  },
};

/**
 * BuildAppTool - Triggers a build for an app
 */
export async function buildApp(args: BuildAppArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate app exists
    if (!controller.getApp(args.appId)) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    // Build app
    const result = await controller.buildApp(args.appId);

    return {
      success: result.success,
      data: {
        appId: args.appId,
        success: result.success,
        durationMs: result.durationMs,
        errors: result.errors.map(e => e.message),
        warnings: result.warnings.map(w => w.message),
      },
      error: result.success ? undefined : result.errors.map(e => e.message).join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
