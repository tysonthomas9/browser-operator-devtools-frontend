/**
 * Comprehensive Workflow Examples
 *
 * Demonstrates all workflow patterns available in Browser Operator SDK:
 * - Sequential execution (.then)
 * - Parallel execution (.parallel)
 * - Conditional branching (.branch)
 * - Data transformation (.map)
 * - Array iteration (.foreach)
 * - Loops (.dowhile, .dountil)
 * - Persistence (suspend/resume)
 * - Streaming execution
 */

import {
  createStep,
  createWorkflow,
  IndexedDBWorkflowStorage,
  type WorkflowCheckpoint,
} from '@browser-operator/core/workflows';
import { z } from 'zod';

// ============================================================================
// Example 1: Basic Sequential Workflow
// ============================================================================

const formatStep = createStep({
  id: 'format',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  execute: async ({ inputData }) => {
    return { formatted: inputData.message.toUpperCase() };
  },
});

const prefixStep = createStep({
  id: 'prefix',
  inputSchema: z.object({ formatted: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `PREFIX: ${inputData.formatted}` };
  },
});

const basicWorkflow = createWorkflow({
  id: 'basic-workflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(formatStep)
  .then(prefixStep)
  .commit();

// Usage:
// const result = await basicWorkflow.start({ message: 'hello world' });
// console.log(result.output.result); // "PREFIX: HELLO WORLD"

// ============================================================================
// Example 2: Parallel Execution
// ============================================================================

const fetchUserStep = createStep({
  id: 'fetch-user',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ name: z.string(), email: z.string() }),
  execute: async ({ inputData }) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      name: `User ${inputData.userId}`,
      email: `user${inputData.userId}@example.com`,
    };
  },
});

const fetchPostsStep = createStep({
  id: 'fetch-posts',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ posts: z.array(z.string()) }),
  execute: async ({ inputData }) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      posts: [`Post 1 by ${inputData.userId}`, `Post 2 by ${inputData.userId}`],
    };
  },
});

const combineResultsStep = createStep({
  id: 'combine-results',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ combined: z.any() }),
  execute: async ({ inputData, getStepResult }) => {
    const user = getStepResult('fetch-user');
    const posts = getStepResult('fetch-posts');
    return { combined: { user, posts } };
  },
});

const parallelWorkflow = createWorkflow({
  id: 'parallel-workflow',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ combined: z.any() }),
})
  .parallel([fetchUserStep, fetchPostsStep])
  .then(combineResultsStep)
  .commit();

// Usage:
// const result = await parallelWorkflow.start({ userId: '123' });
// console.log(result.output.combined);
// {
//   user: { name: 'User 123', email: 'user123@example.com' },
//   posts: { posts: ['Post 1 by 123', 'Post 2 by 123'] }
// }

// ============================================================================
// Example 3: Conditional Branching
// ============================================================================

const checkValueStep = createStep({
  id: 'check-value',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ inputData }) => inputData,
});

const processHighStep = createStep({
  id: 'process-high',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string(), category: z.string() }),
  execute: async ({ inputData }) => {
    return {
      result: `High value: ${inputData.value * 2}`,
      category: 'high',
    };
  },
});

const processLowStep = createStep({
  id: 'process-low',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string(), category: z.string() }),
  execute: async ({ inputData }) => {
    return {
      result: `Low value: ${inputData.value + 10}`,
      category: 'low',
    };
  },
});

const branchingWorkflow = createWorkflow({
  id: 'branching-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string(), category: z.string() }),
})
  .then(checkValueStep)
  .branch([
    [async ({ inputData }) => inputData.value > 100, processHighStep],
    [async ({ inputData }) => inputData.value <= 100, processLowStep],
  ])
  .commit();

// Usage:
// const highResult = await branchingWorkflow.start({ value: 150 });
// console.log(highResult.output); // { result: 'High value: 300', category: 'high' }
//
// const lowResult = await branchingWorkflow.start({ value: 50 });
// console.log(lowResult.output); // { result: 'Low value: 60', category: 'low' }

// ============================================================================
// Example 4: Data Transformation with .map()
// ============================================================================

const initialStep = createStep({
  id: 'initial',
  inputSchema: z.object({ items: z.array(z.number()) }),
  outputSchema: z.object({ items: z.array(z.number()) }),
  execute: async ({ inputData }) => inputData,
});

const processItemsStep = createStep({
  id: 'process-items',
  inputSchema: z.object({ transformedItems: z.array(z.number()) }),
  outputSchema: z.object({ result: z.number() }),
  execute: async ({ inputData }) => {
    const sum = inputData.transformedItems.reduce((acc, n) => acc + n, 0);
    return { result: sum };
  },
});

