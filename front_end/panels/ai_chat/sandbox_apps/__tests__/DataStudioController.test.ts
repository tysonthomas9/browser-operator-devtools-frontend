// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for DataStudioController action format handling
 *
 * This test file verifies:
 * 1. Both action message formats (SPA format vs AI tool format)
 * 2. All required action handlers exist
 *
 * Note: These are unit tests that focus on the controller's action handling
 * logic. We set up the bridge directly without calling initialize() to avoid
 * loading the full dependency chain (AgentService, ChatView, etc.).
 */

// Sinon is provided globally by the test environment
declare const sinon: typeof import('sinon');

import {DataStudioController} from '../apps/data-studio/DataStudioController.js';
import type {SandboxAppBridge, SandboxAppAction} from '../types/SandboxAppTypes.js';

// =============================================================================
// Mock Bridge Factory
// =============================================================================

function createMockBridge(options: {installed?: boolean; state?: Record<string, unknown>} = {}): SandboxAppBridge & {
  sentMessages: object[];
} {
  const sentMessages: object[] = [];

  return {
    installed: options.installed ?? true,
    sentMessages,

    install: sinon.stub().resolves(),
    uninstall: sinon.stub().resolves(),

    sendToSPA: sinon.stub().callsFake(async (message: object) => {
      sentMessages.push(message);
    }),

    onMessage: sinon.stub(),

    getState: sinon.stub().resolves(options.state ?? {}),
  };
}

/**
 * Helper to set up controller with bridge without calling initialize()
 * This avoids loading the DataStudioExecutor dependency chain
 */
function setupController(mockBridge: SandboxAppBridge): DataStudioController {
  const controller = new DataStudioController('test-instance-id');
  // Set the private bridge property directly
  (controller as unknown as {bridge: SandboxAppBridge}).bridge = mockBridge;
  return controller;
}

// =============================================================================
// Tests
// =============================================================================

