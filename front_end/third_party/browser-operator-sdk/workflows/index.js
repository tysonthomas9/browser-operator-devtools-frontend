// src/workflows/createStep.ts
function createStep(config) {
  return {
    id: config.id,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    stateSchema: config.stateSchema,
    execute: config.execute,
    metadata: config.metadata
  };
}

// src/workflows/WorkflowExecutor.ts
var WorkflowExecutor = class {
  config;
  nodes;
  state = {};
  stepResults = /* @__PURE__ */ new Map();
  initialInput;
  runtimeContext;
  storage;
  currentNodeIndex = 0;
  constructor(config, nodes, storage) {
    this.config = config;
    this.nodes = nodes;
    this.storage = storage;
  }
  /**
   * Execute workflow and wait for completion
   */
  async execute(input, options) {
    this.initialInput = input;
    this.runtimeContext = options?.runtimeContext;
    const startTime = Date.now();
    const stepResults = [];
    try {
      if (options?.resumeFromCheckpoint) {
        return await this.resumeFromCheckpoint(options.resumeFromCheckpoint);
      }
      const validatedInput = this.config.inputSchema.parse(input);
      if (options?.initialState) {
        this.state = { ...options.initialState };
      }
      let currentData = validatedInput;
      for (let i = 0; i < this.nodes.length; i++) {
        this.currentNodeIndex = i;
        const node = this.nodes[i];
        const result = await this.executeNode(node, currentData, options);
        stepResults.push(...result.steps);
        currentData = result.output;
        if (this.storage && options?.autoCheckpoint) {
          await this.saveCheckpoint(currentData);
        }
      }
      const validatedOutput = this.config.outputSchema.parse(currentData);
      return {
        workflowId: this.config.id,
        status: "success",
        output: validatedOutput,
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        workflowId: this.config.id,
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }
  /**
   * Execute workflow with streaming
   */
  async *stream(input, options) {
    this.initialInput = input;
    this.runtimeContext = options?.runtimeContext;
    yield {
      type: "workflow:start",
      workflowId: this.config.id,
      timestamp: Date.now()
    };
    try {
      const validatedInput = this.config.inputSchema.parse(input);
      if (options?.initialState) {
        this.state = { ...options.initialState };
      }
      let currentData = validatedInput;
      for (const node of this.nodes) {
        for await (const event of this.streamNode(node, currentData, options)) {
          yield event;
        }
        const result = await this.executeNode(node, currentData, options);
        currentData = result.output;
      }
      const validatedOutput = this.config.outputSchema.parse(currentData);
      yield {
        type: "workflow:complete",
        workflowId: this.config.id,
        output: validatedOutput,
        timestamp: Date.now()
      };
    } catch (error) {
      yield {
        type: "workflow:error",
        workflowId: this.config.id,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      };
    }
  }
  /**
   * Execute a single node
   */
  async executeNode(node, input, options) {
    switch (node.type) {
      case "step":
        return this.executeStep(node.step, input, options);
      case "parallel":
        return this.executeParallel(node.steps, input, options);
      case "branch":
        return this.executeBranch(node.branches, input, options);
      case "map":
        return this.executeMap(node.mapper, input, options);
      case "foreach":
        return this.executeForeach(node.step, input, node.options, options);
      case "dowhile":
        return this.executeDoWhile(node.condition, node.step, input, node.maxIterations, options);
      case "dountil":
        return this.executeDoUntil(node.condition, node.step, input, node.maxIterations, options);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }
  /**
   * Execute a single step
   */
  async executeStep(step, input, options) {
    const startTime = Date.now();
    try {
      const validatedInput = step.inputSchema.parse(input);
      const context = {
        inputData: validatedInput,
        state: this.state,
        setState: (key, value) => {
          this.state[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput
      };
      const output = await step.execute(context);
      const validatedOutput = step.outputSchema.parse(output);
      this.stepResults.set(step.id, validatedOutput);
      const stepResult = {
        stepId: step.id,
        status: "success",
        output: validatedOutput,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
      return { output: validatedOutput, steps: [stepResult] };
    } catch (error) {
      ({
        stepId: step.id});
      throw error;
    }
  }
  /**
   * Execute steps in parallel
   */
  async executeParallel(steps, input, options) {
    const promises = steps.map((step) => this.executeStep(step, input, options));
    const results = await Promise.all(promises);
    const output = Object.fromEntries(
      results.map((result, index) => [steps[index].id, result.output])
    );
    const allStepResults = results.flatMap((r) => r.steps);
    return { output, steps: allStepResults };
  }
  /**
   * Execute conditional branch
   */
  async executeBranch(branches, input, options) {
    const context = {
      inputData: input,
      state: this.state,
      setState: (key, value) => {
        this.state[key] = value;
      },
      runtimeContext: this.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: (stepId) => this.stepResults.get(stepId),
      getInitData: () => this.initialInput
    };
    for (const [condition, step] of branches) {
      const matches = await condition(context);
      if (matches) {
        return this.executeStep(step, input, options);
      }
    }
    return { output: input, steps: [] };
  }
  /**
   * Execute map transformation
   */
  async executeMap(mapper, input, options) {
    const context = {
      inputData: input,
      state: this.state,
      setState: (key, value) => {
        this.state[key] = value;
      },
      runtimeContext: this.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: (stepId) => this.stepResults.get(stepId),
      getInitData: () => this.initialInput
    };
    const output = await mapper(context);
    return { output, steps: [] };
  }
  /**
   * Execute foreach loop
   */
  async executeForeach(step, input, foreachOptions, execOptions) {
    if (!Array.isArray(input)) {
      throw new Error("foreach requires array input");
    }
    const concurrency = foreachOptions?.concurrency || input.length;
    const maxIterations = foreachOptions?.iterationCount || input.length;
    const itemsToProcess = input.slice(0, maxIterations);
    const results = [];
    const allSteps = [];
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
  async executeDoWhile(condition, step, input, maxIterations = 100, options) {
    let currentData = input;
    const allSteps = [];
    let iteration = 0;
    do {
      if (iteration >= maxIterations) {
        throw new Error(`dowhile loop exceeded max iterations (${maxIterations})`);
      }
      const result = await this.executeStep(step, currentData, options);
      allSteps.push(...result.steps);
      currentData = result.output;
      iteration++;
      const context = {
        inputData: currentData,
        state: this.state,
        setState: (key, value) => {
          this.state[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput
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
  async executeDoUntil(condition, step, input, maxIterations = 100, options) {
    let currentData = input;
    const allSteps = [];
    let iteration = 0;
    do {
      if (iteration >= maxIterations) {
        throw new Error(`dountil loop exceeded max iterations (${maxIterations})`);
      }
      const result = await this.executeStep(step, currentData, options);
      allSteps.push(...result.steps);
      currentData = result.output;
      iteration++;
      const context = {
        inputData: currentData,
        state: this.state,
        setState: (key, value) => {
          this.state[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput
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
  async *streamNode(node, input, options) {
    if (node.type === "step") {
      yield { type: "step:start", stepId: node.step.id, timestamp: Date.now() };
      try {
        const startTime = Date.now();
        const result = await this.executeStep(node.step, input, options);
        yield {
          type: "step:complete",
          stepId: node.step.id,
          output: result.output,
          duration: Date.now() - startTime,
          timestamp: Date.now()
        };
      } catch (error) {
        yield {
          type: "step:error",
          stepId: node.step.id,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - Date.now(),
          timestamp: Date.now()
        };
      }
    } else if (node.type === "parallel") {
      for (const step of node.steps) {
        yield { type: "step:start", stepId: step.id, timestamp: Date.now() };
      }
    }
  }
  /**
   * Create a checkpoint of the current workflow state
   */
  async saveCheckpoint(currentData) {
    if (!this.storage) {
      throw new Error("Storage not configured for checkpointing");
    }
    const checkpoint = {
      workflowId: this.config.id,
      nodeIndex: this.currentNodeIndex,
      state: this.state,
      stepResults: Object.fromEntries(this.stepResults),
      initialInput: this.initialInput,
      timestamp: Date.now()
    };
    await this.storage.save(checkpoint);
  }
  /**
   * Resume workflow execution from a checkpoint
   */
  async resumeFromCheckpoint(checkpoint) {
    const startTime = Date.now();
    const stepResults = [];
    try {
      this.state = checkpoint.state;
      this.initialInput = checkpoint.initialInput;
      this.stepResults = new Map(Object.entries(checkpoint.stepResults));
      this.currentNodeIndex = checkpoint.nodeIndex;
      let currentData = checkpoint.stepResults[Object.keys(checkpoint.stepResults).pop() || ""];
      for (let i = checkpoint.nodeIndex; i < this.nodes.length; i++) {
        this.currentNodeIndex = i;
        const node = this.nodes[i];
        const result = await this.executeNode(node, currentData, void 0);
        stepResults.push(...result.steps);
        currentData = result.output;
        if (this.storage) {
          await this.saveCheckpoint(currentData);
        }
      }
      const validatedOutput = this.config.outputSchema.parse(currentData);
      return {
        workflowId: this.config.id,
        status: "success",
        output: validatedOutput,
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        workflowId: this.config.id,
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }
  /**
   * Suspend the workflow and save its current state
   *
   * @returns The checkpoint that can be used to resume later
   */
  async suspend() {
    if (!this.storage) {
      throw new Error("Storage not configured for suspending");
    }
    const checkpoint = {
      workflowId: this.config.id,
      nodeIndex: this.currentNodeIndex,
      state: this.state,
      stepResults: Object.fromEntries(this.stepResults),
      initialInput: this.initialInput,
      timestamp: Date.now()
    };
    await this.storage.save(checkpoint);
    return checkpoint;
  }
  /**
   * Load a checkpoint from storage
   */
  async loadCheckpoint(workflowId) {
    if (!this.storage) {
      throw new Error("Storage not configured");
    }
    return await this.storage.load(workflowId);
  }
};

// src/workflows/WorkflowBuilder.ts
var CompiledWorkflow = class {
  constructor(config, nodes, storage) {
    this.config = config;
    this.nodes = nodes;
    this.storage = storage;
  }
  storage;
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
  async start(input, options) {
    const executor = new WorkflowExecutor(this.config, this.nodes, this.storage);
    return executor.execute(input, options);
  }
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
  async *stream(input, options) {
    const executor = new WorkflowExecutor(this.config, this.nodes, this.storage);
    yield* executor.stream(input, options);
  }
  /**
   * Resume workflow from a checkpoint
   *
   * @example
   * ```typescript
   * const checkpoint = await storage.load(workflowId);
   * const result = await workflow.resume(checkpoint);
   * ```
   */
  async resume(checkpoint) {
    if (!this.storage) {
      throw new Error("Storage not configured for resuming workflows");
    }
    const executor = new WorkflowExecutor(this.config, this.nodes, this.storage);
    return executor.execute({}, { resumeFromCheckpoint: checkpoint });
  }
  /**
   * Resume workflow from storage by workflow ID
   *
   * @example
   * ```typescript
   * const result = await workflow.resumeById('workflow-123');
   * ```
   */
  async resumeById(workflowId) {
    if (!this.storage) {
      throw new Error("Storage not configured for resuming workflows");
    }
    const checkpoint = await this.storage.load(workflowId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for workflow ID: ${workflowId}`);
    }
    return this.resume(checkpoint);
  }
  /**
   * Get workflow configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Get workflow nodes
   */
  getNodes() {
    return [...this.nodes];
  }
  /**
   * Get the storage adapter (if configured)
   */
  getStorage() {
    return this.storage;
  }
};
var WorkflowBuilder = class {
  config;
  nodes = [];
  committed = false;
  storage;
  constructor(config) {
    this.config = config;
  }
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
  withStorage(storage) {
    this.ensureNotCommitted();
    this.storage = storage;
    return this;
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
  then(step) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "step", step });
    return this;
  }
  /**
   * Execute multiple steps in parallel
   *
   * @example
   * ```typescript
   * .parallel([fetchUser, fetchPosts, fetchComments])
   * ```
   */
  parallel(steps) {
    this.ensureNotCommitted();
    if (steps.length === 0) {
      throw new Error("parallel() requires at least one step");
    }
    this.nodes.push({ type: "parallel", steps });
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
  branch(branches) {
    this.ensureNotCommitted();
    if (branches.length === 0) {
      throw new Error("branch() requires at least one branch");
    }
    this.nodes.push({ type: "branch", branches });
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
  map(mapper) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "map", mapper });
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
  foreach(step, options) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "foreach", step, options });
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
  dowhile(condition, step, maxIterations = 100) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "dowhile", condition, step, maxIterations });
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
  dountil(condition, step, maxIterations = 100) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "dountil", condition, step, maxIterations });
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
  commit() {
    this.committed = true;
    return new CompiledWorkflow(this.config, this.nodes, this.storage);
  }
  /**
   * Ensure workflow hasn't been committed yet
   */
  ensureNotCommitted() {
    if (this.committed) {
      throw new Error(
        "Cannot modify committed workflow. Create a new workflow builder instead."
      );
    }
  }
};

// src/workflows/createWorkflow.ts
function createWorkflow(config) {
  return new WorkflowBuilder(config);
}

// src/workflows/persistence.ts
var InMemoryWorkflowStorage = class {
  checkpoints = /* @__PURE__ */ new Map();
  async save(checkpoint) {
    this.checkpoints.set(checkpoint.workflowId, checkpoint);
  }
  async load(workflowId) {
    return this.checkpoints.get(workflowId) || null;
  }
  async delete(workflowId) {
    this.checkpoints.delete(workflowId);
  }
  async list() {
    return Array.from(this.checkpoints.keys());
  }
  /**
   * Clear all checkpoints (useful for testing)
   */
  clear() {
    this.checkpoints.clear();
  }
};
var IndexedDBWorkflowStorage = class {
  dbName;
  storeName = "workflow_checkpoints";
  version = 1;
  dbPromise = null;
  constructor(dbName = "browser-operator-workflows") {
    this.dbName = dbName;
  }
  /**
   * Initialize IndexedDB connection
   */
  async getDB() {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: "workflowId"
          });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
    return this.dbPromise;
  }
  async save(checkpoint) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(checkpoint);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save checkpoint: ${request.error?.message}`));
    });
  }
  async load(workflowId) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(workflowId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to load checkpoint: ${request.error?.message}`));
    });
  }
  async delete(workflowId) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(workflowId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete checkpoint: ${request.error?.message}`));
    });
  }
  async list() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to list checkpoints: ${request.error?.message}`));
    });
  }
  /**
   * Clear all checkpoints (useful for cleanup/testing)
   */
  async clear() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear checkpoints: ${request.error?.message}`));
    });
  }
  /**
   * Close database connection
   */
  close() {
    if (this.dbPromise) {
      this.dbPromise.then((db) => db.close());
      this.dbPromise = null;
    }
  }
};
var LocalStorageWorkflowStorage = class {
  prefix;
  constructor(prefix = "workflow_") {
    this.prefix = prefix;
  }
  getKey(workflowId) {
    return `${this.prefix}${workflowId}`;
  }
  async save(checkpoint) {
    try {
      const key = this.getKey(checkpoint.workflowId);
      const serialized = JSON.stringify(checkpoint);
      localStorage.setItem(key, serialized);
    } catch (error) {
      throw new Error(
        `Failed to save checkpoint to localStorage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async load(workflowId) {
    try {
      const key = this.getKey(workflowId);
      const serialized = localStorage.getItem(key);
      if (!serialized) {
        return null;
      }
      return JSON.parse(serialized);
    } catch (error) {
      throw new Error(
        `Failed to load checkpoint from localStorage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async delete(workflowId) {
    const key = this.getKey(workflowId);
    localStorage.removeItem(key);
  }
  async list() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }
    return keys;
  }
  /**
   * Clear all workflow checkpoints
   */
  async clear() {
    const keys = await this.list();
    for (const workflowId of keys) {
      await this.delete(workflowId);
    }
  }
};

export { CompiledWorkflow, InMemoryWorkflowStorage, IndexedDBWorkflowStorage, LocalStorageWorkflowStorage, WorkflowBuilder, createStep, createWorkflow };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map