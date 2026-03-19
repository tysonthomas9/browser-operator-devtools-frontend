// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import type * as Protocol from '../../../generated/protocol.js';
import { createLogger } from '../core/Logger.js';
import type {
  MiniAppBridge,
  MiniAppState,
  SPAToDevToolsAction,
  DevToolsToSPAAction,
} from './types/MiniAppTypes.js';

const logger = createLogger('GenericMiniAppBridge');

/**
 * Callback type for handling SPA actions
 */
export type ActionHandler = (action: SPAToDevToolsAction) => void | Promise<void>;

/**
 * GenericMiniAppBridge - CDP-based bidirectional communication for mini apps
 *
 * Uses unique binding names per app type to avoid conflicts:
 * - Binding: __miniAppBridge_{appId}
 *
 * Communication:
 * - SPA → DevTools: Runtime.addBinding (instant, event-driven)
 * - DevTools → SPA: Runtime.evaluate calling window.miniApp.dispatch()
 */
export class GenericMiniAppBridge implements MiniAppBridge {
  private readonly appId: string;
  private readonly bindingName: string;

  private target: SDK.Target.Target | null = null;
  private _webappId: string | null = null;
  private bindingHandler: ((event: { data: Protocol.Runtime.BindingCalledEvent }) => void) | null = null;
  private actionHandler: ActionHandler | null = null;
  private _installed = false;

  constructor(appId: string) {
    this.appId = appId;
    this.bindingName = `__miniAppBridge_${appId}`;
  }

  /**
   * Register a handler for actions from the SPA
   */
  onAction(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  /**
   * Install the bridge - sets up Runtime.addBinding for SPA→DevTools communication
   */
  async install(webappId: string): Promise<void> {
    if (this._installed) {
      logger.warn(`Bridge for "${this.appId}" already installed`);
      return;
    }

    this._webappId = webappId;
    this.target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();

    if (!this.target) {
      throw new Error('No primary page target available');
    }

    const runtimeModel = this.target.model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel) {
      throw new Error('RuntimeModel not available');
    }

    // Create handler for binding calls
    this.bindingHandler = this.handleBindingCalled.bind(this);
    runtimeModel.addEventListener(SDK.RuntimeModel.Events.BindingCalled, this.bindingHandler);

    // Add the binding - this creates window.__miniAppBridge_{appId}() in the page
    await this.target.runtimeAgent().invoke_addBinding({
      name: this.bindingName,
    });

    this._installed = true;
    logger.info(`Bridge installed for "${this.appId}"`, { webappId, bindingName: this.bindingName });
  }

  /**
   * Uninstall the bridge - removes binding and event listeners
   */
  async uninstall(): Promise<void> {
    if (!this._installed || !this.target) {
      return;
    }

    const runtimeModel = this.target.model(SDK.RuntimeModel.RuntimeModel);

    // Remove event listener
    if (runtimeModel && this.bindingHandler) {
      runtimeModel.removeEventListener(SDK.RuntimeModel.Events.BindingCalled, this.bindingHandler);
    }

    // Remove the binding
    try {
      await this.target.runtimeAgent().invoke_removeBinding({
        name: this.bindingName,
      });
    } catch (error) {
      logger.error(`Failed to remove binding for "${this.appId}":`, error);
    }

    this.bindingHandler = null;
    this.target = null;
    this._webappId = null;
    this._installed = false;

    logger.info(`Bridge uninstalled for "${this.appId}"`);
  }

