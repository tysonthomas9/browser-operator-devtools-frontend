// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type {
  LearnedSkill,
  CreateSkillInput,
  UpdateSkillInput,
  SkillTestRecord,
  SkillVerification,
} from './types/SkillTypes.js';

const logger = createLogger('SkillStorageManager');

const DATABASE_NAME = 'ai_chat_skills';
const DATABASE_VERSION = 2; // Bumped to add semantic_knowledge store
const SKILLS_STORE = 'skills';
const TEST_RECORDS_STORE = 'test_records';
const SEMANTIC_KNOWLEDGE_STORE = 'semantic_knowledge';

// Validation constants
const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_NAME_LENGTH = 64;
const REQUIRED_SUCCESSES = 3;
const CONSECUTIVE_FAILURES_THRESHOLD = 3;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Manages IndexedDB-backed storage for learned skills.
 * Follows singleton pattern for consistent state across the application.
 */
export class SkillStorageManager {
  private static instance: SkillStorageManager | null = null;
  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    logger.info('Initialized SkillStorageManager');
  }

  static getInstance(): SkillStorageManager {
    if (!SkillStorageManager.instance) {
      SkillStorageManager.instance = new SkillStorageManager();
    }
    return SkillStorageManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (SkillStorageManager.instance?.db) {
      SkillStorageManager.instance.db.close();
    }
    SkillStorageManager.instance = null;
  }

  // ============================================================================
  // Skill CRUD Operations
  // ============================================================================

  /**
   * Create a new skill
   */
  async createSkill(input: CreateSkillInput): Promise<LearnedSkill> {
    const validation = this.validateSkillInput(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid skill configuration');
    }

    const db = await this.ensureDatabase();

    // Check for name+domain conflicts
    const existing = await this.getSkillByName(input.name, input.domain);
    if (existing) {
      throw new Error(`Skill "${input.name}" already exists for domain "${input.domain}"`);
    }

    const now = new Date().toISOString();
    const skill: LearnedSkill = {
      id: this.generateUUID(),
      name: input.name,
      description: input.description,
      version: 1,
      source: input.source,
      schema: input.schema,
      domain: input.domain,
      tags: input.tags || [],
      verification: {
        status: 'unverified',
        testCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
        requiredSuccesses: REQUIRED_SUCCESSES,
      },
      createdAt: now,
      updatedAt: now,
    };

    const transaction = db.transaction(SKILLS_STORE, 'readwrite');
    const store = transaction.objectStore(SKILLS_STORE);

    await this.requestToPromise(store.add(skill));
    await this.transactionComplete(transaction);

    logger.info('Created skill', { name: skill.name, domain: skill.domain, id: skill.id });
    return skill;
  }

  /**
   * Get a skill by ID
   */
  async getSkill(id: string): Promise<LearnedSkill | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SKILLS_STORE, 'readonly');
    const store = transaction.objectStore(SKILLS_STORE);

    const skill = await this.requestToPromise<LearnedSkill | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return skill || null;
  }

  /**
   * Get a skill by name and domain
   */
  async getSkillByName(name: string, domain: string): Promise<LearnedSkill | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SKILLS_STORE, 'readonly');
    const store = transaction.objectStore(SKILLS_STORE);
    const index = store.index('name_domain');

    const skill = await this.requestToPromise<LearnedSkill | undefined>(
      index.get([name, domain])
    );
    await this.transactionComplete(transaction);

    return skill || null;
  }

  /**
   * Get all skills for a domain (includes subdomain matching)
   */
  async getSkillsByDomain(domain: string): Promise<LearnedSkill[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SKILLS_STORE, 'readonly');
    const store = transaction.objectStore(SKILLS_STORE);

    const allSkills = await this.requestToPromise<LearnedSkill[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Filter by domain with subdomain matching
    return (allSkills || []).filter(skill => this.domainMatches(skill.domain, domain));
  }

  /**
   * Get all verified skills, optionally filtered by domain
   */
  async getVerifiedSkills(domain?: string): Promise<LearnedSkill[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SKILLS_STORE, 'readonly');
    const store = transaction.objectStore(SKILLS_STORE);
    const index = store.index('verification_status');

    const skills = await this.requestToPromise<LearnedSkill[]>(index.getAll('verified'));
    await this.transactionComplete(transaction);

    if (domain) {
      return (skills || []).filter(skill => this.domainMatches(skill.domain, domain));
    }
    return skills || [];
  }

  /**
   * Get all skills
   */
  async getAllSkills(): Promise<LearnedSkill[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(SKILLS_STORE, 'readonly');
    const store = transaction.objectStore(SKILLS_STORE);

    const skills = await this.requestToPromise<LearnedSkill[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by creation date (newest first)
    return (skills || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update an existing skill
   */
  async updateSkill(id: string, updates: UpdateSkillInput): Promise<LearnedSkill> {
    const db = await this.ensureDatabase();
    const existing = await this.getSkill(id);

    if (!existing) {
      throw new Error(`Skill with ID "${id}" not found`);
    }

    // If name is changing, check for conflicts
    if (updates.name && updates.name !== existing.name) {
      const conflict = await this.getSkillByName(updates.name, existing.domain);
      if (conflict) {
        throw new Error(`Skill "${updates.name}" already exists for domain "${existing.domain}"`);
      }
    }

    const updated: LearnedSkill = {
      ...existing,
      ...updates,
      id: existing.id, // Cannot change
      domain: existing.domain, // Cannot change domain
      createdAt: existing.createdAt, // Cannot change
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    // If source changed, reset verification
    if (updates.source && updates.source !== existing.source) {
      updated.verification = {
        status: 'unverified',
        testCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
        requiredSuccesses: REQUIRED_SUCCESSES,
      };
    }

    const transaction = db.transaction(SKILLS_STORE, 'readwrite');
    const store = transaction.objectStore(SKILLS_STORE);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated skill', { name: updated.name, id: updated.id, version: updated.version });
    return updated;
  }

  /**
   * Delete a skill by ID
   */
  async deleteSkill(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getSkill(id);

    if (!existing) {
      throw new Error(`Skill with ID "${id}" not found`);
    }

    const transaction = db.transaction([SKILLS_STORE, TEST_RECORDS_STORE], 'readwrite');
    const skillStore = transaction.objectStore(SKILLS_STORE);
    const testStore = transaction.objectStore(TEST_RECORDS_STORE);

    // Delete skill
    await this.requestToPromise(skillStore.delete(id));

    // Delete associated test records
    const testIndex = testStore.index('skillId');
    const testRecords = await this.requestToPromise<SkillTestRecord[]>(testIndex.getAll(id));
    for (const record of testRecords || []) {
      await this.requestToPromise(testStore.delete(record.id));
    }

    await this.transactionComplete(transaction);
    logger.info('Deleted skill', { name: existing.name, id });
  }

  // ============================================================================
  // Test Recording
  // ============================================================================

  /**
   * Record a test execution and update verification status
   */
  async recordTest(skillId: string, record: Omit<SkillTestRecord, 'id'>): Promise<SkillTestRecord> {
    const db = await this.ensureDatabase();
    const skill = await this.getSkill(skillId);

    if (!skill) {
      throw new Error(`Skill with ID "${skillId}" not found`);
    }

    // Create test record
    const testRecord: SkillTestRecord = {
      ...record,
      id: this.generateUUID(),
    };

    // Update verification status
    const verification: SkillVerification = { ...skill.verification };
    verification.testCount++;
    verification.lastTestedAt = record.timestamp;

    if (record.result.success) {
      verification.successCount++;
      verification.consecutiveFailures = 0; // Reset on success

      // Check if now verified
      if (verification.successCount >= verification.requiredSuccesses) {
        verification.status = 'verified';
      } else {
        verification.status = 'testing';
      }
    } else {
      verification.consecutiveFailures++;
      verification.lastError = record.result.error;

      // Check if now failing
      if (verification.consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
        verification.status = 'failing';
      }
    }

    // Save both in single transaction
    const transaction = db.transaction([SKILLS_STORE, TEST_RECORDS_STORE], 'readwrite');
    const skillStore = transaction.objectStore(SKILLS_STORE);
    const testStore = transaction.objectStore(TEST_RECORDS_STORE);

    const updatedSkill: LearnedSkill = {
      ...skill,
      verification,
      updatedAt: new Date().toISOString(),
    };

    await this.requestToPromise(testStore.add(testRecord));
    await this.requestToPromise(skillStore.put(updatedSkill));
    await this.transactionComplete(transaction);

    logger.info('Recorded test', {
      skillId,
      success: record.result.success,
      status: verification.status,
      successCount: verification.successCount,
    });

    return testRecord;
  }

  /**
   * Get test records for a skill
   */
  async getTestRecords(skillId: string): Promise<SkillTestRecord[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(TEST_RECORDS_STORE, 'readonly');
    const store = transaction.objectStore(TEST_RECORDS_STORE);
    const index = store.index('skillId');

    const records = await this.requestToPromise<SkillTestRecord[]>(index.getAll(skillId));
    await this.transactionComplete(transaction);

    // Sort by timestamp (newest first)
    return (records || []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export all skills as JSON
   */
  async exportSkills(): Promise<LearnedSkill[]> {
    return this.getAllSkills();
  }

  /**
   * Import skills from JSON
   */
  async importSkills(
    skills: LearnedSkill[],
    mode: 'skip' | 'replace' = 'skip'
  ): Promise<{ imported: number; skipped: string[] }> {
    const skipped: string[] = [];
    let imported = 0;

    for (const skill of skills) {
      try {
        const existing = await this.getSkillByName(skill.name, skill.domain);

        if (existing) {
          if (mode === 'replace') {
            await this.updateSkill(existing.id, {
              description: skill.description,
              source: skill.source,
              schema: skill.schema,
              tags: skill.tags,
            });
            imported++;
          } else {
            skipped.push(skill.name);
          }
        } else {
          await this.createSkill({
            name: skill.name,
            description: skill.description,
            source: skill.source,
            schema: skill.schema,
            domain: skill.domain,
            tags: skill.tags,
          });
          imported++;
        }
      } catch (error) {
        logger.warn(`Failed to import skill "${skill.name}":`, error);
        skipped.push(skill.name);
      }
    }

    logger.info('Import complete', { imported, skipped: skipped.length });
    return { imported, skipped };
  }

  // ============================================================================
  // Domain Matching
  // ============================================================================

  /**
   * Check if a skill domain matches the current page domain.
   * Supports subdomain matching: skill for "amazon.com" matches "smile.amazon.com"
   */
  domainMatches(skillDomain: string, pageDomain: string): boolean {
    // Normalize domains (remove www prefix, lowercase)
    const normalize = (d: string): string => d.toLowerCase().replace(/^www\./, '');
    const skill = normalize(skillDomain);
    const page = normalize(pageDomain);

    // Exact match
    if (skill === page) {
      return true;
    }

    // Subdomain match: page domain ends with .skillDomain
    if (page.endsWith(`.${skill}`)) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // Validation
  // ============================================================================

  private validateSkillInput(input: CreateSkillInput): ValidationResult {
    // Name validation
    if (!input.name || !input.name.trim()) {
      return { valid: false, error: 'Skill name cannot be empty' };
    }

    if (!NAME_PATTERN.test(input.name)) {
      return {
        valid: false,
        error: 'Skill name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
      };
    }

    if (input.name.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Skill name must be ${MAX_NAME_LENGTH} characters or fewer` };
    }

    // Description validation
    if (!input.description || !input.description.trim()) {
      return { valid: false, error: 'Description cannot be empty' };
    }

    // Source validation
    if (!input.source || !input.source.trim()) {
      return { valid: false, error: 'Source code cannot be empty' };
    }

    // Domain validation
    if (!input.domain || !input.domain.trim()) {
      return { valid: false, error: 'Domain cannot be empty' };
    }

    // Schema validation
    if (!input.schema || input.schema.type !== 'object') {
      return { valid: false, error: 'Schema must have type "object"' };
    }

    return { valid: true };
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
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
        logger.info('Upgrading skill storage database', { oldVersion, newVersion: DATABASE_VERSION });

        // Skills store (version 1)
        if (!db.objectStoreNames.contains(SKILLS_STORE)) {
          const skillStore = db.createObjectStore(SKILLS_STORE, { keyPath: 'id' });
          skillStore.createIndex('name_domain', ['name', 'domain'], { unique: true });
          skillStore.createIndex('domain', 'domain', { unique: false });
          skillStore.createIndex('verification_status', 'verification.status', { unique: false });
        }

        // Test records store (version 1)
        if (!db.objectStoreNames.contains(TEST_RECORDS_STORE)) {
          const testStore = db.createObjectStore(TEST_RECORDS_STORE, { keyPath: 'id' });
          testStore.createIndex('skillId', 'skillId', { unique: false });
          testStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Semantic knowledge store (version 2)
        if (oldVersion < 2 && !db.objectStoreNames.contains(SEMANTIC_KNOWLEDGE_STORE)) {
          const semanticStore = db.createObjectStore(SEMANTIC_KNOWLEDGE_STORE, { keyPath: 'id' });
          semanticStore.createIndex('domain', 'domain', { unique: true });
          semanticStore.createIndex('categories', 'categories', { unique: false, multiEntry: true });
          logger.info('Created semantic_knowledge store');
        }
      };

      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(request.error || new Error('Failed to open IndexedDB'));
      request.onblocked = (): void => logger.warn('Skill storage database open request was blocked');
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
