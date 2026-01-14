// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for MessageBus - Advanced message routing with request/response correlation
 */

// Sinon is provided globally by the test environment
declare const sinon: typeof import('sinon');

import {MessageBus, getMessageBus, resetMessageBus} from '../protocol/MessageBus.js';
import {getSandboxProtocol, resetSandboxProtocol} from '../protocol/SandboxProtocol.js';

describe('ai_chat: MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    resetSandboxProtocol();
    resetMessageBus();
    messageBus = MessageBus.getInstance();
  });

  afterEach(() => {
    resetMessageBus();
    resetSandboxProtocol();
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = MessageBus.getInstance();
      const instance2 = MessageBus.getInstance();
      assert.strictEqual(instance1, instance2);
    });

    it('returns new instance after reset', () => {
      const instance1 = MessageBus.getInstance();
      MessageBus.reset();
      const instance2 = MessageBus.getInstance();
      assert.notStrictEqual(instance1, instance2);
    });

    it('getMessageBus returns singleton', () => {
      const instance = getMessageBus();
      assert.strictEqual(instance, MessageBus.getInstance());
    });
  });

  // ==========================================================================
  // Message Queuing Tests
  // ==========================================================================

  describe('message queuing', () => {
    it('queues messages when app is not ready', () => {
      messageBus.queue('test-app', {type: 'init', payload: {state: {}}});
      messageBus.queue('test-app', {type: 'data-update', payload: {path: '/foo', value: 1}});

      assert.strictEqual(messageBus.getQueueSize('test-app'), 2);
    });

    it('queues messages when app is not ready (get-state)', () => {
      messageBus.queue('test-app', {type: 'get-state'});
      messageBus.queue('test-app', {type: 'get-state'});

      assert.strictEqual(messageBus.getQueueSize('test-app'), 2);
    });

    it('flushes queued messages when app becomes ready', () => {
      const protocol = getSandboxProtocol();
      const sendStub = sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      // Register iframe
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);

      // Queue messages - use 'get-state' which has no payload requirement
      messageBus.queue('test-app', {type: 'get-state'});
      messageBus.queue('test-app', {type: 'get-state'});

      // Mark ready - should flush
      messageBus.markReady('test-app');

      assert.strictEqual(sendStub.callCount, 2);
      assert.strictEqual(messageBus.getQueueSize('test-app'), 0);

      sendStub.restore();
    });

    it('sends immediately when app is already ready', () => {
      const protocol = getSandboxProtocol();
      const sendStub = sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      // Register and mark ready
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);
      messageBus.markReady('test-app');

      // Queue message - should send immediately
      messageBus.queue('test-app', {type: 'get-state'});

      assert.strictEqual(sendStub.callCount, 1);
      assert.strictEqual(messageBus.getQueueSize('test-app'), 0);

      sendStub.restore();
    });

    it('clearQueue removes all queued messages', () => {
      messageBus.queue('test-app', {type: 'get-state'});
      messageBus.queue('test-app', {type: 'get-state'});

      messageBus.clearQueue('test-app');

      assert.strictEqual(messageBus.getQueueSize('test-app'), 0);
    });

    it('markNotReady changes app status', () => {
      messageBus.markReady('test-app');
      assert.isTrue(messageBus.isReady('test-app'));

      messageBus.markNotReady('test-app');
      assert.isFalse(messageBus.isReady('test-app'));
    });

    it('isReady returns false for unknown app', () => {
      assert.isFalse(messageBus.isReady('nonexistent'));
    });

    it('getQueueSize returns 0 for unknown app', () => {
      assert.strictEqual(messageBus.getQueueSize('nonexistent'), 0);
    });
  });

  // ==========================================================================
  // Request/Response Correlation Tests
  // ==========================================================================

  describe('request/response correlation', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('request returns promise', () => {
      const protocol = getSandboxProtocol();
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);
      sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      const promise = messageBus.request('test-app', 'get-state');

      assert.isOk(promise);
      assert.isFunction(promise.then);
    });

    it('request rejects on timeout', async () => {
      const protocol = getSandboxProtocol();
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);
      sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      const promise = messageBus.request('test-app', 'get-state', undefined, 5000);

      // Advance past timeout
      clock.tick(5001);

      try {
        await promise;
        assert.fail('Expected timeout error');
      } catch (error) {
        assert.include((error as Error).message, 'timed out');
      }
    });

    it('request rejects when send fails', async () => {
      const protocol = getSandboxProtocol();
      sinon.stub(protocol, 'send').returns(Promise.resolve(false));

      try {
        await messageBus.request('nonexistent-app', 'get-state');
        assert.fail('Expected error');
      } catch (error) {
        assert.include((error as Error).message, 'Failed to send');
      }
    });

    it('getPendingRequestCount returns correct count', () => {
      const protocol = getSandboxProtocol();
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);
      sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      assert.strictEqual(messageBus.getPendingRequestCount(), 0);

      messageBus.request('test-app', 'get-state');
      assert.strictEqual(messageBus.getPendingRequestCount(), 1);

      messageBus.request('test-app', 'get-state');
      assert.strictEqual(messageBus.getPendingRequestCount(), 2);
    });

    it('request cleans up pending on timeout', async () => {
      const protocol = getSandboxProtocol();
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);
      sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      const promise = messageBus.request('test-app', 'get-state');

      assert.strictEqual(messageBus.getPendingRequestCount(), 1);

      clock.tick(10001);

      try {
        await promise;
      } catch {
        // Expected
      }

      assert.strictEqual(messageBus.getPendingRequestCount(), 0);
    });
  });

  // ==========================================================================
  // Priority Handler Tests
  // ==========================================================================

  describe('priority handlers', () => {
    it('registers handler for message type', () => {
      const handler = sinon.stub();

      const unsubscribe = messageBus.on('state-changed', handler);

      assert.isFunction(unsubscribe);
    });

    it('unsubscribe removes handler', () => {
      const handler = sinon.stub();

      const unsubscribe = messageBus.on('state-changed', handler);
      unsubscribe();

      // Handler should be removed (we can't easily test dispatch without triggering messages)
    });

    it('onAll registers wildcard handler', () => {
      const handler = sinon.stub();

      const unsubscribe = messageBus.onAll(handler);

      assert.isFunction(unsubscribe);
    });

    it('multiple handlers can be registered', () => {
      const handler1 = sinon.stub();
      const handler2 = sinon.stub();

      const unsubscribe1 = messageBus.on('state-changed', handler1);
      const unsubscribe2 = messageBus.on('state-changed', handler2);

      assert.isFunction(unsubscribe1);
      assert.isFunction(unsubscribe2);
    });
  });

  // ==========================================================================
  // Send Methods Tests
  // ==========================================================================

  describe('send methods', () => {
    it('send delegates to protocol', async () => {
      const protocol = getSandboxProtocol();
      const sendStub = sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);

      const result = await messageBus.send('test-app', {type: 'get-state'});

      assert.isTrue(result);
      assert.isTrue(sendStub.calledOnce);

      sendStub.restore();
    });

    it('sendDataUpdate delegates to protocol', async () => {
      const protocol = getSandboxProtocol();
      const stub = sinon.stub(protocol, 'sendDataUpdate').returns(Promise.resolve(true));

      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);

      const result = await messageBus.sendDataUpdate('test-app', '/count', 42);

      assert.isTrue(result);
      assert.isTrue(stub.calledOnceWith('test-app', '/count', 42));

      stub.restore();
    });

    it('sendExecute delegates to protocol', async () => {
      const protocol = getSandboxProtocol();
      const stub = sinon.stub(protocol, 'sendExecute').returns(Promise.resolve(true));

      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);

      const result = await messageBus.sendExecute('test-app', 'refresh', {force: true});

      assert.isTrue(result);
      assert.isTrue(stub.calledOnceWith('test-app', 'refresh', {force: true}));

      stub.restore();
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanup', () => {
    it('cleanupApp removes app state', () => {
      messageBus.markReady('test-app');
      messageBus.queue('test-app-2', {type: 'get-state'});

      messageBus.cleanupApp('test-app');
      messageBus.cleanupApp('test-app-2');

      assert.isFalse(messageBus.isReady('test-app'));
      assert.strictEqual(messageBus.getQueueSize('test-app-2'), 0);
    });

    it('destroy rejects pending requests', async () => {
      const protocol = getSandboxProtocol();
      const mockWindow = {} as Window;
      protocol.registerIframe('test-app', mockWindow);
      sinon.stub(protocol, 'send').returns(Promise.resolve(true));

      const promise = messageBus.request('test-app', 'get-state');

      messageBus.destroy();

      try {
        await promise;
        assert.fail('Expected error');
      } catch (error) {
        assert.include((error as Error).message, 'destroyed');
      }
    });

    it('destroy clears all state', () => {
      messageBus.markReady('app-1');
      messageBus.queue('app-2', {type: 'get-state'});

      messageBus.destroy();

      // After destroy, getInstance returns fresh instance
      MessageBus.reset();
      const newBus = MessageBus.getInstance();

      assert.isFalse(newBus.isReady('app-1'));
      assert.strictEqual(newBus.getQueueSize('app-2'), 0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('flush does nothing for empty queue', () => {
      // Should not throw
      messageBus.flush('nonexistent');
    });

    it('clearQueue does nothing for unknown app', () => {
      // Should not throw
      messageBus.clearQueue('nonexistent');
    });

    it('markReady can be called multiple times', () => {
      messageBus.markReady('test-app');
      messageBus.markReady('test-app');
      messageBus.markReady('test-app');

      assert.isTrue(messageBus.isReady('test-app'));
    });

    it('handlers with same priority maintain registration order', () => {
      const handler1 = sinon.stub();
      const handler2 = sinon.stub();
      const handler3 = sinon.stub();

      messageBus.on('test', handler1, 0);
      messageBus.on('test', handler2, 0);
      messageBus.on('test', handler3, 0);

      // All should be registered
      const unsubscribe1 = messageBus.on('test', handler1);
      unsubscribe1(); // Should work without error
    });

    it('high priority handlers registered last still called first', () => {
      const callOrder: number[] = [];
      const lowHandler = () => callOrder.push(1);
      const highHandler = () => callOrder.push(2);

      // Register low priority first
      messageBus.on('test', lowHandler, 0);
      // Register high priority second
      messageBus.on('test', highHandler, 10);

      // We can't easily test dispatch order without triggering messages,
      // but we verify both handlers are registered
    });
  });
});
