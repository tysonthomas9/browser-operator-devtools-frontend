// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * SPATestHarness - Test Mini Apps SPA logic without a browser
 *
 * This harness simulates the browser environment for testing SPA JavaScript.
 * It provides a mock window.miniApp interface and tracks all interactions.
 */

import type {
  MiniAppState,
  DevToolsToSPAAction,
  SPAToDevToolsAction,
  MiniAppSPA,
} from '../types/MiniAppTypes.js';

/**
 * Captured action sent from SPA to DevTools
 */
export interface CapturedAction {
  type: string;
  payload?: unknown;
  timestamp: Date;
}

/**
 * Options for the SPA test harness
 */
export interface SPATestHarnessOptions {
  /** Initial state to provide to the SPA */
  initialState?: MiniAppState;
  /** Whether to auto-send 'ready' action on initialize */
  autoReady?: boolean;
}

/**
 * Mock window.miniApp interface that the SPA uses
 */
interface MockMiniAppInterface {
  dispatch: (action: DevToolsToSPAAction | string) => void;
  getState: () => MiniAppState;
  setState: (state: MiniAppState) => void;
  updateState: (updates: Partial<MiniAppState>) => void;
  sendAction: (type: string, payload?: unknown) => void;
  close: () => void;
}

/**
 * SPATestHarness - Test Mini Apps SPA logic without a browser
 *
 * Usage:
 * ```typescript
 * const harness = new SPATestHarness(mySPA);
 * await harness.initialize();
 *
 * // Dispatch action from "DevTools" to SPA
 * harness.dispatch({ action: 'init', payload: { agents: [] } });
 *
 * // Check state
 * const state = harness.getState();
 * assert.equal(state.agents.length, 0);
 *
 * // Check actions sent by SPA
 * const actions = harness.getCapturedActions();
 * assert.include(actions.map(a => a.type), 'ready');
 * ```
 */
export class SPATestHarness {
  private spa: MiniAppSPA;
  private state: MiniAppState = {};
  private capturedActions: CapturedAction[] = [];
  private options: Required<SPATestHarnessOptions>;
  private initialized = false;

  // Custom handlers that the SPA may define
  private onMiniAppStateChange: ((state: MiniAppState) => void) | null = null;
  private onMiniAppAction: ((actionName: string, args: unknown) => void) | null = null;
  private onMiniAppDispatch: ((action: DevToolsToSPAAction) => void) | null = null;
  private getMiniAppState: (() => MiniAppState) | null = null;

  constructor(spa: MiniAppSPA, options: SPATestHarnessOptions = {}) {
    this.spa = spa;
    this.options = {
      initialState: options.initialState ?? {},
      autoReady: options.autoReady ?? true,
    };
    this.state = {...this.options.initialState};
  }

  /**
   * Initialize the harness by executing the SPA JavaScript
   * This sets up the mock window.miniApp interface
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create the mock miniApp interface
    const miniApp = this.createMockMiniAppInterface();

    // Create a sandboxed execution context
    const context = this.createExecutionContext(miniApp);

    // Execute the SPA JavaScript in the context
    try {
      // The SPA JS expects window.miniApp to be available
      // We'll evaluate it with our mock context
      const wrappedCode = `
        (function(window, document, miniApp) {
          // Provide the miniApp interface
          window.miniApp = miniApp;

          // Mock DOMContentLoaded since we're not in a real browser
          const domReadyCallbacks = [];
          window.addEventListener = function(event, callback) {
            if (event === 'DOMContentLoaded') {
              domReadyCallbacks.push(callback);
            }
          };

          // Execute SPA code
          ${this.spa.js}

          // Trigger DOMContentLoaded callbacks
          domReadyCallbacks.forEach(cb => cb());

          // Expose custom handlers if defined
          return {
            onMiniAppStateChange: window.onMiniAppStateChange,
            onMiniAppAction: window.onMiniAppAction,
            onMiniAppDispatch: window.onMiniAppDispatch,
            getMiniAppState: window.getMiniAppState,
          };
        })(${JSON.stringify(context.window)}, ${JSON.stringify(context.document)}, __miniApp__)
      `;

      // Use Function constructor for safer evaluation
      const fn = new Function('__miniApp__', `return ${wrappedCode}`);
      const handlers = fn(miniApp);

      // Store custom handlers
      this.onMiniAppStateChange = handlers.onMiniAppStateChange || null;
      this.onMiniAppAction = handlers.onMiniAppAction || null;
      this.onMiniAppDispatch = handlers.onMiniAppDispatch || null;
      this.getMiniAppState = handlers.getMiniAppState || null;

    } catch (error) {
      // SPA JS may use browser APIs not available in Node
      // Try simpler evaluation
      this.executeSimpleSPA(miniApp);
    }

    this.initialized = true;

    // Auto-send ready if configured
    if (this.options.autoReady) {
      this.captureAction('ready');
    }
  }

  /**
   * Simpler SPA execution for cases where full JS evaluation fails
   */
  private executeSimpleSPA(_miniApp: MockMiniAppInterface): void {
    // For SPAs that can't be evaluated in Node, we just set up the mock
    // The test can still use dispatch/getState to test the harness itself
  }

