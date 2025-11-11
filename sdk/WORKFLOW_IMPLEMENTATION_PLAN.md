# Workflow System Implementation Plan

**Following Mastra AI Pattern - Browser-Compatible**

Date: 2025-01-11
Status: Planning Phase
Priority: HIGH (Replaces StateGraph)

---

## Executive Summary

This plan outlines the implementation of a **Mastra-style workflow system** for Browser Operator SDK, replacing the originally planned StateGraph approach. Workflows provide a more intuitive, chainable API for orchestrating multi-step agent processes while maintaining browser compatibility.

### Key Decision: Why Workflows > StateGraph?

| Aspect | StateGraph (LangGraph) | Mastra Workflows |
|--------|------------------------|------------------|
| **API Style** | Graph nodes/edges | Chainable methods |
| **Learning Curve** | Steep (graph theory) | Gentle (familiar `.then()`) |
| **Browser Compat** | Complex dependencies | Simple implementation |
| **Industry Adoption** | LangGraph specific | Growing (Mastra) |
| **Developer Experience** | Verbose | Intuitive |
| **Code Readability** | Complex | Clear |

**Recommendation:** Implement Mastra-style workflows for better DX, simpler implementation, and industry alignment.

---

## Architecture Overview

```
@browser-operator/core/workflows
│
├── createStep()           - Define workflow steps
├── createWorkflow()       - Compose workflows
├── WorkflowBuilder        - Fluent API builder
├── WorkflowExecutor       - Execute workflows
└── WorkflowContext        - Execution context

Control Flow Methods:
├── .then(step)           - Sequential execution
├── .parallel([steps])    - Concurrent execution
├── .branch([conditions]) - Conditional routing
├── .map(fn)             - Data transformation
├── .foreach(step)       - Array iteration
├── .dowhile(cond, step) - While loop
└── .dountil(cond, step) - Until loop

Execution Modes:
├── .start(input)        - Wait for completion
└── .stream(input)       - Event streaming
```

---

## Phase 1: Core Types & Step Creation

### 1.1 Workflow Step Types

```typescript
// sdk/packages/core/src/workflows/types.ts

import type { z } from 'zod';

/**
 * Workflow step configuration
 */
export interface StepConfig<
  TInput = unknown,
  TOutput = unknown,
  TState = unknown,
  TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>,
  TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>,
  TStateSchema extends z.ZodType<TState> = z.ZodType<TState>,
> {
  /**
   * Unique step identifier
   */
  id: string;

  /**
   * Input schema for validation
   */
  inputSchema: TInputSchema;

  /**
   * Output schema for validation
   */
  outputSchema: TOutputSchema;

  /**
   * Optional state schema for shared state
   */
  stateSchema?: TStateSchema;

  /**
   * Execute function
   */
  execute: (context: StepExecutionContext<TInput, TState>) => Promise<TOutput>;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to step execute function
 */
export interface StepExecutionContext<TInput, TState = unknown> {
  /**
   * Input data (validated against inputSchema)
   */
  inputData: TInput;

  /**
   * Shared workflow state
   */
  state: TState;

  /**
   * Update shared state
   */
  setState: <K extends keyof TState>(key: K, value: TState[K]) => void;

  /**
   * Runtime context for request-specific values
   */
  runtimeContext?: RuntimeContext;

  /**
   * Abort signal for cancellation
   */
  abortSignal?: AbortSignal;

  /**
   * Get result of previous step by ID
   */
  getStepResult: <T = unknown>(stepId: string) => T | undefined;

  /**
   * Get initial workflow input data
   */
  getInitData: <T = unknown>() => T;
}

/**
 * Workflow step interface
 */
export interface WorkflowStep<TInput = unknown, TOutput = unknown, TState = unknown> {
  id: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  stateSchema?: z.ZodType<TState>;
  execute: (context: StepExecutionContext<TInput, TState>) => Promise<TOutput>;
  metadata?: Record<string, unknown>;
}

/**
 * Step execution result
 */
export interface StepResult<TOutput = unknown> {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  output?: TOutput;
  error?: Error;
  startTime: number;
  endTime: number;
  duration: number;
}
```

### 1.2 createStep() Factory

```typescript
// sdk/packages/core/src/workflows/createStep.ts

import type { StepConfig, WorkflowStep } from './types.js';

/**
 * Create a workflow step following Mastra pattern
 *
 * @example
 * ```typescript
 * const formatStep = createStep({
 *   id: 'format-message',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ formatted: z.string() }),
 *   execute: async ({ inputData }) => {
 *     return { formatted: inputData.message.toUpperCase() };
 *   },
 * });
 * ```
 */
export function createStep<TInput, TOutput, TState>(
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
```

