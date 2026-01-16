// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {createLogger} from '../../core/Logger.js';

const logger = createLogger('DataStudioStorage');

const DATABASE_NAME = 'data_studio_v2_db';
const DATABASE_VERSION = 1;
const TABLES_STORE = 'tables';

/**
 * Table index entry for listing tables
 */
export interface TableIndexEntry {
  id: string;
  name: string;
  entityType: string;
  entityCount: number;
  agentGroupCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Entity in a Data Studio table
 */
export interface Entity {
  id: string;
  name: string;
  context?: string;
}

/**
 * Output column definition
 */
export interface OutputColumn {
  id: string;
  key: string;
  label: string;
}

export type LLMProviderType = 'openai' | 'cerebras' | 'anthropic' | 'groq';

/**
 * Inline agent configuration (embedded in AgentGroup)
 */
export interface InlineAgentConfig {
  name: string;           // Internal name (e.g., "company_summary_agent")
  displayName: string;    // Display name in UI
  description: string;    // What the agent does
  systemPrompt: string;   // Custom system prompt
  tools: string[];        // List of tool names (e.g., ["navigate_url", "extract_data"])
  maxIterations?: number; // Default: 10
  temperature?: number;   // Default: 0.7
  provider?: LLMProviderType;  // LLM provider (default: server default)
  model?: string;              // LLM model (default: server default)
}

/**
 * Agent group (column) configuration
 * Must have EITHER agentName OR inlineAgent, not both
 */
export interface AgentGroup {
  id: string;
  agentName?: string;              // Optional - for referenced agents
  inlineAgent?: InlineAgentConfig; // Optional - for inline agents
  queryTemplate: string;
  outputColumns: OutputColumn[];
}

/**
 * Result for a single cell (entity × agent group)
 */
export interface CellResult {
  status: 'pending' | 'running' | 'completed' | 'error';
  values?: Record<string, string>;
  error?: string;
  timestamp?: string;
  executionTimeMs?: number;
}

/**
 * Complete Data Studio table state
 */
export interface DataStudioTable {
  tableId: string;
  tableName: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
  executionStatus: 'idle' | 'running' | 'paused';
  createdAt: string;
  updatedAt: string;
}

/**
 * DataStudioStorage - IndexedDB storage for Data Studio v2 tables
 *
 * Provides persistent storage for tables, entities, agent groups, and results.
 */
export class DataStudioStorage {
  private static instance: DataStudioStorage | null = null;

  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    logger.info('Initialized DataStudioStorage');
  }

  static getInstance(): DataStudioStorage {
    if (!DataStudioStorage.instance) {
      DataStudioStorage.instance = new DataStudioStorage();
    }
    return DataStudioStorage.instance;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Save a table (creates or updates)
   */
  async saveTable(table: DataStudioTable): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    const tableToStore = {
      ...table,
      updatedAt: new Date().toISOString(),
    };

    await this.requestToPromise(store.put(tableToStore));
    await this.transactionComplete(transaction);

    logger.debug(`Saved table: ${table.tableName} (${table.tableId})`);
  }

  /**
   * Load a table by ID
   */
  async loadTable(tableId: string): Promise<DataStudioTable | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readonly');
    const store = transaction.objectStore(TABLES_STORE);

    const table = await this.requestToPromise<DataStudioTable | undefined>(store.get(tableId));
    await this.transactionComplete(transaction);

