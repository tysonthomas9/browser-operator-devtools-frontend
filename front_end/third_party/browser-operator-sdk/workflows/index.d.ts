import { z } from 'zod';
import { R as RuntimeContext } from '../utils-CPLTWdHl.js';

/**
 * Workflow types following Mastra pattern
 * Browser-compatible workflow orchestration
 */

/**
 * Context passed to step execute function
 */
interface StepExecutionContext<TInput, TState = unknown> {
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
 * Workflow step configuration
 */
interface StepConfig<TInput = unknown, TOutput = unknown, TState = unknown, TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>, TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>, TStateSchema extends z.ZodType<TState> = z.ZodType<TState>> {
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
 * Workflow step interface
 */
interface WorkflowStep<TInput = unknown, TOutput = unknown, TState = unknown> {
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
interface StepResult<TOutput = unknown> {
    stepId: string;
    status: 'success' | 'failed' | 'skipped';
    output?: TOutput;
    error?: Error;
    startTime: number;
    endTime: number;
    duration: number;
}
/**
 * Workflow configuration
 */
interface WorkflowConfig<TInput = unknown, TOutput = unknown, TState = unknown> {
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
 * Condition function for branching
 */
type Condition = (context: StepExecutionContext<any, any>) => Promise<boolean> | boolean;
/**
 * Map function for data transformation
 */
type MapFunction = (context: StepExecutionContext<any, any>) => Promise<any> | any;
/**
 * Options for foreach iteration
 */
interface ForeachOptions {
    /**
     * Maximum concurrent executions
     */
    concurrency?: number;
    /**
     * Maximum number of iterations
     */
    iterationCount?: number;
}
/**
 * Workflow execution node (internal representation)
 */
type WorkflowNode = {
    type: 'step';
    step: WorkflowStep<any, any, any>;
} | {
    type: 'parallel';
    steps: WorkflowStep<any, any, any>[];
} | {
    type: 'branch';
    branches: Array<[Condition, WorkflowStep<any, any, any>]>;
} | {
    type: 'map';
    mapper: MapFunction;
} | {
    type: 'foreach';
    step: WorkflowStep<any, any, any>;
    options?: ForeachOptions;
} | {
    type: 'dowhile';
    condition: Condition;
    step: WorkflowStep<any, any, any>;
    maxIterations?: number;
} | {
    type: 'dountil';
    condition: Condition;
    step: WorkflowStep<any, any, any>;
    maxIterations?: number;
};
/**
 * Workflow execution status
 */
type WorkflowStatus = 'pending' | 'running' | 'suspended' | 'success' | 'failed';
/**
 * Workflow execution result
 */
interface WorkflowResult<TOutput = unknown> {
    workflowId: string;
    status: WorkflowStatus;
    output?: TOutput;
    error?: Error;
    steps: StepResult[];
    startTime: number;
    endTime?: number;
    duration?: number;
}
/**
 * Workflow execution options
 */
interface WorkflowExecutionOptions {
    /**
     * Initial state values
     */
    initialState?: Record<string, unknown>;
    /**
     * Runtime context for request-specific values
     */
    runtimeContext?: RuntimeContext;
    /**
     * Abort signal for cancellation
     */
    abortSignal?: AbortSignal;
    /**
     * Timeout in milliseconds
     */
    timeout?: number;
    /**
     * Resume from a previous checkpoint
     */
    resumeFromCheckpoint?: unknown;
    /**
     * Automatically save checkpoints after each step
     */
    autoCheckpoint?: boolean;
}
/**
 * Workflow event types for streaming
 */
type WorkflowEvent = {
    type: 'workflow:start';
    workflowId: string;
    timestamp: number;
} | {
    type: 'workflow:complete';
    workflowId: string;
    output: unknown;
    timestamp: number;
} | {
    type: 'workflow:error';
    workflowId: string;
    error: Error;
    timestamp: number;
} | {
    type: 'step:start';
    stepId: string;
    timestamp: number;
} | {
    type: 'step:complete';
    stepId: string;
    output: unknown;
    duration: number;
    timestamp: number;
} | {
    type: 'step:error';
    stepId: string;
    error: Error;
    duration: number;
    timestamp: number;
} | {
    type: 'step:skip';
    stepId: string;
    reason: string;
    timestamp: number;
};

/**
 * Create workflow steps following Mastra pattern
 */

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
declare function createStep<TInput, TOutput, TState = unknown>(config: StepConfig<TInput, TOutput, TState>): WorkflowStep<TInput, TOutput, TState>;

/**
 * Workflow persistence system for suspend/resume functionality
 *
 * Enables workflows to save their state and resume execution later,
 * supporting long-running workflows and human-in-the-loop patterns.
 */
/**
 * Workflow checkpoint for suspend/resume
 *
 * Contains all state needed to resume a workflow from a specific point
 */
interface WorkflowCheckpoint<TState = unknown> {
    /**
     * Unique workflow execution ID
     */
    workflowId: string;
    /**
     * Index of the current node being executed
     */
    nodeIndex: number;
    /**
     * Current workflow state
     */
    state: TState;
    /**
     * Results from completed steps (keyed by step ID)
     */
    stepResults: Record<string, unknown>;
    /**
     * Initial workflow input
     */
    initialInput: unknown;
    /**
     * Timestamp when checkpoint was created
     */
    timestamp: number;
    /**
     * Optional metadata for debugging/tracking
     */
    metadata?: Record<string, unknown>;
}
/**
 * Storage adapter interface for workflow persistence
 *
 * Implementations can use different storage backends:
 * - InMemory (for development/testing)
 * - IndexedDB (for browser persistence)
 * - LocalStorage (for simple browser storage)
 * - External APIs (for server-side persistence)
 */
interface WorkflowStorage {
    /**
     * Save a workflow checkpoint
     */
    save(checkpoint: WorkflowCheckpoint): Promise<void>;
    /**
     * Load a workflow checkpoint by ID
     */
    load(workflowId: string): Promise<WorkflowCheckpoint | null>;
    /**
     * Delete a workflow checkpoint
     */
    delete(workflowId: string): Promise<void>;
    /**
     * List all checkpoint IDs (optional)
     */
    list?(): Promise<string[]>;
}
/**
 * In-memory storage adapter (default)
 *
 * Stores checkpoints in memory. Data is lost when page reloads.
 * Suitable for development, testing, and short-lived workflows.
 *
 * @example
 * ```typescript
 * const storage = new InMemoryWorkflowStorage();
 * await storage.save(checkpoint);
 * const loaded = await storage.load(workflowId);
 * ```
 */
declare class InMemoryWorkflowStorage implements WorkflowStorage {
    private checkpoints;
    save(checkpoint: WorkflowCheckpoint): Promise<void>;
    load(workflowId: string): Promise<WorkflowCheckpoint | null>;
    delete(workflowId: string): Promise<void>;
    list(): Promise<string[]>;
    /**
     * Clear all checkpoints (useful for testing)
     */
    clear(): void;
}
/**
 * IndexedDB storage adapter for browser persistence
 *
 * Stores checkpoints in IndexedDB for persistence across page reloads.
 * Suitable for production use in browser environments.
 *
 * @example
 * ```typescript
 * const storage = new IndexedDBWorkflowStorage('my-app-workflows');
 * await storage.save(checkpoint);
 * const loaded = await storage.load(workflowId);
 * ```
 */
declare class IndexedDBWorkflowStorage implements WorkflowStorage {
    private dbName;
    private storeName;
    private version;
    private dbPromise;
    constructor(dbName?: string);
    /**
     * Initialize IndexedDB connection
     */
    private getDB;
    save(checkpoint: WorkflowCheckpoint): Promise<void>;
    load(workflowId: string): Promise<WorkflowCheckpoint | null>;
    delete(workflowId: string): Promise<void>;
    list(): Promise<string[]>;
    /**
     * Clear all checkpoints (useful for cleanup/testing)
     */
    clear(): Promise<void>;
    /**
     * Close database connection
     */
    close(): void;
}
/**
 * LocalStorage adapter for simple browser persistence
 *
 * Stores checkpoints in localStorage. Limited to ~5-10MB per domain.
 * Suitable for simple workflows with small state.
 *
 * @example
 * ```typescript
 * const storage = new LocalStorageWorkflowStorage('my-app');
 * await storage.save(checkpoint);
 * const loaded = await storage.load(workflowId);
 * ```
 */
declare class LocalStorageWorkflowStorage implements WorkflowStorage {
    private prefix;
    constructor(prefix?: string);
    private getKey;
    save(checkpoint: WorkflowCheckpoint): Promise<void>;
    load(workflowId: string): Promise<WorkflowCheckpoint | null>;
    delete(workflowId: string): Promise<void>;
    list(): Promise<string[]>;
    /**
     * Clear all workflow checkpoints
     */
    clear(): Promise<void>;
}

/**
 * Workflow builder with chainable API following Mastra pattern
 */

/**
 * Compiled workflow ready for execution
 */
declare class CompiledWorkflow<TInput, TOutput, TState> {
    readonly config: WorkflowConfig<TInput, TOutput, TState>;
    readonly nodes: WorkflowNode[];
    private storage?;
    constructor(config: WorkflowConfig<TInput, TOutput, TState>, nodes: WorkflowNode[], storage?: WorkflowStorage);
    /**
     * Execute workflow and wait for completion
     *
     * @example
     * ```typescript
     * const result = await workflow.start({ message: 'hello' });
     * console.log(result.output); // Final workflow output
     * console.log(result.steps);  // All step results
     * ```
     */
    start(input: TInput, options?: WorkflowExecutionOptions): Promise<WorkflowResult<TOutput>>;
    /**
     * Execute workflow with streaming updates
     *
     * @example
     * ```typescript
     * for await (const event of workflow.stream({ message: 'hello' })) {
     *   if (event.type === 'step:complete') {
     *     console.log('Step completed:', event.stepId, event.output);
     *   }
     * }
     * ```
     */
    stream(input: TInput, options?: WorkflowExecutionOptions): AsyncIterable<WorkflowEvent>;
    /**
     * Resume workflow from a checkpoint
     *
     * @example
     * ```typescript
     * const checkpoint = await storage.load(workflowId);
     * const result = await workflow.resume(checkpoint);
     * ```
     */
    resume(checkpoint: WorkflowCheckpoint<TState>): Promise<WorkflowResult<TOutput>>;
    /**
     * Resume workflow from storage by workflow ID
     *
     * @example
     * ```typescript
     * const result = await workflow.resumeById('workflow-123');
     * ```
     */
    resumeById(workflowId: string): Promise<WorkflowResult<TOutput>>;
    /**
     * Get workflow configuration
     */
    getConfig(): WorkflowConfig<TInput, TOutput, TState>;
    /**
     * Get workflow nodes
     */
    getNodes(): WorkflowNode[];
    /**
     * Get the storage adapter (if configured)
     */
    getStorage(): WorkflowStorage | undefined;
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
declare class WorkflowBuilder<TInput, TOutput, TState> {
    private config;
    private nodes;
    private committed;
    private storage?;
    constructor(config: WorkflowConfig<TInput, TOutput, TState>);
    /**
     * Configure storage for workflow persistence
     *
     * @example
     * ```typescript
     * import { IndexedDBWorkflowStorage } from '@browser-operator/core/workflows';
     *
     * const storage = new IndexedDBWorkflowStorage();
     * const workflow = createWorkflow({ ... })
     *   .withStorage(storage)
     *   .then(step1)
     *   .commit();
     * ```
     */
    withStorage(storage: WorkflowStorage): WorkflowBuilder<TInput, TOutput, TState>;
    /**
     * Add a step to execute sequentially
     *
     * @example
     * ```typescript
     * .then(formatStep)
     * .then(validateStep)
     * ```
     */
    then<TStepOutput>(step: WorkflowStep<any, TStepOutput, TState>): WorkflowBuilder<TInput, TStepOutput, TState>;
    /**
     * Execute multiple steps in parallel
     *
     * @example
     * ```typescript
     * .parallel([fetchUser, fetchPosts, fetchComments])
     * ```
     */
    parallel(steps: WorkflowStep<any, any, TState>[]): WorkflowBuilder<TInput, TOutput, TState>;
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
    branch(branches: Array<[Condition, WorkflowStep<any, any, TState>]>): WorkflowBuilder<TInput, TOutput, TState>;
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
    map(mapper: MapFunction): WorkflowBuilder<TInput, TOutput, TState>;
    /**
     * Iterate over array items
     *
     * @example
     * ```typescript
     * .foreach(processItem, { concurrency: 4, iterationCount: 100 })
     * ```
     */
    foreach(step: WorkflowStep<any, any, TState>, options?: ForeachOptions): WorkflowBuilder<TInput, TOutput, TState>;
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
    dowhile(condition: Condition, step: WorkflowStep<any, any, TState>, maxIterations?: number): WorkflowBuilder<TInput, TOutput, TState>;
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
    dountil(condition: Condition, step: WorkflowStep<any, any, TState>, maxIterations?: number): WorkflowBuilder<TInput, TOutput, TState>;
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
    commit(): CompiledWorkflow<TInput, TOutput, TState>;
    /**
     * Ensure workflow hasn't been committed yet
     */
    private ensureNotCommitted;
}

/**
 * Create workflows following Mastra pattern
 */

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
declare function createWorkflow<TInput, TOutput, TState = Record<string, unknown>>(config: WorkflowConfig<TInput, TOutput, TState>): WorkflowBuilder<TInput, TOutput, TState>;

export { CompiledWorkflow, type Condition, type ForeachOptions, InMemoryWorkflowStorage, IndexedDBWorkflowStorage, LocalStorageWorkflowStorage, type MapFunction, type StepConfig, type StepExecutionContext, type StepResult, WorkflowBuilder, type WorkflowCheckpoint, type WorkflowConfig, type WorkflowEvent, type WorkflowExecutionOptions, type WorkflowNode, type WorkflowResult, type WorkflowStatus, type WorkflowStep, type WorkflowStorage, createStep, createWorkflow };
