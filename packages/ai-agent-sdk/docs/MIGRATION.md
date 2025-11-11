# Migration Guide

Guide for migrating to the AI Agent SDK from other frameworks or from Browser Operator's original implementation.

## Table of Contents

- [From Browser Operator](#from-browser-operator)
- [From LangChain](#from-langchain)
- [From LlamaIndex](#from-llamaindex)
- [From Custom Implementations](#from-custom-implementations)
- [Migration Checklist](#migration-checklist)

---

## From Browser Operator

If you're migrating from Browser Operator's original `front_end/panels/ai_chat` implementation to the SDK, follow this guide.

### LLM Integration

#### Before (Browser Operator)

```typescript
// Browser Operator code
import { LLMClient } from '../../panels/ai_chat/LLM/LLMClient.js';
import { BUILD_CONFIG } from '../../../config.js';

const client = LLMClient.getInstance();

// Config loaded from localStorage
const apiKey = localStorage.getItem('openai_api_key');

const response = await client.callLLM({
  provider: 'openai',
  modelName: 'gpt-4.1',
  messages: [
    { role: 'user', content: 'Hello' }
  ]
});
```

#### After (AI Agent SDK)

```typescript
// SDK code
import { LLMClient } from '@browser-operator/ai-agent-sdk';

const client = LLMClient.getInstance();

// Explicit initialization with configuration
await client.initialize({
  providers: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY, // From env, not localStorage
      models: ['gpt-4.1']
    }
  ],
  defaultProvider: 'openai',
  defaultModel: 'gpt-4.1'
});

const response = await client.call({
  messages: [
    { role: 'user', content: 'Hello' }
  ]
});
```

**Key Changes:**
1. Explicit `initialize()` call required
2. Configuration passed programmatically (no localStorage dependency)
3. Platform-agnostic (works in Node.js, browser, serverless)
4. Method renamed: `callLLM()` → `call()`

### Graph Orchestration

#### Before (Browser Operator)

```typescript
// Browser Operator code
import { StateGraph } from '../../panels/ai_chat/core/StateGraph.js';
import { AgentNodes } from '../../panels/ai_chat/core/AgentNodes.js';

const nodes = new AgentNodes(page, devtoolsContext);

const graph = new StateGraph();
graph.addNode('start', nodes.startNode);
graph.addNode('process', nodes.processNode);
graph.addEdge('start', 'process');
graph.setEntryPoint('start');

const result = await graph.invoke(initialState);
```

#### After (AI Agent SDK)

```typescript
// SDK code
import {
  GraphBuilder,
  createAsyncTransformNode,
  END_NODE
} from '@browser-operator/ai-agent-sdk';

// Create nodes without browser dependencies
const startNode = createAsyncTransformNode<MyState>(
  'start',
  async (state) => {
    // Your logic here (no page context required)
    return { ...state, started: true };
  }
);

const processNode = createAsyncTransformNode<MyState>(
  'process',
  async (state) => {
    // Your logic here
    return { ...state, processed: true };
  }
);

// Build graph using builder pattern
const graph = new GraphBuilder<MyState>()
  .addNode('start', startNode)
  .addNode('process', processNode)
  .addEdge('start', 'process')
  .addEdge('process', END_NODE)
  .setEntryPoint('start')
  .build();

const result = await graph.invoke(initialState);
```

**Key Changes:**
1. Use `GraphBuilder` instead of direct `StateGraph` construction
2. No browser-specific dependencies (page, devtoolsContext)
3. Use helper functions (`createAsyncTransformNode`) instead of custom node implementations
4. Explicitly add edge to `END_NODE`
5. Call `.build()` to get executable graph

### Error Handling

#### Before (Browser Operator)

```typescript
// Browser Operator code
import { LLMErrorHandler } from '../../panels/ai_chat/LLM/LLMErrorHandler.js';

try {
  const response = await client.callLLM(request);
} catch (error) {
  const handler = new LLMErrorHandler();
  const shouldRetry = handler.shouldRetry(error);

  if (shouldRetry) {
    await handler.retryWithBackoff(async () => {
      return await client.callLLM(request);
    });
  }
}
```

#### After (AI Agent SDK)

```typescript
// SDK code
import {
  LLMRetryManager,
  LLMErrorClassifier
} from '@browser-operator/ai-agent-sdk';

const retryManager = new LLMRetryManager();

try {
  const response = await retryManager.executeWithRetry(
    async () => await client.call(request),
    {
      customRetryConfig: {
        maxRetries: 3,
        baseDelayMs: 1000
      },
      context: 'LLM call'
    }
  );
} catch (error) {
  const errorType = LLMErrorClassifier.classifyError(error);
  console.error(`LLM error type: ${errorType}`);
}
```

**Key Changes:**
1. Use `LLMRetryManager` instead of `LLMErrorHandler`
2. More explicit configuration options
3. Automatic error classification and retry logic
4. Context parameter for better logging

### Agent Nodes

Browser Operator's `AgentNodes.ts` contains browser-specific implementations that cannot be directly migrated. Instead, use the SDK's helper functions to create equivalent functionality.

#### Before (Browser Operator)

```typescript
// Browser Operator - Tightly coupled to browser
import { AgentNodes } from '../../panels/ai_chat/core/AgentNodes.js';

const nodes = new AgentNodes(page, devtoolsContext, tracer);

const graph = new StateGraph();
graph.addNode('screenshot', nodes.screenshotNode);
graph.addNode('click', nodes.clickNode);
graph.addNode('type', nodes.typeNode);
```

#### After (AI Agent SDK)

```typescript
// SDK - Platform-agnostic with your own browser integration
import {
  createAsyncTransformNode,
  createRetryNode
} from '@browser-operator/ai-agent-sdk';

// Create your own browser-specific nodes as needed
const screenshotNode = createAsyncTransformNode<YourState>(
  'screenshot',
  async (state) => {
    // Your screenshot implementation
    const screenshot = await yourBrowserAPI.takeScreenshot();
    return { ...state, screenshot };
  }
);

// Wrap with retry for resilience
const reliableScreenshotNode = createRetryNode(
  'reliableScreenshot',
  screenshotNode,
  { maxRetries: 3, delayMs: 1000 }
);

const graph = new GraphBuilder<YourState>()
  .addNode('screenshot', reliableScreenshotNode)
  .build();
```

**Key Changes:**
1. No built-in browser automation nodes
2. Implement browser-specific logic using your preferred automation library
3. Use SDK helpers for patterns (retry, validation, etc.)
4. Complete control over browser integration

---

## From LangChain

If you're migrating from LangChain (JavaScript/TypeScript), this section will help.

### LLM Calls

#### Before (LangChain)

```typescript
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage, SystemMessage } from 'langchain/schema';

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4',
  temperature: 0.7
});

const response = await llm.call([
  new SystemMessage('You are a helpful assistant.'),
  new HumanMessage('Hello!')
]);
```

#### After (AI Agent SDK)

```typescript
import { LLMClient } from '@browser-operator/ai-agent-sdk';

const client = LLMClient.getInstance();

await client.initialize({
  providers: [{
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    models: ['gpt-4.1']
  }],
  defaultProvider: 'openai',
  defaultModel: 'gpt-4.1'
});

const response = await client.call({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  options: {
    temperature: 0.7
  }
});
```

**Mapping:**
- `ChatOpenAI` → `LLMClient`
- `HumanMessage` → `{ role: 'user', content: '...' }`
- `SystemMessage` → `{ role: 'system', content: '...' }`
- `AIMessage` → `{ role: 'assistant', content: '...' }`

### Chains vs Graphs

#### Before (LangChain)

```typescript
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from 'langchain/prompts';

const prompt = PromptTemplate.fromTemplate(
  'Translate {text} to {language}'
);

const chain = new LLMChain({ llm, prompt });

const result = await chain.call({
  text: 'Hello',
  language: 'Spanish'
});
```

#### After (AI Agent SDK)

```typescript
import {
  GraphBuilder,
  createAsyncTransformNode,
  LLMClient,
  END_NODE
} from '@browser-operator/ai-agent-sdk';

interface TranslationState {
  text: string;
  language: string;
  translation?: string;
}

const client = LLMClient.getInstance();

const translateNode = createAsyncTransformNode<TranslationState>(
  'translate',
  async (state) => {
    const response = await client.call({
      messages: [
        {
          role: 'user',
          content: `Translate "${state.text}" to ${state.language}`
        }
      ]
    });

    return { ...state, translation: response.content };
  }
);

const graph = new GraphBuilder<TranslationState>()
  .addNode('translate', translateNode)
  .addEdge('translate', END_NODE)
  .setEntryPoint('translate')
  .build();

const result = await graph.invoke({
  text: 'Hello',
  language: 'Spanish'
});
```

**Key Differences:**
- LangChain uses chains and prompt templates
- SDK uses explicit graphs and state transformations
- SDK gives more control over state flow

### Agents

#### Before (LangChain)

```typescript
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { SerpAPI } from 'langchain/tools';

const tools = [new SerpAPI()];

const executor = await initializeAgentExecutorWithOptions(tools, llm, {
  agentType: 'zero-shot-react-description'
});

const result = await executor.call({
  input: 'What is the weather in San Francisco?'
});
```

#### After (AI Agent SDK)

```typescript
import {
  GraphBuilder,
  createAsyncTransformNode,
  createMultiConditionRouter,
  LLMClient,
  END_NODE
} from '@browser-operator/ai-agent-sdk';

interface AgentState {
  input: string;
  toolCalls: Array<{ name: string; args: any }>;
  toolResults: Array<any>;
  response?: string;
}

const client = LLMClient.getInstance();

// Define tools
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search',
      description: 'Search the web',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    }
  }
];

const reasonNode = createAsyncTransformNode<AgentState>(
  'reason',
  async (state) => {
    const response = await client.call({
      messages: [{ role: 'user', content: state.input }],
      tools
    });

    const parsed = client.parseResponse(response);

    if (parsed.toolCalls) {
      return { ...state, toolCalls: parsed.toolCalls };
    }

    return { ...state, response: parsed.content };
  }
);

const executeToolsNode = createAsyncTransformNode<AgentState>(
  'executeTools',
  async (state) => {
    const results = await Promise.all(
      state.toolCalls.map(async (call) => {
        // Execute tool (implement your tool logic)
        return await executeTool(call.name, call.args);
      })
    );

    return { ...state, toolResults: results };
  }
);

const router = createMultiConditionRouter<AgentState>(
  [
    {
      condition: (s) => !!s.response,
      route: END_NODE
    },
    {
      condition: (s) => s.toolCalls.length > 0,
      route: 'executeTools'
    }
  ],
  END_NODE
);

const graph = new GraphBuilder<AgentState>()
  .addNode('reason', reasonNode)
  .addNode('executeTools', executeToolsNode)
  .addEdge('reason', router)
  .addEdge('executeTools', 'reason')
  .setEntryPoint('reason')
  .build();

const result = await graph.invoke({
  input: 'What is the weather in San Francisco?',
  toolCalls: [],
  toolResults: []
});
```

**Key Differences:**
- LangChain has built-in agent executors
- SDK requires explicit graph construction
- SDK provides more control and visibility
- You implement tool execution logic

---

## From LlamaIndex

If you're migrating from LlamaIndex (TypeScript), follow this guide.

### Query Engines

#### Before (LlamaIndex)

```typescript
import { VectorStoreIndex, SimpleDirectoryReader } from 'llamaindex';

const documents = await new SimpleDirectoryReader().loadData('./docs');
const index = await VectorStoreIndex.fromDocuments(documents);
const queryEngine = index.asQueryEngine();

const response = await queryEngine.query('What is the main topic?');
```

#### After (AI Agent SDK)

```typescript
import {
  GraphBuilder,
  createAsyncTransformNode,
  LLMClient,
  END_NODE
} from '@browser-operator/ai-agent-sdk';

interface RAGState {
  query: string;
  retrievedDocs?: string[];
  response?: string;
}

const client = LLMClient.getInstance();

// Implement retrieval (use your preferred vector DB)
const retrieveNode = createAsyncTransformNode<RAGState>(
  'retrieve',
  async (state) => {
    const docs = await yourVectorDB.search(state.query, { topK: 5 });
    return { ...state, retrievedDocs: docs };
  }
);

// Generate response with context
const generateNode = createAsyncTransformNode<RAGState>(
  'generate',
  async (state) => {
    const context = state.retrievedDocs?.join('\n\n') || '';

    const response = await client.call({
      messages: [
        {
          role: 'system',
          content: 'Answer based on the provided context.'
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${state.query}`
        }
      ]
    });

    return { ...state, response: response.content };
  }
);

