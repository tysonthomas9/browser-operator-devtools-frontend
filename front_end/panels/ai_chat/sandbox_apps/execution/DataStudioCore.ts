// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * DataStudioCore - Shared logic for Data Studio
 *
 * This module contains the canonical implementation of Data Studio logic,
 * extracted from the WebSocket test server. Both the WebSocket server and
 * DevTools executor use this shared core with their own context adapters.
 *
 * Architecture:
 * - DataStudioCore: Pure business logic, no I/O
 * - DataStudioContext: Interface for I/O operations (storage, communication, agents)
 * - WebSocket server: Provides WebSocket-based context
 * - DevTools executor: Provides DevTools SDK-based context
 */

import {ConfigurableAgentTool, type AgentToolConfig, ToolRegistry} from '../../agent_framework/ConfigurableAgentTool.js';

// =============================================================================
// Types (canonical definitions)
// =============================================================================

export interface DataTable {
  tableId: string;
  tableName: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
  executionStatus: 'idle' | 'running' | 'paused';
  createdAt: string;
  modifiedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  context?: string;
}

export type LLMProviderType = 'openai' | 'cerebras' | 'anthropic' | 'groq' | 'openrouter' | 'litellm';

export interface InlineAgentConfig {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxIterations?: number;
  temperature?: number;
  provider?: LLMProviderType;
  model?: string;
}

export interface AgentGroup {
  id: string;
  agentName?: string;
  inlineAgent?: InlineAgentConfig;
  queryTemplate: string;
  outputColumns: OutputColumn[];
}

export interface OutputColumn {
  id: string;
  key: string;
  label: string;
}

export interface CellResult {
  status: 'pending' | 'running' | 'completed' | 'error';
  values?: Record<string, string>;
  error?: string;
  timestamp?: string;
  executionTimeMs?: number;
}

export interface TableIndexEntry {
  id: string;
  name: string;
  entityType: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  entityType: string;
  entityNameLabel: string;
  defaultEntities?: string[];
  defaultAgents?: Array<{
    agentName: string;
    queryTemplate: string;
    outputColumns: Array<{key: string; label: string}>;
  }>;
}

export interface LLMContext {
  apiKey: string;
  provider: LLMProviderType;
  model: string;
  miniModel: string;
  nanoModel: string;
}

export interface AvailableAgent {
  name: string;
  description: string;
}

// Unified message format (WebSocket format is canonical)
export interface StateUpdateMessage {
  type: 'state-update';
  payload: {
    type: 'init' | 'set-state' | 'saved';
    view: 'selector' | 'table';
    currentTable: SPATable | null;
    tables: TableIndexEntry[];
    templates: Template[];
    availableAgents: AvailableAgent[];
    isRunning?: boolean;
  };
}

export interface CellUpdateMessage {
  type: 'update-cell';
  payload: {
    entityId: string;
    agentGroupId: string;
    result: CellResult;
  };
}

// SPA table format (id/name instead of tableId/tableName)
export interface SPATable {
  id: string;
  name: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
  createdAt: string;
  modifiedAt: string;
}

// =============================================================================
// Context Interface
// =============================================================================

/**
 * Context interface for Data Studio operations.
 * Implementations provide storage, communication, and agent execution.
 */
export interface DataStudioContext {
  // Storage operations
  getTable(tableId: string): Promise<DataTable | null>;
  saveTable(table: DataTable): Promise<void>;
  listTables(): Promise<TableIndexEntry[]>;
  deleteTable(tableId: string): Promise<void>;

  // Communication (unified message format)
  sendStateUpdate(message: StateUpdateMessage): void;
  sendCellUpdate(message: CellUpdateMessage): void;

  // Agent execution
  executeAgent(
    agentName: string,
    query: string,
    entityName: string,
    llmContext: LLMContext,
  ): Promise<{success: boolean; output?: unknown; error?: string}>;

  // LLM configuration
  getLLMContext(inlineConfig?: InlineAgentConfig): LLMContext;
  getApiKeyForProvider(provider: string): string;

