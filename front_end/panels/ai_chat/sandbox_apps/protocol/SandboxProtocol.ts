// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../../core/sdk/sdk.js';
import type {DevToolsToSandboxMessage, SandboxToDevToolsMessage, VirtualFileMap, BuildResult} from '../types/SandboxTypes.js';

/**
 * Message envelope for sandbox communication
 */
interface SandboxMessageEnvelope {
  __sandbox: true;
  message: DevToolsToSandboxMessage | SandboxToDevToolsMessage;
}

/**
 * Handler for messages from the sandbox iframe
 */
export type SandboxMessageHandler = (message: SandboxToDevToolsMessage) => void;

/**
 * SandboxProtocol - A2UI-style message protocol for sandbox apps
 *
 * Provides bidirectional communication between DevTools and sandbox iframes.
 *
 * Communication modes:
 * - DevTools → SPA: Runtime.evaluate to call postMessage on iframe in inspected page
 * - SPA → DevTools: CDP binding (handled by SandboxController, dispatched via dispatchMessage)
 * - Fallback: Direct postMessage for iframes in DevTools context (testing)
 */
/**
 * Pending build request with resolve/reject callbacks
 */
interface PendingBuild {
  resolve: (result: BuildResult) => void;
  reject: (error: Error) => void;
  timer: number;
}

export class SandboxProtocol {
  private handlers: Map<string, Set<SandboxMessageHandler>> = new Map();
  // For iframes in DevTools context (testing/backwards compat)
  private iframeWindows: Map<string, Window> = new Map();
  // For iframes in inspected page (via RenderWebAppTool)
  private webappIds: Map<string, string> = new Map();
  private boundMessageHandler: (event: MessageEvent) => void;

  // For iframe bundler: pending build requests
  private pendingBuilds: Map<number, PendingBuild> = new Map();
  private nextBuildId = 1;
  private static readonly BUILD_TIMEOUT_MS = 30000;

