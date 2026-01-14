// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for SPATestHarness - verifies the test harness for Mini Apps SPAs
 */

import {
  SPATestHarness,
  createSPATestHarness,
  MockMiniAppBridge,
} from './SPATestHarness.js';
import type {MiniAppSPA} from '../types/MiniAppTypes.js';

describe('ai_chat: SPATestHarness', () => {
  // Simple test SPA
  const simpleSPA: MiniAppSPA = {
    html: '<div id="app"></div>',
    css: 'body { margin: 0; }',
    js: '// Simple SPA',
  };

  describe('initialization', () => {
    it('creates harness with SPA', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      assert.isOk(harness);
    });

    it('auto-sends ready action by default', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      assert.isTrue(harness.hasAction('ready'));
    });

    it('can disable auto-ready', async () => {
      const harness = new SPATestHarness(simpleSPA, {autoReady: false});
      await harness.initialize();

      assert.isFalse(harness.hasAction('ready'));
    });

    it('accepts initial state', async () => {
      const harness = new SPATestHarness(simpleSPA, {
        initialState: {count: 0, items: []},
      });
      await harness.initialize();

      const state = harness.getState();
      assert.strictEqual(state.count, 0);
      assert.deepEqual(state.items, []);
    });
  });

  describe('state management', () => {
    it('getState returns current state', async () => {
      const harness = new SPATestHarness(simpleSPA, {
        initialState: {value: 42},
      });
      await harness.initialize();

      assert.strictEqual(harness.getState().value, 42);
    });

    it('setState replaces entire state', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.setState({newKey: 'newValue'});

      const state = harness.getState();
      assert.strictEqual(state.newKey, 'newValue');
      assert.isUndefined(state.value); // Old state gone
    });

    it('updateState merges state', async () => {
      const harness = new SPATestHarness(simpleSPA, {
        initialState: {a: 1, b: 2},
      });
      await harness.initialize();

      harness.updateState({b: 3, c: 4});

      const state = harness.getState();
      assert.strictEqual(state.a, 1);
      assert.strictEqual(state.b, 3);
      assert.strictEqual(state.c, 4);
    });
  });

  describe('dispatch (DevTools -> SPA)', () => {
    it('handles set-state action', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.dispatch({action: 'set-state', payload: {foo: 'bar'}});

      assert.strictEqual(harness.getState().foo, 'bar');
    });

    it('handles update-state action', async () => {
      const harness = new SPATestHarness(simpleSPA, {
        initialState: {existing: true},
      });
      await harness.initialize();

      harness.dispatch({action: 'update-state', payload: {added: true}});

      const state = harness.getState();
      assert.isTrue(state.existing);
      assert.isTrue(state.added);
    });
  });

  describe('action capture (SPA -> DevTools)', () => {
    it('captures simulated user actions', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.simulateUserAction('save-data', {id: 123});

      const actions = harness.getCapturedActions();
      const saveAction = actions.find(a => a.type === 'save-data');

      assert.isOk(saveAction);
      assert.deepEqual(saveAction?.payload, {id: 123});
    });

    it('getCapturedActionsOfType filters by type', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.simulateUserAction('type-a', {});
      harness.simulateUserAction('type-b', {});
      harness.simulateUserAction('type-a', {});

      const typeAActions = harness.getCapturedActionsOfType('type-a');
      assert.strictEqual(typeAActions.length, 2);
    });

    it('getLastAction returns most recent action', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.simulateUserAction('first', {});
      harness.simulateUserAction('second', {});
      harness.simulateUserAction('third', {});

      assert.strictEqual(harness.getLastAction()?.type, 'third');
    });

    it('clearCapturedActions removes all actions', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.simulateUserAction('test', {});
      assert.isTrue(harness.getCapturedActions().length > 0);

      harness.clearCapturedActions();
      assert.strictEqual(harness.getCapturedActions().length, 0);
    });
  });

  describe('waitForAction', () => {
    it('resolves when action is captured', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      // Simulate action after a delay
      setTimeout(() => {
        harness.simulateUserAction('delayed-action', {result: 'success'});
      }, 50);

      const action = await harness.waitForAction('delayed-action', 1000);

      assert.strictEqual(action.type, 'delayed-action');
      assert.deepEqual(action.payload, {result: 'success'});
    });

    it('times out if action never captured', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      try {
        await harness.waitForAction('never-happens', 100);
        assert.fail('Should have thrown timeout error');
      } catch (error) {
        assert.include((error as Error).message, 'Timeout');
      }
    });
  });

  describe('reset', () => {
    it('restores initial state', async () => {
      const harness = new SPATestHarness(simpleSPA, {
        initialState: {original: true},
      });
      await harness.initialize();

      harness.setState({modified: true});
      assert.isTrue(harness.getState().modified);

      harness.reset();

      assert.isTrue(harness.getState().original);
      assert.isUndefined(harness.getState().modified);
    });

    it('clears captured actions', async () => {
      const harness = new SPATestHarness(simpleSPA);
      await harness.initialize();

      harness.simulateUserAction('test', {});
      assert.isTrue(harness.getCapturedActions().length > 0);

      harness.reset();

      assert.strictEqual(harness.getCapturedActions().length, 0);
    });
  });

  describe('createSPATestHarness helper', () => {
    it('creates harness instance', () => {
      const harness = createSPATestHarness(simpleSPA);
      assert.isOk(harness);
    });

    it('passes options through', () => {
      const harness = createSPATestHarness(simpleSPA, {
        initialState: {test: true},
        autoReady: false,
      });

      assert.strictEqual(harness.getState().test, true);
    });
  });
});

