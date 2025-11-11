# AI Agent SDK Abstraction Plan

**Date:** November 11, 2025
**Project:** Extract Browser Operator AI Chat Framework as Standalone SDK
**Target Package:** `@browser-operator/ai-agent-sdk`

## Executive Summary

This document outlines a comprehensive plan to abstract the core AI agent framework from Browser Operator's `ai_chat` module into a standalone, platform-agnostic SDK. The SDK will enable developers to build multi-agent AI systems for any domain, not just browser automation.

## Current Architecture Analysis

### Core Components (from `front_end/panels/ai_chat/`)

#### 1. Agent Framework Layer (`agent_framework/`)
- **AgentRunner.ts**: Iteration-based execution loop managing LLM calls, tool execution, and agent handoffs
- **ConfigurableAgentTool.ts**: Configurable agents that can function as tools themselves
- **AgentSessionTypes.ts**: Session and message type definitions
- **AgentRunnerEventBus.ts**: Event-driven communication between agents

**Key Features:**
- Multi-iteration execution with max iteration limits
- Agent-to-agent handoff mechanism (LLM-triggered or max-iteration-triggered)
- Hooks for customizing behavior (prepareMessages, createSuccessResult, etc.)
- Event bus for real-time updates

#### 2. LLM Integration Layer (`LLM/`)
- **LLMClient.ts**: Unified interface for multiple LLM providers
- **Providers**: OpenAI, LiteLLM, Groq, OpenRouter, BrowserOperator
- **LLMProviderRegistry.ts**: Dynamic provider registration
- **LLMResponseParser.ts**: Unified response parsing
- **MessageSanitizer.ts**: Message cleanup and validation

**Key Features:**
- Multi-provider support (5+ providers)
- Automatic model type detection
- Tool/function calling standardization across providers
- Retry logic and error handling

#### 3. Graph Orchestration Layer (`core/`)
- **StateGraph.ts**: Generic state machine executor
- **Graph.ts**: Node-based workflow system (AgentNode, ToolExecutorNode, FinalNode)
- **ConfigurableGraph.ts**: Configuration-driven graph building
- **GraphConfigs.ts**: Predefined graph templates

**Key Features:**
- Two-tier orchestration (Primary StateGraph + Secondary AgentRunner)
- Conditional routing between nodes
- Streaming state updates
- Tracing and observability built-in

#### 4. Tool System (`tools/`)
- **Tool Interface**: Schema-based tool definitions
- **Tool Registry**: Dynamic tool registration and resolution
- **Built-in Tools**: FetcherTool, SequentialThinkingTool, etc.

**Key Features:**
- JSON schema validation
- Context passing (API keys, models, abort signals)
- Async execution
- Error handling

#### 5. Supporting Infrastructure
- **Observability** (`tracing/`): Tracing provider for LangSmith/OpenTelemetry
- **Logger** (`core/Logger.ts`): Structured logging
- **Error Handling** (`core/AgentErrorHandler.ts`): Centralized error management
- **Message Types** (`models/ChatTypes.ts`): Type-safe message definitions

### Architecture Strengths

✅ **Clean Separation**: Core logic is largely independent of browser-specific code
✅ **Extensible**: Tool and provider systems support easy extensions
✅ **Multi-Provider**: Already supports 5+ LLM providers
✅ **Observable**: Built-in tracing and logging
✅ **Two-Tier Orchestration**: Elegant primary graph + tool-level agent pattern
✅ **Production-Tested**: Running in Browser Operator

### Browser-Specific Dependencies to Remove

❌ **Browser Automation Tools**: DOM inspection, accessibility tree, screenshots, clicks
❌ **DevTools SDK**: Direct imports from Chrome DevTools SDK
❌ **PageInfoManager**: Browser page context extraction
❌ **UI Components**: ChatView, AIChatPanel (stay in Browser Operator)

---

## SDK Package Structure

