// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {Tool, ErrorResult} from '../../tools/Tools.js';
import {SandboxAppRegistry} from '../SandboxAppRegistry.js';
import {createLogger} from '../../core/Logger.js';

const logger = createLogger('ExecuteSandboxAppActionTool');

// =============================================================================
// ExecuteSandboxAppActionTool Types
// =============================================================================

export interface ExecuteActionArgs {
  instanceId: string;
  actionName: string;
  args?: Record<string, unknown>;
}

export interface ExecuteActionResult {
  success: true;
  data: unknown;
  message: string;
}

// =============================================================================
// GetSandboxAppStateTool Types
// =============================================================================

export interface GetStateArgs {
  instanceId: string;
}

export interface GetStateResult {
  success: true;
  data: Record<string, unknown>;
}

// =============================================================================
// ListSandboxAppsTool Types
// =============================================================================

export interface ListAppsResult {
  success: true;
  data: {
    appTypes: Array<{
      id: string;
      name: string;
      description: string;
      supportedActions: Array<{
        name: string;
        description: string;
      }>;
    }>;
    runningInstances: Array<{
      instanceId: string;
      appType: string;
      name: string;
      webappId: string;
      launchedAt: string;
    }>;
  };
}

// =============================================================================
// CreateSandboxAppInstanceTool Types
// =============================================================================

export interface CreateInstanceArgs {
  appType: string;
  name: string;
  launch?: boolean;
}

export interface CreateInstanceResult {
  success: true;
  data: {
    instanceId: string;
    appType: string;
    name: string;
    webappId: string;
    launched: boolean;
  };
  message: string;
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * ExecuteSandboxAppActionTool - Execute an action on a running sandbox app
 *
 * This tool allows AI agents to programmatically control sandbox apps by
 * executing actions defined in the app's action schema.
 *
 * Usage examples:
 * - Create a table: { instanceId: "data-studio-1", actionName: "create-table", args: { name: "My Table", ... } }
 * - Add entity: { instanceId: "data-studio-1", actionName: "add-entity", args: { name: "Apple Inc" } }
 * - Run all agents: { instanceId: "data-studio-1", actionName: "run-all" }
 */
export class ExecuteSandboxAppActionTool implements Tool<ExecuteActionArgs, ExecuteActionResult | ErrorResult> {
  name = 'execute_sandbox_app_action';
  description = `Execute an action on a running sandbox app. Use this tool to programmatically control sandbox apps like Data Studio.

Available apps and their actions can be discovered via the app registry.

For Data Studio:
- create-table: Create a new data table with name, entityType, entityNameLabel
- add-entity: Add an entity with name and optional context
- add-entities: Add multiple entities at once
- remove-entity: Remove an entity by entityId
- add-agent-group: Add an agent column with agentName, queryTemplate, outputColumns
- run-cell: Run a single cell with entityId and agentGroupId
- run-row: Run all agents for an entity
- run-all: Run all agents for all entities
- pause-execution: Pause current execution
- save-table: Save the current table
- load-table: Load a table by tableId`;

  schema = {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'The ID of the sandbox app instance to execute the action on',
      },
      actionName: {
        type: 'string',
        description: 'The name of the action to execute',
      },
      args: {
        type: 'object',
        description: 'Arguments for the action (varies by action type)',
      },
    },
    required: ['instanceId', 'actionName'],
  };

  async execute(args: ExecuteActionArgs): Promise<ExecuteActionResult | ErrorResult> {
    const {instanceId, actionName, args: actionArgs} = args;

    logger.info(`Executing action "${actionName}" on instance "${instanceId}"`, actionArgs);

    // Get the controller for this instance
    const controller = SandboxAppRegistry.getInstanceController(instanceId);
    if (!controller) {
      return {
        error: `Sandbox app instance not found: ${instanceId}. Make sure the app is created and running.`,
      };
    }

    try {
      // Execute the action via the controller
      const result = await controller.executeAction(actionName, actionArgs || {});

      return {
        success: true,
        data: result,
        message: `Successfully executed "${actionName}" on ${instanceId}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to execute action "${actionName}":`, error);

      return {
        error: `Failed to execute action "${actionName}": ${errorMessage}`,
      };
    }
  }
}

