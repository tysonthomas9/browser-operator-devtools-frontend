# AI Agent SDK Best Practices

Guidelines for building production-ready AI agents with the SDK.

## Table of Contents

- [General Principles](#general-principles)
- [LLM Integration](#llm-integration)
- [Graph Orchestration](#graph-orchestration)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)

---

## General Principles

### Keep State Immutable

Always create new state objects instead of mutating existing ones.

✅ **Good**:
```typescript
const node = createAsyncTransformNode<MyState>(
  'transform',
  async (state) => {
    return {
      ...state,
      processed: true,
      timestamp: Date.now()
    };
  }
);
```

❌ **Bad**:
```typescript
const node = createAsyncTransformNode<MyState>(
  'transform',
  async (state) => {
    state.processed = true; // Mutation!
    state.timestamp = Date.now();
    return state;
  }
);
```

**Why**: Immutability prevents hard-to-debug side effects and enables features like state replay and time-travel debugging.

### Use TypeScript Types

Define clear interfaces for your state.

✅ **Good**:
```typescript
interface WorkflowState {
  userId: string;
  data?: ProcessedData;
  error?: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

const graph = new GraphBuilder<WorkflowState>()
  .addNode('start', startNode)
  .build();
```

❌ **Bad**:
```typescript
// Using any or untyped objects
const graph = new GraphBuilder<any>()
  .addNode('start', startNode)
  .build();
```

**Why**: Types catch errors at compile time and provide IDE autocomplete.

### Name Nodes Descriptively

Use clear, action-oriented node names.

✅ **Good**:
```typescript
.addNode('fetchUserData', fetchNode)
.addNode('validateInput', validateNode)
.addNode('processPayment', paymentNode)
.addNode('sendConfirmationEmail', emailNode)
```

❌ **Bad**:
```typescript
.addNode('node1', fetchNode)
.addNode('node2', validateNode)
.addNode('process', paymentNode)
.addNode('finish', emailNode)
```

**Why**: Clear names make graphs self-documenting and easier to debug.

---

## LLM Integration

### Initialize Once

Initialize `LLMClient` once at application startup.

✅ **Good**:
```typescript
// app.ts
const llmClient = LLMClient.getInstance();
await llmClient.initialize(config);

// Reuse throughout application
export { llmClient };
```

❌ **Bad**:
```typescript
// Reinitializing on every request
async function handleRequest() {
  const llmClient = LLMClient.getInstance();
  await llmClient.initialize(config); // Wasteful!
  await llmClient.call(...);
}
```

**Why**: Initialization involves loading providers and validating configs. Do it once.

### Use System Prompts

Always include system prompts to set agent behavior.

✅ **Good**:
```typescript
const messages: LLMMessage[] = [
  {
    role: 'system',
    content: 'You are a helpful customer support agent. Be concise and professional.'
  },
  {
    role: 'user',
    content: userQuestion
  }
];
```

❌ **Bad**:
```typescript
const messages: LLMMessage[] = [
  {
    role: 'user',
    content: userQuestion
  }
];
```

**Why**: System prompts ensure consistent agent behavior and improve response quality.

### Handle Tool Calls Properly

Always check for tool calls before processing text responses.

✅ **Good**:
```typescript
const response = await llmClient.call({ messages, tools });
const parsed = llmClient.parseResponse(response);

if (parsed.toolCalls && parsed.toolCalls.length > 0) {
  for (const toolCall of parsed.toolCalls) {
    const result = await executeTool(toolCall.name, toolCall.arguments);

    messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls
    });

    messages.push({
      role: 'tool',
      toolCallId: toolCall.id,
      content: JSON.stringify(result)
    });
  }

  // Make follow-up call with tool results
  const followUp = await llmClient.call({ messages });
  return followUp.content;
}

return parsed.content;
```

❌ **Bad**:
```typescript
const response = await llmClient.call({ messages, tools });
return response.content; // Ignores tool calls!
```

**Why**: LLMs may request tool execution instead of providing direct answers.

### Set Appropriate Timeouts

Configure request timeouts based on model and complexity.

✅ **Good**:
```typescript
const response = await llmClient.call({
  messages,
  modelName: 'o3-mini', // Reasoning model - needs more time
  options: {
    maxTokens: 2000,
    timeout: 120000 // 2 minutes for complex reasoning
  }
});
```

❌ **Bad**:
```typescript
const response = await llmClient.call({
  messages,
  modelName: 'o3-mini',
  // Using default timeout might be too short
});
```

**Why**: Different models have different latency characteristics. O-series models need more time.

### Use Temperature Wisely

Match temperature to task type.

✅ **Good**:
```typescript
// Creative writing - high temperature
const creative = await llmClient.call({
  messages: [{ role: 'user', content: 'Write a poem' }],
  options: { temperature: 0.9 }
});

// Code generation - low temperature
const code = await llmClient.call({
  messages: [{ role: 'user', content: 'Write a sort function' }],
  options: { temperature: 0.2 }
});

// Factual Q&A - very low temperature
const answer = await llmClient.call({
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  options: { temperature: 0.1 }
});
```

**Why**: Temperature controls randomness. Use low for deterministic tasks, high for creativity.

### Monitor Token Usage

Track and log token usage for cost management.

✅ **Good**:
```typescript
const response = await llmClient.call({ messages });

if (response.usage) {
  logger.info('Token usage', {
    prompt: response.usage.promptTokens,
    completion: response.usage.completionTokens,
    total: response.usage.totalTokens,
    model: response.modelName
  });

  metrics.incrementCounter('llm.tokens.total', response.usage.totalTokens);
  metrics.incrementCounter('llm.requests', 1);
}
```

**Why**: LLM costs are based on token usage. Monitor to control expenses.

---

## Graph Orchestration

### Validate State at Entry Points

Check state validity before execution.

✅ **Good**:
```typescript
const validateEntryNode = createValidationNode<WorkflowState>(
  'validateInput',
  (state) => {
    return state.userId.length > 0 &&
           state.userId.match(/^[a-zA-Z0-9_-]+$/);
  },
  'Invalid userId format'
);

const graph = new GraphBuilder<WorkflowState>()
  .addNode('validateInput', validateEntryNode)
  .addNode('process', processNode)
  .setEntryPoint('validateInput')
  .build();
```

**Why**: Early validation prevents processing invalid data through entire workflow.

### Use Max Steps Protection

Always set maxSteps to prevent infinite loops.

✅ **Good**:
```typescript
const result = await graph.invoke(initialState, {
  maxSteps: 100,
  onProgress: (state, nodeName) => {
    logger.debug(`Executed node: ${nodeName}`);
  }
});
```

❌ **Bad**:
```typescript
const result = await graph.invoke(initialState);
// Default maxSteps might be too high or unlimited
```

**Why**: Bugs in routing logic can cause infinite loops. MaxSteps is a safety net.

### Prefer Helper Functions

Use SDK helper functions instead of writing custom nodes from scratch.

✅ **Good**:
```typescript
const validateNode = createValidationNode<MyState>(
  'validate',
  (state) => state.data.length > 0,
  'Data is empty'
);

const fetchNode = createAsyncTransformNode<MyState>(
  'fetch',
  async (state) => {
    const data = await fetchFromAPI();
    return { ...state, data };
  }
);

const retryNode = createRetryNode<MyState>(
  'reliableFetch',
  fetchNode,
  { maxRetries: 3, delayMs: 1000 }
);
```

❌ **Bad**:
```typescript
// Reimplementing retry logic from scratch
const retryNode = {
  invoke: async (state: MyState) => {
    let retries = 0;
    while (retries < 3) {
      try {
        // Manual retry implementation
        return await fetchNode.invoke(state);
      } catch (error) {
        retries++;
        if (retries >= 3) throw error;
        await sleep(1000 * Math.pow(2, retries));
      }
    }
  }
};
```

**Why**: Helpers are tested, optimized, and handle edge cases correctly.

### Use Routers for Clarity

Use routing helpers instead of inline arrow functions for complex logic.

✅ **Good**:
```typescript
const statusRouter = createPropertyRouter<WorkflowState>(
  'status',
  {
    'pending': 'process',
    'processing': 'monitor',
    'complete': 'finish',
    'error': 'handleError'
  }
);

builder.addEdge('checkStatus', statusRouter);
```

❌ **Bad**:
```typescript
builder.addEdge('checkStatus', (state) => {
  if (state.status === 'pending') return 'process';
  if (state.status === 'processing') return 'monitor';
  if (state.status === 'complete') return 'finish';
  if (state.status === 'error') return 'handleError';
  return END_NODE;
});
```

**Why**: Named routers are reusable, testable, and easier to understand.

### Keep Nodes Focused

Each node should have a single responsibility.

✅ **Good**:
```typescript
const fetchUserNode = createAsyncTransformNode(...);
const validateUserNode = createValidationNode(...);
const enrichUserNode = createAsyncTransformNode(...);
const saveUserNode = createAsyncTransformNode(...);

builder
  .addNode('fetchUser', fetchUserNode)
  .addNode('validateUser', validateUserNode)
  .addNode('enrichUser', enrichUserNode)
  .addNode('saveUser', saveUserNode);
```

❌ **Bad**:
```typescript
const doEverythingNode = createAsyncTransformNode(
  'doEverything',
  async (state) => {
    const user = await fetchUser();
    if (!validateUser(user)) throw new Error('Invalid');
    const enriched = await enrichUser(user);
    await saveUser(enriched);
    return state;
  }
);
```

**Why**: Small, focused nodes are easier to test, debug, and reuse.

---

## Error Handling

### Always Use Retry Logic for LLM Calls

Wrap LLM operations in retry managers.

✅ **Good**:
```typescript
const llmNode = createAsyncTransformNode<MyState>(
  'llmCall',
  async (state) => {
    const retryManager = new LLMRetryManager();

    const response = await retryManager.executeWithRetry(
      async () => await llmClient.call({ messages: state.messages }),
      { context: 'LLM call for workflow' }
    );

    return { ...state, response: response.content };
  }
);
```

❌ **Bad**:
```typescript
const llmNode = createAsyncTransformNode<MyState>(
  'llmCall',
  async (state) => {
    // No retry logic - fails on transient errors
    const response = await llmClient.call({ messages: state.messages });
    return { ...state, response: response.content };
  }
);
```

**Why**: LLM APIs can have transient failures (rate limits, network issues).

### Classify Errors

Use error classification to handle different error types appropriately.

✅ **Good**:
```typescript
try {
  await llmClient.call(request);
} catch (error) {
  const errorType = LLMErrorClassifier.classifyError(error);

  switch (errorType) {
    case 'RATE_LIMIT':
      logger.warn('Rate limited, backing off');
      await sleep(60000);
      break;
    case 'AUTH_ERROR':
      logger.error('Auth failed, check API key');
      throw error; // Don't retry
    case 'QUOTA_ERROR':
      logger.error('Quota exhausted');
      await notifyAdmin();
      throw error;
    default:
      logger.error('Unknown error', { error });
      throw error;
  }
}
```

**Why**: Different errors require different handling strategies.

### Provide Fallback Strategies

Always have fallback options for critical operations.

✅ **Good**:
```typescript
const llmCallNode = createAsyncTransformNode<MyState>(
  'llmCall',
  async (state) => {
    try {
      const response = await llmClient.call({
        provider: 'openai',
        messages: state.messages
      });
      return { ...state, response: response.content };
    } catch (error) {
      logger.warn('Primary provider failed, trying fallback');

      try {
        const response = await llmClient.call({
          provider: 'groq',
          messages: state.messages
        });
        return { ...state, response: response.content };
      } catch (fallbackError) {
        logger.error('All providers failed');
        return {
          ...state,
          response: 'Service temporarily unavailable',
          error: 'All LLM providers failed'
        };
      }
    }
  }
);
```

**Why**: Fallbacks ensure system resilience and better user experience.

### Use Error Routers

Route to error handling nodes when errors occur.

✅ **Good**:
```typescript
const errorRouter = createErrorRouter<WorkflowState>(
  'handleError',
  'continue'
);

builder
  .addNode('process', processNode)
  .addNode('handleError', errorHandlerNode)
  .addNode('continue', continueNode)
  .addEdge('process', errorRouter);
```

**Why**: Centralized error handling makes workflows more maintainable.

### Log Errors with Context

Include relevant context when logging errors.

✅ **Good**:
```typescript
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    userId: state.userId,
    operationName: 'processPayment',
    timestamp: new Date().toISOString(),
    requestId: state.requestId
  });
}
```

❌ **Bad**:
```typescript
try {
  await operation();
} catch (error) {
  console.log(error);
}
```

**Why**: Context helps debug issues in production.

---

## Performance

### Batch LLM Calls When Possible

Combine multiple operations into single LLM calls.

✅ **Good**:
```typescript
const messages: LLMMessage[] = [
  {
    role: 'system',
    content: 'You are a helpful assistant.'
  },
  {
    role: 'user',
    content: `Please perform these tasks:
1. Summarize: ${text}
2. Extract entities from: ${text}
3. Classify sentiment of: ${text}

Respond in JSON format.`
  }
];

const response = await llmClient.call({ messages });
```

❌ **Bad**:
```typescript
// Three separate LLM calls
const summary = await llmClient.call({
  messages: [{ role: 'user', content: `Summarize: ${text}` }]
});

const entities = await llmClient.call({
  messages: [{ role: 'user', content: `Extract entities: ${text}` }]
});

const sentiment = await llmClient.call({
  messages: [{ role: 'user', content: `Classify sentiment: ${text}` }]
});
```

**Why**: Batching reduces API calls, latency, and costs.

### Cache LLM Responses

Cache deterministic LLM responses.

✅ **Good**:
```typescript
const cache = new Map<string, string>();

async function getCachedResponse(prompt: string): Promise<string> {
  const cacheKey = `${modelName}:${prompt}`;

  if (cache.has(cacheKey)) {
    logger.debug('Cache hit');
    return cache.get(cacheKey)!;
  }

  const response = await llmClient.call({
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: 0 } // Deterministic
  });

  cache.set(cacheKey, response.content);
  return response.content;
}
```

**Why**: Caching saves costs and improves latency for repeated queries.

### Use Streaming for Long Responses

For long-running workflows, use streaming to provide intermediate feedback.

✅ **Good**:
```typescript
for await (const state of graph.stream(initialState)) {
  // Send progress updates to client
  ws.send(JSON.stringify({
    type: 'progress',
    state: sanitizeState(state)
  }));
}
```

**Why**: Streaming improves perceived performance and user experience.

### Optimize Graph Structure

Minimize unnecessary nodes and edges.

✅ **Good**:
```typescript
// Combine simple transforms into one node
const processNode = createAsyncTransformNode<MyState>(
  'process',
  async (state) => {
    const trimmed = state.input.trim();
    const lower = trimmed.toLowerCase();
    const validated = validateInput(lower);

    return { ...state, processedInput: validated };
  }
);
```

❌ **Bad**:
```typescript
// Unnecessary granularity
const trimNode = createTransformNode(...);
const lowerNode = createTransformNode(...);
const validateNode = createTransformNode(...);

// Three nodes instead of one
```

**Why**: Fewer nodes mean less overhead and faster execution.

### Parallelize Independent Operations

Use Promise.all for independent async operations.

✅ **Good**:
```typescript
const enrichNode = createAsyncTransformNode<MyState>(
  'enrich',
  async (state) => {
    const [userData, weatherData, newsData] = await Promise.all([
      fetchUserData(state.userId),
      fetchWeather(state.location),
      fetchNews(state.interests)
    ]);

    return { ...state, userData, weatherData, newsData };
  }
);
```

❌ **Bad**:
```typescript
const enrichNode = createAsyncTransformNode<MyState>(
  'enrich',
  async (state) => {
    const userData = await fetchUserData(state.userId);
    const weatherData = await fetchWeather(state.location);
    const newsData = await fetchNews(state.interests);

    return { ...state, userData, weatherData, newsData };
  }
);
```

**Why**: Parallel execution reduces total latency.

---

## Security

### Validate All Inputs

Never trust user input. Always validate.

✅ **Good**:
```typescript
const validateInputNode = createValidationNode<UserState>(
  'validateInput',
  (state) => {
    // Length check
    if (state.userInput.length > 10000) return false;

    // Content check
    if (containsInjectionPatterns(state.userInput)) return false;

    // Format check
    if (!isValidFormat(state.userInput)) return false;

    return true;
  },
  'Invalid or unsafe input detected'
);
```

**Why**: Prevents injection attacks and malicious inputs.

### Sanitize LLM Outputs

Don't blindly trust LLM outputs, especially for code execution or SQL.

✅ **Good**:
```typescript
const response = await llmClient.call({ messages });
const parsed = llmClient.parseResponse(response);

if (parsed.toolCalls) {
  for (const toolCall of parsed.toolCalls) {
    // Validate tool name against whitelist
    if (!ALLOWED_TOOLS.includes(toolCall.name)) {
      logger.warn('Unauthorized tool call attempted', { tool: toolCall.name });
      continue;
    }

    // Validate arguments
    const validatedArgs = validateToolArguments(
      toolCall.name,
      toolCall.arguments
    );

    await executeTool(toolCall.name, validatedArgs);
  }
}
```

❌ **Bad**:
```typescript
const response = await llmClient.call({ messages });

// Directly executing LLM-generated code
eval(response.content);
```

**Why**: LLMs can be manipulated through prompt injection to generate malicious outputs.

### Protect API Keys

Never hardcode API keys or commit them to version control.

✅ **Good**:
```typescript
// Use environment variables
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

await llmClient.initialize({
  providers: [{
    provider: 'openai',
    apiKey: apiKey,
    models: ['gpt-4.1']
  }]
});
```

❌ **Bad**:
```typescript
await llmClient.initialize({
  providers: [{
    provider: 'openai',
    apiKey: 'sk-abcd1234...', // Hardcoded key!
    models: ['gpt-4.1']
  }]
});
```

**Why**: Exposed API keys can be abused, leading to unauthorized usage and costs.

### Rate Limit User Requests

Implement rate limiting to prevent abuse.

✅ **Good**:
```typescript
const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000 // 10 requests per minute
});

const processNode = createAsyncTransformNode<RequestState>(
  'process',
  async (state) => {
    if (!await rateLimiter.checkLimit(state.userId)) {
      return {
        ...state,
        error: 'Rate limit exceeded. Please try again later.'
      };
    }

    // Process request
    return await processRequest(state);
  }
);
```

**Why**: Prevents DoS attacks and controls costs.

### Implement Timeouts

Set timeouts to prevent resource exhaustion.

✅ **Good**:
```typescript
const timeoutMs = 30000; // 30 seconds
const controller = new AbortController();

const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

try {
  const result = await graph.invoke(
    initialState,
    {
      signal: controller.signal,
      maxSteps: 50
    }
  );

  return result;
} finally {
  clearTimeout(timeoutId);
}
```

**Why**: Prevents long-running operations from consuming resources indefinitely.

---

## Testing

### Test Nodes in Isolation

Test each node independently before integration.

✅ **Good**:
```typescript
describe('validateUserNode', () => {
  it('should accept valid user data', async () => {
    const state: UserState = {
      userId: 'user123',
      email: 'test@example.com',
      error: undefined
    };

    const result = await validateUserNode.invoke(state);

    expect(result.error).toBeUndefined();
  });

  it('should reject invalid email', async () => {
    const state: UserState = {
      userId: 'user123',
      email: 'invalid-email',
      error: undefined
    };

    const result = await validateUserNode.invoke(state);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('email');
  });
});
```

**Why**: Isolated tests are faster, more reliable, and easier to debug.

### Mock LLM Responses

Use mocks for LLM calls in tests.

✅ **Good**:
```typescript
jest.mock('@browser-operator/ai-agent-sdk', () => ({
  ...jest.requireActual('@browser-operator/ai-agent-sdk'),
  LLMClient: {
    getInstance: () => ({
      call: jest.fn().mockResolvedValue({
        content: 'Mocked response',
        provider: 'openai',
        modelName: 'gpt-4.1'
      })
    })
  }
}));

test('workflow with mocked LLM', async () => {
  const result = await graph.invoke(initialState);
  expect(result.response).toBe('Mocked response');
});
```

**Why**: Tests shouldn't depend on external services or incur API costs.

### Test Error Paths

Test both success and failure scenarios.

✅ **Good**:
```typescript
describe('llmCallNode', () => {
  it('should handle successful responses', async () => {
    // Test success path
  });

  it('should handle rate limit errors', async () => {
    // Test rate limit error
  });

  it('should handle network errors', async () => {
    // Test network error
  });

  it('should retry on transient failures', async () => {
    // Test retry logic
  });

  it('should fallback to secondary provider', async () => {
    // Test fallback
  });
});
```

**Why**: Error paths are critical for production reliability.

### Test Graph Execution

Test complete graph workflows.

✅ **Good**:
```typescript
describe('userWorkflowGraph', () => {
  it('should complete happy path', async () => {
    const result = await graph.invoke({
      userId: 'test123',
      status: 'pending'
    });

    expect(result.status).toBe('complete');
    expect(result.error).toBeUndefined();
  });

  it('should handle validation failures', async () => {
    const result = await graph.invoke({
      userId: '', // Invalid
      status: 'pending'
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('userId');
  });

  it('should respect maxSteps limit', async () => {
    await expect(
      graph.invoke(initialState, { maxSteps: 2 })
    ).rejects.toThrow('Maximum steps exceeded');
  });
});
```

**Why**: Integration tests ensure nodes work together correctly.

---

## Deployment

### Use Environment-Based Configuration

Configure differently for dev, staging, and production.

✅ **Good**:
```typescript
const config = {
  development: {
    defaultModel: 'gpt-4.1-mini',
    maxRetries: 1,
    timeout: 30000,
    logLevel: 'debug'
  },
  production: {
    defaultModel: 'gpt-4.1',
    maxRetries: 3,
    timeout: 120000,
    logLevel: 'info'
  }
};

const env = process.env.NODE_ENV || 'development';
const llmConfig = config[env];
```

**Why**: Different environments have different requirements and constraints.

### Monitor in Production

Implement comprehensive monitoring.

✅ **Good**:
```typescript
const graph = builder.build();

const result = await graph.invoke(initialState, {
  onProgress: (state, nodeName) => {
    metrics.recordNodeExecution(nodeName);

    if (state.error) {
      logger.error('Node error', {
        node: nodeName,
        error: state.error,
        userId: state.userId
      });

      errorTracker.captureError(new Error(state.error), {
        node: nodeName,
        state: sanitizeState(state)
      });
    }
  }
});

metrics.recordWorkflowCompletion(result.status);
```

**Why**: Production issues need visibility for quick resolution.

### Implement Health Checks

Expose health check endpoints.

✅ **Good**:
```typescript
app.get('/health', async (req, res) => {
  const checks = {
    llm: await llmClient.testConnection(),
    database: await db.ping(),
    cache: await cache.ping()
  };

  const healthy = Object.values(checks).every(c => c);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  });
});
```

**Why**: Health checks enable automatic recovery and load balancer integration.

### Use Graceful Shutdown

Handle shutdown signals properly.

✅ **Good**:
```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop accepting new requests
  server.close();

  // Wait for in-flight requests to complete
  await waitForInflightRequests();

  // Cleanup resources
  await llmClient.shutdown();
  await db.close();

  process.exit(0);
});
```

**Why**: Graceful shutdown prevents data loss and incomplete operations.

---

## Conclusion

Following these best practices will help you build:

- ✅ **Reliable** systems with proper error handling
- ✅ **Performant** applications with optimized LLM usage
- ✅ **Secure** solutions that protect sensitive data
- ✅ **Maintainable** code that's easy to understand and modify
- ✅ **Testable** components with good coverage
- ✅ **Production-ready** deployments with monitoring

For more information:
- **API Reference**: See `API.md`
- **Examples**: Check `../examples/`
- **Migration Guide**: Read `MIGRATION.md`