const transformationWorkflow = createWorkflow({
  id: 'transformation-workflow',
  inputSchema: z.object({ items: z.array(z.number()) }),
  outputSchema: z.object({ result: z.number() }),
})
  .then(initialStep)
  .map(async ({ inputData }) => {
    // Transform the data structure between steps
    return {
      transformedItems: inputData.items.map((n: number) => n * 2),
    };
  })
  .then(processItemsStep)
  .commit();

// Usage:
// const result = await transformationWorkflow.start({ items: [1, 2, 3, 4, 5] });
// console.log(result.output.result); // 30 (sum of [2, 4, 6, 8, 10])

// ============================================================================
// Example 5: Array Iteration with .foreach()
// ============================================================================

const processUserStep = createStep({
  id: 'process-user',
  inputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    processed: z.boolean(),
    notificationSent: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    // Simulate processing each user
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      id: inputData.id,
      processed: true,
      notificationSent: true,
    };
  },
});

const summarizeResultsStep = createStep({
  id: 'summarize',
  inputSchema: z.array(
    z.object({
      id: z.string(),
      processed: z.boolean(),
      notificationSent: z.boolean(),
    })
  ),
  outputSchema: z.object({
    totalProcessed: z.number(),
    totalNotified: z.number(),
  }),
  execute: async ({ inputData }) => {
    return {
      totalProcessed: inputData.filter((r) => r.processed).length,
      totalNotified: inputData.filter((r) => r.notificationSent).length,
    };
  },
});

const foreachWorkflow = createWorkflow({
  id: 'foreach-workflow',
  inputSchema: z.object({
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    totalProcessed: z.number(),
    totalNotified: z.number(),
  }),
})
  .map(async ({ inputData }) => inputData.users)
  .foreach(processUserStep, { concurrency: 3 })
  .then(summarizeResultsStep)
  .commit();

// Usage:
// const users = [
//   { id: '1', name: 'Alice', email: 'alice@example.com' },
//   { id: '2', name: 'Bob', email: 'bob@example.com' },
//   { id: '3', name: 'Charlie', email: 'charlie@example.com' },
// ];
// const result = await foreachWorkflow.start({ users });
// console.log(result.output); // { totalProcessed: 3, totalNotified: 3 }

// ============================================================================
// Example 6: Loop Patterns (dowhile, dountil)
// ============================================================================

// 6a. dowhile loop
const incrementStep = createStep({
  id: 'increment',
  inputSchema: z.object({ counter: z.number() }),
  outputSchema: z.object({ counter: z.number() }),
  execute: async ({ inputData, state, setState }) => {
    const newCounter = inputData.counter + 1;
    setState('counter' as any, newCounter);
    return { counter: newCounter };
  },
});

const dowhileWorkflow = createWorkflow({
  id: 'dowhile-workflow',
  inputSchema: z.object({ counter: z.number() }),
  outputSchema: z.object({ counter: z.number() }),
  stateSchema: z.object({ counter: z.number() }),
})
  .dowhile(
    async ({ state }) => (state as any).counter < 10,
    incrementStep,
    20 // max iterations
  )
  .commit();

// Usage:
// const result = await dowhileWorkflow.start({ counter: 0 });
// console.log(result.output.counter); // 10

// 6b. dountil loop
const checkCompletedStep = createStep({
  id: 'check-completed',
  inputSchema: z.object({ taskId: z.string(), attempts: z.number() }),
  outputSchema: z.object({ taskId: z.string(), attempts: z.number(), completed: z.boolean() }),
  execute: async ({ inputData, state, setState }) => {
    const attempts = inputData.attempts + 1;
    setState('attempts' as any, attempts);

    // Simulate checking if task is complete
    const completed = attempts >= 5;

    return {
      taskId: inputData.taskId,
      attempts,
      completed,
    };
  },
});

const dountilWorkflow = createWorkflow({
  id: 'dountil-workflow',
  inputSchema: z.object({ taskId: z.string(), attempts: z.number() }),
  outputSchema: z.object({ taskId: z.string(), attempts: z.number(), completed: z.boolean() }),
  stateSchema: z.object({ attempts: z.number(), completed: z.boolean() }),
})
  .dountil(
    async ({ state }) => (state as any).completed === true,
    checkCompletedStep,
    10 // max iterations
  )
  .commit();

// Usage:
// const result = await dountilWorkflow.start({ taskId: 'task-123', attempts: 0 });
// console.log(result.output); // { taskId: 'task-123', attempts: 5, completed: true }

