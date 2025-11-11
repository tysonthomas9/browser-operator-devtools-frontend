// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Conversation buffer memory for agents
 *
 * Manages conversation history with configurable limits and storage
 */

import type {
  MemoryConfig,
  MemoryMessage,
  MemoryContext,
  MemoryGetOptions,
  MessageRole,
} from './types.js';
import { InMemoryStorage } from './InMemoryStorage.js';

/**
 * Conversation buffer memory
 *
 * Stores and manages conversation history for agents.
 * Supports multiple storage adapters and automatic cleanup.
 *
 * @example
 * ```typescript
 * import { ConversationBufferMemory } from '@browser-operator/core/memory';
 *
 * const memory = new ConversationBufferMemory({
 *   maxMessages: 100,
 *   maxAge: 24 * 60 * 60 * 1000, // 24 hours
 * });
 *
 * // Add messages
 * await memory.addMessage('user', 'Hello!');
 * await memory.addMessage('assistant', 'Hi! How can I help?');
 *
 * // Get context for LLM
 * const context = await memory.getContext();
 * const messages = context.messages;
 * ```
 */
export class ConversationBufferMemory {
  private storage: MemoryConfig['storage'];
  private maxMessages?: number;
  private maxAge?: number;
  private autoTimestamp: boolean;

  constructor(config?: Partial<MemoryConfig>) {
    this.storage = config?.storage ?? new InMemoryStorage();
    this.maxMessages = config?.maxMessages;
    this.maxAge = config?.maxAge;
    this.autoTimestamp = config?.autoTimestamp ?? true;
  }

  /**
   * Add a message to memory
   *
   * @example
   * ```typescript
   * await memory.addMessage('user', 'What is 2+2?');
   * await memory.addMessage('assistant', 'The answer is 4.');
   * ```
   */
  async addMessage(
    role: MessageRole,
    content: string | Array<{ type: string; text?: string; image_url?: string }>,
    options?: {
      name?: string;
      tool_call_id?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const message: MemoryMessage = {
      role,
      content,
      name: options?.name,
      tool_call_id: options?.tool_call_id,
      metadata: options?.metadata,
      timestamp: this.autoTimestamp ? Date.now() : undefined,
    };

    await this.storage.add(message);

    // Clean up old messages if needed
    await this.cleanup();
  }

  /**
   * Add a raw message object
   *
   * @example
   * ```typescript
   * await memory.add({
   *   role: 'user',
   *   content: 'Hello',
   *   metadata: { source: 'web' }
   * });
   * ```
   */
  async add(message: MemoryMessage): Promise<void> {
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp ?? (this.autoTimestamp ? Date.now() : undefined),
    };

    await this.storage.add(messageWithTimestamp);
    await this.cleanup();
  }

  /**
   * Get all messages
   */
  async getAll(): Promise<MemoryMessage[]> {
    return this.storage.getAll();
  }

  /**
   * Get messages with filtering
   *
   * @example
   * ```typescript
   * // Get last 10 messages
   * const recent = await memory.get({ limit: 10 });
   *
   * // Get only user messages
   * const userMessages = await memory.get({ role: 'user' });
   *
   * // Get messages from last hour
   * const lastHour = await memory.get({
   *   since: Date.now() - 60 * 60 * 1000
   * });
   * ```
   */
  async get(options?: MemoryGetOptions): Promise<MemoryMessage[]> {
    return this.storage.get(options);
  }

  /**
   * Search messages by content
   *
   * @example
   * ```typescript
   * const results = await memory.search('error', {
   *   role: 'assistant',
   *   limit: 5
   * });
   * ```
   */
  async search(query: string, options?: MemoryGetOptions): Promise<MemoryMessage[]> {
    if (!this.storage.search) {
      throw new Error('Storage adapter does not support search');
    }
    return this.storage.search(query, options);
  }

