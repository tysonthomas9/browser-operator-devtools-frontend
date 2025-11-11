/**
 * Workflow Persistence Example
 *
 * Demonstrates how to:
 * - Configure persistent storage
 * - Auto-save checkpoints
 * - Resume workflows after interruption
 * - Handle long-running workflows
 */

import {
  createStep,
  createWorkflow,
  IndexedDBWorkflowStorage,
  LocalStorageWorkflowStorage,
  InMemoryWorkflowStorage,
} from '@browser-operator/core/workflows';
import { z } from 'zod';

// ============================================================================
// Example 1: Basic Persistence with IndexedDB
// ============================================================================

const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ processed: z.string() }),
  execute: async ({ inputData }) => {
    console.log('Step 1: Processing...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { processed: `Processed: ${inputData.data}` };
  },
});

const step2 = createStep({
  id: 'step-2',
  inputSchema: z.object({ processed: z.string() }),
  outputSchema: z.object({ enhanced: z.string() }),
  execute: async ({ inputData }) => {
    console.log('Step 2: Enhancing...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { enhanced: `${inputData.processed} + Enhanced` };
  },
});

const step3 = createStep({
  id: 'step-3',
  inputSchema: z.object({ enhanced: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    console.log('Step 3: Finalizing...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { final: `${inputData.enhanced} + Final` };
  },
});

// Create storage adapter (persists across page reloads)
const storage = new IndexedDBWorkflowStorage('my-app-workflows');

const persistentWorkflow = createWorkflow({
  id: 'persistent-workflow-demo',
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .withStorage(storage)
  .then(step1)
  .then(step2)
  .then(step3)
  .commit();

/**
 * Execute with auto-checkpointing
 *
 * The workflow will save its state after each step.
 * If the page reloads or crashes, you can resume from the last checkpoint.
 */
export async function runWithPersistence() {
  try {
    console.log('Starting workflow with auto-checkpointing...');
    const result = await persistentWorkflow.start(
      { data: 'important-data' },
      { autoCheckpoint: true }
    );
    console.log('Completed:', result.output.final);
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

/**
 * Resume from checkpoint
 *
 * If the workflow was interrupted, you can resume it by workflow ID.
 * This is useful after page reloads or app restarts.
 */
export async function resumeWorkflow() {
  try {
    console.log('Attempting to resume workflow...');
    const result = await persistentWorkflow.resumeById('persistent-workflow-demo');
    console.log('Resumed and completed:', result.output.final);
  } catch (error) {
    console.log('No checkpoint found, starting fresh...');
    return runWithPersistence();
  }
}

// ============================================================================
// Example 2: Human-in-the-Loop Workflow
// ============================================================================

// A workflow that requires human approval between steps

const prepareReportStep = createStep({
  id: 'prepare-report',
  inputSchema: z.object({ data: z.array(z.number()) }),
  outputSchema: z.object({ report: z.string(), stats: z.object({ sum: z.number(), avg: z.number() }) }),
  execute: async ({ inputData }) => {
    const sum = inputData.data.reduce((a, b) => a + b, 0);
    const avg = sum / inputData.data.length;
    return {
      report: `Analysis of ${inputData.data.length} items`,
      stats: { sum, avg },
    };
  },
});

const publishReportStep = createStep({
  id: 'publish-report',
  inputSchema: z.object({ report: z.string(), stats: z.object({ sum: z.number(), avg: z.number() }) }),
  outputSchema: z.object({ published: z.boolean(), url: z.string() }),
  execute: async ({ inputData }) => {
    // This step would publish the report
    return {
      published: true,
      url: `https://example.com/reports/${Date.now()}`,
    };
  },
});

const humanApprovalWorkflow = createWorkflow({
  id: 'human-approval-workflow',
  inputSchema: z.object({ data: z.array(z.number()) }),
  outputSchema: z.object({ published: z.boolean(), url: z.string() }),
})
  .withStorage(storage)
  .then(prepareReportStep)
  // At this point, show report to human for approval
  // Then resume the workflow to publish
  .then(publishReportStep)
  .commit();

/**
 * Step 1: Start workflow and wait for approval
 */
export async function startApprovalWorkflow() {
  const result = await humanApprovalWorkflow.start(
    { data: [10, 20, 30, 40, 50] },
    { autoCheckpoint: true }
  );

  // After first step completes, we have a checkpoint
  // Show the report to user for approval
  console.log('Report ready for approval');
  console.log('Review the report and then call continueAfterApproval()');

  return result;
}

/**
 * Step 2: After human approval, resume workflow
 */
export async function continueAfterApproval() {
  // Resume from where we left off
  const result = await humanApprovalWorkflow.resumeById('human-approval-workflow');
  console.log('Published:', result.output);
  return result;
}

// ============================================================================
// Example 3: Using Different Storage Adapters
// ============================================================================

/**
 * IndexedDB Storage (Recommended for Production)
 * - Persistent across page reloads
 * - Large storage capacity (~50MB+)
 * - Asynchronous API
 */
export function createWithIndexedDB() {
  const storage = new IndexedDBWorkflowStorage('my-app-name');

  return createWorkflow({
    id: 'indexeddb-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  })
    .withStorage(storage)
    .then(step1)
    .commit();
}

/**
 * LocalStorage Storage (Simple, Limited)
 * - Persistent across page reloads
 * - Limited storage (~5-10MB)
 * - Synchronous API
 * - Best for small workflows
 */
export function createWithLocalStorage() {
  const storage = new LocalStorageWorkflowStorage('workflow_');

  return createWorkflow({
    id: 'localstorage-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  })
    .withStorage(storage)
    .then(step1)
    .commit();
}

/**
 * In-Memory Storage (Development/Testing)
 * - NOT persistent (lost on page reload)
 * - Fast
 * - Unlimited capacity
 * - Best for development/testing
 */
export function createWithInMemory() {
  const storage = new InMemoryWorkflowStorage();

  return createWorkflow({
    id: 'memory-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  })
    .withStorage(storage)
    .then(step1)
    .commit();
}

// ============================================================================
// Example 4: Manual Checkpoint Management
// ============================================================================

/**
 * You can also manually save and load checkpoints
 */
export async function manualCheckpointExample() {
  const storage = new IndexedDBWorkflowStorage('manual-checkpoints');

  // Get a checkpoint manually
  const checkpoint = await storage.load('some-workflow-id');

  if (checkpoint) {
    console.log('Found checkpoint:', {
      workflowId: checkpoint.workflowId,
      nodeIndex: checkpoint.nodeIndex,
      timestamp: new Date(checkpoint.timestamp),
    });

    // Resume from this checkpoint
    const workflow = createWorkflow({
      id: 'some-workflow-id',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    })
      .withStorage(storage)
      .then(step1)
      .then(step2)
      .then(step3)
      .commit();

    const result = await workflow.resume(checkpoint);
    console.log('Resumed:', result.output);
  }

  // List all checkpoints
  const checkpointIds = await storage.list?.();
  console.log('All checkpoints:', checkpointIds);

  // Delete old checkpoints
  if (checkpointIds) {
    for (const id of checkpointIds) {
      const cp = await storage.load(id);
      if (cp && Date.now() - cp.timestamp > 24 * 60 * 60 * 1000) {
        // Delete checkpoints older than 24 hours
        await storage.delete(id);
        console.log('Deleted old checkpoint:', id);
      }
    }
  }
}

// ============================================================================
// Running the Examples
// ============================================================================

export async function runPersistenceExamples() {
  console.log('=== Workflow Persistence Examples ===\n');

  // Example 1: Basic persistence
  console.log('1. Running workflow with auto-checkpointing...');
  await runWithPersistence();
  console.log('');

  // Example 2: Try to resume (will start fresh if no checkpoint)
  console.log('2. Attempting to resume...');
  await resumeWorkflow();
  console.log('');

  // Example 4: Manual checkpoint management
  console.log('4. Manual checkpoint management...');
  await manualCheckpointExample();
  console.log('');

  console.log('=== Persistence Examples Complete ===');
}

// Uncomment to run:
// runPersistenceExamples().catch(console.error);

// For human-in-the-loop workflow:
// 1. await startApprovalWorkflow();
// 2. Review the output
// 3. await continueAfterApproval();