```
@browser-operator/ai-agent-sdk/
├── src/
│   ├── agent/
│   │   ├── AgentRunner.ts              # Core agent execution loop
│   │   ├── ConfigurableAgent.ts        # Configurable agent (renamed from ConfigurableAgentTool)
│   │   ├── AgentRegistry.ts            # Agent registration and discovery
│   │   ├── AgentSession.ts             # Session management
│   │   ├── EventBus.ts                 # Agent event bus
│   │   └── types.ts                    # Agent-related types
│   │
│   ├── llm/
│   │   ├── LLMClient.ts                # Unified LLM client coordinator
│   │   ├── providers/
│   │   │   ├── OpenAIProvider.ts       # OpenAI integration
│   │   │   ├── LiteLLMProvider.ts      # LiteLLM proxy integration
│   │   │   ├── GroqProvider.ts         # Groq integration
│   │   │   ├── OpenRouterProvider.ts   # OpenRouter integration
│   │   │   ├── BrowserOperatorProvider.ts  # Browser Operator cloud
│   │   │   └── ProviderInterface.ts    # Provider contract
│   │   ├── LLMProviderRegistry.ts      # Provider registration
│   │   ├── LLMResponseParser.ts        # Response parsing
│   │   ├── MessageSanitizer.ts         # Message cleanup
│   │   ├── ErrorHandler.ts             # LLM error handling
│   │   └── types.ts                    # LLM types
│   │
│   ├── orchestration/
│   │   ├── StateGraph.ts               # State machine executor
│   │   ├── Graph.ts                    # Graph builder and nodes
│   │   ├── ConfigurableGraph.ts        # Graph configuration system
│   │   ├── GraphHelpers.ts             # Graph utilities
│   │   └── types.ts                    # Graph types
│   │
│   ├── tools/
│   │   ├── Tool.ts                     # Tool interface and base classes
│   │   ├── ToolRegistry.ts             # Tool registration system
│   │   ├── ToolExecutor.ts             # Tool execution logic
│   │   └── builtin/                    # Optional built-in tools
│   │       ├── FetcherTool.ts          # HTTP fetching
│   │       └── SequentialThinkingTool.ts  # Structured thinking
│   │
│   ├── messaging/
│   │   ├── ChatMessage.ts              # Message types (User, Model, Tool Result)
│   │   └── MessageHelpers.ts           # Message utilities
│   │
│   ├── context/
│   │   ├── ContextProvider.ts          # Context provider interface
│   │   └── SimpleContextProvider.ts    # Basic implementation
│   │
│   ├── observability/
│   │   ├── Logger.ts                   # Structured logging
│   │   ├── TracingProvider.ts          # Tracing interface
│   │   ├── LangSmithTracing.ts         # LangSmith integration
│   │   └── types.ts                    # Observability types
│   │
│   ├── errors/
│   │   ├── AgentError.ts               # Error classes
│   │   └── ErrorHandler.ts             # Error handling utilities
│   │
│   └── index.ts                        # Main SDK exports
│
├── examples/
│   ├── 01-simple-agent/               # Basic agent with OpenAI
│   ├── 02-multi-provider/             # Using multiple LLM providers
│   ├── 03-custom-tools/               # Creating custom tools
│   ├── 04-agent-handoff/              # Multi-agent collaboration
│   ├── 05-graph-workflow/             # Graph-based workflows
│   └── 06-context-provider/           # Custom context injection
│
├── docs/
│   ├── getting-started.md             # Quick start guide
│   ├── architecture.md                # Architecture overview
│   ├── agents/
│   │   ├── creating-agents.md         # Agent creation guide
│   │   ├── agent-handoffs.md          # Multi-agent patterns
│   │   └── agent-sessions.md          # Session management
│   ├── tools/
│   │   ├── tool-interface.md          # Tool development
│   │   ├── builtin-tools.md           # Built-in tools reference
│   │   └── tool-registry.md           # Registry usage
│   ├── llm/
│   │   ├── providers.md               # Provider guide
│   │   ├── openai.md                  # OpenAI setup
│   │   ├── litellm.md                 # LiteLLM setup
│   │   └── custom-provider.md         # Custom provider
│   ├── orchestration/
│   │   ├── state-graph.md             # StateGraph guide
│   │   ├── graph-config.md            # Configuration
│   │   └── workflows.md               # Workflow patterns
│   ├── observability/
│   │   ├── logging.md                 # Logging guide
│   │   └── tracing.md                 # Tracing setup
│   ├── migration/
│   │   └── from-browser-operator.md   # Migration guide
│   └── api/
│       └── reference.md               # API reference
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── tsconfig.json
├── .eslintrc.js
├── jest.config.js
├── .npmignore
└── README.md
```