// ============================================================================
// Example 7: Workflow with Persistence (Suspend/Resume)
// ============================================================================

const longRunningStep1 = createStep({
  id: 'long-step-1',
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ result1: z.string() }),
  execute: async ({ inputData }) => {
    // Simulate long operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { result1: `Processed: ${inputData.data}` };
  },
});

const longRunningStep2 = createStep({
  id: 'long-step-2',
  inputSchema: z.object({ result1: z.string() }),
  outputSchema: z.object({ result2: z.string() }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { result2: `${inputData.result1} + Step 2` };
  },
});

const longRunningStep3 = createStep({
  id: 'long-step-3',
  inputSchema: z.object({ result2: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { final: `${inputData.result2} + Step 3` };
  },
});

// Create workflow with persistence
const storage = new IndexedDBWorkflowStorage('workflow-examples');

const persistentWorkflow = createWorkflow({
  id: 'persistent-workflow',
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .withStorage(storage)
  .then(longRunningStep1)
  .then(longRunningStep2)
  .then(longRunningStep3)
  .commit();

// Usage with auto-checkpointing:
// const result = await persistentWorkflow.start(
//   { data: 'important-data' },
//   { autoCheckpoint: true }
// );
//
// // Or resume from checkpoint after page reload:
// try {
//   const result = await persistentWorkflow.resumeById('persistent-workflow');
//   console.log('Resumed:', result.output);
// } catch (error) {
//   // No checkpoint found, start fresh
//   const result = await persistentWorkflow.start(
//     { data: 'important-data' },
//     { autoCheckpoint: true }
//   );
// }

// ============================================================================
// Example 8: Streaming Workflow Execution
// ============================================================================

const streamStep1 = createStep({
  id: 'stream-step-1',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { value: inputData.value * 2 };
  },
});

const streamStep2 = createStep({
  id: 'stream-step-2',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { value: inputData.value + 10 };
  },
});

const streamStep3 = createStep({
  id: 'stream-step-3',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { result: `Final: ${inputData.value}` };
  },
});

const streamingWorkflow = createWorkflow({
  id: 'streaming-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(streamStep1)
  .then(streamStep2)
  .then(streamStep3)
  .commit();

// Usage with streaming:
// for await (const event of streamingWorkflow.stream({ value: 5 })) {
//   switch (event.type) {
//     case 'workflow:start':
//       console.log('Workflow started:', event.workflowId);
//       break;
//     case 'step:start':
//       console.log('Step started:', event.stepId);
//       break;
//     case 'step:complete':
//       console.log('Step completed:', event.stepId, event.output);
//       break;
//     case 'step:error':
//       console.error('Step failed:', event.stepId, event.error);
//       break;
//     case 'workflow:complete':
//       console.log('Workflow completed:', event.output);
//       break;
//     case 'workflow:error':
//       console.error('Workflow failed:', event.error);
//       break;
//   }
// }

// ============================================================================
// Example 9: Complex Multi-Pattern Workflow
// ============================================================================

// Combines multiple patterns in a realistic scenario
const validateInputStep = createStep({
  id: 'validate-input',
  inputSchema: z.object({ email: z.string(), orderId: z.string() }),
  outputSchema: z.object({ email: z.string(), orderId: z.string(), valid: z.boolean() }),
  execute: async ({ inputData }) => {
    const valid = inputData.email.includes('@') && inputData.orderId.length > 0;
    return { ...inputData, valid };
  },
});

const fetchOrderStep = createStep({
  id: 'fetch-order',
  inputSchema: z.object({ orderId: z.string() }),
  outputSchema: z.object({ order: z.object({ id: z.string(), items: z.array(z.string()), total: z.number() }) }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      order: {
        id: inputData.orderId,
        items: ['item1', 'item2'],
        total: 99.99,
      },
    };
  },
});

const fetchUserPreferencesStep = createStep({
  id: 'fetch-user-prefs',
  inputSchema: z.object({ email: z.string() }),
  outputSchema: z.object({ preferences: z.object({ notifications: z.boolean(), currency: z.string() }) }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      preferences: {
        notifications: true,
        currency: 'USD',
      },
    };
  },
});

const sendConfirmationStep = createStep({
  id: 'send-confirmation',
  inputSchema: z.object({ email: z.string(), orderId: z.string() }),
  outputSchema: z.object({ sent: z.boolean(), message: z.string() }),
  execute: async ({ inputData, getStepResult }) => {
    const order = getStepResult<any>('fetch-order');
    const prefs = getStepResult<any>('fetch-user-prefs');

    if (!prefs?.preferences.notifications) {
      return { sent: false, message: 'User declined notifications' };
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      sent: true,
      message: `Confirmation sent to ${inputData.email} for order ${order.order.id}`,
    };
  },
});

