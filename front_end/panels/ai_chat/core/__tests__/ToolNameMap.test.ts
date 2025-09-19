// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ToolNameMap from '../ToolNameMap.js';

/* eslint-env mocha */

describe('ToolNameMap', () => {
  beforeEach(() => {
    ToolNameMap.clear();
  });

  afterEach(() => {
    ToolNameMap.clear();
  });

  describe('MCP tool name handling', () => {
    it('should handle MCP tool names with colons and hyphens', () => {
      const original = 'mcp:mcp-lusl1248if:search';
      const sanitized = ToolNameMap.getSanitized(original);

      console.log('Test 1 - Basic MCP name:');
      console.log('  Original:', original);
      console.log('  Sanitized:', sanitized);
      console.log('  Expected: mcp_mcp-lusl1248if_search');

      // Should replace colons with underscores but keep hyphens
      assert.strictEqual(sanitized, 'mcp_mcp-lusl1248if_search');

      // Should be able to resolve back
      const resolved = ToolNameMap.resolveOriginal(sanitized);
      console.log('  Resolved back:', resolved);
      assert.strictEqual(resolved, original);
    });

    it('should handle long MCP tool names without truncation', () => {
      const original = 'mcp:80a92942-4bf9-4c02-ab11-422151bec3a2:notion_find_page_by_title';
      const sanitized = ToolNameMap.getSanitized(original);

      console.log('Test 2 - Long MCP name:');
      console.log('  Original:', original);
      console.log('  Sanitized:', sanitized);
      console.log('  Length:', sanitized.length);

      // Should not be truncated (our fix removed 64-char limit)
      const expected = 'mcp_80a92942-4bf9-4c02-ab11-422151bec3a2_notion_find_page_by_title';
      assert.strictEqual(sanitized, expected);
      assert.isTrue(sanitized.length > 64, 'Should not be truncated at 64 characters');

      // Should be able to resolve back
      const resolved = ToolNameMap.resolveOriginal(sanitized);
      console.log('  Resolved back:', resolved);
      assert.strictEqual(resolved, original);
    });

    it('should handle conflicts correctly', () => {
      const original1 = 'mcp:server1:search';
      const original2 = 'mcp:server2:search';

      const sanitized1 = ToolNameMap.getSanitized(original1);
      const sanitized2 = ToolNameMap.getSanitized(original2);

      console.log('Test 3 - Conflicts:');
      console.log('  Original1:', original1, '-> Sanitized1:', sanitized1);
      console.log('  Original2:', original2, '-> Sanitized2:', sanitized2);

      // Both should get unique sanitized names
      assert.notStrictEqual(sanitized1, sanitized2);

      // Both should resolve back correctly
      assert.strictEqual(ToolNameMap.resolveOriginal(sanitized1), original1);
      assert.strictEqual(ToolNameMap.resolveOriginal(sanitized2), original2);
    });

    it('should handle smart tool names (without server IDs)', () => {
      const smartName = 'search';
      const sanitized = ToolNameMap.getSanitized(smartName);

      console.log('Test 4 - Smart name:');
      console.log('  Original:', smartName);
      console.log('  Sanitized:', sanitized);

      // Simple names should remain unchanged
      assert.strictEqual(sanitized, smartName);

      // Should resolve back to itself
      const resolved = ToolNameMap.resolveOriginal(sanitized);
      console.log('  Resolved back:', resolved);
      assert.strictEqual(resolved, smartName);
    });

    it('should bidirectionally map both namespaced and smart names', () => {
      const namespacedName = 'mcp:mcp-lusl1248if:search';
      const smartName = 'search';

      // Add both mappings
      const sanitizedNamespaced = ToolNameMap.getSanitized(namespacedName);
      const sanitizedSmart = ToolNameMap.getSanitized(smartName);

      console.log('Test 5 - Bidirectional mapping:');
      console.log('  Namespaced:', namespacedName, '-> Sanitized:', sanitizedNamespaced);
      console.log('  Smart:', smartName, '-> Sanitized:', sanitizedSmart);

      // Both should be resolvable
      assert.strictEqual(ToolNameMap.resolveOriginal(sanitizedNamespaced), namespacedName);
      assert.strictEqual(ToolNameMap.resolveOriginal(sanitizedSmart), smartName);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters correctly', () => {
      const original = 'mcp:test-server_123:tool@name.ext';
      const sanitized = ToolNameMap.getSanitized(original);

      console.log('Test 6 - Special characters:');
      console.log('  Original:', original);
      console.log('  Sanitized:', sanitized);

      // Should replace non-alphanumeric characters except hyphens and underscores
      const expected = 'mcp_test-server_123_tool_name_ext';
      assert.strictEqual(sanitized, expected);

      // Should resolve back
      assert.strictEqual(ToolNameMap.resolveOriginal(sanitized), original);
    });

    it('should handle empty and invalid names', () => {
      console.log('Test 7 - Edge cases:');

      const empty = '';
      const sanitizedEmpty = ToolNameMap.getSanitized(empty);
      console.log('  Empty string -> Sanitized:', sanitizedEmpty);
      assert.strictEqual(sanitizedEmpty, 'tool');

      const onlySpecialChars = '@#$%^&*()';
      const sanitizedSpecial = ToolNameMap.getSanitized(onlySpecialChars);
      console.log('  Special chars only -> Sanitized:', sanitizedSpecial);
      assert.strictEqual(sanitizedSpecial, '_________'); // 9 underscores for 9 special chars
    });
  });
});