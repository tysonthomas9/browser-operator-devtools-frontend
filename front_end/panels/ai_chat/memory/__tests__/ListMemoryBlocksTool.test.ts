// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ListMemoryBlocksTool } from '../ListMemoryBlocksTool.js';
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

describe('ListMemoryBlocksTool', () => {
  let mockFileStorageManager: MockFileStorageManager;
  let originalFileStorageGetInstance: typeof FileStorageManager.getInstance;
  let originalLocalStorage: Storage;
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>;
  let tool: ListMemoryBlocksTool;

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

    tool = new ListMemoryBlocksTool();
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
      assert.strictEqual(tool.name, 'list_memory_blocks');
    });

    it('has description', () => {
      assert.isString(tool.description);
      assert.isTrue(tool.description.length > 0);
    });

    it('has empty required array in schema', () => {
      assert.deepEqual(tool.schema.type, 'object');
      assert.deepEqual(tool.schema.required, []);
    });
  });

  describe('execute', () => {
    it('returns empty blocks array when none exist', async () => {
      const result = await tool.execute({});

      assert.isTrue(result.success);
      assert.isArray(result.blocks);
      assert.lengthOf(result.blocks, 0);
      assert.strictEqual(result.summary.totalBlocks, 0);
      assert.strictEqual(result.summary.totalChars, 0);
    });

    it('returns formatted blocks with metadata', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User preferences', 'text/markdown');

      const result = await tool.execute({});

      assert.isTrue(result.success);
      assert.lengthOf(result.blocks, 1);

      const block = result.blocks[0];
      assert.strictEqual(block.type, 'user');
      assert.strictEqual(block.label, 'user');
      assert.strictEqual(block.content, 'User preferences');
      assert.strictEqual(block.charCount, 16);
      assert.strictEqual(block.charLimit, 20000);
      assert.isString(block.updatedAt);
    });

    it('returns all blocks with correct types', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User data', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', 'Some facts', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_app.md', 'App context', 'text/markdown');

      const result = await tool.execute({});

      assert.isTrue(result.success);
      assert.lengthOf(result.blocks, 3);

      const types = result.blocks.map(b => b.type);
      assert.isTrue(types.includes('user'));
      assert.isTrue(types.includes('facts'));
      assert.isTrue(types.includes('project'));
    });

    it('includes summary with correct totals', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', '12345', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', '67890', 'text/markdown');

      const result = await tool.execute({});

      assert.strictEqual(result.summary.totalBlocks, 2);
      assert.strictEqual(result.summary.totalChars, 10);
    });

    it('calculates maxChars as 120000', async () => {
      const result = await tool.execute({});

      assert.strictEqual(result.summary.maxChars, 120000);
    });

    it('returns error result on failure', async () => {
      // Force an error
      const originalListFiles = mockFileStorageManager.listFiles.bind(mockFileStorageManager);
      mockFileStorageManager.listFiles = async () => {
        throw new Error('Storage failure');
      };

      const result = await tool.execute({});

      assert.isFalse(result.success);
      assert.lengthOf(result.blocks, 0);
      assert.isString(result.error);
      assert.isTrue(result.error!.includes('Storage failure'));

      // Note: error case has different maxChars in implementation (9500)
      assert.strictEqual(result.summary.totalBlocks, 0);
      assert.strictEqual(result.summary.totalChars, 0);

      mockFileStorageManager.listFiles = originalListFiles;
    });

    it('formats updatedAt as ISO string', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'Content', 'text/markdown');

      const result = await tool.execute({});

      const block = result.blocks[0];
      // Should be valid ISO date string
      const date = new Date(block.updatedAt);
      assert.isFalse(isNaN(date.getTime()));
      assert.isTrue(block.updatedAt.includes('T'));
    });
  });
});
