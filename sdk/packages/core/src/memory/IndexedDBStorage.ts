// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/// <reference lib="dom" />

/**
 * IndexedDB storage adapter for agent memory
 *
 * Persistent storage that survives page reloads.
 * Best for production use in browser environments.
 */

import type {
  MemoryStorage,
  MemoryMessage,
  MemoryGetOptions,
  MemorySearchOptions,
} from './types.js';

/**
 * IndexedDB storage implementation
 *
 * @example
 * ```typescript
 * const storage = new IndexedDBStorage('my-agent-memory');
 * await storage.add({ role: 'user', content: 'Hello!' });
 * const messages = await storage.getAll();
 * ```
 */
export class IndexedDBStorage implements MemoryStorage {
  private dbName: string;
  private storeName: string = 'messages';
  private version: number = 1;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName: string = 'browser-operator-memory') {
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
            keyPath: 'id',
            autoIncrement: true,
          });

          // Create indices for common queries
          objectStore.createIndex('role', 'role', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Add a message to storage
   */
  async add(message: MemoryMessage): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);

      // Ensure timestamp is set
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp ?? Date.now(),
      };

      const request = objectStore.add(messageWithTimestamp);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add message: ${request.error?.message}`));
    });
  }

  /**
   * Get all messages
   */
  async getAll(): Promise<MemoryMessage[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        // Remove the id field added by IndexedDB
        const messages = request.result.map(({ id, ...msg }: any) => msg);
        resolve(messages);
      };

      request.onerror = () => reject(new Error(`Failed to get messages: ${request.error?.message}`));
    });
  }

  /**
   * Get messages with filtering
   */
  async get(options?: MemoryGetOptions): Promise<MemoryMessage[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);

      // Use index if filtering by role or timestamp
      let request: IDBRequest;
      if (options?.role) {
        const index = objectStore.index('role');
        request = index.getAll(options.role);
      } else if (options?.since || options?.until) {
        const index = objectStore.index('timestamp');
        const range = IDBKeyRange.bound(
          options.since ?? 0,
          options.until ?? Date.now() + 1000000,
          false,
          false
        );
        request = index.getAll(range);
      } else {
        request = objectStore.getAll();
      }

      request.onsuccess = () => {
        let messages = request.result.map(({ id, ...msg }: any) => msg);

        // Apply additional filters
        if (options?.since) {
          messages = messages.filter((msg: MemoryMessage) => (msg.timestamp ?? 0) >= options.since!);
        }

        if (options?.until) {
          messages = messages.filter(
            (msg: MemoryMessage) => (msg.timestamp ?? Infinity) <= options.until!
          );
        }

        // Apply offset
        if (options?.offset) {
          messages = messages.slice(options.offset);
        }

        // Apply limit
        if (options?.limit) {
          messages = messages.slice(0, options.limit);
        }

        resolve(messages);
      };

      request.onerror = () => reject(new Error(`Failed to get messages: ${request.error?.message}`));
    });
  }

  /**
   * Search messages by content
   */
  async search(query: string, options?: MemorySearchOptions): Promise<MemoryMessage[]> {
    // IndexedDB doesn't have full-text search, so we get all messages and filter
    const allMessages = await this.getAll();

    const normalizedQuery = options?.caseSensitive ? query : query.toLowerCase();

    let filtered = allMessages.filter((msg) => {
      // Search in content
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const normalizedContent = options?.caseSensitive ? content : content.toLowerCase();

      if (normalizedContent.includes(normalizedQuery)) {
        return true;
      }

      // Search in metadata if enabled
      if (options?.searchMetadata && msg.metadata) {
        const metadata = JSON.stringify(msg.metadata);
        const normalizedMetadata = options?.caseSensitive ? metadata : metadata.toLowerCase();
        if (normalizedMetadata.includes(normalizedQuery)) {
          return true;
        }
      }

      return false;
    });

    // Apply additional filters
    if (options?.role) {
      filtered = filtered.filter((msg) => msg.role === options.role);
    }

    if (options?.since) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? 0) >= options.since!);
    }

    if (options?.until) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? Infinity) <= options.until!);
    }

    // Apply offset and limit
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Clear all messages
   */
  async clear(): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear messages: ${request.error?.message}`));
    });
  }

  /**
   * Get number of messages
   */
  async count(): Promise<number> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count messages: ${request.error?.message}`));
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