/**
 * GetSandboxAppStateTool - Get the current state of a sandbox app
 *
 * This tool allows AI agents to inspect the current state of a running sandbox app.
 */
export class GetSandboxAppStateTool implements Tool<GetStateArgs, GetStateResult | ErrorResult> {
  name = 'get_sandbox_app_state';
  description = `Get the current state of a running sandbox app.

Returns the app's state including:
- Current view (selector or table)
- Tables list
- Current table data (entities, agent groups, results)
- Running status`;

  schema = {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'The ID of the sandbox app instance',
      },
    },
    required: ['instanceId'],
  };

  async execute(args: GetStateArgs): Promise<GetStateResult | ErrorResult> {
    const {instanceId} = args;

    logger.info(`Getting state for instance "${instanceId}"`);

    const controller = SandboxAppRegistry.getInstanceController(instanceId);
    if (!controller) {
      return {
        error: `Sandbox app instance not found: ${instanceId}`,
      };
    }

    try {
      const state = await controller.getState();

      return {
        success: true,
        data: state,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get state:`, error);

      return {
        error: `Failed to get app state: ${errorMessage}`,
      };
    }
  }
}

/**
 * ListSandboxAppsTool - List available sandbox app types and instances
 *
 * This tool helps AI agents discover what sandbox apps are available
 * and which instances are currently running.
 */
export class ListSandboxAppsTool implements Tool<Record<string, never>, ListAppsResult | ErrorResult> {
  name = 'list_sandbox_apps';
  description = `List available sandbox app types and running instances.

Returns:
- Available app types (e.g., data-studio)
- Each app's supported actions and state schema
- Currently running instances`;

  schema = {
    type: 'object',
    properties: {},
  };

  async execute(): Promise<ListAppsResult | ErrorResult> {
    try {
      const appDefinitions = SandboxAppRegistry.getAllAppDefinitions();
      const instances = SandboxAppRegistry.getAllInstances();

      return {
        success: true,
        data: {
          appTypes: appDefinitions.map(app => ({
            id: app.id,
            name: app.name,
            description: app.description,
            supportedActions: app.getSupportedActions().map(a => ({
              name: a.name,
              description: a.description,
            })),
          })),
          runningInstances: instances.map(inst => ({
            instanceId: inst.instanceId,
            appType: inst.app.id,
            name: inst.name,
            webappId: inst.webappId,
            launchedAt: inst.launchedAt.toISOString(),
          })),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        error: `Failed to list sandbox apps: ${errorMessage}`,
      };
    }
  }
}

/**
 * CreateSandboxAppInstanceTool - Create a new sandbox app instance
 *
 * Creates a new instance of a sandbox app type (e.g., data-studio).
 */
export class CreateSandboxAppInstanceTool implements Tool<CreateInstanceArgs, CreateInstanceResult | ErrorResult> {
  name = 'create_sandbox_app_instance';
  description = `Create a new instance of a sandbox app.

Creates an app instance and optionally launches it immediately.
The instance will have its own isolated state and can be controlled via execute_sandbox_app_action.`;

  schema = {
    type: 'object',
    properties: {
      appType: {
        type: 'string',
        description: 'The app type to create (e.g., "data-studio")',
      },
      name: {
        type: 'string',
        description: 'A name for this instance',
      },
      launch: {
        type: 'boolean',
        description: 'Whether to launch the app immediately (default: true)',
      },
    },
    required: ['appType', 'name'],
  };

  async execute(args: CreateInstanceArgs): Promise<CreateInstanceResult | ErrorResult> {
    const {appType, name, launch = true} = args;

    logger.info(`Creating sandbox app instance: ${appType} (${name})`);

    try {
      // Generate unique instance ID
      const instanceId = `${appType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Create the instance
      const instance = await SandboxAppRegistry.createInstance(appType, instanceId, name);

      // Optionally launch it
      let webappId = '';
      if (launch) {
        webappId = await SandboxAppRegistry.launchInstance(instanceId);
      }

      return {
        success: true,
        data: {
          instanceId,
          appType: instance.app.id,
          name: instance.name,
          webappId,
          launched: launch,
        },
        message: `Created ${launch ? 'and launched ' : ''}sandbox app: ${name} (${instanceId})`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create sandbox app instance:`, error);

      return {
        error: `Failed to create sandbox app: ${errorMessage}`,
      };
    }
  }
}
