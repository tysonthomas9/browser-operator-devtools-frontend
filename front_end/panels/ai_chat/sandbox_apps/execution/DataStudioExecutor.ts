// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * DataStudioExecutor - DevTools adapter for Data Studio
 *
 * Provides DevTools-specific context for DataStudioCore:
 * - IndexedDB storage via DataStudioStorage
 * - Communication via SandboxProtocol (unified message format)
 * - Agent execution via ToolRegistry
 * - LLM configuration via LLMConfigurationManager
 * - UI lifecycle management (close/rerender)
 */

import {createLogger} from '../../core/Logger.js';
import {SandboxController} from '../controller/SandboxController.js';
import {getSandboxProtocol} from '../protocol/SandboxProtocol.js';
import {AgentStudioIntegration} from '../../core/AgentStudioIntegration.js';
import {LLMConfigurationManager} from '../../core/LLMConfigurationManager.js';
import {LLMProviderRegistry} from '../../LLM/LLMProviderRegistry.js';
import {ToolRegistry} from '../../agent_framework/ConfigurableAgentTool.js';
import {AgentService} from '../../core/AgentService.js';
import {AgentStorageManager} from '../../core/AgentStorageManager.js';
import {DataStudioStorage} from './DataStudioStorage.js';
import type {SandboxEvent} from '../types/SandboxTypes.js';
import * as SDK from '../../../../core/sdk/sdk.js';

import {
  DataStudioCore,
  type DataStudioContext,
  type DataTable,
  type TableIndexEntry,
  type StateUpdateMessage,
  type CellUpdateMessage,
  type LLMContext,
  type InlineAgentConfig,
  type AvailableAgent,
  type Template,
  DEFAULT_TEMPLATES,
  type LLMProviderType,
} from './DataStudioCore.js';

const logger = createLogger('DataStudioExecutor');

/**
 * DevTools context implementation for DataStudioCore
 */
class DevToolsContext implements DataStudioContext {
  private storage: DataStudioStorage;

  constructor(
    private readonly appId: string,
    private readonly controller: SandboxController,
  ) {
    this.storage = DataStudioStorage.getInstance();
  }

  // Storage operations (IndexedDB via DataStudioStorage)
  async getTable(tableId: string): Promise<DataTable | null> {
    const table = await this.storage.loadTable(tableId);
    if (!table) return null;

    // Convert storage format to Core format
    return {
      tableId: table.tableId,
      tableName: table.tableName,
      entityType: table.entityType,
      entityNameLabel: table.entityNameLabel,
      entities: table.entities,
      agentGroups: table.agentGroups,
      results: table.results,
      executionStatus: table.executionStatus,
      createdAt: table.createdAt,
      modifiedAt: table.updatedAt,
    };
  }

  async saveTable(table: DataTable): Promise<void> {
    // Convert Core format to storage format
    // Note: Storage types are slightly stricter (e.g., LLMProviderType), so we cast
    await this.storage.saveTable({
      tableId: table.tableId,
      tableName: table.tableName,
      entityType: table.entityType,
      entityNameLabel: table.entityNameLabel,
      entities: table.entities,
      agentGroups: table.agentGroups as Parameters<typeof this.storage.saveTable>[0]['agentGroups'],
      results: table.results,
      executionStatus: table.executionStatus,
      createdAt: table.createdAt,
      updatedAt: table.modifiedAt,
    });
  }

  async listTables(): Promise<TableIndexEntry[]> {
    return this.storage.listTables();
  }

  async deleteTable(tableId: string): Promise<void> {
    await this.storage.deleteTable(tableId);
  }

  // Communication (SandboxProtocol with unified message format)
  sendStateUpdate(message: StateUpdateMessage): void {
    // Use unified message format (same as WebSocket)
    getSandboxProtocol().send(this.appId, message);
  }

