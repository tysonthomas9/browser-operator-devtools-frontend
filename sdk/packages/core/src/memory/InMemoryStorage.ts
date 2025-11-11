// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * In-memory storage adapter for agent memory
 *
 * Simple, fast storage that keeps messages in memory.
 * Data is lost when the page reloads.
 */

import type {
  MemoryStorage,
  MemoryMessage,
  MemoryGetOptions,
  MemorySearchOptions,
} from './types.js';

/**
 * In-memory storage implementation
 *
 * @example
 * ```typescript
 * const storage = new InMemoryStorage();
 * await storage.add({ role: 'user', content: 'Hello!' });
 * const messages = await storage.getAll();
 * ```
 */
export class InMemoryStorage implements MemoryStorage {
  private messages: MemoryMessage[] = [];

  /**
   * Add a message to storage
   */
  async add(message: MemoryMessage): Promise<void> {
    this.messages.push({ ...message });
  }

  /**
   * Get all messages
   */
  async getAll(): Promise<MemoryMessage[]> {
    return [...this.messages];
  }

  /**
   * Get messages with filtering
   */
  async get(options?: MemoryGetOptions): Promise<MemoryMessage[]> {
    let filtered = [...this.messages];

    // Filter by role
    if (options?.role) {
      filtered = filtered.filter((msg) => msg.role === options.role);
    }

    // Filter by timestamp range
    if (options?.since) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? 0) >= options.since!);
    }
    if (options?.until) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? Infinity) <= options.until!);
    }

    // Apply offset
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }

    // Apply limit
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Search messages by content
   */
  async search(query: string, options?: MemorySearchOptions): Promise<MemoryMessage[]> {
    const normalizedQuery = options?.caseSensitive ? query : query.toLowerCase();

    let filtered = this.messages.filter((msg) => {
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
    this.messages = [];
  }

  /**
   * Get number of messages
   */
  async count(): Promise<number> {
    return this.messages.length;
  }

  /**
   * Get messages (for testing/debugging)
   */
  getMessagesSync(): MemoryMessage[] {
    return [...this.messages];
  }
}