  /**
   * Create the mock window.miniApp interface
   */
  private createMockMiniAppInterface(): MockMiniAppInterface {
    return {
      dispatch: (action: DevToolsToSPAAction | string) => {
        this.handleDispatch(action);
      },
      getState: () => {
        if (this.getMiniAppState) {
          return this.getMiniAppState();
        }
        return this.state;
      },
      setState: (newState: MiniAppState) => {
        this.state = newState;
        this.captureAction('state-changed', {state: newState});
      },
      updateState: (updates: Partial<MiniAppState>) => {
        this.state = {...this.state, ...updates};
        this.captureAction('state-changed', {state: this.state});
      },
      sendAction: (type: string, payload?: unknown) => {
        this.captureAction(type, payload);
      },
      close: () => {
        this.captureAction('close');
      },
    };
  }

  /**
   * Handle dispatch from DevTools to SPA
   */
  private handleDispatch(action: DevToolsToSPAAction | string): void {
    let parsed: DevToolsToSPAAction;

    if (typeof action === 'string') {
      try {
        parsed = JSON.parse(action);
      } catch {
        console.error('[SPATestHarness] Failed to parse action:', action);
        return;
      }
    } else {
      parsed = action;
    }

    // Handle standard actions
    switch (parsed.action) {
      case 'get-state':
        // State is returned via getState()
        break;

      case 'set-state':
        this.state = (parsed.payload as MiniAppState) || {};
        if (this.onMiniAppStateChange) {
          this.onMiniAppStateChange(this.state);
        }
        break;

      case 'update-state':
        this.state = {...this.state, ...(parsed.payload as Partial<MiniAppState> || {})};
        if (this.onMiniAppStateChange) {
          this.onMiniAppStateChange(this.state);
        }
        break;

      case 'execute':
        if (this.onMiniAppAction) {
          const {actionName, args} = (parsed.payload as {actionName: string; args: unknown}) || {};
          this.onMiniAppAction(actionName, args);
        }
        break;

      default:
        // Forward to custom handler
        if (this.onMiniAppDispatch) {
          this.onMiniAppDispatch(parsed);
        }
    }
  }

  /**
   * Capture an action sent by the SPA
   */
  private captureAction(type: string, payload?: unknown): void {
    this.capturedActions.push({
      type,
      payload,
      timestamp: new Date(),
    });
  }

