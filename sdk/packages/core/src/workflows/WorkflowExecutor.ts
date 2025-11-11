// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Workflow execution engine
 * Browser-compatible implementation
 */

import type {
  WorkflowConfig,
  WorkflowNode,
  WorkflowResult,
  WorkflowExecutionOptions,
  WorkflowEvent,
  WorkflowStep,
  StepResult,
  StepExecutionContext,
  Condition,
  MapFunction,
  ForeachOptions,
} from './types.js';
import type { WorkflowCheckpoint, WorkflowStorage } from './persistence.js';
import { RuntimeContext } from '../tools/utils.js';

/**
 * Executes workflow nodes in order
 */
export class WorkflowExecutor<TInput, TOutput, TState> {
  private config: WorkflowConfig<TInput, TOutput, TState>;
  private nodes: WorkflowNode[];
  private state: Partial<TState> = {};
  private stepResults: Map<string, any> = new Map();
  private initialInput: TInput;
  private runtimeContext?: RuntimeContext;
  private storage?: WorkflowStorage;
  private currentNodeIndex: number = 0;

  constructor(
    config: WorkflowConfig<TInput, TOutput, TState>,
    nodes: WorkflowNode[],
    storage?: WorkflowStorage
  ) {
    this.config = config;
    this.nodes = nodes;
    this.storage = storage;
  }

