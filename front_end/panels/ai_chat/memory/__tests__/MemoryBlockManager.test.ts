// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

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

  // Test helper to clear all files
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

describe('MemoryBlockManager', () => {
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
    // Restore FileStorageManager.getInstance
    FileStorageManager.getInstance = originalFileStorageGetInstance;

    // Restore localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });

    // Clear files
    mockFileStorageManager.clearAllFiles();
  });

  describe('getBlock', () => {
    it('returns null when block does not exist', async () => {
      const manager = new MemoryBlockManager();
      const block = await manager.getBlock('user');
      assert.isNull(block);
    });

    it('returns MemoryBlock when user file exists', async () => {
      // Create file in mock storage with global session
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User preferences here', 'text/markdown');

      const manager = new MemoryBlockManager();
      const block = await manager.getBlock('user');

      assert.isNotNull(block);
      assert.strictEqual(block!.type, 'user');
      assert.strictEqual(block!.content, 'User preferences here');
      assert.strictEqual(block!.label, 'user');
      assert.strictEqual(block!.filename, 'memory_user.md');
      assert.strictEqual(block!.charLimit, 20000);
    });

    it('returns project block with projectName', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_project_my_app.md', 'Project context', 'text/markdown');

      const manager = new MemoryBlockManager();
      const block = await manager.getBlock('project', 'my_app');

      assert.isNotNull(block);
      assert.strictEqual(block!.type, 'project');
      assert.strictEqual(block!.content, 'Project context');
      assert.strictEqual(block!.label, 'project:my_app');
    });
  });

  describe('updateBlock', () => {
    it('creates new block when it does not exist', async () => {
      const manager = new MemoryBlockManager();
      await manager.updateBlock('user', 'New user content');

      mockFileStorageManager.setSessionId('__global_memory__');
      const file = await mockFileStorageManager.readFile('memory_user.md');
      assert.isNotNull(file);
      assert.strictEqual(file!.content, 'New user content');
    });

    it('updates existing block', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_facts.md', 'Old facts', 'text/markdown');

      const manager = new MemoryBlockManager();
      await manager.updateBlock('facts', 'Updated facts');

      const file = await mockFileStorageManager.readFile('memory_facts.md');
      assert.strictEqual(file!.content, 'Updated facts');
    });

    it('throws when content exceeds limit', async () => {
      const manager = new MemoryBlockManager();
      const oversizedContent = 'x'.repeat(20001);

      try {
        await manager.updateBlock('user', oversizedContent);
        assert.fail('Expected error to be thrown');
      } catch (error: any) {
        assert.isTrue(error.message.includes('exceeds'));
        assert.isTrue(error.message.includes('20000'));
      }
    });

    it('throws when max project blocks reached', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      // Create 4 project blocks (the max)
      await mockFileStorageManager.createFile('memory_project_one.md', 'Project 1', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_two.md', 'Project 2', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_three.md', 'Project 3', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_four.md', 'Project 4', 'text/markdown');

      const manager = new MemoryBlockManager();

      try {
        await manager.updateBlock('project', 'Project 5 content', 'five');
        assert.fail('Expected error to be thrown');
      } catch (error: any) {
        assert.isTrue(error.message.includes('Max'));
        assert.isTrue(error.message.includes('4'));
      }
    });

    it('allows updating existing project block when at max', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_project_one.md', 'Project 1', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_two.md', 'Project 2', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_three.md', 'Project 3', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_four.md', 'Project 4', 'text/markdown');

      const manager = new MemoryBlockManager();
      // Should succeed since we're updating existing block
      await manager.updateBlock('project', 'Updated Project 1', 'one');

      const file = await mockFileStorageManager.readFile('memory_project_one.md');
      assert.strictEqual(file!.content, 'Updated Project 1');
    });
  });

  describe('deleteBlock', () => {
    it('removes existing block', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User data', 'text/markdown');

      const manager = new MemoryBlockManager();
      await manager.deleteBlock('user');

      const file = await mockFileStorageManager.readFile('memory_user.md');
      assert.isNull(file);
    });

    it('silently handles non-existent block', async () => {
      const manager = new MemoryBlockManager();
      // Should not throw
      await manager.deleteBlock('facts');
    });
  });

  describe('getAllBlocks', () => {
    it('returns empty array when no blocks exist', async () => {
      const manager = new MemoryBlockManager();
      const blocks = await manager.getAllBlocks();
      assert.isArray(blocks);
      assert.lengthOf(blocks, 0);
    });

    it('returns all memory blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User content', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', 'Facts content', 'text/markdown');

      const manager = new MemoryBlockManager();
      const blocks = await manager.getAllBlocks();

      assert.lengthOf(blocks, 2);
      const types = blocks.map(b => b.type);
      assert.isTrue(types.includes('user'));
      assert.isTrue(types.includes('facts'));
    });

    it('filters non-memory files', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User content', 'text/markdown');
      await mockFileStorageManager.createFile('other_file.txt', 'Other content', 'text/plain');

      const manager = new MemoryBlockManager();
      const blocks = await manager.getAllBlocks();

      assert.lengthOf(blocks, 1);
      assert.strictEqual(blocks[0].type, 'user');
    });
  });

  describe('listProjectBlocks', () => {
    it('returns only project blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User content', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', 'Facts content', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_app.md', 'App content', 'text/markdown');
      await mockFileStorageManager.createFile('memory_project_web.md', 'Web content', 'text/markdown');

      const manager = new MemoryBlockManager();
      const projectBlocks = await manager.listProjectBlocks();

      assert.lengthOf(projectBlocks, 2);
      assert.isTrue(projectBlocks.every(b => b.type === 'project'));
    });

    it('returns empty array when no project blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User content', 'text/markdown');

      const manager = new MemoryBlockManager();
      const projectBlocks = await manager.listProjectBlocks();

      assert.lengthOf(projectBlocks, 0);
    });
  });

  describe('searchBlocks', () => {
    it('returns empty when no matches', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User preferences', 'text/markdown');

      const manager = new MemoryBlockManager();
      const results = await manager.searchBlocks('nonexistent');

      assert.isArray(results);
      assert.lengthOf(results, 0);
    });

    it('finds case-insensitive matches', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User likes TypeScript', 'text/markdown');

      const manager = new MemoryBlockManager();
      const results = await manager.searchBlocks('typescript');

      assert.lengthOf(results, 1);
      assert.strictEqual(results[0].block.type, 'user');
      assert.lengthOf(results[0].matches, 1);
      assert.isTrue(results[0].matches[0].includes('TypeScript'));
    });

    it('returns matches from multiple blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'Prefers React framework', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', 'Uses React and Vue', 'text/markdown');

      const manager = new MemoryBlockManager();
      const results = await manager.searchBlocks('react');

      assert.lengthOf(results, 2);
    });

    it('returns matching lines only', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'Line 1: hello\nLine 2: world\nLine 3: hello again', 'text/markdown');

      const manager = new MemoryBlockManager();
      const results = await manager.searchBlocks('hello');

      assert.lengthOf(results, 1);
      assert.lengthOf(results[0].matches, 2);
    });
  });

  describe('compileMemoryContext', () => {
    it('returns empty string when no blocks', async () => {
      const manager = new MemoryBlockManager();
      const context = await manager.compileMemoryContext();
      assert.strictEqual(context, '');
    });

    it('returns XML with all blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User data', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', 'Some facts', 'text/markdown');

      const manager = new MemoryBlockManager();
      const context = await manager.compileMemoryContext();

      assert.isTrue(context.startsWith('<Memory>'));
      assert.isTrue(context.endsWith('</Memory>'));
      assert.isTrue(context.includes('<user>'));
      assert.isTrue(context.includes('</user>'));
      assert.isTrue(context.includes('<facts>'));
      assert.isTrue(context.includes('</facts>'));
      assert.isTrue(context.includes('User data'));
      assert.isTrue(context.includes('Some facts'));
    });

    it('skips empty blocks', async () => {
      mockFileStorageManager.setSessionId('__global_memory__');
      await mockFileStorageManager.createFile('memory_user.md', 'User data', 'text/markdown');
      await mockFileStorageManager.createFile('memory_facts.md', '   ', 'text/markdown');

      const manager = new MemoryBlockManager();
      const context = await manager.compileMemoryContext();

      assert.isTrue(context.includes('<user>'));
      assert.isFalse(context.includes('<facts>'));
    });
  });

  describe('session management', () => {
    it('uses global session for all operations', async () => {
      // Start with a different session
      mockFileStorageManager.setSessionId('other-session');
      await mockFileStorageManager.createFile('memory_user.md', 'Other session data', 'text/markdown');

      // Create block via manager (should use global session)
      const manager = new MemoryBlockManager();
      await manager.updateBlock('user', 'Global session data');

      // Verify data is in global session
      mockFileStorageManager.setSessionId('__global_memory__');
      const globalFile = await mockFileStorageManager.readFile('memory_user.md');
      assert.strictEqual(globalFile!.content, 'Global session data');

      // Verify other session data is unchanged
      mockFileStorageManager.setSessionId('other-session');
      const otherFile = await mockFileStorageManager.readFile('memory_user.md');
      assert.strictEqual(otherFile!.content, 'Other session data');
    });

    it('restores original session after operation', async () => {
      mockFileStorageManager.setSessionId('original-session');

      const manager = new MemoryBlockManager();
      await manager.updateBlock('user', 'Some content');

      // Session should be restored
      assert.strictEqual(mockFileStorageManager.getSessionId(), 'original-session');
    });
  });
});
