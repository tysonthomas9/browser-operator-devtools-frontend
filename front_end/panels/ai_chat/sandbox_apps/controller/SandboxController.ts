// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../../core/sdk/sdk.js';
import type {
  BuildResult,
  SandboxAppState,
  SandboxEvent,
  SandboxEventType,
  SandboxToDevToolsMessage,
  DEFAULT_CONFIG,
} from '../types/SandboxTypes.js';
import {VFSManager} from '../vfs/VFSManager.js';
import {getSandboxProtocol} from '../protocol/SandboxProtocol.js';
import {createPreviewHtml} from '../runtime/previewHtml.js';

/**
 * Event handler type
 */
type EventHandler = (event: SandboxEvent) => void;

/**
 * SandboxController - Main coordinator for sandbox apps
 *
 * Manages app lifecycle, coordinates VFS, bundler, and renderer.
 * Provides high-level API for AI tools.
 */
export class SandboxController {
  private static instance: SandboxController | null = null;

  private vfs: VFSManager;
  private apps: Map<string, SandboxAppState> = new Map();
  private buildTimers: Map<string, number> = new Map();
  private eventHandlers: Map<SandboxEventType | '*', Set<EventHandler>> = new Map();
  private autoBuildDebounce = 150;

  // CDP binding management for apps running in inspected page
  private bindingHandlers: Map<string, (event: {data: {name: string; payload: string}}) => void> = new Map();
  private appTargets: Map<string, SDK.Target.Target> = new Map();

  // Bundler-ready promise tracking - resolves when iframe bundler is initialized
  private bundlerReadyPromises: Map<string, {resolve: () => void; reject: (error: Error) => void}> = new Map();

  private constructor() {
    this.vfs = VFSManager.getInstance();
  }

  static getInstance(): SandboxController {
    if (!SandboxController.instance) {
      SandboxController.instance = new SandboxController();
    }
    return SandboxController.instance;
  }

  /**
   * Create a new sandbox app
   */
  async createApp(appId: string, name: string, template: 'blank' | 'default' | 'data-studio' = 'default'): Promise<SandboxAppState> {
    if (this.apps.has(appId)) {
      throw new Error(`App "${appId}" already exists`);
    }

    // Create VFS for app
    const vfsState = this.vfs.createApp(appId, template);

    // Create app state
    const appState: SandboxAppState = {
      appId,
      name,
      vfs: vfsState,
      buildStatus: 'idle',
      lastBuild: null,
      iframeId: null,
      isRunning: false,
      appState: {},
    };

    this.apps.set(appId, appState);

    // Subscribe to messages from this app
    getSandboxProtocol().subscribe(appId, this.handleAppMessage.bind(this, appId));

    this.emitEvent('app_created', appId, {name});

    return appState;
  }

  /**
   * Get an app's state
   */
  getApp(appId: string): SandboxAppState | null {
    return this.apps.get(appId) || null;
  }

  /**
   * List all apps
   */
  listApps(): SandboxAppState[] {
    return Array.from(this.apps.values());
  }

  /**
   * Delete an app
   */
  async deleteApp(appId: string): Promise<boolean> {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    // Stop if running
    if (app.isRunning) {
      await this.stopApp(appId);
    }

    // Cancel pending build
    this.cancelBuild(appId);

    // Delete VFS
    this.vfs.deleteApp(appId);

    // Remove from apps
    this.apps.delete(appId);

    this.emitEvent('app_deleted', appId);

    return true;
  }

