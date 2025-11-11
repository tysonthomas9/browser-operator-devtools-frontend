// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Example 2: Graph Workflow with Helpers
 *
 * This example demonstrates how to:
 * - Build a state machine using GraphBuilder
 * - Use GraphNodeHelpers to create common node patterns
 * - Use GraphRoutingHelpers for conditional routing
 * - Handle errors and retries in workflows
 * - Monitor progress with callbacks
 */

import {
  GraphBuilder,
  createAsyncTransformNode,
  createValidationNode,
  createRetryNode,
  createFinalNode,
  createErrorRouter,
  createPropertyRouter,
  END_NODE,
  type StateGraph
} from '../src/index.js';

// Define our workflow state
interface DataProcessingState {
  input: string;
  data?: {
    content: string;
    processed: boolean;
    validated: boolean;
  };
  error?: string;
  status: 'pending' | 'fetching' | 'validating' | 'processing' | 'complete' | 'error';
  retryCount?: number;
}

async function graphWorkflowExample() {
  console.log('=== Example 2: Graph Workflow ===\n');

  // Step 1: Create node implementations using helpers

  // Fetch node - simulates fetching data from an API
  const fetchNode = createAsyncTransformNode<DataProcessingState>(
    'fetchData',
    async (state) => {
      console.log('  📥 Fetching data...');

      // Simulate API call with potential failure
      await new Promise(resolve => setTimeout(resolve, 500));

      if (Math.random() > 0.7) {
        throw new Error('Network timeout');
      }

      return {
        ...state,
        data: {
          content: `Fetched data for: ${state.input}`,
          processed: false,
          validated: false
        },
        status: 'validating'
      };
    }
  );

  // Wrap fetch node with retry logic
  const reliableFetchNode = createRetryNode<DataProcessingState>(
    'reliableFetch',
    fetchNode,
    {
      maxRetries: 3,
      delayMs: 1000,
      shouldRetry: (error) => error.message.includes('timeout')
    }
  );

  // Validation node - checks if data meets requirements
  const validateNode = createValidationNode<DataProcessingState>(
    'validateData',
    (state) => {
      const content = state.data?.content || '';
      return content.length > 0;
    },
    'Data validation failed: content is empty'
  );

  // Processing node - transforms the data
  const processNode = createAsyncTransformNode<DataProcessingState>(
    'processData',
    async (state) => {
      console.log('  ⚙️  Processing data...');

      await new Promise(resolve => setTimeout(resolve, 300));

      return {
        ...state,
        data: state.data ? {
          ...state.data,
          content: state.data.content.toUpperCase(),
          processed: true,
          validated: true
        } : undefined,
        status: 'complete'
      };
    }
  );

  // Error handler node
  const errorHandlerNode = createAsyncTransformNode<DataProcessingState>(
    'handleError',
    async (state) => {
      console.log(`  ❌ Error occurred: ${state.error}`);

      return {
        ...state,
        status: 'error',
        retryCount: (state.retryCount || 0) + 1
      };
    }
  );

  // Final node with validation
  const finalNode = createFinalNode<DataProcessingState>(
    'finish',
    (state) => state.status === 'complete' && state.data?.processed === true
  );

  // Step 2: Create routing functions using helpers

  // Error router - checks for errors after each operation
  const errorRouter = createErrorRouter<DataProcessingState>(
    'handleError',
    'validateData'
  );

  // Status-based router for workflow progression
  const statusRouter = createPropertyRouter<DataProcessingState>(
    'status',
    {
      'validating': 'validateData',
      'processing': 'processData',
      'complete': 'finish',
      'error': 'handleError'
    },
    END_NODE
  );

  // Combined router with fallback logic
  const mainRouter = (state: DataProcessingState) => {
    // Check for errors first
    if (state.error) {
      return 'handleError';
    }

    // Route based on status
    return statusRouter(state);
  };

  // Step 3: Build the state graph
  const builder = new GraphBuilder<DataProcessingState>();

  const graph = builder
    .addNode('fetchData', reliableFetchNode)
    .addNode('validateData', validateNode)
    .addNode('processData', processNode)
    .addNode('handleError', errorHandlerNode)
    .addNode('finish', finalNode)
    .addEdge('fetchData', errorRouter)
    .addEdge('validateData', (state) =>
      state.error ? 'handleError' : 'processData'
    )
    .addEdge('processData', mainRouter)
    .addEdge('handleError', END_NODE)
    .addEdge('finish', END_NODE)
    .setEntryPoint('fetchData')
    .build();

  console.log('✓ State graph built with 5 nodes and conditional routing\n');

  // Step 4: Execute the workflow
  const initialState: DataProcessingState = {
    input: 'example data source',
    status: 'pending'
  };

  console.log('Starting workflow execution...\n');

  let stepCount = 0;
  try {
    const result = await graph.invoke(
      initialState,
      {
        onProgress: (state, nodeName) => {
          stepCount++;
          console.log(`[Step ${stepCount}] Executed: ${nodeName} (status: ${state.status})`);
        }
      }
    );

    console.log('\n✅ Workflow completed successfully!');
    console.log('Final state:');
    console.log(`  Status: ${result.status}`);
    console.log(`  Data processed: ${result.data?.processed}`);
    console.log(`  Content: ${result.data?.content}`);
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
  }

  // Step 5: Demonstrate streaming execution
  console.log('\n--- Streaming Execution ---\n');

  const streamState: DataProcessingState = {
    input: 'streaming data',
    status: 'pending'
  };

  console.log('Executing with streaming...\n');

  for await (const state of graph.stream(streamState)) {
    console.log(`  → Status: ${state.status}${state.data ? `, Content length: ${state.data.content.length}` : ''}`);
  }

  console.log('\n=== Example Complete ===\n');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  graphWorkflowExample().catch(console.error);
}

export { graphWorkflowExample };
