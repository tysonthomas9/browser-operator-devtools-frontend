// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  createTransformNode,
  createAsyncTransformNode,
  createConditionalNode,
  createValidationNode,
  createRetryNode,
  createLoggingNode,
  createFinalNode,
  createPassthroughNode
} from '../../src/orchestration/GraphNodeHelpers';

interface TestState {
  value: number;
  text: string;
  error?: string;
}

describe('GraphNodeHelpers', () => {
  describe('createTransformNode', () => {
    it('should transform state synchronously', async () => {
      const node = createTransformNode<TestState>(
        'double',
        (state) => ({ ...state, value: state.value * 2 })
      );

      const result = await node.invoke({ value: 5, text: 'test' });

      expect(result.value).toBe(10);
      expect(result.text).toBe('test');
    });

    it('should throw if aborted', async () => {
      const node = createTransformNode<TestState>(
        'transform',
        (state) => state
      );

      const abortController = new AbortController();
      abortController.abort();

      await expect(node.invoke({ value: 1, text: '' }, abortController.signal))
        .rejects.toThrow('transform aborted');
    });
  });

  describe('createAsyncTransformNode', () => {
    it('should transform state asynchronously', async () => {
      const node = createAsyncTransformNode<TestState>(
        'asyncDouble',
        async (state) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { ...state, value: state.value * 2 };
        }
      );

      const result = await node.invoke({ value: 5, text: 'test' });

      expect(result.value).toBe(10);
    });

    it('should pass abort signal to transform', async () => {
      const transformMock = jest.fn(async (state: TestState, signal?: AbortSignal) => {
        expect(signal).toBeDefined();
        return state;
      });

      const node = createAsyncTransformNode<TestState>('async', transformMock);
      const abortController = new AbortController();

      await node.invoke({ value: 1, text: '' }, abortController.signal);

      expect(transformMock).toHaveBeenCalledWith(
        expect.any(Object),
        abortController.signal
      );
    });
  });

  describe('createConditionalNode', () => {
    it('should execute ifTrue branch when condition is true', async () => {
      const node = createConditionalNode<TestState>(
        'conditional',
        (state) => state.value > 5,
        (state) => ({ ...state, text: 'high' }),
        (state) => ({ ...state, text: 'low' })
      );

      const result = await node.invoke({ value: 10, text: '' });

      expect(result.text).toBe('high');
    });

    it('should execute ifFalse branch when condition is false', async () => {
      const node = createConditionalNode<TestState>(
        'conditional',
        (state) => state.value > 5,
        (state) => ({ ...state, text: 'high' }),
        (state) => ({ ...state, text: 'low' })
      );

      const result = await node.invoke({ value: 3, text: '' });

      expect(result.text).toBe('low');
    });
  });

  describe('createValidationNode', () => {
    it('should pass validation and return state unchanged', async () => {
      const node = createValidationNode<TestState>(
        'validate',
        (state) => state.value > 0,
        'Value must be positive'
      );

      const result = await node.invoke({ value: 5, text: 'test' });

      expect(result.value).toBe(5);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation and set error', async () => {
      const node = createValidationNode<TestState>(
        'validate',
        (state) => state.value > 0,
        'Value must be positive'
      );

      const result = await node.invoke({ value: -1, text: 'test' });

      expect(result.error).toBe('Value must be positive');
    });
  });

  describe('createRetryNode', () => {
    it('should succeed on first try', async () => {
      const innerNode = {
        invoke: jest.fn().mockResolvedValue({ value: 10, text: 'success' })
      };

      const node = createRetryNode<TestState>(
        'retry',
        innerNode,
        { maxRetries: 3, delayMs: 100 }
      );

      const result = await node.invoke({ value: 5, text: '' });

      expect(result.value).toBe(10);
      expect(innerNode.invoke).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const innerNode = {
        invoke: jest.fn()
          .mockRejectedValueOnce(new Error('fail 1'))
          .mockRejectedValueOnce(new Error('fail 2'))
          .mockResolvedValue({ value: 10, text: 'success' })
      };

      const node = createRetryNode<TestState>(
        'retry',
        innerNode,
        { maxRetries: 3, delayMs: 10 }
      );

      const result = await node.invoke({ value: 5, text: '' });

      expect(result.value).toBe(10);
      expect(innerNode.invoke).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const innerNode = {
        invoke: jest.fn().mockRejectedValue(new Error('persistent failure'))
      };

      const node = createRetryNode<TestState>(
        'retry',
        innerNode,
        { maxRetries: 2, delayMs: 10 }
      );

      await expect(node.invoke({ value: 5, text: '' }))
        .rejects.toThrow('persistent failure');

      expect(innerNode.invoke).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should respect shouldRetry predicate', async () => {
      const innerNode = {
        invoke: jest.fn().mockRejectedValue(new Error('auth error'))
      };

      const node = createRetryNode<TestState>(
        'retry',
        innerNode,
        {
          maxRetries: 3,
          delayMs: 10,
          shouldRetry: (error) => !error.message.includes('auth')
        }
      );

      await expect(node.invoke({ value: 5, text: '' }))
        .rejects.toThrow('auth error');

      expect(innerNode.invoke).toHaveBeenCalledTimes(1); // No retries
    });

    it('should throw if aborted', async () => {
      const innerNode = {
        invoke: jest.fn().mockResolvedValue({ value: 10, text: '' })
      };

      const node = createRetryNode<TestState>(
        'retry',
        innerNode,
        { maxRetries: 3, delayMs: 100 }
      );

      const abortController = new AbortController();
      abortController.abort();

      await expect(node.invoke({ value: 5, text: '' }, abortController.signal))
        .rejects.toThrow('retry aborted');
    });
  });

  describe('createLoggingNode', () => {
    it('should return state unchanged', async () => {
      const node = createLoggingNode<TestState>(
        'log',
        (state) => `Value: ${state.value}`
      );

      const input = { value: 5, text: 'test' };
      const result = await node.invoke(input);

      expect(result).toEqual(input);
    });
  });

  describe('createFinalNode', () => {
    it('should succeed with valid final state', async () => {
      const node = createFinalNode<TestState>(
        'finish',
        (state) => state.value > 0
      );

      const result = await node.invoke({ value: 5, text: 'done' });

      expect(result.value).toBe(5);
    });

    it('should throw if final validation fails', async () => {
      const node = createFinalNode<TestState>(
        'finish',
        (state) => state.value > 0
      );

      await expect(node.invoke({ value: -1, text: 'done' }))
        .rejects.toThrow('Invalid final state');
    });

    it('should succeed without validation', async () => {
      const node = createFinalNode<TestState>('finish');

      const result = await node.invoke({ value: 5, text: 'done' });

      expect(result.value).toBe(5);
    });
  });

  describe('createPassthroughNode', () => {
    it('should return state unchanged', async () => {
      const node = createPassthroughNode<TestState>('passthrough');

      const input = { value: 5, text: 'test' };
      const result = await node.invoke(input);

      expect(result).toEqual(input);
    });

    it('should throw if aborted', async () => {
      const node = createPassthroughNode<TestState>('passthrough');

      const abortController = new AbortController();
      abortController.abort();

      await expect(node.invoke({ value: 1, text: '' }, abortController.signal))
        .rejects.toThrow('passthrough aborted');
    });
  });
});
