// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMErrorClassifier, LLMRetryManager, LLMErrorUtils } from '../LLMErrorHandler.js';
import { LLMErrorType } from '../LLMTypes.js';
import {
  createFastRetryConfig,
  DEFAULT_RETRY_CONFIG,
  RATE_LIMIT_RETRY_CONFIG,
  NETWORK_ERROR_RETRY_CONFIG,
} from './LLMTestHelpers.js';

describe('ai_chat: LLMErrorHandler', () => {
  // ============ LLMErrorClassifier Tests ============
  describe('LLMErrorClassifier', () => {
    describe('classifyError', () => {
      // Rate limit errors
      it('should classify "rate limit" errors as RATE_LIMIT_ERROR', () => {
        const error = new Error('Rate limit exceeded');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.RATE_LIMIT_ERROR);
      });

      it('should classify "429" errors as RATE_LIMIT_ERROR', () => {
        const error = new Error('API error: 429 Too Many Requests');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.RATE_LIMIT_ERROR);
      });

      it('should classify "too many requests" errors as RATE_LIMIT_ERROR', () => {
        const error = new Error('Too many requests, please slow down');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.RATE_LIMIT_ERROR);
      });

      it('should classify "quota exceeded" errors as RATE_LIMIT_ERROR', () => {
        const error = new Error('Quota exceeded for the day');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.RATE_LIMIT_ERROR);
      });

      it('should classify "rate_limit_exceeded" errors as RATE_LIMIT_ERROR', () => {
        const error = new Error('Error code: rate_limit_exceeded');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.RATE_LIMIT_ERROR);
      });

      // Auth errors
      it('should classify "unauthorized" errors as AUTH_ERROR', () => {
        const error = new Error('Unauthorized access');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.AUTH_ERROR);
      });

      it('should classify "401" errors as AUTH_ERROR', () => {
        const error = new Error('HTTP 401: Authentication required');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.AUTH_ERROR);
      });

      it('should classify "403" errors as AUTH_ERROR', () => {
        const error = new Error('HTTP 403: Forbidden');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.AUTH_ERROR);
      });

      it('should classify "invalid api key" errors as AUTH_ERROR', () => {
        const error = new Error('Invalid API key provided');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.AUTH_ERROR);
      });

      it('should classify "authentication" errors as AUTH_ERROR', () => {
        const error = new Error('Authentication failed');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.AUTH_ERROR);
      });

      it('should classify "forbidden" errors as AUTH_ERROR', () => {
        const error = new Error('Access forbidden');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.AUTH_ERROR);
      });

      // Server errors
      it('should classify "500" errors as SERVER_ERROR', () => {
        const error = new Error('HTTP 500: Internal Server Error');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.SERVER_ERROR);
      });

      it('should classify "502" errors as SERVER_ERROR', () => {
        const error = new Error('HTTP 502: Bad Gateway');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.SERVER_ERROR);
      });

      it('should classify "503" errors as SERVER_ERROR', () => {
        const error = new Error('HTTP 503: Service Unavailable');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.SERVER_ERROR);
      });

      it('should classify "504" errors as NETWORK_ERROR', () => {
        // 504 Gateway Timeout is classified as NETWORK_ERROR by the implementation
        const error = new Error('HTTP 504: Gateway Timeout');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "internal server error" as SERVER_ERROR', () => {
        const error = new Error('Internal server error occurred');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.SERVER_ERROR);
      });

      it('should classify "service unavailable" as SERVER_ERROR', () => {
        const error = new Error('Service unavailable, try again later');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.SERVER_ERROR);
      });

      // Network errors
      it('should classify "fetch" errors as NETWORK_ERROR', () => {
        const error = new Error('fetch failed');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "network" errors as NETWORK_ERROR', () => {
        const error = new Error('Network error occurred');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "timeout" errors as NETWORK_ERROR', () => {
        const error = new Error('Request timeout');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "econnreset" errors as NETWORK_ERROR', () => {
        const error = new Error('ECONNRESET: Connection reset');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "enotfound" errors as NETWORK_ERROR', () => {
        const error = new Error('ENOTFOUND: DNS lookup failed');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "connection" errors as NETWORK_ERROR', () => {
        const error = new Error('Connection refused');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "socket" errors as NETWORK_ERROR', () => {
        const error = new Error('Socket hang up');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      it('should classify "aborted" errors as NETWORK_ERROR', () => {
        const error = new Error('Request aborted');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.NETWORK_ERROR);
      });

      // JSON parse errors
      it('should classify "json parsing failed" as JSON_PARSE_ERROR', () => {
        const error = new Error('JSON parsing failed');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.JSON_PARSE_ERROR);
      });

      it('should classify "invalid json" as JSON_PARSE_ERROR', () => {
        const error = new Error('Invalid JSON in response');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.JSON_PARSE_ERROR);
      });

      it('should classify "unexpected token" as JSON_PARSE_ERROR', () => {
        const error = new Error('Unexpected token < in JSON at position 0');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.JSON_PARSE_ERROR);
      });

      it('should classify "syntaxerror" as JSON_PARSE_ERROR', () => {
        const error = new Error('SyntaxError: Unexpected end of JSON input');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.JSON_PARSE_ERROR);
      });

      it('should classify "json parse" as JSON_PARSE_ERROR', () => {
        const error = new Error('JSON parse error');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.JSON_PARSE_ERROR);
      });

      // Quota errors
      it('should classify "insufficient quota" as QUOTA_ERROR', () => {
        const error = new Error('Insufficient quota for this operation');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.QUOTA_ERROR);
      });

      it('should classify "billing" errors as QUOTA_ERROR', () => {
        const error = new Error('Billing error: payment required');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.QUOTA_ERROR);
      });

      it('should classify "usage limit" as QUOTA_ERROR', () => {
        const error = new Error('Usage limit reached');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.QUOTA_ERROR);
      });

      it('should classify "quota_exceeded" as QUOTA_ERROR', () => {
        const error = new Error('Error: quota_exceeded');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.QUOTA_ERROR);
      });

      it('should classify "insufficient_quota" as QUOTA_ERROR', () => {
        const error = new Error('insufficient_quota error');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.QUOTA_ERROR);
      });

      // Unknown errors
      it('should classify unknown errors as UNKNOWN_ERROR', () => {
        const error = new Error('Something went wrong');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.UNKNOWN_ERROR);
      });

      it('should handle empty error messages', () => {
        const error = new Error('');
        assert.strictEqual(LLMErrorClassifier.classifyError(error), LLMErrorType.UNKNOWN_ERROR);
      });
    });

    describe('shouldRetry', () => {
      it('should return false for AUTH_ERROR', () => {
        assert.isFalse(LLMErrorClassifier.shouldRetry(LLMErrorType.AUTH_ERROR));
      });

      it('should return false for QUOTA_ERROR', () => {
        assert.isFalse(LLMErrorClassifier.shouldRetry(LLMErrorType.QUOTA_ERROR));
      });

      it('should return true for RATE_LIMIT_ERROR', () => {
        assert.isTrue(LLMErrorClassifier.shouldRetry(LLMErrorType.RATE_LIMIT_ERROR));
      });

      it('should return true for NETWORK_ERROR', () => {
        assert.isTrue(LLMErrorClassifier.shouldRetry(LLMErrorType.NETWORK_ERROR));
      });

      it('should return true for SERVER_ERROR', () => {
        assert.isTrue(LLMErrorClassifier.shouldRetry(LLMErrorType.SERVER_ERROR));
      });

      it('should return true for JSON_PARSE_ERROR', () => {
        assert.isTrue(LLMErrorClassifier.shouldRetry(LLMErrorType.JSON_PARSE_ERROR));
      });

      it('should return true for UNKNOWN_ERROR', () => {
        assert.isTrue(LLMErrorClassifier.shouldRetry(LLMErrorType.UNKNOWN_ERROR));
      });
    });

    describe('getRetryConfig', () => {
      it('should return default config for unknown error types', () => {
        const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.UNKNOWN_ERROR);
        assert.strictEqual(config.maxRetries, DEFAULT_RETRY_CONFIG.maxRetries);
        assert.strictEqual(config.baseDelayMs, DEFAULT_RETRY_CONFIG.baseDelayMs);
      });

      it('should return rate limit specific config (60s delay)', () => {
        const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.RATE_LIMIT_ERROR);
        assert.strictEqual(config.maxRetries, RATE_LIMIT_RETRY_CONFIG.maxRetries);
        assert.strictEqual(config.baseDelayMs, RATE_LIMIT_RETRY_CONFIG.baseDelayMs);
        assert.strictEqual(config.backoffMultiplier, 1, 'Rate limit should not use exponential backoff');
      });

      it('should return network error specific config', () => {
        const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.NETWORK_ERROR);
        assert.strictEqual(config.maxRetries, NETWORK_ERROR_RETRY_CONFIG.maxRetries);
        assert.strictEqual(config.baseDelayMs, NETWORK_ERROR_RETRY_CONFIG.baseDelayMs);
      });

      it('should merge custom config overrides', () => {
        const customConfig = { maxRetries: 5, baseDelayMs: 500 };
        const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.SERVER_ERROR, customConfig);
        assert.strictEqual(config.maxRetries, 5);
        assert.strictEqual(config.baseDelayMs, 500);
      });

      it('should use default config for SERVER_ERROR', () => {
        const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.SERVER_ERROR);
        assert.strictEqual(config.maxRetries, DEFAULT_RETRY_CONFIG.maxRetries);
      });

      it('should use default config for JSON_PARSE_ERROR', () => {
        const config = LLMErrorClassifier.getRetryConfig(LLMErrorType.JSON_PARSE_ERROR);
        assert.strictEqual(config.maxRetries, DEFAULT_RETRY_CONFIG.maxRetries);
      });
    });
  });

  // ============ LLMRetryManager Tests ============
  describe('LLMRetryManager', () => {
    describe('executeWithRetry', () => {
      it('should return immediately on success', async () => {
        const manager = new LLMRetryManager({ enableLogging: false });
        let callCount = 0;

        const result = await manager.executeWithRetry(async () => {
          callCount++;
          return 'success';
        });

        assert.strictEqual(result, 'success');
        assert.strictEqual(callCount, 1);
      });

      it('should retry on retryable errors', async function() {
        this.timeout(15000); // Allow more time for retries
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(3),
        });
        let callCount = 0;

        const result = await manager.executeWithRetry(async () => {
          callCount++;
          if (callCount < 3) {
            throw new Error('Network error');
          }
          return 'success';
        }, { customRetryConfig: createFastRetryConfig(3) });

        assert.strictEqual(result, 'success');
        assert.strictEqual(callCount, 3);
      });

      it('should not retry on AUTH_ERROR', async () => {
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(3),
        });
        let callCount = 0;

        try {
          await manager.executeWithRetry(async () => {
            callCount++;
            throw new Error('401 Unauthorized');
          });
          assert.fail('Should have thrown');
        } catch (error) {
          assert.strictEqual(callCount, 1, 'Should not retry AUTH_ERROR');
          assert.include((error as Error).message, 'Unauthorized');
        }
      });

      it('should not retry on QUOTA_ERROR', async () => {
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(3),
        });
        let callCount = 0;

        try {
          await manager.executeWithRetry(async () => {
            callCount++;
            throw new Error('Insufficient quota');
          });
          assert.fail('Should have thrown');
        } catch (error) {
          assert.strictEqual(callCount, 1, 'Should not retry QUOTA_ERROR');
          assert.include((error as Error).message, 'quota');
        }
      });

      it('should respect maxRetries limit', async () => {
        const maxRetries = 2;
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(maxRetries),
        });
        let callCount = 0;

        try {
          await manager.executeWithRetry(async () => {
            callCount++;
            throw new Error('Server error 500');
          });
          assert.fail('Should have thrown');
        } catch (error) {
          // Should try once + maxRetries = 3 total calls
          assert.strictEqual(callCount, maxRetries + 1);
        }
      });

      it('should call onRetry callback on each retry', async function() {
        this.timeout(15000); // Allow more time for retries
        const retryAttempts: number[] = [];
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(3),
          onRetry: (attempt) => {
            retryAttempts.push(attempt);
          },
        });
        let callCount = 0;

        try {
          await manager.executeWithRetry(async () => {
            callCount++;
            throw new Error('Network error');
          }, { customRetryConfig: createFastRetryConfig(3) });
        } catch {
          // Expected
        }

        // Should have retry callbacks for attempts 1, 2, 3
        assert.deepEqual(retryAttempts, [1, 2, 3]);
      });

      it('should throw last error after max retries exceeded', async function() {
        this.timeout(15000); // Allow more time for retries
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(2),
        });

        try {
          await manager.executeWithRetry(async () => {
            throw new Error('Persistent network error');
          }, { customRetryConfig: createFastRetryConfig(2) });
          assert.fail('Should have thrown');
        } catch (error) {
          assert.include((error as Error).message, 'Persistent network error');
        }
      });

      it('should respect maxTotalTimeMs limit', async () => {
        const manager = new LLMRetryManager({
          enableLogging: false,
          defaultConfig: createFastRetryConfig(10),
          maxTotalTimeMs: 50, // Very short timeout
        });
        let callCount = 0;

        try {
          await manager.executeWithRetry(async () => {
            callCount++;
            // Add a small delay to ensure time passes
            await new Promise(resolve => setTimeout(resolve, 20));
            throw new Error('Network error');
          });
          assert.fail('Should have thrown');
        } catch (error) {
          // Should stop before maxRetries due to time limit
          assert.isBelow(callCount, 10);
        }
      });
    });

    describe('simpleRetry static method', () => {
      it('should work as static convenience method', async () => {
        let callCount = 0;

        const result = await LLMRetryManager.simpleRetry(async () => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Network error');
          }
          return 'success';
        }, createFastRetryConfig(3));

        assert.strictEqual(result, 'success');
        assert.strictEqual(callCount, 2);
      });
    });
  });

  // ============ LLMErrorUtils Tests ============
  describe('LLMErrorUtils', () => {
    describe('isRetryable', () => {
      it('should return true for retryable errors', () => {
        assert.isTrue(LLMErrorUtils.isRetryable(new Error('Network error')));
        assert.isTrue(LLMErrorUtils.isRetryable(new Error('Server error 500')));
        assert.isTrue(LLMErrorUtils.isRetryable(new Error('Rate limit exceeded')));
      });

      it('should return false for non-retryable errors', () => {
        assert.isFalse(LLMErrorUtils.isRetryable(new Error('401 Unauthorized')));
        assert.isFalse(LLMErrorUtils.isRetryable(new Error('Insufficient quota')));
      });
    });

    describe('getErrorMessage', () => {
      it('should return user-friendly message for RATE_LIMIT_ERROR', () => {
        const error = new Error('Rate limit exceeded');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message.toLowerCase(), 'rate limit');
        assert.include(message.toLowerCase(), 'wait');
      });

      it('should return user-friendly message for AUTH_ERROR', () => {
        const error = new Error('401 Unauthorized');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message.toLowerCase(), 'authentication');
        assert.include(message.toLowerCase(), 'api key');
      });

      it('should return user-friendly message for NETWORK_ERROR', () => {
        const error = new Error('Network error');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message.toLowerCase(), 'network');
        assert.include(message.toLowerCase(), 'connection');
      });

      it('should return user-friendly message for SERVER_ERROR', () => {
        const error = new Error('Server error 500');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message.toLowerCase(), 'server');
        assert.include(message.toLowerCase(), 'unavailable');
      });

      it('should return user-friendly message for QUOTA_ERROR', () => {
        const error = new Error('Insufficient quota');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message.toLowerCase(), 'quota');
      });

      it('should return user-friendly message for JSON_PARSE_ERROR', () => {
        const error = new Error('JSON parsing failed');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message.toLowerCase(), 'parse');
      });

      it('should return original message for UNKNOWN_ERROR', () => {
        const error = new Error('Something specific went wrong');
        const message = LLMErrorUtils.getErrorMessage(error);
        assert.include(message, 'Something specific went wrong');
      });
    });

    describe('enhanceError', () => {
      it('should add operation context to error', () => {
        const error = new Error('Network error');
        const enhanced = LLMErrorUtils.enhanceError(error, { operation: 'OpenAI call' });
        assert.include(enhanced.message, 'OpenAI call');
        assert.include(enhanced.message, 'NETWORK_ERROR');
      });

      it('should add attempt number to error', () => {
        const error = new Error('Server error 500');
        const enhanced = LLMErrorUtils.enhanceError(error, { attempt: 3 });
        assert.include(enhanced.message, 'attempt 3');
      });

      it('should preserve original error', () => {
        const error = new Error('Original error');
        const enhanced = LLMErrorUtils.enhanceError(error, { operation: 'test' });
        assert.strictEqual((enhanced as any).originalError, error);
      });

      it('should add error type to enhanced error', () => {
        const error = new Error('Rate limit exceeded');
        const enhanced = LLMErrorUtils.enhanceError(error, { operation: 'test' });
        assert.strictEqual((enhanced as any).errorType, LLMErrorType.RATE_LIMIT_ERROR);
      });

      it('should include operation and attempt context', () => {
        const error = new Error('Network error');
        const enhanced = LLMErrorUtils.enhanceError(error, { operation: 'fetchModels', attempt: 2 });
        assert.deepEqual((enhanced as any).context, { operation: 'fetchModels', attempt: 2 });
      });
    });
  });
});