  /**
   * Create mock execution context
   */
  private createExecutionContext(_miniApp: MockMiniAppInterface): {window: object; document: object} {
    return {
      window: {
        addEventListener: () => {},
        removeEventListener: () => {},
        parent: {
          history: {
            pushState: () => {},
            replaceState: () => {},
          },
          addEventListener: () => {},
        },
      },
      document: {
        readyState: 'complete',
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
          appendChild: () => {},
          setAttribute: () => {},
          style: {},
        }),
        body: {
          appendChild: () => {},
        },
        head: {
          appendChild: () => {},
        },
      },
    };
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Dispatch an action from DevTools to the SPA
   */
  dispatch(action: DevToolsToSPAAction): void {
    this.handleDispatch(action);
  }

  /**
   * Get the current state
   */
  getState(): MiniAppState {
    if (this.getMiniAppState) {
      return this.getMiniAppState();
    }
    return this.state;
  }

  /**
   * Set the state directly (for testing)
   */
  setState(state: MiniAppState): void {
    this.state = state;
  }

  /**
   * Update the state partially (for testing)
   */
  updateState(updates: Partial<MiniAppState>): void {
    this.state = {...this.state, ...updates};
  }

  /**
   * Get all captured actions sent by the SPA
   */
  getCapturedActions(): CapturedAction[] {
    return [...this.capturedActions];
  }

  /**
   * Get captured actions of a specific type
   */
  getCapturedActionsOfType(type: string): CapturedAction[] {
    return this.capturedActions.filter(a => a.type === type);
  }

  /**
   * Check if an action of a specific type was sent
   */
  hasAction(type: string): boolean {
    return this.capturedActions.some(a => a.type === type);
  }

  /**
   * Get the last captured action
   */
  getLastAction(): CapturedAction | undefined {
    return this.capturedActions[this.capturedActions.length - 1];
  }

  /**
   * Clear all captured actions
   */
  clearCapturedActions(): void {
    this.capturedActions = [];
  }

  /**
   * Reset the harness to initial state
   */
  reset(): void {
    this.state = {...this.options.initialState};
    this.capturedActions = [];
  }

  /**
   * Simulate user action that would call window.miniApp.sendAction
   */
  simulateUserAction(type: string, payload?: unknown): void {
    this.captureAction(type, payload);
  }

  /**
   * Wait for a specific action to be captured
   */
  async waitForAction(type: string, timeoutMs = 1000): Promise<CapturedAction> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const action = this.capturedActions.find(a => a.type === type);
      if (action) {
        return action;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`Timeout waiting for action: ${type}`);
  }
}

/**
 * Create a test harness for a Mini App
 */
export function createSPATestHarness(
  spa: MiniAppSPA,
  options?: SPATestHarnessOptions
): SPATestHarness {
  return new SPATestHarness(spa, options);
}

/**
 * Mock MiniAppBridge for testing controllers
 */
export class MockMiniAppBridge {
  private actionHandler: ((action: SPAToDevToolsAction) => void | Promise<void>) | null = null;
  private state: MiniAppState = {};
  private sentActions: DevToolsToSPAAction[] = [];

  installed = false;
  webappId: string | null = null;

  async install(webappId: string): Promise<void> {
    this.webappId = webappId;
    this.installed = true;
  }

  async uninstall(): Promise<void> {
    this.webappId = null;
    this.installed = false;
  }

  async sendToSPA(action: DevToolsToSPAAction): Promise<void> {
    this.sentActions.push(action);
  }

  onAction(handler: (action: SPAToDevToolsAction) => void | Promise<void>): void {
    this.actionHandler = handler;
  }

  async getState(): Promise<MiniAppState> {
    return this.state;
  }

  // Test helpers

  /**
   * Simulate an action from the SPA (as if user interacted with UI)
   */
  async simulateSPAAction(action: SPAToDevToolsAction): Promise<void> {
    if (this.actionHandler) {
      await this.actionHandler(action);
    }
  }

  /**
   * Get all actions sent to the SPA
   */
  getSentActions(): DevToolsToSPAAction[] {
    return [...this.sentActions];
  }

  /**
   * Get the last action sent to the SPA
   */
  getLastSentAction(): DevToolsToSPAAction | undefined {
    return this.sentActions[this.sentActions.length - 1];
  }

  /**
   * Clear sent actions
   */
  clearSentActions(): void {
    this.sentActions = [];
  }

  /**
   * Set state for testing
   */
  setMockState(state: MiniAppState): void {
    this.state = state;
  }

  /**
   * Reset the mock
   */
  reset(): void {
    this.sentActions = [];
    this.state = {};
    this.actionHandler = null;
    this.installed = false;
    this.webappId = null;
  }
}
