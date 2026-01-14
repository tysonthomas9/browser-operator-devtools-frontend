// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {createLogger} from '../../../core/Logger.js';
import type {
  SandboxAppController,
  SandboxAppBridge,
  SandboxAppAction,
} from '../../types/SandboxAppTypes.js';
// DataStudioExecutor is dynamically imported to avoid loading the full dependency chain

const logger = createLogger('DataStudioController');

// Type for the executor (imported dynamically)
interface DataStudioExecutorType {
  registerApp(appId: string): void;
  unregisterApp(): void;
}

/**
 * DataStudioController - Per-instance controller for Data Studio
 *
 * Manages business logic for a Data Studio instance:
 * - State synchronization with the SPA
 * - Action execution (from AI tools or SPA)
 * - Coordination with DataStudioExecutor for agent execution
 *
 * The controller bridges between:
 * - AI tools (executeAction) - programmatic control
 * - SPA messages (handleMessage) - user interactions
 * - DataStudioExecutor - actual agent execution logic
 */
export class DataStudioController implements SandboxAppController {
  readonly appId: string;
  private bridge: SandboxAppBridge | null = null;
  private executor: DataStudioExecutorType | null = null;
  private rebuildCallback: (() => Promise<void>) | null = null;

  constructor(instanceId: string) {
    this.appId = instanceId;
  }

  /**
   * Initialize the controller with a bridge.
   * Called after the iframe is created and bridge is installed.
   */
  async initialize(bridge: SandboxAppBridge): Promise<void> {
    this.bridge = bridge;

    // Dynamically import executor to avoid loading the full dependency chain
    const {DataStudioExecutor} = await import('../../execution/DataStudioExecutor.js');
    this.executor = DataStudioExecutor.getInstance();

    // Register with executor for action handling
    this.executor.registerApp(this.appId);

    // Listen for messages from SPA
    bridge.onMessage(this.handleMessage.bind(this));

    logger.info(`Initialized DataStudioController for ${this.appId}`);
  }

  /**
   * Get the current state from the SPA.
   */
  async getState(): Promise<Record<string, unknown>> {
    if (!this.bridge?.installed) {
      return {};
    }
    return this.bridge.getState();
  }

  /**
   * Update the state in the SPA.
   */
  async setState(state: Record<string, unknown>): Promise<void> {
    if (!this.bridge?.installed) {
      return;
    }
    await this.bridge.sendToSPA({
      type: 'set-state',
      payload: state,
    });
  }

  /**
   * Execute an action (from AI tools).
   * Maps action names to internal operations.
   */
  async executeAction(name: string, args: unknown): Promise<unknown> {
    logger.debug(`Executing action: ${name}`, args);

    switch (name) {
      case 'create-table':
        return this.handleCreateTable(args as {
          name: string;
          entityType: string;
          entityNameLabel: string;
        });

      case 'add-entity':
        return this.handleAddEntity(args as {
          name: string;
          context?: string;
        });

      case 'add-entities':
        return this.handleAddEntities(args as {
          entities: Array<{name: string; context?: string}>;
        });

      case 'remove-entity':
        return this.handleRemoveEntity(args as {entityId: string});

      case 'add-agent-group':
        return this.handleAddAgentGroup(args as {
          agentName: string;
          queryTemplate: string;
          outputColumns?: Array<{key: string; label: string}>;
        });

      case 'run-cell':
        return this.handleRunCell(args as {
          entityId: string;
          agentGroupId: string;
        });

      case 'run-row':
        return this.handleRunRow(args as {entityId: string});

      case 'run-all':
        return this.handleRunAll();

      case 'pause-execution':
        return this.handlePauseExecution();

      case 'save-table':
        return this.handleSaveTable();

      case 'load-table':
        return this.handleLoadTable(args as {tableId: string});

      case 'run-agent-group':
        return this.handleRunCell(args as {
          entityId: string;
          agentGroupId: string;
        });

      case 'close':
        return this.handleClose();

      case 'delete-table':
        return this.handleDeleteTable(args as {tableId: string});

      case 'remove-agent-group':
        return this.handleRemoveAgentGroup(args as {agentGroupId: string});

      case 'get-state':
        return this.handleGetState();

      case 'close-table':
        return this.handleCloseTable();

      case 'use-template':
        return this.handleUseTemplate(args as {
          templateId: string;
          tableName: string;
        });

      default:
        throw new Error(`Unknown action: ${name}`);
    }
  }

