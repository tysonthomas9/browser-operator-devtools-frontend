// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../../core/sdk/sdk.js';
import type {SandboxAppBridge, SandboxAppAction} from '../types/SandboxAppTypes.js';

/**
 * SandboxAppBridge - Per-instance communication bridge
 *
 * Manages bidirectional communication between DevTools and the sandbox iframe:
 * - DevTools → SPA: Runtime.evaluate to call postMessage on iframe
 * - SPA → DevTools: Runtime.addBinding for direct callbacks
 *
 * Each app instance gets its own bridge with isolated bindings.
 */
export class SandboxAppBridgeImpl implements SandboxAppBridge {
  private appId: string;
  private webappId: string | null = null;
  private target: SDK.Target.Target | null = null;
  private messageHandler: ((msg: SandboxAppAction) => void) | null = null;
  private bindingHandler: ((event: {data: {name: string; payload: string}}) => void) | null = null;
  private _installed = false;

  // Fix #3: Use Map with request IDs to handle concurrent getState() calls
  private stateRequestId = 0;
  private stateRequestCallbacks: Map<number, {
    resolve: (state: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timeout: number;
  }> = new Map();

  constructor(appId: string) {
    this.appId = appId;
  }

  get installed(): boolean {
    return this._installed;
  }

  /**
   * Install the bridge for a specific app instance.
   * Sets up CDP bindings for bidirectional communication.
   */
  async install(appId: string, webappId: string): Promise<void> {
    if (this._installed) {
      throw new Error(`Bridge already installed for ${this.appId}`);
    }

    this.appId = appId;
    this.webappId = webappId;
    this.target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();

    if (!this.target) {
      throw new Error('No primary page target available');
    }

    const runtimeModel = this.target.model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error('RuntimeModel not available');
    }

    const bindingName = this.getBindingName();

    // Create handler for binding calls from SPA
    this.bindingHandler = (event: {data: {name: string; payload: string}}) => {
      if (event.data.name !== bindingName) {
        return;
      }

      try {
        const message = JSON.parse(event.data.payload) as SandboxAppAction;
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error(`[SandboxAppBridge] Failed to parse message for ${this.appId}:`, error);
      }
    };

    runtimeModel.addEventListener(SDK.RuntimeModel.Events.BindingCalled, this.bindingHandler);

    // Add the binding - creates window.__sandboxAppBridge_{appId}() in the page
    await this.target.runtimeAgent().invoke_addBinding({name: bindingName});

    // Inject the binding into the iframe's context
    await this.injectBindingIntoIframe();

    this._installed = true;
  }

  /**
   * Inject the binding relay into the iframe.
   * Fix #2: Proper error handling - throw instead of silent return, verify injection success.
   */
  private async injectBindingIntoIframe(): Promise<void> {
    if (!this.target || !this.webappId) {
      throw new Error('Cannot inject binding: target or webappId not set');
    }

    const runtimeModel = this.target.model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error('RuntimeModel not available for binding injection');
    }

    const bindingName = this.getBindingName();
    const injectExpression = `
      (() => {
        const iframe = document.querySelector('iframe[data-webapp-id="${this.webappId}"]');
        if (!iframe?.contentWindow || !iframe.contentDocument) {
          return { success: false, error: 'Iframe not found or not accessible' };
        }
        try {
          const script = iframe.contentDocument.createElement('script');
          script.textContent = \`
            window['${bindingName}'] = function(payload) {
              parent['${bindingName}'](payload);
            };
          \`;
          iframe.contentDocument.head.appendChild(script);
          return {
            success: typeof iframe.contentWindow['${bindingName}'] === 'function',
            error: null
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `;

    const result = await runtimeModel.agent.invoke_evaluate({
      expression: injectExpression,
      returnByValue: true,
    });

    if (result.getError()) {
      throw new Error(`Failed to inject binding: ${result.getError()}`);
    }