---

## Key SDK Interfaces

### 1. Agent Configuration

```typescript
export interface AgentConfig {
  /** Unique identifier for the agent */
  name: string;

  /** Description for LLM understanding when used as tool */
  description: string;

  /** System prompt defining agent behavior */
  systemPrompt: string;

  /** Tool names from ToolRegistry */
  tools: string[];

  /** Optional handoff configurations */
  handoffs?: HandoffConfig[];

  /** Maximum iterations before stopping */
  maxIterations?: number;

  /** Model to use (defaults to global config) */
  modelName?: string;

  /** Temperature (0-2, defaults to 0.7) */
  temperature?: number;

  /** Input schema for agent arguments */
  schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  /** UI configuration (optional) */
  uiConfig?: AgentUIConfig;

  /** Custom message preparation */
  prepareMessages?: (messages: ChatMessage[]) => ChatMessage[];

  /** Custom success result formatting */
  createSuccessResult?: (
    output: string,
    steps: ChatMessage[],
    reason: AgentRunTerminationReason
  ) => AgentResult;

  /** Custom error result formatting */
  createErrorResult?: (
    error: string,
    steps: ChatMessage[],
    reason: AgentRunTerminationReason
  ) => AgentResult;
}
```

### 2. Tool Interface

```typescript
export interface Tool<TArgs = any, TResult = any> {
  /** Unique tool name */
  name: string;

  /** Description for LLM understanding */
  description: string;

  /** JSON schema for tool arguments */
  schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  /** Execute the tool */
  execute: (args: TArgs, context?: ToolContext) => Promise<TResult>;
}

export interface ToolContext {
  /** API key for LLM calls */
  apiKey?: string;

  /** LLM provider */
  provider: LLMProvider;

  /** Model name */
  model: string;

  /** Mini model for smaller operations */
  miniModel?: string;

  /** Nano model for fastest operations */
  nanoModel?: string;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Optional context provider */
  contextProvider?: ContextProvider;

  /** Vision capability checker */
  getVisionCapability?: (model: string) => Promise<boolean> | boolean;
}
```

### 3. Context Provider Interface

```typescript
export interface ContextProvider {
  /** Get current context data */
  getContext(): Promise<Record<string, any>>;

  /** Enhance prompt with context */
  enhancePrompt(prompt: string, context?: Record<string, any>): Promise<string>;
}

// Example implementation
export class SimpleContextProvider implements ContextProvider {
  constructor(private contextData: Record<string, any> = {}) {}

  async getContext(): Promise<Record<string, any>> {
    return this.contextData;
  }

  async enhancePrompt(prompt: string, context?: Record<string, any>): Promise<string> {
    const ctx = context || await this.getContext();
    const contextString = Object.entries(ctx)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    return `${prompt}\n\nContext:\n${contextString}`;
  }

  updateContext(newContext: Record<string, any>): void {
    this.contextData = { ...this.contextData, ...newContext };
  }
}
```

### 4. Graph Configuration

```typescript
export interface GraphConfig {
  /** Graph name */
  name: string;

  /** Node configurations */
  nodes: {
    [nodeName: string]: {
      type: 'agent' | 'tool_executor' | 'final' | 'custom';
      config?: any;
    };
  };

  /** Edge configurations */
  edges: {
    [sourceName: string]: {
      condition?: string | ((state: any) => string);
      targets: Record<string, string>;
    };
  };

  /** Entry point node */
  entryPoint: string;
}
```

### 5. LLM Provider Interface

