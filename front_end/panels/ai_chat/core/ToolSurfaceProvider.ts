// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentState } from './State.js';
import { createLogger } from './Logger.js';
import type { Tool } from '../tools/Tools.js';
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';
import { MCPRegistry } from '../mcp/MCPRegistry.js';
import { getMCPConfig } from '../mcp/MCPConfig.js';
import { MCPToolAdapter } from '../mcp/MCPToolAdapter.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { AIChatPanel } from '../ui/AIChatPanel.js';

const logger = createLogger('ToolSurfaceProvider');

export interface ToolSelectionOptions {
  maxToolsPerTurn?: number;
  maxMcpPerTurn?: number;
}

function uniqByName(tools: Tool<any, any>[]): Tool<any, any>[] {
  const seen = new Set<string>();
  const out: Tool<any, any>[] = [];
  for (const t of tools) {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      out.push(t);
    }
  }
  return out;
}

async function getAllMcpTools(): Promise<Tool<any, any>[]> {
  try {
    // Ensure tools are registered before getting status
    await MCPRegistry.ensureToolsRegistered();
    const status = MCPRegistry.getStatus();
    console.log('[TOOL_SELECTION_DEBUG] MCPRegistry status:', {
      enabled: status.enabled,
      serverCount: status.servers.length,
      servers: status.servers,
      registeredToolNames: status.registeredToolNames,
      lastError: status.lastError,
      lastErrorType: status.lastErrorType
    });
    
    const tools: Tool<any, any>[] = [];
    for (const name of status.registeredToolNames) {
      const tool = ToolRegistry.getRegisteredTool(name);
      if (tool) {
        tools.push(tool);
      } else {
        console.log('[TOOL_SELECTION_DEBUG] Tool registered but not found:', name);
      }
    }
    console.log('[TOOL_SELECTION_DEBUG] getAllMcpTools result:', {
      availableToolsCount: tools.length,
      availableToolNames: tools.map(t => t.name)
    });
    return tools;
  } catch (error) {
    console.error('[TOOL_SELECTION_DEBUG] Error in getAllMcpTools:', error);
    return [];
  }
}