    const value = result.result?.value as {success: boolean; error: string | null} | undefined;
    if (!value?.success) {
      throw new Error(`Binding injection failed: ${value?.error || 'Unknown error'}`);
    }
  }

  /**
   * Handle incoming messages from the SPA.
   * Fix #3: Support request IDs for concurrent getState() calls.
   */
  private handleIncomingMessage(message: SandboxAppAction): void {
    // Handle state snapshot response (for getState())
    if (message.type === 'state-snapshot') {
      const payload = message.payload as {state: Record<string, unknown>; requestId?: number} | undefined;
      const requestId = payload?.requestId;

      if (requestId !== undefined) {
        // New format with requestId - match to specific callback
        const callback = this.stateRequestCallbacks.get(requestId);
        if (callback) {
          clearTimeout(callback.timeout);
          this.stateRequestCallbacks.delete(requestId);
          callback.resolve(payload?.state || {});
        }
      } else if (this.stateRequestCallbacks.size === 1) {
        // Legacy format: only one pending request, safe to use it
        const entry = this.stateRequestCallbacks.entries().next().value;
        if (entry) {
          const [id, callback] = entry;
          clearTimeout(callback.timeout);
          this.stateRequestCallbacks.delete(id);
          callback.resolve(payload?.state || {});
        }
      }
      // If multiple callbacks without requestId, we can't match - ignore
      return;
    }

    // Dispatch to registered handler
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  /**
   * Uninstall the bridge and cleanup CDP bindings.
   */
  async uninstall(): Promise<void> {
    if (!this._installed) {
      return;
    }

    if (this.target) {
      const runtimeModel = this.target.model(SDK.RuntimeModel.RuntimeModel);

      // Remove event listener
      if (runtimeModel && this.bindingHandler) {
        runtimeModel.removeEventListener(SDK.RuntimeModel.Events.BindingCalled, this.bindingHandler);
      }

      // Remove the binding
      try {
        await this.target.runtimeAgent().invoke_removeBinding({
          name: this.getBindingName(),
        });
      } catch {
        // Ignore errors during cleanup
      }
    }

    this.bindingHandler = null;
    this.messageHandler = null;
    // Clean up any pending state request callbacks
    for (const callback of this.stateRequestCallbacks.values()) {
      clearTimeout(callback.timeout);
      callback.reject(new Error('Bridge uninstalled'));
    }
    this.stateRequestCallbacks.clear();
    this.webappId = null;
    this.target = null;
    this._installed = false;
  }

  /**
   * Send a message to the SPA running in the iframe.
   */
  async sendToSPA(message: object): Promise<void> {
    if (!this._installed || !this.target || !this.webappId) {
      throw new Error('Bridge not installed');
    }

    const runtimeModel = this.target.model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error('RuntimeModel not available');
    }

    const messageJson = JSON.stringify({__sandbox: true, message});
    const expression = `
      (() => {
        const iframe = document.querySelector('iframe[data-webapp-id="${this.webappId}"]');
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(${messageJson}, '*');
          return true;
        }
        return false;
      })()
    `;

    const result = await runtimeModel.agent.invoke_evaluate({expression});
    if (result.getError()) {
      throw new Error(`Failed to send message: ${result.getError()}`);
    }
  }

  /**
   * Register a handler for messages from the SPA.
   */
  onMessage(handler: (msg: SandboxAppAction) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Request and receive the current state from the SPA.
   * Fix #3: Uses request IDs to handle concurrent calls properly.
   */
  async getState(): Promise<Record<string, unknown>> {
    if (!this._installed) {
      return {};
    }

    const requestId = ++this.stateRequestId;

    return new Promise((resolve, reject) => {
      // Set timeout for state request
      const timeout = window.setTimeout(() => {
        this.stateRequestCallbacks.delete(requestId);
        reject(new Error('State request timed out'));
      }, 5000);

      this.stateRequestCallbacks.set(requestId, {resolve, reject, timeout});

      // Send get-state request with requestId
      this.sendToSPA({type: 'get-state', requestId}).catch((error) => {
        const callback = this.stateRequestCallbacks.get(requestId);
        if (callback) {
          clearTimeout(callback.timeout);
          this.stateRequestCallbacks.delete(requestId);
        }
        reject(error);
      });
    });
  }

  /**
   * Get the CDP binding name for this app.
   */
  private getBindingName(): string {
    return `__sandboxAppBridge_${this.appId}`;
  }
}

/**
 * Factory function to create a bridge for an app instance.
 */
export function createSandboxAppBridge(appId: string): SandboxAppBridge {
  return new SandboxAppBridgeImpl(appId);
}
