// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import {createLogger} from '../core/Logger.js';
import {SandboxAppRegistry} from '../sandbox_apps/SandboxAppRegistry.js';
import {SandboxController} from '../sandbox_apps/controller/SandboxController.js';
import {DataStudioExecutor} from '../sandbox_apps/execution/DataStudioExecutor.js';
import {SandboxAppsLauncherSPA} from './SandboxAppsLauncherSPA.js';

const logger = createLogger('SandboxAppsLauncherView');

const BINDING_NAME = '__sandboxAppsLauncherBridge';

interface LauncherAction {
  type: 'ready' | 'close' | 'launch-app';
  appId?: string;
}

interface AppInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  isRunning: boolean;
}

/**
 * SandboxAppsLauncherView - Full-screen app launcher for sandbox apps
 *
 * Displays all registered sandbox apps as clickable cards.
 * Clicking a card closes the launcher and launches the selected sandbox app.
 */
export class SandboxAppsLauncherView {
  private webappId: string | null = null;
  private target: SDK.Target.Target | null = null;
  private bindingHandler: ((event: {data: {name: string; payload: string}}) => void) | null = null;
  private closeCallback: (() => void) | null = null;

  /**
   * Show the launcher in the main browser window
   */
  async show(): Promise<void> {
    if (this.webappId) {
      logger.info('Launcher already open');
      return;
    }

    try {
      // Import RenderWebAppTool dynamically
      const {RenderWebAppTool} = await import('../tools/RenderWebAppTool.js');

      // Render SPA in inspected page
      const tool = new RenderWebAppTool();
      const result = await tool.execute({
        html: SandboxAppsLauncherSPA.html,
        css: SandboxAppsLauncherSPA.css,
        js: SandboxAppsLauncherSPA.js,
        reasoning: 'Display Sandbox Apps Launcher',
      });

      if ('error' in result) {
        throw new Error(result.error);
      }

      this.webappId = result.webappId;

      // Set up bridge for communication
      await this.installBridge();

      logger.info('Sandbox Apps Launcher opened', {webappId: this.webappId});
    } catch (error) {
      logger.error('Failed to open Sandbox Apps Launcher:', error);
      throw error;
    }
  }

  /**
   * Hide the launcher
   */
  async hide(): Promise<void> {
    // Uninstall bridge
    await this.uninstallBridge();

    // Remove webapp
    if (this.webappId) {
      try {
        const {RemoveWebAppTool} = await import('../tools/RemoveWebAppTool.js');
        const tool = new RemoveWebAppTool();
        await tool.execute({
          webappId: this.webappId,
          reasoning: 'Closing Sandbox Apps Launcher',
        });
      } catch (error) {
        logger.error('Failed to remove webapp:', error);
      }

      this.webappId = null;
    }

    logger.info('Sandbox Apps Launcher closed');

    if (this.closeCallback) {
      this.closeCallback();
    }
  }

  /**
   * Set callback for when launcher is closed
   */
  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  /**
   * Check if launcher is visible
   */
  isVisible(): boolean {
    return this.webappId !== null;
  }

  /**
   * Install the bridge for SPA → DevTools communication
   */
  private async installBridge(): Promise<void> {
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

    // Add the binding - this creates window.__sandboxAppsLauncherBridge() in the page
    await this.target.runtimeAgent().invoke_addBinding({
      name: BINDING_NAME,
    });

    logger.info('Bridge installed');
  }

  /**
   * Uninstall the bridge
   */
  private async uninstallBridge(): Promise<void> {
    if (!this.target) {
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
        name: BINDING_NAME,
      });
    } catch (error) {
      logger.error('Failed to remove binding:', error);
    }

    this.bindingHandler = null;
    this.target = null;

    logger.info('Bridge uninstalled');
  }

  /**
   * Handle binding calls from the SPA
   */
  private handleBindingCalled(event: {data: {name: string; payload: string}}): void {
    if (event.data.name !== BINDING_NAME) {
      return;
    }

    try {
      const action: LauncherAction = JSON.parse(event.data.payload);
      logger.info('Received action from SPA:', action);

      void this.handleAction(action);
    } catch (error) {
      logger.error('Failed to parse binding payload:', error);
    }
  }

  /**
   * Handle actions from the SPA
   */
  private async handleAction(action: LauncherAction): Promise<void> {
    switch (action.type) {
      case 'ready':
        // Send app list to SPA
        await this.sendAppList();
        break;

      case 'close':
        await this.hide();
        break;

      case 'launch-app':
        if (action.appId) {
          await this.launchApp(action.appId);
        }
        break;

      default:
        logger.warn('Unknown action:', action);
    }
  }

  /**
   * Send the list of apps to the SPA
   */
  private async sendAppList(): Promise<void> {
    const controller = SandboxController.getInstance();
    const allApps = SandboxAppRegistry.getAllApps();

    const apps: AppInfo[] = allApps.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description,
      icon: app.icon,
      isRunning: controller.getApp(app.id)?.isRunning ?? false,
    }));

    await this.sendToSPA({
      action: 'set-apps',
      apps,
    });
  }

  /**
   * Launch a sandbox app
   */
  private async launchApp(appId: string): Promise<void> {
    logger.info('Launching sandbox app:', appId);

    // Get app from registry
    const app = SandboxAppRegistry.getApp(appId);
    if (!app) {
      logger.error('App not found in registry:', appId);
      return;
    }

    // Close launcher first
    await this.hide();

    try {
      const controller = SandboxController.getInstance();

      // Check if app already exists
      let existingApp = controller.getApp(appId);

      if (existingApp) {
        // If already running, the app is already in the inspected page
        // Just ensure executor is registered and return (launcher is already hidden)
        if (existingApp.isRunning) {
          logger.info('App already running, bringing to front:', appId);
          // Register with executor (Data Studio specific)
          if (appId === 'data-studio-v2') {
            const executor = DataStudioExecutor.getInstance();
            executor.registerApp(appId);
          }
          return;
        }
        // If not running but exists, run it
        await controller.runApp(appId);
      } else {
        // Create and run the app
        await controller.createApp(appId, app.name, app.templateName);
        await controller.runApp(appId);
      }

      // Register with executor (Data Studio specific)
      if (appId === 'data-studio-v2') {
        const executor = DataStudioExecutor.getInstance();
        executor.registerApp(appId);
      }

      logger.info('Sandbox app launched successfully:', appId);
    } catch (error) {
      logger.error('Failed to launch sandbox app:', error);
    }
  }

  /**
   * Send a message to the SPA
   */
  private async sendToSPA(message: object): Promise<void> {
    if (!this.target || !this.webappId) {
      logger.error('Bridge not ready, cannot send to SPA');
      return;
    }

    try {
      const runtimeAgent = this.target.runtimeAgent();

      // Call window.miniApp.dispatch() in the iframe context
      await runtimeAgent.invoke_evaluate({
        expression: `
          (() => {
            const iframe = document.getElementById(${JSON.stringify(this.webappId)});
            if (!iframe || !iframe.contentWindow) {
              console.error('Sandbox Apps Launcher iframe not found');
              return false;
            }
            if (typeof iframe.contentWindow.miniApp?.dispatch === 'function') {
              iframe.contentWindow.miniApp.dispatch(${JSON.stringify(message)});
              return true;
            }
            console.error('miniApp.dispatch not found');
            return false;
          })()
        `,
        returnByValue: true,
      });
    } catch (error) {
      logger.error('Failed to send to SPA:', error);
    }
  }
}
