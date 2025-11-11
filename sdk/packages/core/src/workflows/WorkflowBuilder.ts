// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Workflow builder with chainable API following Mastra pattern
 */

import type {
  WorkflowConfig,
  WorkflowNode,
  WorkflowStep,
  Condition,
  MapFunction,
  ForeachOptions,
} from './types.js';

/**
 * Compiled workflow ready for execution
 * (Placeholder - will be implemented in Phase 3)
 */
export class CompiledWorkflow<TInput, TOutput, TState> {
  constructor(
    public readonly config: WorkflowConfig<TInput, TOutput, TState>,
    public readonly nodes: WorkflowNode[]
  ) {}

  /**
   * Get workflow configuration
   */
  getConfig(): WorkflowConfig<TInput, TOutput, TState> {
    return { ...this.config };
  }

  /**
   * Get workflow nodes
   */
  getNodes(): WorkflowNode[] {
    return [...this.nodes];
  }
}

/**
 * Workflow builder with chainable API
 *
 * @example
 * ```typescript
 * const workflow = new WorkflowBuilder({
 *   id: 'example',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * })
 *   .then(step1)
 *   .parallel([step2, step3])
 *   .then(step4)
 *   .commit();
 * ```
 */
export class WorkflowBuilder<TInput, TOutput, TState> {
  private config: WorkflowConfig<TInput, TOutput, TState>;
  private nodes: WorkflowNode[] = [];
  private committed: boolean = false;

  constructor(config: WorkflowConfig<TInput, TOutput, TState>) {
    this.config = config;
  }

  /**
   * Add a step to execute sequentially
   *
   * @example
   * ```typescript
   * .then(formatStep)
   * .then(validateStep)
   * ```
   */
  then<TStepOutput>(
    step: WorkflowStep<any, TStepOutput, TState>
  ): WorkflowBuilder<TInput, TStepOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'step', step });
    return this as any;
  }

  /**
   * Execute multiple steps in parallel
   *
   * @example
   * ```typescript
   * .parallel([fetchUser, fetchPosts, fetchComments])
   * ```
   */
  parallel(
    steps: WorkflowStep<any, any, TState>[]
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();

    if (steps.length === 0) {
      throw new Error('parallel() requires at least one step');
    }

    this.nodes.push({ type: 'parallel', steps });
    return this;
  }

  /**
   * Branch based on conditions
   *
   * @example
   * ```typescript
   * .branch([
   *   [async ({ inputData }) => inputData.value > 10, highValueStep],
   *   [async ({ inputData }) => inputData.value <= 10, lowValueStep],
   * ])
   * ```
   */
  branch(
    branches: Array<[Condition, WorkflowStep<any, any, TState>]>
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();

    if (branches.length === 0) {
      throw new Error('branch() requires at least one branch');
    }

    // Validate that all branch steps have the same output schema
    // (This is a runtime check, not compile-time)
    this.nodes.push({ type: 'branch', branches });
    return this;
  }

  /**
   * Transform data between steps
   *
   * @example
   * ```typescript
   * .map(async ({ inputData, getStepResult }) => ({
   *   userId: getStepResult('user-step').id,
   *   message: inputData.message
   * }))
   * ```
   */
  map(mapper: MapFunction): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'map', mapper });
    return this;
  }

  /**
   * Iterate over array items
   *
   * @example
   * ```typescript
   * .foreach(processItem, { concurrency: 4, iterationCount: 100 })
   * ```
   */
  foreach(
    step: WorkflowStep<any, any, TState>,
    options?: ForeachOptions
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'foreach', step, options });
    return this;
  }

  /**
   * Execute step while condition is true
   *
   * @example
   * ```typescript
   * .dowhile(
   *   async ({ state }) => state.counter < 10,
   *   incrementStep
   * )
   * ```
   */
  dowhile(
    condition: Condition,
    step: WorkflowStep<any, any, TState>,
    maxIterations: number = 100
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'dowhile', condition, step, maxIterations });
    return this;
  }

  /**
   * Execute step until condition becomes true
   *
   * @example
   * ```typescript
   * .dountil(
   *   async ({ state }) => state.completed === true,
   *   processStep
   * )
   * ```
   */
  dountil(
    condition: Condition,
    step: WorkflowStep<any, any, TState>,
    maxIterations: number = 100
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'dountil', condition, step, maxIterations });
    return this;
  }

  /**
   * Commit the workflow (makes it immutable and ready for execution)
   *
   * @example
   * ```typescript
   * const workflow = createWorkflow({ ... })
   *   .then(step1)
   *   .then(step2)
   *   .commit();
   *
   * // Now workflow is ready to execute
   * const result = await workflow.start(input);
   * ```
   */
  commit(): CompiledWorkflow<TInput, TOutput, TState> {
    this.committed = true;
    return new CompiledWorkflow(this.config, this.nodes);
  }

  /**
   * Ensure workflow hasn't been committed yet
   */
  private ensureNotCommitted(): void {
    if (this.committed) {
      throw new Error(
        'Cannot modify committed workflow. Create a new workflow builder instead.'
      );
    }
  }
}
