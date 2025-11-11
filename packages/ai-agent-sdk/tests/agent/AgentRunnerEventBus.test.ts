// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AgentRunnerEventBus, type AgentRunnerProgressEvent } from '../../src/agent/AgentRunnerEventBus';

describe('AgentRunnerEventBus', () => {
  let eventBus: AgentRunnerEventBus;

  beforeEach(() => {
    eventBus = AgentRunnerEventBus.getInstance();
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AgentRunnerEventBus.getInstance();
      const instance2 = AgentRunnerEventBus.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('addListener', () => {
    it('should add listener', () => {
      const listener = jest.fn();
      eventBus.addListener(listener);

      expect(eventBus.getListenerCount()).toBe(1);
    });

    it('should not add duplicate listener', () => {
      const listener = jest.fn();
      eventBus.addListener(listener);
      eventBus.addListener(listener);

      expect(eventBus.getListenerCount()).toBe(1);
    });

    it('should add multiple different listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      eventBus.addListener(listener1);
      eventBus.addListener(listener2);

      expect(eventBus.getListenerCount()).toBe(2);
    });
  });

  describe('removeListener', () => {
    it('should remove listener', () => {
      const listener = jest.fn();
      eventBus.addListener(listener);
      eventBus.removeListener(listener);

      expect(eventBus.getListenerCount()).toBe(0);
    });

    it('should not error when removing non-existent listener', () => {
      const listener = jest.fn();
      expect(() => eventBus.removeListener(listener)).not.toThrow();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      eventBus.addListener(listener1);
      eventBus.addListener(listener2);

      eventBus.removeAllListeners();

      expect(eventBus.getListenerCount()).toBe(0);
    });
  });

  describe('emitProgress', () => {
    it('should emit event to all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      eventBus.addListener(listener1);
      eventBus.addListener(listener2);

      const event: AgentRunnerProgressEvent = {
        type: 'session_started',
        sessionId: 'session-1',
        agentName: 'test_agent',
        timestamp: new Date(),
        data: {},
      };

      eventBus.emitProgress(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const successListener = jest.fn();

      eventBus.addListener(errorListener);
      eventBus.addListener(successListener);

      const event: AgentRunnerProgressEvent = {
        type: 'tool_started',
        sessionId: 'session-1',
        agentName: 'test_agent',
        timestamp: new Date(),
        data: {},
      };

      // Spy on console.error to verify error handling
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => eventBus.emitProgress(event)).not.toThrow();
      expect(errorListener).toHaveBeenCalled();
      expect(successListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should emit all event types', () => {
      const listener = jest.fn();
      eventBus.addListener(listener);

      const eventTypes: Array<AgentRunnerProgressEvent['type']> = [
        'session_started',
        'tool_started',
        'tool_completed',
        'session_updated',
        'child_agent_started',
        'session_completed',
      ];

      eventTypes.forEach((type) => {
        const event: AgentRunnerProgressEvent = {
          type,
          sessionId: 'session-1',
          agentName: 'test_agent',
          timestamp: new Date(),
          data: {},
        };
        eventBus.emitProgress(event);
      });

      expect(listener).toHaveBeenCalledTimes(eventTypes.length);
    });
  });

  describe('getListenerCount', () => {
    it('should return 0 when no listeners', () => {
      expect(eventBus.getListenerCount()).toBe(0);
    });

    it('should return correct count', () => {
      eventBus.addListener(jest.fn());
      eventBus.addListener(jest.fn());
      eventBus.addListener(jest.fn());

      expect(eventBus.getListenerCount()).toBe(3);
    });
  });
});
