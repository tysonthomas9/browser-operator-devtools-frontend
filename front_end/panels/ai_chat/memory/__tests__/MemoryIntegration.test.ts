// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Integration tests for the memory module.
 * These tests verify that components work together correctly.
 */

import { MemoryModule } from '../MemoryModule.js';
import { MemoryBlockManager } from '../MemoryBlockManager.js';
import { SearchMemoryTool } from '../SearchMemoryTool.js';
import { UpdateMemoryTool } from '../UpdateMemoryTool.js';
import { ListMemoryBlocksTool } from '../ListMemoryBlocksTool.js';
import { FileStorageManager } from '../../tools/FileStorageManager.js';
import type { StoredFile, FileSummary } from '../../tools/FileStorageManager.js';

// Mock FileStorageManager with full functionality
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
      id: `id-${Math.random().toString(36).substr(2, 9)}`,
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

  async updateFile(fileName: string, content: string, _append = false): Promise<StoredFile> {
    const key = `${this.currentSessionId}:${fileName}`;
    const existing = this.files.get(key);
    if (!existing) {
      throw new Error(`File "${fileName}" not found.`);
    }
    const updated: StoredFile = {
      ...existing,
      content,
      updatedAt: Date.now(),
      size: content.length,
    };
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

describe('Memory Module Integration', () => {
  let mockFileStorageManager: MockFileStorageManager;
  let originalFileStorageGetInstance: typeof FileStorageManager.getInstance;
  let originalLocalStorage: Storage;
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>;

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

  describe('End-to-End Workflows', () => {
    it('creates user block and searches for content', async () => {
      const updateTool = new UpdateMemoryTool();
      const searchTool = new SearchMemoryTool();

      // Create block
      const updateResult = await updateTool.execute({
        blockType: 'user',
        content: 'Tyson prefers TypeScript and React',
      });
      assert.isTrue(updateResult.success);

      // Search for content
      const searchResult = await searchTool.execute({ query: 'TypeScript' });
      assert.isTrue(searchResult.success);
      assert.strictEqual(searchResult.count, 1);
      assert.isTrue(searchResult.results[0].matches[0].includes('TypeScript'));
    });

    it('creates multiple project blocks and lists them', async () => {
      const updateTool = new UpdateMemoryTool();
      const listTool = new ListMemoryBlocksTool();

      // Create project blocks
      await updateTool.execute({
        blockType: 'project',
        content: 'Browser extension project',
        projectName: 'extension',
      });
      await updateTool.execute({
        blockType: 'project',
        content: 'Mobile app project',
        projectName: 'mobile',
      });

      // List all blocks
      const listResult = await listTool.execute({});
      assert.isTrue(listResult.success);
      assert.strictEqual(listResult.summary.totalBlocks, 2);

      const labels = listResult.blocks.map(b => b.label);
      assert.isTrue(labels.includes('project:extension'));
      assert.isTrue(labels.includes('project:mobile'));
    });

    it('updates existing block and verifies content replaced', async () => {
      const updateTool = new UpdateMemoryTool();
      const listTool = new ListMemoryBlocksTool();

      // Create initial block
      await updateTool.execute({
        blockType: 'facts',
        content: 'Original facts here',
      });

      // Update block
      await updateTool.execute({
        blockType: 'facts',
        content: 'Updated facts content',
      });

      // Verify updated content
      const listResult = await listTool.execute({});
      const factsBlock = listResult.blocks.find(b => b.type === 'facts');
      assert.strictEqual(factsBlock!.content, 'Updated facts content');
    });

    it('enforces max project blocks limit', async () => {
      const updateTool = new UpdateMemoryTool();

      // Create 4 project blocks (the max)
      for (let i = 1; i <= 4; i++) {
        const result = await updateTool.execute({
          blockType: 'project',
          content: `Project ${i} content`,
          projectName: `project${i}`,
        });
        assert.isTrue(result.success);
      }

      // Try to create 5th project - should fail
      const fifthResult = await updateTool.execute({
        blockType: 'project',
        content: 'Project 5 content',
        projectName: 'project5',
      });
      assert.isFalse(fifthResult.success);
      assert.isTrue(fifthResult.error!.includes('Max'));
    });

    it('enforces character limit', async () => {
      const updateTool = new UpdateMemoryTool();
      const oversizedContent = 'x'.repeat(20001);

      const result = await updateTool.execute({
        blockType: 'user',
        content: oversizedContent,
      });

      assert.isFalse(result.success);
      assert.isTrue(result.error!.includes('exceeds'));
    });

    it('compiles memory context with multiple block types', async () => {
      const updateTool = new UpdateMemoryTool();
      const manager = new MemoryBlockManager();

      // Create blocks of different types
      await updateTool.execute({
        blockType: 'user',
        content: 'User: Tyson',
      });
      await updateTool.execute({
        blockType: 'facts',
        content: 'Fact: Uses VSCode',
      });
      await updateTool.execute({
        blockType: 'project',
        content: 'Project: Browser',
        projectName: 'browser',
      });

      // Compile context
      const context = await manager.compileMemoryContext();

      assert.isTrue(context.includes('<Memory>'));
      assert.isTrue(context.includes('</Memory>'));
      assert.isTrue(context.includes('<user>'));
      assert.isTrue(context.includes('User: Tyson'));
      assert.isTrue(context.includes('<facts>'));
      assert.isTrue(context.includes('Fact: Uses VSCode'));
      assert.isTrue(context.includes('<project:browser>'));
      assert.isTrue(context.includes('Project: Browser'));
    });
  });

  describe('Tool Interactions', () => {
    it('UpdateMemoryTool creates block that ListMemoryBlocksTool shows', async () => {
      const updateTool = new UpdateMemoryTool();
      const listTool = new ListMemoryBlocksTool();

      // Initially no blocks
      const initialList = await listTool.execute({});
      assert.lengthOf(initialList.blocks, 0);

      // Create block
      await updateTool.execute({
        blockType: 'user',
        content: 'New user data',
      });

      // Now shows in list
      const afterList = await listTool.execute({});
      assert.lengthOf(afterList.blocks, 1);
      assert.strictEqual(afterList.blocks[0].content, 'New user data');
    });

    it('UpdateMemoryTool creates block that SearchMemoryTool finds', async () => {
      const updateTool = new UpdateMemoryTool();
      const searchTool = new SearchMemoryTool();

      // Create block with specific content
      await updateTool.execute({
        blockType: 'facts',
        content: 'The quick brown fox jumps over the lazy dog',
      });

      // Search finds it
      const searchResult = await searchTool.execute({ query: 'brown fox' });
      assert.isTrue(searchResult.success);
      assert.strictEqual(searchResult.count, 1);
    });

    it('multiple tools operating on same block sequentially', async () => {
      const updateTool = new UpdateMemoryTool();
      const searchTool = new SearchMemoryTool();
      const listTool = new ListMemoryBlocksTool();

      // Create
      await updateTool.execute({
        blockType: 'user',
        content: 'Version 1',
      });

      // Search
      let searchResult = await searchTool.execute({ query: 'Version 1' });
      assert.strictEqual(searchResult.count, 1);

      // Update
      await updateTool.execute({
        blockType: 'user',
        content: 'Version 2',
      });

      // Old search fails
      searchResult = await searchTool.execute({ query: 'Version 1' });
      assert.strictEqual(searchResult.count, 0);

      // New search succeeds
      searchResult = await searchTool.execute({ query: 'Version 2' });
      assert.strictEqual(searchResult.count, 1);

      // List shows updated content
      const listResult = await listTool.execute({});
      assert.strictEqual(listResult.blocks[0].content, 'Version 2');
    });
  });

  describe('Session Isolation', () => {
    it('global memory session is isolated from other sessions', async () => {
      const manager = new MemoryBlockManager();

      // Create block via manager (uses global session)
      await manager.updateBlock('user', 'Global memory data');

      // Switch to different session and create file directly
      mockFileStorageManager.setSessionId('conversation-123');
      await mockFileStorageManager.createFile('memory_user.md', 'Conversation data', 'text/markdown');

      // Manager should only see global memory
      const blocks = await manager.getAllBlocks();
      assert.lengthOf(blocks, 1);
      assert.strictEqual(blocks[0].content, 'Global memory data');
    });
  });

  describe('MemoryModule Integration', () => {
    it('getInstructions returns content when enabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(true);

      const instructions = module.getInstructions();
      assert.isTrue(instructions.includes('<memory>'));
      assert.isTrue(instructions.includes('persistent memory system'));
    });

    it('getInstructions returns empty when disabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(false);

      const instructions = module.getInstructions();
      assert.strictEqual(instructions, '');
    });

    it('block limits are correctly enforced', async () => {
      const updateTool = new UpdateMemoryTool();
      const module = MemoryModule.getInstance();

      // Get the actual limit
      const limit = module.getBlockLimit('user');
      assert.strictEqual(limit, 20000);

      // Content at limit should succeed
      const atLimitResult = await updateTool.execute({
        blockType: 'user',
        content: 'x'.repeat(20000),
      });
      assert.isTrue(atLimitResult.success);

      // Content over limit should fail
      const overLimitResult = await updateTool.execute({
        blockType: 'facts',
        content: 'x'.repeat(20001),
      });
      assert.isFalse(overLimitResult.success);
    });
  });

  describe('Error Propagation', () => {
    it('MemoryBlockManager errors propagate through tools', async () => {
      const updateTool = new UpdateMemoryTool();

      // Create 4 project blocks
      for (let i = 0; i < 4; i++) {
        await updateTool.execute({
          blockType: 'project',
          content: `Project ${i}`,
          projectName: `proj${i}`,
        });
      }

      // 5th should fail with proper error message
      const result = await updateTool.execute({
        blockType: 'project',
        content: 'Too many',
        projectName: 'toomany',
      });

      assert.isFalse(result.success);
      assert.isString(result.error);
      assert.isTrue(result.message.includes('Max') || result.message.includes('4'));
    });
  });
});
