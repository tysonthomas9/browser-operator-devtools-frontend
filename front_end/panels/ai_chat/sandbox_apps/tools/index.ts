// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Sandbox Apps AI Tools
 *
 * These tools allow AI agents to create, modify, and run sandbox apps
 * in the browser. The tools follow a consistent pattern with schema
 * definitions for LLM function calling.
 */

// Tool implementations
export {createApp, CREATE_APP_SCHEMA} from './CreateAppTool.js';
export {writeFile, WRITE_FILE_SCHEMA} from './WriteFileTool.js';
export {deleteFile, DELETE_FILE_SCHEMA} from './DeleteFileTool.js';
export {applyPatch, APPLY_PATCH_SCHEMA} from './ApplyPatchTool.js';
export {buildApp, BUILD_APP_SCHEMA} from './BuildAppTool.js';
export {runApp, RUN_APP_SCHEMA} from './RunAppTool.js';
export {stopApp, STOP_APP_SCHEMA} from './StopAppTool.js';
export {sendData, SEND_DATA_SCHEMA} from './SendDataTool.js';
export {getState, GET_STATE_SCHEMA} from './GetStateTool.js';

// New abstraction layer tools
export {
  ExecuteSandboxAppActionTool,
  GetSandboxAppStateTool,
  ListSandboxAppsTool,
  CreateSandboxAppInstanceTool,
} from './ExecuteSandboxAppActionTool.js';

// All tool schemas for easy registration
export const SANDBOX_TOOL_SCHEMAS = [
  {name: 'sandbox_create_app', module: 'CreateAppTool'},
  {name: 'sandbox_write_file', module: 'WriteFileTool'},
  {name: 'sandbox_delete_file', module: 'DeleteFileTool'},
  {name: 'sandbox_apply_patch', module: 'ApplyPatchTool'},
  {name: 'sandbox_build_app', module: 'BuildAppTool'},
  {name: 'sandbox_run_app', module: 'RunAppTool'},
  {name: 'sandbox_stop_app', module: 'StopAppTool'},
  {name: 'sandbox_send_data', module: 'SendDataTool'},
  {name: 'sandbox_get_state', module: 'GetStateTool'},
  // New abstraction layer tools
  {name: 'execute_sandbox_app_action', module: 'ExecuteSandboxAppActionTool'},
  {name: 'get_sandbox_app_state', module: 'ExecuteSandboxAppActionTool'},
  {name: 'list_sandbox_apps', module: 'ExecuteSandboxAppActionTool'},
  {name: 'create_sandbox_app_instance', module: 'ExecuteSandboxAppActionTool'},
] as const;
