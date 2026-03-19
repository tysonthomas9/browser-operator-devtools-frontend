// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../../core/Logger.js';
import { AgentStorageManager } from '../../../core/AgentStorageManager.js';
import { AgentStudioIntegration } from '../../../core/AgentStudioIntegration.js';
import { LLMConfigurationManager } from '../../../core/LLMConfigurationManager.js';
import { AgentService } from '../../../core/AgentService.js';
import { ToolRegistry } from '../../../agent_framework/ConfigurableAgentTool.js';
import { MiniAppStorageManager } from '../../MiniAppStorageManager.js';
import type {
  MiniApp,
  MiniAppSPA,
  MiniAppController,
  MiniAppBridge,
  MiniAppState,
  MiniAppActionSchema,
  MiniAppStateSchema,
  SPAToDevToolsAction,
} from '../../types/MiniAppTypes.js';
import { DataStudioSPA } from './DataStudioSPA.js';

const logger = createLogger('DataStudioMiniApp');

// ============================================================================
// Data Types
// ============================================================================

interface Entity {
  id: string;
  name: string;
  context?: string;
}

interface OutputColumn {
  id: string;
  key: string;
  label: string;
}

interface AgentGroup {
  id: string;
  agentName: string;
  agentId?: string;
  queryTemplate: string;
  outputColumns: OutputColumn[];
}

interface AgentResult {
  status: 'pending' | 'running' | 'completed' | 'error';
  values?: Record<string, string>;
  error?: string;
  timestamp?: string;
  executionTimeMs?: number;
}

interface DataStudioState {
  tableId: string;
  tableName: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, AgentResult>>;
  executionStatus: 'idle' | 'running' | 'paused';
  currentExecution?: {
    entityId: string;
    agentGroupId: string;
  };
}

interface DataStudioTemplate {
  id: string;
  name: string;
  description: string;
  entityType: string;
  entityNameLabel: string;
  suggestedAgents?: string[];
  exampleEntities?: Array<{ name: string; context?: string }>;
  exampleAgentGroups?: Array<{
    agentName: string;
    queryTemplate: string;
    outputColumns: Array<{ key: string; label: string }>;
  }>;
}

interface TableIndexEntry {
  id: string;
  name: string;
  entityType: string;
}

// ============================================================================
// Templates
// ============================================================================

const TEMPLATES: DataStudioTemplate[] = [
  {
    id: 'competitor_analysis',
    name: 'Competitor Analysis',
    description: 'Analyze competitors in your market',
    entityType: 'Competitor',
    entityNameLabel: 'Company Name',
    exampleEntities: [
      { name: 'OpenAI', context: 'AI research company, creators of ChatGPT' },
      { name: 'Google DeepMind', context: 'AI research lab, creators of Gemini' },
      { name: 'Anthropic', context: 'AI safety company, creators of Claude' },
    ],
    exampleAgentGroups: [
      {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity} and analyze their market position, key strengths, weaknesses, and recent news',
        outputColumns: [
          { key: 'summary', label: 'Summary' },
          { key: 'strengths', label: 'Strengths' },
          { key: 'weaknesses', label: 'Weaknesses' },
        ],
      },
    ],
  },
  {
    id: 'product_research',
    name: 'Product Research',
    description: 'Research and compare products',
    entityType: 'Product',
    entityNameLabel: 'Product Name',
    exampleEntities: [
      { name: 'iPhone 17 Pro', context: 'Apple flagship smartphone' },
      { name: 'Samsung Galaxy S25', context: 'Samsung flagship smartphone' },
      { name: 'Google Pixel 10', context: 'Google flagship smartphone' },
    ],
    exampleAgentGroups: [
      {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity} and list key features, specifications, price, and user reviews',
        outputColumns: [
          { key: 'features', label: 'Key Features' },
          { key: 'price', label: 'Price' },
          { key: 'verdict', label: 'Verdict' },
        ],
      },
    ],
  },
  {
    id: 'lead_qualification',
    name: 'Lead Qualification',
    description: 'Qualify and score sales leads',
    entityType: 'Lead',
    entityNameLabel: 'Company/Contact',
    exampleEntities: [
      { name: 'Acme Corp', context: 'Enterprise software company, 500+ employees' },
      { name: 'StartupXYZ', context: 'Early-stage startup, Series A' },
      { name: 'MegaTech Inc', context: 'Fortune 500 technology company' },
    ],
    exampleAgentGroups: [
      {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity} and provide a lead qualification score based on company size, industry, and potential fit',
        outputColumns: [
          { key: 'score', label: 'Lead Score' },
          { key: 'company_size', label: 'Company Size' },
          { key: 'decision_maker', label: 'Decision Maker' },
        ],
      },
    ],
  },
];

