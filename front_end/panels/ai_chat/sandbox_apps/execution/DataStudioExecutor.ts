// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {createLogger} from '../../core/Logger.js';
import {SandboxController} from '../controller/SandboxController.js';
import {getSandboxProtocol} from '../protocol/SandboxProtocol.js';
import {AgentStudioIntegration} from '../../core/AgentStudioIntegration.js';
import {LLMConfigurationManager} from '../../core/LLMConfigurationManager.js';
import {ToolRegistry} from '../../agent_framework/ConfigurableAgentTool.js';
import {AgentService} from '../../core/AgentService.js';
import {AgentStorageManager} from '../../core/AgentStorageManager.js';
import {
  DataStudioStorage,
  type DataStudioTable,
  type Entity,
  type AgentGroup,
  type CellResult,
} from './DataStudioStorage.js';
import type {SandboxEvent} from '../types/SandboxTypes.js';

import * as SDK from '../../../../core/sdk/sdk.js';

const logger = createLogger('DataStudioExecutor');

/**
 * DataStudioExecutor - Agent execution coordinator for Data Studio v2
 *
 * Subscribes to SandboxController events and handles:
 * - Agent execution (built-in and custom agents)
 * - UI lifecycle (close iframe before execution, re-render after)
 * - State synchronization with iframe
 * - Persistent storage
 */
export class DataStudioExecutor {
  private static instance: DataStudioExecutor | null = null;

  private controller: SandboxController;
  private storage: DataStudioStorage;
  private unsubscribeFn: (() => void) | null = null;

  // Current table state (cached from iframe for execution)
  private currentTable: DataStudioTable | null = null;
  private executionPaused = false;

  // Track the Data Studio app ID and webappId
  private dataStudioAppId: string | null = null;
  private dataStudioWebappId: string | null = null;

  // Container element for re-rendering
  private containerElement: HTMLElement | null = null;

  private constructor() {
    this.controller = SandboxController.getInstance();
    this.storage = DataStudioStorage.getInstance();
    logger.info('Initialized DataStudioExecutor');
  }

  static getInstance(): DataStudioExecutor {
    if (!DataStudioExecutor.instance) {
      DataStudioExecutor.instance = new DataStudioExecutor();
    }
    return DataStudioExecutor.instance;
  }

  // ============================================================================
  // App Registration
  // ============================================================================