async function selectToolsWithLLM(
  query: string,
  agentType: string | null | undefined,
  mcpTools: Tool<any, any>[],
  maxMcpPerTurn: number
): Promise<Tool<any, any>[]> {
  try {
    // Early return for empty tool list - avoid unnecessary LLM call
    if (mcpTools.length === 0) {
      console.log('[TOOL_SELECTION_DEBUG] No MCP tools provided to LLM selector');
      return [];
    }

    const miniModel = AIChatPanel.getMiniModel();
    const miniProvider = AIChatPanel.getMiniModelWithProvider();
    if (!miniModel || !miniProvider) {
      console.log('[TOOL_SELECTION_DEBUG] Mini model not available, falling back to first N tools');
      return mcpTools.slice(0, maxMcpPerTurn);
    }

    const toolDescriptions = mcpTools.map(tool =>
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    const systemPrompt = `You are an intelligent tool selector. Given a user query and agent type, select the most relevant MCP tools.

Select up to ${maxMcpPerTurn} most relevant tools for this query. Consider:
1. Direct keyword matches between query and tool names/descriptions
2. Semantic relevance to the task
3. Agent type preferences (e.g., research agents prefer search/analysis tools)

CRITICAL RULES:
- You MUST ONLY select from the exact tool names provided in the "Available MCP tools" list
- Do NOT invent, create, or hallucinate any tool names
- Return ONLY the exact tool names as they appear in the list
- Respond with a JSON array containing only the selected tool names

Response format: JSON array of exact tool names from the provided list.`;

    const userMessage = `User query: "${query}"
Agent type: ${agentType || 'general'}

Available MCP tools:
${toolDescriptions}`;

    console.log('[TOOL_SELECTION_DEBUG] LLM prompt:', userMessage);

    const llmClient = LLMClient.getInstance();
    const response = await llmClient.call({
      provider: miniProvider.provider,
      model: miniModel,
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      temperature: 0.1
    });

    console.log('[TOOL_SELECTION_DEBUG] LLM response:', response.text);

    // Parse the JSON response
    let selectedToolNames: string[];
    try {
      // Check if response.text is defined
      if (!response.text) {
        throw new Error('LLM response text is undefined');
      }

      // Try to extract JSON from the response
      const jsonMatch = response.text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        selectedToolNames = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.log('[TOOL_SELECTION_DEBUG] Failed to parse LLM response, falling back to first N tools:', parseError);
      return mcpTools.slice(0, maxMcpPerTurn);
    }

    // Map selected tool names back to tool objects
    const selectedTools: Tool<any, any>[] = [];
    const toolMap = new Map(mcpTools.map(tool => [tool.name, tool]));

    for (const toolName of selectedToolNames) {
      const tool = toolMap.get(toolName);
      if (tool && selectedTools.length < maxMcpPerTurn) {
        selectedTools.push(tool);
      }
    }

    // Fill remaining slots if LLM didn't select enough tools
    if (selectedTools.length < maxMcpPerTurn) {
      const remainingTools = mcpTools.filter(tool => !selectedTools.includes(tool));
      selectedTools.push(...remainingTools.slice(0, maxMcpPerTurn - selectedTools.length));
    }

    console.log('[TOOL_SELECTION_DEBUG] LLM selected tools:', {
      selectedToolNames,
      selectedCount: selectedTools.length,
      finalToolNames: selectedTools.map(t => t.name)
    });

    return selectedTools;

  } catch (error) {
    console.log('[TOOL_SELECTION_DEBUG] Error in LLM tool selection:', error);
    return mcpTools.slice(0, maxMcpPerTurn);
  }
}


// DEBUG: Add a utility function to test MCP modes from console
(globalThis as any).debugToolSelection = {
  getCurrentMCPConfig: () => {
    const cfg = getMCPConfig();
    console.log('Current MCP Config:', cfg);
    return cfg;
  },
  testMode: async (mode: 'all' | 'router' | 'meta') => {
    const originalConfig = getMCPConfig();
    console.log(`Testing mode: ${mode}`);
    // Temporarily set the mode
    localStorage.setItem('ai_chat_mcp_tool_mode', mode);
    // Test with mock state
    const mockState = {
      selectedAgentType: 'deep-research',
      messages: [{ entity: 'user' as const, text: 'test query' }]
    } as any;
    const mockBaseTools: any[] = [];
    const result = await ToolSurfaceProvider.select(mockState, mockBaseTools);
    // Restore original mode
    if (originalConfig.toolMode) {
      localStorage.setItem('ai_chat_mcp_tool_mode', originalConfig.toolMode);
    }
    console.log(`Mode ${mode} result:`, result);
    return result;
  },
  getMCPRegistryStatus: () => {
    const status = MCPRegistry.getStatus();
    console.log('MCP Registry Status:', status);
    return status;
  }
};

export const ToolSurfaceProvider = {
  async select(state: AgentState, baseTools: Tool<any, any>[], opts?: ToolSelectionOptions): Promise<{ tools: Tool<any, any>[]; selectedNames: string[] }> {
    const cfg = getMCPConfig();
    const { maxToolsPerTurn = cfg.maxToolsPerTurn || 50, maxMcpPerTurn = cfg.maxMcpPerTurn || 50 } = opts || {};
    const mode = cfg.toolMode || 'all';

    // DEBUG: Log current MCP configuration and tool selection parameters
    console.log('[TOOL_SELECTION_DEBUG] ToolSurfaceProvider.select called with:', {
      maxToolsPerTurn,
      maxMcpPerTurn,
      mcpConfig: cfg,
      toolMode: mode,
      baseToolsCount: baseTools.length,
      baseToolNames: baseTools.map(t => t.name),
      selectedAgentType: state.selectedAgentType
    });

    // Start from provided baseTools (curated per-agent), not global registry
    let resultTools: Tool<any, any>[] = uniqByName([...baseTools]);
    const selectedNames: string[] = [];

    console.log('[TOOL_SELECTION_DEBUG] Base tools provided:', {
      agentType: state.selectedAgentType,
      baseToolsCount: baseTools.length,
      baseToolNames: baseTools.map(t => t.name)
    });

    if (!cfg.enabled) {
      console.log('[TOOL_SELECTION_DEBUG] MCP disabled, returning core tools only');
      const uniq = uniqByName(resultTools).slice(0, maxToolsPerTurn);
      console.log('[TOOL_SELECTION_DEBUG] Final result (MCP disabled):', {
        toolCount: uniq.length,
        toolNames: uniq.map(t => t.name)
      });
      return { tools: uniq, selectedNames: uniq.map(t => t.name) };
    }

    if (mode === 'all') {
      console.log('[TOOL_SELECTION_DEBUG] Using ALL mode');
      const mcpTools = await getAllMcpTools();
      console.log('[TOOL_SELECTION_DEBUG] MCP tools found:', {
        mcpToolsCount: mcpTools.length,
        mcpToolNames: mcpTools.map(t => t.name)
      });
      resultTools = uniqByName([...resultTools, ...mcpTools]);
      console.log('[TOOL_SELECTION_DEBUG] Final result (ALL mode):', {
        toolCount: resultTools.length,
        toolNames: resultTools.map(t => t.name)
      });
      return { tools: resultTools, selectedNames: resultTools.map(t => t.name) };
    }

    if (mode === 'meta') {
      console.log('[TOOL_SELECTION_DEBUG] Using META mode');
      // Include only meta-tools for MCP alongside core tools
      const search = ToolRegistry.getRegisteredTool('mcp.search');
      const invoke = ToolRegistry.getRegisteredTool('mcp.invoke');
      const metaTools = [search, invoke].filter(Boolean) as Tool<any, any>[];
      console.log('[TOOL_SELECTION_DEBUG] Meta tools found:', {
        metaToolsCount: metaTools.length,
        metaToolNames: metaTools.map(t => t.name),
        searchTool: !!search,
        invokeTool: !!invoke
      });
      resultTools = uniqByName([...resultTools, ...metaTools]).slice(0, maxToolsPerTurn);
      console.log('[TOOL_SELECTION_DEBUG] Final result (META mode):', {
        toolCount: resultTools.length,
        toolNames: resultTools.map(t => t.name)
      });
      return { tools: resultTools, selectedNames: resultTools.map(t => t.name) };
    }

    // Router mode (LLM-based intelligent selection)
    console.log('[TOOL_SELECTION_DEBUG] Using ROUTER mode with LLM selection');
    const mcpTools = await getAllMcpTools();
    console.log('[TOOL_SELECTION_DEBUG] MCP tools available for LLM selection:', {
      mcpToolsCount: mcpTools.length,
      mcpToolNames: mcpTools.map(t => t.name)
    });

    // Early return if no MCP tools available - avoid unnecessary LLM call
    if (mcpTools.length === 0) {
      console.log('[TOOL_SELECTION_DEBUG] No MCP tools available, skipping LLM selection');
      console.log('[TOOL_SELECTION_DEBUG] Final result (ROUTER mode - no MCP tools):', {
        toolCount: resultTools.length,
        toolNames: resultTools.map(t => t.name),
        maxToolsPerTurn
      });
      return { tools: resultTools, selectedNames: resultTools.map(t => t.name) };
    }

    const lastUserMsg = [...state.messages].reverse().find(m => m.entity === 'user' || (m as any).entity === 0) as any;
    const queryText = lastUserMsg?.text || '';
    console.log('[TOOL_SELECTION_DEBUG] Query text for LLM selection:', queryText);

    const selectedMcpTools = await selectToolsWithLLM(queryText, state.selectedAgentType, mcpTools, maxMcpPerTurn);

    console.log('[TOOL_SELECTION_DEBUG] LLM selected MCP tools:', {
      selectedToolsCount: selectedMcpTools.length,
      selectedToolNames: selectedMcpTools.map(t => t.name),
      maxMcpPerTurn
    });

    resultTools = uniqByName([...resultTools, ...selectedMcpTools]).slice(0, maxToolsPerTurn);
    console.log('[TOOL_SELECTION_DEBUG] Final result (ROUTER mode):', {
      toolCount: resultTools.length,
      toolNames: resultTools.map(t => t.name),
      maxToolsPerTurn
    });
    return { tools: resultTools, selectedNames: resultTools.map(t => t.name) };
  }
};