describe('ai_chat: DataStudioController', () => {
  let controller: DataStudioController;
  let mockBridge: ReturnType<typeof createMockBridge>;

  beforeEach(() => {
    mockBridge = createMockBridge();
    controller = setupController(mockBridge);
  });

  // ===========================================================================
  // Basic Tests
  // ===========================================================================

  describe('basic', () => {
    it('has correct appId', () => {
      assert.strictEqual(controller.appId, 'test-instance-id');
    });
  });

  // ===========================================================================
  // Issue #1: Format Mismatch Tests
  // ===========================================================================

  describe('issue #1: action message format compatibility', () => {
    describe('AI tool format: { type: "action", payload: { name, args } }', () => {
      it('handles AI tool format for create-table', async () => {
        const toolAction: SandboxAppAction = {
          type: 'action',
          payload: {
            name: 'create-table',
            args: {
              name: 'Test Table',
              entityType: 'Company',
              entityNameLabel: 'Name',
            },
          },
        };

        await controller.handleMessage(toolAction);
        assert.isTrue(mockBridge.sentMessages.length > 0);
      });

      it('handles AI tool format for run-cell', async () => {
        const toolAction: SandboxAppAction = {
          type: 'action',
          payload: {
            name: 'run-cell',
            args: {
              entityId: 'entity-1',
              agentGroupId: 'agent-group-1',
            },
          },
        };

        await controller.handleMessage(toolAction);
        assert.isTrue(mockBridge.sentMessages.length > 0);
      });
    });

    describe('SPA format: { type: "action-name", payload: {...} }', () => {
      it('handles SPA format for run-agent-group', async () => {
        const spaAction: SandboxAppAction = {
          type: 'run-agent-group',
          payload: {
            entityId: 'entity-1',
            agentGroupId: 'agent-group-1',
          },
        };

        await controller.handleMessage(spaAction);
        assert.isTrue(mockBridge.sentMessages.length > 0);
      });

      it('handles SPA format for add-entity', async () => {
        const spaAction: SandboxAppAction = {
          type: 'add-entity',
          payload: {
            name: 'Test Entity',
            context: 'Some context',
          },
        };

        await controller.handleMessage(spaAction);
        assert.isTrue(mockBridge.sentMessages.length > 0);
      });
    });
  });

  // ===========================================================================
  // Issue #2: Name Alias Tests
  // ===========================================================================

  describe('issue #2: action name aliases', () => {
    it('executeAction handles "run-cell" name', async () => {
      const result = await controller.executeAction('run-cell', {
        entityId: 'entity-1',
        agentGroupId: 'agent-group-1',
      });

      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('executeAction handles "run-agent-group" (maps to run-cell)', async () => {
      const result = await controller.executeAction('run-agent-group', {
        entityId: 'entity-1',
        agentGroupId: 'agent-group-1',
      });

      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });
  });

  // ===========================================================================
  // Issue #3: Missing Handlers Tests
  // ===========================================================================

  describe('issue #3: missing action handlers', () => {
    it('handles "close" action', async () => {
      const result = await controller.executeAction('close', {});
      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('handles "delete-table" action', async () => {
      const result = await controller.executeAction('delete-table', {tableId: 'table-1'});
      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('handles "remove-agent-group" action', async () => {
      const result = await controller.executeAction('remove-agent-group', {agentGroupId: 'ag-1'});
      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('handles "get-state" action', async () => {
      const result = await controller.executeAction('get-state', {});
      assert.isOk(result);
    });

    it('handles "close-table" action', async () => {
      const result = await controller.executeAction('close-table', {});
      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('handles "use-template" action', async () => {
      const result = await controller.executeAction('use-template', {
        templateId: 'competitor_analysis',
        tableName: 'My Analysis',
      });
      assert.isOk(result);
      assert.strictEqual((result as {success: boolean}).success, true);
    });
  });

  // ===========================================================================
  // State Management Tests
  // ===========================================================================

  describe('state management', () => {
    it('getState delegates to bridge', async () => {
      const state = await controller.getState();
      assert.isOk(state);
    });

    it('setState sends message to SPA', async () => {
      await controller.setState({view: 'table'});

      const setStateMessage = mockBridge.sentMessages.find(
        (m: {type?: string}) => m.type === 'set-state'
      );
      assert.isOk(setStateMessage);
    });

    it('getState returns empty object when bridge not installed', async () => {
      const uninstalledBridge = createMockBridge({installed: false});
      const newController = setupController(uninstalledBridge);

      const state = await newController.getState();
      assert.deepStrictEqual(state, {});
    });
  });

  // ===========================================================================
  // Execute Action Tests (Existing Handlers)
  // ===========================================================================

  describe('executeAction - existing handlers', () => {
    it('create-table sends execute message to SPA', async () => {
      const result = await controller.executeAction('create-table', {
        name: 'Test Table',
        entityType: 'Company',
        entityNameLabel: 'Name',
      });

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('add-entity sends execute message to SPA', async () => {
      const result = await controller.executeAction('add-entity', {
        name: 'Test Entity',
        context: 'Test context',
      });

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('add-entities adds multiple entities', async () => {
      const result = await controller.executeAction('add-entities', {
        entities: [
          {name: 'Entity 1'},
          {name: 'Entity 2'},
          {name: 'Entity 3'},
        ],
      });

      assert.strictEqual((result as {success: boolean}).success, true);
      assert.strictEqual((result as {count: number}).count, 3);
    });

    it('remove-entity sends execute message to SPA', async () => {
      const result = await controller.executeAction('remove-entity', {
        entityId: 'entity-1',
      });

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('add-agent-group sends execute message to SPA', async () => {
      const result = await controller.executeAction('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [{key: 'summary', label: 'Summary'}],
      });

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('run-row sends execute message to SPA', async () => {
      const result = await controller.executeAction('run-row', {
        entityId: 'entity-1',
      });

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('run-all sends execute message to SPA', async () => {
      const result = await controller.executeAction('run-all', {});

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('pause-execution sends execute message to SPA', async () => {
      const result = await controller.executeAction('pause-execution', {});

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('save-table sends execute message to SPA', async () => {
      const result = await controller.executeAction('save-table', {});

      assert.strictEqual((result as {success: boolean}).success, true);
    });

    it('load-table sends execute message to SPA', async () => {
      const result = await controller.executeAction('load-table', {
        tableId: 'table-1',
      });

      assert.strictEqual((result as {success: boolean}).success, true);
    });
  });

  // ===========================================================================
  // Integration Test: SPA Action Flow
  // ===========================================================================

  describe('integration: SPA action flow', () => {
    it('simulates complete SPA action flow', async () => {
      // SPA sends 'ready' (meta message, should not throw)
      await controller.handleMessage({type: 'ready'});

      // SPA sends create-table via AI tool format
      await controller.handleMessage({
        type: 'action',
        payload: {
          name: 'create-table',
          args: {
            name: 'My Analysis',
            entityType: 'Company',
            entityNameLabel: 'Company Name',
          },
        },
      });

      // SPA sends add-entity via SPA format
      await controller.handleMessage({
        type: 'add-entity',
        payload: {name: 'OpenAI'},
      });

      // Verify messages were sent
      assert.isTrue(mockBridge.sentMessages.length >= 2);
    });

    it('simulates run-agent-group from SPA', async () => {
      const spaAction: SandboxAppAction = {
        type: 'run-agent-group',
        payload: {
          entityId: 'entity-1',
          agentGroupId: 'agent-1',
        },
      };

      await controller.handleMessage(spaAction);

      // Should map to run-cell and execute
      assert.isTrue(mockBridge.sentMessages.length > 0);
      const executeMsg = mockBridge.sentMessages.find(
        (m: {type?: string; payload?: {action?: string}}) =>
          m.type === 'execute' && m.payload?.action === 'run-agent-group'
      );
      assert.isOk(executeMsg);
    });
  });
});
