// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { DataStudioMiniApp } from '../DataStudioMiniApp.js';
import { MiniAppStorageManager } from '../../../MiniAppStorageManager.js';
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

function createMockStorage(): Map<string, unknown> {
  return new Map();
}

// ============================================================================
// DataStudioMiniApp Tests
// ============================================================================

describe('DataStudioMiniApp', () => {
  let app: DataStudioMiniApp;

  beforeEach(() => {
    app = new DataStudioMiniApp();
  });

  describe('metadata', () => {
    it('has correct id', () => {
      assert.strictEqual(app.id, 'data_studio');
    });

    it('has correct name', () => {
      assert.strictEqual(app.name, 'Data Studio');
    });

    it('has icon', () => {
      assert.strictEqual(app.icon, '📊');
    });

    it('has description', () => {
      assert.isString(app.description);
      assert.isTrue(app.description.length > 0);
    });

    it('has routes defined', () => {
      assert.isArray(app.routes);
      assert.isTrue(app.routes.length >= 2);

      const selectorRoute = app.routes.find(r => r.name === 'selector');
      assert.isDefined(selectorRoute);
      assert.strictEqual(selectorRoute?.pattern, '#data-studio');

      const tableRoute = app.routes.find(r => r.name === 'table');
      assert.isDefined(tableRoute);
      assert.include(tableRoute?.pattern, ':tableId');
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
    it('includes create-table action', () => {
      const actions = app.getSupportedActions();
      const createAction = actions.find(a => a.name === 'create-table');

      assert.isDefined(createAction);
      assert.include(createAction?.description?.toLowerCase(), 'create');
    });

    it('includes add-entity action', () => {
      const actions = app.getSupportedActions();
      const addEntityAction = actions.find(a => a.name === 'add-entity');

      assert.isDefined(addEntityAction);
    });

    it('includes add-agent-group action', () => {
      const actions = app.getSupportedActions();
      const addAgentAction = actions.find(a => a.name === 'add-agent-group');

      assert.isDefined(addAgentAction);
    });

    it('includes run-agent-group action', () => {
      const actions = app.getSupportedActions();
      const runAction = actions.find(a => a.name === 'run-agent-group');

      assert.isDefined(runAction);
    });

    it('includes list-templates action', () => {
      const actions = app.getSupportedActions();
      const templatesAction = actions.find(a => a.name === 'list-templates');

      assert.isDefined(templatesAction);
    });

    it('has at least 14 actions', () => {
      const actions = app.getSupportedActions();
      assert.isTrue(actions.length >= 14, `Expected at least 14 actions, got ${actions.length}`);
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
// DataStudioController Tests
// ============================================================================

describe('DataStudioController', () => {
  let app: DataStudioMiniApp;
  let controller: ReturnType<DataStudioMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let mockStorageData: Map<string, unknown>;
  let storageStub: sinon.SinonStub;

  beforeEach(() => {
    app = new DataStudioMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();
    mockStorageData = createMockStorage();

    // Mock MiniAppStorageManager
    const mockStorageInstance = {
      get: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        return mockStorageData.get(fullKey);
      }),
      set: sinon.stub().callsFake(async (prefix: string, key: string, value: unknown) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.set(fullKey, value);
      }),
      delete: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.delete(fullKey);
      }),
      list: sinon.stub().resolves([]),
    };

    storageStub = sinon.stub(MiniAppStorageManager, 'getInstance').returns(mockStorageInstance as unknown as MiniAppStorageManager);
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

    it('returns state with view property', async () => {
      const state = await controller.getState();

      assert.isDefined(state.view);
      assert.strictEqual(state.view, 'selector');
    });

    it('returns state with tables array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.tables);
      assert.isArray(state.tables);
    });

    it('returns state with templates array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.templates);
      assert.isArray(state.templates);
    });

    it('returns state with availableAgents array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.availableAgents);
      assert.isArray(state.availableAgents);
    });
  });

  describe('executeAction - create-table', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('creates a table with given parameters', async () => {
      const result = await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });

      assert.isDefined(result);
      const table = result as { tableId: string; tableName: string; entityType: string };
      assert.strictEqual(table.tableName, 'Test Table');
      assert.strictEqual(table.entityType, 'Company');
      assert.isTrue(table.tableId.startsWith('table_'));
    });

    it('creates table with empty entities and agentGroups', async () => {
      const result = await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Product',
        entityNameLabel: 'Product Name',
      });

      const table = result as { entities: unknown[]; agentGroups: unknown[] };
      assert.isArray(table.entities);
      assert.strictEqual(table.entities.length, 0);
      assert.isArray(table.agentGroups);
      assert.strictEqual(table.agentGroups.length, 0);
    });

    it('stores the table in storage', async () => {
      const result = await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Lead',
        entityNameLabel: 'Lead Name',
      });

      const table = result as { tableId: string };
      const storedTable = mockStorageData.get(`data_studio:table_${table.tableId}`);
      assert.isDefined(storedTable);
    });
  });

  describe('executeAction - add-entity', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });
    });

    it('adds an entity to the table', async () => {
      const result = await controller.executeAction('add-entity', {
        name: 'Test Company',
      });

      const entity = result as { id: string; name: string };
      assert.strictEqual(entity.name, 'Test Company');
      assert.isTrue(entity.id.startsWith('entity_'));
    });

    it('adds entity with context', async () => {
      const result = await controller.executeAction('add-entity', {
        name: 'Test Company',
        context: 'A tech company',
      });

      const entity = result as { name: string; context?: string };
      assert.strictEqual(entity.name, 'Test Company');
      assert.strictEqual(entity.context, 'A tech company');
    });
  });

  describe('executeAction - remove-entity', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });
    });

    it('removes an entity from the table', async () => {
      const entity = await controller.executeAction('add-entity', {
        name: 'Test Company',
      }) as { id: string };

      await controller.executeAction('remove-entity', {
        entityId: entity.id,
      });

      const state = await controller.getState();
      const currentTable = state.currentTable as { entities: Array<{ id: string }> } | null;
      const found = currentTable?.entities.find(e => e.id === entity.id);
      assert.isUndefined(found);
    });
  });

  describe('executeAction - add-agent-group', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });
    });

    it('adds an agent group to the table', async () => {
      const result = await controller.executeAction('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [
          { key: 'summary', label: 'Summary' },
        ],
      });

      const agentGroup = result as { id: string; agentName: string };
      assert.strictEqual(agentGroup.agentName, 'search_agent');
      assert.isTrue(agentGroup.id.startsWith('agent_'));
    });

    it('agent group has output columns', async () => {
      const result = await controller.executeAction('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [
          { key: 'summary', label: 'Summary' },
          { key: 'details', label: 'Details' },
        ],
      });

      const agentGroup = result as { outputColumns: Array<{ key: string; label: string }> };
      assert.strictEqual(agentGroup.outputColumns.length, 2);
      assert.strictEqual(agentGroup.outputColumns[0].key, 'summary');
      assert.strictEqual(agentGroup.outputColumns[1].key, 'details');
    });

    it('initializes pending results for existing entities', async () => {
      await controller.executeAction('add-entity', { name: 'Company A' });
      await controller.executeAction('add-entity', { name: 'Company B' });

      const agentGroup = await controller.executeAction('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [{ key: 'summary', label: 'Summary' }],
      }) as { id: string };

      const state = await controller.getState();
      const currentTable = state.currentTable as {
        entities: Array<{ id: string }>;
        results: Record<string, Record<string, { status: string }>>;
      };

      for (const entity of currentTable.entities) {
        const result = currentTable.results[entity.id]?.[agentGroup.id];
        assert.isDefined(result);
        assert.strictEqual(result?.status, 'pending');
      }
    });
  });

  describe('executeAction - remove-agent-group', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });
    });

    it('removes an agent group from the table', async () => {
      const agentGroup = await controller.executeAction('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [{ key: 'summary', label: 'Summary' }],
      }) as { id: string };

      await controller.executeAction('remove-agent-group', {
        agentGroupId: agentGroup.id,
      });

      const state = await controller.getState();
      const currentTable = state.currentTable as { agentGroups: Array<{ id: string }> } | null;
      const found = currentTable?.agentGroups.find(ag => ag.id === agentGroup.id);
      assert.isUndefined(found);
    });
  });

  describe('executeAction - list-templates', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns templates array', async () => {
      const result = await controller.executeAction('list-templates', {});

      const data = result as { templates: unknown[] };
      assert.isDefined(data.templates);
      assert.isArray(data.templates);
    });

    it('returns 3 built-in templates', async () => {
      const result = await controller.executeAction('list-templates', {});

      const data = result as { templates: Array<{ id: string }> };
      assert.strictEqual(data.templates.length, 3);
    });
  });

  describe('executeAction - pause-execution', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });
    });

    it('sets executionStatus to paused', async () => {
      await controller.executeAction('pause-execution', {});

      const state = await controller.getState();
      const currentTable = state.currentTable as { executionStatus: string } | null;
      assert.strictEqual(currentTable?.executionStatus, 'paused');
    });
  });

  describe('executeAction - clear-results', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
      await controller.executeAction('create-table', {
        tableName: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Company Name',
      });
      await controller.executeAction('add-entity', { name: 'Company A' });
      await controller.executeAction('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [{ key: 'summary', label: 'Summary' }],
      });
    });

    it('resets all results to pending', async () => {
      await controller.executeAction('clear-results', {});

      const state = await controller.getState();
      const currentTable = state.currentTable as {
        results: Record<string, Record<string, { status: string }>>;
      };

      for (const entityResults of Object.values(currentTable.results)) {
        for (const result of Object.values(entityResults)) {
          assert.strictEqual(result.status, 'pending');
        }
      }
    });
  });
});

