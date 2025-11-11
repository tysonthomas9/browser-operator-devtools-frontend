// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { Runnable } from './OrchestrationTypes.js';
import { createLogger } from '../observability/Logger.js';

const logger = createLogger('GraphNodeHelpers');

/**
 * Helper functions for creating common graph node patterns
 *
 * These are generic helpers that can be used to build nodes for any
 * state machine workflow. They demonstrate common patterns but applications
 * should create their own node implementations specific to their needs.
 */

/**
 * Creates a simple transformation node that applies a synchronous function to state
 *
 * @example
 * ```typescript
 * const validateNode = createTransformNode<MyState>(
 *   'validateInput',
 *   (state) => ({
 *     ...state,
 *     isValid: state.input.length > 0
 *   })
 * );
 * ```
 */
export function createTransformNode<TState>(
  name: string,
  transform: (state: TState) => TState
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }
      logger.debug(`${name}: Transforming state`);
      return transform(state);
    }
  };
}

/**
 * Creates an async transformation node
 *
 * @example
 * ```typescript
 * const fetchDataNode = createAsyncTransformNode<MyState>(
 *   'fetchData',
 *   async (state) => ({
 *     ...state,
 *     data: await fetchFromAPI(state.query)
 *   })
 * );
 * ```
 */
export function createAsyncTransformNode<TState>(
  name: string,
  transform: (state: TState, signal?: AbortSignal) => Promise<TState>
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }
      logger.debug(`${name}: Async transforming state`);
      return await transform(state, signal);
    }
  };
}

/**
 * Creates a conditional node that executes different transforms based on a condition
 *
 * @example
 * ```typescript
 * const processNode = createConditionalNode<MyState>(
 *   'processData',
 *   (state) => state.type === 'premium',
 *   (state) => ({ ...state, processed: processPremium(state.data) }),
 *   (state) => ({ ...state, processed: processBasic(state.data) })
 * );
 * ```
 */
export function createConditionalNode<TState>(
  name: string,
  condition: (state: TState) => boolean,
  ifTrue: (state: TState) => TState,
  ifFalse: (state: TState) => TState
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }

      const conditionResult = condition(state);
      logger.debug(`${name}: Condition evaluated to ${conditionResult}`);

      return conditionResult ? ifTrue(state) : ifFalse(state);
    }
  };
}

/**
 * Creates a validation node that checks state and adds errors
 *
 * @example
 * ```typescript
 * const validateNode = createValidationNode<MyState>(
 *   'validate',
 *   (state) => state.input.length > 0,
 *   'Input cannot be empty'
 * );
 * ```
 */
export function createValidationNode<TState extends { error?: string }>(
  name: string,
  validate: (state: TState) => boolean,
  errorMessage: string
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }

      const isValid = validate(state);

      if (!isValid) {
        logger.warn(`${name}: Validation failed - ${errorMessage}`);
        return {
          ...state,
          error: errorMessage
        };
      }

      logger.debug(`${name}: Validation passed`);
      return state;
    }
  };
}

/**
 * Creates a retry node that wraps another node with retry logic
 *
 * @example
 * ```typescript
 * const reliableFetch = createRetryNode<MyState>(
 *   'reliableFetch',
 *   fetchNode,
 *   { maxRetries: 3, delayMs: 1000 }
 * );
 * ```
 */
export function createRetryNode<TState>(
  name: string,
  node: Runnable<TState, TState>,
  options: {
    maxRetries: number;
    delayMs: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        if (signal?.aborted) {
          throw new Error(`${name} aborted`);
        }

        try {
          logger.debug(`${name}: Attempt ${attempt + 1}/${options.maxRetries + 1}`);
          return await node.invoke(state, signal);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          if (options.shouldRetry && !options.shouldRetry(lastError)) {
            logger.warn(`${name}: Error not retryable, failing immediately`);
            throw lastError;
          }

          // Don't sleep on last attempt
          if (attempt < options.maxRetries) {
            logger.warn(`${name}: Attempt ${attempt + 1} failed, retrying after ${options.delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, options.delayMs));
          }
        }
      }

      logger.error(`${name}: All ${options.maxRetries + 1} attempts failed`);
      throw lastError || new Error(`${name}: All attempts failed`);
    }
  };
}

/**
 * Creates a logging node that logs state transitions
 *
 * @example
 * ```typescript
 * const logNode = createLoggingNode<MyState>(
 *   'logProgress',
 *   (state) => `Processing item ${state.currentItem}`
 * );
 * ```
 */
export function createLoggingNode<TState>(
  name: string,
  getMessage: (state: TState) => string
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }

      const message = getMessage(state);
      logger.info(`${name}: ${message}`);

      return state;
    }
  };
}

/**
 * Creates a final node that validates the final state
 *
 * @example
 * ```typescript
 * const finalNode = createFinalNode<MyState>(
 *   'finish',
 *   (state) => state.result !== undefined
 * );
 * ```
 */
export function createFinalNode<TState>(
  name: string,
  validateFinal?: (state: TState) => boolean
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }

      if (validateFinal && !validateFinal(state)) {
        logger.error(`${name}: Final state validation failed`);
        throw new Error(`${name}: Invalid final state`);
      }

      logger.info(`${name}: Workflow completed successfully`);
      return state;
    }
  };
}

/**
 * Creates a passthrough node that just returns state unchanged
 * Useful for testing or as placeholders
 *
 * @example
 * ```typescript
 * const placeholder = createPassthroughNode<MyState>('placeholder');
 * ```
 */
export function createPassthroughNode<TState>(
  name: string
): Runnable<TState, TState> {
  return {
    async invoke(state: TState, signal?: AbortSignal): Promise<TState> {
      if (signal?.aborted) {
        throw new Error(`${name} aborted`);
      }
      logger.debug(`${name}: Passthrough`);
      return state;
    }
  };
}