  /**
   * Get memory context for LLM
   *
   * Returns messages formatted for agent/LLM use with optional limits.
   *
   * @example
   * ```typescript
   * const context = await memory.getContext({ limit: 50 });
   * const messages = context.messages;
   *
   * // Use with agent
   * const response = await agent.generateText({
   *   messages: context.messages,
   *   prompt: 'Continue the conversation'
   * });
   * ```
   */
  async getContext(options?: { limit?: number; includeSystem?: boolean }): Promise<MemoryContext> {
    let messages = await this.getAll();

    // Filter out system messages if requested
    if (options?.includeSystem === false) {
      messages = messages.filter((msg) => msg.role !== 'system');
    }

    // Apply limit (most recent messages)
    if (options?.limit) {
      messages = messages.slice(-options.limit);
    }

    return {
      messages,
      tokenCount: this.estimateTokenCount(messages),
    };
  }

  /**
   * Get formatted messages for OpenAI-style API
   *
   * Converts memory messages to the format expected by OpenAI and compatible APIs.
   *
   * @example
   * ```typescript
   * const messages = await memory.getMessages();
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-4',
   *   messages: messages
   * });
   * ```
   */
  async getMessages(options?: { limit?: number; includeSystem?: boolean }): Promise<MemoryMessage[]> {
    const context = await this.getContext(options);
    return context.messages;
  }

  /**
   * Clear all messages
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Get number of messages in memory
   */
  async count(): Promise<number> {
    return this.storage.count();
  }

  /**
   * Clean up old messages based on limits
   */
  private async cleanup(): Promise<void> {
    const messages = await this.getAll();

    // Check if cleanup is needed
    const needsCleanup =
      (this.maxMessages && messages.length > this.maxMessages) ||
      (this.maxAge && messages.some((msg) => msg.timestamp && Date.now() - msg.timestamp > this.maxAge!));

    if (!needsCleanup) {
      return;
    }

    // Filter messages
    let filtered = messages;

    // Remove messages older than maxAge
    if (this.maxAge) {
      const cutoff = Date.now() - this.maxAge;
      filtered = filtered.filter((msg) => !msg.timestamp || msg.timestamp >= cutoff);
    }

    // Keep only maxMessages most recent messages
    if (this.maxMessages && filtered.length > this.maxMessages) {
      filtered = filtered.slice(-this.maxMessages);
    }

    // If we removed messages, clear and re-add
    if (filtered.length < messages.length) {
      await this.storage.clear();
      for (const msg of filtered) {
        await this.storage.add(msg);
      }
    }
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  private estimateTokenCount(messages: MemoryMessage[]): number {
    let count = 0;

    for (const msg of messages) {
      // Add role tokens
      count += 4; // ~4 tokens per message overhead

      // Add content tokens
      if (typeof msg.content === 'string') {
        // Rough estimate: 1 token per 4 characters
        count += Math.ceil(msg.content.length / 4);
      } else {
        // For multimodal content, estimate based on text parts
        for (const part of msg.content) {
          if (part.text) {
            count += Math.ceil(part.text.length / 4);
          }
          if (part.image_url) {
            count += 85; // Rough estimate for image tokens
          }
        }
      }
    }

    return count;
  }

  /**
   * Create a summary of the conversation
   *
   * Useful for creating compressed context when memory is full.
   *
   * @example
   * ```typescript
   * const summary = await memory.summarize();
   * console.log(summary);
   * // "Conversation started with greeting. User asked about..."
   * ```
   */
  async summarize(): Promise<string> {
    const messages = await this.getAll();

    if (messages.length === 0) {
      return 'No messages in conversation.';
    }

    // Simple summarization - could be enhanced with LLM in the future
    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    const assistantMessages = messages.filter((m) => m.role === 'assistant').length;

    const firstMessage = messages[0]!;
    const lastMessage = messages[messages.length - 1]!;

    return `Conversation with ${messageCount} messages (${userMessages} from user, ${assistantMessages} from assistant). Started with: "${typeof firstMessage.content === 'string' ? firstMessage.content.slice(0, 50) : '[multimodal]'}...". Latest: "${typeof lastMessage.content === 'string' ? lastMessage.content.slice(0, 50) : '[multimodal]'}..."`;
  }

  /**
   * Get storage adapter
   */
  getStorage(): MemoryConfig['storage'] {
    return this.storage;
  }

  /**
   * Get configuration
   */
  getConfig(): { maxMessages?: number; maxAge?: number; autoTimestamp: boolean } {
    return {
      maxMessages: this.maxMessages,
      maxAge: this.maxAge,
      autoTimestamp: this.autoTimestamp,
    };
  }
}