// ============================================================================
// DataStudioMiniApp
// ============================================================================

export class DataStudioMiniApp implements MiniApp {
  id = 'data_studio';
  name = 'Data Studio';
  description = 'Run AI agents against lists of entities in a table format. Create analysis tables for competitors, products, leads, or any custom entity type.';
  icon = '📊';

  // Route definitions for URL-based navigation
  routes = [
    { name: 'selector', pattern: '#data-studio' },
    { name: 'table', pattern: '#data-studio/table/:tableId' },
  ];

  getSPA(): MiniAppSPA {
    return {
      html: DataStudioSPA.html,
      css: DataStudioSPA.css,
      js: DataStudioSPA.js,
    };
  }

  getSupportedActions(): MiniAppActionSchema[] {
    return [
      {
        name: 'create-table',
        description: 'Create a new analysis table with custom entity type',
        schema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Name for the table' },
            entityType: { type: 'string', description: 'Type of entities (e.g., Competitor, Product)' },
            entityNameLabel: { type: 'string', description: 'Label for the entity name column' },
          },
          required: ['tableName', 'entityType', 'entityNameLabel'],
        },
      },
      {
        name: 'use-template',
        description: 'Create a new table from a template',
        schema: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID to use' },
            tableName: { type: 'string', description: 'Name for the new table' },
          },
          required: ['templateId', 'tableName'],
        },
      },
      {
        name: 'add-entity',
        description: 'Add a new entity row to the table',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Entity name' },
            context: { type: 'string', description: 'Optional additional context' },
          },
          required: ['name'],
        },
      },
      {
        name: 'remove-entity',
        description: 'Remove an entity row from the table',
        schema: {
          type: 'object',
          properties: {
            entityId: { type: 'string', description: 'ID of the entity to remove' },
          },
          required: ['entityId'],
        },
      },
      {
        name: 'add-agent-group',
        description: 'Add an agent column group to the table',
        schema: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Name of the custom agent' },
            queryTemplate: { type: 'string', description: 'Query template with {entity} placeholder' },
            outputColumns: {
              type: 'array',
              description: 'Output columns this agent produces',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  label: { type: 'string' },
                },
              },
            },
          },
          required: ['agentName', 'queryTemplate', 'outputColumns'],
        },
      },
      {
        name: 'remove-agent-group',
        description: 'Remove an agent column group from the table',
        schema: {
          type: 'object',
          properties: {
            agentGroupId: { type: 'string', description: 'ID of the agent group to remove' },
          },
          required: ['agentGroupId'],
        },
      },
      {
        name: 'run-agent-group',
        description: 'Run one agent for one entity',
        schema: {
          type: 'object',
          properties: {
            entityId: { type: 'string', description: 'ID of the entity' },
            agentGroupId: { type: 'string', description: 'ID of the agent group' },
          },
          required: ['entityId', 'agentGroupId'],
        },
      },
      {
        name: 'run-row',
        description: 'Run all agents for one entity',
        schema: {
          type: 'object',
          properties: {
            entityId: { type: 'string', description: 'ID of the entity' },
          },
          required: ['entityId'],
        },
      },
      {
        name: 'run-all',
        description: 'Run all agents for all entities (row by row)',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pause-execution',
        description: 'Pause ongoing execution',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clear-results',
        description: 'Clear all results in the table',
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
        description: 'Load a saved table',
        schema: {
          type: 'object',
          properties: {
            tableId: { type: 'string', description: 'ID of the table to load' },
          },
          required: ['tableId'],
        },
      },
      {
        name: 'list-tables',
        description: 'List all saved tables',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list-templates',
        description: 'List available templates',
        schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  getStateSchema(): MiniAppStateSchema {
    return {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          description: 'Current view: "selector" or "table"',
        },
        tables: {
          type: 'array',
          description: 'List of saved tables',
        },
        templates: {
          type: 'array',
          description: 'Available templates',
        },
        currentTable: {
          type: 'object',
          description: 'Currently active table state or null',
        },
        availableAgents: {
          type: 'array',
          description: 'Available custom agents from Agent Studio',
        },
      },
    };
  }

  createController(): MiniAppController {
    return new DataStudioController();
  }
}