// ============================================================================
// DataStudio Templates Tests
// ============================================================================

describe('DataStudio Templates', () => {
  let app: DataStudioMiniApp;
  let controller: ReturnType<DataStudioMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let mockStorageData: Map<string, unknown>;

  beforeEach(async () => {
    app = new DataStudioMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();
    mockStorageData = createMockStorage();

    const mockStorageInstance = {
      get: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        return mockStorageData.get(fullKey);
      }),
      set: sinon.stub().callsFake(async (prefix: string, key: string, value: unknown) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.set(fullKey, value);
      }),
      delete: sinon.stub().resolves(),
      list: sinon.stub().resolves([]),
    };

    sinon.stub(MiniAppStorageManager, 'getInstance').returns(mockStorageInstance as unknown as MiniAppStorageManager);
    await controller.initialize(mockBridge);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('template structure', () => {
    it('Competitor Analysis template exists', async () => {
      const result = await controller.executeAction('list-templates', {});
      const data = result as { templates: Array<{ id: string; name: string }> };

      const template = data.templates.find(t => t.id === 'competitor_analysis');
      assert.isDefined(template);
      assert.strictEqual(template?.name, 'Competitor Analysis');
    });

    it('Product Research template exists', async () => {
      const result = await controller.executeAction('list-templates', {});
      const data = result as { templates: Array<{ id: string; name: string }> };

      const template = data.templates.find(t => t.id === 'product_research');
      assert.isDefined(template);
      assert.strictEqual(template?.name, 'Product Research');
    });

    it('Lead Qualification template exists', async () => {
      const result = await controller.executeAction('list-templates', {});
      const data = result as { templates: Array<{ id: string; name: string }> };

      const template = data.templates.find(t => t.id === 'lead_qualification');
      assert.isDefined(template);
      assert.strictEqual(template?.name, 'Lead Qualification');
    });
  });

  describe('use-template action', () => {
    it('creates table from Competitor Analysis template', async () => {
      const result = await controller.executeAction('use-template', {
        templateId: 'competitor_analysis',
        tableName: 'My Competitors',
      });

      const table = result as {
        tableName: string;
        entityType: string;
        entities: unknown[];
        agentGroups: unknown[];
      };
      assert.strictEqual(table.tableName, 'My Competitors');
      assert.strictEqual(table.entityType, 'Competitor');
      assert.isTrue(table.entities.length > 0, 'Should have example entities');
      assert.isTrue(table.agentGroups.length > 0, 'Should have example agent groups');
    });

    it('throws error for unknown template', async () => {
      try {
        await controller.executeAction('use-template', {
          templateId: 'unknown_template',
          tableName: 'Test',
        });
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.include((error as Error).message, 'not found');
      }
    });
  });
});

