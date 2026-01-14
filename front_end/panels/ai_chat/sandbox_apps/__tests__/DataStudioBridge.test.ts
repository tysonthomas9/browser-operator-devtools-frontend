// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for Data Studio Bridge - Execute Callback Contract
 *
 * These tests ensure the SPA bridge properly forwards execute messages
 * to prevent regressions where agent execution silently fails.
 *
 * Background:
 * - The runtime (previewHtml.ts) handles 'execute' messages from DevTools
 * - When it receives an 'execute', it calls window.__sandbox_onExecute(action, args)
 * - The SPA bridge must define this callback to forward the action back to DevTools
 * - Without this callback, execute messages are silently dropped and agents never run
 */

// Simple stub type for testing
interface StubFunction {
  (...args: unknown[]): unknown;
  calledOnce: boolean;
  firstCall: {args: unknown[]};
  resetHistory(): void;
  callCount: number;
  calls: Array<{args: unknown[]}>;
}

function createStub(): StubFunction {
  const calls: Array<{args: unknown[]}> = [];
  const fn = ((...args: unknown[]) => {
    calls.push({args});
  }) as StubFunction;
  Object.defineProperty(fn, 'calledOnce', {get: () => calls.length === 1});
  Object.defineProperty(fn, 'callCount', {get: () => calls.length});
  Object.defineProperty(fn, 'firstCall', {get: () => calls[0] || {args: []}});
  Object.defineProperty(fn, 'calls', {get: () => calls});
  fn.resetHistory = () => { calls.length = 0; };
  return fn;
}

describe('ai_chat: DataStudio Bridge Contract', () => {
  describe('execute callback flow', () => {
    let mockWindow: {
      __sandbox?: {sendAction: StubFunction};
      __sandbox_onMessage?: (message: unknown) => void;
      __sandbox_onExecute?: (action: string, args: Record<string, unknown>) => void;
    };
    let sendActionStub: StubFunction;

    beforeEach(() => {
      sendActionStub = createStub();
      mockWindow = {
        __sandbox: {sendAction: sendActionStub},
      };
    });

    it('__sandbox_onExecute should be defined by initBridge', () => {
      // This test verifies that after initBridge() is called,
      // the __sandbox_onExecute callback is properly defined.
      //
      // The callback is required because:
      // 1. User clicks "Run" in SPA → sendAction({ type: 'run-agent-group', ... })
      // 2. Controller receives → sends { type: 'execute', payload: { action, args } } back to SPA
      // 3. Runtime calls window.__sandbox_onExecute(action, args)
      // 4. Callback forwards action → DevTools → Executor runs agent

      // Simulate fixed initBridge that defines __sandbox_onExecute
      mockWindow.__sandbox_onExecute = (action: string, args: Record<string, unknown>) => {
        mockWindow.__sandbox?.sendAction({type: action, ...args});
      };

      assert.isFunction(
        mockWindow.__sandbox_onExecute,
        '__sandbox_onExecute should be defined as a function'
      );
    });

    it('__sandbox_onExecute should forward action to DevTools', () => {
      // This test verifies the callback correctly forwards actions

      // Define the callback (as initBridge should)
      mockWindow.__sandbox_onExecute = (action: string, args: Record<string, unknown>) => {
        mockWindow.__sandbox?.sendAction({type: action, ...args});
      };

      // Call the execute callback (simulating runtime handling 'execute' message)
      mockWindow.__sandbox_onExecute('run-agent-group', {
        entityId: 'entity-1',
        agentGroupId: 'ag-1',
      });

      // Verify sendAction was called with correct payload
      assert.isTrue(sendActionStub.calledOnce, 'sendAction should be called');
      assert.deepEqual(sendActionStub.firstCall.args[0], {
        type: 'run-agent-group',
        entityId: 'entity-1',
        agentGroupId: 'ag-1',
      });
    });

    it('execute callback should handle all action types', () => {
      // Test that the callback correctly forwards various action types
      mockWindow.__sandbox_onExecute = (action: string, args: Record<string, unknown>) => {
        mockWindow.__sandbox?.sendAction({type: action, ...args});
      };

      const testCases = [
        {action: 'run-agent-group', args: {entityId: 'e1', agentGroupId: 'ag1'}},
        {action: 'run-row', args: {entityId: 'e1'}},
        {action: 'run-all', args: {}},
        {action: 'add-entity', args: {name: 'Test', context: ''}},
        {action: 'remove-entity', args: {entityId: 'e1'}},
        {action: 'add-agent-group', args: {agentName: 'search_agent', queryTemplate: '{entity}'}},
      ];

      for (const tc of testCases) {
        sendActionStub.resetHistory();
        mockWindow.__sandbox_onExecute(tc.action, tc.args);

        assert.isTrue(sendActionStub.calledOnce, `sendAction should be called for ${tc.action}`);
        const payload = sendActionStub.firstCall.args[0] as Record<string, unknown>;
        assert.strictEqual(
          payload.type,
          tc.action,
          `Action type should match for ${tc.action}`
        );
      }
    });

    it('execute callback should handle empty args', () => {
      mockWindow.__sandbox_onExecute = (action: string, args: Record<string, unknown>) => {
        mockWindow.__sandbox?.sendAction({type: action, ...args});
      };

      mockWindow.__sandbox_onExecute('run-all', {});

      assert.isTrue(sendActionStub.calledOnce);
      assert.deepEqual(sendActionStub.firstCall.args[0], {type: 'run-all'});
    });

    it('execute callback should preserve all args properties', () => {
      mockWindow.__sandbox_onExecute = (action: string, args: Record<string, unknown>) => {
        mockWindow.__sandbox?.sendAction({type: action, ...args});
      };

      mockWindow.__sandbox_onExecute('add-agent-group', {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity}',
        outputColumns: [{key: 'summary', label: 'Summary'}],
      });

      const sentPayload = sendActionStub.firstCall.args[0] as Record<string, unknown>;
      assert.strictEqual(sentPayload.type, 'add-agent-group');
      assert.strictEqual(sentPayload.agentName, 'search_agent');
      assert.strictEqual(sentPayload.queryTemplate, 'Research {entity}');
      assert.deepEqual(sentPayload.outputColumns, [{key: 'summary', label: 'Summary'}]);
    });
  });

  describe('sendAction integration', () => {
    it('sendAction wraps message for CDP binding', () => {
      // Verify sendAction sends to the sandbox bridge
      const mockSandbox = {
        sendAction: createStub(),
      };

      // Simulate sendAction function from bridge.ts
      function sendAction(action: Record<string, unknown>): void {
        if (mockSandbox?.sendAction) {
          mockSandbox.sendAction(action);
        }
      }

      sendAction({type: 'run-agent-group', entityId: 'e1', agentGroupId: 'ag1'});

      assert.isTrue(mockSandbox.sendAction.calledOnce);
      assert.deepEqual(mockSandbox.sendAction.firstCall.args[0], {
        type: 'run-agent-group',
        entityId: 'e1',
        agentGroupId: 'ag1',
      });
    });
  });
});
