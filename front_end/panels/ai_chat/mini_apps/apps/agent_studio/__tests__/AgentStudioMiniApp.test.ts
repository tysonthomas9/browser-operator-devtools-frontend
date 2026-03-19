// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AgentStudioMiniApp } from '../AgentStudioMiniApp.js';
import { AgentStorageManager } from '../../../../core/AgentStorageManager.js';
import { ToolStorageManager } from '../../../../core/ToolStorageManager.js';
import { AgentStudioIntegration } from '../../../../core/AgentStudioIntegration.js';
import { ToolStudioIntegration } from '../../../../core/ToolStudioIntegration.js';
import type { MiniAppBridge } from '../../../types/MiniAppTypes.js';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockBridge(): MiniAppBridge {
  return {
    install: sinon.stub().resolves(),
    uninstall: sinon.stub().resolves(),
    sendToSPA: sinon.stub().resolves(),
    getState: sinon.stub().resolves({}),
    onAction: sinon.stub(),
    get installed(): boolean {
      return true;
    },
    get webappId(): string | null {
      return 'test-webapp-id';
    },
  };
}

// Mock agent data
const mockBuiltInAgent = {
  id: 'builtin:research_agent',
  name: 'research_agent',
  displayName: 'Research Agent',
  description: 'A built-in research agent',
  avatar: '🔍',
  color: '#3b82f6',
  backgroundColor: '#e0e7ff',
  isBuiltIn: true,
  tools: ['navigate_url', 'search_content'],
  maxIterations: 10,
  temperature: 0.7,
  systemPrompt: 'You are a research agent.',
  version: '1.0.0',
  schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};

const mockCustomAgent = {
  id: 'custom-agent-1',
  name: 'my_custom_agent',
  displayName: 'My Custom Agent',
  description: 'A custom agent',
  avatar: '🤖',
  color: '#00a4fe',
  backgroundColor: '#e2f3fb',
  isBuiltIn: false,
  tools: ['navigate_url'],
  maxIterations: 5,
  temperature: 0.5,
  systemPrompt: 'You are a custom agent.',
  version: '1.0.0',
  schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};

const mockCustomTool = {
  id: 'custom-tool-1',
  name: 'my_custom_tool',
  displayName: 'My Custom Tool',
  description: 'A custom tool',
  icon: '🔧',
  color: '#00a4fe',
  backgroundColor: '#e2f3fb',
  code: 'return { result: "test" };',
  schema: { type: 'object', properties: {}, required: [] },
  timeout: 10000,
  hasPageAccess: true,
  dependencies: [],
  version: '1.0.0',
  isBuiltIn: false,
  isCustom: true,
};

// ============================================================================
// AgentStudioMiniApp Tests
// ============================================================================

