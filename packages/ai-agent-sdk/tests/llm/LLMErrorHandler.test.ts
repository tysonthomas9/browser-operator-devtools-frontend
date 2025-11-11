// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMErrorClassifier, LLMRetryManager, LLMErrorUtils } from '../../src/llm/LLMErrorHandler';
import { LLMErrorType } from '../../src/llm/LLMTypes';

describe('LLMErrorClassifier', () => {
  describe('classifyError', () => {
    it('should classify rate limit errors', () => {
      const errors = [
        new Error('Rate limit exceeded'),
        new Error('Too many requests'),
        new Error('HTTP 429'),
        new Error('rate_limit_exceeded')
      ];

      errors.forEach(error => {
        expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.RATE_LIMIT_ERROR);
      });
    });

    it('should classify network errors', () => {
      const errors = [
        new Error('fetch failed'),
        new Error('Network connection error'),
        new Error('Connection timeout'),
        new Error('ECONNRESET')
      ];

      errors.forEach(error => {
        expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.NETWORK_ERROR);
      });
    });

    it('should classify server errors', () => {
      const errors = [
        new Error('Internal server error'),
        new Error('HTTP 502 Bad Gateway'),
        new Error('Service unavailable 503'),
        new Error('Gateway timeout 504')
      ];

      errors.forEach(error => {
        expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.SERVER_ERROR);
      });
    });

    it('should classify authentication errors', () => {
      const errors = [
        new Error('Unauthorized 401'),
        new Error('Invalid API key'),
        new Error('Authentication failed'),
        new Error('Forbidden 403')
      ];

      errors.forEach(error => {
        expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.AUTH_ERROR);
      });
    });

    it('should classify quota errors', () => {
      const errors = [
        new Error('Insufficient quota'),
        new Error('Billing issue'),
        new Error('Usage limit exceeded'),
        new Error('quota_exceeded')
      ];

      errors.forEach(error => {
        expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.QUOTA_ERROR);
      });
    });

    it('should classify JSON parse errors', () => {
      const errors = [
        new Error('JSON parsing failed'),
        new Error('Invalid JSON'),
        new Error('SyntaxError: Unexpected token'),
        new Error('JSON parse error')
      ];

      errors.forEach(error => {
        expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.JSON_PARSE_ERROR);
      });
    });

    it('should classify unknown errors', () => {
      const error = new Error('Some random error');
      expect(LLMErrorClassifier.classifyError(error)).toBe(LLMErrorType.UNKNOWN_ERROR);
    });
  });

  describe('shouldRetry', () => {
    it('should retry network errors', () => {
      expect(LLMErrorClassifier.shouldRetry(LLMErrorType.NETWORK_ERROR)).toBe(true);
    });

    it('should retry server errors', () => {
      expect(LLMErrorClassifier.shouldRetry(LLMErrorType.SERVER_ERROR)).toBe(true);
    });

    it('should retry rate limit errors', () => {
      expect(LLMErrorClassifier.shouldRetry(LLMErrorType.RATE_LIMIT_ERROR)).toBe(true);
    });

    it('should not retry authentication errors', () => {
      expect(LLMErrorClassifier.shouldRetry(LLMErrorType.AUTH_ERROR)).toBe(false);
    });

    it('should not retry quota errors', () => {
      expect(LLMErrorClassifier.shouldRetry(LLMErrorType.QUOTA_ERROR)).toBe(false);
    });
  });

  describe('getRetryConfig', () => {
    it('should return default config for unknown errors', () => {
      const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.UNKNOWN_ERROR);
      expect(config.maxRetries).toBe(2);
      expect(config.baseDelayMs).toBe(1000);
    });

    it('should return custom config for rate limit errors', () => {
      const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.RATE_LIMIT_ERROR);
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelayMs).toBe(60000); // 60 seconds
    });

    it('should merge custom config with defaults', () => {
      const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.NETWORK_ERROR, {
        maxRetries: 5
      });
      expect(config.maxRetries).toBe(5);
      expect(config.baseDelayMs).toBe(2000); // Network error default
    });
  });
});

describe('LLMRetryManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('executeWithRetry', () => {
    it('should return result on first try if successful', async () => {
      const manager = new LLMRetryManager();
      const operation = jest.fn().mockResolvedValue('success');

      const promise = manager.executeWithRetry(operation);
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const manager = new LLMRetryManager();
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = manager.executeWithRetry(operation);

      // Fast-forward through retries with runAllTimersAsync
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on authentication errors', async () => {
      const manager = new LLMRetryManager();
      const operation = jest.fn().mockRejectedValue(new Error('Unauthorized 401'));

      await expect(manager.executeWithRetry(operation)).rejects.toThrow('Unauthorized 401');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should stop after max retries', async () => {
      const manager = new LLMRetryManager();
      const operation = jest.fn().mockRejectedValue(new Error('Server error 500'));

      const promise = manager.executeWithRetry(operation, {
        customRetryConfig: { maxRetries: 2 }
      });

      // Expect rejection and fast-forward through all retries
      const expectation = expect(promise).rejects.toThrow('Server error 500');
      await jest.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call retry callback on each retry', async () => {
      const onRetry = jest.fn();
      const manager = new LLMRetryManager({ onRetry });
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = manager.executeWithRetry(operation);

      await jest.runAllTimersAsync();

      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        LLMErrorType.NETWORK_ERROR,
        expect.any(Number)
      );
    });
  });

  describe('simpleRetry', () => {
    it('should provide static convenience method', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await LLMRetryManager.simpleRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});

describe('LLMErrorUtils', () => {
  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = new Error('Network connection error');
      expect(LLMErrorUtils.isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new Error('Unauthorized 401');
      expect(LLMErrorUtils.isRetryable(error)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return user-friendly message for rate limits', () => {
      const error = new Error('Rate limit exceeded');
      const message = LLMErrorUtils.getErrorMessage(error);
      expect(message).toContain('Rate limit');
    });

    it('should return user-friendly message for network errors', () => {
      const error = new Error('Network error');
      const message = LLMErrorUtils.getErrorMessage(error);
      expect(message).toContain('Network connection');
    });

    it('should return user-friendly message for auth errors', () => {
      const error = new Error('Unauthorized');
      const message = LLMErrorUtils.getErrorMessage(error);
      expect(message).toContain('Authentication');
    });

    it('should return original message for unknown errors', () => {
      const error = new Error('Custom error');
      const message = LLMErrorUtils.getErrorMessage(error);
      expect(message).toBe('Custom error');
    });
  });

  describe('enhanceError', () => {
    it('should add context to error', () => {
      const originalError = new Error('Network error');
      const enhanced = LLMErrorUtils.enhanceError(originalError, {
        operation: 'API call',
        attempt: 2
      });

      expect(enhanced.message).toContain('API call');
      expect(enhanced.message).toContain('attempt 2');
      expect(enhanced.message).toContain('NETWORK_ERROR');
      expect((enhanced as any).originalError).toBe(originalError);
    });
  });
});
