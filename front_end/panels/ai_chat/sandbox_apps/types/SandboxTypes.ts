// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Sandbox Apps Type Definitions
 *
 * Core types for the sandbox apps system - AI-generated React mini apps
 * with in-browser bundling and A2UI-style communication.
 */

// =============================================================================
// Virtual File System Types
// =============================================================================

/**
 * A map of file paths to their contents
 */
export type VirtualFileMap = Record<string, string>;

/**
 * Metadata for a file in the VFS
 */
export interface FileMetadata {
  path: string;
  size: number;
  lastModified: Date;
}

/**
 * State of an app's virtual file system
 */
export interface VFSState {
  appId: string;
  files: VirtualFileMap;
  entry: string;
  createdAt: Date;
  modifiedAt: Date;
}

// =============================================================================
// Build Types
// =============================================================================

/**
 * Build error with location info
 */
export interface BuildError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of a build operation
 */
export interface BuildResult {
  success: boolean;
  js: string;
  css: string;
  errors: BuildError[];
  warnings: BuildError[];
  durationMs: number;
}

/**
 * Build request sent to worker
 */
export interface BuildRequest {
  id: number;
  appId: string;
  files: VirtualFileMap;
  entry: string;
}

/**
 * Build response from worker
 */
export interface BuildResponse {
  id: number;
  ok: boolean;
  js: string;
  css: string;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Protocol Types (A2UI-style)
// =============================================================================

/**
 * Messages sent from DevTools to the sandbox iframe
 */
export type DevToolsToSandboxMessage =
  | {type: 'init'; payload: {state: Record<string, unknown>}}
  | {type: 'data-update'; payload: {path: string; value: unknown}}
  | {type: 'execute'; payload: {action: string; args: Record<string, unknown>}}
  | {type: 'hot-reload'; payload: {js: string; css: string}}
  | {type: 'get-state'}
  // Iframe bundler messages
  | {type: 'sync-files'; payload: {files: VirtualFileMap; entry: string; incremental?: boolean}}
  | {type: 'build-request'; payload: {buildId: number}}
  | {type: 'execute-code'; payload: {js: string; css: string}};

/**
 * Messages sent from the sandbox iframe to DevTools
 */
export type SandboxToDevToolsMessage =
  | {type: 'ready'}
  | {type: 'state-changed'; payload: {path: string; value: unknown}}
  | {type: 'action'; payload: {name: string; context: Record<string, unknown>}}
  | {type: 'error'; payload: {message: string; stack?: string}}
  | {type: 'state-snapshot'; payload: {state: Record<string, unknown>}}
  // Iframe bundler response messages
  | {type: 'bundler-ready'}
  | {type: 'build-result'; payload: {buildId: number; success: boolean; js: string; css: string; errors: string[]; warnings: string[]; durationMs: number}}
  | {type: 'build-error'; payload: {buildId: number; error: string}};

/**
 * All protocol messages
 */
export type SandboxMessage = DevToolsToSandboxMessage | SandboxToDevToolsMessage;

// =============================================================================
// App State Types
// =============================================================================

/**
 * Status of an app's build
 */
export type BuildStatus = 'idle' | 'building' | 'success' | 'failed';

/**
 * Runtime state of a sandbox app
 */
export interface SandboxAppState {
  appId: string;
  name: string;
  vfs: VFSState;
  buildStatus: BuildStatus;
  lastBuild: BuildResult | null;
  iframeId: string | null;
  isRunning: boolean;
  appState: Record<string, unknown>;
}

// =============================================================================
// Tool Types
// =============================================================================

/**
 * Result returned by AI tools
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Arguments for create_app tool
 */
export interface CreateAppArgs {
  appId: string;
  name: string;
  template?: 'blank' | 'default';
}

/**
 * Arguments for write_file tool
 */
export interface WriteFileArgs {
  appId: string;
  path: string;
  content: string;
}

/**
 * Arguments for apply_patch tool
 */
export interface ApplyPatchArgs {
  appId: string;
  path: string;
  patch: string;
}

/**
 * Arguments for delete_file tool
 */
export interface DeleteFileArgs {
  appId: string;
  path: string;
}

/**
 * Arguments for build_app tool
 */
export interface BuildAppArgs {
  appId: string;
}

/**
 * Arguments for run_app tool
 */
export interface RunAppArgs {
  appId: string;
  container?: string;
}

/**
 * Arguments for send_data tool
 */
export interface SendDataArgs {
  appId: string;
  path: string;
  value: unknown;
}

/**
 * Arguments for get_state tool
 */
export interface GetStateArgs {
  appId: string;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events emitted by the sandbox system
 */
export type SandboxEventType =
  | 'app_created'
  | 'app_deleted'
  | 'file_changed'
  | 'build_started'
  | 'build_completed'
  | 'build_failed'
  | 'app_started'
  | 'app_stopped'
  | 'action_received'
  | 'state_changed'
  | 'error';

/**
 * Event payload
 */
export interface SandboxEvent {
  type: SandboxEventType;
  appId: string;
  timestamp: Date;
  data?: unknown;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for the sandbox system
 */
export interface SandboxConfig {
  autoBuildDebounce: number;
  maxFilesPerApp: number;
  maxFileSize: number;
  reactVersion: string;
  includeShadcn: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SandboxConfig = {
  autoBuildDebounce: 150,
  maxFilesPerApp: 100,
  maxFileSize: 1024 * 1024,
  reactVersion: '18.2.0',
  includeShadcn: true,
};