// ============================================================================
// DataStudio Integration Tests
// ============================================================================

describe('DataStudio Integration', () => {
  let app: DataStudioMiniApp;
  let controller: ReturnType<DataStudioMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let mockStorageData: Map<string, unknown>;
  let actionHandler: (action: unknown) => Promise<void>;

  beforeEach(async () => {
    app = new DataStudioMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();
    mockStorageData = createMockStorage();

    const mockStorageInstance = {
      get: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        return mockStorageData.get(fullKey);
      }),
      set: sinon.stub().callsFake(async (prefix: string, key: string, value: unknown) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.set(fullKey, value);
      }),
      delete: sinon.stub().resolves(),
      list: sinon.stub().resolves([]),
    };

    sinon.stub(MiniAppStorageManager, 'getInstance').returns(mockStorageInstance as unknown as MiniAppStorageManager);

    // Capture action handler
    (mockBridge.onAction as sinon.SinonStub).callsFake((handler: (action: unknown) => Promise<void>) => {
      actionHandler = handler;
    });

    await controller.initialize(mockBridge);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('full workflow', () => {
    it('handles ready action by pushing state to SPA', async () => {
      await actionHandler({ type: 'ready' });

      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
    });

    it('create table → add entity → add agent flow works', async () => {
      // Create table
      await actionHandler({
        type: 'create-table',
        tableName: 'Integration Test Table',
        entityType: 'Test Entity',
        entityNameLabel: 'Name',
      });

      let state = await controller.getState();
      assert.strictEqual(state.view, 'table');
      assert.isDefined(state.currentTable);

      // Add entity
      await actionHandler({
        type: 'add-entity',
        name: 'Test Entity 1',
        context: 'Some context',
      });

      state = await controller.getState();
      const currentTable = state.currentTable as { entities: Array<{ name: string }> };
      assert.strictEqual(currentTable.entities.length, 1);
      assert.strictEqual(currentTable.entities[0].name, 'Test Entity 1');

      // Add agent group
      await actionHandler({
        type: 'add-agent-group',
        agentName: 'search_agent',
        queryTemplate: 'Analyze {entity}',
        outputColumns: [{ key: 'result', label: 'Result' }],
      });

      state = await controller.getState();
      const tableWithAgent = state.currentTable as {
        agentGroups: Array<{ id: string; agentName: string }>;
        results: Record<string, Record<string, { status: string }>>;
      };
      assert.strictEqual(tableWithAgent.agentGroups.length, 1);
      assert.strictEqual(tableWithAgent.agentGroups[0].agentName, 'search_agent');

      // Verify results were initialized
      const entityId = (state.currentTable as { entities: Array<{ id: string }> }).entities[0].id;
      const agentGroupId = tableWithAgent.agentGroups[0].id;
      assert.isDefined(tableWithAgent.results[entityId]);
      assert.isDefined(tableWithAgent.results[entityId][agentGroupId]);
      assert.strictEqual(tableWithAgent.results[entityId][agentGroupId].status, 'pending');
    });

    it('close-table returns to selector view', async () => {
      // Create table first
      await actionHandler({
        type: 'create-table',
        tableName: 'Test Table',
        entityType: 'Test',
        entityNameLabel: 'Name',
      });

      let state = await controller.getState();
      assert.strictEqual(state.view, 'table');

      // Close table
      await actionHandler({ type: 'close-table' });

      state = await controller.getState();
      assert.strictEqual(state.view, 'selector');
      assert.isNull(state.currentTable);
    });
  });
});