  /**
   * Write a file to an app's VFS
   */
  async writeFile(appId: string, path: string, content: string, autoBuild = true): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }

    this.vfs.writeFile(appId, path, content);
    app.vfs = this.vfs.getApp(appId)!;

    this.emitEvent('file_changed', appId, {path, size: content.length});

    // Schedule auto-build
    if (autoBuild) {
      this.scheduleBuild(appId);
    }
  }

  /**
   * Read a file from an app's VFS
   */
  readFile(appId: string, path: string): string | null {
    return this.vfs.readFile(appId, path);
  }

  /**
   * Delete a file from an app's VFS
   */
  async deleteFile(appId: string, path: string, autoBuild = true): Promise<boolean> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }

    const deleted = this.vfs.deleteFile(appId, path);
    if (deleted) {
      app.vfs = this.vfs.getApp(appId)!;
      this.emitEvent('file_changed', appId, {path, deleted: true});

      if (autoBuild) {
        this.scheduleBuild(appId);
      }
    }

    return deleted;
  }

  /**
   * List files in an app's VFS
   */
  listFiles(appId: string): Array<{path: string; size: number}> {
    return this.vfs.listFiles(appId);
  }

  /**
   * Schedule a build (debounced)
   */
  scheduleBuild(appId: string): void {
    // Cancel existing timer
    this.cancelBuild(appId);

    // Schedule new build
    const timer = window.setTimeout(() => {
      this.buildTimers.delete(appId);
      this.buildApp(appId).catch(error => {
        console.error(`[SandboxController] Auto-build failed for ${appId}:`, error);
      });
    }, this.autoBuildDebounce);

    this.buildTimers.set(appId, timer);
  }

  /**
   * Cancel a scheduled build
   */
  cancelBuild(appId: string): void {
    const timer = this.buildTimers.get(appId);
    if (timer) {
      clearTimeout(timer);
      this.buildTimers.delete(appId);
    }
  }

  /**
   * Build an app using the iframe bundler
   *
   * The bundler now runs inside the iframe itself. This method:
   * 1. Syncs files to the iframe
   * 2. Requests a build from the iframe
   * 3. If successful and app is running, sends the bundled code for execution
   */
  async buildApp(appId: string): Promise<BuildResult> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }

    // Get files and entry
    const files = this.vfs.getFiles(appId);
    const entry = this.vfs.getEntry(appId);

    if (!files || !entry) {
      throw new Error(`App "${appId}" has no files`);
    }

    // Check if app is running (iframe bundler requires running iframe)
    if (!app.isRunning) {
      throw new Error(`App "${appId}" must be running to build. The bundler runs inside the iframe.`);
    }

    // Update status
    app.buildStatus = 'building';
    this.emitEvent('build_started', appId);

    try {
      const protocol = getSandboxProtocol();

      // Sync files to the iframe bundler - MUST await to ensure files are sent before build request
      const synced = await protocol.sendSyncFiles(appId, files, entry);
      if (!synced) {
        throw new Error(`Failed to sync files to iframe for app: ${appId}`);
      }

      // Request build from iframe and wait for result
      const result = await protocol.requestBuild(appId);

      // Update app state
      app.lastBuild = result;
      app.buildStatus = result.success ? 'success' : 'failed';

      if (result.success) {
        this.emitEvent('build_completed', appId, {durationMs: result.durationMs});

        // Execute the bundled code in the iframe
        protocol.sendExecuteCode(appId, result.js, result.css);
      } else {
        this.emitEvent('build_failed', appId, {errors: result.errors});
      }

      return result;
    } catch (error) {
      app.buildStatus = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);

      app.lastBuild = {
        success: false,
        js: '',
        css: '',
        errors: [{message: errorMessage, severity: 'error'}],
        warnings: [],
        durationMs: 0,
      };

      this.emitEvent('build_failed', appId, {errors: [errorMessage]});

      throw error;
    }
  }

  /**
   * Wait for the iframe bundler to signal it's ready
   */
  private waitForBundlerReady(appId: string, timeoutMs = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if bundler already signaled ready
      const existing = this.bundlerReadyPromises.get(appId);
      if (existing) {
        // Already waiting, which shouldn't happen, but just in case
        existing.reject(new Error('Duplicate waitForBundlerReady call'));
      }

      // Set up timeout
      const timer = setTimeout(() => {
        this.bundlerReadyPromises.delete(appId);
        reject(new Error(`Bundler initialization timeout (${timeoutMs}ms). Check network connectivity to unpkg.com.`));
      }, timeoutMs);

      this.bundlerReadyPromises.set(appId, {
        resolve: () => {
          clearTimeout(timer);
          this.bundlerReadyPromises.delete(appId);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          this.bundlerReadyPromises.delete(appId);
          reject(error);
        },
      });
    });
  }

  /**
   * Called when iframe bundler sends 'bundler-ready' message
   */
  private resolveBundlerReady(appId: string): void {
    const pending = this.bundlerReadyPromises.get(appId);
    if (pending) {
      pending.resolve();
    }
  }

  /**
   * Run an app in the inspected page
   *
   * Creates the iframe with the embedded bundler. After this, you can call buildApp()
   * to bundle and execute code within the iframe.
   */
  async runApp(appId: string, _container?: HTMLElement): Promise<string> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }

    // Import RenderWebAppTool dynamically
    const {RenderWebAppTool} = await import('../../tools/RenderWebAppTool.js');

    // Create preview HTML with app ID for CDP binding
    // The iframe includes the embedded bundler which preloads esbuild-wasm
    const previewHtml = createPreviewHtml({appId});

    // Render webapp in inspected page (initially with empty js/css - bundler not yet run)
    const tool = new RenderWebAppTool();
    const result = await tool.execute({
      html: previewHtml,
      css: '',
      js: '',  // No initial JS - will be bundled after iframe is ready
      reasoning: `Running sandbox app: ${app.name}`,
    });

    if ('error' in result) {
      throw new Error(result.error);
    }

    const webappId = result.webappId;

    // Install CDP binding for SPA → DevTools communication
    await this.installBridge(appId, webappId);

    // Register webapp with protocol for DevTools → SPA communication
    getSandboxProtocol().registerWebApp(appId, webappId);

    // Update state
    app.iframeId = webappId;
    app.isRunning = true;

    this.emitEvent('app_started', appId, {iframeId: webappId});

    // Wait for esbuild-wasm to initialize in the iframe
    // The iframe sends 'bundler-ready' message when esbuild is ready
    await this.waitForBundlerReady(appId);

    // Now trigger initial build
    try {
      await this.buildApp(appId);
    } catch (error) {
      console.warn(`[SandboxController] Initial build failed for ${appId}:`, error);
      // Don't throw - app is still running, user can retry build
    }

    return webappId;
  }

  /**
   * Install CDP binding for SPA → DevTools communication
   */
  private async installBridge(appId: string, webappId: string): Promise<void> {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      throw new Error('No primary page target available');
    }

    const runtimeModel = target.model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error('RuntimeModel not available');
    }

    const bindingName = `__sandboxAppBridge_${appId}`;

    // Create handler for binding calls
    const handler = this.handleBindingCalled.bind(this, appId);
    this.bindingHandlers.set(appId, handler);
    this.appTargets.set(appId, target);

    runtimeModel.addEventListener(SDK.RuntimeModel.Events.BindingCalled, handler);

    // Add the binding - this creates window.__sandboxAppBridge_{appId}() in the page
    await target.runtimeAgent().invoke_addBinding({name: bindingName});

    // Inject the binding into the iframe's context
    const injectExpression = `
      (() => {
        const iframe = document.querySelector('iframe[data-webapp-id="${webappId}"]');
        if (iframe?.contentWindow) {
          // Create binding wrapper in iframe context
          const script = iframe.contentDocument.createElement('script');
          script.textContent = \`
            window['${bindingName}'] = function(payload) {
              // Relay to parent's binding
              parent['${bindingName}'](payload);
            };
          \`;
          iframe.contentDocument.head.appendChild(script);
        }
      })()
    `;

    await runtimeModel.agent.invoke_evaluate({
      expression: injectExpression,
    });
  }

  /**
   * Uninstall CDP binding
   */
  private async uninstallBridge(appId: string): Promise<void> {
    const target = this.appTargets.get(appId);
    const handler = this.bindingHandlers.get(appId);

    if (target) {
      const runtimeModel = target.model(SDK.RuntimeModel.RuntimeModel);

      // Remove event listener
      if (runtimeModel && handler) {
        runtimeModel.removeEventListener(SDK.RuntimeModel.Events.BindingCalled, handler);
      }

      // Remove the binding
      try {
        await target.runtimeAgent().invoke_removeBinding({
          name: `__sandboxAppBridge_${appId}`,
        });
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    this.bindingHandlers.delete(appId);
    this.appTargets.delete(appId);
  }

  /**
   * Handle binding calls from SPA
   */
  private handleBindingCalled(appId: string, event: {data: {name: string; payload: string}}): void {
    const expectedName = `__sandboxAppBridge_${appId}`;
    if (event.data.name !== expectedName) {
      return;
    }

    try {
      const message = JSON.parse(event.data.payload) as SandboxToDevToolsMessage;
      // Dispatch to protocol (which will call handlers)
      getSandboxProtocol().dispatchMessage(appId, message);
    } catch (error) {
      console.error(`[SandboxController] Failed to parse binding message for ${appId}:`, error);
    }
  }

  /**
   * Stop a running app
   */
  async stopApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      return;
    }

    if (app.isRunning && app.iframeId) {
      // Uninstall CDP binding
      await this.uninstallBridge(appId);

      // Unregister from protocol
      getSandboxProtocol().unregisterWebApp(appId);

      // Remove webapp from inspected page
      try {
        const {RemoveWebAppTool} = await import('../../tools/RemoveWebAppTool.js');
        const tool = new RemoveWebAppTool();
        await tool.execute({
          webappId: app.iframeId,
          reasoning: `Stopping sandbox app: ${app.name}`,
        });
      } catch (error) {
        console.error(`[SandboxController] Failed to remove webapp for ${appId}:`, error);
      }

      app.iframeId = null;
      app.isRunning = false;

      this.emitEvent('app_stopped', appId);
    }
  }

  /**
   * Send data update to a running app
   */
  async sendDataUpdate(appId: string, path: string, value: unknown): Promise<boolean> {
    const app = this.apps.get(appId);
    if (!app || !app.isRunning) {
      return false;
    }

    return getSandboxProtocol().sendDataUpdate(appId, path, value);
  }

  /**
   * Get app state from running app
   */
  getAppState(appId: string): Record<string, unknown> {
    const app = this.apps.get(appId);
    return app?.appState || {};
  }

  /**
   * Handle messages from app iframe
   */
  private handleAppMessage(appId: string, message: SandboxToDevToolsMessage): void {
    const app = this.apps.get(appId);
    if (!app) {
      return;
    }

    switch (message.type) {
      case 'ready':
        // App is ready
        break;

      case 'bundler-ready':
        // Iframe bundler (esbuild-wasm) has finished initializing
        this.resolveBundlerReady(appId);
        break;

      case 'state-changed':
        app.appState = {
          ...app.appState,
          ...this.setAtPath({}, message.payload.path, message.payload.value),
        };
        this.emitEvent('state_changed', appId, message.payload);
        break;

      case 'state-snapshot':
        app.appState = message.payload.state;
        break;

      case 'action':
        this.emitEvent('action_received', appId, message.payload);
        break;

      case 'error':
        this.emitEvent('error', appId, message.payload);
        break;
    }
  }

  /**
   * Set value at path in object
   */
  private setAtPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const parts = path.split('/').filter(Boolean);
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    if (parts.length > 0) {
      current[parts[parts.length - 1]] = value;
    }

    return obj;
  }

  /**
   * Subscribe to events
   */
  on(eventType: SandboxEventType | '*', handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  private emitEvent(type: SandboxEventType, appId: string, data?: unknown): void {
    const event: SandboxEvent = {
      type,
      appId,
      timestamp: new Date(),
      data,
    };

    // Emit to specific handlers
    this.eventHandlers.get(type)?.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[SandboxController] Event handler error:`, error);
      }
    });

    // Emit to wildcard handlers
    this.eventHandlers.get('*')?.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[SandboxController] Event handler error:`, error);
      }
    });
  }

  /**
   * Reset the controller (for testing)
   */
  static reset(): void {
    if (SandboxController.instance) {
      // Clean up all apps
      for (const appId of SandboxController.instance.apps.keys()) {
        SandboxController.instance.deleteApp(appId);
      }
      SandboxController.instance = null;
    }

    VFSManager.getInstance().reset();
    // Note: Bundler now runs inside iframe, no separate reset needed
  }
}
