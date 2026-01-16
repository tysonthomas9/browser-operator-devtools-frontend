// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {DevToolsPage} from './frontend-helper.js';

/**
 * Creates a sandbox app in the DevTools context via VFS
 * @param appId - Unique identifier for the app
 * @param template - 'blank', 'default', or 'data-studio'
 * @param devToolsPage - DevTools page instance
 * @returns The created app's VFS state
 */
export async function createSandboxApp(
    appId: string,
    template: 'blank' | 'default' | 'data-studio' = 'default',
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async (appId, template) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      const result = vfs.createApp(appId, template);
      return {
        success: true,
        appId: result.appId,
        entry: result.entry,
        fileCount: Object.keys(result.files).length,
        filePaths: Object.keys(result.files),
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, appId, template);
}

/**
 * Gets the files for a sandbox app
 * @param appId - The app identifier
 * @param devToolsPage - DevTools page instance
 */
export async function getSandboxAppFiles(
    appId: string,
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async (appId) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      return vfs.getFiles(appId);
    } catch (error) {
      return null;
    }
  }, appId);
}

/**
 * Reads a specific file from a sandbox app
 * @param appId - The app identifier
 * @param filePath - Path to the file within the app
 * @param devToolsPage - DevTools page instance
 */
export async function readSandboxFile(
    appId: string,
    filePath: string,
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async (appId, filePath) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      return vfs.readFile(appId, filePath);
    } catch (error) {
      return null;
    }
  }, appId, filePath);
}

/**
 * Deletes a sandbox app
 * @param appId - The app identifier
 * @param devToolsPage - DevTools page instance
 */
export async function deleteSandboxApp(
    appId: string,
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async (appId) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      return vfs.deleteApp(appId);
    } catch (error) {
      return false;
    }
  }, appId);
}

/**
 * Resets the VFS manager (clears all apps)
 * @param devToolsPage - DevTools page instance
 */
export async function resetVFS(
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async () => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      vfs.reset();
      return true;
    } catch (error) {
      return false;
    }
  });
}

/**
 * Gets the Data Studio template source files directly
 * @param devToolsPage - DevTools page instance
 */