---

## Phase 2: Workflow Configuration & Builder

### 2.1 Workflow Types

```typescript
// sdk/packages/core/src/workflows/types.ts (continued)

/**
 * Workflow configuration
 */
export interface WorkflowConfig<TInput = unknown, TOutput = unknown, TState = unknown> {
  /**
   * Unique workflow identifier
   */
  id: string;

  /**
   * Input schema for the entire workflow
   */
  inputSchema: z.ZodType<TInput>;

  /**
   * Output schema for the entire workflow
   */
  outputSchema: z.ZodType<TOutput>;

  /**
   * Optional shared state schema
   */
  stateSchema?: z.ZodType<TState>;

  /**
   * Optional metadata
   */
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    [key: string]: unknown;
  };
}

/**
 * Workflow execution node (internal)
 */
export type WorkflowNode =
  | { type: 'step'; step: WorkflowStep }
  | { type: 'parallel'; steps: WorkflowStep[] }
  | { type: 'branch'; branches: Array<[Condition, WorkflowStep]> }
  | { type: 'map'; mapper: MapFunction }
  | { type: 'foreach'; step: WorkflowStep; options?: ForeachOptions };

/**
 * Condition function for branching
 */
export type Condition = (context: StepExecutionContext<any, any>) => Promise<boolean> | boolean;

/**
 * Map function for data transformation
 */
export type MapFunction = (context: StepExecutionContext<any, any>) => Promise<any> | any;

/**
 * Options for foreach iteration
 */
export interface ForeachOptions {
  concurrency?: number;
  iterationCount?: number;
}

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'pending' | 'running' | 'suspended' | 'success' | 'failed';

/**
 * Workflow execution result
 */
export interface WorkflowResult<TOutput = unknown> {
  workflowId: string;
  status: WorkflowStatus;
  output?: TOutput;
  error?: Error;
  steps: StepResult[];
  startTime: number;
  endTime?: number;
  duration?: number;
}
```

### 2.2 Workflow Builder

```typescript
// sdk/packages/core/src/workflows/WorkflowBuilder.ts

/**
 * Workflow builder with chainable API
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
   */
  parallel(
    steps: WorkflowStep<any, any, TState>[]
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'parallel', steps });
    return this;
  }

  /**
   * Branch based on conditions
   */
  branch(
    branches: Array<[Condition, WorkflowStep<any, any, TState>]>
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'branch', branches });
    return this;
  }

  /**
   * Transform data between steps
   */
  map(
    mapper: MapFunction
  ): WorkflowBuilder<TInput, TOutput, TState> {
    this.ensureNotCommitted();
    this.nodes.push({ type: 'map', mapper });
    return this;
  }

  /**
   * Iterate over array items
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
   * Commit the workflow (makes it immutable)
   */
  commit(): CompiledWorkflow<TInput, TOutput, TState> {
    this.committed = true;
    return new CompiledWorkflow(this.config, this.nodes);
  }

  private ensureNotCommitted(): void {
    if (this.committed) {
      throw new Error('Cannot modify committed workflow');
    }
  }
}
```

### 2.3 createWorkflow() Factory

```typescript
// sdk/packages/core/src/workflows/createWorkflow.ts

/**
 * Create a workflow following Mastra pattern
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'example-workflow',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * })
 *   .then(step1)
 *   .parallel([step2, step3])
 *   .then(step4)
 *   .commit();
 * ```
 */
export function createWorkflow<TInput, TOutput, TState = Record<string, unknown>>(
  config: WorkflowConfig<TInput, TOutput, TState>
): WorkflowBuilder<TInput, TOutput, TState> {
  return new WorkflowBuilder(config);
}
```

---

## Phase 3: Workflow Execution Engine

### 3.1 Compiled Workflow

```typescript
// sdk/packages/core/src/workflows/CompiledWorkflow.ts

/**
 * Compiled workflow ready for execution
 */
export class CompiledWorkflow<TInput, TOutput, TState> {
  private config: WorkflowConfig<TInput, TOutput, TState>;
  private nodes: WorkflowNode[];

  constructor(
    config: WorkflowConfig<TInput, TOutput, TState>,
    nodes: WorkflowNode[]
  ) {
    this.config = config;
    this.nodes = nodes;
  }

