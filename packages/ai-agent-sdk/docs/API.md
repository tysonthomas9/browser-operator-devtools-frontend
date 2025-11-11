# AI Agent SDK API Reference

Complete API documentation for the AI Agent SDK.

## Table of Contents

- [LLM Integration](#llm-integration)
  - [LLMClient](#llmclient)
  - [LLM Providers](#llm-providers)
  - [Error Handling](#error-handling)
  - [Message Types](#message-types)
- [Graph Orchestration](#graph-orchestration)
  - [GraphBuilder](#graphbuilder)
  - [StateGraph](#stategraph)
  - [Graph Helpers](#graph-helpers)
- [Agent Framework](#agent-framework)
  - [Agent Base Classes](#agent-base-classes)
  - [Message Queue](#message-queue)
- [Utilities](#utilities)
  - [Runnable](#runnable)
  - [Types](#types)

---

## LLM Integration

### LLMClient

The central coordinator for managing multiple LLM providers.

#### Methods

##### `getInstance(): LLMClient`

Get the singleton instance of LLMClient.

```typescript
import { LLMClient } from '@browser-operator/ai-agent-sdk';

const client = LLMClient.getInstance();
```

##### `initialize(config: LLMClientConfig): Promise<void>`

Initialize the client with provider configurations.

```typescript
await client.initialize({
  providers: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      models: ['gpt-4.1', 'o3-mini']
    },
    {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      models: ['llama-3.3-70b']
    }
  ],
  defaultProvider: 'openai',
  defaultModel: 'gpt-4.1'
});
```

**Parameters:**
- `config.providers`: Array of provider configurations
- `config.defaultProvider`: Provider to use when not specified
- `config.defaultModel`: Model to use when not specified

**Throws:** Error if initialization fails

##### `call(request: LLMCallRequest): Promise<LLMResponse>`

Make an LLM call.

```typescript
const response = await client.call({
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  provider: 'openai', // Optional, uses default if not specified
  modelName: 'gpt-4.1', // Optional, uses default if not specified
  options: {
    temperature: 0.7,
    maxTokens: 500
  },
  tools: [...], // Optional function calling
  agentName: 'my-agent' // Optional agent identifier
});
```

**Parameters:**
- `request.messages`: Array of LLM messages
- `request.provider?`: Override default provider
- `request.modelName?`: Override default model
- `request.options?`: LLM call options (temperature, maxTokens, etc.)
- `request.tools?`: Function/tool definitions
- `request.agentName?`: Agent identifier for routing

**Returns:** `LLMResponse` with content, usage stats, and metadata

##### `parseResponse(response: LLMResponse): ParsedLLMResponse`

Parse an LLM response to extract tool calls and clean content.

```typescript
const parsed = client.parseResponse(response);

if (parsed.toolCalls && parsed.toolCalls.length > 0) {
  for (const toolCall of parsed.toolCalls) {
    console.log(`Tool: ${toolCall.name}`);
    console.log(`Args: ${JSON.stringify(toolCall.arguments)}`);
  }
}

console.log(`Content: ${parsed.content}`);
```

**Returns:**
- `content`: Clean text content
- `toolCalls?`: Array of tool call objects
- `stopReason`: Why generation stopped

##### `getAvailableModels(): Promise<ModelInfo[]>`

Get all available models across registered providers.

```typescript
const models = await client.getAvailableModels();

for (const model of models) {
  console.log(`${model.id} (${model.provider})`);
  console.log(`  Vision: ${model.capabilities?.supportsVision}`);
  console.log(`  Tools: ${model.capabilities?.supportsTools}`);
}
```

**Returns:** Array of `ModelInfo` objects with capabilities

##### `testConnection(provider?: LLMProvider): Promise<boolean>`

Test connection to a provider.

```typescript
const isConnected = await client.testConnection('openai');
```

**Parameters:**
- `provider?`: Specific provider to test, or all if not specified

**Returns:** `true` if connection successful

---

### LLM Providers

#### OpenAIProvider

Provider for OpenAI's GPT models using the Responses API.

```typescript
import { OpenAIProvider } from '@browser-operator/ai-agent-sdk';

const provider = new OpenAIProvider('your-api-key');
```

**Supported Models:**
- GPT-4.1
- O3-Mini, O4-Mini
- GPT-5 (when available)

**Features:**
- Responses API format
- Vision support (multimodal content)
- Function calling
- Temperature control (GPT models only)

#### GroqProvider

Provider for Groq's fast inference API.

```typescript
import { GroqProvider } from '@browser-operator/ai-agent-sdk';

const provider = new GroqProvider('your-api-key');
```

**Supported Models:**
- Llama 3.3 (70B, 8B)
- Mixtral (8x7B, 8x22B)
- Gemma (7B, 2B)
- LLaVA vision models

**Features:**
- Ultra-low latency inference
- Function calling
- Vision models

#### LiteLLMProvider

Provider for LiteLLM proxy (OpenAI-compatible).

```typescript
import { LiteLLMProvider } from '@browser-operator/ai-agent-sdk';

const provider = new LiteLLMProvider(
  'your-api-key',
  'http://localhost:4000', // Optional base URL
  [ // Optional custom models
    { id: 'custom-model', name: 'Custom Model' }
  ]
);
```

**Features:**
- Unified interface to 100+ LLM providers
- Custom model support
- Dynamic model discovery
- OpenAI-compatible API

#### OpenRouterProvider

Provider for OpenRouter model aggregator.

```typescript
import { OpenRouterProvider } from '@browser-operator/ai-agent-sdk';

const provider = new OpenRouterProvider('your-api-key');
```

**Features:**
- Access to 100+ models
- Automatic pricing optimization
- Vision model support
- Temperature handling for all model types

#### BrowserOperatorProvider

Provider for BrowserOperator's semantic routing API.

```typescript
import { BrowserOperatorProvider } from '@browser-operator/ai-agent-sdk';

const provider = new BrowserOperatorProvider(
  'your-api-key',
  'http://localhost:3000'
);
```

**Features:**
- Semantic agent routing via X-Agent header
- Model aliases (main, mini, nano)
- Custom base URL support

---

### Error Handling

#### LLMErrorClassifier

Classifies LLM errors and determines retry strategy.

```typescript
import { LLMErrorClassifier } from '@browser-operator/ai-agent-sdk';

const errorType = LLMErrorClassifier.classifyError(error);
const shouldRetry = LLMErrorClassifier.shouldRetry(errorType);
const retryConfig = LLMErrorClassifier.getRetryConfig(errorType);
```

**Error Types:**
- `RATE_LIMIT`: Rate limit exceeded
- `NETWORK_ERROR`: Network/connection issues
- `SERVER_ERROR`: Server-side errors (5xx)
- `AUTH_ERROR`: Authentication failed
- `QUOTA_ERROR`: Quota/credits exhausted
- `JSON_PARSE_ERROR`: Invalid JSON response
- `UNKNOWN`: Other errors

**Methods:**

##### `classifyError(error: Error): LLMErrorType`

Classify an error by analyzing its message.

##### `shouldRetry(errorType: LLMErrorType): boolean`

Determine if an error type should be retried.

**Retryable:** RATE_LIMIT, NETWORK_ERROR, SERVER_ERROR, JSON_PARSE_ERROR
**Not Retryable:** AUTH_ERROR, QUOTA_ERROR

##### `getRetryConfig(errorType: LLMErrorType, customConfig?: Partial<RetryConfig>): RetryConfig`

Get retry configuration for an error type.

**Default Configs:**
- Rate limit: 60s base delay, 3 max retries
- Network/Server: 2s base delay, 3 max retries
- JSON parse: 1s base delay, 2 max retries

#### LLMRetryManager

Manages retry logic with exponential backoff.

```typescript
import { LLMRetryManager } from '@browser-operator/ai-agent-sdk';

const retryManager = new LLMRetryManager();

const result = await retryManager.executeWithRetry(
  async () => {
    // Your operation
    return await someOperation();
  },
  {
    customRetryConfig: {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      exponentialBase: 2,
      jitterMs: 100
    },
    context: 'Operation description'
  }
);
```

**Methods:**

##### `executeWithRetry<T>(operation, options?): Promise<T>`

Execute an operation with automatic retry logic.

**Parameters:**
- `operation`: Async function to execute
- `options.customRetryConfig?`: Custom retry configuration
- `options.context?`: Description for logging

**Returns:** Result of successful operation

**Throws:** Error if all retries exhausted

##### `static simpleRetry<T>(operation, customConfig?): Promise<T>`

Static helper for simple retry scenarios.

```typescript
const result = await LLMRetryManager.simpleRetry(
  async () => await fetchData(),
  { maxRetries: 3, baseDelayMs: 500 }
);
```

---

### Message Types

#### LLMMessage

```typescript
interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MultiModalContent[];
  name?: string; // For tool messages
  toolCalls?: ToolCall[]; // For assistant messages
  toolCallId?: string; // For tool result messages
}
```

#### MultiModalContent

For vision models:

```typescript
type MultiModalContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };
```

Example:
```typescript
const message: LLMMessage = {
  role: 'user',
  content: [
    { type: 'text', text: 'What is in this image?' },
    { type: 'image_url', image_url: { url: 'https://...' } }
  ]
};
```

#### ToolCall

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}
```

#### Tool Definition

```typescript
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}
```

---

## Graph Orchestration

### GraphBuilder

Fluent API for building state machines.

```typescript
import { GraphBuilder, END_NODE } from '@browser-operator/ai-agent-sdk';

const graph = new GraphBuilder<MyState>()
  .addNode('start', startNode)
  .addNode('process', processNode)
  .addEdge('start', 'process')
  .addEdge('process', END_NODE)
  .setEntryPoint('start')
  .build();
```

#### Methods

##### `addNode(name: string, node: Runnable<TState, TState>): this`

Add a node to the graph.

```typescript
builder.addNode('myNode', {
  invoke: async (state) => {
    return { ...state, processed: true };
  }
});
```

##### `addEdge(from: string, to: string | ((state: TState) => string)): this`

Add an edge (transition) between nodes.

```typescript
// Static edge
builder.addEdge('nodeA', 'nodeB');

// Conditional edge
builder.addEdge('nodeA', (state) =>
  state.hasError ? 'errorHandler' : 'success'
);
```

##### `setEntryPoint(entryPoint: string | ((state: TState) => string)): this`

Set the starting node.

```typescript
// Static entry point
builder.setEntryPoint('start');

// Dynamic entry point
builder.setEntryPoint((state) =>
  state.isUrgent ? 'urgentPath' : 'normalPath'
);
```

##### `build(): StateGraph<TState>`

Build the state graph.

**Throws:** Error if graph has cycles or missing nodes

---

### StateGraph

Executable state machine.

#### Methods

##### `invoke(initialState: TState, options?: GraphExecutionOptions): Promise<TState>`

Execute the graph and return final state.

```typescript
const result = await graph.invoke(
  { count: 0 },
  {
    maxSteps: 100,
    signal: abortController.signal,
    onProgress: (state, nodeName) => {
      console.log(`Executed: ${nodeName}`);
    }
  }
);
```

**Options:**
- `maxSteps?`: Maximum execution steps (default: 100)
- `signal?`: AbortSignal for cancellation
- `onProgress?`: Callback on each node execution

**Returns:** Final state

**Throws:** Error if max steps exceeded or execution fails

##### `stream(initialState: TState, options?: GraphExecutionOptions): AsyncGenerator<TState>`

Execute the graph and yield intermediate states.

```typescript
for await (const state of graph.stream({ count: 0 })) {
  console.log(`Current count: ${state.count}`);
}
```

**Yields:** State after each node execution

---

### Graph Helpers

#### GraphNodeHelpers

Create common node patterns.

##### `createTransformNode<TState>(name, transform): Runnable<TState, TState>`

Create a synchronous transform node.

```typescript
import { createTransformNode } from '@browser-operator/ai-agent-sdk';

const incrementNode = createTransformNode<{ count: number }>(
  'increment',
  (state) => ({ ...state, count: state.count + 1 })
);
```

##### `createAsyncTransformNode<TState>(name, transform): Runnable<TState, TState>`

Create an asynchronous transform node.

```typescript
import { createAsyncTransformNode } from '@browser-operator/ai-agent-sdk';

const fetchNode = createAsyncTransformNode<{ data?: string }>(
  'fetch',
  async (state, signal) => {
    const data = await fetchData(signal);
    return { ...state, data };
  }
);
```

##### `createConditionalNode<TState>(name, condition, ifTrue, ifFalse): Runnable<TState, TState>`

Create a conditional branching node.

```typescript
import { createConditionalNode } from '@browser-operator/ai-agent-sdk';

const validateNode = createConditionalNode<{ value: number, valid?: boolean }>(
  'validate',
  (state) => state.value > 0,
  (state) => ({ ...state, valid: true }),
  (state) => ({ ...state, valid: false })
);
```

##### `createValidationNode<TState extends { error?: string }>(name, validate, errorMessage): Runnable<TState, TState>`

Create a validation node that sets error field.

```typescript
import { createValidationNode } from '@browser-operator/ai-agent-sdk';

const checkNode = createValidationNode<{ data: string, error?: string }>(
  'check',
  (state) => state.data.length > 0,
  'Data cannot be empty'
);
```

##### `createRetryNode<TState>(name, node, options): Runnable<TState, TState>`

Wrap a node with retry logic.

```typescript
import { createRetryNode } from '@browser-operator/ai-agent-sdk';

const reliableNode = createRetryNode<MyState>(
  'reliable',
  unreliableNode,
  {
    maxRetries: 3,
    delayMs: 1000,
    shouldRetry: (error) => error.message.includes('timeout')
  }
);
```

##### `createLoggingNode<TState>(name, getMessage): Runnable<TState, TState>`

Create a logging node.

```typescript
import { createLoggingNode } from '@browser-operator/ai-agent-sdk';

const logNode = createLoggingNode<{ count: number }>(
  'log',
  (state) => `Count is now: ${state.count}`
);
```

##### `createFinalNode<TState>(name, validateFinal?): Runnable<TState, TState>`

Create a final node (terminal).

```typescript
import { createFinalNode } from '@browser-operator/ai-agent-sdk';

const finishNode = createFinalNode<{ complete: boolean }>(
  'finish',
  (state) => state.complete === true
);
```

##### `createPassthroughNode<TState>(name): Runnable<TState, TState>`

Create a passthrough node (no-op).

```typescript
import { createPassthroughNode } from '@browser-operator/ai-agent-sdk';

const noopNode = createPassthroughNode<MyState>('noop');
```

#### GraphRoutingHelpers

Create routing functions for conditional edges.

##### `createPropertyRouter<TState>(propertyName, routeMap, defaultRoute?): (state: TState) => string`

Route based on a state property value.

```typescript
import { createPropertyRouter } from '@browser-operator/ai-agent-sdk';

const statusRouter = createPropertyRouter<{ status: string }>(
  'status',
  {
    'pending': 'process',
    'complete': 'finish',
    'error': 'handleError'
  },
  'process' // default route
);
```

##### `createConditionalRouter<TState>(condition, ifTrue, ifFalse): (state: TState) => string`

Route based on a boolean condition.

```typescript
import { createConditionalRouter } from '@browser-operator/ai-agent-sdk';

const errorRouter = createConditionalRouter<{ error?: string }>(
  (state) => !!state.error,
  'errorHandler',
  'success'
);
```

##### `createErrorRouter<TState extends { error?: string | Error }>(errorRoute, successRoute): (state: TState) => string`

Route based on error presence.

```typescript
import { createErrorRouter } from '@browser-operator/ai-agent-sdk';

const router = createErrorRouter<{ error?: string }>(
  'handleError',
  'continue'
);
```

##### `createMultiConditionRouter<TState>(conditions, defaultRoute?): (state: TState) => string`

Route based on multiple conditions (evaluated in order).

```typescript
import { createMultiConditionRouter } from '@browser-operator/ai-agent-sdk';

const router = createMultiConditionRouter<MyState>(
  [
    { condition: (s) => s.urgent, route: 'urgentHandler' },
    { condition: (s) => s.priority > 5, route: 'highPriority' },
    { condition: (s) => s.complete, route: END_NODE }
  ],
  'normalHandler'
);
```

##### `createRangeRouter<TState>(getValue, ranges, defaultRoute?): (state: TState) => string`

Route based on numeric value ranges.

```typescript
import { createRangeRouter } from '@browser-operator/ai-agent-sdk';

const scoreRouter = createRangeRouter<{ score: number }>(
  (state) => state.score,
  [
    { max: 0.3, route: 'lowQuality' },
    { max: 0.7, route: 'mediumQuality' },
    { max: 1.0, route: 'highQuality' }
  ]
);
```

##### `createCycleRouter<TState>(getIndex, nodes, finalRoute?): (state: TState) => string`

Route through a cycle of nodes.

```typescript
import { createCycleRouter } from '@browser-operator/ai-agent-sdk';

const cycleRouter = createCycleRouter<{ step: number }>(
  (state) => state.step,
  ['stepA', 'stepB', 'stepC'],
  END_NODE
);
```

##### `createEndRouter<TState>(): (state: TState) => string`

Always route to END_NODE.

##### `createFixedRouter<TState>(route): (state: TState) => string`

Always route to a specific node.

##### `combineRouters<TState>(routers, fallbackRoute?): (state: TState) => string`

Combine multiple routers (returns first non-END result).

```typescript
import { combineRouters } from '@browser-operator/ai-agent-sdk';

const combinedRouter = combineRouters<MyState>(
  [errorRouter, statusRouter, priorityRouter],
  'default'
);
```

---

## Agent Framework

### Agent Base Classes

#### BaseAgent

Abstract base class for agents.

```typescript
import { BaseAgent } from '@browser-operator/ai-agent-sdk';

class MyAgent extends BaseAgent {
  async initialize(): Promise<void> {
    // Setup logic
  }

  async execute(input: any): Promise<any> {
    // Main agent logic
    return result;
  }

  async shutdown(): Promise<void> {
    // Cleanup logic
  }
}
```

---

## Utilities

### Runnable

Interface for executable components.

```typescript
interface Runnable<TInput, TOutput> {
  invoke(input: TInput, signal?: AbortSignal): Promise<TOutput>;
}
```

Implement for custom nodes:

```typescript
class CustomNode implements Runnable<MyState, MyState> {
  async invoke(state: MyState, signal?: AbortSignal): Promise<MyState> {
    // Node logic
    return transformedState;
  }
}
```

---

## Constants

### END_NODE

Special constant representing graph termination.

```typescript
import { END_NODE } from '@browser-operator/ai-agent-sdk';

builder.addEdge('finish', END_NODE);
```

---

## Type Exports

All major types are exported:

```typescript
import type {
  // LLM types
  LLMMessage,
  LLMCallRequest,
  LLMResponse,
  LLMProvider,
  LLMCallOptions,
  ModelInfo,
  ToolDefinition,
  ToolCall,

  // Error types
  LLMErrorType,
  RetryConfig,

  // Graph types
  Runnable,
  GraphExecutionOptions,

  // Agent types
  AgentConfig
} from '@browser-operator/ai-agent-sdk';
```

---

## Next Steps

- **Examples**: See `../examples/` for practical usage examples
- **Best Practices**: Read `BEST_PRACTICES.md` for guidelines
- **Migration**: Check `MIGRATION.md` if migrating from another framework