export async function getDataStudioSources(
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async () => {
    try {
      // @ts-expect-error DevTools context
      const sourcesModule = await import('/front_end/panels/ai_chat/sandbox_apps/apps/data-studio/sources.js');
      return {
        success: true,
        hasIndexSource: !!sourcesModule.INDEX_SOURCE,
        hasAppSource: !!sourcesModule.APP_SOURCE,
        hasStoreSource: !!sourcesModule.STORE_SOURCE,
        hasBridgeSource: !!sourcesModule.BRIDGE_SOURCE,
        hasTypesSource: !!sourcesModule.TYPES_SOURCE,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  });
}

// =============================================================================
// Data Studio v2 Helpers
// =============================================================================

/**
 * Initialize sandbox apps and get the Data Studio executor
 * @param devToolsPage - DevTools page instance
 */
export async function initializeDataStudio(
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async () => {
    try {
      // @ts-expect-error DevTools context
      const initModule = await import('/front_end/panels/ai_chat/sandbox_apps/SandboxAppInitialization.js');
      initModule.initializeSandboxApps();

      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      return {
        success: true,
        executorReady: !!executor,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  });
}

/**
 * Create a Data Studio table via the executor
 * @param devToolsPage - DevTools page instance
 * @param tableName - Name of the table
 * @param entityType - Type of entities (e.g., "Company")
 * @param entityNameLabel - Label for entity name column
 */
export async function createDataStudioTable(
    devToolsPage: DevToolsPage,
    tableName: string,
    entityType: string,
    entityNameLabel: string,
) {
  return await devToolsPage.evaluate(async (tableName, entityType, entityNameLabel) => {
    try {
      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      const result = await executor.handleAction({
        action: 'create-table',
        tableName,
        entityType,
        entityNameLabel,
      });

      return {
        success: true,
        tableId: result?.tableId,
        result,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableName, entityType, entityNameLabel);
}

/**
 * Add an entity to a Data Studio table
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table
 * @param name - Entity name
 * @param context - Optional entity context
 */
export async function addDataStudioEntity(
    devToolsPage: DevToolsPage,
    tableId: string,
    name: string,
    context?: string,
) {
  return await devToolsPage.evaluate(async (tableId, name, context) => {
    try {
      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      // Load table first
      await executor.handleAction({action: 'load-table', tableId});

      // Add entity
      const result = await executor.handleAction({
        action: 'add-entity',
        name,
        context: context || '',
      });

      return {
        success: true,
        entityId: result?.entityId,
        result,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId, name, context);
}

/**
 * Add an agent group (referenced) to a Data Studio table
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table
 * @param agentName - Name of the agent to reference
 * @param queryTemplate - Query template with {entity} placeholder
 * @param outputColumns - Array of output column configs
 */
export async function addDataStudioAgentGroup(
    devToolsPage: DevToolsPage,
    tableId: string,
    agentName: string,
    queryTemplate: string,
    outputColumns: Array<{key: string; label: string}>,
) {
  return await devToolsPage.evaluate(async (tableId, agentName, queryTemplate, outputColumns) => {
    try {
      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      // Load table first
      await executor.handleAction({action: 'load-table', tableId});

      // Add agent group
      const result = await executor.handleAction({
        action: 'add-agent-group',
        agentName,
        queryTemplate,
        outputColumns: outputColumns.map((col, i) => ({
          id: `col-${i + 1}`,
          key: col.key,
          label: col.label,
        })),
      });

      return {
        success: true,
        agentGroupId: result?.agentGroupId,
        result,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId, agentName, queryTemplate, outputColumns);
}

/**
 * Add an inline agent group to a Data Studio table
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table
 * @param inlineAgent - Inline agent configuration
 * @param queryTemplate - Query template with {entity} placeholder
 * @param outputColumns - Array of output column configs
 */
export async function addDataStudioInlineAgentGroup(
    devToolsPage: DevToolsPage,
    tableId: string,
    inlineAgent: {
      name: string;
      displayName: string;
      description: string;
      systemPrompt: string;
      tools: string[];
      maxIterations: number;
      temperature: number;
      modelName?: string;
      outputSchema?: object;
      ui?: object;
    },
    queryTemplate: string,
    outputColumns: Array<{key: string; label: string}>,
) {
  return await devToolsPage.evaluate(async (tableId, inlineAgent, queryTemplate, outputColumns) => {
    try {
      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      // Load table first
      await executor.handleAction({action: 'load-table', tableId});

      // Add inline agent group
      const result = await executor.handleAction({
        action: 'add-inline-agent-group',
        inlineAgent,
        queryTemplate,
        outputColumns: outputColumns.map((col, i) => ({
          id: `col-${i + 1}`,
          key: col.key,
          label: col.label,
        })),
      });

      return {
        success: true,
        agentGroupId: result?.agentGroupId,
        result,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId, inlineAgent, queryTemplate, outputColumns);
}

/**
 * Get the current Data Studio table state
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table
 */
export async function getDataStudioTableState(
    devToolsPage: DevToolsPage,
    tableId: string,
) {
  return await devToolsPage.evaluate(async (tableId) => {
    try {
      // @ts-expect-error DevTools context
      const storageModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioStorage.js');
      const storage = storageModule.DataStudioStorage.getInstance();

      const table = await storage.loadTable(tableId);

      if (!table) {
        return {success: false, error: 'Table not found'};
      }

      return {
        success: true,
        table: {
          tableId: table.tableId,
          tableName: table.tableName,
          entityType: table.entityType,
          entityCount: table.entities.length,
          agentGroupCount: table.agentGroups.length,
          executionStatus: table.executionStatus,
          entities: table.entities,
          agentGroups: table.agentGroups.map((ag: {id: string; agentName?: string; inlineAgent?: object; queryTemplate: string; outputColumns: unknown[]}) => ({
            id: ag.id,
            agentName: ag.agentName,
            hasInlineAgent: !!ag.inlineAgent,
            queryTemplate: ag.queryTemplate,
            outputColumnCount: ag.outputColumns.length,
          })),
          resultCount: Object.keys(table.results).length,
        },
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId);
}

/**
 * Run a single cell in Data Studio
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table
 * @param entityId - ID of the entity (row)
 * @param agentGroupId - ID of the agent group (column)
 */
export async function runDataStudioCell(
    devToolsPage: DevToolsPage,
    tableId: string,
    entityId: string,
    agentGroupId: string,
) {
  return await devToolsPage.evaluate(async (tableId, entityId, agentGroupId) => {
    try {
      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      // Load table first
      await executor.handleAction({action: 'load-table', tableId});

      // Run agent for entity
      const result = await executor.handleAction({
        action: 'run-agent-group',
        entityId,
        agentGroupId,
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId, entityId, agentGroupId);
}

/**
 * Save a Data Studio table
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table to save
 */
export async function saveDataStudioTable(
    devToolsPage: DevToolsPage,
    tableId: string,
) {
  return await devToolsPage.evaluate(async (tableId) => {
    try {
      // @ts-expect-error DevTools context
      const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
      const executor = executorModule.DataStudioExecutor.getInstance();

      // Load table first
      await executor.handleAction({action: 'load-table', tableId});

      // Save table
      const result = await executor.handleAction({action: 'save-table'});

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId);
}

/**
 * Delete a Data Studio table
 * @param devToolsPage - DevTools page instance
 * @param tableId - ID of the table to delete
 */
export async function deleteDataStudioTable(
    devToolsPage: DevToolsPage,
    tableId: string,
) {
  return await devToolsPage.evaluate(async (tableId) => {
    try {
      // @ts-expect-error DevTools context
      const storageModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioStorage.js');
      const storage = storageModule.DataStudioStorage.getInstance();

      await storage.deleteTable(tableId);

      return {success: true};
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, tableId);
}

/**
 * Clear all Data Studio tables (for test cleanup)
 * @param devToolsPage - DevTools page instance
 */
export async function clearAllDataStudioTables(
    devToolsPage: DevToolsPage,
) {
  return await devToolsPage.evaluate(async () => {
    try {
      // @ts-expect-error DevTools context
      const storageModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioStorage.js');
      const storage = storageModule.DataStudioStorage.getInstance();

      await storage.clearAll();

      return {success: true};
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  });
}
