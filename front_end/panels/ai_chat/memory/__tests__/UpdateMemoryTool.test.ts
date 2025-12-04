// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { UpdateMemoryTool } from '../UpdateMemoryTool.js';
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
    if (this.files.has(key)) {
      throw new Error(`File "${fileName}" already exists.`);
    }
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
    if (!this.files.has(key)) {
      throw new Error(`File "${fileName}" not found.`);
    }
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

describe('UpdateMemoryTool', () => {
  let mockFileStorageManager: MockFileStorageManager;
  let originalFileStorageGetInstance: typeof FileStorageManager.getInstance;
  let originalLocalStorage: Storage;
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>;
  let tool: UpdateMemoryTool;

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

    tool = new UpdateMemoryTool();
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
      assert.strictEqual(tool.name, 'update_memory');
    });

    it('has description', () => {
      assert.isString(tool.description);
      assert.isTrue(tool.description.length > 0);
      assert.isTrue(tool.description.includes('user'));
      assert.isTrue(tool.description.includes('facts'));
      assert.isTrue(tool.description.includes('project'));
    });

    it('has correct schema', () => {
      assert.deepEqual(tool.schema.type, 'object');
      assert.isObject(tool.schema.properties);
      assert.isObject((tool.schema.properties as any).blockType);
      assert.isObject((tool.schema.properties as any).content);
      assert.isObject((tool.schema.properties as any).projectName);
      assert.deepEqual(tool.schema.required, ['blockType', 'content']);
    });

    it('schema has blockType enum', () => {
      const blockType = (tool.schema.properties as any).blockType;
      assert.deepEqual(blockType.enum, ['user', 'facts', 'project']);
    });
  });

  describe('execute', () => {
    it('returns error when project block missing projectName', async () => {
      const result = await tool.execute({
        blockType: 'project',
        content: 'Project content',
      });

      assert.isFalse(result.success);
      assert.isTrue(result.message.includes('projectName'));
      assert.isTrue(result.error!.includes('projectName'));
    });

    it('updates user block successfully', async () => {
      const result = await tool.execute({
        blockType: 'user',
        content: 'User preferences here',
      });

      assert.isTrue(result.success);
      assert.isTrue(result.message.includes('user'));
      assert.isTrue(result.message.includes('22 chars'));

      // Verify file was created
      mockFileStorageManager.setSessionId('__global_memory__');
      const file = await mockFileStorageManager.readFile('memory_user.md');
      assert.strictEqual(file!.content, 'User preferences here');
    });

    it('updates facts block successfully', async () => {
      const result = await tool.execute({
        blockType: 'facts',
        content: 'Some important facts',
      });

      assert.isTrue(result.success);
      assert.isTrue(result.message.includes('facts'));

      mockFileStorageManager.setSessionId('__global_memory__');
      const file = await mockFileStorageManager.readFile('memory_facts.md');
      assert.strictEqual(file!.content, 'Some important facts');
    });

    it('updates project block with projectName', async () => {
      const result = await tool.execute({
        blockType: 'project',
        content: 'My app project context',
        projectName: 'my-app',
      });

      assert.isTrue(result.success);
      assert.isTrue(result.message.includes('project:my-app'));

      mockFileStorageManager.setSessionId('__global_memory__');
      const file = await mockFileStorageManager.readFile('memory_project_my_app.md');
      assert.strictEqual(file!.content, 'My app project context');
    });

    it('returns error when content exceeds limit', async () => {
      const oversizedContent = 'x'.repeat(20001);

      const result = await tool.execute({
        blockType: 'user',
        content: oversizedContent,
      });

      assert.isFalse(result.success);
      assert.isTrue(result.message.includes('exceeds'));
      assert.isString(result.error);
    });

    it('returns error when max project blocks reached', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      // Create 4 project blocks
      await mockFileStorageManager.createFile('memory_project_one.md', 'Project 1', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_two.md', 'Project 2', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_three.md', 'Project 3', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_four.md', 'Project 4', 'text/markdown');

      const result = await tool.execute({
        blockType: 'project',
        content: 'Fifth project',
        projectName: 'five',
      });

      assert.isFalse(result.success);
      assert.isTrue(result.message.includes('Max'));
    });

    it('updates existing block rather than creating new', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'Old content', 'text/markdown');

      const result = await tool.execute({
        blockType: 'user',
        content: 'New content',
      });

      assert.isTrue(result.success);

      const file = await mockFileStorageManager.readFile('memory_user.md');
      assert.strictEqual(file!.content, 'New content');
    });
  });
});
