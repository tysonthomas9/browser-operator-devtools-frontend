// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from './Logger.js';
import type {
  StoredTestCase,
  StoredTestSuite,
  StoredTestRun,
  CreateTestCaseInput,
  CreateTestSuiteInput,
  TestStep,
  ValidationResult,
} from '../mini_apps/apps/qa_agent/types.js';

const logger = createLogger('TestStorageManager');

const DATABASE_NAME = 'qa_agent_db';
const DATABASE_VERSION = 1;

const STORE_TEST_CASES = 'testCases';
const STORE_TEST_SUITES = 'testSuites';
const STORE_TEST_RUNS = 'testRuns';

/**
 * Manages IndexedDB-backed storage for QA Agent test cases, suites, and runs.
 * Follows singleton pattern for consistent state across the application.
 */
export class TestStorageManager {
  private static instance: TestStorageManager | null = null;

  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    logger.info('Initialized TestStorageManager');
  }

  static getInstance(): TestStorageManager {
    if (!TestStorageManager.instance) {
      TestStorageManager.instance = new TestStorageManager();
    }
    return TestStorageManager.instance;
  }

  // =============================================================
  // TEST CASE METHODS
  // =============================================================

  /**
   * Create a new test case
   */
  async createTestCase(input: CreateTestCaseInput): Promise<StoredTestCase> {
    const validation = this.validateTestCase(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid test case configuration');
    }

    const db = await this.ensureDatabase();

    // Check for name conflicts
    if (await this.testCaseNameExists(input.name)) {
      throw new Error(`Test case with name "${input.name}" already exists.`);
    }

    const now = new Date().toISOString();
    const testCase: StoredTestCase = {
      id: this.generateUUID(),
      name: input.name,
      description: input.description,
      url: input.url,
      steps: input.steps || [],
      createdAt: now,
      updatedAt: now,
    };

    const transaction = db.transaction(STORE_TEST_CASES, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_CASES);

    await this.requestToPromise(store.add(testCase));
    await this.transactionComplete(transaction);

    logger.info('Created test case', { name: testCase.name, id: testCase.id });
    return testCase;
  }

  /**
   * Get a test case by ID
   */
  async getTestCase(id: string): Promise<StoredTestCase | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_CASES, 'readonly');
    const store = transaction.objectStore(STORE_TEST_CASES);

    const testCase = await this.requestToPromise<StoredTestCase | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return testCase || null;
  }

  /**
   * Get a test case by name
   */
  async getTestCaseByName(name: string): Promise<StoredTestCase | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_CASES, 'readonly');
    const store = transaction.objectStore(STORE_TEST_CASES);
    const index = store.index('name');

    const testCase = await this.requestToPromise<StoredTestCase | undefined>(index.get(name));
    await this.transactionComplete(transaction);

    return testCase || null;
  }

  /**
   * Get all test cases
   */
  async getAllTestCases(): Promise<StoredTestCase[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_CASES, 'readonly');
    const store = transaction.objectStore(STORE_TEST_CASES);

    const testCases = await this.requestToPromise<StoredTestCase[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by creation date (newest first)
    return (testCases || []).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update an existing test case
   */
  async updateTestCase(
    id: string,
    updates: Partial<Omit<StoredTestCase, 'id' | 'createdAt'>>
  ): Promise<StoredTestCase> {
    const db = await this.ensureDatabase();
    const existing = await this.getTestCase(id);

    if (!existing) {
      throw new Error(`Test case with ID "${id}" not found.`);
    }

    // If name is being changed, check for conflicts
    if (updates.name && updates.name !== existing.name) {
      if (await this.testCaseNameExists(updates.name)) {
        throw new Error(`Test case with name "${updates.name}" already exists.`);
      }
    }

    const updated: StoredTestCase = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const validation = this.validateTestCase(updated);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid test case configuration');
    }

    const transaction = db.transaction(STORE_TEST_CASES, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_CASES);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated test case', { name: updated.name, id: updated.id });
    return updated;
  }

  /**
   * Delete a test case by ID
   */
  async deleteTestCase(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getTestCase(id);

    if (!existing) {
      throw new Error(`Test case with ID "${id}" not found.`);
    }

    const transaction = db.transaction(STORE_TEST_CASES, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_CASES);

    await this.requestToPromise(store.delete(id));
    await this.transactionComplete(transaction);

    logger.info('Deleted test case', { name: existing.name, id });
  }

  /**
   * Check if a test case name already exists
   */
  async testCaseNameExists(name: string): Promise<boolean> {
    const testCase = await this.getTestCaseByName(name);
    return testCase !== null;
  }

  /**
   * Update test steps for a test case
   */
  async updateTestSteps(id: string, steps: TestStep[]): Promise<StoredTestCase> {
    return this.updateTestCase(id, { steps });
  }

  // =============================================================
  // TEST SUITE METHODS
  // =============================================================

  /**
   * Create a new test suite
   */
  async createTestSuite(input: CreateTestSuiteInput): Promise<StoredTestSuite> {
    const validation = this.validateTestSuite(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid test suite configuration');
    }

    const db = await this.ensureDatabase();

    // Check for name conflicts
    if (await this.testSuiteNameExists(input.name)) {
      throw new Error(`Test suite with name "${input.name}" already exists.`);
    }

    const now = new Date().toISOString();
    const testSuite: StoredTestSuite = {
      id: this.generateUUID(),
      name: input.name,
      description: input.description,
      testCaseIds: input.testCaseIds || [],
      createdAt: now,
      updatedAt: now,
    };

    const transaction = db.transaction(STORE_TEST_SUITES, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_SUITES);

    await this.requestToPromise(store.add(testSuite));
    await this.transactionComplete(transaction);

    logger.info('Created test suite', { name: testSuite.name, id: testSuite.id });
    return testSuite;
  }

  /**
   * Get a test suite by ID
   */
  async getTestSuite(id: string): Promise<StoredTestSuite | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_SUITES, 'readonly');
    const store = transaction.objectStore(STORE_TEST_SUITES);

    const testSuite = await this.requestToPromise<StoredTestSuite | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return testSuite || null;
  }

  /**
   * Get a test suite by name
   */
  async getTestSuiteByName(name: string): Promise<StoredTestSuite | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_SUITES, 'readonly');
    const store = transaction.objectStore(STORE_TEST_SUITES);
    const index = store.index('name');

    const testSuite = await this.requestToPromise<StoredTestSuite | undefined>(index.get(name));
    await this.transactionComplete(transaction);

    return testSuite || null;
  }

  /**
   * Get all test suites
   */
  async getAllTestSuites(): Promise<StoredTestSuite[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_SUITES, 'readonly');
    const store = transaction.objectStore(STORE_TEST_SUITES);

    const testSuites = await this.requestToPromise<StoredTestSuite[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by creation date (newest first)
    return (testSuites || []).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update an existing test suite
   */
  async updateTestSuite(
    id: string,
    updates: Partial<Omit<StoredTestSuite, 'id' | 'createdAt'>>
  ): Promise<StoredTestSuite> {
    const db = await this.ensureDatabase();
    const existing = await this.getTestSuite(id);

    if (!existing) {
      throw new Error(`Test suite with ID "${id}" not found.`);
    }

    // If name is being changed, check for conflicts
    if (updates.name && updates.name !== existing.name) {
      if (await this.testSuiteNameExists(updates.name)) {
        throw new Error(`Test suite with name "${updates.name}" already exists.`);
      }
    }

    const updated: StoredTestSuite = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const validation = this.validateTestSuite(updated);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid test suite configuration');
    }

    const transaction = db.transaction(STORE_TEST_SUITES, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_SUITES);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated test suite', { name: updated.name, id: updated.id });
    return updated;
  }

  /**
   * Delete a test suite by ID
   */
  async deleteTestSuite(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getTestSuite(id);

    if (!existing) {
      throw new Error(`Test suite with ID "${id}" not found.`);
    }

    const transaction = db.transaction(STORE_TEST_SUITES, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_SUITES);

    await this.requestToPromise(store.delete(id));
    await this.transactionComplete(transaction);

    logger.info('Deleted test suite', { name: existing.name, id });
  }

  /**
   * Check if a test suite name already exists
   */
  async testSuiteNameExists(name: string): Promise<boolean> {
    const testSuite = await this.getTestSuiteByName(name);
    return testSuite !== null;
  }

  /**
   * Add a test case to a suite
   */
  async addTestCaseToSuite(suiteId: string, testCaseId: string): Promise<StoredTestSuite> {
    const suite = await this.getTestSuite(suiteId);
    if (!suite) {
      throw new Error(`Test suite with ID "${suiteId}" not found.`);
    }

    if (!suite.testCaseIds.includes(testCaseId)) {
      suite.testCaseIds.push(testCaseId);
      return this.updateTestSuite(suiteId, { testCaseIds: suite.testCaseIds });
    }

    return suite;
  }

  /**
   * Remove a test case from a suite
   */
  async removeTestCaseFromSuite(suiteId: string, testCaseId: string): Promise<StoredTestSuite> {
    const suite = await this.getTestSuite(suiteId);
    if (!suite) {
      throw new Error(`Test suite with ID "${suiteId}" not found.`);
    }

    const index = suite.testCaseIds.indexOf(testCaseId);
    if (index > -1) {
      suite.testCaseIds.splice(index, 1);
      return this.updateTestSuite(suiteId, { testCaseIds: suite.testCaseIds });
    }

    return suite;
  }

  // =============================================================
  // TEST RUN METHODS
  // =============================================================

  /**
   * Record a new test run
   */
  async recordTestRun(run: StoredTestRun): Promise<StoredTestRun> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction(STORE_TEST_RUNS, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_RUNS);

    await this.requestToPromise(store.put(run));
    await this.transactionComplete(transaction);

    logger.info('Recorded test run', { id: run.id, status: run.status });
    return run;
  }

  /**
   * Get a test run by ID
   */
  async getTestRun(id: string): Promise<StoredTestRun | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_RUNS, 'readonly');
    const store = transaction.objectStore(STORE_TEST_RUNS);

    const run = await this.requestToPromise<StoredTestRun | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return run || null;
  }

  /**
   * Get test runs for a specific test case
   */
  async getTestRunsForTestCase(testCaseId: string, limit = 10): Promise<StoredTestRun[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_RUNS, 'readonly');
    const store = transaction.objectStore(STORE_TEST_RUNS);
    const index = store.index('testCaseId');

    const runs = await this.requestToPromise<StoredTestRun[]>(index.getAll(testCaseId));
    await this.transactionComplete(transaction);

    // Sort by start time (newest first) and limit
    return (runs || [])
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * Get test runs for a specific test suite
   */
  async getTestRunsForSuite(suiteId: string, limit = 10): Promise<StoredTestRun[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_RUNS, 'readonly');
    const store = transaction.objectStore(STORE_TEST_RUNS);
    const index = store.index('suiteId');

    const runs = await this.requestToPromise<StoredTestRun[]>(index.getAll(suiteId));
    await this.transactionComplete(transaction);

    // Sort by start time (newest first) and limit
    return (runs || [])
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * Get all test runs
   */
  async getAllTestRuns(limit = 50): Promise<StoredTestRun[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(STORE_TEST_RUNS, 'readonly');
    const store = transaction.objectStore(STORE_TEST_RUNS);

    const runs = await this.requestToPromise<StoredTestRun[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by start time (newest first) and limit
    return (runs || [])
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * Update a test run (e.g., add results, change status)
   */
  async updateTestRun(
    id: string,
    updates: Partial<Omit<StoredTestRun, 'id'>>
  ): Promise<StoredTestRun> {
    const db = await this.ensureDatabase();
    const existing = await this.getTestRun(id);

    if (!existing) {
      throw new Error(`Test run with ID "${id}" not found.`);
    }

    const updated: StoredTestRun = {
      ...existing,
      ...updates,
      id: existing.id,
    };

    const transaction = db.transaction(STORE_TEST_RUNS, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_RUNS);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated test run', { id: updated.id, status: updated.status });
    return updated;
  }

  /**
   * Delete a test run by ID
   */
  async deleteTestRun(id: string): Promise<void> {
    const db = await this.ensureDatabase();

    const transaction = db.transaction(STORE_TEST_RUNS, 'readwrite');
    const store = transaction.objectStore(STORE_TEST_RUNS);

    await this.requestToPromise(store.delete(id));
    await this.transactionComplete(transaction);

    logger.info('Deleted test run', { id });
  }

  /**
   * Delete old test runs to manage storage
   */
  async cleanupOldTestRuns(keepCount = 100): Promise<number> {
    const allRuns = await this.getAllTestRuns(Number.MAX_SAFE_INTEGER);

    if (allRuns.length <= keepCount) {
      return 0;
    }

    // Keep the most recent runs
    const runsToDelete = allRuns.slice(keepCount);
    let deletedCount = 0;

    for (const run of runsToDelete) {
      await this.deleteTestRun(run.id);
      deletedCount++;
    }

    logger.info('Cleaned up old test runs', { deleted: deletedCount });
    return deletedCount;
  }

  // =============================================================
  // EXPORT/IMPORT
  // =============================================================

  /**
   * Export all test cases as JSON array
   */
  async exportTestCases(): Promise<StoredTestCase[]> {
    return this.getAllTestCases();
  }

  /**
   * Export all test suites as JSON array
   */
  async exportTestSuites(): Promise<StoredTestSuite[]> {
    return this.getAllTestSuites();
  }

  /**
   * Import test cases from JSON array
   */
  async importTestCases(
    testCases: StoredTestCase[]
  ): Promise<{ imported: number; skipped: string[] }> {
    const skipped: string[] = [];
    let imported = 0;

    for (const testCase of testCases) {
      try {
        const input: CreateTestCaseInput = {
          name: testCase.name,
          description: testCase.description,
          url: testCase.url,
          steps: testCase.steps,
        };

        await this.createTestCase(input);
        imported++;
      } catch (error) {
        logger.warn(`Skipped importing test case "${testCase.name}":`, error);
        skipped.push(testCase.name);
      }
    }

    logger.info('Import test cases complete', { imported, skipped: skipped.length });
    return { imported, skipped };
  }

  /**
   * Import test suites from JSON array
   */
  async importTestSuites(
    testSuites: StoredTestSuite[]
  ): Promise<{ imported: number; skipped: string[] }> {
    const skipped: string[] = [];
    let imported = 0;

    for (const testSuite of testSuites) {
      try {
        const input: CreateTestSuiteInput = {
          name: testSuite.name,
          description: testSuite.description,
          testCaseIds: testSuite.testCaseIds,
        };

        await this.createTestSuite(input);
        imported++;
      } catch (error) {
        logger.warn(`Skipped importing test suite "${testSuite.name}":`, error);
        skipped.push(testSuite.name);
      }
    }

    logger.info('Import test suites complete', { imported, skipped: skipped.length });
    return { imported, skipped };
  }

  // =============================================================
  // VALIDATION
  // =============================================================

  private validateTestCase(config: Partial<StoredTestCase>): ValidationResult {
    if (!config.name || !config.name.trim()) {
      return { valid: false, error: 'Test case name cannot be empty.' };
    }

    if (config.name.length > 128) {
      return { valid: false, error: 'Test case name must be 128 characters or fewer.' };
    }

    if (!config.url || !config.url.trim()) {
      return { valid: false, error: 'Test case URL cannot be empty.' };
    }

    // Basic URL validation
    try {
      new URL(config.url);
    } catch {
      return { valid: false, error: 'Test case URL must be a valid URL.' };
    }

    return { valid: true };
  }

  private validateTestSuite(config: Partial<StoredTestSuite>): ValidationResult {
    if (!config.name || !config.name.trim()) {
      return { valid: false, error: 'Test suite name cannot be empty.' };
    }

    if (config.name.length > 128) {
      return { valid: false, error: 'Test suite name must be 128 characters or fewer.' };
    }

    return { valid: true };
  }

  // =============================================================
  // DATABASE HELPERS
  // =============================================================

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
        logger.info('Initializing QA Agent storage database');

        // Test Cases store
        if (!db.objectStoreNames.contains(STORE_TEST_CASES)) {
          const testCasesStore = db.createObjectStore(STORE_TEST_CASES, { keyPath: 'id' });
          testCasesStore.createIndex('name', 'name', { unique: true });
          testCasesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Test Suites store
        if (!db.objectStoreNames.contains(STORE_TEST_SUITES)) {
          const testSuitesStore = db.createObjectStore(STORE_TEST_SUITES, { keyPath: 'id' });
          testSuitesStore.createIndex('name', 'name', { unique: true });
          testSuitesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Test Runs store
        if (!db.objectStoreNames.contains(STORE_TEST_RUNS)) {
          const testRunsStore = db.createObjectStore(STORE_TEST_RUNS, { keyPath: 'id' });
          testRunsStore.createIndex('testCaseId', 'testCaseId', { unique: false });
          testRunsStore.createIndex('suiteId', 'suiteId', { unique: false });
          testRunsStore.createIndex('startTime', 'startTime', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        logger.warn('QA Agent storage database open request was blocked.');
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
