// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { SearchMemoryTool } from '../SearchMemoryTool.js';
import { MemoryBlockManager } from '../MemoryBlockManager.js';
import { FileStorageManager } from '../../tools/FileStorageManager.js';
import { MemoryModule } from '../MemoryModule.js';
import type { StoredFile, FileSummary } from '../../tools/FileStorageManager.js';

// Mock FileStorageManager
class MockFileStorageManager {
  private files: Map<string, StoredFile> = new Map();
  private currentSessionId = 'test-session';

  getSessionId(): string {
    return this.currentSessionId;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  async readFile(fileName: string): Promise<StoredFile | null> {
    const key = `${this.currentSessionId}:${fileName}`;
    return this.files.get(key) || null;
  }

  async createFile(fileName: string, content: string, mimeType: string): Promise<StoredFile> {
    const key = `${this.currentSessionId}:${fileName}`;
    const now = Date.now();
    const file: StoredFile = {
      id: `id-${fileName}`,
      sessionId: this.currentSessionId,
      fileName,
      content,
      mimeType,
      createdAt: now,
      updatedAt: now,
      size: content.length,
    };
    this.files.set(key, file);
    return file;
  }

  async updateFile(fileName: string, content: string): Promise<StoredFile> {
    const key = `${this.currentSessionId}:${fileName}`;
    const existing = this.files.get(key);
    if (!existing) {
      throw new Error(`File "${fileName}" not found.`);
    }
    const updated: StoredFile = { ...existing, content, updatedAt: Date.now(), size: content.length };
    this.files.set(key, updated);
    return updated;
  }

  async deleteFile(fileName: string): Promise<void> {
    const key = `${this.currentSessionId}:${fileName}`;
    this.files.delete(key);
  }

  async listFiles(): Promise<FileSummary[]> {
    const summaries: FileSummary[] = [];
    for (const [key, file] of this.files.entries()) {
      if (key.startsWith(`${this.currentSessionId}:`)) {
        summaries.push({
          fileName: file.fileName,
          size: file.size,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        });
      }
    }
    return summaries;
  }

  clearAllFiles(): void {
    this.files.clear();
  }
}

// Mock localStorage
const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => { store[key] = value; },
    removeItem: (key: string): void => { delete store[key]; },
    clear: (): void => { Object.keys(store).forEach(k => delete store[k]); },
    get length(): number { return Object.keys(store).length; },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
  };
};

describe('SearchMemoryTool', () => {
  let mockFileStorageManager: MockFileStorageManager;
  let originalFileStorageGetInstance: typeof FileStorageManager.getInstance;
  let originalLocalStorage: Storage;
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>;
  let tool: SearchMemoryTool;

  beforeEach(() => {
    // Reset MemoryModule singleton
    (MemoryModule as any).instance = null;

    // Mock localStorage
    originalLocalStorage = globalThis.localStorage;
    mockLocalStorage = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Mock FileStorageManager.getInstance
    mockFileStorageManager = new MockFileStorageManager();
    originalFileStorageGetInstance = FileStorageManager.getInstance;
    FileStorageManager.getInstance = () => mockFileStorageManager as unknown as FileStorageManager;

    tool = new SearchMemoryTool();
  });

  afterEach(() => {
    FileStorageManager.getInstance = originalFileStorageGetInstance;
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    mockFileStorageManager.clearAllFiles();
  });

  describe('tool metadata', () => {
    it('has correct name', () => {
      assert.strictEqual(tool.name, 'search_memory');
    });

    it('has description', () => {
      assert.isString(tool.description);
      assert.isTrue(tool.description.length > 0);
    });

    it('has correct schema with required query field', () => {
      assert.deepEqual(tool.schema.type, 'object');
      assert.isObject(tool.schema.properties);
      assert.isObject((tool.schema.properties as any).query);
      assert.deepEqual(tool.schema.required, ['query']);
    });
  });

  describe('execute', () => {
    it('returns success with matching results', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User likes TypeScript', 'text/markdown');

      const result = await tool.execute({ query: 'typescript' });

      assert.isTrue(result.success);
      assert.strictEqual(result.count, 1);
      assert.lengthOf(result.results, 1);
      assert.strictEqual(result.results[0].block, 'user');
      assert.isTrue(result.results[0].matches[0].includes('TypeScript'));
    });

    it('returns empty results when no matches', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User preferences', 'text/markdown');

      const result = await tool.execute({ query: 'nonexistent' });

      assert.isTrue(result.success);
      assert.strictEqual(result.count, 0);
      assert.lengthOf(result.results, 0);
    });

    it('limits to 5 matches per block', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      // Create content with more than 5 matching lines
      const content = Array(10).fill('match line').join('\n');
      await mockFileStorageManager.createFile('memory_user.md', content, 'text/markdown');

      const result = await tool.execute({ query: 'match' });

      assert.isTrue(result.success);
      assert.strictEqual(result.count, 1);
      assert.lengthOf(result.results[0].matches, 5);
    });

    it('returns results from multiple blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'Uses React', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', 'React is popular', 'text/markdown');

      const result = await tool.execute({ query: 'react' });

      assert.isTrue(result.success);
      assert.strictEqual(result.count, 2);
      const blocks = result.results.map(r => r.block);
      assert.isTrue(blocks.includes('user'));
      assert.isTrue(blocks.includes('facts'));
    });

    it('returns error result on failure', async () => {
      // Force an error by making FileStorageManager throw
      const originalListFiles = mockFileStorageManager.listFiles.bind(mockFileStorageManager);
      mockFileStorageManager.listFiles = async () => {
        throw new Error('Database error');
      };

      const result = await tool.execute({ query: 'test' });

      assert.isFalse(result.success);
      assert.strictEqual(result.count, 0);
      assert.lengthOf(result.results, 0);
      assert.isString(result.error);
      assert.isTrue(result.error!.includes('Database error'));

      // Restore
      mockFileStorageManager.listFiles = originalListFiles;
    });
  });
});
