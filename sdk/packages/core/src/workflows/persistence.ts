// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/// <reference lib="dom" />

/**
 * Workflow persistence system for suspend/resume functionality
 *
 * Enables workflows to save their state and resume execution later,
 * supporting long-running workflows and human-in-the-loop patterns.
 */

/**
 * Workflow checkpoint for suspend/resume
 *
 * Contains all state needed to resume a workflow from a specific point
 */
export interface WorkflowCheckpoint<TState = unknown> {
  /**
   * Unique workflow execution ID
   */
  workflowId: string;

  /**
   * Index of the current node being executed
   */
  nodeIndex: number;

  /**
   * Current workflow state
   */
  state: TState;

  /**
   * Results from completed steps (keyed by step ID)
   */
  stepResults: Record<string, unknown>;

  /**
   * Initial workflow input
   */
  initialInput: unknown;

  /**
   * Timestamp when checkpoint was created
   */
  timestamp: number;

  /**
   * Optional metadata for debugging/tracking
   */
  metadata?: Record<string, unknown>;
}

/**
 * Storage adapter interface for workflow persistence
 *
 * Implementations can use different storage backends:
 * - InMemory (for development/testing)
 * - IndexedDB (for browser persistence)
 * - LocalStorage (for simple browser storage)
 * - External APIs (for server-side persistence)
 */
export interface WorkflowStorage {
  /**
   * Save a workflow checkpoint
   */
  save(checkpoint: WorkflowCheckpoint): Promise<void>;

  /**
   * Load a workflow checkpoint by ID
   */
  load(workflowId: string): Promise<WorkflowCheckpoint | null>;

  /**
   * Delete a workflow checkpoint
   */
  delete(workflowId: string): Promise<void>;

  /**
   * List all checkpoint IDs (optional)
   */
  list?(): Promise<string[]>;
}

/**
 * In-memory storage adapter (default)
 *
 * Stores checkpoints in memory. Data is lost when page reloads.
 * Suitable for development, testing, and short-lived workflows.
 *
 * @example
 * ```typescript
 * const storage = new InMemoryWorkflowStorage();
 * await storage.save(checkpoint);
 * const loaded = await storage.load(workflowId);
 * ```
 */
export class InMemoryWorkflowStorage implements WorkflowStorage {
  private checkpoints: Map<string, WorkflowCheckpoint> = new Map();

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.workflowId, checkpoint);
  }

  async load(workflowId: string): Promise<WorkflowCheckpoint | null> {
    return this.checkpoints.get(workflowId) || null;
  }

  async delete(workflowId: string): Promise<void> {
    this.checkpoints.delete(workflowId);
  }

  async list(): Promise<string[]> {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Clear all checkpoints (useful for testing)
   */
  clear(): void {
    this.checkpoints.clear();
  }
}

/**
 * IndexedDB storage adapter for browser persistence
 *
 * Stores checkpoints in IndexedDB for persistence across page reloads.
 * Suitable for production use in browser environments.
 *
 * @example
 * ```typescript
 * const storage = new IndexedDBWorkflowStorage('my-app-workflows');
 * await storage.save(checkpoint);
 * const loaded = await storage.load(workflowId);
 * ```
 */
export class IndexedDBWorkflowStorage implements WorkflowStorage {
  private dbName: string;
  private storeName: string = 'workflow_checkpoints';
  private version: number = 1;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName: string = 'browser-operator-workflows') {
    this.dbName = dbName;
  }

  /**
   * Initialize IndexedDB connection
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'workflowId',
          });

          // Create index on timestamp for time-based queries
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(checkpoint);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save checkpoint: ${request.error?.message}`));
    });
  }

  async load(workflowId: string): Promise<WorkflowCheckpoint | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(workflowId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to load checkpoint: ${request.error?.message}`));
    });
  }

  async delete(workflowId: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(workflowId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete checkpoint: ${request.error?.message}`));
    });
  }

  async list(): Promise<string[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error(`Failed to list checkpoints: ${request.error?.message}`));
    });
  }

  /**
   * Clear all checkpoints (useful for cleanup/testing)
   */
  async clear(): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear checkpoints: ${request.error?.message}`));
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.dbPromise) {
      this.dbPromise.then((db) => db.close());
      this.dbPromise = null;
    }
  }
}

/**
 * LocalStorage adapter for simple browser persistence
 *
 * Stores checkpoints in localStorage. Limited to ~5-10MB per domain.
 * Suitable for simple workflows with small state.
 *
 * @example
 * ```typescript
 * const storage = new LocalStorageWorkflowStorage('my-app');
 * await storage.save(checkpoint);
 * const loaded = await storage.load(workflowId);
 * ```
 */
export class LocalStorageWorkflowStorage implements WorkflowStorage {
  private prefix: string;

  constructor(prefix: string = 'workflow_') {
    this.prefix = prefix;
  }

  private getKey(workflowId: string): string {
    return `${this.prefix}${workflowId}`;
  }

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    try {
      const key = this.getKey(checkpoint.workflowId);
      const serialized = JSON.stringify(checkpoint);
      localStorage.setItem(key, serialized);
    } catch (error) {
      throw new Error(
        `Failed to save checkpoint to localStorage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async load(workflowId: string): Promise<WorkflowCheckpoint | null> {
    try {
      const key = this.getKey(workflowId);
      const serialized = localStorage.getItem(key);

      if (!serialized) {
        return null;
      }

      return JSON.parse(serialized) as WorkflowCheckpoint;
    } catch (error) {
      throw new Error(
        `Failed to load checkpoint from localStorage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async delete(workflowId: string): Promise<void> {
    const key = this.getKey(workflowId);
    localStorage.removeItem(key);
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }

    return keys;
  }

  /**
   * Clear all workflow checkpoints
   */
  async clear(): Promise<void> {
    const keys = await this.list();
    for (const workflowId of keys) {
      await this.delete(workflowId);
    }
  }
}
