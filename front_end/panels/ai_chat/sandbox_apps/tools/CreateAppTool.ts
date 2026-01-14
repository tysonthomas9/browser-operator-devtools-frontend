// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {CreateAppArgs, ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const CREATE_APP_SCHEMA = {
  name: 'sandbox_create_app',
  description: 'Create a new sandbox React/Preact app. The app starts with a basic template including index.tsx, App.tsx, and styles.css.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'Unique identifier for the app (alphanumeric, no spaces)',
      },
      name: {
        type: 'string',
        description: 'Human-readable display name for the app',
      },
      template: {
        type: 'string',
        enum: ['default', 'blank'],
        description: 'Template to use: "default" includes starter files, "blank" is empty',
      },
    },
    required: ['appId', 'name'],
  },
};

/**
 * CreateAppTool - Creates a new sandbox app
 */
export async function createApp(args: CreateAppArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate appId
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(args.appId)) {
      return {
        success: false,
        error: 'App ID must start with a letter and contain only alphanumeric characters, underscores, and hyphens',
      };
    }

    // Check if app already exists
    if (controller.getApp(args.appId)) {
      return {
        success: false,
        error: `App "${args.appId}" already exists`,
      };
    }

    // Create app
    const template = args.template || 'default';
    const appState = await controller.createApp(args.appId, args.name, template);

    // Get file list
    const files = controller.listFiles(args.appId);

    return {
      success: true,
      data: {
        appId: appState.appId,
        name: appState.name,
        files: files.map(f => f.path),
        entry: appState.vfs.entry,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