```typescript
export interface LLMProvider {
  /** Provider name */
  name: 'openai' | 'litellm' | 'groq' | 'openrouter' | 'browseroperator';

  /** Call the LLM */
  call(request: LLMCallRequest): Promise<LLMResponse>;

  /** Get available models */
  getAvailableModels(): Promise<ModelInfo[]>;

  /** Test connection */
  testConnection(): Promise<boolean>;
}

export interface LLMCallRequest {
  model: string;
  messages: LLMMessage[];
  systemPrompt?: string;
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  retryConfig?: RetryConfig;
}
```

---

## Usage Examples

### Example 1: Simple Agent

```typescript
import {
  AgentRunner,
  LLMClient,
  ToolRegistry,
  ConfigurableAgent,
  FetcherTool
} from '@browser-operator/ai-agent-sdk';

// Initialize LLM client
const llmClient = LLMClient.getInstance();
await llmClient.initialize({
  providers: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY
    }
  ]
});

// Register tools
const fetcherTool = new FetcherTool();
ToolRegistry.registerToolFactory('fetch_url', () => fetcherTool);

// Create agent configuration
const researchAgentConfig = {
  name: 'research_agent',
  description: 'Conducts research on topics',
  systemPrompt: `You are a research assistant. Use the fetch_url tool to gather information.`,
  tools: ['fetch_url'],
  maxIterations: 5,
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Research query' }
    },
    required: ['query']
  }
};

// Create agent
const researchAgent = new ConfigurableAgent(researchAgentConfig);

// Run agent
const result = await AgentRunner.run(
  [{ entity: 'user', text: 'Research quantum computing' }],
  { query: 'quantum computing' },
  {
    apiKey: process.env.OPENAI_API_KEY,
    provider: 'openai',
    modelName: 'gpt-4',
    systemPrompt: researchAgentConfig.systemPrompt,
    tools: [fetcherTool],
    maxIterations: 5,
  },
  {
    createSuccessResult: (output, steps, reason) => ({
      success: true,
      output,
      steps,
      reason
    }),
    createErrorResult: (error, steps, reason) => ({
      success: false,
      error,
      steps,
      reason
    })
  },
  researchAgent
);

console.log('Result:', result.output);
```

### Example 2: Multi-Agent Handoff

```typescript
import { ConfigurableAgent, ToolRegistry } from '@browser-operator/ai-agent-sdk';

// Create research agent
const researchAgent = new ConfigurableAgent({
  name: 'research_agent',
  description: 'Conducts initial research',
  systemPrompt: 'You research topics and hand off to writer agent.',
  tools: ['fetch_url'],
  handoffs: [
    {
      targetAgentName: 'writer_agent',
      trigger: 'llm_tool_call',
      includeToolResults: ['fetch_url']
    }
  ],
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string' }
    }
  }
});

// Create writer agent
const writerAgent = new ConfigurableAgent({
  name: 'writer_agent',
  description: 'Writes articles based on research',
  systemPrompt: 'You write engaging articles from research data.',
  tools: [],
  schema: {
    type: 'object',
    properties: {
      research_data: { type: 'string' }
    }
  }
});

// Register agents
ToolRegistry.registerToolFactory('research_agent', () => researchAgent);
ToolRegistry.registerToolFactory('writer_agent', () => writerAgent);

// Run primary agent (will hand off to writer)
const result = await researchAgent.execute(
  { topic: 'AI Ethics' },
  {
    apiKey: process.env.OPENAI_API_KEY,
    provider: 'openai',
    model: 'gpt-4'
  }
);
```

### Example 3: Custom Tool

```typescript
import { Tool, ToolContext } from '@browser-operator/ai-agent-sdk';

class WeatherTool implements Tool<{ city: string }, { temperature: number, condition: string }> {
  name = 'get_weather';
  description = 'Get current weather for a city';
  schema = {
    type: 'object' as const,
    properties: {
      city: {
        type: 'string',
        description: 'City name'
      }
    },
    required: ['city']
  };

  async execute(
    args: { city: string },
    context?: ToolContext
  ): Promise<{ temperature: number, condition: string }> {
    // Your weather API logic here
    const response = await fetch(
      `https://api.weather.com/v1/${args.city}`,
      { signal: context?.abortSignal }
    );

    const data = await response.json();

    return {
      temperature: data.temp,
      condition: data.condition
    };
  }
}