  /**
   * Execute workflow and wait for completion
   */
  async start(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowResult<TOutput>> {
    const executor = new WorkflowExecutor(this.config, this.nodes);
    return executor.execute(input, options);
  }

  /**
   * Execute workflow with streaming updates
   */
  async *stream(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): AsyncIterable<WorkflowEvent> {
    const executor = new WorkflowExecutor(this.config, this.nodes);
    yield* executor.stream(input, options);
  }

  /**
   * Get workflow configuration
   */
  getConfig(): WorkflowConfig<TInput, TOutput, TState> {
    return { ...this.config };
  }
}
```

### 3.2 Workflow Executor

```typescript
// sdk/packages/core/src/workflows/WorkflowExecutor.ts

/**
 * Executes workflow nodes in order
 */
export class WorkflowExecutor<TInput, TOutput, TState> {
  private config: WorkflowConfig<TInput, TOutput, TState>;
  private nodes: WorkflowNode[];
  private state: Partial<TState> = {};
  private stepResults: Map<string, any> = new Map();
  private initialInput: TInput;

  constructor(
    config: WorkflowConfig<TInput, TOutput, TState>,
    nodes: WorkflowNode[]
  ) {
    this.config = config;
    this.nodes = nodes;
  }

  /**
   * Execute workflow
   */
  async execute(
    input: TInput,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowResult<TOutput>> {
    this.initialInput = input;
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    try {
      // Validate input
      const validatedInput = this.config.inputSchema.parse(input);

      // Initialize state
      if (options?.initialState) {
        this.state = { ...options.initialState };
      }

      let currentData: any = validatedInput;

      // Execute each node
      for (const node of this.nodes) {
        const result = await this.executeNode(node, currentData, options);
        stepResults.push(...result.steps);
        currentData = result.output;
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

    yield { type: 'workflow:start', workflowId: this.config.id, timestamp: Date.now() };

    try {
      const validatedInput = this.config.inputSchema.parse(input);
      let currentData: any = validatedInput;

      for (const node of this.nodes) {
        yield* this.streamNode(node, currentData, options);
        // Update currentData based on node result
      }

      yield {
        type: 'workflow:complete',
        workflowId: this.config.id,
        output: currentData,
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
        setState: (key, value) => {
          (this.state as any)[key] = value;
        },
        runtimeContext: options?.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput,
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

      throw error; // Re-throw to stop workflow
    }
  }

  /**
   * Execute steps in parallel
   */
  private async executeParallel(
    steps: WorkflowStep[],
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    const promises = steps.map((step) => this.executeStep(step, input, options));
    const results = await Promise.all(promises);

    // Combine outputs (each step result is available by step ID)
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
    branches: Array<[Condition, WorkflowStep]>,
    input: any,
    options?: WorkflowExecutionOptions
  ): Promise<{ output: any; steps: StepResult[] }> {
    // Create context for condition evaluation
    const context: StepExecutionContext<any, TState> = {
      inputData: input,
      state: this.state as TState,
      setState: (key, value) => {
        (this.state as any)[key] = value;
      },
      runtimeContext: options?.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: (stepId) => this.stepResults.get(stepId),
      getInitData: () => this.initialInput,
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
      setState: (key, value) => {
        (this.state as any)[key] = value;
      },
      runtimeContext: options?.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: (stepId) => this.stepResults.get(stepId),
      getInitData: () => this.initialInput,
    };

    const output = await mapper(context);
    return { output, steps: [] };
  }

  /**
   * Execute foreach loop
   */
  private async executeForeach(
    step: WorkflowStep,
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

  private async *streamNode(
    node: WorkflowNode,
    input: any,
    options?: WorkflowExecutionOptions
  ): AsyncIterable<WorkflowEvent> {
    // Similar to executeNode but yields events
    // Implementation details...
  }
}
```

---

## Phase 4: Advanced Features

### 4.1 Loop Support

```typescript
// Add to WorkflowBuilder

/**
 * Execute step while condition is true
 */
dowhile(
  condition: Condition,
  step: WorkflowStep<any, any, TState>
): WorkflowBuilder<TInput, TOutput, TState> {
  this.ensureNotCommitted();
  this.nodes.push({ type: 'dowhile', condition, step });
  return this;
}

/**
 * Execute step until condition becomes true
 */
dountil(
  condition: Condition,
  step: WorkflowStep<any, any, TState>
): WorkflowBuilder<TInput, TOutput, TState> {
  this.ensureNotCommitted();
  this.nodes.push({ type: 'dountil', condition, step });
  return this;
}
```

### 4.2 Suspend/Resume Support

```typescript
// sdk/packages/core/src/workflows/persistence.ts

/**
 * Workflow checkpoint for suspend/resume
 */
export interface WorkflowCheckpoint<TState = unknown> {
  workflowId: string;
  nodeIndex: number;
  state: TState;
  stepResults: Record<string, any>;
  timestamp: number;
}

/**
 * Storage adapter interface
 */
export interface WorkflowStorage {
  save(checkpoint: WorkflowCheckpoint): Promise<void>;
  load(workflowId: string): Promise<WorkflowCheckpoint | null>;
  delete(workflowId: string): Promise<void>;
}

/**
 * In-memory storage (for browser)
 */
export class InMemoryWorkflowStorage implements WorkflowStorage {
  private checkpoints: Map<string, WorkflowCheckpoint> = new Map();

  async save(checkpoint: WorkflowCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.workflowId, checkpoint);
  }

  async load(workflowId: string): Promise<WorkflowCheckpoint | null> {
    return this.checkpoints.get(workflowId) || null;
  }

  async delete(workflowId: string): Promise<void> {
    this.checkpoints.delete(workflowId);
  }
}

/**
 * IndexedDB storage (for browser persistence)
 */
export class IndexedDBWorkflowStorage implements WorkflowStorage {
  // Implementation using IndexedDB API
}
```

---

## Phase 5: Browser Compatibility

### 5.1 Key Considerations

**✅ No Node.js Dependencies:**
- No `fs`, `path`, `process`, etc.
- All async operations use native browser APIs

**✅ Parallel Execution:**
- Use `Promise.all()` for concurrency
- No worker threads (complex in browser)
- Simple Promise-based parallelism

**✅ State Persistence:**
- InMemoryWorkflowStorage (default)
- IndexedDBWorkflowStorage (persistent)
- No file system access

**✅ Event Streaming:**
- Use async generators (`async function*`)
- Native browser ReadableStream support
- No Node.js streams

### 5.2 Bundle Size Target

| Component | Size (minified) | Size (gzipped) |
|-----------|-----------------|----------------|
| Core types | ~5KB | ~2KB |
| WorkflowBuilder | ~10KB | ~4KB |
| WorkflowExecutor | ~15KB | ~6KB |
| Persistence | ~5KB | ~2KB |
| **Total** | **~35KB** | **~14KB** |

Combined with existing SDK: ~85KB total minified (~26KB gzipped)

---

## Phase 6: Examples & Testing

### 6.1 Basic Example

```typescript
// examples/workflows-basic/simple-workflow.ts

import { createStep, createWorkflow } from '@browser-operator/core/workflows';
import { z } from 'zod';

// Step 1: Format message
const formatStep = createStep({
  id: 'format',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  execute: async ({ inputData }) => {
    return { formatted: inputData.message.toUpperCase() };
  },
});

// Step 2: Add prefix
const prefixStep = createStep({
  id: 'prefix',
  inputSchema: z.object({ formatted: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `PREFIX: ${inputData.formatted}` };
  },
});

// Create workflow
const workflow = createWorkflow({
  id: 'simple-workflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(formatStep)
  .then(prefixStep)
  .commit();

// Execute
const result = await workflow.start({ message: 'hello world' });
console.log(result.output); // { result: 'PREFIX: HELLO WORLD' }
```

### 6.2 Parallel Execution Example

```typescript
// Parallel API calls
const fetchUser = createStep({
  id: 'fetch-user',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ user: z.object({ name: z.string() }) }),
  execute: async ({ inputData }) => {
    const response = await fetch(`/api/users/${inputData.userId}`);
    return { user: await response.json() };
  },
});

const fetchPosts = createStep({
  id: 'fetch-posts',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ posts: z.array(z.any()) }),
  execute: async ({ inputData }) => {
    const response = await fetch(`/api/posts?userId=${inputData.userId}`);
    return { posts: await response.json() };
  },
});

const combineData = createStep({
  id: 'combine',
  inputSchema: z.any(),
  outputSchema: z.object({ combined: z.any() }),
  execute: async ({ getStepResult }) => {
    const user = getStepResult('fetch-user');
    const posts = getStepResult('fetch-posts');
    return { combined: { user, posts } };
  },
});

const workflow = createWorkflow({
  id: 'user-data-workflow',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ combined: z.any() }),
})
  .parallel([fetchUser, fetchPosts])
  .then(combineData)
  .commit();
```

### 6.3 Conditional Branching Example

```typescript
const checkValue = createStep({
  id: 'check',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ inputData }) => inputData,
});