  /**
   * Send an action to the SPA with retry logic
   *
   * The iframe may not be immediately available in the DOM after rendering,
   * so we retry with exponential backoff if it's not found.
   */
  async sendToSPA(action: DevToolsToSPAAction, maxRetries: number = 5): Promise<void> {
    if (!this.target || !this._webappId) {
      logger.error(`Bridge for "${this.appId}" not installed, cannot send to SPA`);
      return;
    }

    const runtimeAgent = this.target.runtimeAgent();
    let lastError: string | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Call window.miniApp.dispatch() in the iframe context
        const result = await runtimeAgent.invoke_evaluate({
          expression: `
            (() => {
              const iframe = document.getElementById(${JSON.stringify(this._webappId)});
              if (!iframe || !iframe.contentWindow) {
                return { success: false, error: 'iframe_not_found' };
              }
              if (typeof iframe.contentWindow.miniApp?.dispatch === 'function') {
                iframe.contentWindow.miniApp.dispatch(${JSON.stringify(action)});
                return { success: true };
              }
              return { success: false, error: 'dispatch_not_found' };
            })()
          `,
          returnByValue: true,
        });

        const value = result.result?.value as { success: boolean; error?: string } | undefined;

        if (value?.success) {
          if (attempt > 0) {
            logger.info(`Successfully sent to SPA for "${this.appId}" on attempt ${attempt + 1}`);
          }
          return;
        }

        lastError = value?.error || 'unknown';

        // If iframe not found, retry with backoff
        if (lastError === 'iframe_not_found') {
          const delay = Math.min(100 * Math.pow(2, attempt), 2000); // 100, 200, 400, 800, 1600ms
          logger.info(`Iframe not found for "${this.appId}", retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If dispatch not found, the SPA JS hasn't initialized yet - retry
        if (lastError === 'dispatch_not_found') {
          const delay = Math.min(100 * Math.pow(2, attempt), 2000);
          logger.info(`miniApp.dispatch not found for "${this.appId}", retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

      } catch (error) {
        logger.error(`Failed to send to SPA for "${this.appId}" (attempt ${attempt + 1}):`, error);
        lastError = String(error);
      }
    }

    // All retries exhausted
    logger.error(`Failed to send to SPA for "${this.appId}" after ${maxRetries} attempts. Last error: ${lastError}`);
  }

  /**
   * Get the current state from the SPA with retry logic
   */
  async getState(maxRetries: number = 3): Promise<MiniAppState> {
    if (!this.target || !this._webappId) {
      logger.error(`Bridge for "${this.appId}" not installed, cannot get state`);
      return {};
    }

    const runtimeAgent = this.target.runtimeAgent();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await runtimeAgent.invoke_evaluate({
          expression: `
            (() => {
              const iframe = document.getElementById(${JSON.stringify(this._webappId)});
              if (!iframe || !iframe.contentWindow) {
                return { __error: 'iframe_not_found' };
              }
              if (typeof iframe.contentWindow.miniApp?.getState === 'function') {
                return { __state: iframe.contentWindow.miniApp.getState() };
              }
              return { __error: 'getState_not_found' };
            })()
          `,
          returnByValue: true,
        });

        if (result.exceptionDetails) {
          logger.error(`Exception getting state for "${this.appId}":`, result.exceptionDetails.text);
          return {};
        }

        const value = result.result?.value as { __state?: MiniAppState; __error?: string } | undefined;

        if (value?.__state !== undefined) {
          return value.__state;
        }

        // Retry on iframe not found
        if (value?.__error === 'iframe_not_found' || value?.__error === 'getState_not_found') {
          const delay = Math.min(100 * Math.pow(2, attempt), 1000);
          logger.info(`${value.__error} for "${this.appId}", retrying getState in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return {};
      } catch (error) {
        logger.error(`Failed to get state for "${this.appId}" (attempt ${attempt + 1}):`, error);
      }
    }

    logger.error(`Failed to get state for "${this.appId}" after ${maxRetries} attempts`);
    return {};
  }

  /**
   * Handle binding calls from the SPA
   */
  private handleBindingCalled(event: { data: Protocol.Runtime.BindingCalledEvent }): void {
    const { data } = event;

    // Log ALL binding calls for debugging
    logger.info(`>>> GenericMiniAppBridge received binding call: "${data.name}" (expected: "${this.bindingName}")`);

    // Only handle our binding
    if (data.name !== this.bindingName) {
      return;
    }

    try {
      const action = JSON.parse(data.payload) as SPAToDevToolsAction;
      logger.info(`>>> GenericMiniAppBridge handling action for "${this.appId}":`, action.type);

      if (this.actionHandler) {
        // Handle async actions
        const result = this.actionHandler(action);
        if (result instanceof Promise) {
          result.catch(error => {
            logger.error(`Error handling action for "${this.appId}":`, error);
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to parse SPA action for "${this.appId}":`, error);
    }
  }

  /**
   * Check if bridge is installed
   */
  get installed(): boolean {
    return this._installed;
  }

  /**
   * Get the webapp ID
   */
  get webappId(): string | null {
    return this._webappId;
  }
}
