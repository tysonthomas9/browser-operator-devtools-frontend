// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {createLogger} from '../core/Logger.js';
import type {
  SandboxApp as SandboxAppDefinition,
  SandboxAppInstance,
  SandboxAppController,
} from './types/SandboxAppTypes.js';
import {createSandboxAppBridge} from './bridge/SandboxAppBridge.js';
import {SandboxController} from './controller/SandboxController.js';

const logger = createLogger('SandboxAppRegistry');

/**
 * Metadata for a sandbox app (legacy interface for launcher)
 */
export interface SandboxApp {
  /** Unique identifier for this app */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Description for users */
  description: string;

  /** Icon (emoji or icon class) */
  icon: string;

  /** VFS template to use when creating this app */
  templateName: 'blank' | 'default' | 'data-studio';
}

/**
 * Registry for sandbox apps
 *
 * Two-level architecture:
 * 1. App Definitions: Templates defining app types (Data Studio, Form Builder, etc.)
 * 2. App Instances: User-created instances of app types with their own state
 *
 * Legacy support:
 * - `register()` / `getApp()` / `getAllApps()` - launcher metadata
 *
 * New abstraction layer:
 * - `registerAppDefinition()` - register app type with controller factory
 * - `createInstance()` - create new instance with controller + bridge
 * - `getInstanceController()` - get controller for AI tool execution
 */
export class SandboxAppRegistry {
  // Legacy: app metadata for launcher
  private static apps = new Map<string, SandboxApp>();

  // New: app definitions with controller factories
  private static appDefinitions = new Map<string, SandboxAppDefinition>();

  // New: active app instances
  private static instances = new Map<string, SandboxAppInstance>();

  // ==========================================================================
  // Legacy API (for launcher UI)
  // ==========================================================================

  /**
   * Register a sandbox app (legacy)
   */
  static register(app: SandboxApp): void {
    if (this.apps.has(app.id)) {
      logger.warn(`App "${app.id}" already registered, skipping`);
      return;
    }
    this.apps.set(app.id, app);
    logger.info(`Registered sandbox app: ${app.id}`);
  }

  /**
   * Unregister a sandbox app (legacy)
   */
  static unregister(appId: string): void {
    if (this.apps.delete(appId)) {
      logger.info(`Unregistered sandbox app: ${appId}`);
    }
  }

  /**
   * Get a sandbox app by ID (legacy)
   */
  static getApp(appId: string): SandboxApp | undefined {
    return this.apps.get(appId);
  }

  /**
   * Get all registered sandbox apps (legacy)
   */
  static getAllApps(): SandboxApp[] {
    return Array.from(this.apps.values());
  }

  /**
   * Check if an app is registered (legacy)
   */
  static isRegistered(appId: string): boolean {
    return this.apps.has(appId);
  }

  // ==========================================================================
  // New Abstraction Layer API
  // ==========================================================================

  /**
   * Register an app definition (app type with controller factory).
   * Call this at initialization for each app type.
   */
  static registerAppDefinition(appDef: SandboxAppDefinition): void {
    if (this.appDefinitions.has(appDef.id)) {
      logger.warn(`App definition "${appDef.id}" already registered, skipping`);
      return;
    }
    this.appDefinitions.set(appDef.id, appDef);

    // Also register as legacy app for launcher
    this.register({
      id: appDef.id,
      name: appDef.name,
      description: appDef.description,
      icon: appDef.icon,
      templateName: appDef.template,
    });

    logger.info(`Registered app definition: ${appDef.id}`);
  }

  /**
   * Get an app definition by ID.
   */
  static getAppDefinition(appType: string): SandboxAppDefinition | null {
    return this.appDefinitions.get(appType) || null;
  }

  /**
   * Get all registered app definitions.
   */
  static getAllAppDefinitions(): SandboxAppDefinition[] {
    return Array.from(this.appDefinitions.values());
  }

  /**
   * Create a new instance of an app type.
   * Sets up VFS with sources, creates controller, and installs bridge.
   *
   * @param appType - The app definition ID (e.g., 'data-studio')
   * @param instanceId - Unique ID for this instance
   * @param name - User-provided name for the instance
   * @returns The created instance
   */
  static async createInstance(
    appType: string,
    instanceId: string,
    name: string,
  ): Promise<SandboxAppInstance> {
    const appDef = this.getAppDefinition(appType);
    if (!appDef) {
      throw new Error(`Unknown app type: ${appType}`);
    }

    if (this.instances.has(instanceId)) {
      throw new Error(`Instance "${instanceId}" already exists`);
    }

    const sandboxController = SandboxController.getInstance();

    // Create VFS with template
    await sandboxController.createApp(instanceId, name, appDef.template);

    // Write app sources to VFS
    const sources = appDef.getSources();
    for (const [path, content] of Object.entries(sources)) {
      await sandboxController.writeFile(instanceId, path, content, false);
    }

    // Create controller + bridge
    const appController = appDef.createController(instanceId);
    const bridge = createSandboxAppBridge(instanceId);

    const instance: SandboxAppInstance = {
      app: appDef,
      controller: appController,
      bridge,
      instanceId,
      webappId: '',
      launchedAt: new Date(),
      name,
    };

    this.instances.set(instanceId, instance);
    logger.info(`Created instance: ${instanceId} (type: ${appType})`);

    return instance;
  }

  /**
   * Launch an instance (run in iframe and initialize bridge).
   *
   * @param instanceId - The instance to launch
   * @returns The webapp ID
   */
  static async launchInstance(instanceId: string): Promise<string> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance "${instanceId}" not found`);
    }

    const sandboxController = SandboxController.getInstance();

    // Run the app in an iframe
    const webappId = await sandboxController.runApp(instanceId);
    instance.webappId = webappId;

    // Install bridge for bidirectional communication
    await instance.bridge.install(instanceId, webappId);

    // Initialize controller with bridge
    await instance.controller.initialize(instance.bridge);

    logger.info(`Launched instance: ${instanceId} (webappId: ${webappId})`);

    return webappId;
  }

  /**
   * Stop a running instance.
   */
  static async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    // Cleanup controller
    await instance.controller.cleanup();

    // Uninstall bridge
    await instance.bridge.uninstall();

    // Stop the sandbox app
    const sandboxController = SandboxController.getInstance();
    await sandboxController.stopApp(instanceId);

    instance.webappId = '';
    logger.info(`Stopped instance: ${instanceId}`);
  }

  /**
   * Delete an instance and its resources.
   */
  static async deleteInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    // Stop if running
    if (instance.webappId) {
      await this.stopInstance(instanceId);
    }

    // Delete the sandbox app
    const sandboxController = SandboxController.getInstance();
    await sandboxController.deleteApp(instanceId);

    this.instances.delete(instanceId);
    logger.info(`Deleted instance: ${instanceId}`);
  }

  /**
   * Get an instance by ID.
   */
  static getInstance(instanceId: string): SandboxAppInstance | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Get the controller for an instance (for AI tools).
   */
  static getInstanceController(instanceId: string): SandboxAppController | null {
    return this.instances.get(instanceId)?.controller || null;
  }

  /**
   * Get all active instances.
   */
  static getAllInstances(): SandboxAppInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get all instances of a specific app type.
   */
  static getInstancesByType(appType: string): SandboxAppInstance[] {
    return Array.from(this.instances.values())
      .filter(instance => instance.app.id === appType);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clear all registered apps and instances (for testing)
   */
  static clear(): void {
    this.apps.clear();
    this.appDefinitions.clear();
    this.instances.clear();
  }

  /**
   * Reset instances only (for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}
