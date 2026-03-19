// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../../core/Logger.js';
import { AgentStorageManager, type CreateAgentInput, type SchemaProperty } from '../../../core/AgentStorageManager.js';
import { AgentStudioIntegration, type AgentDisplayInfo } from '../../../core/AgentStudioIntegration.js';
import { ToolStorageManager, type CreateToolInput, type ToolDependency, type SchemaProperty as ToolSchemaProperty, type StoredToolConfig } from '../../../core/ToolStorageManager.js';
import { ToolStudioIntegration, type ToolDisplayInfo } from '../../../core/ToolStudioIntegration.js';
import { ToolRegistry } from '../../../agent_framework/ConfigurableAgentTool.js';
import { DynamicJavaScriptTool } from '../../../tools/DynamicJavaScriptTool.js';
import type {
  MiniApp,
  MiniAppSPA,
  MiniAppController,
  MiniAppBridge,
  MiniAppState,
  MiniAppActionSchema,
  MiniAppStateSchema,
  SPAToDevToolsAction,
} from '../../types/MiniAppTypes.js';
import { MiniAppEventBus } from '../../MiniAppEventBus.js';
import { AgentStudioSPA } from '../../../ui/agent_studio/AgentStudioSPA.js';

const logger = createLogger('AgentStudioMiniApp');

/**
 * Agent info for the SPA
 */
interface AgentInfo {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  avatar: string;
  color: string;
  backgroundColor: string;
  isBuiltIn: boolean;
  tools: string[];
  maxIterations: number;
  temperature: number;
  systemPrompt: string;
  version: string;
  schema: object;
}

/**
 * Tool info for the SPA
 */
interface ToolInfo {
  name: string;
  description: string;
}

/**
 * Form data for saving agents
 */
interface AgentFormData {
  name: string;
  displayName: string;
  description: string;
  avatar: string;
  color: string;
  systemPrompt: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
  schema: object;
}

/**
 * Custom tool info for the SPA
 */
interface CustomToolInfo {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
  code: string;
  schema: object;
  timeout: number;
  hasPageAccess: boolean;
  dependencies: ToolDependency[];
  version: string;
}

/**
 * Form data for saving custom tools
 */
interface ToolFormData {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  code: string;
  schema: object;
  timeout: number;
  dependencies: ToolDependency[];
}

/**
 * AgentStudioMiniApp - Wrapper for Agent Studio as a mini app
 *
 * This wraps the existing AgentStudio SPA to work with the mini app system
 * while maintaining backward compatibility with the existing implementation.
 */
export class AgentStudioMiniApp implements MiniApp {
  id = 'agent_studio';
  name = 'Agent Studio';
  description = 'Create and manage custom AI agents with configurable tools, prompts, and behaviors. View built-in agents or create custom ones.';
  icon = '🤖';

  // Route definitions for URL-based navigation
  routes = [
    { name: 'list', pattern: '#agent-studio' },
    { name: 'agent', pattern: '#agent-studio/agent/:id' },
    { name: 'new', pattern: '#agent-studio/new' },
    { name: 'tool', pattern: '#agent-studio/tool/:id' },
    { name: 'new-tool', pattern: '#agent-studio/new-tool' },
  ];

  getSPA(): MiniAppSPA {
    return {
      html: AgentStudioSPA.html,
      css: AgentStudioSPA.css,
      // We need to use the existing JS since it already has the agentStudio binding
      // The MiniAppRegistry will wrap this with the miniApp protocol
      js: AgentStudioSPA.js,
    };
  }

