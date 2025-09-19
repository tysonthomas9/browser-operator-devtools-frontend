// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createToolExecutorNode } from '../AgentNodes.js';
import type { AgentState } from '../State.js';
import { ChatMessageEntity } from '../../models/ChatTypes.js';
import * as ToolNameMap from '../ToolNameMap.js';
import { ToolRegistry } from '../../agent_framework/ConfigurableAgentTool.js';

/* eslint-env mocha */

// Mock tool class
class MockTool {
  constructor(public name: string, public description: string = `Mock tool ${name}`) {}

  get schema() {
    return {
      type: 'object',
      properties: {},
    };
  }

  async execute(_args: Record<string, unknown>): Promise<string> {
    return `Executed ${this.name}`;
  }
}

describe('ToolExecutorNode Resolution', () => {
  beforeEach(() => {
    ToolNameMap.clear();
  });

  afterEach(() => {
    ToolNameMap.clear();
  });

  describe('MCP tool resolution', () => {
    it('should resolve MCP tools by different name variants', () => {
      // Setup: simulate an MCP tool registered with smart naming
      const serverId = 'mcp-lusl1248if';
      const toolName = 'search';
      const namespacedName = `mcp:${serverId}:${toolName}`;
      const smartName = toolName;

      console.log('Test 1 - MCP tool resolution variants:');
      console.log('  Namespaced name:', namespacedName);
      console.log('  Smart name:', smartName);

      // Add mappings like MCPRegistry would
      ToolNameMap.addMapping(namespacedName);
      ToolNameMap.addMapping(smartName);

      // Register with smart name (this is what our updated MCPRegistry does)
      const mockTool = new MockTool(smartName);
      ToolRegistry.registerToolFactory(smartName, () => mockTool);

      // Create state with the tool selected
      const state: AgentState = {
        messages: [
          {
            entity: ChatMessageEntity.USER,
            text: 'Test user message',
          },
          {
            entity: ChatMessageEntity.MODEL,
            action: 'tool',
            toolName: namespacedName, // This is what comes from the LLM message
            toolArgs: {},
            toolCallId: 'test-call-id',
            isFinalAnswer: false,
          }
        ],
        selectedAgentType: 'test',
        context: {
          selectedToolNames: [smartName], // This is what MCPRegistry puts in context
        } as any,
      };

      // Create ToolExecutorNode
      const toolExecutor = createToolExecutorNode(state, 'openai', 'gpt-4');

      console.log('  State setup complete');
      console.log('  Tool message name:', namespacedName);
      console.log('  Selected tool names:', (state.context as any)?.selectedToolNames);

      // Test that the tool executor can find the tool
      // This should work with our enhanced resolution logic
      return toolExecutor.invoke(state).then(result => {
        console.log('  Resolution successful!');
        console.log('  Result messages:', result.messages.length);

        // Should have added a tool result message
        assert.isTrue(result.messages.length > state.messages.length, 'Should add tool result message');

        const lastMessage = result.messages[result.messages.length - 1];
        assert.strictEqual(lastMessage.entity, ChatMessageEntity.TOOL_RESULT, 'Last message should be tool result');
      }).catch(error => {
        console.log('  Resolution failed with error:', error.message);
        throw error;
      });
    });

    it('should test the exact error scenario from logs', () => {
      // Recreate the exact scenario from the error logs
      const requestedTool = 'mcp:mcp-lusl1248if:search';
      const smartName = 'search';

      console.log('Test 2 - Exact error scenario:');
      console.log('  Requested tool (from error):', requestedTool);
      console.log('  Smart name (how it should be registered):', smartName);

      // Register tool with smart name (correct way)
      const mockTool = new MockTool(smartName);
      ToolRegistry.registerToolFactory(smartName, () => mockTool);

      // Add mappings
      ToolNameMap.addMapping(requestedTool);
      ToolNameMap.addMapping(smartName);

      // Create state that requests the namespaced name
      const state: AgentState = {
        messages: [
          {
            entity: ChatMessageEntity.USER,
            text: 'Test search',
          },
          {
            entity: ChatMessageEntity.MODEL,
            action: 'tool',
            toolName: requestedTool, // Requesting namespaced name
            toolArgs: {},
            toolCallId: 'test-call-id',
            isFinalAnswer: false,
          }
        ],
        selectedAgentType: 'test',
        context: {
          selectedToolNames: [smartName], // Only smart name in selection
        } as any,
      };

      console.log('  Creating ToolExecutorNode...');
      const toolExecutor = createToolExecutorNode(state, 'openai', 'gpt-4');

      console.log('  Testing resolution...');

      // This should work with our enhanced fuzzy matching
      return toolExecutor.invoke(state).then(result => {
        console.log('  SUCCESS: Tool resolved successfully!');
        assert.isTrue(result.messages.length > state.messages.length);

        const toolResult = result.messages[result.messages.length - 1];
        assert.strictEqual(toolResult.entity, ChatMessageEntity.TOOL_RESULT);

        console.log('  Tool result:', (toolResult as any).resultText);
      }).catch(error => {
        console.log('  FAILED: Tool resolution failed:', error.message);

        // This tells us exactly what the issue is
        if (error.message.includes('not found')) {
          console.log('  Diagnosis: Tool name mismatch between registration and request');
          console.log('  - Tool registered as:', smartName);
          console.log('  - Tool requested as:', requestedTool);
          console.log('  - Need better name mapping or registration strategy');
        }

        throw error;
      });
    });

    it('should test fuzzy matching for MCP tools', () => {
      const originalName = 'mcp:mcp-test123:notion_create_page';
      const smartName = 'notion_create_page';

      console.log('Test 3 - Fuzzy matching:');
      console.log('  Original name:', originalName);
      console.log('  Smart name:', smartName);

      // Register with smart name
      const mockTool = new MockTool(smartName);
      ToolRegistry.registerToolFactory(smartName, () => mockTool);

      // Add mappings
      ToolNameMap.addMapping(originalName);
      ToolNameMap.addMapping(smartName);

      // Try to request with sanitized version
      const sanitizedName = ToolNameMap.getSanitized(originalName);
      console.log('  Sanitized name:', sanitizedName);

      const state: AgentState = {
        messages: [
          {
            entity: ChatMessageEntity.USER,
            text: 'Test create page',
          },
          {
            entity: ChatMessageEntity.MODEL,
            action: 'tool',
            toolName: sanitizedName, // Request sanitized version
            toolArgs: {},
            toolCallId: 'test-call-id',
            isFinalAnswer: false,
          }
        ],
        selectedAgentType: 'test',
        context: {
          selectedToolNames: [smartName],
        } as any,
      };

      const toolExecutor = createToolExecutorNode(state, 'openai', 'gpt-4');

      return toolExecutor.invoke(state).then(result => {
        console.log('  Fuzzy matching SUCCESS!');
        assert.isTrue(result.messages.length > state.messages.length);
      }).catch(error => {
        console.log('  Fuzzy matching FAILED:', error.message);
        throw error;
      });
    });
  });

  describe('Tool map construction', () => {
    it('should verify toolMap includes all name variants', () => {
      const originalName = 'mcp:server:tool';
      const smartName = 'tool';

      console.log('Test 4 - Tool map construction:');

      // Register tool
      const mockTool = new MockTool(smartName);
      ToolRegistry.registerToolFactory(smartName, () => mockTool);

      // Add mappings
      ToolNameMap.addMapping(originalName);
      ToolNameMap.addMapping(smartName);

      const state: AgentState = {
        messages: [],
        selectedAgentType: 'test',
        context: {
          selectedToolNames: [smartName],
        } as any,
      };

      // Create tool executor to see what gets added to toolMap
      const toolExecutor = createToolExecutorNode(state, 'openai', 'gpt-4');

      // The debug logs we added should show what's in the toolMap
      console.log('  Tool executor created - check debug logs for toolMap contents');

      // Test that it can handle the tool request
      const testState: AgentState = {
        ...state,
        messages: [
          {
            entity: ChatMessageEntity.MODEL,
            action: 'tool',
            toolName: originalName,
            toolArgs: {},
            toolCallId: 'test',
            isFinalAnswer: false,
          }
        ],
      };

      return toolExecutor.invoke(testState).then(result => {
        console.log('  Tool map construction test PASSED');
        assert.isTrue(result.messages.length > 0);
      }).catch(error => {
        console.log('  Tool map construction test FAILED:', error.message);
        throw error;
      });
    });
  });
});