// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from './Logger.js';

const logger = createLogger('ToolStorageManager');

const DATABASE_NAME = 'tool_studio_db';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'customTools';
const INDEX_NAME = 'name';

/**
 * Schema property definition for tool input
 */
export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: { type: string };
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

/**
 * UI configuration for displaying a tool
 */
export interface ToolUIConfig {
  displayName: string;
  icon: string;  // Emoji or icon identifier
  color: string;
  backgroundColor: string;
}

/**
 * External library dependency
 */
export interface ToolDependency {
  name: string;       // Human-readable name (e.g., "Lodash")
  url: string;        // CDN URL
  globalName: string; // Global variable to check (e.g., "_" for Lodash)
}

/**
 * Stored tool configuration in IndexedDB
 */
export interface StoredToolConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  /**
   * JavaScript code to execute when the tool is called.
   * Has access to:
   * - `args`: The arguments passed to the tool (validated against schema)
   * - `ctx`: LLMContext with provider, model info
   * Returns: Promise<any> - the result to return to the agent
   */
  code: string;
  /**
   * JSON Schema for tool input validation
   */
  schema: {
    type: string;
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
  ui: ToolUIConfig;
  isBuiltIn: false;
  /**
   * Timeout in milliseconds for code execution (default: 10000, max: 30000)
   */
  timeout: number;
  /**
   * Whether the tool has access to the page context (DOM, etc.)
   */
  hasPageAccess: boolean;
  /**
   * External libraries to load before code execution
   */
  dependencies: ToolDependency[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new tool (without auto-generated fields)
 */
export type CreateToolInput = Omit<StoredToolConfig, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>;

/**
 * Input for updating an existing tool
 */
export type UpdateToolInput = Partial<Omit<StoredToolConfig, 'id' | 'createdAt' | 'isBuiltIn'>>;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Preset CDN libraries for quick add
 */
export const PRESET_LIBRARIES: ToolDependency[] = [
  {
    name: 'Lodash',
    url: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js',
    globalName: '_',
  },
  {
    name: 'jQuery',
    url: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
    globalName: '$',
  },
  {
    name: 'Day.js',
    url: 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js',
    globalName: 'dayjs',
  },
  {
    name: 'Marked',
    url: 'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js',
    globalName: 'marked',
  },
  {
    name: 'DOMPurify',
    url: 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js',
    globalName: 'DOMPurify',
  },
  {
    name: 'Chart.js',
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    globalName: 'Chart',
  },
  {
    name: 'Axios',
    url: 'https://cdn.jsdelivr.net/npm/axios@1.6.5/dist/axios.min.js',
    globalName: 'axios',
  },
];

/**
 * Manages IndexedDB-backed storage for custom tool configurations.
 * Follows singleton pattern for consistent state across the application.
 */
export class ToolStorageManager {
  private static instance: ToolStorageManager | null = null;

  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    logger.info('Initialized ToolStorageManager');
  }

  static getInstance(): ToolStorageManager {
    if (!ToolStorageManager.instance) {
      ToolStorageManager.instance = new ToolStorageManager();
    }
    return ToolStorageManager.instance;
  }

  /**
   * Create a new custom tool
   */
  async createTool(input: CreateToolInput): Promise<StoredToolConfig> {
    const validation = this.validateToolConfig(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid tool configuration');
    }

    const db = await this.ensureDatabase();

    // Check for name conflicts
    if (await this.toolNameExists(input.name)) {
      throw new Error(`Tool with name "${input.name}" already exists.`);
    }

    const now = new Date().toISOString();
    const tool: StoredToolConfig = {
      ...input,
      id: this.generateUUID(),
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.add(tool));
    await this.transactionComplete(transaction);

    logger.info('Created custom tool', { name: tool.name, id: tool.id });
    return tool;
  }

  /**
   * Get a tool by ID
   */
  async getTool(id: string): Promise<StoredToolConfig | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const tool = await this.requestToPromise<StoredToolConfig | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return tool || null;
  }

  /**
   * Get a tool by name
   */
  async getToolByName(name: string): Promise<StoredToolConfig | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const index = store.index(INDEX_NAME);

    const tool = await this.requestToPromise<StoredToolConfig | undefined>(index.get(name));
    await this.transactionComplete(transaction);

    return tool || null;
  }

  /**
   * Get all custom tools
   */
  async getAllTools(): Promise<StoredToolConfig[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const tools = await this.requestToPromise<StoredToolConfig[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by creation date (newest first)
    return (tools || []).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update an existing tool
   */
  async updateTool(id: string, updates: UpdateToolInput): Promise<StoredToolConfig> {
    const db = await this.ensureDatabase();
    const existing = await this.getTool(id);

    if (!existing) {
      throw new Error(`Tool with ID "${id}" not found.`);
    }

    // If name is being changed, check for conflicts
    if (updates.name && updates.name !== existing.name) {
      if (await this.toolNameExists(updates.name)) {
        throw new Error(`Tool with name "${updates.name}" already exists.`);
      }
    }

    const updated: StoredToolConfig = {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID cannot be changed
      isBuiltIn: false, // Ensure isBuiltIn cannot be changed
      createdAt: existing.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date().toISOString(),
    };

    const validation = this.validateToolConfig(updated);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid tool configuration');
    }

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated custom tool', { name: updated.name, id: updated.id });
    return updated;
  }

  /**
   * Delete a tool by ID
   */
  async deleteTool(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getTool(id);

    if (!existing) {
      throw new Error(`Tool with ID "${id}" not found.`);
    }

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.delete(id));
    await this.transactionComplete(transaction);

    logger.info('Deleted custom tool', { name: existing.name, id });
  }

  /**
   * Check if a tool name already exists
   */
  async toolNameExists(name: string): Promise<boolean> {
    const tool = await this.getToolByName(name);
    return tool !== null;
  }

  /**
   * Export all tools as JSON array
   */
  async exportTools(): Promise<StoredToolConfig[]> {
    return this.getAllTools();
  }

  /**
   * Import tools from JSON array
   * Skips tools with conflicting names
   */
  async importTools(configs: StoredToolConfig[]): Promise<{ imported: number; skipped: string[] }> {
    const skipped: string[] = [];
    let imported = 0;

    for (const config of configs) {
      try {
        // Create a new tool with the imported config (generates new ID)
        const input: CreateToolInput = {
          name: config.name,
          description: config.description,
          version: config.version,
          code: config.code,
          schema: config.schema,
          ui: config.ui,
          timeout: config.timeout,
          hasPageAccess: config.hasPageAccess,
          dependencies: config.dependencies || [],
        };

        await this.createTool(input);
        imported++;
      } catch (error) {
        logger.warn(`Skipped importing tool "${config.name}":`, error);
        skipped.push(config.name);
      }
    }

    logger.info('Import complete', { imported, skipped: skipped.length });
    return { imported, skipped };
  }

  /**
   * Validate tool configuration
   */
  private validateToolConfig(config: Partial<StoredToolConfig>): ValidationResult {
    // Name validation
    if (!config.name || !config.name.trim()) {
      return { valid: false, error: 'Tool name cannot be empty.' };
    }

    // Name format: lowercase, hyphens, underscores only
    if (!/^[a-z][a-z0-9_-]*$/.test(config.name)) {
      return {
        valid: false,
        error: 'Tool name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores.'
      };
    }

    if (config.name.length > 64) {
      return { valid: false, error: 'Tool name must be 64 characters or fewer.' };
    }

    // Description validation
    if (!config.description || !config.description.trim()) {
      return { valid: false, error: 'Description cannot be empty.' };
    }

    // Code validation
    if (!config.code || !config.code.trim()) {
      return { valid: false, error: 'JavaScript code cannot be empty.' };
    }

    // Note: We don't validate JavaScript syntax here because:
    // 1. DevTools CSP blocks new Function() and eval()
    // 2. Syntax errors will be caught at execution time via CDP Runtime.evaluate
    //    which runs in the inspected page's context (not DevTools)

    // Timeout validation
    if (config.timeout !== undefined) {
      if (!Number.isInteger(config.timeout) || config.timeout < 1000 || config.timeout > 30000) {
        return { valid: false, error: 'Timeout must be an integer between 1000 and 30000 milliseconds.' };
      }
    }

    // Schema validation
    if (!config.schema || config.schema.type !== 'object') {
      return { valid: false, error: 'Schema must have type "object".' };
    }

    // Dependencies validation
    if (config.dependencies) {
      for (const dep of config.dependencies) {
        if (!dep.name || !dep.url || !dep.globalName) {
          return { valid: false, error: 'Each dependency must have name, url, and globalName.' };
        }
        if (!dep.url.startsWith('https://')) {
          return { valid: false, error: `Dependency URL must use HTTPS: ${dep.url}` };
        }
      }
    }

    return { valid: true };
  }

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
      logger.error('Failed to open IndexedDB database', { error });
      throw error;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        logger.info('Initializing tool storage database');

        if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          const store = db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
          store.createIndex(INDEX_NAME, 'name', { unique: true });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        logger.warn('Tool storage database open request was blocked.');
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

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return template.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