  getSupportedActions(): MiniAppActionSchema[] {
    return [
      {
        name: 'select-agent',
        description: 'Select an agent by name to view or edit',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The agent name to select' },
          },
          required: ['name'],
        },
      },
      {
        name: 'create-agent',
        description: 'Start creating a new custom agent',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'save-agent',
        description: 'Save the current agent configuration',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Agent name (lowercase, hyphens/underscores)' },
            displayName: { type: 'string', description: 'Human-readable display name' },
            description: { type: 'string', description: 'Agent description' },
            systemPrompt: { type: 'string', description: 'System prompt for the agent' },
            tools: { type: 'array', description: 'List of tool names the agent can use' },
            maxIterations: { type: 'number', description: 'Maximum iterations (1-100)' },
            temperature: { type: 'number', description: 'LLM temperature (0-2)' },
          },
          required: ['name', 'systemPrompt', 'tools'],
        },
      },
      {
        name: 'delete-agent',
        description: 'Delete the currently selected custom agent',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list-agents',
        description: 'Get a list of all agents (built-in and custom)',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list-tools',
        description: 'Get a list of all available tools',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      // Tool Studio actions
      {
        name: 'select-tool',
        description: 'Select a custom tool by name to view or edit',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The tool name to select' },
          },
          required: ['name'],
        },
      },
      {
        name: 'create-tool',
        description: 'Start creating a new custom tool',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'save-tool',
        description: 'Save the current custom tool configuration',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name (lowercase, underscores)' },
            displayName: { type: 'string', description: 'Human-readable display name' },
            description: { type: 'string', description: 'Tool description for AI' },
            code: { type: 'string', description: 'JavaScript code to execute' },
            schema: { type: 'object', description: 'JSON Schema for input parameters' },
            timeout: { type: 'number', description: 'Execution timeout (1000-30000ms)' },
          },
          required: ['name', 'description', 'code'],
        },
      },
      {
        name: 'delete-tool',
        description: 'Delete the currently selected custom tool',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list-custom-tools',
        description: 'Get a list of all custom tools',
        schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  getStateSchema(): MiniAppStateSchema {
    return {
      type: 'object',
      properties: {
        agents: {
          type: 'array',
          description: 'List of all agents (built-in and custom)',
        },
        tools: {
          type: 'array',
          description: 'List of available tools for agent selection',
        },
        selectedAgent: {
          type: 'object',
          description: 'Currently selected agent or null',
        },
        isCreatingNew: {
          type: 'boolean',
          description: 'Whether a new agent is being created',
        },
        // Tool Studio state
        customTools: {
          type: 'array',
          description: 'List of custom tools created in Tool Studio',
        },
        selectedTool: {
          type: 'object',
          description: 'Currently selected custom tool or null',
        },
        isCreatingNewTool: {
          type: 'boolean',
          description: 'Whether a new tool is being created',
        },
        activeTab: {
          type: 'string',
          description: 'Active tab: "agents" or "tools"',
        },
      },
    };
  }

  createController(): MiniAppController {
    return new AgentStudioMiniAppController();
  }
}

/**
 * Controller for Agent Studio mini app
 *
 * Handles business logic and bridges between the mini app system
 * and the existing Agent Studio infrastructure.
 */
