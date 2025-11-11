/**
 * Quick Start: Your First Workflow
 *
 * This example shows how to create and execute a simple workflow
 * in just a few lines of code.
 */

import { createStep, createWorkflow } from '@browser-operator/core/workflows';
import { z } from 'zod';

// Step 1: Create workflow steps
const greetStep = createStep({
  id: 'greet',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  execute: async ({ inputData }) => {
    return { greeting: `Hello, ${inputData.name}!` };
  },
});

const upperStep = createStep({
  id: 'upper',
  inputSchema: z.object({ greeting: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: inputData.greeting.toUpperCase() };
  },
});

// Step 2: Create and configure workflow
const myWorkflow = createWorkflow({
  id: 'my-first-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(greetStep)
  .then(upperStep)
  .commit();

// Step 3: Execute workflow
async function main() {
  const result = await myWorkflow.start({ name: 'Alice' });
  console.log(result.output.result); // "HELLO, ALICE!"
}

// Run it!
main().catch(console.error);
