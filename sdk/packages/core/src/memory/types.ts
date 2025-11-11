// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Memory system types for agent conversation history and context management
 *
 * Following patterns from Mastra AI and similar agent frameworks
 */

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Memory message structure
 */
export interface MemoryMessage {
  /**
   * Message role
   */
  role: MessageRole;

  /**
   * Message content
   */
  content: string | Array<{ type: string; text?: string; image_url?: string }>;

  /**
   * Optional message name (for tool messages)
   */
  name?: string;

  /**
   * Tool call ID (for tool messages)
   */
  tool_call_id?: string;

  /**
   * Timestamp when message was created
   */
  timestamp?: number;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Memory storage interface
 *
 * Defines how messages are stored and retrieved
 */
export interface MemoryStorage {
  /**
   * Add a message to storage
   */
  add(message: MemoryMessage): Promise<void>;

  /**
   * Get all messages
   */
  getAll(): Promise<MemoryMessage[]>;

  /**
   * Get messages with optional filtering
   */
  get(options?: MemoryGetOptions): Promise<MemoryMessage[]>;

  /**
   * Search messages by content or metadata
   */
  search?(query: string, options?: MemorySearchOptions): Promise<MemoryMessage[]>;

  /**
   * Clear all messages
   */
  clear(): Promise<void>;

  /**
   * Get number of messages
   */
  count(): Promise<number>;
}

/**
 * Options for retrieving messages
 */
export interface MemoryGetOptions {
  /**
   * Limit number of messages
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Filter by role
   */
  role?: MessageRole;

  /**
   * Filter by timestamp range
   */
  since?: number;
  until?: number;
}

/**
 * Options for searching messages
 */
export interface MemorySearchOptions extends MemoryGetOptions {
  /**
   * Search in metadata fields
   */
  searchMetadata?: boolean;

  /**
   * Case sensitive search
   */
  caseSensitive?: boolean;
}

/**
 * Memory configuration options
 */
export interface MemoryConfig {
  /**
   * Storage adapter to use
   */
  storage: MemoryStorage;

  /**
   * Maximum number of messages to keep
   * Older messages will be removed
   */
  maxMessages?: number;

  /**
   * Maximum age of messages in milliseconds
   * Messages older than this will be removed
   */
  maxAge?: number;

  /**
   * Whether to automatically add timestamps
   */
  autoTimestamp?: boolean;
}

/**
 * Memory context for LLM
 */
export interface MemoryContext {
  /**
   * Messages to include in context
   */
  messages: MemoryMessage[];

  /**
   * Total token count estimate (optional)
   */
  tokenCount?: number;

  /**
   * Summary of older messages (optional)
   */
  summary?: string;
}
