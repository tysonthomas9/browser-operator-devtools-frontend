// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Example 4: Error Handling and Retry Patterns
 *
 * This example demonstrates how to:
 * - Handle different types of LLM errors (rate limits, network, server)
 * - Implement custom retry logic with exponential backoff
 * - Use LLMErrorHandler for automatic error classification
 * - Create resilient workflows with fallback strategies
 * - Monitor and log retry attempts
 */

import {
  LLMClient,
  LLMRetryManager,
  LLMErrorClassifier,
  GraphBuilder,
  createRetryNode,
  createAsyncTransformNode,
  createErrorRouter,
  END_NODE,
  type LLMMessage,
  type LLMCallRequest
} from '../src/index.js';

// Define state for resilient LLM workflow
interface ResilientWorkflowState {
  messages: LLMMessage[];
  response?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  providerFallback?: string[];
  currentProviderIndex: number;
}

async function errorHandlingExample() {
  console.log('=== Example 4: Error Handling and Retry ===\n');

  // Step 1: Initialize LLMClient with multiple providers for fallback
  const llmClient = LLMClient.getInstance();

  await llmClient.initialize({
    providers: [
      {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'invalid-key-for-demo',
        models: ['gpt-4.1']
      },
      {
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY || 'fallback-key',
        models: ['llama-3.3-70b']
      }
    ],
    defaultProvider: 'openai',
    defaultModel: 'gpt-4.1'
  });

  console.log('✓ LLMClient initialized with primary and fallback providers\n');

  // Step 2: Demonstrate basic error classification
  console.log('--- Error Classification ---\n');

  const errorExamples = [
    new Error('Rate limit exceeded. Please try again in 60 seconds.'),
    new Error('Network request failed: ECONNREFUSED'),
    new Error('Internal server error (500)'),
    new Error('Invalid API key provided'),
    new Error('Insufficient quota remaining'),
    new Error('Failed to parse JSON response')
  ];

  for (const error of errorExamples) {
    const errorType = LLMErrorClassifier.classifyError(error);
    const shouldRetry = LLMErrorClassifier.shouldRetry(errorType);
    const retryConfig = LLMErrorClassifier.getRetryConfig(errorType);

    console.log(`Error: "${error.message.substring(0, 50)}..."`);
    console.log(`  Type: ${errorType}`);
    console.log(`  Should retry: ${shouldRetry}`);
    if (shouldRetry) {
      console.log(`  Retry config: max=${retryConfig.maxRetries}, base delay=${retryConfig.baseDelayMs}ms`);
    }
    console.log();
  }

  // Step 3: Demonstrate LLMRetryManager
  console.log('--- LLM Retry Manager ---\n');

  let attemptCount = 0;
  const retryManager = new LLMRetryManager();

  // Simulate an operation that fails a few times then succeeds
  const unreliableOperation = async () => {
    attemptCount++;
    console.log(`  Attempt ${attemptCount}...`);

    if (attemptCount < 3) {
      throw new Error('Network request failed: timeout');
    }

    return 'Success after retries!';
  };

  try {
    const result = await retryManager.executeWithRetry(
      unreliableOperation,
      {
        customRetryConfig: {
          maxRetries: 5,
          baseDelayMs: 100
        },
        context: 'Unreliable API call'
      }
    );

    console.log(`✅ Result: ${result}`);
    console.log(`Total attempts: ${attemptCount}\n`);
  } catch (error) {
    console.error('❌ Operation failed after retries:', error);
  }

  // Step 4: Create a resilient workflow with provider fallback
  console.log('--- Resilient Workflow with Fallback ---\n');

  // Node that attempts LLM call with current provider
  const llmCallNode = createAsyncTransformNode<ResilientWorkflowState>(
    'llmCall',
    async (state) => {
      console.log(`  Attempting LLM call (retry ${state.retryCount}/${state.maxRetries})...`);

      const providers = state.providerFallback || ['openai'];
      const currentProvider = providers[state.currentProviderIndex];

      const request: LLMCallRequest = {
        provider: currentProvider,
        messages: state.messages,
        options: {
          temperature: 0.7,
          maxTokens: 100
        }
      };

      try {
        const response = await llmClient.call(request);

        return {
          ...state,
          response: response.content,
          error: undefined
        };
      } catch (error) {
        const errorType = LLMErrorClassifier.classifyError(error as Error);
        const shouldRetry = LLMErrorClassifier.shouldRetry(errorType);

        console.log(`  ❌ Error type: ${errorType}, should retry: ${shouldRetry}`);

        return {
          ...state,
          error: (error as Error).message,
          retryCount: state.retryCount + 1
        };
      }
    }
  );

  // Retry wrapper with exponential backoff
  const resilientLLMNode = createRetryNode<ResilientWorkflowState>(
    'resilientLLM',
    llmCallNode,
    {
      maxRetries: 3,
      delayMs: 1000,
      shouldRetry: (error) => {
        const errorType = LLMErrorClassifier.classifyError(error);
        return LLMErrorClassifier.shouldRetry(errorType);
      }
    }
  );

  // Fallback node - switches to alternative provider
  const fallbackNode = createAsyncTransformNode<ResilientWorkflowState>(
    'fallback',
    async (state) => {
      const providers = state.providerFallback || ['openai'];
      const nextIndex = state.currentProviderIndex + 1;

      if (nextIndex >= providers.length) {
        console.log('  ⚠️  All providers exhausted, using default response');
        return {
          ...state,
          response: 'I apologize, but I am currently unable to process your request due to technical difficulties. Please try again later.',
          error: undefined
        };
      }

      console.log(`  🔄 Falling back to provider: ${providers[nextIndex]}`);

      return {
        ...state,
        currentProviderIndex: nextIndex,
        retryCount: 0,
        error: undefined
      };
    }
  );

  // Error analysis node
  const analyzeErrorNode = createAsyncTransformNode<ResilientWorkflowState>(
    'analyzeError',
    async (state) => {
      if (!state.error) {
        return state;
      }

      const error = new Error(state.error);
      const errorType = LLMErrorClassifier.classifyError(error);

      console.log(`  📊 Error Analysis:`);
      console.log(`     Type: ${errorType}`);
      console.log(`     Retry count: ${state.retryCount}`);
      console.log(`     Provider index: ${state.currentProviderIndex}`);

      // Decide whether to retry or fallback
      if (state.retryCount >= state.maxRetries) {
        console.log(`     Decision: Switch to fallback provider`);
        return state;
      }

      console.log(`     Decision: Retry with same provider`);
      return state;
    }
  );

  // Build the resilient workflow graph
  const builder = new GraphBuilder<ResilientWorkflowState>();

  const graph = builder
    .addNode('llmCall', resilientLLMNode)
    .addNode('analyzeError', analyzeErrorNode)
    .addNode('fallback', fallbackNode)
    .addEdge('llmCall', createErrorRouter<ResilientWorkflowState>(
      'analyzeError',
      END_NODE
    ))
    .addEdge('analyzeError', (state) => {
      if (!state.error) {
        return END_NODE;
      }

      if (state.retryCount >= state.maxRetries) {
        return 'fallback';
      }

      return 'llmCall';
    })
    .addEdge('fallback', 'llmCall')
    .setEntryPoint('llmCall')
    .build();

  console.log('✓ Resilient workflow graph built\n');

  // Step 5: Execute resilient workflow
  console.log('--- Executing Resilient Workflow ---\n');

  const initialState: ResilientWorkflowState = {
    messages: [
      {
        role: 'user',
        content: 'What are the key principles of error handling?'
      }
    ],
    retryCount: 0,
    maxRetries: 2,
    providerFallback: ['openai', 'groq'],
    currentProviderIndex: 0
  };

  try {
    const result = await graph.invoke(initialState, {
      maxSteps: 10,
      onProgress: (state, nodeName) => {
        console.log(`[Step] Node: ${nodeName}, Has response: ${!!state.response}, Has error: ${!!state.error}`);
      }
    });

    if (result.response) {
      console.log('\n✅ Workflow succeeded!');
      console.log(`Response: ${result.response.substring(0, 150)}...`);
      console.log(`Total retries: ${result.retryCount}`);
      console.log(`Final provider index: ${result.currentProviderIndex}`);
    } else {
      console.log('\n⚠️  Workflow completed with no response');
    }
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
  }

  // Step 6: Simple retry pattern
  console.log('\n--- Simple Retry Pattern ---\n');

  let simpleAttempt = 0;
  const simpleResult = await LLMRetryManager.simpleRetry(
    async () => {
      simpleAttempt++;
      console.log(`  Simple attempt ${simpleAttempt}...`);

      if (simpleAttempt < 2) {
        throw new Error('Temporary failure');
      }

      return 'Simple retry succeeded!';
    },
    {
      maxRetries: 3,
      baseDelayMs: 500
    }
  );

  console.log(`✅ ${simpleResult}\n`);

  console.log('=== Example Complete ===\n');
  console.log('💡 Key Takeaways:');
  console.log('  - Automatic error classification helps determine retry strategy');
  console.log('  - Exponential backoff prevents overwhelming failed services');
  console.log('  - Provider fallback ensures resilience across infrastructure');
  console.log('  - Retry count limits prevent infinite loops');
  console.log('  - Error analysis enables intelligent recovery decisions');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  errorHandlingExample().catch(console.error);
}

export { errorHandlingExample };
