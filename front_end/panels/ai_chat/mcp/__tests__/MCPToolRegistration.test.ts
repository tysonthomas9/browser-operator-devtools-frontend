// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ToolRegistry } from '../../agent_framework/ConfigurableAgentTool.js';
import * as ToolNameMap from '../../core/ToolNameMap.js';
import { MCPToolAdapter } from '../MCPToolAdapter.js';

/* eslint-env mocha */

// Mock the MCP client and tool definition
const mockMCPClient = {
  call: () => Promise.resolve({}),
  isConnected: () => true,
  listTools: () => Promise.resolve([]),
  disconnect: () => {},
};

const createMockToolDef = (name: string) => ({
  name,
  description: `Test tool ${name}`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
});

describe('MCP Tool Registration', () => {
  beforeEach(() => {
    ToolNameMap.clear();
    // Clear any existing MCP tools from registry
    // Note: ToolRegistry doesn't have an unregister method,
    // so we'll just track what we register in tests
  });

  afterEach(() => {
    ToolNameMap.clear();
  });

  describe('Smart naming for MCP tools', () => {
    it('should register MCP tools with smart names (no conflicts)', () => {
      const serverId = 'mcp-test123';
      const toolDef = createMockToolDef('search');
      const namespacedName = `mcp:${serverId}:${toolDef.name}`;

      // Simulate what MCPRegistry does with smart naming
      const smartName = toolDef.name; // No conflicts, so use simple name

      console.log('Test 1 - Smart naming without conflicts:');
      console.log('  Server ID:', serverId);
      console.log('  Tool name:', toolDef.name);
      console.log('  Namespaced name:', namespacedName);
      console.log('  Smart name:', smartName);

      // Add mappings like MCPRegistry would
      ToolNameMap.addMapping(namespacedName);
      ToolNameMap.addMapping(smartName);

      // Register tool with smart name
      ToolRegistry.registerToolFactory(smartName, () => new MCPToolAdapter(serverId, mockMCPClient as any, toolDef, namespacedName));

      // Verify tool is registered with smart name
      const registeredTool = ToolRegistry.getRegisteredTool(smartName as any);
      console.log('  Tool registered:', !!registeredTool);
      assert.isNotNull(registeredTool, 'Tool should be registered with smart name');

      // Verify name mappings work
      const sanitizedNamespaced = ToolNameMap.getSanitized(namespacedName);
      const resolvedFromSanitized = ToolNameMap.resolveOriginal(sanitizedNamespaced);

      console.log('  Namespaced sanitized:', sanitizedNamespaced);
      console.log('  Resolved from sanitized:', resolvedFromSanitized);

      assert.strictEqual(resolvedFromSanitized, namespacedName);
    });

    it('should handle conflicts with numeric suffixes', () => {
      const server1Id = 'mcp-server1';
      const server2Id = 'mcp-server2';
      const toolName = 'search';

      const namespacedName1 = `mcp:${server1Id}:${toolName}`;
      const namespacedName2 = `mcp:${server2Id}:${toolName}`;

      // Simulate conflict resolution
      const smartName1 = toolName; // First occurrence gets simple name
      const smartName2 = `${toolName}_2`; // Second occurrence gets suffix

      console.log('Test 2 - Smart naming with conflicts:');
      console.log('  Server 1:', server1Id, 'Tool:', toolName, 'Smart name:', smartName1);
      console.log('  Server 2:', server2Id, 'Tool:', toolName, 'Smart name:', smartName2);

      // Add mappings
      ToolNameMap.addMapping(namespacedName1);
      ToolNameMap.addMapping(smartName1);
      ToolNameMap.addMapping(namespacedName2);
      ToolNameMap.addMapping(smartName2);

      // Register both tools
      const toolDef = createMockToolDef(toolName);
      ToolRegistry.registerToolFactory(smartName1, () => new MCPToolAdapter(server1Id, mockMCPClient as any, toolDef, namespacedName1));
      ToolRegistry.registerToolFactory(smartName2, () => new MCPToolAdapter(server2Id, mockMCPClient as any, toolDef, namespacedName2));

      // Verify both tools are registered with different names
      const tool1 = ToolRegistry.getRegisteredTool(smartName1 as any);
      const tool2 = ToolRegistry.getRegisteredTool(smartName2 as any);

      console.log('  Tool1 registered:', !!tool1);
      console.log('  Tool2 registered:', !!tool2);

      assert.isNotNull(tool1, 'First tool should be registered');
      assert.isNotNull(tool2, 'Second tool should be registered');
    });

    it('should handle the exact error case from logs', () => {
      const serverId = 'mcp-lusl1248if';
      const toolName = 'search';
      const namespacedName = `mcp:${serverId}:${toolName}`;
      const smartName = toolName;

      console.log('Test 3 - Exact error case:');
      console.log('  Requested in error:', namespacedName);
      console.log('  Server ID:', serverId);
      console.log('  Tool name:', toolName);
      console.log('  Expected smart name:', smartName);

      // Add mappings
      ToolNameMap.addMapping(namespacedName);
      ToolNameMap.addMapping(smartName);

      // Register with smart name (like our new logic should do)
      const toolDef = createMockToolDef(toolName);
      ToolRegistry.registerToolFactory(smartName, () => new MCPToolAdapter(serverId, mockMCPClient as any, toolDef, namespacedName));

      // Now test resolution - what happens when we try to find the tool?
      console.log('  --- Resolution test ---');

      // Try to find by namespaced name (what the error shows)
      const toolByNamespaced = ToolRegistry.getRegisteredTool(namespacedName as any);
      console.log('  Find by namespaced name:', !!toolByNamespaced);

      // Try to find by smart name (what should work)
      const toolBySmart = ToolRegistry.getRegisteredTool(smartName as any);
      console.log('  Find by smart name:', !!toolBySmart);

      // Try sanitized version
      const sanitized = ToolNameMap.getSanitized(namespacedName);
      const toolBySanitized = ToolRegistry.getRegisteredTool(sanitized as any);
      console.log('  Sanitized version:', sanitized);
      console.log('  Find by sanitized:', !!toolBySanitized);

      // The issue: tool is registered with smart name but being requested by namespaced name
      assert.isNull(toolByNamespaced, 'Tool should NOT be found by namespaced name');
      assert.isNotNull(toolBySmart, 'Tool SHOULD be found by smart name');

      console.log('  ISSUE IDENTIFIED: Tool registered as "' + smartName + '" but requested as "' + namespacedName + '"');
    });
  });

  describe('Name mapping verification', () => {
    it('should verify ToolNameMap handles MCP names correctly', () => {
      const testCases = [
        {
          original: 'mcp:mcp-lusl1248if:search',
          expectedSanitized: 'mcp_mcp-lusl1248if_search'
        },
        {
          original: 'mcp:80a92942-4bf9-4c02-ab11-422151bec3a2:notion_find_page_by_title',
          expectedSanitized: 'mcp_80a92942-4bf9-4c02-ab11-422151bec3a2_notion_find_page_by_title'
        },
        {
          original: 'search',
          expectedSanitized: 'search'
        }
      ];

      console.log('Test 4 - Name mapping verification:');

      testCases.forEach((testCase, index) => {
        const sanitized = ToolNameMap.getSanitized(testCase.original);
        const resolved = ToolNameMap.resolveOriginal(sanitized);

        console.log(`  Case ${index + 1}:`);
        console.log(`    Original: ${testCase.original}`);
        console.log(`    Sanitized: ${sanitized}`);
        console.log(`    Expected: ${testCase.expectedSanitized}`);
        console.log(`    Resolved: ${resolved}`);
        console.log(`    Bidirectional: ${resolved === testCase.original}`);

        assert.strictEqual(sanitized, testCase.expectedSanitized, `Sanitization failed for ${testCase.original}`);
        assert.strictEqual(resolved, testCase.original, `Resolution failed for ${testCase.original}`);
      });
    });
  });
});