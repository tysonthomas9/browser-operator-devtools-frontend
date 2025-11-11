// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Workflow system for Browser Operator SDK
 * Following Mastra pattern with browser-compatible implementation
 *
 * @example Basic workflow
 * ```typescript
 * import { createWorkflow, createStep } from '@browser-operator/core/workflows';
 * import { z } from 'zod';
 *
 * // Create steps
 * const step1 = createStep({
 *   id: 'format',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ formatted: z.string() }),
 *   execute: async ({ inputData }) => ({
 *     formatted: inputData.message.toUpperCase()
 *   }),
 * });
 *
 * const step2 = createStep({
 *   id: 'prefix',
 *   inputSchema: z.object({ formatted: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 *   execute: async ({ inputData }) => ({
 *     result: `PREFIX: ${inputData.formatted}`
 *   }),
 * });
 *
 * // Create workflow
 * const workflow = createWorkflow({
 *   id: 'simple-workflow',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * })
 *   .then(step1)
 *   .then(step2)
 *   .commit();
 *
 * // Execute (Phase 3 - not yet implemented)
 * // const result = await workflow.start({ message: 'hello' });
 * ```
 *
 * @example Parallel execution
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'parallel-workflow',
 *   inputSchema: z.object({ userId: z.string() }),
 *   outputSchema: z.object({ combined: z.any() }),
 * })
 *   .parallel([fetchUser, fetchPosts])
 *   .then(combineResults)
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
 *     [async ({ inputData }) => inputData.value > 10, processHigh],
 *     [async ({ inputData }) => inputData.value <= 10, processLow],
 *   ])
 *   .commit();
 * ```
 */

// Core workflow creation
export { createStep } from './createStep.js';
export { createWorkflow } from './createWorkflow.js';

// Builder and compiled workflow
export { WorkflowBuilder, CompiledWorkflow } from './WorkflowBuilder.js';

// Types
export type {
  // Step types
  StepConfig,
  StepExecutionContext,
  WorkflowStep,
  StepResult,
  // Workflow types
  WorkflowConfig,
  WorkflowNode,
  WorkflowResult,
  WorkflowStatus,
  WorkflowExecutionOptions,
  WorkflowEvent,
  // Control flow types
  Condition,
  MapFunction,
  ForeachOptions,
} from './types.js';