describe('AgentStudioMiniApp', () => {
  let app: AgentStudioMiniApp;

  beforeEach(() => {
    app = new AgentStudioMiniApp();
  });

  describe('metadata', () => {
    it('has correct id', () => {
      assert.strictEqual(app.id, 'agent_studio');
    });

    it('has correct name', () => {
      assert.strictEqual(app.name, 'Agent Studio');
    });

    it('has icon', () => {
      assert.strictEqual(app.icon, '🤖');
    });

    it('has description', () => {
      assert.isString(app.description);
      assert.isTrue(app.description.length > 0);
    });

    it('has 5 routes defined', () => {
      assert.isArray(app.routes);
      assert.strictEqual(app.routes.length, 5);

      const listRoute = app.routes.find(r => r.name === 'list');
      assert.isDefined(listRoute);
      assert.strictEqual(listRoute?.pattern, '#agent-studio');

      const agentRoute = app.routes.find(r => r.name === 'agent');
      assert.isDefined(agentRoute);
      assert.include(agentRoute?.pattern, ':id');

      const newRoute = app.routes.find(r => r.name === 'new');
      assert.isDefined(newRoute);

      const toolRoute = app.routes.find(r => r.name === 'tool');
      assert.isDefined(toolRoute);
      assert.include(toolRoute?.pattern, ':id');

      const newToolRoute = app.routes.find(r => r.name === 'new-tool');
      assert.isDefined(newToolRoute);
    });
  });

  describe('getSPA', () => {
    it('returns SPA with html, css, and js', () => {
      const spa = app.getSPA();

      assert.isString(spa.html);
      assert.isString(spa.css);
      assert.isString(spa.js);
      assert.isTrue(spa.html.length > 0);
      assert.isTrue(spa.css.length > 0);
      assert.isTrue(spa.js.length > 0);
    });
  });

  describe('getSupportedActions', () => {
    it('includes select-agent action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'select-agent');

      assert.isDefined(action);
      assert.include(action?.description?.toLowerCase(), 'select');
    });

    it('includes save-agent action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'save-agent');

      assert.isDefined(action);
      assert.include(action?.description?.toLowerCase(), 'save');
    });

    it('includes delete-agent action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'delete-agent');

      assert.isDefined(action);
    });

    it('includes list-agents action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'list-agents');

      assert.isDefined(action);
    });

    it('includes list-tools action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'list-tools');

      assert.isDefined(action);
    });

    it('includes select-tool action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'select-tool');

      assert.isDefined(action);
    });

    it('includes save-tool action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'save-tool');

      assert.isDefined(action);
    });

    it('includes delete-tool action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'delete-tool');

      assert.isDefined(action);
    });

    it('includes list-custom-tools action', () => {
      const actions = app.getSupportedActions();
      const action = actions.find(a => a.name === 'list-custom-tools');

      assert.isDefined(action);
    });

    it('has at least 11 actions', () => {
      const actions = app.getSupportedActions();
      assert.isTrue(actions.length >= 11, `Expected at least 11 actions, got ${actions.length}`);
    });
  });

  describe('getStateSchema', () => {
    it('returns schema with agents property', () => {
      const schema = app.getStateSchema();
      assert.isDefined(schema.properties.agents);
    });

    it('returns schema with tools property', () => {
      const schema = app.getStateSchema();
      assert.isDefined(schema.properties.tools);
    });

    it('returns schema with selectedAgent property', () => {
      const schema = app.getStateSchema();
      assert.isDefined(schema.properties.selectedAgent);
    });

    it('returns schema with customTools property', () => {
      const schema = app.getStateSchema();
      assert.isDefined(schema.properties.customTools);
    });

    it('returns schema with activeTab property', () => {
      const schema = app.getStateSchema();
      assert.isDefined(schema.properties.activeTab);
    });
  });

  describe('createController', () => {
    it('returns a controller instance', () => {
      const controller = app.createController();

      assert.isDefined(controller);
      assert.isFunction(controller.initialize);
      assert.isFunction(controller.getState);
      assert.isFunction(controller.executeAction);
      assert.isFunction(controller.cleanup);
    });
  });
});

// ============================================================================
// AgentStudioController Tests
// ============================================================================

