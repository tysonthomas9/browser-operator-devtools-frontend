// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {createLogger} from '../core/Logger.js';
import type {ConversationMetadata, StoredConversation} from './ConversationTypes.js';

const logger = createLogger('ConversationStorageManager');

const DATABASE_NAME = 'ai_chat_conversations';
const DATABASE_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';
const STORE_METADATA = 'conversation_metadata';
const INDEX_UPDATED_AT = 'updatedAt';
const INDEX_CREATED_AT = 'createdAt';

/**
 * Manages IndexedDB-backed conversation storage for the AI Chat panel.
 */
export class ConversationStorageManager {
  private static instance: ConversationStorageManager|null = null;

  private db: IDBDatabase|null = null;
  private dbInitializationPromise: Promise<IDBDatabase>|null = null;

  private constructor() {
    logger.info('Initialized ConversationStorageManager');
  }

  static getInstance(): ConversationStorageManager {
    if (!ConversationStorageManager.instance) {
      ConversationStorageManager.instance = new ConversationStorageManager();
    }
    return ConversationStorageManager.instance;
  }

  /**
   * Saves or updates a conversation
   */
  async saveConversation(conversation: StoredConversation): Promise<void> {
    const db = await this.ensureDatabase();

    // Update the updatedAt timestamp
    conversation.updatedAt = Date.now();

    const transaction = db.transaction([STORE_CONVERSATIONS, STORE_METADATA], 'readwrite');

    try {
      // Save full conversation
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      await this.requestToPromise(conversationsStore.put(conversation));

      // Save metadata for quick list view
      const metadata: ConversationMetadata = {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        preview: conversation.preview,
        messageCount: conversation.messageCount,
      };

      const metadataStore = transaction.objectStore(STORE_METADATA);
      await this.requestToPromise(metadataStore.put(metadata));

      await this.transactionComplete(transaction);

      logger.info('Saved conversation', {conversationId: conversation.id, title: conversation.title});
    } catch (error) {
      logger.error('Failed to save conversation', {error, conversationId: conversation.id});
      throw error;
    }
  }

  /**
   * Loads a conversation by ID
   */
  async loadConversation(id: string): Promise<StoredConversation|null> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction(STORE_CONVERSATIONS, 'readonly');
    const store = transaction.objectStore(STORE_CONVERSATIONS);

    try {
      const request = store.get(id);
      const conversation = await this.requestToPromise<StoredConversation|undefined>(request);
      await this.transactionComplete(transaction);

      if (conversation) {
        logger.info('Loaded conversation', {conversationId: id, title: conversation.title});
        return conversation;
      } else {
        logger.warn('Conversation not found', {conversationId: id});
        return null;
      }
    } catch (error) {
      logger.error('Failed to load conversation', {error, conversationId: id});
      throw error;
    }
  }

  /**
   * Lists all conversation metadata, sorted by most recently updated
   */
  async listConversations(): Promise<ConversationMetadata[]> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction(STORE_METADATA, 'readonly');
    const store = transaction.objectStore(STORE_METADATA);
    const index = store.index(INDEX_UPDATED_AT);

    try {
      const request = index.getAll();
      const conversations = await this.requestToPromise<ConversationMetadata[]>(request);
      await this.transactionComplete(transaction);

      // Sort by updatedAt descending (most recent first)
      const sorted = (conversations || []).sort((a, b) => b.updatedAt - a.updatedAt);

      logger.info('Listed conversations', {count: sorted.length});
      return sorted;
    } catch (error) {
      logger.error('Failed to list conversations', {error});
      throw error;
    }
  }

  /**
   * Deletes a conversation by ID
   */
  async deleteConversation(id: string): Promise<void> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction([STORE_CONVERSATIONS, STORE_METADATA], 'readwrite');

    try {
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      await this.requestToPromise(conversationsStore.delete(id));

      const metadataStore = transaction.objectStore(STORE_METADATA);
      await this.requestToPromise(metadataStore.delete(id));

      await this.transactionComplete(transaction);

      logger.info('Deleted conversation', {conversationId: id});
    } catch (error) {
      logger.error('Failed to delete conversation', {error, conversationId: id});
      throw error;
    }
  }

  /**
   * Updates the title of a conversation
   */
  async updateConversationTitle(id: string, newTitle: string): Promise<void> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction([STORE_CONVERSATIONS, STORE_METADATA], 'readwrite');

    try {
      // Update full conversation
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      const conversationRequest = conversationsStore.get(id);
      const conversation = await this.requestToPromise<StoredConversation|undefined>(conversationRequest);

      if (!conversation) {
        throw new Error(`Conversation ${id} not found`);
      }

      conversation.title = newTitle;
      conversation.updatedAt = Date.now();
      await this.requestToPromise(conversationsStore.put(conversation));

      // Update metadata
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const metadataRequest = metadataStore.get(id);
      const metadata = await this.requestToPromise<ConversationMetadata|undefined>(metadataRequest);

      if (metadata) {
        metadata.title = newTitle;
        metadata.updatedAt = conversation.updatedAt;
        await this.requestToPromise(metadataStore.put(metadata));
      }

      await this.transactionComplete(transaction);

      logger.info('Updated conversation title', {conversationId: id, newTitle});
    } catch (error) {
      logger.error('Failed to update conversation title', {error, conversationId: id});
      throw error;
    }
  }

  /**
   * Checks if a conversation exists
   */
  async conversationExists(id: string): Promise<boolean> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction(STORE_METADATA, 'readonly');
    const store = transaction.objectStore(STORE_METADATA);

    try {
      const request = store.get(id);
      const metadata = await this.requestToPromise<ConversationMetadata|undefined>(request);
      await this.transactionComplete(transaction);

      return Boolean(metadata);
    } catch (error) {
      logger.error('Failed to check conversation existence', {error, conversationId: id});
      return false;
    }
  }

  /**
   * Clears all conversations (for testing or reset purposes)
   */
  async clearAllConversations(): Promise<void> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction([STORE_CONVERSATIONS, STORE_METADATA], 'readwrite');

    try {
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      await this.requestToPromise(conversationsStore.clear());

      const metadataStore = transaction.objectStore(STORE_METADATA);
      await this.requestToPromise(metadataStore.clear());

      await this.transactionComplete(transaction);

      logger.info('Cleared all conversations');
    } catch (error) {
      logger.error('Failed to clear conversations', {error});
      throw error;
    }
  }

  /**
   * Ensures the database is open and initialized
   */
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

  /**
   * Opens the IndexedDB database and creates object stores if needed
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        logger.info('Initializing conversation storage database');

        // Create conversations object store
        if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
          const conversationsStore = db.createObjectStore(STORE_CONVERSATIONS, {keyPath: 'id'});
          conversationsStore.createIndex(INDEX_UPDATED_AT, 'updatedAt', {unique: false});
          conversationsStore.createIndex(INDEX_CREATED_AT, 'createdAt', {unique: false});
        }

        // Create metadata object store
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          const metadataStore = db.createObjectStore(STORE_METADATA, {keyPath: 'id'});
          metadataStore.createIndex(INDEX_UPDATED_AT, 'updatedAt', {unique: false});
          metadataStore.createIndex(INDEX_CREATED_AT, 'createdAt', {unique: false});
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        logger.warn('Conversation storage database open request was blocked.');
      };
    });
  }

  /**
   * Converts an IDBRequest to a Promise
   */
  private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  /**
   * Waits for a transaction to complete
   */
  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
  }

  /**
   * Generates a unique ID for conversations
   */
  generateConversationId(): string {
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