  /**
   * Execute workflow and wait for completion
   */
  async execute(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowResult<TOutput>> {
    this.initialInput = input;
    this.runtimeContext = options?.runtimeContext;
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    try {
      // Check if resuming from checkpoint
      if (options?.resumeFromCheckpoint) {
        return await this.resumeFromCheckpoint(options.resumeFromCheckpoint);
      }

      // Validate input
      const validatedInput = this.config.inputSchema.parse(input);

      // Initialize state
      if (options?.initialState) {
        this.state = { ...options.initialState } as Partial<TState>;
      }

      let currentData: any = validatedInput;

      // Execute each node
      for (let i = 0; i < this.nodes.length; i++) {
        this.currentNodeIndex = i;
        const node = this.nodes[i];
        const result = await this.executeNode(node, currentData, options);
        stepResults.push(...result.steps);
        currentData = result.output;

        // Auto-save checkpoint if storage is configured
        if (this.storage && options?.autoCheckpoint) {
          await this.saveCheckpoint(currentData);
        }
      }

      // Validate output
      const validatedOutput = this.config.outputSchema.parse(currentData);

      return {
        workflowId: this.config.id,
        status: 'success',
        output: validatedOutput,
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        workflowId: this.config.id,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute workflow with streaming
   */
  async *stream(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): AsyncIterable<WorkflowEvent> {
    this.initialInput = input;
    this.runtimeContext = options?.runtimeContext;

    yield {
      type: 'workflow:start',
      workflowId: this.config.id,
      timestamp: Date.now(),
    };

    try {
      const validatedInput = this.config.inputSchema.parse(input);

      if (options?.initialState) {
        this.state = { ...options.initialState } as Partial<TState>;
      }

      let currentData: any = validatedInput;

      for (const node of this.nodes) {
        // Stream node execution
        for await (const event of this.streamNode(node, currentData, options)) {
          yield event;
        }

        // Get result after node completes
        const result = await this.executeNode(node, currentData, options);
        currentData = result.output;
      }

      const validatedOutput = this.config.outputSchema.parse(currentData);

      yield {
        type: 'workflow:complete',
        workflowId: this.config.id,
        output: validatedOutput,
        timestamp: Date.now(),
      };
    } catch (error) {
      yield {
        type: 'workflow:error',
        workflowId: this.config.id,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: WorkflowNode,
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    switch (node.type) {
      case 'step':
        return this.executeStep(node.step, input, options);

      case 'parallel':
        return this.executeParallel(node.steps, input, options);

      case 'branch':
        return this.executeBranch(node.branches, input, options);

      case 'map':
        return this.executeMap(node.mapper, input, options);

      case 'foreach':
        return this.executeForeach(node.step, input, node.options, options);

      case 'dowhile':
        return this.executeDoWhile(node.condition, node.step, input, node.maxIterations, options);

      case 'dountil':
        return this.executeDoUntil(node.condition, node.step, input, node.maxIterations, options);

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = step.inputSchema.parse(input);

      // Create context
      const context: StepExecutionContext<any, TState> = {
        inputData: validatedInput,
        state: this.state as TState,
        setState: <K extends keyof TState>(key: K, value: TState[K]) => {
          (this.state as any)[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: <T = unknown>(stepId: string) => this.stepResults.get(stepId) as T | undefined,
        getInitData: <T = unknown>() => this.initialInput as T,
      };

      // Execute step
      const output = await step.execute(context);

      // Validate output
      const validatedOutput = step.outputSchema.parse(output);

      // Store result
      this.stepResults.set(step.id, validatedOutput);

      const stepResult: StepResult = {
        stepId: step.id,
        status: 'success',
        output: validatedOutput,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };

      return { output: validatedOutput, steps: [stepResult] };
    } catch (error) {
      const stepResult: StepResult = {
        stepId: step.id,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };

      // Re-throw to stop workflow
      throw error;
    }
  }

  /**
   * Execute steps in parallel
   */
  private async executeParallel(
    steps: WorkflowStep<any, any, any>[],
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    const promises = steps.map((step) => this.executeStep(step, input, options));
    const results = await Promise.all(promises);

    // Combine outputs (each step result is available by step ID via getStepResult)
    // Output is a map of step ID to output
    const output = Object.fromEntries(
      results.map((result, index) => [steps[index].id, result.output])
    );

    const allStepResults = results.flatMap((r) => r.steps);

    return { output, steps: allStepResults };
  }

  /**
   * Execute conditional branch
   */
  private async executeBranch(
    branches: Array<[Condition, WorkflowStep<any, any, any>]>,
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    // Create context for condition evaluation
    const context: StepExecutionContext<any, TState> = {
      inputData: input,
      state: this.state as TState,
      setState: <K extends keyof TState>(key: K, value: TState[K]) => {
        (this.state as any)[key] = value;
      },
      runtimeContext: this.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: <T = unknown>(stepId: string) => this.stepResults.get(stepId) as T | undefined,
      getInitData: <T = unknown>() => this.initialInput as T,
    };

    // Find first matching branch
    for (const [condition, step] of branches) {
      const matches = await condition(context);
      if (matches) {
        return this.executeStep(step, input, options);
      }
    }

    // No branch matched - return input unchanged
    return { output: input, steps: [] };
  }

  /**
   * Execute map transformation
   */
  private async executeMap(
    mapper: MapFunction,
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    const context: StepExecutionContext<any, TState> = {
      inputData: input,
      state: this.state as TState,
      setState: <K extends keyof TState>(key: K, value: TState[K]) => {
        (this.state as any)[key] = value;
      },
      runtimeContext: this.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: <T = unknown>(stepId: string) => this.stepResults.get(stepId) as T | undefined,
      getInitData: <T = unknown>() => this.initialInput as T,
    };

    const output = await mapper(context);
    return { output, steps: [] };
  }

  /**
   * Execute foreach loop
   */
  private async executeForeach(
    step: WorkflowStep<any, any, any>,
    input: any,
    foreachOptions?: ForeachOptions,
    execOptions?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    // Input should be an array
    if (!Array.isArray(input)) {
      throw new Error('foreach requires array input');
    }

    const concurrency = foreachOptions?.concurrency || input.length;
    const maxIterations = foreachOptions?.iterationCount || input.length;
    const itemsToProcess = input.slice(0, maxIterations);

    // Execute with concurrency control
    const results: any[] = [];
    const allSteps: StepResult[] = [];

    for (let i = 0; i < itemsToProcess.length; i += concurrency) {
      const batch = itemsToProcess.slice(i, i + concurrency);
      const batchPromises = batch.map((item) => this.executeStep(step, item, execOptions));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults.map((r) => r.output));
      allSteps.push(...batchResults.flatMap((r) => r.steps));
    }

    return { output: results, steps: allSteps };
  }

  /**
   * Execute dowhile loop
   */
  private async executeDoWhile(
    condition: Condition,
    step: WorkflowStep<any, any, any>,
    input: any,
    maxIterations: number = 100,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    let currentData = input;
    const allSteps: StepResult[] = [];
    let iteration = 0;

    do {
      if (iteration >= maxIterations) {
        throw new Error(`dowhile loop exceeded max iterations (${maxIterations})`);
      }

      const result = await this.executeStep(step, currentData, options);
      allSteps.push(...result.steps);
      currentData = result.output;
      iteration++;

      // Check condition
      const context: StepExecutionContext<any, TState> = {
        inputData: currentData,
        state: this.state as TState,
        setState: <K extends keyof TState>(key: K, value: TState[K]) => {
          (this.state as any)[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: <T = unknown>(stepId: string) => this.stepResults.get(stepId) as T | undefined,
        getInitData: <T = unknown>() => this.initialInput as T,
      };

      const shouldContinue = await condition(context);
      if (!shouldContinue) {
        break;
      }
    } while (true);

    return { output: currentData, steps: allSteps };
  }

  /**
   * Execute dountil loop
   */
  private async executeDoUntil(
    condition: Condition,
    step: WorkflowStep<any, any, any>,
    input: any,
    maxIterations: number = 100,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    let currentData = input;
    const allSteps: StepResult[] = [];
    let iteration = 0;

    do {
      if (iteration >= maxIterations) {
        throw new Error(`dountil loop exceeded max iterations (${maxIterations})`);
      }

      const result = await this.executeStep(step, currentData, options);
      allSteps.push(...result.steps);
      currentData = result.output;
      iteration++;

      // Check condition (opposite of dowhile)
      const context: StepExecutionContext<any, TState> = {
        inputData: currentData,
        state: this.state as TState,
        setState: <K extends keyof TState>(key: K, value: TState[K]) => {
          (this.state as any)[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: <T = unknown>(stepId: string) => this.stepResults.get(stepId) as T | undefined,
        getInitData: <T = unknown>() => this.initialInput as T,
      };

      const shouldStop = await condition(context);
      if (shouldStop) {
        break;
      }
    } while (true);

    return { output: currentData, steps: allSteps };
  }

  /**
   * Stream node execution
   */
  private async *streamNode(
    node: WorkflowNode,
    input: any,
    options?: WorkflowExecutionOptions
  ): AsyncIterable<WorkflowEvent> {
    if (node.type === 'step') {
      yield { type: 'step:start', stepId: node.step.id, timestamp: Date.now() };

      try {
        const startTime = Date.now();
        const result = await this.executeStep(node.step, input, options);
        yield {
          type: 'step:complete',
          stepId: node.step.id,
          output: result.output,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        };
      } catch (error) {
        yield {
          type: 'step:error',
          stepId: node.step.id,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - Date.now(),
          timestamp: Date.now(),
        };
      }
    } else if (node.type === 'parallel') {
      // Stream each parallel step
      for (const step of node.steps) {
        yield { type: 'step:start', stepId: step.id, timestamp: Date.now() };
      }
    }
    // Other node types can emit events as needed
  }

  /**
   * Create a checkpoint of the current workflow state
   */
  private async saveCheckpoint(currentData: any): Promise<void> {
    if (!this.storage) {
      throw new Error('Storage not configured for checkpointing');
    }

    const checkpoint: WorkflowCheckpoint<TState> = {
      workflowId: this.config.id,
      nodeIndex: this.currentNodeIndex,
      state: this.state as TState,
      stepResults: Object.fromEntries(this.stepResults),
      initialInput: this.initialInput,
      timestamp: Date.now(),
    };

    await this.storage.save(checkpoint);
  }

  /**
   * Resume workflow execution from a checkpoint
   */
  private async resumeFromCheckpoint(
    checkpoint: WorkflowCheckpoint<TState>
  ): Promise<WorkflowResult<TOutput>> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    try {
      // Restore state
      this.state = checkpoint.state;
      this.initialInput = checkpoint.initialInput as TInput;
      this.stepResults = new Map(Object.entries(checkpoint.stepResults));
      this.currentNodeIndex = checkpoint.nodeIndex;

      // Get the last output from step results
      let currentData: any = checkpoint.stepResults[Object.keys(checkpoint.stepResults).pop() || ''];

      // Resume execution from the checkpoint node
      for (let i = checkpoint.nodeIndex; i < this.nodes.length; i++) {
        this.currentNodeIndex = i;
        const node = this.nodes[i];
        const result = await this.executeNode(node, currentData, undefined);
        stepResults.push(...result.steps);
        currentData = result.output;

        // Auto-save checkpoint if storage is configured
        if (this.storage) {
          await this.saveCheckpoint(currentData);
        }
      }

      // Validate output
      const validatedOutput = this.config.outputSchema.parse(currentData);

      return {
        workflowId: this.config.id,
        status: 'success',
        output: validatedOutput,
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        workflowId: this.config.id,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Suspend the workflow and save its current state
   *
   * @returns The checkpoint that can be used to resume later
   */
  async suspend(): Promise<WorkflowCheckpoint<TState>> {
    if (!this.storage) {
      throw new Error('Storage not configured for suspending');
    }

    const checkpoint: WorkflowCheckpoint<TState> = {
      workflowId: this.config.id,
      nodeIndex: this.currentNodeIndex,
      state: this.state as TState,
      stepResults: Object.fromEntries(this.stepResults),
      initialInput: this.initialInput,
      timestamp: Date.now(),
    };

    await this.storage.save(checkpoint);
    return checkpoint;
  }

  /**
   * Load a checkpoint from storage
   */
  async loadCheckpoint(workflowId: string): Promise<WorkflowCheckpoint<TState> | null> {
    if (!this.storage) {
      throw new Error('Storage not configured');
    }

    return (await this.storage.load(workflowId)) as WorkflowCheckpoint<TState> | null;
  }
}
