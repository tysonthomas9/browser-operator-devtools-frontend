// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from './Logger.js';
import type {
  AppProject,
  ProjectFile,
  CreateProjectInput,
  UpdateProjectInput,
} from '../mini_apps/apps/app_builder/AppBuilderTypes.js';

const logger = createLogger('AppProjectManager');

const DATABASE_NAME = 'app_builder_db';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'projects';
const INDEX_NAME = 'name';

/**
 * Manages IndexedDB-backed storage for App Builder projects.
 * Follows singleton pattern for consistent state across the application.
 */
export class AppProjectManager {
  private static instance: AppProjectManager | null = null;

  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    logger.info('Initialized AppProjectManager');
  }

  static getInstance(): AppProjectManager {
    if (!AppProjectManager.instance) {
      AppProjectManager.instance = new AppProjectManager();
    }
    return AppProjectManager.instance;
  }

  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput): Promise<AppProject> {
    const validation = this.validateProjectInput(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid project configuration');
    }

    const db = await this.ensureDatabase();

    // Check for name conflicts
    if (await this.projectNameExists(input.name)) {
      throw new Error(`Project with name "${input.name}" already exists.`);
    }

    const now = new Date().toISOString();
    const project: AppProject = {
      id: this.generateUUID(),
      name: input.name,
      description: input.description,
      files: input.files,
      createdAt: now,
      updatedAt: now,
    };

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.add(project));
    await this.transactionComplete(transaction);

    logger.info('Created project', { name: project.name, id: project.id });
    return project;
  }

  /**
   * Get a project by ID
   */
  async getProject(id: string): Promise<AppProject | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const project = await this.requestToPromise<AppProject | undefined>(store.get(id));
    await this.transactionComplete(transaction);

    return project || null;
  }

  /**
   * Get a project by name
   */
  async getProjectByName(name: string): Promise<AppProject | null> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const index = store.index(INDEX_NAME);

    const project = await this.requestToPromise<AppProject | undefined>(index.get(name));
    await this.transactionComplete(transaction);

    return project || null;
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<AppProject[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const projects = await this.requestToPromise<AppProject[]>(store.getAll());
    await this.transactionComplete(transaction);

    // Sort by updated date (newest first)
    return (projects || []).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Update an existing project
   */
  async updateProject(id: string, updates: UpdateProjectInput): Promise<AppProject> {
    const db = await this.ensureDatabase();
    const existing = await this.getProject(id);

    if (!existing) {
      throw new Error(`Project with ID "${id}" not found.`);
    }

    // If name is being changed, check for conflicts
    if (updates.name && updates.name !== existing.name) {
      if (await this.projectNameExists(updates.name)) {
        throw new Error(`Project with name "${updates.name}" already exists.`);
      }
    }

    const updated: AppProject = {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date().toISOString(),
    };

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated project', { name: updated.name, id: updated.id });
    return updated;
  }

  /**
   * Delete a project by ID
   */
  async deleteProject(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getProject(id);

    if (!existing) {
      throw new Error(`Project with ID "${id}" not found.`);
    }

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.delete(id));
    await this.transactionComplete(transaction);

    logger.info('Deleted project', { name: existing.name, id });
  }

  /**
   * Check if a project name already exists
   */
  async projectNameExists(name: string): Promise<boolean> {
    const project = await this.getProjectByName(name);
    return project !== null;
  }

  /**
   * Add or update a file in a project
   */
  async updateFile(projectId: string, path: string, content: string): Promise<AppProject> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID "${projectId}" not found.`);
    }

    const fileIndex = project.files.findIndex(f => f.path === path);
    if (fileIndex >= 0) {
      project.files[fileIndex].content = content;
    } else {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        ts: 'text/typescript',
        tsx: 'text/typescript',
        js: 'text/javascript',
        jsx: 'text/javascript',
        json: 'application/json',
        html: 'text/html',
        css: 'text/css',
      };

      const newFile: ProjectFile = {
        path,
        content,
        type: mimeTypes[ext] || 'text/plain',
      };
      project.files.push(newFile);
    }

    return this.updateProject(projectId, { files: project.files });
  }

  /**
   * Delete a file from a project
   */
  async deleteFile(projectId: string, path: string): Promise<AppProject> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID "${projectId}" not found.`);
    }

    const fileIndex = project.files.findIndex(f => f.path === path);
    if (fileIndex < 0) {
      throw new Error(`File "${path}" not found in project.`);
    }

    project.files.splice(fileIndex, 1);
    return this.updateProject(projectId, { files: project.files });
  }

  /**
   * Validate project input
   */
  private validateProjectInput(input: Partial<CreateProjectInput>): { valid: boolean; error?: string } {
    if (!input.name || !input.name.trim()) {
      return { valid: false, error: 'Project name cannot be empty.' };
    }

    if (input.name.length > 64) {
      return { valid: false, error: 'Project name must be 64 characters or fewer.' };
    }

    // Name format: alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input.name)) {
      return {
        valid: false,
        error: 'Project name must start with a letter and contain only letters, numbers, hyphens, and underscores.'
      };
    }

    if (!input.files || !Array.isArray(input.files)) {
      return { valid: false, error: 'Project must have a files array.' };
    }

    return { valid: true };
  }

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
        logger.info('Initializing app builder database');

        if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          const store = db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
          store.createIndex(INDEX_NAME, 'name', { unique: true });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        logger.warn('App builder database open request was blocked.');
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
