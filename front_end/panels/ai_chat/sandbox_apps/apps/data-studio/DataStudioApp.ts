// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {
  SandboxApp,
  SandboxAppActionSchema,
  SandboxAppStateSchema,
  SandboxAppController,
} from '../../types/SandboxAppTypes.js';
import type {VirtualFileMap} from '../../types/SandboxTypes.js';
import {getDataStudioFiles} from './sources.js';
import {DataStudioController} from './DataStudioController.js';

/**
 * Data Studio App Definition
 *
 * Data Studio is an app for creating data tables with entities (companies, products, etc.)
 * and running AI agents across each entity to populate columns with insights.
 *
 * Key features:
 * - Create tables from templates or scratch
 * - Add entities with names and context
 * - Add agent groups that run queries for each entity
 * - Execute agents and display results in a table grid
 * - Persist tables to IndexedDB
 */
export class DataStudioApp implements SandboxApp {
  id = 'data-studio';
  name = 'Data Studio';
  description = 'Create data tables with entities and run AI agents on each row';
  icon = '📊';
  template = 'data-studio' as const;

  /**
   * Get the source files for Data Studio.
   * Returns React + Zustand based implementation.
   */
  getSources(): VirtualFileMap {
    return getDataStudioFiles();
  }

  /**
   * Get the actions that Data Studio supports.
   * These are exposed to AI tools for programmatic control.
   */
  getSupportedActions(): SandboxAppActionSchema[] {
    return [
      {
        name: 'create-table',
        description: 'Create a new data table',
        schema: {
          type: 'object',
          properties: {
            name: {type: 'string', description: 'Table name'},
            entityType: {type: 'string', description: 'Type of entities (e.g., Companies, Products)'},
            entityNameLabel: {type: 'string', description: 'Label for entity name column'},
          },
          required: ['name', 'entityType', 'entityNameLabel'],
        },
      },
      {
        name: 'add-entity',
        description: 'Add an entity to the current table',
        schema: {
          type: 'object',
          properties: {
            name: {type: 'string', description: 'Entity name'},
            context: {type: 'string', description: 'Additional context about the entity'},
          },
          required: ['name'],
        },
      },
      {
        name: 'add-entities',
        description: 'Add multiple entities to the current table',
        schema: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              description: 'List of entities to add',
              items: {
                type: 'object',
                properties: {
                  name: {type: 'string'},
                  context: {type: 'string'},
                },
              },
            },
          },
          required: ['entities'],
        },
      },
      {
        name: 'remove-entity',
        description: 'Remove an entity from the current table',
        schema: {
          type: 'object',
          properties: {
            entityId: {type: 'string', description: 'ID of entity to remove'},
          },
          required: ['entityId'],
        },
      },
      {
        name: 'add-agent-group',
        description: 'Add an agent group (column) to the current table',
        schema: {
          type: 'object',
          properties: {
            agentName: {type: 'string', description: 'Name of the agent'},
            queryTemplate: {type: 'string', description: 'Query template with {{entity}} placeholder'},
            outputColumns: {
              type: 'array',
              description: 'Output column definitions',
              items: {
                type: 'object',
                properties: {
                  key: {type: 'string'},
                  label: {type: 'string'},
                },
              },
            },
          },
          required: ['agentName', 'queryTemplate'],
        },
      },
      {
        name: 'run-cell',
        description: 'Run a single cell (entity + agent group)',
        schema: {
          type: 'object',
          properties: {
            entityId: {type: 'string', description: 'Entity ID'},
            agentGroupId: {type: 'string', description: 'Agent group ID'},
          },
          required: ['entityId', 'agentGroupId'],
        },
      },
      {
        name: 'run-row',
        description: 'Run all agents for a specific entity',
        schema: {
          type: 'object',
          properties: {
            entityId: {type: 'string', description: 'Entity ID'},
          },
          required: ['entityId'],
        },
      },
      {
        name: 'run-all',
        description: 'Run all agents for all entities',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pause-execution',
        description: 'Pause the current execution',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'save-table',
        description: 'Save the current table to storage',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'load-table',
        description: 'Load a table from storage',
        schema: {
          type: 'object',
          properties: {
            tableId: {type: 'string', description: 'Table ID to load'},
          },
          required: ['tableId'],
        },
      },
    ];
  }

  /**
   * Get the state schema for Data Studio.
   * Describes the shape of the app's state for AI understanding.
   */
  getStateSchema(): SandboxAppStateSchema {
    return {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          description: 'Current view: "selector" (table list) or "table" (table view)',
        },
        tables: {
          type: 'array',
          description: 'List of saved tables with id and name',
        },
        currentTable: {
          type: 'object',
          description: 'Currently open table with entities, agentGroups, and results',
        },
        isRunning: {
          type: 'boolean',
          description: 'Whether agent execution is in progress',
        },
        executionProgress: {
          type: 'object',
          description: 'Progress of current execution (completed/total)',
        },
      },
    };
  }

  /**
   * Create a controller for a new Data Studio instance.
   */
  createController(instanceId: string): SandboxAppController {
    return new DataStudioController(instanceId);
  }
}

/**
 * Singleton instance for registration.
 */
export const dataStudioApp = new DataStudioApp();