describe('ai_chat: MockMiniAppBridge', () => {
  describe('installation', () => {
    it('starts uninstalled', () => {
      const bridge = new MockMiniAppBridge();

      assert.isFalse(bridge.installed);
      assert.isNull(bridge.webappId);
    });

    it('install sets state', async () => {
      const bridge = new MockMiniAppBridge();
      await bridge.install('webapp-123');

      assert.isTrue(bridge.installed);
      assert.strictEqual(bridge.webappId, 'webapp-123');
    });

    it('uninstall clears state', async () => {
      const bridge = new MockMiniAppBridge();
      await bridge.install('webapp-123');
      await bridge.uninstall();

      assert.isFalse(bridge.installed);
      assert.isNull(bridge.webappId);
    });
  });

  describe('sendToSPA', () => {
    it('captures sent actions', async () => {
      const bridge = new MockMiniAppBridge();
      await bridge.install('webapp-123');

      await bridge.sendToSPA({action: 'init', payload: {data: []}});
      await bridge.sendToSPA({action: 'update-state', payload: {count: 5}});

      const sent = bridge.getSentActions();
      assert.strictEqual(sent.length, 2);
      assert.strictEqual(sent[0].action, 'init');
      assert.strictEqual(sent[1].action, 'update-state');
    });

    it('getLastSentAction returns most recent', async () => {
      const bridge = new MockMiniAppBridge();

      await bridge.sendToSPA({action: 'first'});
      await bridge.sendToSPA({action: 'second'});

      assert.strictEqual(bridge.getLastSentAction()?.action, 'second');
    });

    it('clearSentActions removes all', async () => {
      const bridge = new MockMiniAppBridge();

      await bridge.sendToSPA({action: 'test'});
      assert.strictEqual(bridge.getSentActions().length, 1);

      bridge.clearSentActions();
      assert.strictEqual(bridge.getSentActions().length, 0);
    });
  });

  describe('simulateSPAAction', () => {
    it('calls registered action handler', async () => {
      const bridge = new MockMiniAppBridge();
      const receivedActions: unknown[] = [];

      bridge.onAction(action => {
        receivedActions.push(action);
      });

      await bridge.simulateSPAAction({type: 'user-clicked', payload: {x: 10}});

      assert.strictEqual(receivedActions.length, 1);
      assert.deepEqual(receivedActions[0], {type: 'user-clicked', payload: {x: 10}});
    });

    it('handles async action handlers', async () => {
      const bridge = new MockMiniAppBridge();
      let processed = false;

      bridge.onAction(async () => {
        await new Promise(r => setTimeout(r, 10));
        processed = true;
      });

      await bridge.simulateSPAAction({type: 'async-action'});

      assert.isTrue(processed);
    });
  });

  describe('getState', () => {
    it('returns mock state', async () => {
      const bridge = new MockMiniAppBridge();
      bridge.setMockState({items: [1, 2, 3]});

      const state = await bridge.getState();

      assert.deepEqual(state.items, [1, 2, 3]);
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      const bridge = new MockMiniAppBridge();
      await bridge.install('webapp-123');
      await bridge.sendToSPA({action: 'test'});
      bridge.setMockState({data: 'something'});

      bridge.reset();

      assert.isFalse(bridge.installed);
      assert.isNull(bridge.webappId);
      assert.strictEqual(bridge.getSentActions().length, 0);
      const state = await bridge.getState();
      assert.deepEqual(state, {});
    });
  });
});