const processHigh = createStep({
  id: 'process-high',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => ({
    result: `High value: ${inputData.value}`,
  }),
});

const processLow = createStep({
  id: 'process-low',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => ({
    result: `Low value: ${inputData.value}`,
  }),
});

const workflow = createWorkflow({
  id: 'conditional-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(checkValue)
  .branch([
    [async ({ inputData }) => inputData.value > 50, processHigh],
    [async ({ inputData }) => inputData.value <= 50, processLow],
  ])
  .commit();
```

### 6.4 Agent Integration Example

```typescript
// Combining workflows with agents
const analyzeStep = createStep({
  id: 'analyze',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ analysis: z.string() }),
  execute: async ({ inputData, runtimeContext }) => {
    // Get agent from runtime context
    const agent = runtimeContext?.get('agent');
    const result = await agent.generateText(`Analyze: ${inputData.text}`);
    return { analysis: result.text };
  },
});

const summarizeStep = createStep({
  id: 'summarize',
  inputSchema: z.object({ analysis: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async ({ inputData, runtimeContext }) => {
    const agent = runtimeContext?.get('agent');
    const result = await agent.generateText(`Summarize: ${inputData.analysis}`);
    return { summary: result.text };
  },
});

const workflow = createWorkflow({
  id: 'agent-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
})
  .then(analyzeStep)
  .then(summarizeStep)
  .commit();

// Execute with agent in runtime context
const agent = new Agent({ name: 'analyzer', model: 'gpt-4' }, provider);
const result = await workflow.start(
  { text: 'Long article text...' },
  { runtimeContext: new RuntimeContext({ agent }) }
);
```

---

## Implementation Timeline

### Week 1: Core Foundation
- [ ] Day 1-2: Types and interfaces
- [ ] Day 3-4: createStep() and createWorkflow()
- [ ] Day 5: WorkflowBuilder

### Week 2: Execution Engine
- [ ] Day 1-2: Basic WorkflowExecutor
- [ ] Day 3-4: Parallel and branch execution
- [ ] Day 5: Testing and debugging

### Week 3: Advanced Features
- [ ] Day 1-2: Loop support (.foreach, .dowhile, .dountil)
- [ ] Day 3-4: Streaming support
- [ ] Day 5: State management

### Week 4: Polish & Examples
- [ ] Day 1-2: Suspend/resume (if needed)
- [ ] Day 3-4: Examples and documentation
- [ ] Day 5: Browser testing

---

## Success Criteria

**✅ Functional Requirements:**
- [ ] Can create steps with Zod schemas
- [ ] Can compose workflows with chainable API
- [ ] Supports .then(), .parallel(), .branch(), .map(), .foreach()
- [ ] Validates input/output with Zod
- [ ] Executes in correct order
- [ ] Handles errors gracefully
- [ ] Streams execution events

**✅ Non-Functional Requirements:**
- [ ] Works in browser (Chrome, Firefox, Safari, Edge)
- [ ] Bundle size < 40KB minified
- [ ] Zero Node.js dependencies
- [ ] Full TypeScript support
- [ ] Follows Mastra pattern exactly

**✅ Quality Requirements:**
- [ ] Comprehensive examples
- [ ] Complete API documentation
- [ ] Unit tests for core functionality
- [ ] Integration tests with agents

---

## Future Enhancements (Post-MVP)

1. **Visual Workflow Builder** - UI for creating workflows
2. **Workflow Templates** - Pre-built common patterns
3. **Performance Monitoring** - Execution metrics and tracing
4. **Workflow Versioning** - Version control for workflows
5. **Advanced Loop Controls** - Break, continue, retry logic
6. **Distributed Execution** - Run workflows across workers
7. **Workflow Composition** - Workflows calling workflows
8. **Dynamic Branching** - Runtime-defined branches

---

## Questions for Consideration

1. **State Management:** Should we support global state or only step-local state?
2. **Error Handling:** Retry logic at step level or workflow level?
3. **Persistence:** IndexedDB required or optional?
4. **Streaming:** Should all steps support streaming or just workflow?
5. **Validation:** Validate intermediate data or just input/output?
6. **Concurrency:** Should we add concurrency limits for .parallel()?

---

## Conclusion

This plan outlines a complete Mastra-style workflow system that:
- ✅ **Replaces StateGraph** with a more intuitive API
- ✅ **Follows industry standards** (Mastra pattern)
- ✅ **Maintains browser compatibility** (no Node.js deps)
- ✅ **Provides powerful orchestration** (parallel, conditional, loops)
- ✅ **Integrates with existing SDK** (agents, tools, providers)

**Estimated Effort:** 3-4 weeks for MVP, 1-2 weeks for polish

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation (types & step creation)
3. Iterate based on feedback and testing

---

**Document Status:** DRAFT - Awaiting Approval
**Last Updated:** 2025-01-11
**Author:** Claude (Browser Operator SDK Implementation)