const handleInvalidInputStep = createStep({
  id: 'handle-invalid',
  inputSchema: z.object({ email: z.string(), orderId: z.string(), valid: z.boolean() }),
  outputSchema: z.object({ error: z.string() }),
  execute: async ({ inputData }) => {
    return { error: 'Invalid input provided' };
  },
});

const complexWorkflow = createWorkflow({
  id: 'complex-workflow',
  inputSchema: z.object({ email: z.string(), orderId: z.string() }),
  outputSchema: z.union([
    z.object({ sent: z.boolean(), message: z.string() }),
    z.object({ error: z.string() }),
  ]),
})
  .then(validateInputStep)
  .branch([
    [
      async ({ inputData }) => inputData.valid,
      createStep({
        id: 'process-valid',
        inputSchema: z.object({ email: z.string(), orderId: z.string(), valid: z.boolean() }),
        outputSchema: z.object({ email: z.string(), orderId: z.string() }),
        execute: async ({ inputData }) => ({
          email: inputData.email,
          orderId: inputData.orderId,
        }),
      }),
    ],
    [async ({ inputData }) => !inputData.valid, handleInvalidInputStep],
  ])
  .map(async ({ inputData, getStepResult }) => {
    const validationResult = getStepResult('validate-input');
    if (!(validationResult as any).valid) {
      return inputData; // Skip to end if invalid
    }
    return inputData;
  })
  .parallel([fetchOrderStep, fetchUserPreferencesStep])
  .then(sendConfirmationStep)
  .commit();

// Usage:
// const result = await complexWorkflow.start({
//   email: 'user@example.com',
//   orderId: 'ORD-123',
// });
// console.log(result.output);
// { sent: true, message: 'Confirmation sent to user@example.com for order ORD-123' }

// ============================================================================
// Running the Examples
// ============================================================================

export async function runExamples() {
  console.log('=== Running Workflow Examples ===\n');

  // Example 1: Basic Sequential
  console.log('1. Basic Sequential Workflow');
  const result1 = await basicWorkflow.start({ message: 'hello world' });
  console.log('Result:', result1.output.result);
  console.log('');

  // Example 2: Parallel
  console.log('2. Parallel Workflow');
  const result2 = await parallelWorkflow.start({ userId: '123' });
  console.log('Result:', result2.output.combined);
  console.log('');

  // Example 3: Branching
  console.log('3. Branching Workflow (high value)');
  const result3a = await branchingWorkflow.start({ value: 150 });
  console.log('Result:', result3a.output);

  console.log('3. Branching Workflow (low value)');
  const result3b = await branchingWorkflow.start({ value: 50 });
  console.log('Result:', result3b.output);
  console.log('');

  // Example 4: Transformation
  console.log('4. Transformation Workflow');
  const result4 = await transformationWorkflow.start({ items: [1, 2, 3, 4, 5] });
  console.log('Result:', result4.output.result);
  console.log('');

  // Example 5: Foreach
  console.log('5. Foreach Workflow');
  const users = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com' },
  ];
  const result5 = await foreachWorkflow.start({ users });
  console.log('Result:', result5.output);
  console.log('');

  // Example 6: Loops
  console.log('6a. Dowhile Loop');
  const result6a = await dowhileWorkflow.start({ counter: 0 });
  console.log('Result:', result6a.output.counter);

  console.log('6b. Dountil Loop');
  const result6b = await dountilWorkflow.start({ taskId: 'task-123', attempts: 0 });
  console.log('Result:', result6b.output);
  console.log('');

  // Example 8: Streaming
  console.log('8. Streaming Workflow');
  for await (const event of streamingWorkflow.stream({ value: 5 })) {
    if (event.type === 'step:complete') {
      console.log('  Step completed:', event.stepId, event.output);
    } else if (event.type === 'workflow:complete') {
      console.log('  Workflow completed:', event.output);
    }
  }
  console.log('');

  // Example 9: Complex
  console.log('9. Complex Multi-Pattern Workflow');
  const result9 = await complexWorkflow.start({
    email: 'user@example.com',
    orderId: 'ORD-123',
  });
  console.log('Result:', result9.output);
  console.log('');

  console.log('=== All Examples Complete ===');
}

// Uncomment to run all examples:
// runExamples().catch(console.error);