describe('AgentStudioController', () => {
  let app: AgentStudioMiniApp;
  let controller: ReturnType<AgentStudioMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let agentStorageStub: sinon.SinonStub;
  let toolStorageStub: sinon.SinonStub;
  let agentIntegrationStub: sinon.SinonStub;
  let toolIntegrationStub: sinon.SinonStub;

  beforeEach(() => {
    app = new AgentStudioMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();

    // Mock AgentStorageManager
    const mockAgentStorageInstance = {
      getAllAgents: sinon.stub().resolves([mockCustomAgent]),
      getAgentByName: sinon.stub().resolves(mockCustomAgent),
      createAgent: sinon.stub().resolves(mockCustomAgent),
      updateAgent: sinon.stub().resolves(mockCustomAgent),
      deleteAgent: sinon.stub().resolves(),
    };
    agentStorageStub = sinon.stub(AgentStorageManager, 'getInstance').returns(mockAgentStorageInstance as unknown as AgentStorageManager);

    // Mock ToolStorageManager
    const mockToolStorageInstance = {
      getAllTools: sinon.stub().resolves([mockCustomTool]),
      getToolByName: sinon.stub().resolves(mockCustomTool),
      createTool: sinon.stub().resolves(mockCustomTool),
      updateTool: sinon.stub().resolves(mockCustomTool),
      deleteTool: sinon.stub().resolves(),
    };
    toolStorageStub = sinon.stub(ToolStorageManager, 'getInstance').returns(mockToolStorageInstance as unknown as ToolStorageManager);

    // Mock AgentStudioIntegration
    agentIntegrationStub = sinon.stub(AgentStudioIntegration, 'getAllAgentsForDisplay').resolves([mockBuiltInAgent, mockCustomAgent]);
    sinon.stub(AgentStudioIntegration, 'getAvailableToolNames').returns(['navigate_url', 'search_content']);
    sinon.stub(AgentStudioIntegration, 'refreshAgents').resolves();

    // Mock ToolStudioIntegration
    toolIntegrationStub = sinon.stub(ToolStudioIntegration, 'getCustomToolsForDisplay').resolves([mockCustomTool]);
    sinon.stub(ToolStudioIntegration, 'getPresetLibraries').returns([]);
    sinon.stub(ToolStudioIntegration, 'refreshTools').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('initialize', () => {
    it('sets up the bridge', async () => {
      await controller.initialize(mockBridge);

      assert.isTrue((mockBridge.onAction as sinon.SinonStub).calledOnce);
    });
  });

  describe('getState', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns state with agents array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.agents);
      assert.isArray(state.agents);
    });

    it('returns state with tools array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.tools);
      assert.isArray(state.tools);
    });

    it('returns state with selectedAgent as null initially', async () => {
      const state = await controller.getState();

      assert.isNull(state.selectedAgent);
    });

    it('returns state with isCreatingNew as false initially', async () => {
      const state = await controller.getState();

      assert.strictEqual(state.isCreatingNew, false);
    });
  });

  describe('executeAction - list-agents', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns agents array', async () => {
      const result = await controller.executeAction('list-agents', {});

      const data = result as { agents: unknown[] };
      assert.isDefined(data.agents);
      assert.isArray(data.agents);
      assert.strictEqual(data.agents.length, 2); // built-in + custom
    });
  });

  describe('executeAction - list-tools', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns tools array', async () => {
      const result = await controller.executeAction('list-tools', {});

      const data = result as { tools: unknown[] };
      assert.isDefined(data.tools);
      assert.isArray(data.tools);
    });
  });

  describe('executeAction - list-custom-tools', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns customTools array', async () => {
      const result = await controller.executeAction('list-custom-tools', {});

      const data = result as { customTools: unknown[] };
      assert.isDefined(data.customTools);
      assert.isArray(data.customTools);
    });
  });

  describe('executeAction - select-agent', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('selects agent by name', async () => {
      const result = await controller.executeAction('select-agent', { name: 'research_agent' });

      const data = result as { success: boolean; agent?: { name: string } };
      assert.isTrue(data.success);
      assert.isDefined(data.agent);
      assert.strictEqual(data.agent?.name, 'research_agent');
    });

    it('returns failure for unknown agent', async () => {
      agentIntegrationStub.resolves([]);
      const result = await controller.executeAction('select-agent', { name: 'unknown_agent' });

      const data = result as { success: boolean };
      assert.isFalse(data.success);
    });
  });

  describe('executeAction - create-agent', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('starts creating new agent', async () => {
      const result = await controller.executeAction('create-agent', {});

      const data = result as { success: boolean };
      assert.isTrue(data.success);

      // Verify SPA was notified
      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
    });
  });

  describe('executeAction - delete-agent', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      // First select an agent
      await controller.executeAction('select-agent', { name: 'my_custom_agent' });
    });

    it('returns error when no agent selected', async () => {
      // Create new controller without selection
      const newController = app.createController();
      await newController.initialize(createMockBridge());

      const result = await newController.executeAction('delete-agent', {});

      const data = result as { success: boolean; error?: string };
      assert.isFalse(data.success);
      assert.include(data.error?.toLowerCase(), 'no agent selected');
    });
  });

  describe('executeAction - select-tool', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('selects tool by name', async () => {
      const result = await controller.executeAction('select-tool', { name: 'my_custom_tool' });

      const data = result as { success: boolean; tool?: { name: string } };
      assert.isTrue(data.success);
      assert.isDefined(data.tool);
      assert.strictEqual(data.tool?.name, 'my_custom_tool');
    });

    it('returns failure for unknown tool', async () => {
      toolIntegrationStub.resolves([]);
      const result = await controller.executeAction('select-tool', { name: 'unknown_tool' });

      const data = result as { success: boolean };
      assert.isFalse(data.success);
    });
  });

  describe('executeAction - create-tool', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('starts creating new tool', async () => {
      const result = await controller.executeAction('create-tool', {});

      const data = result as { success: boolean };
      assert.isTrue(data.success);

      // Verify SPA was notified
      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
    });
  });

  describe('executeAction - delete-tool', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns error when no tool selected', async () => {
      const result = await controller.executeAction('delete-tool', {});

      const data = result as { success: boolean; error?: string };
      assert.isFalse(data.success);
      assert.include(data.error?.toLowerCase(), 'no tool selected');
    });
  });

  describe('executeAction - unknown action', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('throws error for unknown action', async () => {
      try {
        await controller.executeAction('unknown-action', {});
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.include((error as Error).message, 'Unknown action');
      }
    });
  });
});

// ============================================================================
// AgentStudio SPA Action Handlers Tests
// ============================================================================

