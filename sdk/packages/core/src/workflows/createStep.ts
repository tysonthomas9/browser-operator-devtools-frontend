// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Create workflow steps following Mastra pattern
 */

import type { StepConfig, WorkflowStep } from './types.js';

/**
 * Create a workflow step following Mastra pattern
 *
 * @example
 * ```typescript
 * import { createStep } from '@browser-operator/core/workflows';
 * import { z } from 'zod';
 *
 * const formatStep = createStep({
 *   id: 'format-message',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ formatted: z.string() }),
 *   execute: async ({ inputData }) => {
 *     return { formatted: inputData.message.toUpperCase() };
 *   },
 * });
 * ```
 *
 * @example With state
 * ```typescript
 * const countStep = createStep({
 *   id: 'increment-count',
 *   inputSchema: z.object({ value: z.number() }),
 *   outputSchema: z.object({ count: z.number() }),
 *   stateSchema: z.object({ counter: z.number() }),
 *   execute: async ({ inputData, state, setState }) => {
 *     const newCount = (state.counter || 0) + inputData.value;
 *     setState('counter', newCount);
 *     return { count: newCount };
 *   },
 * });
 * ```
 *
 * @example With runtime context
 * ```typescript
 * const authStep = createStep({
 *   id: 'check-auth',
 *   inputSchema: z.object({ userId: z.string() }),
 *   outputSchema: z.object({ authorized: z.boolean() }),
 *   execute: async ({ inputData, runtimeContext }) => {
 *     const authToken = runtimeContext?.get<string>('authToken');
 *     // Check authorization
 *     return { authorized: true };
 *   },
 * });
 * ```
 */
export function createStep<TInput, TOutput, TState = unknown>(
  config: StepConfig<TInput, TOutput, TState>
): WorkflowStep<TInput, TOutput, TState> {
  return {
    id: config.id,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    stateSchema: config.stateSchema,
    execute: config.execute,
    metadata: config.metadata,
  };
}