  sendCellUpdate(message: CellUpdateMessage): void {
    // Use unified message format (same as WebSocket)
    getSandboxProtocol().send(this.appId, message);
  }

  // Agent execution via ToolRegistry
  async executeAgent(
    agentName: string,
    query: string,
    entityName: string,
    llmContext: LLMContext,
  ): Promise<{success: boolean; output?: unknown; error?: string}> {
    try {
      // Clear previous agent conversation so each run starts fresh
      await AgentService.getInstance().newConversation();

      if (AgentStudioIntegration.isBuiltInAgentName(agentName)) {
        // Execute built-in agent directly from registry
        const agentTool = ToolRegistry.getToolInstance(agentName);
        if (!agentTool) {
          return {success: false, error: `Built-in agent '${agentName}' not found`};
        }

        const result = await agentTool.execute(
          {
            objective: query,
            reasoning: `Data Studio analysis for ${entityName}`,
            quantity: 1,
          },
          llmContext,
        );

        return {success: true, output: result};
      } else {
        // Execute custom agent via call_custom_agent
        const callCustomAgentTool = ToolRegistry.getRegisteredTool('call_custom_agent');
        if (!callCustomAgentTool) {
          return {success: false, error: 'call_custom_agent tool not found'};
        }

        const result = await (
          callCustomAgentTool as {execute: (args: unknown, ctx: unknown) => Promise<unknown>}
        ).execute(
          {
            agent_name: agentName,
            args: {query, context: '', output_fields: []},
          },
          llmContext,
        );

        return {success: true, output: result};
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // LLM configuration via LLMConfigurationManager
  getLLMContext(inlineConfig?: InlineAgentConfig): LLMContext {
    const configManager = LLMConfigurationManager.getInstance();

    if (inlineConfig?.provider || inlineConfig?.model) {
      const provider = inlineConfig.provider || configManager.getProvider();
      const model = inlineConfig.model || configManager.getMainModel();
      return {
        apiKey: this.getApiKeyForProvider(provider),
        provider: provider as LLMProviderType,
        model,
        miniModel: model,
        nanoModel: model,
      };
    }

    return {
      apiKey: configManager.getApiKey(),
      provider: configManager.getProvider() as LLMProviderType,
      model: configManager.getMainModel(),
      miniModel: configManager.getMiniModel(),
      nanoModel: configManager.getNanoModel(),
    };
  }

  getApiKeyForProvider(provider: string): string {
    // Cast to LLMProvider - Core uses a broader type but Registry expects specific values
    return LLMProviderRegistry.getProviderApiKey(provider as Parameters<typeof LLMProviderRegistry.getProviderApiKey>[0]);
  }

  // Available agents from Agent Studio
  async getAvailableAgents(): Promise<AvailableAgent[]> {
    try {
      const agentStorage = AgentStorageManager.getInstance();
      const customAgents = await agentStorage.getAllAgents();

      const agents = customAgents.map(agent => ({
        name: agent.name,
        description: agent.description,
      }));

      const builtInAgents = [
        {name: 'search_agent', description: 'Search and research information on the web'},
        {name: 'research_agent', description: 'Deep research and analysis'},
        {name: 'content_writer_agent', description: 'Write and create content'},
        {name: 'action_agent', description: 'Perform actions on web pages'},
      ];

      return [...builtInAgents, ...agents];
    } catch (error) {
      logger.error('Failed to load available agents:', error);
      return [];
    }
  }

  // Templates
  getTemplates(): Template[] {
    return DEFAULT_TEMPLATES;
  }

  // Browser navigation via DevTools SDK
  async navigateToBlank(): Promise<void> {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (target) {
      try {
        await target.pageAgent().invoke_navigate({url: 'about:blank'});
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        logger.error('Failed to navigate to blank page:', error);
      }
    }
  }

  // Logging
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
    switch (level) {
      case 'error':
        logger.error(message, data);
        break;
      case 'warn':
        logger.warn(message, data);
        break;
      case 'debug':
        logger.debug(message, data);
        break;
      case 'info':
      default:
        logger.info(message, data);
    }
  }
}

/**
 * DataStudioExecutor - DevTools adapter for Data Studio
 *
 * Wraps DataStudioCore with DevTools-specific functionality:
 * - App registration with SandboxController
 * - UI lifecycle management (close/rerender)
 * - Action routing from SPA
 */
export class DataStudioExecutor {
  private static instance: DataStudioExecutor | null = null;

  private controller: SandboxController;
  private unsubscribeFn: (() => void) | null = null;

  private dataStudioAppId: string | null = null;
  private containerElement: HTMLElement | null = null;

  private core: DataStudioCore | null = null;
  private context: DevToolsContext | null = null;

  private constructor() {
    this.controller = SandboxController.getInstance();
    logger.info('Initialized DataStudioExecutor');
  }

  static getInstance(): DataStudioExecutor {
    if (!DataStudioExecutor.instance) {
      DataStudioExecutor.instance = new DataStudioExecutor();
    }
    return DataStudioExecutor.instance;
  }

  // ===========================================================================
  // App Registration
  // ===========================================================================

  registerApp(appId: string, container?: HTMLElement): void {
    if (this.dataStudioAppId && this.dataStudioAppId !== appId) {
      this.unregisterApp();
    }

    this.dataStudioAppId = appId;
    this.containerElement = container || null;

    // Create context and core
    this.context = new DevToolsContext(appId, this.controller);
    this.core = new DataStudioCore(this.context);

    // Subscribe to action events
    this.unsubscribeFn = this.controller.on('action_received', (event: SandboxEvent) => {
      if (event.appId === this.dataStudioAppId) {
        this.handleAction(event).catch(error => {
          logger.error('Error handling action:', error);
        });
      }
    });

    logger.info(`Registered for Data Studio app: ${appId}`);
  }

  unregisterApp(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.dataStudioAppId = null;
    this.containerElement = null;
    this.core = null;
    this.context = null;
    logger.info('Unregistered from Data Studio app');
  }

  // ===========================================================================
  // Action Handler
  // ===========================================================================

  private async handleAction(event: SandboxEvent): Promise<void> {
    if (!this.core) return;

    const data = event.data as {
      type?: string;
      action?: string;
      currentTable?: DataTable;
      [key: string]: unknown;
    };
    const actionType = (data.type || data.action) as string;

    logger.debug(`Handling action: ${actionType}`, data);

    // Update table from payload if provided (SPA sends current table with run actions)
    if (data.currentTable) {
      const table = this.normalizeTableFromSPA(data.currentTable);
      this.core.setCurrentTable(table);
    }

    switch (actionType) {
      case 'run-agent-group':
        await this.handleRunAgentGroup(data.entityId as string, data.agentGroupId as string);
        break;

      case 'run-row':
        await this.handleRunRow(data.entityId as string);
        break;

      case 'run-all':
        await this.handleRunAll();
        break;

      case 'pause-execution':
        this.core.pauseExecution();
        break;

      case 'save-table':
        await this.core.saveTable();
        break;

      case 'load-table':
        await this.core.loadTable(data.tableId as string);
        break;

      case 'delete-table':
        await this.core.deleteTable(data.tableId as string);
        break;

      case 'get-state':
      case 'ready':
        await this.core.sendInitState();
        break;

      case 'create-table':
        await this.core.createTable({
          tableName: data.tableName as string,
          entityType: data.entityType as string,
          entityNameLabel: data.entityNameLabel as string,
        });
        break;

      case 'add-entity':
        await this.core.addEntity({name: data.name as string, context: data.context as string});
        break;

      case 'remove-entity':
        await this.core.removeEntity(data.entityId as string);
        break;

      case 'add-agent-group':
        await this.core.addAgentGroup({
          agentName: data.agentName as string | undefined,
          inlineAgent: data.inlineAgent as InlineAgentConfig | undefined,
          queryTemplate: data.queryTemplate as string,
          outputColumns: data.outputColumns as any,
        });
        break;

      case 'remove-agent-group':
        await this.core.removeAgentGroup(data.agentGroupId as string);
        break;

      case 'close-table':
        this.core.setCurrentTable(null);
        break;

      case 'use-template':
        await this.core.useTemplate({
          templateId: data.templateId as string,
          tableName: data.tableName as string,
        });
        break;

      case 'go-back':
        this.core.goBack();
        break;

      default:
        logger.debug(`Unhandled action type: ${actionType}`);
    }
  }

  // ===========================================================================
  // Execution with UI Lifecycle
  // ===========================================================================

  private async handleRunAgentGroup(entityId: string, agentGroupId: string): Promise<void> {
    if (!this.core) return;
    await this.core.runAgentGroup(entityId, agentGroupId);
  }

  private async handleRunRow(entityId: string): Promise<void> {
    if (!this.core) return;

    // Close UI before execution
    await this.closeDataStudioUI();

    try {
      await this.core.runRow(entityId);
    } finally {
      // Re-render UI after execution
      await this.reRenderDataStudio();
    }
  }

  private async handleRunAll(): Promise<void> {
    if (!this.core) return;

    // Close UI before execution
    await this.closeDataStudioUI();

    try {
      await this.core.runAll();
    } finally {
      // Re-render UI after execution
      await this.reRenderDataStudio();
    }
  }

  // ===========================================================================
  // UI Lifecycle (DevTools-specific)
  // ===========================================================================

  private async closeDataStudioUI(): Promise<void> {
    if (!this.dataStudioAppId) return;

    logger.info('Closing Data Studio UI for agent execution');
    await this.controller.stopApp(this.dataStudioAppId);
  }

  private async reRenderDataStudio(): Promise<void> {
    if (!this.dataStudioAppId || !this.context) return;

    logger.info('Re-rendering Data Studio after agent execution');

    // Navigate to blank page first
    await this.context.navigateToBlank();

    // Re-run the Data Studio app
    try {
      await this.controller.runApp(this.dataStudioAppId, this.containerElement || undefined);
    } catch (error) {
      logger.error('Failed to re-run Data Studio app:', error);
      return;
    }

    // Wait for app to initialize
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Send current state
    if (this.core) {
      await this.sendFullStateWithRetry();
    }
  }

  private async sendFullStateWithRetry(maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.core?.broadcastState();
        logger.info(`Successfully sent full state on attempt ${attempt}`);
        return;
      } catch (error) {
        logger.warn(`Failed to send full state (attempt ${attempt}/${maxRetries})`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }
    logger.error('Failed to send full state after all retries');
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private normalizeTableFromSPA(spaTable: any): DataTable {
    return {
      tableId: spaTable.tableId || spaTable.id,
      tableName: spaTable.tableName || spaTable.name,
      entityType: spaTable.entityType,
      entityNameLabel: spaTable.entityNameLabel,
      entities: spaTable.entities || [],
      agentGroups: spaTable.agentGroups || [],
      results: spaTable.results || {},
      executionStatus: spaTable.executionStatus || 'idle',
      createdAt: spaTable.createdAt || new Date().toISOString(),
      modifiedAt: spaTable.modifiedAt || spaTable.updatedAt || new Date().toISOString(),
    };
  }

  // ===========================================================================
  // Testing / Reset
  // ===========================================================================

  static reset(): void {
    if (DataStudioExecutor.instance) {
      DataStudioExecutor.instance.unregisterApp();
    }
    DataStudioExecutor.instance = null;
  }
}

// Re-export types for backwards compatibility
export type {
  DataTable,
  Entity,
  AgentGroup,
  CellResult,
  InlineAgentConfig,
  OutputColumn,
} from './DataStudioCore.js';
