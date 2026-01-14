// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Sandbox App Abstraction Layer Types
 *
 * Defines the interfaces for sandbox apps following the MiniApp pattern:
 * - SandboxApp: App definition (template, sources, supported actions)
 * - SandboxAppController: Per-instance business logic and state management
 * - SandboxAppBridge: Communication layer between DevTools and iframe
 *
 * This architecture allows:
 * - Multiple app types (Data Studio, Form Builder, etc.)
 * - Multiple instances per app type (each user-created app)
 * - Clean separation between app logic and sandbox infrastructure
 */

import type {VirtualFileMap} from './SandboxTypes.js';

// =============================================================================
// Action & State Schema Types (for AI Tool Integration)
// =============================================================================

/**
 * Schema for an action that an app supports.
 * Used by AI tools to understand what actions can be executed.
 */
export interface SandboxAppActionSchema {
  name: string;
  description: string;
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Schema describing the app's state structure.
 * Used by AI tools to understand what state is available.
 */
export interface SandboxAppStateSchema {
  type: string;
  properties: Record<string, {type: string; description: string}>;
}

/**
 * Action message from the SPA to the controller.
 */
export interface SandboxAppAction {
  type: string;
  payload?: Record<string, unknown>;
}

// =============================================================================
// Bridge Interface
// =============================================================================

/**
 * Communication bridge between DevTools and the sandbox iframe.
 * Each app instance gets its own bridge instance.
 *
 * Uses CDP for reliable communication:
 * - DevTools → SPA: Runtime.evaluate to call postMessage
 * - SPA → DevTools: Runtime.addBinding for direct callbacks
 */
export interface SandboxAppBridge {
  /**
   * Install the bridge for a specific app instance.
   * Sets up CDP bindings for bidirectional communication.
   */
  install(appId: string, webappId: string): Promise<void>;

  /**
   * Uninstall the bridge and cleanup CDP bindings.
   */
  uninstall(): Promise<void>;

  /**
   * Send a message to the SPA running in the iframe.
   */
  sendToSPA(message: object): Promise<void>;

  /**
   * Register a handler for messages from the SPA.
   */
  onMessage(handler: (msg: SandboxAppAction) => void): void;

  /**
   * Request and receive the current state from the SPA.
   */
  getState(): Promise<Record<string, unknown>>;

  /**
   * Whether the bridge is currently installed.
   */
  readonly installed: boolean;
}

// =============================================================================
// Controller Interface
// =============================================================================

/**
 * Per-instance controller that manages business logic for a sandbox app.
 * Similar to MiniAppController but for sandbox apps.
 *
 * Responsibilities:
 * - State management
 * - Action execution (from AI tools or SPA)
 * - Data persistence
 * - Coordination with sandbox infrastructure
 */
export interface SandboxAppController {
  /**
   * Unique instance ID for this app instance.
   */
  readonly appId: string;

  /**
   * Initialize the controller with a bridge.
   * Called after the iframe is created and bridge is installed.
   */
  initialize(bridge: SandboxAppBridge): Promise<void>;

  /**
   * Get the current state from the SPA.
   */
  getState(): Promise<Record<string, unknown>>;

  /**
   * Update the state in the SPA.
   */
  setState(state: Record<string, unknown>): Promise<void>;

  /**
   * Execute an action (from AI tools).
   * Returns the result of the action.
   */
  executeAction(name: string, args: unknown): Promise<unknown>;

  /**
   * Handle a message from the SPA.
   * Called by the bridge when the SPA sends an action.
   */
  handleMessage(action: SandboxAppAction): Promise<void>;

  /**
   * Cleanup resources when the app is closed.
   */
  cleanup(): Promise<void>;

  /**
   * Optional: Register a callback to be called when the app needs rebuilding.
   * Used for hot-reload functionality.
   */
  onRebuild?(callback: () => Promise<void>): void;
}

// =============================================================================
// App Definition Interface
// =============================================================================

/**
 * App definition that describes a type of sandbox app.
 * Similar to MiniApp interface but for sandbox apps.
 *
 * Each app type (Data Studio, Form Builder, etc.) implements this interface
 * to define its sources, supported actions, and controller factory.
 */
export interface SandboxApp {
  /**
   * Unique identifier for this app type (e.g., 'data-studio').
   */
  id: string;

  /**
   * Display name (e.g., 'Data Studio').
   */
  name: string;

  /**
   * Brief description for the launcher.
   */
  description: string;

  /**
   * Icon emoji or identifier.
   */
  icon: string;

  /**
   * Template type for VFS initialization.
   */
  template: 'blank' | 'default' | 'data-studio';

  /**
   * Get the source files for this app type.
   * Returns a map of file paths to contents.
   */
  getSources(): VirtualFileMap;

  /**
   * Get the actions this app supports.
   * Used by AI tools to discover available actions.
   */
  getSupportedActions(): SandboxAppActionSchema[];

  /**
   * Get the state schema for this app.
   * Used by AI tools to understand app state.
   */
  getStateSchema(): SandboxAppStateSchema;

  /**
   * Factory method to create a controller for a new instance.
   */
  createController(instanceId: string): SandboxAppController;
}

// =============================================================================
// Instance Metadata
// =============================================================================

/**
 * Runtime metadata for a sandbox app instance.
 * Tracks the app definition, controller, bridge, and lifecycle info.
 */
export interface SandboxAppInstance {
  /**
   * The app definition this instance was created from.
   */
  app: SandboxApp;

  /**
   * The controller managing this instance's business logic.
   */
  controller: SandboxAppController;

  /**
   * The communication bridge for this instance.
   */
  bridge: SandboxAppBridge;

  /**
   * Unique instance ID (user-created app ID).
   */
  instanceId: string;

  /**
   * The webapp ID used for iframe targeting.
   */
  webappId: string;

  /**
   * When this instance was launched.
   */
  launchedAt: Date;

  /**
   * User-provided name for this instance.
   */
  name: string;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events emitted by sandbox app controllers.
 */
export type SandboxAppEventType =
  | 'state_changed'
  | 'action_executed'
  | 'error';

/**
 * Event payload for sandbox app events.
 */
export interface SandboxAppEvent {
  type: SandboxAppEventType;
  instanceId: string;
  timestamp: Date;
  data?: unknown;
}
