// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Create workflows following Mastra pattern
 */

import type { WorkflowConfig } from './types.js';
import { WorkflowBuilder } from './WorkflowBuilder.js';

/**
 * Create a workflow following Mastra pattern
 *
 * @example Basic workflow
 * ```typescript
 * import { createWorkflow, createStep } from '@browser-operator/core/workflows';
 * import { z } from 'zod';
 *
 * const workflow = createWorkflow({
 *   id: 'example-workflow',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * })
 *   .then(step1)
 *   .then(step2)
 *   .commit();
 *
 * const result = await workflow.start({ message: 'hello' });
 * ```
 *
 * @example Parallel execution
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'parallel-workflow',
 *   inputSchema: z.object({ userId: z.string() }),
 *   outputSchema: z.object({ data: z.any() }),
 * })
 *   .parallel([fetchUser, fetchPosts])
 *   .then(combineData)
 *   .commit();
 * ```
 *
 * @example Conditional branching
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'conditional-workflow',
 *   inputSchema: z.object({ value: z.number() }),
 *   outputSchema: z.object({ result: z.string() }),
 * })
 *   .branch([
 *     [async ({ inputData }) => inputData.value > 50, processHigh],
 *     [async ({ inputData }) => inputData.value <= 50, processLow],
 *   ])
 *   .commit();
 * ```
 *
 * @example With state management
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'stateful-workflow',
 *   inputSchema: z.object({ items: z.array(z.string()) }),
 *   outputSchema: z.object({ processed: z.number() }),
 *   stateSchema: z.object({ counter: z.number() }),
 * })
 *   .foreach(processItem, { concurrency: 4 })
 *   .then(getFinalCount)
 *   .commit();
 * ```
 */
export function createWorkflow<TInput, TOutput, TState = Record<string, unknown>>(
  config: WorkflowConfig<TInput, TOutput, TState>
): WorkflowBuilder<TInput, TOutput, TState> {
  return new WorkflowBuilder(config);
}