  /**
   * Register to handle Data Studio app events
   */
  registerApp(appId: string, container?: HTMLElement): void {
    if (this.dataStudioAppId && this.dataStudioAppId !== appId) {
      this.unregisterApp();
    }

    this.dataStudioAppId = appId;
    this.containerElement = container || null;

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

  /**
   * Unregister from app events
   */
  unregisterApp(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.dataStudioAppId = null;
    this.currentTable = null;
    this.containerElement = null;
    logger.info('Unregistered from Data Studio app');
  }

  // ============================================================================
  // Action Handler
  // ============================================================================

  /**
   * Handle incoming actions from iframe
   */
  private async handleAction(event: SandboxEvent): Promise<void> {
    const data = event.data as {type?: string; currentTable?: DataStudioTable; [key: string]: unknown};
    const actionType = data.type as string;

    logger.debug(`Handling action: ${actionType}`, data);

    // Use table from payload if provided (SPA sends current table state with run actions)
    if (data.currentTable) {
      this.currentTable = data.currentTable;

      // Ensure table has tableId (SPA may send 'id' instead of 'tableId')
      const tableWithId = this.currentTable as DataStudioTable & {id?: string};
      if (!this.currentTable.tableId && tableWithId.id) {
        this.currentTable.tableId = tableWithId.id;
      }

      // Ensure results object exists (defensive initialization)
      if (!this.currentTable.results) {
        this.currentTable.results = {};
      }
    }

    switch (actionType) {
      case 'run-agent-group':
        await this.handleRunAgentGroup(
          data.entityId as string,
          data.agentGroupId as string,
        );
        break;

      case 'run-row':
        await this.handleRunRow(data.entityId as string);
        break;

      case 'run-all':
        await this.handleRunAll();
        break;

      case 'pause-execution':
        this.handlePauseExecution();
        break;

      case 'save-table':
        await this.handleSaveTable();
        break;

      case 'load-table':
        await this.handleLoadTable(data.tableId as string);
        break;

      case 'delete-table':
        await this.handleDeleteTable(data.tableId as string);
        break;

      case 'get-state':
        await this.sendInitialState();
        break;

      case 'create-table':
        await this.handleCreateTable(data);
        break;

      case 'add-entity':
        await this.handleAddEntity(data);
        break;

      case 'remove-entity':
        await this.handleRemoveEntity(data.entityId as string);
        break;

      case 'add-agent-group':
        await this.handleAddAgentGroup(data);
        break;

      case 'remove-agent-group':
        await this.handleRemoveAgentGroup(data.agentGroupId as string);
        break;

      case 'close-table':
        this.currentTable = null;
        break;

      case 'use-template':
        await this.handleUseTemplate(
          data.templateId as string,
          data.tableName as string,
        );
        break;

      default:
        logger.debug(`Unhandled action type: ${actionType}`);
    }
  }

  // ============================================================================
  // Agent Execution
  // ============================================================================

  /**
   * Default timeout for agent execution (5 minutes)
   */
  private static readonly AGENT_EXECUTION_TIMEOUT_MS = 5 * 60 * 1000;

  /**
   * Wrap a promise with a timeout
   */
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

  /**
   * Execute a single agent for a single entity
   * Ported from v1 DataStudioMiniApp.executeAgentForEntity()
   */
  async executeAgentForEntity(
    entity: Entity,
    agentGroup: AgentGroup,
  ): Promise<CellResult> {
    const query = agentGroup.queryTemplate.replace(/\{entity\}/gi, entity.name);
    const outputKeys = agentGroup.outputColumns.map(col => col.key);
    const startTime = Date.now();

    try {
      let responseData: Record<string, string> = {};

      // Get LLM configuration
      const configManager = LLMConfigurationManager.getInstance();
      const llmContext = {
        apiKey: configManager.getApiKey(),
        provider: configManager.getProvider(),
        model: configManager.getMainModel(),
        miniModel: configManager.getMiniModel(),
        nanoModel: configManager.getNanoModel(),
      };

      // Check if built-in agent
      if (AgentStudioIntegration.isBuiltInAgentName(agentGroup.agentName)) {
        // Call built-in agent directly from registry
        const agentTool = ToolRegistry.getToolInstance(agentGroup.agentName);
        if (!agentTool) {
          throw new Error(`Built-in agent '${agentGroup.agentName}' not found`);
        }

        // Format input for agent schema (with timeout protection)
        const result = await this.withTimeout(
          agentTool.execute({
            objective: query,
            attributes: outputKeys,
            reasoning: `Data Studio analysis for ${entity.name}`,
            quantity: 1,
          }, llmContext),
          DataStudioExecutor.AGENT_EXECUTION_TIMEOUT_MS,
          `Agent '${agentGroup.agentName}' execution for entity '${entity.name}'`,
        );

        // Parse response
        const response = (result as {response?: unknown; output?: unknown}).response ??
                        (result as {output?: unknown}).output ?? result;
        let parsed: unknown;
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

        // Extract data from parsed response
        // Try multiple extraction strategies for different agent output formats
        const parsedObj = parsed as {
          results?: Array<Record<string, unknown>>;
          attributes?: Record<string, string>;
          [key: string]: unknown;
        };

        logger.info('Parsing agent response', {outputKeys, parsedType: typeof parsed, hasResults: !!parsedObj?.results});

        if (parsedObj?.results?.[0]) {
          const firstResult = parsedObj.results[0];
          logger.info('First result from agent', {firstResult: JSON.stringify(firstResult).substring(0, 500)});
          // Check for attributes object (legacy format)
          if (firstResult.attributes && typeof firstResult.attributes === 'object') {
            responseData = firstResult.attributes as Record<string, string>;
            logger.info('Extracted from attributes', {responseData});
          } else {
            // Use fields directly from result (new format with summary, etc.)
            for (const key of outputKeys) {
              if (key in firstResult && firstResult[key] !== undefined) {
                responseData[key] = String(firstResult[key]);
              }
            }
            logger.info('Extracted from result fields', {responseData});
          }
        } else if (parsedObj?.attributes) {
          responseData = parsedObj.attributes;
          logger.info('Extracted from top-level attributes', {responseData});
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Try to extract output keys directly from top-level object
          for (const key of outputKeys) {
            if (key in parsedObj && parsedObj[key] !== undefined) {
              responseData[key] = String(parsedObj[key]);
            }
          }
          logger.info('Extracted from top-level object', {responseData});
        } else {
          logger.warn('Could not extract data from parsed response', {parsedObj: JSON.stringify(parsedObj).substring(0, 500)});
        }
      } else {
        // Use call_custom_agent for custom agents (from Agent Studio)
        const callCustomAgentTool = ToolRegistry.getRegisteredTool('call_custom_agent');
        if (!callCustomAgentTool) {
          throw new Error('call_custom_agent tool not found');
        }

        // Execute custom agent with timeout protection
        const result = await this.withTimeout(
          (callCustomAgentTool as {execute: (args: unknown, ctx: unknown) => Promise<unknown>}).execute({
            agent_name: agentGroup.agentName,
            args: {query, context: entity.context, output_fields: outputKeys},
          }, llmContext),
          DataStudioExecutor.AGENT_EXECUTION_TIMEOUT_MS,
          `Custom agent '${agentGroup.agentName}' execution for entity '${entity.name}'`,
        );

        // Parse custom agent response
        const resultObj = result as {result?: {response?: unknown}; response?: unknown};
        const response = resultObj.result?.response ?? resultObj.response ?? resultObj.result;
        if (typeof response === 'string') {
          try {
            responseData = JSON.parse(response);
          } catch {
            if (outputKeys.length === 1) {
              responseData[outputKeys[0]] = response;
            }
          }
        } else {
          responseData = (response as Record<string, string>) || {};
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

  /**
   * Run a single cell (entity × agent group)
   */
  async handleRunAgentGroup(
    entityId: string,
    agentGroupId: string,
  ): Promise<CellResult> {
    // Get current state from UI before execution
    if (!this.currentTable) {
      this.currentTable = await this.requestStateFromUI();
    }

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

    // Send cell update to UI
    await this.sendCellUpdate(entityId, agentGroupId, {status: 'running'});

    // Clear previous agent conversation so each run starts fresh
    await AgentService.getInstance().newConversation();

    // Execute the agent
    const result = await this.executeAgentForEntity(entity, agentGroup);

    // Store result
    this.currentTable.results[entityId][agentGroupId] = result;

    // Save to storage
    await this.storage.saveTable(this.currentTable);

    // Send result to UI
    await this.sendCellUpdate(entityId, agentGroupId, result);

    return result;
  }

  /**
   * Run all agent groups for a single entity
   */
  async handleRunRow(entityId: string, skipUIManagement = false): Promise<void> {
    // Get current state from UI before execution
    if (!this.currentTable) {
      this.currentTable = await this.requestStateFromUI();
    }

    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    const entity = this.currentTable.entities.find(e => e.id === entityId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // When called directly (not from handleRunAll), manage UI lifecycle
    if (!skipUIManagement) {
      this.currentTable.executionStatus = 'running';
      await this.storage.saveTable(this.currentTable);
      logger.info('Saved table state before agent execution');

      // Close the Data Studio UI (agent will navigate the page)
      await this.closeDataStudioUI();
    }

    try {
      for (const agentGroup of this.currentTable.agentGroups) {
        // Check if paused (executionPaused flag is set by handlePauseExecution)
        if (this.executionPaused) {
          break;
        }

        await this.handleRunAgentGroup(entityId, agentGroup.id);

        // Save incrementally after each agent group completes
        await this.storage.saveTable(this.currentTable);
      }
    } finally {
      if (!skipUIManagement) {
        this.currentTable.executionStatus = 'idle';
        this.executionPaused = false;

        // Re-render Data Studio UI with results
        await this.reRenderDataStudio();
      }
    }
  }

  /**
   * Run all cells in the table
   */
  async handleRunAll(): Promise<void> {
    // Get current state from UI before execution
    if (!this.currentTable) {
      this.currentTable = await this.requestStateFromUI();
    }

    if (!this.currentTable) {
      throw new Error('No table is currently open');
    }

    // Reset pause flag
    this.executionPaused = false;

    // Save state before execution
    this.currentTable.executionStatus = 'running';
    await this.storage.saveTable(this.currentTable);
    logger.info('Saved table state before running all entities');

    // Close the Data Studio UI (agents will navigate the page)
    await this.closeDataStudioUI();

    try {
      for (const entity of this.currentTable.entities) {
        // Check if paused (executionPaused flag is set by handlePauseExecution)
        if (this.executionPaused) {
          break;
        }

        // Run row with skipUIManagement=true since we manage UI lifecycle here
        await this.handleRunRow(entity.id, true);
      }
    } finally {
      this.currentTable.executionStatus = 'idle';
      this.executionPaused = false;

      // Re-render Data Studio UI with all results
      await this.reRenderDataStudio();
    }
  }

  /**
   * Pause execution
   */
  handlePauseExecution(): void {
    this.executionPaused = true;
    if (this.currentTable) {
      this.currentTable.executionStatus = 'paused';
    }
    logger.info('Execution paused');
  }

  // ============================================================================
  // UI Lifecycle
  // ============================================================================

  /**
   * Close the Data Studio UI before agent execution.
   * The agent may navigate away from the page, destroying the iframe.
   */
  private async closeDataStudioUI(): Promise<void> {
    if (!this.dataStudioAppId) {
      return;
    }

    logger.info('Closing Data Studio UI for agent execution');

    // Stop the app (this removes the webapp from the inspected page)
    await this.controller.stopApp(this.dataStudioAppId);
  }

  /**
   * Re-render the Data Studio UI after agent execution completes.
   */
  private async reRenderDataStudio(): Promise<void> {
    if (!this.dataStudioAppId) {
      return;
    }

    logger.info('Re-rendering Data Studio after agent execution');

    // Navigate to blank page first for clean canvas
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (target) {
      try {
        await target.pageAgent().invoke_navigate({url: 'about:blank'});
        // Wait for navigation to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        logger.error('Failed to navigate to blank page:', error);
      }
    }

    // Re-run the Data Studio app
    try {
      await this.controller.runApp(this.dataStudioAppId, this.containerElement || undefined);
    } catch (error) {
      logger.error('Failed to re-run Data Studio app:', error);
      return;
    }

    // Wait for app to fully initialize (bundler, React mount, etc.)
    // The app needs time to: render, mount React, process messages
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Push current state (with results) to the UI with retries
    if (this.currentTable) {
      await this.sendFullStateWithRetry();
    }
  }

  /**
   * Send full state to the iframe UI with retries
   */
  private async sendFullStateWithRetry(maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const success = await this.sendFullState();
      if (success) {
        logger.info(`Successfully sent full state on attempt ${attempt}`);
        return;
      }

      logger.warn(`Failed to send full state (attempt ${attempt}/${maxRetries})`);

      if (attempt < maxRetries) {
        // Wait before retry, increasing delay each time
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    logger.error('Failed to send full state after all retries');
  }

  // ============================================================================
  // State Synchronization
  // ============================================================================

  /**
   * Request current state from the iframe UI
   */
  private async requestStateFromUI(): Promise<DataStudioTable | null> {
    if (!this.dataStudioAppId) {
      return null;
    }

    // Get state from controller's cached app state
    const appState = this.controller.getAppState(this.dataStudioAppId) as {
      currentTable?: DataStudioTable;
    };

    if (appState?.currentTable) {
      return appState.currentTable;
    }

    // Try to load from storage if not in memory
    const tables = await this.storage.listTables();
    if (tables.length > 0) {
      return await this.storage.loadTable(tables[0].id);
    }

    return null;
  }

  /**
   * Send a cell update to the iframe UI
   */
  private async sendCellUpdate(
    entityId: string,
    agentGroupId: string,
    result: CellResult,
  ): Promise<void> {
    if (!this.dataStudioAppId) {
      return;
    }

    await getSandboxProtocol().sendDataUpdate(
      this.dataStudioAppId,
      `results/${entityId}/${agentGroupId}`,
      result,
    );
  }

  /**
   * Send full state to the iframe UI
   * Returns true if message was sent successfully, false otherwise
   */
  private async sendFullState(): Promise<boolean> {
    if (!this.dataStudioAppId || !this.currentTable) {
      return false;
    }

    // Get available agents for the UI
    const availableAgents = await this.loadAvailableAgents();

    // Get saved tables list
    const tables = await this.storage.listTables();

    // Convert currentTable to SPA format (tableId -> id, tableName -> name)
    const spaTable = this.convertTableToSPAFormat(this.currentTable);

    const state = {
      view: 'table',
      currentTable: spaTable,
      tables,
      availableAgents,
      isRunning: false,
    };

    logger.info('Sending full state to SPA', {tableId: spaTable.id, entities: (spaTable.entities as Entity[]).length});

    return await getSandboxProtocol().sendInit(this.dataStudioAppId, state);
  }

  /**
   * Convert DataStudioTable (storage format) to SPA DataTable format
   * Maps tableId -> id, tableName -> name
   */
  private convertTableToSPAFormat(table: DataStudioTable): Record<string, unknown> {
    return {
      id: table.tableId,
      name: table.tableName,
      entityType: table.entityType,
      entityNameLabel: table.entityNameLabel,
      entities: table.entities,
      agentGroups: table.agentGroups,
      results: table.results,
      createdAt: table.createdAt,
      modifiedAt: table.updatedAt,
    };
  }

  /**
   * Send initial state to the iframe UI
   */
  private async sendInitialState(): Promise<void> {
    if (!this.dataStudioAppId) {
      return;
    }

    // Get available agents
    const availableAgents = await this.loadAvailableAgents();

    // Get saved tables list
    const tables = await this.storage.listTables();

    // Convert currentTable to SPA format if it exists
    const spaTable = this.currentTable ? this.convertTableToSPAFormat(this.currentTable) : null;

    const state = {
      view: this.currentTable ? 'table' : 'selector',
      currentTable: spaTable,
      tables,
      // Don't send templates - let the SPA keep its hardcoded ones
      availableAgents,
      isRunning: false,
    };

    getSandboxProtocol().sendInit(this.dataStudioAppId, state);
  }

  // ============================================================================
  // Input Validation
  // ============================================================================

  /**
   * Maximum allowed length for string fields
   */
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_NAME_LENGTH = 500;

  /**
   * Validate and sanitize a string input
   * Returns the sanitized string or a default value if invalid
   */
  private validateString(
    value: unknown,
    defaultValue: string,
    maxLength: number = DataStudioExecutor.MAX_STRING_LENGTH,
  ): string {
    if (typeof value !== 'string') {
      return defaultValue;
    }
    // Trim and truncate to max length
    return value.trim().slice(0, maxLength);
  }

  /**
   * Validate that a required string field is present and non-empty
   */
  private validateRequiredString(
    value: unknown,
    fieldName: string,
    maxLength: number = DataStudioExecutor.MAX_STRING_LENGTH,
  ): string | null {
    if (typeof value !== 'string') {
      logger.error(`Invalid ${fieldName}: expected string, got ${typeof value}`);
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      logger.error(`Invalid ${fieldName}: cannot be empty`);
      return null;
    }
    return trimmed.slice(0, maxLength);
  }

  /**
   * Validate output columns array
   */
  private validateOutputColumns(
    value: unknown,
  ): AgentGroup['outputColumns'] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((col): col is Record<string, unknown> =>
        typeof col === 'object' && col !== null)
      .map(col => ({
        id: this.validateString(col.id, `col_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
        key: this.validateString(col.key, 'value', DataStudioExecutor.MAX_NAME_LENGTH),
        label: this.validateString(col.label, 'Value', DataStudioExecutor.MAX_NAME_LENGTH),
      }))
      .slice(0, 50); // Limit to 50 output columns
  }

  // ============================================================================
  // Table Management
  // ============================================================================

  /**
   * Create a new table
   */
  private async handleCreateTable(data: Record<string, unknown>): Promise<void> {
    const tableId = `table_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    // Validate inputs with sanitization
    const tableName = this.validateString(
      data.tableName,
      'Untitled Table',
      DataStudioExecutor.MAX_NAME_LENGTH,
    );
    const entityType = this.validateString(
      data.entityType,
      'Item',
      DataStudioExecutor.MAX_NAME_LENGTH,
    );
    const entityNameLabel = this.validateString(
      data.entityNameLabel,
      'Name',
      DataStudioExecutor.MAX_NAME_LENGTH,
    );

    this.currentTable = {
      tableId,
      tableName,
      entityType,
      entityNameLabel,
      entities: [],
      agentGroups: [],
      results: {},
      executionStatus: 'idle',
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.saveTable(this.currentTable);
    await this.sendFullState();
  }

  /**
   * Built-in templates for quick table creation
   */
  private static readonly TEMPLATES: Record<string, {entityType: string; entityNameLabel: string}> = {
    'competitor-analysis': {
      entityType: 'Competitor',
      entityNameLabel: 'Company Name',
    },
    'product-research': {
      entityType: 'Product',
      entityNameLabel: 'Product Name',
    },
    'lead-qualification': {
      entityType: 'Lead',
      entityNameLabel: 'Company/Contact',
    },
  };

  /**
   * Create a table from a template
   */
  private async handleUseTemplate(templateId: string, tableName: string): Promise<void> {
    const template = DataStudioExecutor.TEMPLATES[templateId];
    if (!template) {
      logger.warn(`Unknown template: ${templateId}`);
      return;
    }

    await this.handleCreateTable({
      tableName: tableName || `New ${template.entityType} Table`,
      entityType: template.entityType,
      entityNameLabel: template.entityNameLabel,
    });
  }

  /**
   * Save current table
   */
  private async handleSaveTable(): Promise<void> {
    // Get current state from UI
    const stateFromUI = await this.requestStateFromUI();
    if (stateFromUI) {
      this.currentTable = stateFromUI;
    }

    if (this.currentTable) {
      await this.storage.saveTable(this.currentTable);
      logger.info(`Saved table: ${this.currentTable.tableName}`);
    }
  }

  /**
   * Load a table by ID
   */
  private async handleLoadTable(tableId: string): Promise<void> {
    this.currentTable = await this.storage.loadTable(tableId);
    if (this.currentTable) {
      // Backfill missing results for all entity/agent combinations
      // This handles tables loaded from storage that may have incomplete results
      this.backfillMissingResults();
      await this.sendFullState();
    }
  }

  /**
   * Backfill missing results for all entity/agent combinations
   * Ensures every entity has a result entry for every agent group
   */
  private backfillMissingResults(): void {
    if (!this.currentTable) {
      return;
    }

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
      logger.info('Backfilled missing results for loaded table');
    }
  }

  /**
   * Delete a table
   */
  private async handleDeleteTable(tableId: string): Promise<void> {
    await this.storage.deleteTable(tableId);
    if (this.currentTable?.tableId === tableId) {
      this.currentTable = null;
    }
    await this.sendInitialState();
  }

  // ============================================================================
  // Entity Management
  // ============================================================================

  /**
   * Add an entity to the current table
   */
  private async handleAddEntity(data: Record<string, unknown>): Promise<void> {
    if (!this.currentTable) {
      this.currentTable = await this.requestStateFromUI();
    }

    if (!this.currentTable) {
      return;
    }

    // Validate required name field
    const name = this.validateRequiredString(
      data.name,
      'entity name',
      DataStudioExecutor.MAX_NAME_LENGTH,
    );
    if (name === null) {
      return; // Invalid input, abort
    }

    // Validate optional context field
    const context = typeof data.context === 'string'
      ? this.validateString(data.context, '')
      : undefined;

    const entity: Entity = {
      id: `entity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      context,
    };

    this.currentTable.entities.push(entity);

    // Initialize results for this entity with pending status for all agent groups
    this.currentTable.results[entity.id] = {};
    for (const agentGroup of this.currentTable.agentGroups) {
      this.currentTable.results[entity.id][agentGroup.id] = {status: 'pending'};
    }

    await this.storage.saveTable(this.currentTable);
  }

  /**
   * Remove an entity from the current table
   */
  private async handleRemoveEntity(entityId: string): Promise<void> {
    if (!this.currentTable) {
      return;
    }

    this.currentTable.entities = this.currentTable.entities.filter(e => e.id !== entityId);
    delete this.currentTable.results[entityId];

    await this.storage.saveTable(this.currentTable);
  }

  // ============================================================================
  // Agent Group Management
  // ============================================================================

  /**
   * Add an agent group to the current table
   */
  private async handleAddAgentGroup(data: Record<string, unknown>): Promise<void> {
    if (!this.currentTable) {
      this.currentTable = await this.requestStateFromUI();
    }

    if (!this.currentTable) {
      return;
    }

    // Validate required agentName field
    const agentName = this.validateRequiredString(
      data.agentName,
      'agent name',
      DataStudioExecutor.MAX_NAME_LENGTH,
    );
    if (agentName === null) {
      return; // Invalid input, abort
    }

    // Validate queryTemplate (required)
    const queryTemplate = this.validateRequiredString(
      data.queryTemplate,
      'query template',
    );
    if (queryTemplate === null) {
      return; // Invalid input, abort
    }

    // Validate output columns
    const outputColumns = this.validateOutputColumns(data.outputColumns);

    const agentGroup: AgentGroup = {
      id: `ag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      agentName,
      queryTemplate,
      outputColumns,
    };

    this.currentTable.agentGroups.push(agentGroup);

    // Initialize results for this agent group with pending status for all entities
    for (const entity of this.currentTable.entities) {
      if (!this.currentTable.results[entity.id]) {
        this.currentTable.results[entity.id] = {};
      }
      this.currentTable.results[entity.id][agentGroup.id] = {status: 'pending'};
    }

    await this.storage.saveTable(this.currentTable);
  }

  /**
   * Remove an agent group from the current table
   */
  private async handleRemoveAgentGroup(agentGroupId: string): Promise<void> {
    if (!this.currentTable) {
      return;
    }

    this.currentTable.agentGroups = this.currentTable.agentGroups.filter(
      ag => ag.id !== agentGroupId,
    );

    // Remove results for this agent group
    for (const entityId of Object.keys(this.currentTable.results)) {
      delete this.currentTable.results[entityId][agentGroupId];
    }

    await this.storage.saveTable(this.currentTable);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

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

  /**
   * Load available agents for the UI dropdown
   */
  private async loadAvailableAgents(): Promise<Array<{name: string; description: string}>> {
    try {
      const agentStorage = AgentStorageManager.getInstance();
      const customAgents = await agentStorage.getAllAgents();

      // Get custom agents
      const agents = customAgents.map(agent => ({
        name: agent.name,
        description: agent.description,
      }));

      // Add built-in agents
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

  /**
   * Reset the singleton instance (for testing)
   */
  static reset(): void {
    if (DataStudioExecutor.instance) {
      DataStudioExecutor.instance.unregisterApp();
    }
    DataStudioExecutor.instance = null;
  }
}