    return table || null;
  }

  /**
   * List all tables (metadata only)
   */
  async listTables(): Promise<TableIndexEntry[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readonly');
    const store = transaction.objectStore(TABLES_STORE);

    const tables = await this.requestToPromise<DataStudioTable[]>(store.getAll());
    await this.transactionComplete(transaction);

    return (tables || []).map(table => ({
      id: table.tableId,
      name: table.tableName,
      entityType: table.entityType,
      entityCount: table.entities.length,
      agentGroupCount: table.agentGroups.length,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    }));
  }

  /**
   * Delete a table by ID
   */
  async deleteTable(tableId: string): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    await this.requestToPromise(store.delete(tableId));
    await this.transactionComplete(transaction);

    logger.info(`Deleted table: ${tableId}`);
  }

  /**
   * Update just the results for a table (for incremental saves during execution)
   *
   * Uses a single readwrite transaction to ensure atomicity.
   * This replaces the entire results object.
   */
  async updateResults(
    tableId: string,
    results: Record<string, Record<string, CellResult>>,
  ): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    // Read within the same transaction
    const table = await this.requestToPromise<DataStudioTable | undefined>(store.get(tableId));
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Modify
    table.results = results;
    table.updatedAt = new Date().toISOString();

    // Write within the same transaction
    await this.requestToPromise(store.put(table));
    await this.transactionComplete(transaction);

    logger.debug(`Updated results for table: ${tableId}`);
  }

  /**
   * Merge results into a table atomically (for concurrent agent updates)
   *
   * Unlike updateResults which replaces the entire results object,
   * this method merges updates at the entity/agent level, preserving
   * results from concurrent operations.
   *
   * Uses a single readwrite transaction to ensure atomicity.
   */
  async mergeResults(
    tableId: string,
    updates: Record<string, Record<string, CellResult>>,
  ): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    // Read within the same transaction
    const table = await this.requestToPromise<DataStudioTable | undefined>(store.get(tableId));
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Merge updates into existing results
    for (const [entityId, agentResults] of Object.entries(updates)) {
      if (!table.results[entityId]) {
        table.results[entityId] = {};
      }
      // Merge at the agent level
      for (const [agentId, cellResult] of Object.entries(agentResults)) {
        table.results[entityId][agentId] = cellResult;
      }
    }
    table.updatedAt = new Date().toISOString();

    // Write within the same transaction
    await this.requestToPromise(store.put(table));
    await this.transactionComplete(transaction);

    logger.debug(`Merged results for table: ${tableId} (${Object.keys(updates).length} entities)`);
  }

  /**
   * Update a single cell result atomically
   *
   * Optimized for updating one cell at a time during agent execution.
   * Uses a single readwrite transaction to ensure atomicity.
   */
  async updateCellResult(
    tableId: string,
    entityId: string,
    agentGroupId: string,
    result: CellResult,
  ): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    // Read within the same transaction
    const table = await this.requestToPromise<DataStudioTable | undefined>(store.get(tableId));
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Initialize nested objects if needed
    if (!table.results[entityId]) {
      table.results[entityId] = {};
    }

    // Update the specific cell
    table.results[entityId][agentGroupId] = result;
    table.updatedAt = new Date().toISOString();

    // Write within the same transaction
    await this.requestToPromise(store.put(table));
    await this.transactionComplete(transaction);

    logger.debug(`Updated cell result for table ${tableId}: ${entityId}/${agentGroupId}`);
  }

  /**
   * Update execution status for a table
   *
   * Uses a single readwrite transaction to ensure atomicity.
   */
  async updateExecutionStatus(
    tableId: string,
    status: 'idle' | 'running' | 'paused',
  ): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    // Read within the same transaction
    const table = await this.requestToPromise<DataStudioTable | undefined>(store.get(tableId));
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Modify
    table.executionStatus = status;
    table.updatedAt = new Date().toISOString();

    // Write within the same transaction
    await this.requestToPromise(store.put(table));
    await this.transactionComplete(transaction);

    logger.debug(`Updated execution status for table ${tableId}: ${status}`);
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableId: string): Promise<boolean> {
    const table = await this.loadTable(tableId);
    return table !== null;
  }

  /**
   * Clear all tables (for testing)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TABLES_STORE, 'readwrite');
    const store = transaction.objectStore(TABLES_STORE);

    await this.requestToPromise(store.clear());
    await this.transactionComplete(transaction);

    logger.info('Cleared all tables');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async ensureDatabase(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (!('indexedDB' in globalThis)) {
      throw new Error('IndexedDB is not supported in this environment.');
    }

    if (this.dbInitializationPromise) {
      this.db = await this.dbInitializationPromise;
      return this.db;
    }

    this.dbInitializationPromise = this.openDatabase();

    try {
      this.db = await this.dbInitializationPromise;
      return this.db;
    } catch (error) {
      this.dbInitializationPromise = null;
      logger.error('Failed to open IndexedDB database', {error});
      throw error;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        logger.info('Initializing Data Studio v2 storage database');

        if (!db.objectStoreNames.contains(TABLES_STORE)) {
          db.createObjectStore(TABLES_STORE, {keyPath: 'tableId'});
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        logger.warn('Data Studio storage database open request was blocked.');
      };
    });
  }

  private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static reset(): void {
    if (DataStudioStorage.instance?.db) {
      DataStudioStorage.instance.db.close();
    }
    DataStudioStorage.instance = null;
  }
}