// Register and use
ToolRegistry.registerToolFactory('get_weather', () => new WeatherTool());
```

### Example 4: Custom Context Provider

```typescript
import { ContextProvider } from '@browser-operator/ai-agent-sdk';

class DatabaseContextProvider implements ContextProvider {
  constructor(private db: Database) {}

  async getContext(): Promise<Record<string, any>> {
    const user = await this.db.getCurrentUser();
    const preferences = await this.db.getUserPreferences(user.id);

    return {
      user: user.name,
      preferences,
      timestamp: new Date().toISOString()
    };
  }

  async enhancePrompt(prompt: string): Promise<string> {
    const context = await this.getContext();

    return `
User: ${context.user}
Preferences: ${JSON.stringify(context.preferences)}

${prompt}
    `.trim();
  }
}

// Use in tool context
const context: ToolContext = {
  apiKey: process.env.OPENAI_API_KEY,
  provider: 'openai',
  model: 'gpt-4',
  contextProvider: new DatabaseContextProvider(myDatabase)
};
```

---

## Implementation Plan

### Phase 1: Core SDK Foundation (Weeks 1-2)

**Objectives:**
- Establish package structure and build system
- Extract LLM layer with all providers
- Create message types and basic infrastructure

**Tasks:**
1. **Project Setup**
   - Create npm package `@browser-operator/ai-agent-sdk`
   - Set up TypeScript with strict mode
   - Configure build system (tsup or rollup)
   - Set up testing (Jest)
   - Configure ESLint and Prettier
   - Set up CI/CD pipeline

2. **LLM Layer Extraction**
   - Copy and clean LLM provider implementations:
     - `OpenAIProvider.ts`
     - `LiteLLMProvider.ts`
     - `GroqProvider.ts`
     - `OpenRouterProvider.ts`
     - `BrowserOperatorProvider.ts`
   - Extract `LLMClient.ts` (remove DevTools deps)
   - Extract `LLMProviderRegistry.ts`
   - Extract `LLMResponseParser.ts`
   - Extract `MessageSanitizer.ts`
   - Create `LLMTypes.ts` (unified types)
   - Write comprehensive tests for each provider

3. **Message Types**
   - Extract from `ChatTypes.ts`
   - Remove UI-specific fields
   - Add utility functions for message manipulation

4. **Observability Foundation**
   - Extract `Logger.ts`
   - Create `TracingProvider` interface
   - Implement basic console tracing
   - Add LangSmith integration (optional)

**Deliverables:**
- ✅ Working package with build system
- ✅ LLM client supporting 5 providers
- ✅ Message type system
- ✅ Basic logging and tracing
- ✅ 80%+ test coverage for LLM layer

**Success Criteria:**
- Can call OpenAI, LiteLLM, Groq successfully
- All providers pass connection tests
- Zero DevTools dependencies

---

### Phase 2: Agent Framework (Weeks 3-4)

**Objectives:**
- Extract agent execution system
- Create tool abstraction
- Implement agent handoffs

**Tasks:**
1. **Agent Runner Extraction**
   - Extract `AgentRunner.ts`:
     - Remove `PageInfoManager` dependencies
     - Make context provider pluggable
     - Clean up DevTools-specific code
   - Extract `AgentSessionTypes.ts`
   - Extract `AgentRunnerEventBus.ts`
   - Add abort signal support throughout

2. **Configurable Agent**
   - Rename `ConfigurableAgentTool.ts` → `ConfigurableAgent.ts`
   - Extract agent configuration types
   - Implement `AgentRegistry` for registration
   - Add agent versioning support

3. **Tool System**
   - Create `Tool` interface
   - Implement `ToolRegistry`:
     - Factory-based registration
     - Instance caching
     - Tool versioning
   - Implement `ToolExecutor`:
     - Execute tools with context
     - Handle errors
     - Add tracing
   - Port generic tools:
     - `FetcherTool` (HTTP requests)
     - `SequentialThinkingTool` (structured thinking)

4. **Handoff System**
   - Extract handoff configuration types
   - Implement handoff execution logic
   - Add context filtering for handoffs
   - Create handoff tracing

5. **Context Provider**
   - Create `ContextProvider` interface
   - Implement `SimpleContextProvider`
   - Document how to create custom providers

**Deliverables:**
- ✅ Working AgentRunner with tool execution
- ✅ Tool registry and executor
- ✅ Agent handoff mechanism
- ✅ 2-3 built-in tools
- ✅ Context provider system
- ✅ 85%+ test coverage

**Success Criteria:**
- Agents execute with multiple iterations
- Tools execute and return results
- Handoffs work between agents
- Custom context can be injected

---

### Phase 3: Graph Orchestration (Weeks 5-6)

**Objectives:**
- Extract state graph system
- Create graph configuration API
- Implement graph-based workflows

**Tasks:**
1. **State Graph Extraction**
   - Extract `StateGraph.ts`:
     - Generic state machine executor
     - Conditional routing
     - Streaming updates
   - Add comprehensive tracing
   - Improve error handling

2. **Graph Nodes**
   - Extract core nodes from `Graph.ts`:
     - `AgentNode`: LLM interaction
     - `ToolExecutorNode`: Tool execution
     - `FinalNode`: Termination
   - Make nodes extensible
   - Add custom node support

3. **Graph Configuration**
   - Extract `ConfigurableGraph.ts`:
     - Configuration-driven building
     - Condition factories
     - Edge routing logic
   - Extract `GraphConfigs.ts`:
     - Predefined templates
     - Validation
   - Create graph builder API:
     ```typescript
     const graph = new GraphBuilder()
       .addNode('agent', new AgentNode(config))
       .addNode('tools', new ToolExecutorNode())
       .addNode('final', new FinalNode())
       .addEdge('agent', 'tools', (state) => state.needsTools)
       .addEdge('tools', 'agent', () => true)
       .addEdge('agent', 'final', (state) => state.isDone)
       .setEntryPoint('agent')
       .build();
     ```

4. **Integration Testing**
   - End-to-end agent execution
   - Multi-agent handoffs through graph
   - Graph-based workflow testing
   - Performance benchmarks

**Deliverables:**
- ✅ Working StateGraph executor
- ✅ Core node implementations
- ✅ Graph configuration system
- ✅ Graph builder API
- ✅ Predefined graph templates
- ✅ 85%+ test coverage

**Success Criteria:**
- Graphs execute with conditional routing
- Nodes communicate via state
- Custom workflows can be defined
- Performance meets benchmarks

---

### Phase 4: Documentation & Examples (Weeks 7-8)

**Objectives:**
- Comprehensive documentation
- Multiple working examples
- Migration guide

**Tasks:**
1. **Core Documentation**
   - `README.md`: Overview, quick start, features
   - `getting-started.md`: Step-by-step tutorial
   - `architecture.md`: System design and components
   - `API reference`: Auto-generated from TypeDoc

2. **Agent Documentation**
   - `creating-agents.md`: Agent development guide
   - `agent-handoffs.md`: Multi-agent patterns
   - `agent-sessions.md`: Session management

3. **Tool Documentation**
   - `tool-interface.md`: Tool development guide
   - `builtin-tools.md`: Built-in tools reference
   - `tool-registry.md`: Registry usage

4. **LLM Documentation**
   - `providers.md`: Overview of providers
   - Provider-specific guides (OpenAI, LiteLLM, etc.)
   - `custom-provider.md`: Creating custom providers

5. **Orchestration Documentation**
   - `state-graph.md`: StateGraph guide
   - `graph-config.md`: Configuration reference
   - `workflows.md`: Common workflow patterns

6. **Examples**
   - **Example 1**: Simple agent with OpenAI
     - Basic question answering
     - Single tool usage
   - **Example 2**: Multi-provider usage
     - Switching between providers
     - Fallback logic
   - **Example 3**: Custom tools
     - Implementing domain-specific tools
     - Tool context usage
   - **Example 4**: Agent handoff
     - Research → Writer agent flow
     - Context passing
   - **Example 5**: Graph workflow
     - Complex multi-step workflow
     - Conditional routing
   - **Example 6**: Context provider
     - Custom context injection
     - Database integration

7. **Migration Guide**
   - Guide for Browser Operator migration
   - Breaking changes documentation
   - Tool migration examples

**Deliverables:**
- ✅ Complete documentation site
- ✅ 6+ working examples
- ✅ Migration guide
- ✅ API reference
- ✅ Tutorial videos (optional)

**Success Criteria:**
- New users can get started in < 10 minutes
- All features documented with examples
- Migration path is clear

---

### Phase 5: Integration & Migration (Weeks 9-10)

**Objectives:**
- Migrate Browser Operator to SDK
- Create browser-specific tools package
- Validate feature parity

**Tasks:**
1. **Create Browser Tools Package**
   - New package: `@browser-operator/browser-tools`
   - Port browser-specific tools:
     - DOM inspection tools
     - Accessibility tree tools
     - Screenshot tools
     - Navigation tools
     - Click/scroll tools
   - Implement `BrowserContextProvider`:
     - Page info extraction
     - Accessibility tree
     - DOM context

2. **Browser Operator Migration**
   - Install SDK as dependency:
     ```json
     {
       "dependencies": {
         "@browser-operator/ai-agent-sdk": "^1.0.0",
         "@browser-operator/browser-tools": "^1.0.0"
       }
     }
     ```
   - Remove duplicated code:
     - Delete `LLM/` directory (use SDK)
     - Delete `agent_framework/` (use SDK)
     - Delete `core/StateGraph.ts` (use SDK)
   - Update imports to SDK:
     ```typescript
     import { AgentRunner, ConfigurableAgent } from '@browser-operator/ai-agent-sdk';
     import { NavigateURLTool, ScreenshotTool } from '@browser-operator/browser-tools';
     ```
   - Create `BrowserAgentService`:
     - Wraps SDK with DevTools integration
     - Provides browser tools
     - Manages sessions

3. **Testing & Validation**
   - Unit tests for all migrated components
   - Integration tests for SDK + browser tools
   - E2E tests for Browser Operator
   - Performance testing:
     - Compare with original implementation
     - Identify regressions
   - User acceptance testing

4. **Cleanup & Optimization**
   - Remove unused code
   - Optimize bundle size
   - Update documentation
   - Fix any issues found in testing

**Deliverables:**
- ✅ `@browser-operator/browser-tools` package
- ✅ Browser Operator using SDK
- ✅ Feature parity validation
- ✅ Performance benchmarks
- ✅ Migration complete

**Success Criteria:**
- All Browser Operator features work
- Performance is equal or better
- Bundle size is acceptable
- Tests pass at 90%+ coverage

---

## Timeline Summary

| Phase | Duration | Key Deliverables | Effort |
|-------|----------|------------------|--------|
| **Phase 1**: Core SDK Foundation | 2 weeks | LLM client, messaging, observability | 80 hours |
| **Phase 2**: Agent Framework | 2 weeks | AgentRunner, tools, registry | 80 hours |
| **Phase 3**: Graph Orchestration | 2 weeks | StateGraph, configuration | 80 hours |
| **Phase 4**: Documentation & Examples | 2 weeks | Docs, examples, migration guide | 80 hours |
| **Phase 5**: Integration & Migration | 2 weeks | Browser-operator migration, tools package | 80 hours |
| **Total** | **10 weeks** | **Production-ready SDK** | **400 hours** |

---

## Success Metrics

### Technical Metrics
- ✅ **Zero DevTools Dependencies**: SDK runs in any Node.js environment
- ✅ **Multi-Provider Support**: All 5 LLM providers functional
- ✅ **Test Coverage**: 90%+ coverage across all packages
- ✅ **Performance**: <5% performance regression vs current implementation
- ✅ **Bundle Size**: Core SDK <500KB minified

### Feature Parity
- ✅ **Agent Execution**: Full iteration-based execution
- ✅ **Tool System**: Tool registry and execution
- ✅ **Handoffs**: Multi-agent collaboration
- ✅ **Graph Workflows**: StateGraph with conditional routing
- ✅ **Observability**: Logging and tracing

### Developer Experience
- ✅ **Documentation**: Complete docs for all features
- ✅ **Examples**: 6+ working examples
- ✅ **Migration**: Clear migration path
- ✅ **TypeScript**: Full type safety
- ✅ **API Design**: Intuitive and consistent

### Adoption Metrics
- ✅ **Browser Operator Migration**: Successful migration with feature parity
- ✅ **External Users**: 3+ external projects using SDK (target)
- ✅ **npm Downloads**: 100+ downloads/week (6-month target)

---

## Risk Assessment

### High Risk

**Risk**: Breaking changes during migration
**Mitigation**: Maintain feature flags, parallel implementation, extensive testing

**Risk**: Performance regressions
**Mitigation**: Benchmark early and often, profile hot paths, optimize critical sections

### Medium Risk

**Risk**: Documentation gaps
**Mitigation**: Doc-driven development, user testing, continuous updates

**Risk**: Browser Operator disruption
**Mitigation**: Phased rollout, feature flags, rollback plan

### Low Risk

**Risk**: Community adoption
**Mitigation**: Marketing, examples, blog posts, conference talks

**Risk**: Maintenance burden
**Mitigation**: Good architecture, automated testing, clear contribution guidelines

---

## Dependencies

### SDK Dependencies (Minimal)
```json
{
  "dependencies": {
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "tsup": "^8.0.0"
  },
  "peerDependencies": {
    "@langchain/core": "^0.1.0"
  }
}
```

### Browser Operator After Migration
```json
{
  "dependencies": {
    "@browser-operator/ai-agent-sdk": "^1.0.0",
    "@browser-operator/browser-tools": "^1.0.0"
  }
}
```

---

## Benefits

### For Browser Operator
- ✅ **Reduced Complexity**: 40-50% less code to maintain
- ✅ **Focus**: Concentrate on browser-specific features
- ✅ **Testing**: Easier to test (mock SDK)
- ✅ **Upgrades**: Benefit from SDK improvements

### For SDK Users
- ✅ **Multi-Domain**: Build AI agents for any domain
- ✅ **Production-Ready**: Battle-tested in Browser Operator
- ✅ **Multi-Provider**: 5+ LLM providers out-of-the-box
- ✅ **Patterns**: Proven orchestration patterns
- ✅ **Extensible**: Easy to add custom tools and agents

### Use Cases
1. **CLI Tools**: AI-powered command-line tools
2. **API Services**: Backend AI agent services
3. **Desktop Apps**: Electron/Tauri with AI
4. **Mobile**: React Native AI assistants
5. **IoT**: AI agents for devices
6. **Enterprise**: Domain-specific agents
7. **Research**: Multi-agent experiments
8. **Education**: Teaching AI agent concepts

---

## Next Steps

### Immediate Actions
1. ✅ Review and approve this plan
2. ✅ Create GitHub repository for SDK
3. ✅ Set up project infrastructure
4. ✅ Begin Phase 1 implementation

### Stakeholder Communication
- Share plan with team for feedback
- Present to broader organization
- Create public roadmap
- Set up feedback channels

### Long-Term Vision
- **v1.0**: Core SDK with all features
- **v1.1**: Advanced graph features (parallel execution, streaming)
- **v1.2**: More LLM providers (Anthropic, Cohere, etc.)
- **v2.0**: Visual workflow builder, agent marketplace

---

## Conclusion

This plan provides a comprehensive roadmap for extracting Browser Operator's AI chat framework into a standalone, production-ready SDK. The 10-week timeline is realistic and accounts for proper testing, documentation, and migration.

The SDK will enable developers to build sophisticated multi-agent AI systems for any domain, while Browser Operator benefits from reduced complexity and a more focused codebase.

**Key Success Factors:**
- Clean architecture with minimal dependencies
- Comprehensive testing at every phase
- Excellent documentation and examples
- Smooth migration path for Browser Operator
- Strong community engagement

With this foundation, `@browser-operator/ai-agent-sdk` can become a go-to solution for building production-grade AI agent systems.
