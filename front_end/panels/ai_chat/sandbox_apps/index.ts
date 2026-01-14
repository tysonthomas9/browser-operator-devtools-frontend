// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Sandbox Apps Module
 *
 * A system for AI agents to create, modify, and run sandboxed Preact apps
 * in the browser. Combines:
 * - In-browser bundling via esbuild-wasm
 * - Virtual file system for code storage
 * - A2UI-style protocol for state management
 * - Full-screen iframe rendering
 *
 * @example
 * ```typescript
 * import {SandboxController, createApp, writeFile, runApp} from './sandbox_apps';
 *
 * // Create an app
 * const result = await createApp({name: 'MyApp'});
 * const appId = result.data.appId;
 *
 * // Write a file
 * await writeFile({appId, path: 'src/App.tsx', content: '...'});
 *
 * // Run the app
 * await runApp({appId});
 * ```
 */

// Core types
export type {
  VFSState,
  SandboxAppState,
  BuildResult,
  BuildError,
  ToolResult,
  DevToolsToSandboxMessage,
  SandboxToDevToolsMessage,
  CreateAppArgs,
  WriteFileArgs,
  DeleteFileArgs,
  BuildAppArgs,
  RunAppArgs,
  SendDataArgs,
  GetStateArgs,
} from './types/SandboxTypes.js';

// VFS Manager
export {VFSManager} from './vfs/VFSManager.js';

// Note: Bundler now runs inside the iframe (see previewHtml.ts)
// No separate BundlerWorker export needed

// Protocol
export {SandboxProtocol} from './protocol/SandboxProtocol.js';

// Runtime
export {createPreviewHtml} from './runtime/previewHtml.js';

// Controller (main entry point)
export {SandboxController} from './controller/SandboxController.js';

// AI Tools
export {
  createApp,
  CREATE_APP_SCHEMA,
  writeFile,
  WRITE_FILE_SCHEMA,
  deleteFile,
  DELETE_FILE_SCHEMA,
  applyPatch,
  APPLY_PATCH_SCHEMA,
  buildApp,
  BUILD_APP_SCHEMA,
  runApp,
  RUN_APP_SCHEMA,
  stopApp,
  STOP_APP_SCHEMA,
  sendData,
  SEND_DATA_SCHEMA,
  getState,
  GET_STATE_SCHEMA,
  SANDBOX_TOOL_SCHEMAS,
} from './tools/index.js';

// Data Studio v2 Execution
export {
  DataStudioExecutor,
  DataStudioStorage,
  type TableIndexEntry,
  type Entity,
  type OutputColumn,
  type AgentGroup,
  type CellResult,
  type DataStudioTable,
} from './execution/index.js';

// App Registry
export {SandboxAppRegistry, type SandboxApp} from './SandboxAppRegistry.js';
export {initializeSandboxApps} from './SandboxAppInitialization.js';