const graph = new GraphBuilder<RAGState>()
  .addNode('retrieve', retrieveNode)
  .addNode('generate', generateNode)
  .addEdge('retrieve', 'generate')
  .addEdge('generate', END_NODE)
  .setEntryPoint('retrieve')
  .build();

const result = await graph.invoke({
  query: 'What is the main topic?'
});
```

**Key Differences:**
- LlamaIndex has built-in indexing and retrieval
- SDK requires you to integrate your own vector DB
- SDK provides LLM orchestration, not data indexing
- More flexibility in retrieval strategy

---

## From Custom Implementations

If you have a custom LLM integration or state machine, here's how to migrate.

### Custom LLM Wrapper

#### Before (Custom)

```typescript
class MyLLMWrapper {
  async call(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

#### After (AI Agent SDK)

```typescript
import { LLMClient } from '@browser-operator/ai-agent-sdk';

const client = LLMClient.getInstance();

await client.initialize({
  providers: [{
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    models: ['gpt-4.1']
  }]
});

// Built-in error handling, retry logic, and provider abstraction
const response = await client.call({
  messages: [{ role: 'user', content: prompt }]
});

const content = response.content;
```

**Benefits:**
- Automatic retry and error handling
- Multi-provider support
- Response parsing (tool calls, etc.)
- Connection testing
- Usage tracking

### Custom State Machine

#### Before (Custom)

```typescript
class StateMachine {
  private currentState: string;
  private states: Map<string, Function>;
  private transitions: Map<string, string>;

  async run(initialState: any): Promise<any> {
    let state = initialState;
    this.currentState = 'start';

    while (this.currentState !== 'end') {
      const handler = this.states.get(this.currentState);
      state = await handler(state);

      const nextState = this.transitions.get(this.currentState);
      this.currentState = nextState;
    }

    return state;
  }
}
```

#### After (AI Agent SDK)

```typescript
import {
  GraphBuilder,
  createAsyncTransformNode,
  END_NODE
} from '@browser-operator/ai-agent-sdk';

const startNode = createAsyncTransformNode<YourState>(
  'start',
  async (state) => {
    // Your logic
    return transformedState;
  }
);

const processNode = createAsyncTransformNode<YourState>(
  'process',
  async (state) => {
    // Your logic
    return transformedState;
  }
);

const graph = new GraphBuilder<YourState>()
  .addNode('start', startNode)
  .addNode('process', processNode)
  .addEdge('start', 'process')
  .addEdge('process', (state) =>
    state.needsMore ? 'process' : END_NODE
  )
  .setEntryPoint('start')
  .build();

const result = await graph.invoke(initialState, {
  maxSteps: 100,
  onProgress: (state, nodeName) => {
    console.log(`Executed: ${nodeName}`);
  }
});
```

**Benefits:**
- Type-safe state management
- Conditional routing
- Progress monitoring
- Cycle detection
- Abort signal support
- Max steps protection

---

## Migration Checklist

Use this checklist when migrating to the AI Agent SDK:

### Setup

- [ ] Install SDK: `npm install @browser-operator/ai-agent-sdk`
- [ ] Set environment variables for API keys
- [ ] Remove old dependencies (if applicable)

### LLM Integration

- [ ] Replace LLM client initialization with `LLMClient.getInstance()` and `initialize()`
- [ ] Update message format to use `{ role, content }` objects
- [ ] Update method calls (`callLLM` → `call`, etc.)
- [ ] Add error handling with `LLMRetryManager`
- [ ] Remove browser-specific code (localStorage, etc.)

### Graph Orchestration

- [ ] Replace custom state machine with `GraphBuilder`
- [ ] Create nodes using helper functions (`createAsyncTransformNode`, etc.)
- [ ] Define state interface with TypeScript
- [ ] Add edges with routing logic
- [ ] Add edge to `END_NODE` for terminal nodes
- [ ] Call `.build()` to create executable graph
- [ ] Update execution to use `invoke()` or `stream()`

### Error Handling

- [ ] Replace custom retry logic with `LLMRetryManager`
- [ ] Use `LLMErrorClassifier` for error classification
- [ ] Add validation nodes for input validation
- [ ] Use error routers for error handling paths
- [ ] Add `maxSteps` protection to prevent infinite loops

### Testing

- [ ] Update tests to use new API
- [ ] Mock `LLMClient` in tests
- [ ] Test nodes in isolation
- [ ] Test complete graph workflows
- [ ] Test error paths

### Documentation

- [ ] Update code comments
- [ ] Update README/docs with new SDK usage
- [ ] Document custom nodes and routers
- [ ] Add migration notes for team

### Deployment

- [ ] Update environment configuration
- [ ] Add health checks for `LLMClient`
- [ ] Update monitoring/logging
- [ ] Test in staging environment
- [ ] Roll out to production

---

## Getting Help

If you encounter issues during migration:

1. **Check Examples**: See `../examples/` for working code
2. **Review API Docs**: Read `API.md` for detailed reference
3. **Best Practices**: Consult `BEST_PRACTICES.md` for guidelines
4. **Test Files**: Look at `../tests/` for usage patterns
5. **Open Issue**: Report problems on GitHub

---

## Next Steps

After migration:

1. **Optimize**: Review `BEST_PRACTICES.md` for optimization tips
2. **Test**: Ensure comprehensive test coverage
3. **Monitor**: Add monitoring and logging
4. **Iterate**: Refine your graphs and nodes based on production usage

Welcome to the AI Agent SDK! 🎉
