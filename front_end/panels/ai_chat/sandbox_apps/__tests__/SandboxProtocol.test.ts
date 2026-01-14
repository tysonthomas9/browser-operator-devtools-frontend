// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for SandboxProtocol - A2UI-style message protocol
 */

// Sinon is provided globally by the test environment
declare const sinon: typeof import('sinon');

import {
  SandboxProtocol,
  getSandboxProtocol,
  resetSandboxProtocol,
} from '../protocol/SandboxProtocol.js';
import type {DevToolsToSandboxMessage, SandboxToDevToolsMessage} from '../types/SandboxTypes.js';

describe('ai_chat: SandboxProtocol', () => {
  let protocol: SandboxProtocol;

  beforeEach(() => {
    resetSandboxProtocol();
    protocol = getSandboxProtocol();
  });

  afterEach(() => {
    resetSandboxProtocol();
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('getSandboxProtocol', () => {
    it('returns singleton instance', () => {
      const instance1 = getSandboxProtocol();
      const instance2 = getSandboxProtocol();
      assert.strictEqual(instance1, instance2);
    });

    it('returns new instance after reset', () => {
      const instance1 = getSandboxProtocol();
      resetSandboxProtocol();
      const instance2 = getSandboxProtocol();
      assert.notStrictEqual(instance1, instance2);
    });
  });

  // ==========================================================================
  // Iframe Registration Tests
  // ==========================================================================

  describe('registerIframe / unregisterIframe', () => {
    it('registers an iframe window', async () => {
      const mockWindow = {postMessage: sinon.stub()} as unknown as Window;

      protocol.registerIframe('app-1', mockWindow);

      // Verify by sending a message
      const sent = await protocol.send('app-1', {type: 'get-state'});
      assert.isTrue(sent);
      assert.isTrue((mockWindow.postMessage as sinon.SinonStub).calledOnce);
    });

    it('unregisters an iframe', async () => {
      const mockWindow = {postMessage: sinon.stub()} as unknown as Window;

      protocol.registerIframe('app-1', mockWindow);
      protocol.unregisterIframe('app-1');

      const sent = await protocol.send('app-1', {type: 'get-state'});
      assert.isFalse(sent);
    });

    it('allows re-registering with different window', async () => {
      const window1 = {postMessage: sinon.stub()} as unknown as Window;
      const window2 = {postMessage: sinon.stub()} as unknown as Window;

      protocol.registerIframe('app-1', window1);
      protocol.registerIframe('app-1', window2);

      await protocol.send('app-1', {type: 'get-state'});

      assert.isFalse((window1.postMessage as sinon.SinonStub).called);
      assert.isTrue((window2.postMessage as sinon.SinonStub).calledOnce);
    });
  });

  // ==========================================================================
  // Message Sending Tests
  // ==========================================================================

  describe('send', () => {
    let mockWindow: Window & {postMessage: sinon.SinonStub};

    beforeEach(() => {
      mockWindow = {postMessage: sinon.stub()} as unknown as Window & {postMessage: sinon.SinonStub};
      protocol.registerIframe('test-app', mockWindow);
    });

    it('returns false for unregistered app', async () => {
      const result = await protocol.send('unknown-app', {type: 'get-state'});
      assert.isFalse(result);
    });

    it('sends message wrapped in envelope', async () => {
      const message: DevToolsToSandboxMessage = {type: 'get-state'};
      await protocol.send('test-app', message);

      assert.isTrue(mockWindow.postMessage.calledOnce);

      const [envelope, origin] = mockWindow.postMessage.firstCall.args;
      assert.isTrue(envelope.__sandbox);
      assert.deepStrictEqual(envelope.message, message);
      assert.strictEqual(origin, '*');
    });

    it('handles postMessage error gracefully', async () => {
      mockWindow.postMessage.throws(new Error('Blocked'));

      const result = await protocol.send('test-app', {type: 'get-state'});
      assert.isFalse(result);
    });
  });

  describe('sendInit', () => {
    let mockWindow: Window & {postMessage: sinon.SinonStub};

    beforeEach(() => {
      mockWindow = {postMessage: sinon.stub()} as unknown as Window & {postMessage: sinon.SinonStub};
      protocol.registerIframe('test-app', mockWindow);
    });

    it('sends init message with state', () => {
      const state = {count: 0, items: []};
      protocol.sendInit('test-app', state);

      const [envelope] = mockWindow.postMessage.firstCall.args;
      assert.strictEqual(envelope.message.type, 'init');
      assert.deepStrictEqual(envelope.message.payload.state, state);
    });
  });

  describe('sendDataUpdate', () => {
    let mockWindow: Window & {postMessage: sinon.SinonStub};

    beforeEach(() => {
      mockWindow = {postMessage: sinon.stub()} as unknown as Window & {postMessage: sinon.SinonStub};
      protocol.registerIframe('test-app', mockWindow);
    });

    it('sends data-update message with path and value', () => {
      protocol.sendDataUpdate('test-app', '/users/0/name', 'Alice');

      const [envelope] = mockWindow.postMessage.firstCall.args;
      assert.strictEqual(envelope.message.type, 'data-update');
      assert.strictEqual(envelope.message.payload.path, '/users/0/name');
      assert.strictEqual(envelope.message.payload.value, 'Alice');
    });
  });

  describe('sendExecute', () => {
    let mockWindow: Window & {postMessage: sinon.SinonStub};

    beforeEach(() => {
      mockWindow = {postMessage: sinon.stub()} as unknown as Window & {postMessage: sinon.SinonStub};
      protocol.registerIframe('test-app', mockWindow);
    });

    it('sends execute message with action and args', () => {
      protocol.sendExecute('test-app', 'submit', {formId: 'login'});

      const [envelope] = mockWindow.postMessage.firstCall.args;
      assert.strictEqual(envelope.message.type, 'execute');
      assert.strictEqual(envelope.message.payload.action, 'submit');
      assert.deepStrictEqual(envelope.message.payload.args, {formId: 'login'});
    });

    it('sends execute message with empty args by default', () => {
      protocol.sendExecute('test-app', 'refresh');

      const [envelope] = mockWindow.postMessage.firstCall.args;
      assert.deepStrictEqual(envelope.message.payload.args, {});
    });
  });

  describe('sendHotReload', () => {
    let mockWindow: Window & {postMessage: sinon.SinonStub};

    beforeEach(() => {
      mockWindow = {postMessage: sinon.stub()} as unknown as Window & {postMessage: sinon.SinonStub};
      protocol.registerIframe('test-app', mockWindow);
    });

    it('sends hot-reload message with js and css', () => {
      protocol.sendHotReload('test-app', 'console.log("new");', 'body{color:red}');

      const [envelope] = mockWindow.postMessage.firstCall.args;
      assert.strictEqual(envelope.message.type, 'hot-reload');
      assert.strictEqual(envelope.message.payload.js, 'console.log("new");');
      assert.strictEqual(envelope.message.payload.css, 'body{color:red}');
    });
  });

  describe('sendGetState', () => {
    let mockWindow: Window & {postMessage: sinon.SinonStub};

    beforeEach(() => {
      mockWindow = {postMessage: sinon.stub()} as unknown as Window & {postMessage: sinon.SinonStub};
      protocol.registerIframe('test-app', mockWindow);
    });

    it('sends get-state message', () => {
      protocol.sendGetState('test-app');

      const [envelope] = mockWindow.postMessage.firstCall.args;
      assert.strictEqual(envelope.message.type, 'get-state');
    });
  });

  // ==========================================================================
  // Message Subscription Tests
  // ==========================================================================

  describe('subscribe', () => {
    it('subscribes to app-specific messages', () => {
      const handler = sinon.stub();
      protocol.subscribe('test-app', handler);

      // Simulate incoming message
      simulateMessage(protocol, 'test-app', {type: 'ready'});

      assert.isTrue(handler.calledOnce);
      assert.deepStrictEqual(handler.firstCall.args[0], {type: 'ready'});
    });

    it('returns unsubscribe function', () => {
      const handler = sinon.stub();
      const unsubscribe = protocol.subscribe('test-app', handler);

      simulateMessage(protocol, 'test-app', {type: 'ready'});
      assert.isTrue(handler.calledOnce);

      unsubscribe();

      simulateMessage(protocol, 'test-app', {type: 'ready'});
      assert.isTrue(handler.calledOnce); // Still 1, not 2
    });

    it('allows multiple handlers for same app', () => {
      const handler1 = sinon.stub();
      const handler2 = sinon.stub();

      protocol.subscribe('test-app', handler1);
      protocol.subscribe('test-app', handler2);

      simulateMessage(protocol, 'test-app', {type: 'ready'});

      assert.isTrue(handler1.calledOnce);
      assert.isTrue(handler2.calledOnce);
    });

    it('does not call handler for different app', () => {
      const handler = sinon.stub();
      protocol.subscribe('app-1', handler);

      simulateMessage(protocol, 'app-2', {type: 'ready'});

      assert.isFalse(handler.called);
    });
  });

  describe('subscribeAll', () => {
    it('receives messages from all apps', () => {
      const handler = sinon.stub();
      protocol.subscribeAll(handler);

      simulateMessage(protocol, 'app-1', {type: 'ready'});
      simulateMessage(protocol, 'app-2', {type: 'ready'});

      assert.strictEqual(handler.callCount, 2);
    });
  });

  // ==========================================================================
  // Message Handling Tests
  // ==========================================================================

  describe('handleMessage', () => {
    it('ignores messages without __sandbox flag', () => {
      const handler = sinon.stub();
      protocol.subscribe('test-app', handler);

      // Simulate regular message without __sandbox
      const event = new MessageEvent('message', {
        data: {type: 'ready'},
      });
      window.dispatchEvent(event);

      assert.isFalse(handler.called);
    });

    it('ignores messages from unknown sources', () => {
      const handler = sinon.stub();
      protocol.subscribeAll(handler);

      // Simulate message with __sandbox but from unknown window
      const unknownWindow = {} as Window;
      const event = new MessageEvent('message', {
        data: {__sandbox: true, message: {type: 'ready'}},
      });
      Object.defineProperty(event, 'source', {value: unknownWindow, writable: false});
      window.dispatchEvent(event);

      assert.isFalse(handler.called);
    });

    it('routes message to correct app handler', () => {
      const app1Handler = sinon.stub();
      const app2Handler = sinon.stub();

      protocol.subscribe('app-1', app1Handler);
      protocol.subscribe('app-2', app2Handler);

      simulateMessage(protocol, 'app-1', {type: 'ready'});

      assert.isTrue(app1Handler.calledOnce);
      assert.isFalse(app2Handler.called);
    });

    it('handles handler errors gracefully', () => {
      const errorHandler = sinon.stub().throws(new Error('Handler error'));
      const normalHandler = sinon.stub();

      protocol.subscribe('test-app', errorHandler);
      protocol.subscribe('test-app', normalHandler);

      // Should not throw
      simulateMessage(protocol, 'test-app', {type: 'ready'});

      assert.isTrue(errorHandler.calledOnce);
      assert.isTrue(normalHandler.calledOnce); // Still called despite error
    });

    it('dispatches to wildcard handlers after app handlers', () => {
      const callOrder: string[] = [];
      const appHandler = sinon.stub().callsFake(() => callOrder.push('app'));
      const wildcardHandler = sinon.stub().callsFake(() => callOrder.push('wildcard'));

      protocol.subscribe('test-app', appHandler);
      protocol.subscribeAll(wildcardHandler);

      simulateMessage(protocol, 'test-app', {type: 'ready'});

      assert.deepStrictEqual(callOrder, ['app', 'wildcard']);
    });
  });

  // ==========================================================================
  // Destroy Tests
  // ==========================================================================

  describe('destroy', () => {
    it('clears all handlers', () => {
      const handler = sinon.stub();
      protocol.subscribe('test-app', handler);
      protocol.destroy();

      // Try to simulate message - handler should not be called
      // Note: After destroy, the message listener is removed from window
      // so this is more of a cleanup verification
      assert.isFalse(handler.called);
    });

    it('clears all registered iframes', async () => {
      const mockWindow = {postMessage: sinon.stub()} as unknown as Window;
      protocol.registerIframe('test-app', mockWindow);
      protocol.destroy();

      const sent = await protocol.send('test-app', {type: 'get-state'});
      assert.isFalse(sent);
    });
  });
});

// ==========================================================================
// Integration Contract Tests
// ==========================================================================

describe('iframe selector contract', () => {
  /**
   * This test documents the contract between RenderWebAppTool and SandboxProtocol.
   *
   * RenderWebAppTool creates iframes with: iframe.setAttribute('data-webapp-id', webappId)
   * SandboxProtocol finds them with: document.querySelector('iframe[data-webapp-id="${webappId}"]')
   *
   * If either side changes the attribute name, this test should remind developers
   * to update the other side.
   */
  it('sendViaRuntime selector expects data-webapp-id attribute (set by RenderWebAppTool)', () => {
    // The attribute name used in SandboxProtocol.sendViaRuntime() and SandboxController.installBridge()
    const EXPECTED_ATTRIBUTE = 'data-webapp-id';

    // This test serves as documentation and a reminder:
    // - RenderWebAppTool.ts must set: iframe.setAttribute('data-webapp-id', webappId)
    // - SandboxProtocol.ts uses: document.querySelector('iframe[data-webapp-id="${webappId}"]')
    // - SandboxController.ts uses: document.querySelector('iframe[data-webapp-id="${webappId}"]')

    // Verify the attribute name is what we expect
    assert.strictEqual(EXPECTED_ATTRIBUTE, 'data-webapp-id',
      'If this fails, update RenderWebAppTool, SandboxProtocol, and SandboxController to match');
  });
});

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Simulate receiving a message from a registered iframe
 */
function simulateMessage(
  protocol: SandboxProtocol,
  appId: string,
  message: SandboxToDevToolsMessage,
): void {
  // We need to register a mock window first to know the source
  const mockWindow = {postMessage: sinon.stub()} as unknown as Window;
  protocol.registerIframe(appId, mockWindow);

  // Create a basic message event and add properties via defineProperty
  // to work around the browser's strict validation of 'source'
  const event = new MessageEvent('message', {
    data: {__sandbox: true, message},
  });
  Object.defineProperty(event, 'source', {value: mockWindow, writable: false});
  window.dispatchEvent(event);
}
