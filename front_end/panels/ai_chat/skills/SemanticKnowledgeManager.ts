// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type {
  SemanticKnowledge,
  CreateSemanticKnowledgeInput,
  UpdateSemanticKnowledgeInput,
  SemanticKnowledgeInfo,
} from './types/SemanticKnowledgeTypes.js';

const logger = createLogger('SemanticKnowledgeManager');

const DATABASE_NAME = 'ai_chat_skills';
const DATABASE_VERSION = 2; // Bumped from 1 to add semantic knowledge store
const SEMANTIC_KNOWLEDGE_STORE = 'semantic_knowledge';

/**
 * Manages IndexedDB-backed storage for semantic knowledge about domains.
 * Follows singleton pattern for consistent state across the application.
 */
export class SemanticKnowledgeManager {
  private static instance: SemanticKnowledgeManager | null = null;
  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    logger.info('Initialized SemanticKnowledgeManager');
  }

  static getInstance(): SemanticKnowledgeManager {
    if (!SemanticKnowledgeManager.instance) {
      SemanticKnowledgeManager.instance = new SemanticKnowledgeManager();
    }
    return SemanticKnowledgeManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (SemanticKnowledgeManager.instance?.db) {
      SemanticKnowledgeManager.instance.db.close();
    }
    SemanticKnowledgeManager.instance = null;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create new semantic knowledge for a domain
   */
  async createKnowledge(input: CreateSemanticKnowledgeInput): Promise<SemanticKnowledge> {
    if (!input.domain || !input.domain.trim()) {
      throw new Error('Domain cannot be empty');
    }

    if (!input.content || !input.content.trim()) {
      throw new Error('Content cannot be empty');
    }

    const db = await this.ensureDatabase();

    // Check for existing knowledge for this domain
    const existing = await this.getKnowledgeByDomain(input.domain);
    if (existing) {
      throw new Error(`Semantic knowledge already exists for domain "${input.domain}"`);
    }

    const now = new Date().toISOString();
    const knowledge: SemanticKnowledge = {
      id: this.generateUUID(),
      domain: this.normalizeDomain(input.domain),
      content: input.content,
      categories: input.categories || [],
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };

    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readwrite');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    await this.requestToPromise(store.add(knowledge));
    await this.transactionComplete(transaction);

    logger.info('Created semantic knowledge', { domain: knowledge.domain, id: knowledge.id });
    return knowledge;
  }

  /**
   * Get semantic knowledge by ID
   */
  async getKnowledge(id: string): Promise<SemanticKnowledge | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readonly');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    const knowledge = await this.requestToPromise<SemanticKnowledge | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return knowledge || null;
  }

  /**
   * Get semantic knowledge by domain (with subdomain matching)
   */
  async getKnowledgeByDomain(domain: string): Promise<SemanticKnowledge | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readonly');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    const allKnowledge = await this.requestToPromise<SemanticKnowledge[]>(store.getAll());
    await this.transactionComplete(transaction);

    const normalizedDomain = this.normalizeDomain(domain);

    // Find matching knowledge (exact match first, then subdomain match)
    for (const knowledge of allKnowledge || []) {
      if (knowledge.domain === normalizedDomain) {
        return knowledge;
      }
    }

    // Check subdomain matching
    for (const knowledge of allKnowledge || []) {
      if (this.domainMatches(knowledge.domain, normalizedDomain)) {
        return knowledge;
      }
    }

    return null;
  }

  /**
   * Get all semantic knowledge entries
   */
  async getAllKnowledge(): Promise<SemanticKnowledge[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readonly');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    const knowledge = await this.requestToPromise<SemanticKnowledge[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by update date (newest first)
    return (knowledge || []).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get lightweight list of all knowledge entries
   */
  async getKnowledgeList(): Promise<SemanticKnowledgeInfo[]> {
    const allKnowledge = await this.getAllKnowledge();
    return allKnowledge.map(k => ({
      id: k.id,
      domain: k.domain,
      categories: k.categories,
      updatedAt: k.updatedAt,
      useCount: k.useCount,
      excerpt: k.content.slice(0, 200) + (k.content.length > 200 ? '...' : ''),
    }));
  }

  /**
   * Update existing semantic knowledge
   */
  async updateKnowledge(id: string, updates: UpdateSemanticKnowledgeInput): Promise<SemanticKnowledge> {
    const db = await this.ensureDatabase();
    const existing = await this.getKnowledge(id);

    if (!existing) {
      throw new Error(`Semantic knowledge with ID "${id}" not found`);
    }

    const updated: SemanticKnowledge = {
      ...existing,
      ...updates,
      id: existing.id,
      domain: existing.domain, // Domain cannot change
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readwrite');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated semantic knowledge', { domain: updated.domain, id: updated.id });
    return updated;
  }

  /**
   * Update or create knowledge for a domain
   */
  async upsertKnowledge(
    domain: string,
    content: string,
    categories?: string[],
    skillId?: string
  ): Promise<SemanticKnowledge> {
    const existing = await this.getKnowledgeByDomain(domain);

    if (existing) {
      // Merge categories
      const mergedCategories = categories
        ? [...new Set([...existing.categories, ...categories])]
        : existing.categories;

      return this.updateKnowledge(existing.id, {
        content,
        categories: mergedCategories,
      });
    }

    const knowledge = await this.createKnowledge({
      domain,
      content,
      categories,
    });

    if (skillId) {
      await this.markUpdatedBySkill(knowledge.id, skillId);
    }

    return knowledge;
  }

  /**
   * Mark knowledge as updated by a specific skill
   */
  async markUpdatedBySkill(id: string, skillId: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getKnowledge(id);

    if (!existing) {
      return;
    }

    const updated: SemanticKnowledge = {
      ...existing,
      lastUpdatedBySkillId: skillId,
      updatedAt: new Date().toISOString(),
    };

    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readwrite');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);
  }

  /**
   * Increment use count for knowledge
   */
  async incrementUseCount(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getKnowledge(id);

    if (!existing) {
      return;
    }

    const updated: SemanticKnowledge = {
      ...existing,
      useCount: existing.useCount + 1,
    };

    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readwrite');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);
  }

  /**
   * Delete semantic knowledge by ID
   */
  async deleteKnowledge(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getKnowledge(id);

    if (!existing) {
      throw new Error(`Semantic knowledge with ID "${id}" not found`);
    }

    const transaction = db.transaction(SEMANTIC_KNOWLEDGE_STORE, 'readwrite');
    const store = transaction.objectStore(SEMANTIC_KNOWLEDGE_STORE);

    await this.requestToPromise(store.delete(id));
    await this.transactionComplete(transaction);

    logger.info('Deleted semantic knowledge', { domain: existing.domain, id });
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export all semantic knowledge as JSON
   */
  async exportKnowledge(): Promise<SemanticKnowledge[]> {
    return this.getAllKnowledge();
  }

  /**
   * Import semantic knowledge from JSON
   */
  async importKnowledge(
    items: SemanticKnowledge[],
    mode: 'skip' | 'replace' = 'skip'
  ): Promise<{ imported: number; skipped: string[] }> {
    const skipped: string[] = [];
    let imported = 0;

    for (const item of items) {
      try {
        const existing = await this.getKnowledgeByDomain(item.domain);

        if (existing) {
          if (mode === 'replace') {
            await this.updateKnowledge(existing.id, {
              content: item.content,
              categories: item.categories,
            });
            imported++;
          } else {
            skipped.push(item.domain);
          }
        } else {
          await this.createKnowledge({
            domain: item.domain,
            content: item.content,
            categories: item.categories,
          });
          imported++;
        }
      } catch (error) {
        logger.warn(`Failed to import knowledge for "${item.domain}":`, error);
        skipped.push(item.domain);
      }
    }

    logger.info('Import complete', { imported, skipped: skipped.length });
    return { imported, skipped };
  }

  // ============================================================================
  // Domain Matching
  // ============================================================================

  /**
   * Normalize domain (remove www prefix, lowercase)
   */
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^www\./, '');
  }

  /**
   * Check if knowledge domain matches page domain (with subdomain support)
   */
  domainMatches(knowledgeDomain: string, pageDomain: string): boolean {
    const knowledge = this.normalizeDomain(knowledgeDomain);
    const page = this.normalizeDomain(pageDomain);

    // Exact match
    if (knowledge === page) {
      return true;
    }

    // Subdomain match: page domain ends with .knowledgeDomain
    if (page.endsWith(`.${knowledge}`)) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // Database Management
  // ============================================================================

  private async ensureDatabase(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (!('indexedDB' in globalThis)) {
      throw new Error('IndexedDB is not supported in this environment');
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

      request.onupgradeneeded = (event): void => {
        const db = request.result;
        const oldVersion = event.oldVersion;
        logger.info('Upgrading semantic knowledge database', { oldVersion, newVersion: DATABASE_VERSION });

        // Add semantic knowledge store if upgrading from version 1
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(SEMANTIC_KNOWLEDGE_STORE)) {
            const store = db.createObjectStore(SEMANTIC_KNOWLEDGE_STORE, { keyPath: 'id' });
            store.createIndex('domain', 'domain', { unique: true });
            store.createIndex('categories', 'categories', { unique: false, multiEntry: true });
            logger.info('Created semantic_knowledge store');
          }
        }
      };

      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(request.error || new Error('Failed to open IndexedDB'));
      request.onblocked = (): void => logger.warn('Semantic knowledge database open request was blocked');
    });
  }

  private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = (): void => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return template.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
