// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ToolRegistry } from '../../src/tools/ToolRegistry';
import type { Tool } from '../../src/tools/Tool';

// Mock tool for testing
class MockTool implements Tool {
  name = 'mock_tool';
  description = 'A mock tool for testing';
  schema = {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  };

  async execute(args: Record<string, unknown>): Promise<{ output: string }> {
    const input = args.input as string;
    return { output: `Processed: ${input}` };
  }
}

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    ToolRegistry.clear();
  });

  afterEach(() => {
    // Clean up after each test
    ToolRegistry.clear();
  });

  describe('Registration', () => {
    it('should register a tool successfully', () => {
      const factory = () => new MockTool();
      ToolRegistry.registerToolFactory('mock_tool', factory);

      expect(ToolRegistry.hasTool('mock_tool')).toBe(true);
    });

    it('should create and cache instance on registration', () => {
      const factory = () => new MockTool();
      ToolRegistry.registerToolFactory('mock_tool', factory);

      const instance = ToolRegistry.getRegisteredTool('mock_tool');
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('mock_tool');
    });

    it('should warn when overwriting existing tool', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      ToolRegistry.registerToolFactory('mock_tool', () => new MockTool());
      ToolRegistry.registerToolFactory('mock_tool', () => new MockTool());

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle factory instantiation errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const factory = () => {
        throw new Error('Instantiation failed');
      };

      ToolRegistry.registerToolFactory('bad_tool', factory);

      expect(ToolRegistry.hasTool('bad_tool')).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Retrieval', () => {
    it('should retrieve tool instance', () => {
      ToolRegistry.registerToolFactory('mock_tool', () => new MockTool());

      const instance = ToolRegistry.getToolInstance('mock_tool');
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('mock_tool');
    });

    it('should return null for non-existent tool', () => {
      const instance = ToolRegistry.getToolInstance('non_existent');
      expect(instance).toBeNull();
    });

    it('should retrieve registered tool', () => {
      ToolRegistry.registerToolFactory('mock_tool', () => new MockTool());

      const instance = ToolRegistry.getRegisteredTool('mock_tool');
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('mock_tool');
    });

    it('should return null for non-registered tool', () => {
      const instance = ToolRegistry.getRegisteredTool('non_existent');
      expect(instance).toBeNull();
    });
  });

  describe('Listing', () => {
    it('should list all registered tool names', () => {
      ToolRegistry.registerToolFactory('tool1', () => new MockTool());
      ToolRegistry.registerToolFactory('tool2', () => new MockTool());

      const names = ToolRegistry.getRegisteredToolNames();
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
      expect(names).toHaveLength(2);
    });

    it('should get all registered tool instances', () => {
      ToolRegistry.registerToolFactory('tool1', () => new MockTool());
      ToolRegistry.registerToolFactory('tool2', () => new MockTool());

      const instances = ToolRegistry.getAllRegisteredTools();
      expect(instances).toHaveLength(2);
    });

    it('should return empty arrays when no tools registered', () => {
      const names = ToolRegistry.getRegisteredToolNames();
      const instances = ToolRegistry.getAllRegisteredTools();

      expect(names).toEqual([]);
      expect(instances).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should provide registry statistics', () => {
      ToolRegistry.registerToolFactory('tool1', () => new MockTool());
      ToolRegistry.registerToolFactory('tool2', () => new MockTool());

      const stats = ToolRegistry.getStats();
      expect(stats.toolCount).toBe(2);
      expect(stats.toolNames).toContain('tool1');
      expect(stats.toolNames).toContain('tool2');
    });

    it('should return zero count when empty', () => {
      const stats = ToolRegistry.getStats();
      expect(stats.toolCount).toBe(0);
      expect(stats.toolNames).toEqual([]);
    });
  });

  describe('Unregistration', () => {
    it('should unregister a tool', () => {
      ToolRegistry.registerToolFactory('mock_tool', () => new MockTool());
      expect(ToolRegistry.hasTool('mock_tool')).toBe(true);

      const result = ToolRegistry.unregisterTool('mock_tool');
      expect(result).toBe(true);
      expect(ToolRegistry.hasTool('mock_tool')).toBe(false);
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = ToolRegistry.unregisterTool('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    it('should register multiple tools at once', () => {
      const tools = {
        tool1: () => new MockTool(),
        tool2: () => new MockTool(),
        tool3: () => new MockTool(),
      };

      ToolRegistry.registerTools(tools);

      expect(ToolRegistry.hasTool('tool1')).toBe(true);
      expect(ToolRegistry.hasTool('tool2')).toBe(true);
      expect(ToolRegistry.hasTool('tool3')).toBe(true);
    });
  });

  describe('Clear', () => {
    it('should clear all tools', () => {
      ToolRegistry.registerToolFactory('tool1', () => new MockTool());
      ToolRegistry.registerToolFactory('tool2', () => new MockTool());

      expect(ToolRegistry.getStats().toolCount).toBe(2);

      ToolRegistry.clear();

      expect(ToolRegistry.getStats().toolCount).toBe(0);
      expect(ToolRegistry.hasTool('tool1')).toBe(false);
      expect(ToolRegistry.hasTool('tool2')).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    it('should execute registered tool', async () => {
      ToolRegistry.registerToolFactory('mock_tool', () => new MockTool());

      const tool = ToolRegistry.getToolInstance('mock_tool');
      const result = await tool?.execute({ input: 'test' });

      expect(result).toEqual({ output: 'Processed: test' });
    });
  });
});