  // Available agents
  getAvailableAgents(): Promise<AvailableAgent[]>;

  // Templates
  getTemplates(): Template[];

  // Browser navigation (optional - only DevTools needs this for UI lifecycle)
  navigateToBlank?(): Promise<void>;

  // Logging
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void;
}

// =============================================================================
// Constants
// =============================================================================

const AGENT_EXECUTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_STRING_LENGTH = 10000;
const MAX_NAME_LENGTH = 500;
const MAX_OUTPUT_COLUMNS = 50;

// Default templates (canonical)
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'competitor_analysis',
    name: 'Competitor Analysis',
    description: 'Analyze competitors in your market',
    entityType: 'Competitor',
    entityNameLabel: 'Company Name',
    defaultEntities: ['OpenAI', 'Google DeepMind', 'Anthropic'],
    defaultAgents: [
      {
        agentName: 'research_agent',
        queryTemplate:
          'Research {entity} and analyze their market position, key strengths, weaknesses, and recent news',
        outputColumns: [
          {key: 'summary', label: 'Summary'},
          {key: 'strengths', label: 'Strengths'},
          {key: 'weaknesses', label: 'Weaknesses'},
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
    defaultEntities: ['iPhone 15 Pro', 'Samsung Galaxy S24', 'Google Pixel 8'],
    defaultAgents: [
      {
        agentName: 'research_agent',
        queryTemplate: 'Research {entity} and list key features, specifications, price, and user reviews',
        outputColumns: [
          {key: 'features', label: 'Key Features'},
          {key: 'price', label: 'Price'},
          {key: 'verdict', label: 'Verdict'},
        ],
      },
    ],
  },
  {
    id: 'lead_qualification',
    name: 'Lead Qualification',
    description: 'Qualify and research leads',
    entityType: 'Lead',
    entityNameLabel: 'Company Name',
  },
];

// =============================================================================
// DataStudioCore Class
// =============================================================================

/**
 * Core business logic for Data Studio.
 * Stateless - all state is managed through the context.
 */
export class DataStudioCore {
  private currentTable: DataTable | null = null;
  private currentTableId: string | null = null;
  private executionPaused = false;

  constructor(private readonly context: DataStudioContext) {}

  // ===========================================================================
  // State Management
  // ===========================================================================

  getCurrentTable(): DataTable | null {
    return this.currentTable;
  }

  setCurrentTable(table: DataTable | null): void {
    this.currentTable = table;
    this.currentTableId = table?.tableId ?? null;
  }

  // ===========================================================================
  // Table Operations
  // ===========================================================================

  async createTable(params: {
    tableName: string;
    entityType: string;
    entityNameLabel: string;
  }): Promise<DataTable> {
    const tableId = `table_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    // Validate inputs
    const tableName = this.validateString(params.tableName, 'Untitled Table', MAX_NAME_LENGTH);
    const entityType = this.validateString(params.entityType, 'Item', MAX_NAME_LENGTH);
    const entityNameLabel = this.validateString(params.entityNameLabel, 'Name', MAX_NAME_LENGTH);

    const table: DataTable = {
      tableId,
      tableName,
      entityType,
      entityNameLabel,
      entities: [],
      agentGroups: [],
      results: {},
      executionStatus: 'idle',
      createdAt: now,
      modifiedAt: now,
    };

    await this.context.saveTable(table);
    this.currentTable = table;
    this.currentTableId = tableId;

    this.context.log('info', `Table created: ${tableId} - ${tableName}`);
    await this.broadcastState();

    return table;
  }

  async loadTable(tableId: string): Promise<DataTable | null> {
    const table = await this.context.getTable(tableId);
    if (table) {
      this.currentTable = table;
      this.currentTableId = tableId;
      this.backfillMissingResults();
      this.context.log('info', `Table loaded: ${tableId}`);
      await this.broadcastState();
    }
    return table;
  }

  async saveTable(): Promise<void> {
    if (this.currentTable) {
      await this.context.saveTable(this.currentTable);
      this.context.log('info', `Table saved: ${this.currentTable.tableName}`);
      // Send save confirmation
      this.context.sendStateUpdate({
        type: 'state-update',
        payload: {
          type: 'saved',
          view: 'table',
          currentTable: this.transformTableForSPA(this.currentTable),
          tables: await this.context.listTables(),
          templates: this.context.getTemplates(),
          availableAgents: await this.context.getAvailableAgents(),
        },
      });
    }
  }

  async deleteTable(tableId: string): Promise<void> {
    await this.context.deleteTable(tableId);
    if (this.currentTableId === tableId) {
      this.currentTable = null;
      this.currentTableId = null;
    }
    this.context.log('info', `Table deleted: ${tableId}`);
    await this.broadcastState();
  }

  async useTemplate(params: {templateId: string; tableName: string}): Promise<void> {
    const templates = this.context.getTemplates();
    const template = templates.find(t => t.id === params.templateId);
    if (!template) {
      this.context.log('error', `Unknown template: ${params.templateId}`);
      return;
    }

    // Create table from template
    await this.createTable({
      tableName: params.tableName || template.name,
      entityType: template.entityType,
      entityNameLabel: template.entityNameLabel,
    });

    // Add default entities
    if (template.defaultEntities) {
      for (const entityName of template.defaultEntities) {
        await this.addEntity({name: entityName});
      }
    }

    // Add default agents
    if (template.defaultAgents) {
      for (const agent of template.defaultAgents) {
        await this.addAgentGroup({
          agentName: agent.agentName,
          queryTemplate: agent.queryTemplate,
          outputColumns: agent.outputColumns.map((col, i) => ({
            id: `col_${i + 1}`,
            key: col.key,
            label: col.label,
          })),
        });
      }
    }

    this.context.log('info', `Template applied: ${template.name}`);
  }

  goBack(): void {
    this.currentTable = null;
    this.currentTableId = null;
    this.context.log('info', 'Navigation: back to selector');
    this.broadcastState();
  }

  // ===========================================================================
  // Entity Operations
  // ===========================================================================

  async addEntity(params: {name: string; context?: string}): Promise<Entity | null> {
    if (!this.currentTable) return null;

    const name = this.validateRequiredString(params.name, 'entity name', MAX_NAME_LENGTH);
    if (name === null) return null;

    const context = params.context
      ? this.validateString(params.context, '', MAX_STRING_LENGTH)
      : undefined;

    const entity: Entity = {
      id: `entity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      context,
    };

    this.currentTable.entities.push(entity);

    // Initialize results for this entity
    this.currentTable.results[entity.id] = {};
    for (const ag of this.currentTable.agentGroups) {
      this.currentTable.results[entity.id][ag.id] = {status: 'pending'};
    }

    this.currentTable.modifiedAt = new Date().toISOString();
    await this.context.saveTable(this.currentTable);

    this.context.log('info', `Entity added: ${name}`);
    await this.broadcastState();

    return entity;
  }

  async removeEntity(entityId: string): Promise<void> {
    if (!this.currentTable) return;

    this.currentTable.entities = this.currentTable.entities.filter(e => e.id !== entityId);
    delete this.currentTable.results[entityId];

    this.currentTable.modifiedAt = new Date().toISOString();
    await this.context.saveTable(this.currentTable);

    this.context.log('info', `Entity removed: ${entityId}`);
    await this.broadcastState();
  }

  // ===========================================================================
  // Agent Group Operations
  // ===========================================================================

  async addAgentGroup(params: {
    agentName?: string;
    inlineAgent?: InlineAgentConfig;
    queryTemplate: string;
    outputColumns?: OutputColumn[];
  }): Promise<AgentGroup | null> {
    if (!this.currentTable) return null;

    // Validate: must have either agentName or inlineAgent
    if (!params.agentName && !params.inlineAgent) {
      this.context.log('error', 'AgentGroup must have either agentName or inlineAgent');
      return null;
    }

    // Validate agentName or inlineAgent
    let agentName: string | undefined;
    let inlineAgent: InlineAgentConfig | undefined;

    if (params.inlineAgent) {
      const validated = this.validateInlineAgentConfig(params.inlineAgent);
      if (!validated) {
        this.context.log('error', 'Invalid inline agent configuration');
        return null;
      }
      inlineAgent = validated;
    } else if (params.agentName) {
      agentName = this.validateRequiredString(params.agentName, 'agent name', MAX_NAME_LENGTH) ?? undefined;
      if (!agentName) return null;
    }

    // Validate queryTemplate
    const queryTemplate = this.validateRequiredString(params.queryTemplate, 'query template', MAX_STRING_LENGTH);
    if (!queryTemplate) return null;

    // Validate output columns
    const outputColumns = this.validateOutputColumns(params.outputColumns);

    const agentGroup: AgentGroup = {
      id: `ag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      agentName,
      inlineAgent,
      queryTemplate,
      outputColumns,
    };

    this.currentTable.agentGroups.push(agentGroup);

    // Initialize results for this agent group
    for (const entity of this.currentTable.entities) {
      if (!this.currentTable.results[entity.id]) {
        this.currentTable.results[entity.id] = {};
      }
      this.currentTable.results[entity.id][agentGroup.id] = {status: 'pending'};
    }

    this.currentTable.modifiedAt = new Date().toISOString();
    await this.context.saveTable(this.currentTable);

    const displayName = inlineAgent?.displayName || agentName || 'Unknown';
    this.context.log('info', `AgentGroup added: ${displayName}`);
    await this.broadcastState();

    return agentGroup;
  }

  async removeAgentGroup(agentGroupId: string): Promise<void> {
    if (!this.currentTable) return;

    this.currentTable.agentGroups = this.currentTable.agentGroups.filter(
      ag => ag.id !== agentGroupId,
    );

    // Remove results for this agent group
    for (const entityId of Object.keys(this.currentTable.results)) {
      delete this.currentTable.results[entityId][agentGroupId];
    }

    this.currentTable.modifiedAt = new Date().toISOString();
    await this.context.saveTable(this.currentTable);

    this.context.log('info', `AgentGroup removed: ${agentGroupId}`);
    await this.broadcastState();
  }

  // ===========================================================================
  // Execution Operations
  // ===========================================================================

  async runAgentGroup(entityId: string, agentGroupId: string): Promise<CellResult> {
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
    this.currentTable.results[entityId][agentGroupId] = {status: 'running'};
    this.context.sendCellUpdate({
      type: 'update-cell',
      payload: {entityId, agentGroupId, result: {status: 'running'}},
    });

    const startTime = Date.now();

    try {
      // Build query from template
      const query = agentGroup.queryTemplate.replace(/{entity}/gi, entity.name);
      const outputKeys = agentGroup.outputColumns.map(col => col.key);
      const agentDisplayName = agentGroup.inlineAgent?.displayName || agentGroup.agentName || 'unknown';

      this.context.log('info', `Executing: "${query}" with ${agentDisplayName}`);

      // Navigate to blank page for agent execution
      if (this.context.navigateToBlank) {
        await this.context.navigateToBlank();
      }

      let result: {success: boolean; output?: unknown; error?: string};

      if (agentGroup.inlineAgent) {
        // Execute inline agent
        result = await this.executeInlineAgent(agentGroup.inlineAgent, query, outputKeys);
      } else if (agentGroup.agentName) {
        // Execute referenced agent
        const llmContext = this.context.getLLMContext();
        result = await this.withTimeout(
          this.context.executeAgent(agentGroup.agentName, query, entity.name, llmContext),
          AGENT_EXECUTION_TIMEOUT_MS,
          `Agent '${agentGroup.agentName}' execution for entity '${entity.name}'`,
        );
      } else {
        throw new Error('AgentGroup must have either agentName or inlineAgent');
      }

      const executionTimeMs = Date.now() - startTime;

      // Parse result and create cell result
      const cellResult: CellResult = {
        status: result.success ? 'completed' : 'error',
        values: result.success ? this.parseAgentOutput(result.output, agentGroup.outputColumns) : undefined,
        error: result.error,
        timestamp: new Date().toISOString(),
        executionTimeMs,
      };

      this.currentTable.results[entityId][agentGroupId] = cellResult;
      this.currentTable.modifiedAt = new Date().toISOString();
      await this.context.saveTable(this.currentTable);

      this.context.log(
        'info',
        `Completed in ${executionTimeMs}ms: ${result.success ? 'SUCCESS' : 'FAILED'}`,
      );
      this.context.sendCellUpdate({
        type: 'update-cell',
        payload: {entityId, agentGroupId, result: cellResult},
      });

      return cellResult;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      this.context.log('error', 'Agent execution failed', error);

      const cellResult: CellResult = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        executionTimeMs,
      };

      this.currentTable.results[entityId][agentGroupId] = cellResult;
      this.currentTable.modifiedAt = new Date().toISOString();
      await this.context.saveTable(this.currentTable);

      this.context.sendCellUpdate({
        type: 'update-cell',
        payload: {entityId, agentGroupId, result: cellResult},
      });

      return cellResult;
    }
  }

  async runRow(entityId: string): Promise<void> {
    if (!this.currentTable) return;

    for (const agentGroup of this.currentTable.agentGroups) {
      if (this.executionPaused || this.currentTable.executionStatus === 'paused') {
        break;
      }
      await this.runAgentGroup(entityId, agentGroup.id);
    }
  }

  async runAll(): Promise<void> {
    if (!this.currentTable) return;

    this.executionPaused = false;
    this.currentTable.executionStatus = 'running';
    await this.context.saveTable(this.currentTable);
    await this.broadcastState();

    this.context.log('info', `Starting execution for ${this.currentTable.entities.length} entities...`);

    for (const entity of this.currentTable.entities) {
      if (this.executionPaused) {
        this.context.log('info', 'Execution paused');
        break;
      }

      for (const agentGroup of this.currentTable.agentGroups) {
        if (this.executionPaused) {
          break;
        }
        await this.runAgentGroup(entity.id, agentGroup.id);
      }
    }

    this.currentTable.executionStatus = 'idle';
    this.executionPaused = false;
    await this.context.saveTable(this.currentTable);

    this.context.log('info', 'Execution complete');
    await this.broadcastState();
  }

  pauseExecution(): void {
    this.executionPaused = true;
    if (this.currentTable) {
      this.currentTable.executionStatus = 'paused';
    }
    this.context.log('info', 'Execution paused');
    this.broadcastState();
  }

  // ===========================================================================
  // Inline Agent Execution
  // ===========================================================================

  private async executeInlineAgent(
    inlineConfig: InlineAgentConfig,
    query: string,
    outputKeys: string[],
  ): Promise<{success: boolean; output?: unknown; error?: string}> {
    try {
      const llmContext = this.context.getLLMContext(inlineConfig);

      this.context.log('info', `Creating inline agent: ${inlineConfig.displayName}`);
      this.context.log('debug', `Provider: ${llmContext.provider}, Model: ${llmContext.model}`);
      this.context.log('debug', `Tools: ${inlineConfig.tools.join(', ')}`);

      // Create ConfigurableAgentTool from inline config
      const agentConfig: AgentToolConfig = {
        name: inlineConfig.name,
        description: inlineConfig.description || `Custom agent: ${inlineConfig.displayName}`,
        systemPrompt:
          inlineConfig.systemPrompt +
          `\n\nIMPORTANT: Return your response as a JSON object with these exact keys: ${outputKeys.join(', ')}`,
        tools: inlineConfig.tools,
        schema: {
          type: 'object',
          properties: {
            query: {type: 'string', description: 'The query to process'},
          },
          required: ['query'],
        },
        maxIterations: inlineConfig.maxIterations || 10,
      };

      // Register and execute the inline agent
      const inlineAgent = new ConfigurableAgentTool(agentConfig);
      ToolRegistry.registerToolFactory(inlineConfig.name, () => inlineAgent);

      this.context.log('debug', `Executing with query: "${query}"`);

      // Execute with timeout
      const result = await this.withTimeout(
        inlineAgent.execute({query, reasoning: `Inline agent analyzing: ${query}`}, llmContext),
        AGENT_EXECUTION_TIMEOUT_MS,
        `Inline agent '${inlineConfig.displayName}' execution`,
      );

      // Parse the response
      const parsedOutput = this.parseInlineAgentResponse(result, outputKeys);

      this.context.log('info', 'Inline agent success', parsedOutput);
      return {success: true, output: parsedOutput};
    } catch (error) {
      this.context.log('error', 'Inline agent error', error);
      return {success: false, error: String(error)};
    }
  }

  private parseInlineAgentResponse(result: unknown, outputKeys: string[]): Record<string, string> {
    // Extract from result/response/output wrapper (multiple levels)
    let rawResponse =
      (result as {response?: unknown; output?: unknown; result?: unknown}).response ??
      (result as {output?: unknown; result?: unknown}).output ??
      (result as {result?: unknown}).result ??
      result;

    // If rawResponse has a nested result key, extract it
    if (typeof rawResponse === 'object' && rawResponse !== null && 'result' in rawResponse) {
      rawResponse = (rawResponse as {result: unknown}).result;
    }

    let parsedOutput: Record<string, string> = {};

    // Convert to string if needed
    let responseStr = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);

    // Strip markdown code block markers if present
    const codeBlockMatch = responseStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      responseStr = codeBlockMatch[1].trim();
    }

    try {
      const jsonData = JSON.parse(responseStr);

      // Extract output keys from parsed JSON
      for (const key of outputKeys) {
        if (key in jsonData) {
          const value = jsonData[key];
          parsedOutput[key] =
            typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
        }
      }

      // If no keys found but single column, use stringified result
      if (Object.keys(parsedOutput).length === 0 && outputKeys.length === 1) {
        parsedOutput[outputKeys[0]] = responseStr;
      }
    } catch {
      // If not JSON, use as single value or fill all columns
      if (outputKeys.length === 1) {
        parsedOutput[outputKeys[0]] = responseStr;
      } else {
        for (const key of outputKeys) {
          parsedOutput[key] = responseStr;
        }
      }
    }

    return parsedOutput;
  }

  private parseAgentOutput(output: unknown, columns: OutputColumn[]): Record<string, string> {
    const values: Record<string, string> = {};

    if (output === null || output === undefined) {
      values[columns[0]?.key || 'result'] = 'No output';
      return values;
    }

    if (typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      for (const col of columns) {
        if (obj[col.key] !== undefined) {
          const value = obj[col.key];
          values[col.key] =
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value);
        } else {
          values[col.key] = JSON.stringify(output).slice(0, MAX_STRING_LENGTH);
        }
      }
    } else {
      values[columns[0]?.key || 'result'] = String(output).slice(0, MAX_STRING_LENGTH);
    }

    return values;
  }

  // ===========================================================================
  // State Broadcasting
  // ===========================================================================

  async broadcastState(): Promise<void> {
    const tables = await this.context.listTables();
    const availableAgents = await this.context.getAvailableAgents();
    const templates = this.context.getTemplates();

    this.context.sendStateUpdate({
      type: 'state-update',
      payload: {
        type: 'set-state',
        view: this.currentTable ? 'table' : 'selector',
        currentTable: this.transformTableForSPA(this.currentTable),
        tables,
        templates,
        availableAgents,
        isRunning: this.currentTable?.executionStatus === 'running',
      },
    });
  }

  async sendInitState(): Promise<void> {
    const tables = await this.context.listTables();
    const availableAgents = await this.context.getAvailableAgents();
    const templates = this.context.getTemplates();

    this.context.sendStateUpdate({
      type: 'state-update',
      payload: {
        type: 'init',
        view: this.currentTable ? 'table' : 'selector',
        currentTable: this.transformTableForSPA(this.currentTable),
        tables,
        templates,
        availableAgents,
        isRunning: this.currentTable?.executionStatus === 'running',
      },
    });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private transformTableForSPA(table: DataTable | null): SPATable | null {
    if (!table) return null;
    return {
      id: table.tableId,
      name: table.tableName,
      entityType: table.entityType,
      entityNameLabel: table.entityNameLabel,
      entities: table.entities,
      agentGroups: table.agentGroups,
      results: table.results,
      createdAt: table.createdAt,
      modifiedAt: table.modifiedAt,
    };
  }

  private backfillMissingResults(): void {
    if (!this.currentTable) return;

    let modified = false;

    for (const entity of this.currentTable.entities) {
      if (!this.currentTable.results[entity.id]) {
        this.currentTable.results[entity.id] = {};
        modified = true;
      }
      for (const agentGroup of this.currentTable.agentGroups) {
        if (!this.currentTable.results[entity.id][agentGroup.id]) {
          this.currentTable.results[entity.id][agentGroup.id] = {status: 'pending'};
          modified = true;
        }
      }
    }

    if (modified) {
      this.context.log('info', 'Backfilled missing results for loaded table');
    }
  }

  // ===========================================================================
  // Validation Helpers
  // ===========================================================================

  private validateString(value: unknown, defaultValue: string, maxLength: number = MAX_STRING_LENGTH): string {
    if (typeof value !== 'string') {
      return defaultValue;
    }
    return value.trim().slice(0, maxLength);
  }

  private validateRequiredString(
    value: unknown,
    fieldName: string,
    maxLength: number = MAX_STRING_LENGTH,
  ): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      this.context.log('error', `Invalid ${fieldName}: must be a non-empty string`);
      return null;
    }
    return value.trim().slice(0, maxLength);
  }

  private validateInlineAgentConfig(config: unknown): InlineAgentConfig | null {
    if (!config || typeof config !== 'object') {
      return null;
    }

    const c = config as Record<string, unknown>;

    const name = this.validateRequiredString(c.name, 'inline agent name', MAX_NAME_LENGTH);
    const displayName = this.validateRequiredString(c.displayName, 'inline agent displayName', MAX_NAME_LENGTH);
    const systemPrompt = this.validateRequiredString(c.systemPrompt, 'inline agent systemPrompt');

    if (!name || !displayName || !systemPrompt) {
      return null;
    }

    // Validate tools array
    if (!Array.isArray(c.tools) || c.tools.length === 0) {
      this.context.log('error', 'Inline agent must have at least one tool');
      return null;
    }

    const tools = c.tools.filter((t): t is string => typeof t === 'string');
    if (tools.length === 0) {
      this.context.log('error', 'Inline agent tools must be strings');
      return null;
    }

    return {
      name,
      displayName,
      description: this.validateString(c.description, '', MAX_STRING_LENGTH),
      systemPrompt,
      tools,
      maxIterations: typeof c.maxIterations === 'number' ? c.maxIterations : 10,
      temperature: typeof c.temperature === 'number' ? c.temperature : undefined,
      provider: typeof c.provider === 'string' ? (c.provider as LLMProviderType) : undefined,
      model: typeof c.model === 'string' ? c.model : undefined,
    };
  }

  private validateOutputColumns(columns: unknown): OutputColumn[] {
    const defaultColumns: OutputColumn[] = [{id: 'col_1', key: 'result', label: 'Result'}];

    if (!Array.isArray(columns) || columns.length === 0) {
      return defaultColumns;
    }

    const validColumns: OutputColumn[] = [];
    const maxColumns = Math.min(columns.length, MAX_OUTPUT_COLUMNS);

    for (let i = 0; i < maxColumns; i++) {
      const col = columns[i];
      if (!col || typeof col !== 'object') continue;

      const c = col as Record<string, unknown>;
      const key = this.validateString(c.key, `col_${i + 1}`, MAX_NAME_LENGTH);
      const label = this.validateString(c.label, key, MAX_NAME_LENGTH);

      validColumns.push({
        id: this.validateString(c.id, `col_${i + 1}`, MAX_NAME_LENGTH),
        key,
        label,
      });
    }

    return validColumns.length > 0 ? validColumns : defaultColumns;
  }

  // ===========================================================================
  // Timeout Helper
  // ===========================================================================

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      return result;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      throw error;
    }
  }
}