// ============================================================================
// DataStudioController
// ============================================================================

class DataStudioController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private closeCallback: (() => void | Promise<void>) | null = null;

  // View state
  private currentView: 'selector' | 'table' = 'selector';
  private currentTable: DataStudioState | null = null;

  // Storage key prefix
  private readonly STORAGE_PREFIX = 'data_studio';
  private readonly TABLES_INDEX_KEY = 'tables_index';

  async initialize(bridge: MiniAppBridge): Promise<void> {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
    logger.info('DataStudioController initialized');
  }

  async cleanup(): Promise<void> {
    this.bridge = null;
    this.currentTable = null;
    this.currentView = 'selector';
    logger.info('DataStudioController cleaned up');
  }

  onClose(callback: () => void | Promise<void>): void {
    this.closeCallback = callback;
  }

  async getState(): Promise<MiniAppState> {
    const tables = await this.listSavedTables();
    const availableAgents = await this.loadAvailableAgents();

    return {
      view: this.currentView,
      tables,
      templates: TEMPLATES,
      currentTable: this.currentTable,
      availableAgents,
    };
  }

  async setState(state: MiniAppState): Promise<void> {
    if (state.view) {
      this.currentView = state.view as 'selector' | 'table';
    }
    if (state.currentTable) {
      this.currentTable = state.currentTable as DataStudioState;
    }
  }

  async updateState(updates: Partial<MiniAppState>): Promise<void> {
    if (updates.view) {
      this.currentView = updates.view as 'selector' | 'table';
    }
    if (updates.currentTable !== undefined) {
      this.currentTable = updates.currentTable as DataStudioState | null;
    }
  }

  async executeAction(actionName: string, args: unknown): Promise<unknown> {
    const argsObj = args as Record<string, unknown>;

    switch (actionName) {
      case 'create-table':
        return this.handleCreateTable(
          argsObj.tableName as string,
          argsObj.entityType as string,
          argsObj.entityNameLabel as string
        );

      case 'use-template':
        return this.handleUseTemplate(
          argsObj.templateId as string,
          argsObj.tableName as string
        );

      case 'add-entity':
        return this.handleAddEntity(
          argsObj.name as string,
          argsObj.context as string | undefined
        );

      case 'remove-entity':
        return this.handleRemoveEntity(argsObj.entityId as string);

      case 'add-agent-group':
        return this.handleAddAgentGroup(
          argsObj.agentName as string,
          argsObj.queryTemplate as string,
          argsObj.outputColumns as OutputColumn[]
        );

      case 'remove-agent-group':
        return this.handleRemoveAgentGroup(argsObj.agentGroupId as string);

      case 'run-agent-group':
        return this.handleRunAgentGroup(
          argsObj.entityId as string,
          argsObj.agentGroupId as string
        );

      case 'run-row':
        return this.handleRunRow(argsObj.entityId as string);

      case 'run-all':
        return this.handleRunAll();

      case 'pause-execution':
        return this.handlePauseExecution();

      case 'clear-results':
        return this.handleClearResults();

      case 'save-table':
        return this.saveCurrentTable();

      case 'load-table':
        return this.handleLoadTable(argsObj.tableId as string);

      case 'list-tables':
        return this.listSavedTables();

      case 'list-templates':
        return { templates: TEMPLATES };

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  // ============================================================================
  // SPA Action Handlers
  // ============================================================================

  private async handleAction(action: SPAToDevToolsAction): Promise<void> {
    logger.info(`>>> DataStudio handleAction RECEIVED: ${action.type}`, action);

    switch (action.type) {
      case 'ready':
        await this.pushStateToSPA();
        break;

      case 'close':
        if (this.closeCallback) {
          await this.closeCallback();
        }
        break;

      case 'create-table': {
        const data = action as SPAToDevToolsAction & {
          tableName: string;
          entityType: string;
          entityNameLabel: string;
        };
        await this.handleCreateTable(data.tableName, data.entityType, data.entityNameLabel);
        await this.pushStateToSPA();
        break;
      }

      case 'use-template': {
        const data = action as SPAToDevToolsAction & {
          templateId: string;
          tableName: string;
        };
        await this.handleUseTemplate(data.templateId, data.tableName);
        await this.pushStateToSPA();
        break;
      }

      case 'load-table': {
        const data = action as SPAToDevToolsAction & { tableId: string };
        await this.handleLoadTable(data.tableId);
        await this.pushStateToSPA();
        break;
      }

      case 'close-table':
        this.currentTable = null;
        this.currentView = 'selector';
        await this.pushStateToSPA();
        break;

      case 'add-entity': {
        const data = action as SPAToDevToolsAction & {
          name: string;
          context?: string;
        };
        await this.handleAddEntity(data.name, data.context);
        await this.pushStateToSPA();
        break;
      }

      case 'remove-entity': {
        const data = action as SPAToDevToolsAction & { entityId: string };
        await this.handleRemoveEntity(data.entityId);
        await this.pushStateToSPA();
        break;
      }

      case 'add-agent-group': {
        const data = action as SPAToDevToolsAction & {
          agentName: string;
          queryTemplate: string;
          outputColumns: OutputColumn[];
        };
        await this.handleAddAgentGroup(data.agentName, data.queryTemplate, data.outputColumns);
        await this.pushStateToSPA();
        break;
      }

      case 'remove-agent-group': {
        const data = action as SPAToDevToolsAction & { agentGroupId: string };
        await this.handleRemoveAgentGroup(data.agentGroupId);
        await this.pushStateToSPA();
        break;
      }

      case 'run-agent-group': {
        const data = action as SPAToDevToolsAction & {
          entityId: string;
          agentGroupId: string;
        };
        await this.handleRunAgentGroup(data.entityId, data.agentGroupId);
        break;
      }

      case 'run-row': {
        const data = action as SPAToDevToolsAction & { entityId: string };
        await this.handleRunRow(data.entityId);
        break;
      }

      case 'run-all':
        await this.handleRunAll();
        break;

      case 'pause-execution':
        await this.handlePauseExecution();
        await this.pushStateToSPA();
        break;

      case 'save-table':
        await this.saveCurrentTable();
        await this.pushStateToSPA();
        break;

      case 'delete-table': {
        const data = action as SPAToDevToolsAction & { tableId: string };
        await this.handleDeleteTable(data.tableId);
        await this.pushStateToSPA();
        break;
      }

      default:
        logger.warn('Unknown action type:', action.type);
    }
  }

  // ============================================================================
  // Table Management
  // ============================================================================

  private async handleCreateTable(
    tableName: string,
    entityType: string,
    entityNameLabel: string
  ): Promise<DataStudioState> {
    const tableId = `table_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.currentTable = {
      tableId,
      tableName,
      entityType,
      entityNameLabel,
      entities: [],
      agentGroups: [],
      results: {},
      executionStatus: 'idle',
    };

    this.currentView = 'table';
    await this.saveCurrentTable();

    return this.currentTable;
  }

  private async handleUseTemplate(
    templateId: string,
    tableName: string
  ): Promise<DataStudioState> {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Create the base table
    await this.handleCreateTable(
      tableName,
      template.entityType,
      template.entityNameLabel
    );

    // Add example entities if provided
    if (template.exampleEntities) {
      for (const entity of template.exampleEntities) {
        await this.handleAddEntity(entity.name, entity.context);
      }
    }

    // Add example agent groups if provided
    if (template.exampleAgentGroups) {
      for (const ag of template.exampleAgentGroups) {
        const outputColumns = ag.outputColumns.map(col => ({
          ...col,
          id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        }));
        await this.handleAddAgentGroup(ag.agentName, ag.queryTemplate, outputColumns);
      }
    }

    await this.saveCurrentTable();
    return this.currentTable!;
  }

  private async handleLoadTable(tableId: string): Promise<DataStudioState> {
    const storage = MiniAppStorageManager.getInstance();
    const tableData = await storage.get(this.STORAGE_PREFIX, `table_${tableId}`);
    if (!tableData) {
      throw new Error(`Table not found: ${tableId}`);
    }

    this.currentTable = tableData as DataStudioState;
    this.currentView = 'table';

    return this.currentTable;
  }

  private async handleDeleteTable(tableId: string): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();

    // Remove from storage
    await storage.delete(this.STORAGE_PREFIX, `table_${tableId}`);

    // Update index
    const index = await this.getTablesIndex();
    const newIndex = index.filter(t => t.id !== tableId);
    await storage.set(this.STORAGE_PREFIX, this.TABLES_INDEX_KEY, newIndex);

    // If this was the current table, go back to selector
    if (this.currentTable?.tableId === tableId) {
      this.currentTable = null;
      this.currentView = 'selector';
    }
  }

  private async saveCurrentTable(): Promise<void> {
    if (!this.currentTable) {
      return;
    }

    const storage = MiniAppStorageManager.getInstance();

    // Save table data
    await storage.set(
      this.STORAGE_PREFIX,
      `table_${this.currentTable.tableId}`,
      this.currentTable
    );

    // Update index
    const index = await this.getTablesIndex();
    const existingIndex = index.findIndex(t => t.id === this.currentTable!.tableId);
    const entry: TableIndexEntry = {
      id: this.currentTable.tableId,
      name: this.currentTable.tableName,
      entityType: this.currentTable.entityType,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = entry;
    } else {
      index.push(entry);
    }

    await storage.set(this.STORAGE_PREFIX, this.TABLES_INDEX_KEY, index);
  }

  private async listSavedTables(): Promise<TableIndexEntry[]> {
    return this.getTablesIndex();
  }

  private async getTablesIndex(): Promise<TableIndexEntry[]> {
    const storage = MiniAppStorageManager.getInstance();
    const index = await storage.get(this.STORAGE_PREFIX, this.TABLES_INDEX_KEY);
    return (index as TableIndexEntry[]) || [];
  }

  // ============================================================================
  // Entity Management
  // ============================================================================

  private async handleAddEntity(name: string, context?: string): Promise<Entity> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    const entity: Entity = {
      id: `entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      context,
    };

    this.currentTable.entities.push(entity);

    // Initialize results for this entity
    this.currentTable.results[entity.id] = {};
    for (const agentGroup of this.currentTable.agentGroups) {
      this.currentTable.results[entity.id][agentGroup.id] = { status: 'pending' };
    }

    await this.saveCurrentTable();
    return entity;
  }

  private async handleRemoveEntity(entityId: string): Promise<void> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    this.currentTable.entities = this.currentTable.entities.filter(e => e.id !== entityId);
    delete this.currentTable.results[entityId];

    await this.saveCurrentTable();
  }

  // ============================================================================
  // Agent Group Management
  // ============================================================================

  private async handleAddAgentGroup(
    agentName: string,
    queryTemplate: string,
    outputColumns: OutputColumn[]
  ): Promise<AgentGroup> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    const agentGroup: AgentGroup = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentName,
      queryTemplate,
      outputColumns: outputColumns.map(col => ({
        ...col,
        id: col.id || `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      })),
    };

    this.currentTable.agentGroups.push(agentGroup);

    // Initialize results for all entities
    for (const entity of this.currentTable.entities) {
      if (!this.currentTable.results[entity.id]) {
        this.currentTable.results[entity.id] = {};
      }
      this.currentTable.results[entity.id][agentGroup.id] = { status: 'pending' };
    }

    await this.saveCurrentTable();
    return agentGroup;
  }

  private async handleRemoveAgentGroup(agentGroupId: string): Promise<void> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    this.currentTable.agentGroups = this.currentTable.agentGroups.filter(
      ag => ag.id !== agentGroupId
    );

    // Remove results for this agent group
    for (const entityId of Object.keys(this.currentTable.results)) {
      delete this.currentTable.results[entityId][agentGroupId];
    }

    await this.saveCurrentTable();
  }

  // ============================================================================
  // Execution
  // ============================================================================

  private async handleRunAgentGroup(
    entityId: string,
    agentGroupId: string
  ): Promise<AgentResult> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    const entity = this.currentTable.entities.find(e => e.id === entityId);
    const agentGroup = this.currentTable.agentGroups.find(ag => ag.id === agentGroupId);

    if (!entity || !agentGroup) {
      throw new Error('Entity or agent group not found');
    }

    // Update status to running
    if (!this.currentTable.results[entityId]) {
      this.currentTable.results[entityId] = {};
    }
    this.currentTable.results[entityId][agentGroupId] = { status: 'running' };
    this.currentTable.currentExecution = { entityId, agentGroupId };

    // Only push to SPA if bridge is still installed (not closed for agent execution)
    if (this.bridge?.installed) {
      await this.pushStateToSPA();
    }

    // Clear previous agent conversation so each run starts fresh
    // The AI Chat panel shows the agent execution in real-time
    await AgentService.getInstance().newConversation();

    // Execute the agent
    const result = await this.executeAgentForEntity(entity, agentGroup);

    // Store result
    this.currentTable.results[entityId][agentGroupId] = result;
    this.currentTable.currentExecution = undefined;

    await this.saveCurrentTable();

    // Only push to SPA if bridge is still installed
    if (this.bridge?.installed) {
      await this.pushStateToSPA();
    }

    return result;
  }

  private async handleRunRow(entityId: string, skipUIManagement = false): Promise<void> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    const entity = this.currentTable.entities.find(e => e.id === entityId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // When called directly (not from handleRunAll), manage UI lifecycle
    if (!skipUIManagement) {
      // Save state before execution (agent may navigate away)
      this.currentTable.executionStatus = 'running';
      await this.saveCurrentTable();
      logger.info('Saved table state before agent execution');

      // Close the Data Studio UI (agent will navigate the page)
      await this.closeDataStudioUI();
    }

    try {
      for (const agentGroup of this.currentTable.agentGroups) {
        // Check if paused (status can be changed by handlePauseExecution)
        const currentStatus = this.currentTable.executionStatus as string;
        if (currentStatus === 'paused') {
          break;
        }

        await this.handleRunAgentGroup(entityId, agentGroup.id);

        // Save incrementally after each agent group completes
        await this.saveCurrentTable();
      }
    } finally {
      if (!skipUIManagement) {
        this.currentTable.executionStatus = 'idle';
        this.currentTable.currentExecution = undefined;

        // Re-render Data Studio UI with results
        await this.reRenderDataStudio();
      }
    }
  }

  private async handleRunAll(): Promise<void> {
    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    // Save state before execution (agent may navigate away)
    this.currentTable.executionStatus = 'running';
    await this.saveCurrentTable();
    logger.info('Saved table state before running all entities');

    // Close the Data Studio UI once (agents will navigate the page)
    await this.closeDataStudioUI();

    try {
      for (const entity of this.currentTable.entities) {
        // Check if paused (status can be changed by handlePauseExecution)
        const currentStatus = this.currentTable.executionStatus as string;
        if (currentStatus === 'paused') {
          break;
        }

        // Run row with skipUIManagement=true since we manage UI lifecycle here
        await this.handleRunRow(entity.id, true);
      }
    } finally {
      this.currentTable.executionStatus = 'idle';
      this.currentTable.currentExecution = undefined;

      // Re-render Data Studio UI once with all results
      await this.reRenderDataStudio();
    }
  }

  private async handlePauseExecution(): Promise<void> {
    if (this.currentTable) {
      this.currentTable.executionStatus = 'paused';
    }
  }

  private async handleClearResults(): Promise<void> {
    if (!this.currentTable) {
      return;
    }

    // Reset all results to pending
    for (const entityId of Object.keys(this.currentTable.results)) {
      for (const agentGroupId of Object.keys(this.currentTable.results[entityId])) {
        this.currentTable.results[entityId][agentGroupId] = { status: 'pending' };
      }
    }

    await this.saveCurrentTable();
  }

  /**
   * Extract a string value from a potentially nested object.
   * Handles cases where agent returns { value: "...", currency: "..." } etc.
   */
  private extractStringValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      // Try common property names for nested values
      const obj = value as Record<string, unknown>;
      if ('value' in obj && typeof obj.value === 'string') {
        return obj.value;
      }
      if ('text' in obj && typeof obj.text === 'string') {
        return obj.text;
      }
      if ('result' in obj && typeof obj.result === 'string') {
        return obj.result;
      }

      // If it's an array, join elements
      if (Array.isArray(value)) {
        return value.map(v => this.extractStringValue(v)).filter(Boolean).join(', ');
      }

      // Fallback: JSON stringify for structured data
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  private async executeAgentForEntity(
    entity: Entity,
    agentGroup: AgentGroup
  ): Promise<AgentResult> {
    const query = agentGroup.queryTemplate.replace(/\{entity\}/gi, entity.name);
    const outputKeys = agentGroup.outputColumns.map(col => col.key);
    const startTime = Date.now();

    try {
      let responseData: Record<string, string> = {};

      // Get LLM configuration for agent execution
      const configManager = LLMConfigurationManager.getInstance();
      const llmContext = {
        apiKey: configManager.getApiKey(),
        provider: configManager.getProvider(),
        model: configManager.getMainModel(),
        miniModel: configManager.getMiniModel(),
        nanoModel: configManager.getNanoModel(),
      };

      // Check if this is a built-in agent
      if (AgentStudioIntegration.isBuiltInAgentName(agentGroup.agentName)) {
        // Call built-in agent directly from registry
        const agentTool = ToolRegistry.getToolInstance(agentGroup.agentName);
        if (!agentTool) {
          throw new Error(`Built-in agent '${agentGroup.agentName}' not found`);
        }

        // Format input for search_agent schema - pass LLMContext for agent execution
        const result = await agentTool.execute({
          objective: query,
          attributes: outputKeys,
          reasoning: `Data Studio analysis for ${entity.name}`,
          quantity: 1,
        }, llmContext);

        // Parse search_agent JSON response
        const response = (result as any).response ?? (result as any).output ?? result;
        let parsed: any;
        if (typeof response === 'string') {
          try {
            parsed = JSON.parse(response);
          } catch {
            // If not JSON, use as single value
            if (outputKeys.length === 1) {
              responseData[outputKeys[0]] = response;
            }
          }
        } else {
          parsed = response;
        }

        // Extract attributes from first result
        if (parsed?.results?.[0]?.attributes) {
          responseData = parsed.results[0].attributes;
        } else if (parsed?.attributes) {
          responseData = parsed.attributes;
        }
      } else {
        // Use call_custom_agent for custom agents (from Agent Studio)
        const callCustomAgentTool = ToolRegistry.getRegisteredTool('call_custom_agent');
        if (!callCustomAgentTool) {
          throw new Error('call_custom_agent tool not found');
        }

        const result = await (callCustomAgentTool as any).execute({
          agent_name: agentGroup.agentName,
          args: { query, context: entity.context, output_fields: outputKeys },
        }, llmContext);

        // Parse custom agent response
        const response = result.result?.response ?? result.response ?? result.result;
        if (typeof response === 'string') {
          try {
            responseData = JSON.parse(response);
          } catch {
            if (outputKeys.length === 1) {
              responseData[outputKeys[0]] = response;
            }
          }
        } else {
          responseData = response || {};
        }
      }

      // Map to column values
      const values: Record<string, string> = {};
      for (const col of agentGroup.outputColumns) {
        values[col.key] = this.extractStringValue(responseData[col.key]);
      }

      return {
        status: 'completed',
        values,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Failed to execute agent for entity:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async loadAvailableAgents(): Promise<{ name: string; description: string }[]> {
    try {
      const agentStorage = AgentStorageManager.getInstance();
      const agents = await agentStorage.getAllAgents();
      return agents.map(agent => ({
        name: agent.name,
        description: agent.description,
      }));
    } catch (error) {
      logger.error('Failed to load available agents:', error);
      return [];
    }
  }

  private async pushStateToSPA(): Promise<void> {
    if (!this.bridge) {
      return;
    }

    try {
      const state = await this.getState();
      await this.bridge.sendToSPA({
        action: 'set-state',
        payload: state,
      });
    } catch (error) {
      logger.error('Failed to push state to SPA:', error);
    }
  }

  // ============================================================================
  // UI Lifecycle for Agent Execution
  // ============================================================================

  /**
   * Close the Data Studio UI before agent execution.
   * The agent may navigate away from the page, destroying the iframe.
   */
  private async closeDataStudioUI(): Promise<void> {
    logger.info('Closing Data Studio UI for agent execution');

    // Remove the webapp iframe
    if (this.bridge?.webappId) {
      try {
        const { RemoveWebAppTool } = await import('../../../tools/RemoveWebAppTool.js');
        const removeTool = new RemoveWebAppTool();
        await removeTool.execute({
          webappId: this.bridge.webappId,
          reasoning: 'Closing Data Studio for agent execution',
        });
      } catch (error) {
        logger.error('Failed to remove webapp:', error);
      }
    }

    // Uninstall bridge (page will navigate away)
    if (this.bridge) {
      await this.bridge.uninstall();
    }
  }

  /**
   * Re-render the Data Studio UI after agent execution completes.
   * Uses MiniAppRegistry.forceRelaunch() to ensure proper wrapper and router injection.
   */
  private async reRenderDataStudio(): Promise<void> {
    logger.info('Re-rendering Data Studio after agent execution');

    try {
      // Use MiniAppRegistry to properly re-launch with all wrapper code
      // This ensures window.miniApp and window.miniAppRouter are properly injected
      const { MiniAppRegistry } = await import('../../MiniAppRegistry.js');
      const instance = await MiniAppRegistry.forceRelaunch('data_studio');

      // Update our bridge reference to the new instance
      this.bridge = instance.bridge;

      // Re-register our action handler with the new bridge
      instance.bridge.onAction(this.handleAction.bind(this));

      // Wait for SPA to initialize (it sends 'ready' after 100ms, add buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Push current state (with results) to SPA
      await this.pushStateToSPA();

      logger.info('Data Studio re-rendered successfully');
    } catch (error) {
      logger.error('Failed to re-render Data Studio:', error);
      throw error;
    }
  }
}
