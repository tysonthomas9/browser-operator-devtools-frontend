// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';

const logger = createLogger('FileStorageManager');

const DATABASE_NAME = 'ai_chat_agent_files';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'files';
const INDEX_SESSION_ID = 'sessionId';
const INDEX_FILE_NAME = 'fileName';
const INDEX_CREATED_AT = 'createdAt';
const INDEX_SESSION_FILE_NAME = 'sessionId_fileName';

export interface StoredFile {
  id: string;
  sessionId: string;
  fileName: string;
  content: string;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
  size: number;
}

export interface FileSummary {
  fileName: string;
  size: number;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Manages IndexedDB-backed file storage scoped to the current DevTools session.
 */
export class FileStorageManager {
  private static instance: FileStorageManager | null = null;

  private readonly sessionId: string;
  private db: IDBDatabase | null = null;
  private dbInitializationPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    this.sessionId = this.generateUUID();
    logger.info('Initialized FileStorageManager with session', { sessionId: this.sessionId });
  }

  static getInstance(): FileStorageManager {
    if (!FileStorageManager.instance) {
      FileStorageManager.instance = new FileStorageManager();
    }
    return FileStorageManager.instance;
  }

  async createFile(fileName: string, content: string, mimeType = 'text/plain'): Promise<StoredFile> {
    const validation = this.validateFileName(fileName);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file name');
    }

    const db = await this.ensureDatabase();

    if (await this.fileExists(fileName)) {
      throw new Error(`File "${fileName}" already exists in the current session.`);
    }

    const now = Date.now();
    const file: StoredFile = {
      id: this.generateFileId(),
      sessionId: this.sessionId,
      fileName,
      content,
      mimeType,
      createdAt: now,
      updatedAt: now,
      size: this.calculateSize(content),
    };

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    await this.requestToPromise(store.add(file));
    await this.transactionComplete(transaction);

    logger.info('Created file', { fileName, fileId: file.id, size: file.size });
    return file;
  }

  async updateFile(fileName: string, content: string, append = false): Promise<StoredFile> {
    const db = await this.ensureDatabase();
    const existing = await this.getFileRecord(fileName);
    if (!existing) {
      throw new Error(`File "${fileName}" was not found in the current session.`);
    }

    const newContent = append ? `${existing.content}${content}` : content;
    const updated: StoredFile = {
      ...existing,
      content: newContent,
      updatedAt: Date.now(),
      size: this.calculateSize(newContent),
    };

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    await this.requestToPromise(store.put(updated));
    await this.transactionComplete(transaction);

    logger.info('Updated file', { fileName, fileId: existing.id, append });
    return updated;
  }

  async deleteFile(fileName: string): Promise<void> {
    const db = await this.ensureDatabase();
    const existing = await this.getFileRecord(fileName);
    if (!existing) {
      throw new Error(`File "${fileName}" was not found in the current session.`);
    }

    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    await this.requestToPromise(store.delete(existing.id));
    await this.transactionComplete(transaction);

    logger.info('Deleted file', { fileName, fileId: existing.id });
  }

  async readFile(fileName: string): Promise<StoredFile | null> {
    const record = await this.getFileRecord(fileName);
    return record || null;
  }

  async listFiles(): Promise<FileSummary[]> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const index = store.index(INDEX_SESSION_ID);

    const request = index.getAll(IDBKeyRange.only(this.sessionId));
    const files = await this.requestToPromise<StoredFile[]>(request);
    await this.transactionComplete(transaction);

    const sorted = (files || []).sort((a, b) => b.createdAt - a.createdAt);
    return sorted.map(file => ({
      fileName: file.fileName,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));
  }

  private async fileExists(fileName: string): Promise<boolean> {
    const record = await this.getFileRecord(fileName);
    return Boolean(record);
  }

  private validateFileName(fileName: string): ValidationResult {
    if (!fileName || !fileName.trim()) {
      return { valid: false, error: 'File name cannot be empty.' };
    }
    if (/[/\\]/.test(fileName)) {
      return { valid: false, error: 'File name cannot contain path separators ("/" or "\\").' };
    }
    if (fileName.length > 255) {
      return { valid: false, error: 'File name must be 255 characters or fewer.' };
    }
    return { valid: true };
  }

  private async getFileRecord(fileName: string): Promise<StoredFile | undefined> {
    const db = await this.ensureDatabase();
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const index = store.index(INDEX_SESSION_FILE_NAME);
    const request = index.get([this.sessionId, fileName]);
    const file = await this.requestToPromise<StoredFile | undefined>(request);
    await this.transactionComplete(transaction);
    return file;
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
        logger.info('Initializing file storage database');
        if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          const store = db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
          store.createIndex(INDEX_SESSION_ID, 'sessionId', { unique: false });
          store.createIndex(INDEX_FILE_NAME, 'fileName', { unique: false });
          store.createIndex(INDEX_CREATED_AT, 'createdAt', { unique: false });
          store.createIndex(INDEX_SESSION_FILE_NAME, ['sessionId', 'fileName'], { unique: true });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        logger.warn('File storage database open request was blocked.');
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

  private calculateSize(content: string): number {
    try {
      return new TextEncoder().encode(content).length;
    } catch (error) {
      logger.warn('Falling back to length-based size calculation', { error });
      return content.length;
    }
  }

  private generateFileId(): string {
    return this.generateUUID();
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