  /**
   * Handle a message from the SPA.
   * Called by the bridge when the SPA sends an action.
   *
   * Supports two formats:
   * - AI tool format: { type: 'action', payload: { name: 'xxx', args: {...} } }
   * - SPA format: { type: 'action-name', payload: { prop1, prop2 } }
   */
  async handleMessage(action: SandboxAppAction): Promise<void> {
    logger.debug(`Received message from SPA: ${action.type}`, action.payload);

    // Handle meta messages (not actions)
    if (action.type === 'state-changed') {
      logger.debug('State changed in SPA:', action.payload);
      return;
    }

    if (action.type === 'ready') {
      logger.info('Data Studio SPA is ready');
      return;
    }

    // Normalize action format and execute
    let actionName: string;
    let actionArgs: Record<string, unknown>;

    if (action.type === 'action') {
      // AI tool format: { type: 'action', payload: { name: 'xxx', args: {...} } }
      const payload = action.payload as {name?: string; type?: string; args?: Record<string, unknown>};
      actionName = payload.name || payload.type || '';
      actionArgs = payload.args || {};
    } else {
      // SPA format: { type: 'action-name', payload: { prop1, prop2 } }
      actionName = action.type;
      actionArgs = (action.payload || {}) as Record<string, unknown>;
    }

    if (!actionName) {
      logger.warn('Received action with no name:', action);
      return;
    }

    try {
      await this.executeAction(actionName, actionArgs);
    } catch (error) {
      logger.error(`Failed to execute action ${actionName}:`, error);
    }
  }

  /**
   * Forward an action to the executor.
   */
  private async forwardToExecutor(action: SandboxAppAction): Promise<void> {
    // The executor listens for action_received events from SandboxController
    // Send the action through the bridge to trigger that flow
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: action.type,
        args: action.payload || {},
      },
    });
  }

  /**
   * Cleanup resources when the app is closed.
   */
  async cleanup(): Promise<void> {
    if (this.executor) {
      this.executor.unregisterApp();
    }
    this.bridge = null;
    this.executor = null;
    logger.info(`Cleaned up DataStudioController for ${this.appId}`);
  }

  /**
   * Register a callback to be called when the app needs rebuilding.
   */
  onRebuild(callback: () => Promise<void>): void {
    this.rebuildCallback = callback;
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  private async handleCreateTable(args: {
    name: string;
    entityType: string;
    entityNameLabel: string;
  }): Promise<{success: boolean; tableId?: string}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'create-table',
        args: {
          tableName: args.name,
          entityType: args.entityType,
          entityNameLabel: args.entityNameLabel,
        },
      },
    });
    return {success: true};
  }

  private async handleAddEntity(args: {
    name: string;
    context?: string;
  }): Promise<{success: boolean; entityId?: string}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'add-entity',
        args,
      },
    });
    return {success: true};
  }

  private async handleAddEntities(args: {
    entities: Array<{name: string; context?: string}>;
  }): Promise<{success: boolean; count: number}> {
    for (const entity of args.entities) {
      await this.handleAddEntity(entity);
    }
    return {success: true, count: args.entities.length};
  }

  private async handleRemoveEntity(args: {
    entityId: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'remove-entity',
        args,
      },
    });
    return {success: true};
  }

  private async handleAddAgentGroup(args: {
    agentName: string;
    queryTemplate: string;
    outputColumns?: Array<{key: string; label: string}>;
  }): Promise<{success: boolean; agentGroupId?: string}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'add-agent-group',
        args,
      },
    });
    return {success: true};
  }

  private async handleRunCell(args: {
    entityId: string;
    agentGroupId: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'run-agent-group',
        args,
      },
    });
    return {success: true};
  }

  private async handleRunRow(args: {
    entityId: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'run-row',
        args,
      },
    });
    return {success: true};
  }

  private async handleRunAll(): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'run-all',
        args: {},
      },
    });
    return {success: true};
  }

  private async handlePauseExecution(): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'pause-execution',
        args: {},
      },
    });
    return {success: true};
  }

  private async handleSaveTable(): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'save-table',
        args: {},
      },
    });
    return {success: true};
  }

  private async handleLoadTable(args: {
    tableId: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'load-table',
        args,
      },
    });
    return {success: true};
  }

  private async handleClose(): Promise<{success: boolean}> {
    logger.info(`Closing Data Studio app ${this.appId}`);
    await this.cleanup();
    return {success: true};
  }

  private async handleDeleteTable(args: {
    tableId: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'delete-table',
        args,
      },
    });
    return {success: true};
  }

  private async handleRemoveAgentGroup(args: {
    agentGroupId: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'remove-agent-group',
        args,
      },
    });
    return {success: true};
  }

  private async handleGetState(): Promise<Record<string, unknown>> {
    return this.getState();
  }

  private async handleCloseTable(): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'close-table',
        args: {},
      },
    });
    return {success: true};
  }

  private async handleUseTemplate(args: {
    templateId: string;
    tableName: string;
  }): Promise<{success: boolean}> {
    await this.bridge?.sendToSPA({
      type: 'execute',
      payload: {
        action: 'use-template',
        args,
      },
    });
    return {success: true};
  }
}
