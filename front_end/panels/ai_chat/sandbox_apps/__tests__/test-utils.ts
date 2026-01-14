// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Test utilities for sandbox_apps module
 */

// Sinon is provided globally by the test environment
declare const sinon: typeof import('sinon');

import type {BuildResult, SandboxAppState, VFSState} from '../types/SandboxTypes.js';
import {VFSManager} from '../vfs/VFSManager.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Reset all singletons for test isolation
 */
export function resetAllSingletons(): void {
  // Reset VFSManager
  VFSManager.getInstance().reset();

  // Reset SandboxController
  SandboxController.reset();
}

/**
 * Create a mock VFS state
 */
export function createMockVFSState(appId: string, files: Record<string, string> = {}): VFSState {
  return {
    appId,
    files,
    entry: '/src/index.tsx',
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

/**
 * Create a mock sandbox app state
 */
export function createMockAppState(overrides: Partial<SandboxAppState> = {}): SandboxAppState {
  const appId = overrides.appId || 'test-app';
  return {
    appId,
    name: overrides.name || 'Test App',
    vfs: overrides.vfs || createMockVFSState(appId),
    buildStatus: overrides.buildStatus || 'idle',
    lastBuild: overrides.lastBuild || null,
    iframeId: overrides.iframeId || null,
    isRunning: overrides.isRunning || false,
    appState: overrides.appState || {},
  };
}

/**
 * Create a mock successful build result
 */
export function createMockBuildResult(overrides: Partial<BuildResult> = {}): BuildResult {
  return {
    success: overrides.success ?? true,
    js: overrides.js || 'console.log("built");',
    css: overrides.css || 'body { margin: 0; }',
    errors: overrides.errors || [],
    warnings: overrides.warnings || [],
    durationMs: overrides.durationMs || 100,
  };
}

/**
 * Create a mock failed build result
 */
export function createMockFailedBuildResult(errorMessage: string): BuildResult {
  return {
    success: false,
    js: '',
    css: '',
    errors: [{message: errorMessage, severity: 'error'}],
    warnings: [],
    durationMs: 50,
  };
}

/**
 * Create a mock iframe Window object
 */
export function createMockIframeWindow(): Window {
  const messageCallbacks: Array<(event: MessageEvent) => void> = [];

  const mockWindow = {
    postMessage: sinon.stub(),
    addEventListener: sinon.stub().callsFake((event: string, callback: (event: MessageEvent) => void) => {
      if (event === 'message') {
        messageCallbacks.push(callback);
      }
    }),
    removeEventListener: sinon.stub(),
    // Helper to simulate receiving a message
    __simulateMessage: (data: unknown) => {
      const event = {data, source: mockWindow} as unknown as MessageEvent;
      messageCallbacks.forEach(cb => cb(event));
    },
  };

  return mockWindow as unknown as Window;
}

/**
 * Create a mock HTMLIFrameElement
 */
export function createMockIframe(contentWindow?: Window): HTMLIFrameElement {
  const mockWindow = contentWindow || createMockIframeWindow();

  const iframe = {
    id: 'mock-iframe',
    style: {cssText: ''},
    srcdoc: '',
    contentWindow: mockWindow,
    setAttribute: sinon.stub(),
    remove: sinon.stub(),
    onload: null as ((this: GlobalEventHandlers, ev: Event) => void) | null,
    onerror: null as OnErrorEventHandler,
    // Helper to trigger load
    __triggerLoad: () => {
      if (iframe.onload) {
        iframe.onload.call(iframe as unknown as GlobalEventHandlers, new Event('load'));
      }
    },
  };

  return iframe as unknown as HTMLIFrameElement;
}

/**
 * Stub the document.createElement to return mock iframes
 */
export function stubCreateElement(): {restore: () => void; lastIframe: HTMLIFrameElement | null} {
  const context: {lastIframe: HTMLIFrameElement | null} = {lastIframe: null};
  const originalCreateElement = document.createElement.bind(document);

  document.createElement = ((tagName: string) => {
    if (tagName.toLowerCase() === 'iframe') {
      context.lastIframe = createMockIframe();
      return context.lastIframe;
    }
    return originalCreateElement(tagName);
  }) as typeof document.createElement;

  return {
    restore: () => {
      document.createElement = originalCreateElement;
    },
    get lastIframe() {
      return context.lastIframe;
    },
  };
}

/**
 * Setup test app in controller without triggering async operations
 */
export async function setupTestApp(
  appId: string,
  name: string = 'Test App',
  files?: Record<string, string>,
): Promise<SandboxAppState> {
  const controller = SandboxController.getInstance();
  const appState = await controller.createApp(appId, name, files ? 'blank' : 'default');

  if (files) {
    const vfs = VFSManager.getInstance();
    for (const [path, content] of Object.entries(files)) {
      vfs.writeFile(appId, path, content);
    }
  }

  return appState;
}

/**
 * Create an app directly in controller's internal map for testing
 * This bypasses async operations and lets tools be tested in isolation
 */
export function injectMockApp(appState: SandboxAppState): void {
  const controller = SandboxController.getInstance();
  (controller as any).apps.set(appState.appId, appState);

  // Also create corresponding VFS
  const vfs = VFSManager.getInstance();
  if (!vfs.getApp(appState.appId)) {
    vfs.createApp(appState.appId, 'blank');
    for (const [path, content] of Object.entries(appState.vfs.files)) {
      vfs.writeFile(appState.appId, path, content);
    }
  }
}

/**
 * Type helper for accessing private methods in tests
 */
export function getPrivate<T>(obj: unknown, property: string): T {
  return (obj as Record<string, T>)[property];
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 1000,
  intervalMs: number = 10,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timeout after ${timeoutMs}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

/**
 * Delay for a specified time
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MockBundler - Simulates iframe bundler for unit tests
// =============================================================================

import {getSandboxProtocol, resetSandboxProtocol} from '../protocol/SandboxProtocol.js';
import type {VirtualFileMap} from '../types/SandboxTypes.js';
// Note: BuildResult is already imported at the top of this file

/**
 * Configuration for MockBundler behavior
 */
export interface MockBundlerConfig {
  /** Whether builds should succeed by default */
  defaultSuccess?: boolean;
  /** Default build duration in ms */
  defaultDurationMs?: number;
  /** Default JS output */
  defaultJs?: string;
  /** Default CSS output */
  defaultCss?: string;
  /** Simulate build delay (ms) before responding */
  buildDelayMs?: number;
  /** Custom build handler for advanced scenarios */
  buildHandler?: (files: VirtualFileMap, entry: string) => BuildResult;
}

/**
 * MockBundler - Simulates the iframe bundler for unit testing
 *
 * This allows testing SandboxController.buildApp() without an actual iframe.
 * The mock intercepts protocol messages and responds with configurable build results.
 *
 * Usage:
 * ```typescript
 * const mockBundler = new MockBundler();
 * mockBundler.install('my-app');
 *
 * // Now buildApp will work without an iframe
 * await controller.buildApp('my-app');
 *
 * mockBundler.uninstall();
 * ```
 */
export class MockBundler {
  private config: Required<MockBundlerConfig>;
  private installedApps: Set<string> = new Set();
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private buildCount = 0;

  constructor(config: MockBundlerConfig = {}) {
    this.config = {
      defaultSuccess: config.defaultSuccess ?? true,
      defaultDurationMs: config.defaultDurationMs ?? 50,
      defaultJs: config.defaultJs ?? 'console.log("mock build");',
      defaultCss: config.defaultCss ?? 'body { margin: 0; }',
      buildDelayMs: config.buildDelayMs ?? 0,
      buildHandler: config.buildHandler ?? null as unknown as (files: VirtualFileMap, entry: string) => BuildResult,
    };
  }

  /**
   * Install mock bundler for an app
   * This simulates the iframe being ready with esbuild-wasm initialized
   */
  install(appId: string): void {
    if (this.installedApps.has(appId)) {
      return;
    }

    this.installedApps.add(appId);

    // Create mock iframe window for protocol registration
    const mockWindow = this.createMockIframeWindow(appId);

    // Register with protocol (for postMessage fallback path used in tests)
    const protocol = getSandboxProtocol();
    protocol.registerIframe(appId, mockWindow);

    // Simulate bundler-ready message
    this.sendBundlerReady(appId);
  }

  /**
   * Install mock for multiple apps
   */
  installAll(appIds: string[]): void {
    for (const appId of appIds) {
      this.install(appId);
    }
  }

  /**
   * Uninstall mock bundler for an app
   */
  uninstall(appId?: string): void {
    if (appId) {
      this.installedApps.delete(appId);
      getSandboxProtocol().unregisterIframe(appId);
    } else {
      // Uninstall all
      for (const id of this.installedApps) {
        getSandboxProtocol().unregisterIframe(id);
      }
      this.installedApps.clear();
    }
  }

  /**
   * Reset the mock bundler completely
   */
  reset(): void {
    this.uninstall();
    this.buildCount = 0;
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
  }

  /**
   * Get the number of builds that have been processed
   */
  getBuildCount(): number {
    return this.buildCount;
  }

  /**
   * Configure a specific build result for the next build
   */
  setNextBuildResult(result: Partial<BuildResult>): void {
    const originalHandler = this.config.buildHandler;
    this.config.buildHandler = () => {
      // Restore original handler after one use
      this.config.buildHandler = originalHandler;
      return {
        success: result.success ?? this.config.defaultSuccess,
        js: result.js ?? this.config.defaultJs,
        css: result.css ?? this.config.defaultCss,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
        durationMs: result.durationMs ?? this.config.defaultDurationMs,
      };
    };
  }

  /**
   * Configure a build failure for the next build
   */
  setNextBuildFailure(errorMessage: string): void {
    this.setNextBuildResult({
      success: false,
      js: '',
      css: '',
      errors: [{message: errorMessage, severity: 'error'}],
      durationMs: 10,
    });
  }

  /**
   * Create mock iframe window that handles protocol messages
   */
  private createMockIframeWindow(appId: string): Window {
    const self = this;
    let syncedFiles: VirtualFileMap = {};
    let syncedEntry = '/src/index.tsx';

    const mockWindow = {
      postMessage: (data: unknown) => {
        // Handle messages from protocol
        const envelope = data as {__sandbox?: boolean; message?: {type: string; payload?: unknown}};
        if (!envelope.__sandbox || !envelope.message) {
          return;
        }

        const msg = envelope.message;

        switch (msg.type) {
          case 'sync-files': {
            const payload = msg.payload as {files: VirtualFileMap; entry: string};
            syncedFiles = payload.files;
            syncedEntry = payload.entry;
            break;
          }

          case 'build-request': {
            const payload = msg.payload as {buildId: number};
            self.handleBuildRequest(appId, payload.buildId, syncedFiles, syncedEntry);
            break;
          }

          case 'execute-code':
            // No-op for mock - code execution is simulated
            break;
        }
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    return mockWindow as unknown as Window;
  }

  /**
   * Handle a build request and send response
   */
  private handleBuildRequest(appId: string, buildId: number, files: VirtualFileMap, entry: string): void {
    this.buildCount++;

    const respond = () => {
      let result: BuildResult;

      if (this.config.buildHandler) {
        result = this.config.buildHandler(files, entry);
      } else {
        result = {
          success: this.config.defaultSuccess,
          js: this.config.defaultJs,
          css: this.config.defaultCss,
          errors: [],
          warnings: [],
          durationMs: this.config.defaultDurationMs,
        };
      }

      // Send build result via protocol dispatch
      getSandboxProtocol().dispatchMessage(appId, {
        type: 'build-result',
        payload: {
          buildId,
          success: result.success,
          js: result.js,
          css: result.css,
          errors: result.errors.map(e => e.message),
          warnings: result.warnings.map(w => w.message),
          durationMs: result.durationMs,
        },
      });
    };

    if (this.config.buildDelayMs > 0) {
      setTimeout(respond, this.config.buildDelayMs);
    } else {
      // Use microtask to ensure async behavior
      Promise.resolve().then(respond);
    }
  }

  /**
   * Send bundler-ready message to controller
   */
  private sendBundlerReady(appId: string): void {
    // Dispatch via protocol to notify controller that bundler is ready
    getSandboxProtocol().dispatchMessage(appId, {
      type: 'bundler-ready',
    });
  }
}

/**
 * Create and install a MockBundler for testing
 * Convenience function that handles setup and returns cleanup function
 */
export function setupMockBundler(appIds: string[], config?: MockBundlerConfig): {
  mockBundler: MockBundler;
  cleanup: () => void;
} {
  const mockBundler = new MockBundler(config);
  mockBundler.installAll(appIds);

  return {
    mockBundler,
    cleanup: () => {
      mockBundler.reset();
    },
  };
}
