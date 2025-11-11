// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Memory system for Browser Operator SDK
 *
 * Provides conversation history management and context for agents.
 *
 * @example Basic usage
 * ```typescript
 * import { ConversationBufferMemory } from '@browser-operator/core/memory';
 *
 * const memory = new ConversationBufferMemory({
 *   maxMessages: 100
 * });
 *
 * await memory.addMessage('user', 'Hello!');
 * await memory.addMessage('assistant', 'Hi! How can I help?');
 *
 * const messages = await memory.getMessages();
 * ```
 *
 * @example With persistent storage
 * ```typescript
 * import {
 *   ConversationBufferMemory,
 *   IndexedDBStorage
 * } from '@browser-operator/core/memory';
 *
 * const storage = new IndexedDBStorage('my-agent');
 * const memory = new ConversationBufferMemory({ storage });
 *
 * await memory.addMessage('user', 'Hello!');
 *
 * // Messages persist across page reloads
 * ```
 *
 * @example With message limits
 * ```typescript
 * const memory = new ConversationBufferMemory({
 *   maxMessages: 50,           // Keep last 50 messages
 *   maxAge: 24 * 60 * 60 * 1000 // Delete messages older than 24h
 * });
 * ```
 */

// Main memory class
export { ConversationBufferMemory } from './ConversationBufferMemory.js';

// Storage adapters
export { InMemoryStorage } from './InMemoryStorage.js';
export { IndexedDBStorage } from './IndexedDBStorage.js';

// Types
export type {
  MemoryMessage,
  MemoryStorage,
  MemoryConfig,
  MemoryContext,
  MemoryGetOptions,
  MemorySearchOptions,
  MessageRole,
} from './types.js';