class AgentStudioMiniAppController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private closeCallback: (() => void | Promise<void>) | null = null;

  // Agent state
  private selectedAgentId: string | null = null;
  private selectedAgentName: string | null = null;
  private isCreatingNew = false;

  // Tool Studio state
  private selectedToolId: string | null = null;
  private selectedToolName: string | null = null;
  private isCreatingNewTool = false;
  private activeTab: 'agents' | 'tools' = 'agents';

  async initialize(bridge: MiniAppBridge): Promise<void> {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
    logger.info('AgentStudioMiniAppController initialized');
  }

  async cleanup(): Promise<void> {
    this.bridge = null;
    this.selectedAgentId = null;
    this.selectedAgentName = null;
    this.isCreatingNew = false;
    this.selectedToolId = null;
    this.selectedToolName = null;
    this.isCreatingNewTool = false;
    this.activeTab = 'agents';
    logger.info('AgentStudioMiniAppController cleaned up');
  }

  onClose(callback: () => void | Promise<void>): void {
    this.closeCallback = callback;
  }

  async getState(): Promise<MiniAppState> {
    const { agents, tools } = await this.loadAllData();

    let selectedAgent: AgentInfo | null = null;
    if (this.selectedAgentName) {
      const allAgents = await AgentStudioIntegration.getAllAgentsForDisplay();
      const agent = allAgents.find(a => a.name === this.selectedAgentName);
      if (agent) {
        selectedAgent = this.toAgentInfo(agent);
      }
    }

    return {
      agents,
      tools,
      selectedAgent,
      isCreatingNew: this.isCreatingNew,
    };
  }

  async setState(state: MiniAppState): Promise<void> {
    // Agent Studio state is mostly read-only from external perspective
    // State changes happen through actions
    if (state.selectedAgentName) {
      this.selectedAgentName = state.selectedAgentName as string;
    }
    if (state.isCreatingNew !== undefined) {
      this.isCreatingNew = state.isCreatingNew as boolean;
    }
  }

  async updateState(updates: Partial<MiniAppState>): Promise<void> {
    if (updates.selectedAgentName) {
      this.selectedAgentName = updates.selectedAgentName as string;
    }
    if (updates.isCreatingNew !== undefined) {
      this.isCreatingNew = updates.isCreatingNew as boolean;
    }
  }

  async executeAction(actionName: string, args: unknown): Promise<unknown> {
    const argsObj = args as Record<string, unknown>;

    switch (actionName) {
      // Agent actions
      case 'select-agent':
        return this.handleSelectAgentAction(argsObj.name as string);

      case 'create-agent':
        return this.handleNewAgentAction();

      case 'save-agent':
        return this.handleSaveAgentAction(argsObj as unknown as AgentFormData);

      case 'delete-agent':
        return this.handleDeleteAgentAction();

      case 'list-agents':
        return this.handleListAgentsAction();

      case 'list-tools':
        return this.handleListToolsAction();

      // Tool Studio actions
      case 'select-tool':
        return this.handleSelectToolAction(argsObj.name as string);

      case 'create-tool':
        return this.handleNewToolAction();

      case 'save-tool':
        return this.handleSaveToolAction(argsObj as unknown as ToolFormData);

      case 'delete-tool':
        return this.handleDeleteToolAction();

      case 'list-custom-tools':
        return this.handleListCustomToolsAction();

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  // ============================================================================
  // SPA Action Handlers (from the SPA via bridge)
  // ============================================================================

  async handleAction(action: SPAToDevToolsAction): Promise<void> {
    logger.info('Handling SPA action:', action.type);

    switch (action.type) {
      case 'ready':
        await this.pushInitialState();
        break;

      case 'select-agent': {
        // SPA sends: { type: 'select-agent', name, id, isBuiltIn }
        const actionData = action as SPAToDevToolsAction & { name: string; id: string | null; isBuiltIn: boolean };
        await this.handleSelectAgent(actionData.name, actionData.id, actionData.isBuiltIn);
        break;
      }

      case 'select-agent-by-id': {
        // SPA sends: { type: 'select-agent-by-id', id }
        const actionData = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectAgentById(actionData.id);
        break;
      }

      case 'new-agent':
        await this.handleNewAgent();
        break;

      case 'save-agent': {
        // SPA sends: { type: 'save-agent', data: AgentFormData }
        const actionData = action as SPAToDevToolsAction & { data: AgentFormData };
        await this.handleSaveAgent(actionData.data);
        break;
      }

      case 'delete-agent':
        await this.handleDeleteAgent();
        break;

      case 'clone-agent':
        await this.handleCloneAgent();
        break;

      case 'run-test': {
        // SPA sends: { type: 'run-test', query: string }
        const actionData = action as SPAToDevToolsAction & { query: string };
        await this.handleRunTest(actionData.query);
        break;
      }

      case 'close':
        if (this.closeCallback) {
          await this.closeCallback();
        }
        break;

      case 'state-changed':
        // State changed from SPA
        MiniAppEventBus.getInstance().emitStateChanged('agent_studio', action.payload);
        break;

      // Tool Studio SPA actions
      case 'select-tab': {
        const actionData = action as SPAToDevToolsAction & { tab: 'agents' | 'tools' };
        this.activeTab = actionData.tab;
        break;
      }

      case 'select-tool': {
        const actionData = action as SPAToDevToolsAction & { name: string; id: string | null };
        await this.handleSelectTool(actionData.name, actionData.id);
        break;
      }

      case 'select-tool-by-id': {
        // SPA sends: { type: 'select-tool-by-id', id }
        const actionData = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectToolById(actionData.id);
        break;
      }

      case 'new-tool':
        await this.handleNewTool();
        break;

      case 'save-tool': {
        const actionData = action as SPAToDevToolsAction & { data: ToolFormData };
        await this.handleSaveTool(actionData.data);
        break;
      }

      case 'delete-tool':
        await this.handleDeleteTool();
        break;

      case 'run-tool-test': {
        const actionData = action as SPAToDevToolsAction & {
          toolConfig: ToolFormData;
          testInput: Record<string, unknown>;
        };
        await this.handleRunToolTest(actionData.toolConfig, actionData.testInput);
        break;
      }

      default:
        logger.warn('Unknown SPA action type:', action.type);
    }
  }

  // ============================================================================
  // Action Implementations (for executeAction)
  // ============================================================================

  private async handleSelectAgentAction(name: string): Promise<{ success: boolean; agent?: AgentInfo }> {
    const allAgents = await AgentStudioIntegration.getAllAgentsForDisplay();
    const agent = allAgents.find(a => a.name === name);

    if (!agent) {
      return { success: false };
    }

    this.selectedAgentName = name;
    this.selectedAgentId = agent.id || null;
    this.isCreatingNew = false;

    // Update SPA
    await this.bridge?.sendToSPA({
      action: 'agent-selected',
      payload: { agent: this.toAgentInfo(agent) },
    });

    return { success: true, agent: this.toAgentInfo(agent) };
  }

  private async handleNewAgentAction(): Promise<{ success: boolean }> {
    this.isCreatingNew = true;
    this.selectedAgentId = null;
    this.selectedAgentName = null;

    await this.bridge?.sendToSPA({
      action: 'agent-selected',
      payload: { agent: this.createEmptyAgent() },
    });

    return { success: true };
  }

  private async handleSaveAgentAction(data: AgentFormData): Promise<{ success: boolean; agent?: AgentInfo; error?: string }> {
    try {
      const storageManager = AgentStorageManager.getInstance();

      const input: CreateAgentInput = {
        name: data.name,
        description: data.description || '',
        version: '1.0.0',
        systemPrompt: data.systemPrompt,
        tools: data.tools,
        maxIterations: data.maxIterations || 10,
        temperature: data.temperature || 0.7,
        schema: (data.schema as { type: string; properties: Record<string, SchemaProperty>; required?: string[] }) || {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The user query' },
          },
          required: ['query'],
        },
        ui: {
          displayName: data.displayName || data.name,
          avatar: data.avatar || '🤖',
          color: data.color || '#3b82f6',
          backgroundColor: '#e0e7ff',
        },
      };

      let savedAgent;
      if (this.isCreatingNew) {
        savedAgent = await storageManager.createAgent(input);
      } else if (this.selectedAgentId) {
        savedAgent = await storageManager.updateAgent(this.selectedAgentId, input);
      } else {
        return { success: false, error: 'No agent selected to update' };
      }

      // Refresh the tool registry
      await AgentStudioIntegration.refreshAgents();

      // Update state
      this.selectedAgentId = savedAgent.id;
      this.selectedAgentName = savedAgent.name;
      this.isCreatingNew = false;

      return { success: true, agent: this.toAgentInfo(savedAgent as unknown as AgentDisplayInfo) };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleDeleteAgentAction(): Promise<{ success: boolean; error?: string }> {
    if (!this.selectedAgentId) {
      return { success: false, error: 'No agent selected' };
    }

    try {
      const storageManager = AgentStorageManager.getInstance();
      await storageManager.deleteAgent(this.selectedAgentId);

      // Refresh the tool registry
      await AgentStudioIntegration.refreshAgents();

      // Clear selection
      this.selectedAgentId = null;
      this.selectedAgentName = null;

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleListAgentsAction(): Promise<{ agents: AgentInfo[] }> {
    const { agents } = await this.loadAllData();
    return { agents };
  }

  private async handleListToolsAction(): Promise<{ tools: ToolInfo[] }> {
    const { tools } = await this.loadAllData();
    return { tools };
  }

  // ============================================================================
  // Tool Studio Action Implementations (for executeAction)
  // ============================================================================

  private async handleSelectToolAction(name: string): Promise<{ success: boolean; tool?: CustomToolInfo }> {
    const customTools = await ToolStudioIntegration.getCustomToolsForDisplay();
    const tool = customTools.find(t => t.name === name);

    if (!tool) {
      return { success: false };
    }

    this.selectedToolName = name;
    this.selectedToolId = tool.id || null;
    this.isCreatingNewTool = false;

    // Update SPA
    await this.bridge?.sendToSPA({
      action: 'tool-selected',
      payload: { tool: this.toCustomToolInfo(tool) },
    });

    return { success: true, tool: this.toCustomToolInfo(tool) };
  }

  private async handleNewToolAction(): Promise<{ success: boolean }> {
    this.isCreatingNewTool = true;
    this.selectedToolId = null;
    this.selectedToolName = null;

    await this.bridge?.sendToSPA({
      action: 'tool-selected',
      payload: { tool: this.createEmptyTool() },
    });

    return { success: true };
  }

  private async handleSaveToolAction(data: ToolFormData): Promise<{ success: boolean; tool?: CustomToolInfo; error?: string }> {
    try {
      const storageManager = ToolStorageManager.getInstance();

      const input: CreateToolInput = {
        name: data.name,
        description: data.description || '',
        version: '1.0.0',
        code: data.code,
        schema: (data.schema as { type: string; properties: Record<string, ToolSchemaProperty>; required?: string[] }) || {
          type: 'object',
          properties: {},
          required: [],
        },
        ui: {
          displayName: data.displayName || data.name,
          icon: data.icon || '🔧',
          color: data.color || '#00a4fe',
          backgroundColor: '#e2f3fb',
        },
        timeout: data.timeout || 10000,
        hasPageAccess: true,
        dependencies: data.dependencies || [],
      };

      let savedTool;
      if (this.isCreatingNewTool) {
        savedTool = await storageManager.createTool(input);
      } else if (this.selectedToolId) {
        savedTool = await storageManager.updateTool(this.selectedToolId, input);
      } else {
        return { success: false, error: 'No tool selected to update' };
      }

      // Refresh the tool registry
      await ToolStudioIntegration.refreshTools();

      // Update state
      this.selectedToolId = savedTool.id;
      this.selectedToolName = savedTool.name;
      this.isCreatingNewTool = false;

      return { success: true, tool: this.toCustomToolInfo(savedTool as unknown as ToolDisplayInfo) };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleDeleteToolAction(): Promise<{ success: boolean; error?: string }> {
    if (!this.selectedToolId) {
      return { success: false, error: 'No tool selected' };
    }

    try {
      const storageManager = ToolStorageManager.getInstance();
      await storageManager.deleteTool(this.selectedToolId);

      // Refresh the tool registry
      await ToolStudioIntegration.refreshTools();

      // Clear selection
      this.selectedToolId = null;
      this.selectedToolName = null;

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleListCustomToolsAction(): Promise<{ customTools: CustomToolInfo[] }> {
    const { customTools } = await this.loadAllData();
    return { customTools };
  }

  // ============================================================================
  // Tool Studio SPA-Triggered Handlers
  // ============================================================================

  private async handleSelectTool(name: string, id: string | null): Promise<void> {
    this.isCreatingNewTool = false;
    this.selectedToolName = name;
    this.selectedToolId = id;

    const customTools = await ToolStudioIntegration.getCustomToolsForDisplay();
    const tool = customTools.find(t => t.name === name);

    if (tool) {
      // Ensure selectedToolId is set from found tool (in case id wasn't passed)
      this.selectedToolId = tool.id || null;
      await this.bridge?.sendToSPA({
        action: 'tool-selected',
        payload: { tool: this.toCustomToolInfo(tool) },
      });
    } else {
      logger.warn(`Tool not found: ${name}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: `Tool "${name}" not found`, type: 'error' },
      });
      this.selectedToolName = null;
      this.selectedToolId = null;
    }
  }

  private async handleSelectToolById(id: string): Promise<void> {
    this.isCreatingNewTool = false;

    const customTools = await ToolStudioIntegration.getCustomToolsForDisplay();
    const tool = customTools.find(t => t.id === id);

    if (tool) {
      this.selectedToolId = tool.id || null;
      this.selectedToolName = tool.name;
      await this.bridge?.sendToSPA({
        action: 'tool-selected',
        payload: { tool: this.toCustomToolInfo(tool) },
      });
    } else {
      logger.warn(`Tool not found by ID: ${id}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Tool not found', type: 'error' },
      });
      this.selectedToolName = null;
      this.selectedToolId = null;
    }
  }

  private async handleNewTool(): Promise<void> {
    this.isCreatingNewTool = true;
    this.selectedToolId = null;
    this.selectedToolName = null;

    await this.bridge?.sendToSPA({
      action: 'tool-selected',
      payload: { tool: this.createEmptyTool() },
    });
  }

  private async handleSaveTool(data: ToolFormData): Promise<void> {
    const result = await this.handleSaveToolAction(data);

    if (result.success) {
      const { customTools } = await this.loadAllData();
      logger.info('Tools after save:', {
        total: customTools.length,
        names: customTools.map(t => t.name),
      });

      // Send tool-saved action (triggers auto-return to agent if applicable)
      await this.bridge?.sendToSPA({
        action: 'tool-saved',
        payload: {
          tool: result.tool,
          customTools,
        },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Tool saved successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to save tool', type: 'error' },
      });
    }
  }

  private async handleDeleteTool(): Promise<void> {
    const result = await this.handleDeleteToolAction();

    if (result.success) {
      const { customTools } = await this.loadAllData();
      await this.bridge?.sendToSPA({
        action: 'tools-updated',
        payload: { customTools },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Tool deleted successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to delete tool', type: 'error' },
      });
    }
  }

  /**
   * Execute a tool test with the given configuration and inputs
   */
  private async handleRunToolTest(
    toolConfig: ToolFormData,
    testInput: Record<string, unknown>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Create a temporary StoredToolConfig from form data
      const config: StoredToolConfig = {
        id: 'test-tool-temp',
        name: toolConfig.name || 'test_tool',
        description: toolConfig.description || 'Test tool',
        version: '1.0.0',
        code: toolConfig.code,
        schema: (toolConfig.schema as StoredToolConfig['schema']) || {
          type: 'object',
          properties: {},
          required: [],
        },
        ui: {
          displayName: toolConfig.displayName || toolConfig.name || 'Test Tool',
          icon: toolConfig.icon || '🔧',
          color: toolConfig.color || '#00a4fe',
          backgroundColor: '#e2f3fb',
        },
        isBuiltIn: false,
        timeout: toolConfig.timeout || 10000,
        hasPageAccess: true,
        dependencies: toolConfig.dependencies || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      logger.info('Running tool test', { name: config.name, inputKeys: Object.keys(testInput) });

      // Create and execute the tool
      const tool = new DynamicJavaScriptTool(config);
      const result = await tool.execute(testInput);

      const duration = Date.now() - startTime;

      // Check for error in result
      const hasError = result && typeof result === 'object' && 'error' in result;

      // Send result back to SPA
      await this.bridge?.sendToSPA({
        action: 'tool-test-result',
        payload: {
          success: !hasError,
          result,
          duration,
          error: hasError ? (result as { error: string }).error : undefined,
        },
      });

      logger.info('Tool test completed', { success: !hasError, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Tool test failed', { error: errorMessage });

      await this.bridge?.sendToSPA({
        action: 'tool-test-result',
        payload: {
          success: false,
          error: errorMessage,
          duration,
        },
      });
    }
  }

  // ============================================================================
  // SPA-Triggered Handlers (legacy compatibility)
  // ============================================================================

  private async pushInitialState(): Promise<void> {
    const { agents, tools, customTools, presetLibraries } = await this.loadAllData();

    await this.bridge?.sendToSPA({
      action: 'init',
      payload: {
        agents,
        tools,
        customTools,
        presetLibraries,
        selectedAgent: undefined,
      },
    });

    logger.info('Initial state pushed to SPA');
  }

  private async handleSelectAgent(name: string, id: string | null, _isBuiltIn: boolean): Promise<void> {
    this.isCreatingNew = false;
    this.selectedAgentName = name;
    this.selectedAgentId = id;

    const allAgents = await AgentStudioIntegration.getAllAgentsForDisplay();
    const agent = allAgents.find(a => a.name === name);

    if (agent) {
      await this.bridge?.sendToSPA({
        action: 'agent-selected',
        payload: { agent: this.toAgentInfo(agent) },
      });
    } else {
      // Agent not found - log warning and notify SPA to show list
      logger.warn(`Agent not found: ${name}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: `Agent "${name}" not found`, type: 'error' },
      });
      // Go back to list view
      this.selectedAgentName = null;
      this.selectedAgentId = null;
      await this.pushInitialState();
    }
  }

  private async handleSelectAgentById(id: string): Promise<void> {
    this.isCreatingNew = false;

    const allAgents = await AgentStudioIntegration.getAllAgentsForDisplay();
    const agent = allAgents.find(a => a.id === id);

    if (agent) {
      this.selectedAgentId = agent.id || null;
      this.selectedAgentName = agent.name;
      await this.bridge?.sendToSPA({
        action: 'agent-selected',
        payload: { agent: this.toAgentInfo(agent) },
      });
    } else {
      logger.warn(`Agent not found by ID: ${id}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Agent not found', type: 'error' },
      });
      this.selectedAgentName = null;
      this.selectedAgentId = null;
      await this.pushInitialState();
    }
  }

  private async handleNewAgent(): Promise<void> {
    this.isCreatingNew = true;
    this.selectedAgentId = null;
    this.selectedAgentName = null;

    await this.bridge?.sendToSPA({
      action: 'agent-selected',
      payload: { agent: this.createEmptyAgent() },
    });
  }

  private async handleSaveAgent(data: AgentFormData): Promise<void> {
    const result = await this.handleSaveAgentAction(data);

    if (result.success) {
      // Reload agents list
      const { agents } = await this.loadAllData();
      logger.info('Agents after save:', {
        total: agents.length,
        custom: agents.filter(a => !a.isBuiltIn).length,
        names: agents.map(a => a.name),
      });
      await this.bridge?.sendToSPA({
        action: 'agents-updated',
        payload: { agents },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Agent saved successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to save agent', type: 'error' },
      });
    }
  }

  private async handleDeleteAgent(): Promise<void> {
    const result = await this.handleDeleteAgentAction();

    if (result.success) {
      const { agents } = await this.loadAllData();
      await this.bridge?.sendToSPA({
        action: 'agents-updated',
        payload: { agents },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Agent deleted successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to delete agent', type: 'error' },
      });
    }
  }

  private async handleCloneAgent(): Promise<void> {
    if (!this.selectedAgentName) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'No agent selected to clone', type: 'error' },
      });
      return;
    }

    const allAgents = await AgentStudioIntegration.getAllAgentsForDisplay();
    const agent = allAgents.find(a => a.name === this.selectedAgentName);

    if (!agent) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Agent not found', type: 'error' },
      });
      return;
    }

    try {
      // Generate unique name for the clone
      const cloneName = this.generateUniqueName(agent.name, allAgents);
      const storageManager = AgentStorageManager.getInstance();

      // Create clone input for storage
      const input: CreateAgentInput = {
        name: cloneName,
        description: agent.description,
        version: '1.0.0',
        systemPrompt: agent.systemPrompt,
        tools: agent.tools,
        maxIterations: agent.maxIterations,
        temperature: agent.temperature,
        schema: (agent.schema as { type: string; properties: Record<string, SchemaProperty>; required?: string[] }) || {
          type: 'object',
          properties: {},
          required: [],
        },
        ui: {
          displayName: `${agent.displayName} (Copy)`,
          avatar: agent.avatar,
          color: agent.color,
          backgroundColor: agent.backgroundColor,
        },
      };

      // Save to IndexedDB
      const savedAgent = await storageManager.createAgent(input);

      // Refresh tool registry
      await AgentStudioIntegration.refreshAgents();

      // Update state to select the new agent
      this.isCreatingNew = false;
      this.selectedAgentId = savedAgent.id;
      this.selectedAgentName = savedAgent.name;

      // Reload and send updated agent list to SPA
      const { agents } = await this.loadAllData();
      await this.bridge?.sendToSPA({
        action: 'agents-updated',
        payload: { agents },
      });

      // Select the newly cloned agent
      await this.bridge?.sendToSPA({
        action: 'agent-selected',
        payload: { agent: this.toAgentInfo(savedAgent as unknown as AgentDisplayInfo) },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Agent cloned successfully!', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to clone agent:', error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: `Failed to clone agent: ${errorMsg}`, type: 'error' },
      });
    }
  }

  /**
   * Generate a unique name for a cloned agent
   */
  private generateUniqueName(baseName: string, existingAgents: AgentDisplayInfo[]): string {
    const existingNames = new Set(existingAgents.map(a => a.name));
    let name = `${baseName}_copy`;
    let counter = 1;
    while (existingNames.has(name)) {
      name = `${baseName}_copy_${counter}`;
      counter++;
    }
    return name;
  }

  private async handleRunTest(query: string): Promise<void> {
    // TODO: Implement agent testing
    logger.info('Running test with query:', query);

    await this.bridge?.sendToSPA({
      action: 'test-result',
      payload: { html: '<p>Agent testing is not yet implemented.</p>' },
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async loadAllData(): Promise<{
    agents: AgentInfo[];
    tools: ToolInfo[];
    customTools: CustomToolInfo[];
    presetLibraries: ToolDependency[];
  }> {
    const allAgents = await AgentStudioIntegration.getAllAgentsForDisplay();
    const agents: AgentInfo[] = allAgents.map(a => this.toAgentInfo(a));

    const toolNames = AgentStudioIntegration.getAvailableToolNames();
    const tools: ToolInfo[] = toolNames.map(name => {
      const tool = ToolRegistry.getRegisteredTool(name);
      return {
        name,
        description: tool?.description || 'No description available',
      };
    });

    // Load custom tools
    const customToolsData = await ToolStudioIntegration.getCustomToolsForDisplay();
    const customTools: CustomToolInfo[] = customToolsData.map(t => this.toCustomToolInfo(t));

    // Get preset libraries
    const presetLibraries = ToolStudioIntegration.getPresetLibraries();

    return { agents, tools, customTools, presetLibraries };
  }

  private toAgentInfo(agent: AgentDisplayInfo): AgentInfo {
    return {
      id: agent.id,
      name: agent.name,
      displayName: agent.displayName,
      description: agent.description,
      avatar: agent.avatar,
      color: agent.color,
      backgroundColor: agent.backgroundColor,
      isBuiltIn: agent.isBuiltIn,
      tools: agent.tools,
      maxIterations: agent.maxIterations,
      temperature: agent.temperature,
      systemPrompt: agent.systemPrompt,
      version: agent.version,
      schema: agent.schema,
    };
  }

  private createEmptyAgent(): AgentInfo {
    return {
      name: '',
      displayName: '',
      description: '',
      avatar: '🤖',
      color: '#3b82f6',
      backgroundColor: '#e0e7ff',
      isBuiltIn: false,
      tools: [],
      maxIterations: 10,
      temperature: 0.7,
      systemPrompt: '',
      version: '1.0.0',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The user query' },
        },
        required: ['query'],
      },
    };
  }

  private toCustomToolInfo(tool: ToolDisplayInfo): CustomToolInfo {
    return {
      id: tool.id,
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      icon: tool.icon,
      color: tool.color,
      backgroundColor: tool.backgroundColor,
      code: tool.code || '',
      schema: tool.schema,
      timeout: tool.timeout,
      hasPageAccess: tool.hasPageAccess,
      dependencies: tool.dependencies,
      version: tool.version,
    };
  }

  private createEmptyTool(): CustomToolInfo {
    return {
      name: '',
      displayName: '',
      description: '',
      icon: '🔧',
      color: '#00a4fe',
      backgroundColor: '#e2f3fb',
      code: `// Your code here
// Available variables:
// - args: The input arguments (validated against schema)
// - ctx: Execution context { provider, model }
//
// Return a JSON-serializable value

const result = {
  message: 'Hello from custom tool!',
  timestamp: new Date().toISOString()
};

return result;`,
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      timeout: 10000,
      hasPageAccess: true,
      dependencies: [],
      version: '1.0.0',
    };
  }
}