describe('AgentStudio SPA Action Handlers', () => {
  let app: AgentStudioMiniApp;
  let controller: ReturnType<AgentStudioMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let actionHandler: (action: unknown) => Promise<void>;

  beforeEach(async () => {
    app = new AgentStudioMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();

    // Mock storage and integration
    const mockAgentStorageInstance = {
      getAllAgents: sinon.stub().resolves([mockCustomAgent]),
      getAgentByName: sinon.stub().resolves(mockCustomAgent),
      createAgent: sinon.stub().resolves(mockCustomAgent),
      updateAgent: sinon.stub().resolves(mockCustomAgent),
      deleteAgent: sinon.stub().resolves(),
    };
    sinon.stub(AgentStorageManager, 'getInstance').returns(mockAgentStorageInstance as unknown as AgentStorageManager);

    const mockToolStorageInstance = {
      getAllTools: sinon.stub().resolves([mockCustomTool]),
      getToolByName: sinon.stub().resolves(mockCustomTool),
      createTool: sinon.stub().resolves(mockCustomTool),
      updateTool: sinon.stub().resolves(mockCustomTool),
      deleteTool: sinon.stub().resolves(),
    };
    sinon.stub(ToolStorageManager, 'getInstance').returns(mockToolStorageInstance as unknown as ToolStorageManager);

    sinon.stub(AgentStudioIntegration, 'getAllAgentsForDisplay').resolves([mockBuiltInAgent, mockCustomAgent]);
    sinon.stub(AgentStudioIntegration, 'getAvailableToolNames').returns(['navigate_url', 'search_content']);
    sinon.stub(AgentStudioIntegration, 'refreshAgents').resolves();

    sinon.stub(ToolStudioIntegration, 'getCustomToolsForDisplay').resolves([mockCustomTool]);
    sinon.stub(ToolStudioIntegration, 'getPresetLibraries').returns([]);
    sinon.stub(ToolStudioIntegration, 'refreshTools').resolves();

    // Capture the action handler
    (mockBridge.onAction as sinon.SinonStub).callsFake((handler: (action: unknown) => Promise<void>) => {
      actionHandler = handler;
    });

    await controller.initialize(mockBridge);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('ready action', () => {
    it('pushes initial state to SPA', async () => {
      await actionHandler({ type: 'ready' });

      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
      const call = (mockBridge.sendToSPA as sinon.SinonStub).getCall(0);
      assert.strictEqual(call.args[0].action, 'init');
    });
  });

  describe('select-tab action', () => {
    it('switches to tools tab', async () => {
      await actionHandler({ type: 'select-tab', tab: 'tools' });

      // Tab state is internal, verify no error thrown
      assert.isTrue(true);
    });

    it('switches to agents tab', async () => {
      await actionHandler({ type: 'select-tab', tab: 'agents' });

      // Tab state is internal, verify no error thrown
      assert.isTrue(true);
    });
  });

  describe('new-agent action', () => {
    it('sends agent-selected with empty agent', async () => {
      await actionHandler({ type: 'new-agent' });

      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
      const calls = (mockBridge.sendToSPA as sinon.SinonStub).getCalls();
      const agentSelectedCall = calls.find(c => c.args[0].action === 'agent-selected');
      assert.isDefined(agentSelectedCall);
      assert.strictEqual(agentSelectedCall?.args[0].payload.agent.name, '');
    });
  });

  describe('new-tool action', () => {
    it('sends tool-selected with empty tool', async () => {
      await actionHandler({ type: 'new-tool' });

      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
      const calls = (mockBridge.sendToSPA as sinon.SinonStub).getCalls();
      const toolSelectedCall = calls.find(c => c.args[0].action === 'tool-selected');
      assert.isDefined(toolSelectedCall);
      assert.strictEqual(toolSelectedCall?.args[0].payload.tool.name, '');
    });
  });

  describe('close action', () => {
    it('calls close callback if set', async () => {
      const closeCallback = sinon.stub();
      controller.onClose(closeCallback);

      await actionHandler({ type: 'close' });

      assert.isTrue(closeCallback.calledOnce);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('AgentStudio Integration', () => {
  let app: AgentStudioMiniApp;
  let controller: ReturnType<AgentStudioMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let actionHandler: (action: unknown) => Promise<void>;

  beforeEach(async () => {
    app = new AgentStudioMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();

    // Mock storage and integration
    const mockAgentStorageInstance = {
      getAllAgents: sinon.stub().resolves([]),
      getAgentByName: sinon.stub().resolves(null),
      createAgent: sinon.stub().callsFake(async (input: { name: string }) => ({
        id: 'new-agent-id',
        name: input.name,
        displayName: input.name,
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
        schema: { type: 'object', properties: {}, required: [] },
      })),
      updateAgent: sinon.stub().resolves(mockCustomAgent),
      deleteAgent: sinon.stub().resolves(),
    };
    sinon.stub(AgentStorageManager, 'getInstance').returns(mockAgentStorageInstance as unknown as AgentStorageManager);

    const mockToolStorageInstance = {
      getAllTools: sinon.stub().resolves([]),
      getToolByName: sinon.stub().resolves(null),
      createTool: sinon.stub().callsFake(async (input: { name: string }) => ({
        id: 'new-tool-id',
        name: input.name,
        displayName: input.name,
        description: '',
        icon: '🔧',
        color: '#00a4fe',
        backgroundColor: '#e2f3fb',
        code: '',
        schema: { type: 'object', properties: {}, required: [] },
        timeout: 10000,
        hasPageAccess: true,
        dependencies: [],
        version: '1.0.0',
      })),
      updateTool: sinon.stub().resolves(mockCustomTool),
      deleteTool: sinon.stub().resolves(),
    };
    sinon.stub(ToolStorageManager, 'getInstance').returns(mockToolStorageInstance as unknown as ToolStorageManager);

    sinon.stub(AgentStudioIntegration, 'getAllAgentsForDisplay').resolves([mockBuiltInAgent]);
    sinon.stub(AgentStudioIntegration, 'getAvailableToolNames').returns(['navigate_url']);
    sinon.stub(AgentStudioIntegration, 'refreshAgents').resolves();

    sinon.stub(ToolStudioIntegration, 'getCustomToolsForDisplay').resolves([]);
    sinon.stub(ToolStudioIntegration, 'getPresetLibraries').returns([]);
    sinon.stub(ToolStudioIntegration, 'refreshTools').resolves();

    // Capture the action handler
    (mockBridge.onAction as sinon.SinonStub).callsFake((handler: (action: unknown) => Promise<void>) => {
      actionHandler = handler;
    });

    await controller.initialize(mockBridge);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('full agent workflow', () => {
    it('create new agent → save agent flow', async () => {
      // 1. Click new agent
      await actionHandler({ type: 'new-agent' });

      // Verify empty agent was sent
      let calls = (mockBridge.sendToSPA as sinon.SinonStub).getCalls();
      let agentSelectedCall = calls.find(c => c.args[0].action === 'agent-selected');
      assert.isDefined(agentSelectedCall);
      assert.strictEqual(agentSelectedCall?.args[0].payload.agent.name, '');

      // 2. Save agent
      await actionHandler({
        type: 'save-agent',
        data: {
          name: 'new_test_agent',
          displayName: 'New Test Agent',
          description: 'A test agent',
          avatar: '🤖',
          color: '#3b82f6',
          systemPrompt: 'You are a test agent.',
          tools: ['navigate_url'],
          maxIterations: 10,
          temperature: 0.7,
          schema: { type: 'object', properties: {}, required: [] },
        },
      });

      // Verify success notification
      calls = (mockBridge.sendToSPA as sinon.SinonStub).getCalls();
      const notificationCall = calls.find(c =>
        c.args[0].action === 'notification' &&
        c.args[0].payload.type === 'success'
      );
      assert.isDefined(notificationCall);
    });
  });

  describe('full tool workflow', () => {
    it('create new tool → save tool flow', async () => {
      // 1. Click new tool
      await actionHandler({ type: 'new-tool' });

      // Verify empty tool was sent
      let calls = (mockBridge.sendToSPA as sinon.SinonStub).getCalls();
      let toolSelectedCall = calls.find(c => c.args[0].action === 'tool-selected');
      assert.isDefined(toolSelectedCall);
      assert.strictEqual(toolSelectedCall?.args[0].payload.tool.name, '');

      // 2. Save tool
      await actionHandler({
        type: 'save-tool',
        data: {
          name: 'new_test_tool',
          displayName: 'New Test Tool',
          description: 'A test tool',
          icon: '🔧',
          color: '#00a4fe',
          code: 'return { result: "success" };',
          schema: { type: 'object', properties: {}, required: [] },
          timeout: 10000,
          dependencies: [],
        },
      });

      // Verify success notification
      calls = (mockBridge.sendToSPA as sinon.SinonStub).getCalls();
      const notificationCall = calls.find(c =>
        c.args[0].action === 'notification' &&
        c.args[0].payload.type === 'success'
      );
      assert.isDefined(notificationCall);
    });
  });
});