  constructor() {
    this.boundMessageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.boundMessageHandler);
  }

  /**
   * Register an iframe for communication
   */
  registerIframe(appId: string, iframeWindow: Window): void {
    this.iframeWindows.set(appId, iframeWindow);
  }

  /**
   * Unregister an iframe
   */
  unregisterIframe(appId: string): void {
    this.iframeWindows.delete(appId);
  }

  /**
   * Register a webapp (iframe in inspected page) for communication
   */
  registerWebApp(appId: string, webappId: string): void {
    this.webappIds.set(appId, webappId);
  }

  /**
   * Unregister a webapp
   */
  unregisterWebApp(appId: string): void {
    this.webappIds.delete(appId);
  }

  /**
   * Dispatch a message from a CDP binding callback
   * Called by SandboxController when it receives a message via CDP binding
   */
  dispatchMessage(appId: string, message: SandboxToDevToolsMessage): void {
    // Handle iframe bundler response messages internally
    if (message.type === 'build-result') {
      this.handleBuildResult(message.payload.buildId, message.payload);
      return;
    }
    if (message.type === 'build-error') {
      this.handleBuildError(message.payload.buildId, message.payload.error);
      return;
    }

    // Dispatch to app-specific handlers
    this.handlers.get(appId)?.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`[SandboxProtocol] Handler error for ${appId}:`, error);
      }
    });

    // Dispatch to wildcard handlers
    this.handlers.get('*')?.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[SandboxProtocol] Wildcard handler error:', error);
      }
    });
  }

  /**
   * Handle build result from iframe bundler
   */
  private handleBuildResult(buildId: number, payload: {success: boolean; js: string; css: string; errors: string[]; warnings: string[]; durationMs: number}): void {
    const pending = this.pendingBuilds.get(buildId);
    if (!pending) {
      console.warn(`[SandboxProtocol] Received build result for unknown buildId: ${buildId}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingBuilds.delete(buildId);

    const result: BuildResult = {
      success: payload.success,
      js: payload.js,
      css: payload.css,
      errors: payload.errors.map(e => ({message: e, severity: 'error' as const})),
      warnings: payload.warnings.map(w => ({message: w, severity: 'warning' as const})),
      durationMs: payload.durationMs,
    };

    pending.resolve(result);
  }

  /**
   * Handle build error from iframe bundler
   */
  private handleBuildError(buildId: number, error: string): void {
    const pending = this.pendingBuilds.get(buildId);
    if (!pending) {
      console.warn(`[SandboxProtocol] Received build error for unknown buildId: ${buildId}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingBuilds.delete(buildId);
    pending.reject(new Error(error));
  }

  /**
   * Send a message to a sandbox iframe
   *
   * Uses Runtime.evaluate for webapps in inspected page, or direct postMessage for local iframes
   * Returns a Promise that resolves when the message has been sent (or rejects on error)
   */
  async send(appId: string, message: DevToolsToSandboxMessage): Promise<boolean> {
    const webappId = this.webappIds.get(appId);

    // If webapp is registered, send via Runtime.evaluate and WAIT for completion
    if (webappId) {
      return await this.sendViaRuntime(appId, webappId, message);
    }

    // Fallback: direct postMessage for local iframes (testing/backwards compat)
    const iframeWindow = this.iframeWindows.get(appId);
    if (!iframeWindow) {
      console.warn(`[SandboxProtocol] No iframe or webapp registered for app: ${appId}`);
      return false;
    }

    const envelope: SandboxMessageEnvelope = {
      __sandbox: true,
      message,
    };

    try {
      iframeWindow.postMessage(envelope, '*');
      return true;
    } catch (error) {
      console.error(`[SandboxProtocol] Failed to send message to ${appId}:`, error);
      return false;
    }
  }

  /**
   * Send message to webapp in inspected page via Runtime.evaluate
   * Returns true if message was successfully sent, false on error
   */
  private async sendViaRuntime(appId: string, webappId: string, message: DevToolsToSandboxMessage): Promise<boolean> {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      console.error(`[SandboxProtocol] No primary page target for app: ${appId}`);
      return false;
    }

    const runtimeModel = target.model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      console.error(`[SandboxProtocol] No runtime model for app: ${appId}`);
      return false;
    }

    const envelope: SandboxMessageEnvelope = {
      __sandbox: true,
      message,
    };

    // Find iframe by webapp ID and call postMessage on it
    const expression = `
      (() => {
        const iframe = document.querySelector('iframe[data-webapp-id="${webappId}"]');
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(${JSON.stringify(envelope)}, '*');
          return true;
        }
        return false;
      })()
    `;

    try {
      const response = await runtimeModel.agent.invoke_evaluate({
        expression,
        returnByValue: true,
      });

      if (response.getError() || response.exceptionDetails) {
        console.error(`[SandboxProtocol] Runtime.evaluate error for ${appId}:`, response.getError() || response.exceptionDetails);
        return false;
      }

      // Check the return value from the expression
      const result = response.result;
      return result?.value === true;
    } catch (error) {
      console.error(`[SandboxProtocol] Failed to send via runtime to ${appId}:`, error);
      return false;
    }
  }

  /**
   * Send init message with state
   */
  sendInit(appId: string, state: Record<string, unknown>): Promise<boolean> {
    return this.send(appId, {
      type: 'init',
      payload: {state},
    });
  }

  /**
   * Send data update at path
   */
  sendDataUpdate(appId: string, path: string, value: unknown): Promise<boolean> {
    return this.send(appId, {
      type: 'data-update',
      payload: {path, value},
    });
  }

  /**
   * Send execute action
   */
  sendExecute(appId: string, action: string, args: Record<string, unknown> = {}): Promise<boolean> {
    return this.send(appId, {
      type: 'execute',
      payload: {action, args},
    });
  }

  /**
   * Send hot reload with new code
   */
  sendHotReload(appId: string, js: string, css: string): Promise<boolean> {
    return this.send(appId, {
      type: 'hot-reload',
      payload: {js, css},
    });
  }

  /**
   * Request state snapshot
   */
  sendGetState(appId: string): Promise<boolean> {
    return this.send(appId, {type: 'get-state'});
  }

  // ===========================================================================
  // Iframe Bundler Methods
  // ===========================================================================

  /**
   * Sync files to the iframe bundler
   * Returns a Promise that resolves when the files have been sent
   */
  async sendSyncFiles(appId: string, files: VirtualFileMap, entry: string, incremental = false): Promise<boolean> {
    return await this.send(appId, {
      type: 'sync-files',
      payload: {files, entry, incremental},
    });
  }

  /**
   * Request a build from the iframe bundler
   * Returns a Promise that resolves with BuildResult or rejects on error/timeout
   */
  async requestBuild(appId: string): Promise<BuildResult> {
    const buildId = this.nextBuildId++;

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = window.setTimeout(() => {
        this.pendingBuilds.delete(buildId);
        reject(new Error(`Build timeout after ${SandboxProtocol.BUILD_TIMEOUT_MS}ms`));
      }, SandboxProtocol.BUILD_TIMEOUT_MS);

      // Store pending build
      this.pendingBuilds.set(buildId, {resolve, reject, timer});

      // Send build request (async, but we handle result via callback)
      this.send(appId, {
        type: 'build-request',
        payload: {buildId},
      }).then(sent => {
        if (!sent) {
          clearTimeout(timer);
          this.pendingBuilds.delete(buildId);
          reject(new Error(`Failed to send build request to app: ${appId}`));
        }
      }).catch(error => {
        clearTimeout(timer);
        this.pendingBuilds.delete(buildId);
        reject(error);
      });
    });
  }

  /**
   * Send bundled code to the iframe for execution
   * Use this after requestBuild() to execute the bundled code
   */
  sendExecuteCode(appId: string, js: string, css: string): Promise<boolean> {
    return this.send(appId, {
      type: 'execute-code',
      payload: {js, css},
    });
  }

  /**
   * Subscribe to messages from a specific app
   */
  subscribe(appId: string, handler: SandboxMessageHandler): () => void {
    if (!this.handlers.has(appId)) {
      this.handlers.set(appId, new Set());
    }
    this.handlers.get(appId)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(appId)?.delete(handler);
    };
  }

  /**
   * Subscribe to all messages
   */
  subscribeAll(handler: SandboxMessageHandler): () => void {
    return this.subscribe('*', handler);
  }

  /**
   * Handle incoming messages from iframes
   */
  private handleMessage(event: MessageEvent): void {
    const data = event.data as SandboxMessageEnvelope;
    if (!data || data.__sandbox !== true || !data.message) {
      return;
    }

    const message = data.message as SandboxToDevToolsMessage;

    // Find which app this message came from
    let sourceAppId: string | null = null;
    for (const [appId, win] of this.iframeWindows) {
      if (event.source === win) {
        sourceAppId = appId;
        break;
      }
    }

    if (!sourceAppId) {
      console.warn('[SandboxProtocol] Received message from unknown source');
      return;
    }

    // Dispatch to app-specific handlers
    this.handlers.get(sourceAppId)?.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`[SandboxProtocol] Handler error for ${sourceAppId}:`, error);
      }
    });

    // Dispatch to wildcard handlers
    this.handlers.get('*')?.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[SandboxProtocol] Wildcard handler error:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    window.removeEventListener('message', this.boundMessageHandler);
    this.handlers.clear();
    this.iframeWindows.clear();
    this.webappIds.clear();

    // Clean up pending builds
    for (const pending of this.pendingBuilds.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Protocol destroyed'));
    }
    this.pendingBuilds.clear();
  }
}

/**
 * Singleton instance
 */
let protocolInstance: SandboxProtocol | null = null;

export function getSandboxProtocol(): SandboxProtocol {
  if (!protocolInstance) {
    protocolInstance = new SandboxProtocol();
  }
  return protocolInstance;
}

export function resetSandboxProtocol(): void {
  if (protocolInstance) {
    protocolInstance.destroy();
    protocolInstance = null;
  }
}
