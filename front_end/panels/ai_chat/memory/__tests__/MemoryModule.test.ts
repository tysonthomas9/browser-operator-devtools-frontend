// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { MemoryModule } from '../MemoryModule.js';

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

describe('MemoryModule', () => {
  let originalLocalStorage: Storage;
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    // Save original localStorage and replace with mock
    originalLocalStorage = globalThis.localStorage;
    mockLocalStorage = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Reset singleton instance by accessing private static property
    (MemoryModule as any).instance = null;
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('getInstance', () => {
    it('returns a MemoryModule instance', () => {
      const instance = MemoryModule.getInstance();
      assert.isNotNull(instance);
      assert.isFunction(instance.isEnabled);
      assert.isFunction(instance.getConfig);
    });

    it('returns the same instance on multiple calls', () => {
      const instance1 = MemoryModule.getInstance();
      const instance2 = MemoryModule.getInstance();
      assert.strictEqual(instance1, instance2);
    });
  });

  describe('isEnabled', () => {
    it('returns true by default when localStorage has no value', () => {
      const module = MemoryModule.getInstance();
      assert.isTrue(module.isEnabled());
    });

    it('returns true when localStorage value is not "false"', () => {
      mockLocalStorage.setItem('ai_chat_memory_enabled', 'true');
      const module = MemoryModule.getInstance();
      assert.isTrue(module.isEnabled());
    });

    it('returns false when localStorage has "false"', () => {
      mockLocalStorage.setItem('ai_chat_memory_enabled', 'false');
      const module = MemoryModule.getInstance();
      assert.isFalse(module.isEnabled());
    });
  });

  describe('setEnabled', () => {
    it('persists true to localStorage', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(true);
      assert.strictEqual(mockLocalStorage.getItem('ai_chat_memory_enabled'), 'true');
    });

    it('persists false to localStorage', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(false);
      assert.strictEqual(mockLocalStorage.getItem('ai_chat_memory_enabled'), 'false');
    });

    it('updates isEnabled result after setEnabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(false);
      assert.isFalse(module.isEnabled());
      module.setEnabled(true);
      assert.isTrue(module.isEnabled());
    });
  });

  describe('getInstructions', () => {
    it('returns memory instructions when enabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(true);
      const instructions = module.getInstructions();
      assert.isString(instructions);
      assert.isTrue(instructions.length > 0);
      assert.isTrue(instructions.includes('<memory>'));
      assert.isTrue(instructions.includes('persistent memory system'));
    });

    it('returns empty string when disabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(false);
      const instructions = module.getInstructions();
      assert.strictEqual(instructions, '');
    });
  });

  describe('shouldIncludeMemoryTool', () => {
    it('returns true when enabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(true);
      assert.isTrue(module.shouldIncludeMemoryTool());
    });

    it('returns false when disabled', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(false);
      assert.isFalse(module.shouldIncludeMemoryTool());
    });

    it('matches isEnabled behavior', () => {
      const module = MemoryModule.getInstance();
      module.setEnabled(true);
      assert.strictEqual(module.shouldIncludeMemoryTool(), module.isEnabled());
      module.setEnabled(false);
      assert.strictEqual(module.shouldIncludeMemoryTool(), module.isEnabled());
    });
  });

  describe('getBlockLimit', () => {
    it('returns 20000 for user block type', () => {
      const module = MemoryModule.getInstance();
      assert.strictEqual(module.getBlockLimit('user'), 20000);
    });

    it('returns 20000 for facts block type', () => {
      const module = MemoryModule.getInstance();
      assert.strictEqual(module.getBlockLimit('facts'), 20000);
    });

    it('returns 20000 for project block type', () => {
      const module = MemoryModule.getInstance();
      assert.strictEqual(module.getBlockLimit('project'), 20000);
    });
  });

  describe('getMaxProjectBlocks', () => {
    it('returns 4', () => {
      const module = MemoryModule.getInstance();
      assert.strictEqual(module.getMaxProjectBlocks(), 4);
    });
  });

  describe('getSessionId', () => {
    it('returns __global_memory__', () => {
      const module = MemoryModule.getInstance();
      assert.strictEqual(module.getSessionId(), '__global_memory__');
    });
  });

  describe('getConfig', () => {
    it('returns a complete config object', () => {
      const module = MemoryModule.getInstance();
      const config = module.getConfig();

      assert.isObject(config);
      assert.deepEqual(config.blockLimits, {
        user: 20000,
        facts: 20000,
        project: 20000,
      });
      assert.strictEqual(config.maxProjectBlocks, 4);
      assert.strictEqual(config.sessionId, '__global_memory__');
      assert.strictEqual(config.enabledKey, 'ai_chat_memory_enabled');
    });
  });
});
