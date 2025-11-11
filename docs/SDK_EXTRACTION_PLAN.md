# AI Agent SDK Extraction Plan

**Browser Operator Core → @browser-operator/agent-sdk**

**Version:** 1.0
**Date:** 2025-11-11
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Comparative Analysis](#comparative-analysis)
4. [Improved Architecture](#improved-architecture)
5. [Package Structure](#package-structure)
6. [Technology Stack](#technology-stack)
7. [API Design](#api-design)
8. [CLI Experience](#cli-experience)
9. [Documentation Strategy](#documentation-strategy)
10. [Testing Strategy](#testing-strategy)
11. [Release Roadmap](#release-roadmap)
12. [Success Metrics](#success-metrics)
13. [Key Decisions](#key-decisions)

---

## Executive Summary

This document outlines the plan to extract the `ai_chat` functionality from Browser Operator Core into a standalone, industry-standard AI agent SDK. The plan is informed by analysis of leading frameworks (Mastra and VoltAgent) and follows modern TypeScript monorepo best practices.

### Key Goals

- **Platform Independence**: Decouple from Chrome DevTools dependencies
- **Industry Standards**: Adopt Vercel AI SDK v5, OpenTelemetry, Zod schemas
- **Developer Experience**: Provide CLI tooling, comprehensive examples, and clear documentation
- **Production Ready**: Include guardrails, observability, and memory management
- **Extensible**: Support custom tools, workflows, and platform adapters

### Timeline

**12 weeks** from planning to production-ready `v1.0.0` release

---

## Current State Analysis

### ai_chat Architecture Overview

The `ai_chat` system is a sophisticated **multi-agent AI framework** located at `/front_end/panels/ai_chat/` with the following characteristics:

#### Architecture Layers

1. **Two-Tier Orchestration**
   - **Primary Layer**: `StateGraph` for main conversational flow (state machine pattern)
   - **Secondary Layer**: `AgentRunner` for complex agent-tools with iteration loops

2. **Core Components** (`/core/`)
   - `AgentService` - Main orchestration service
   - `Graph` & `StateGraph` - State machine execution
   - `AgentNodes` - Node implementations (AgentNode, ToolExecutorNode, FinalNode)
   - `LLMConfigurationManager` - Model configuration
   - `PageInfoManager` - Context management

3. **LLM Integration Layer** (`/LLM/`)
   - Unified `LLMClient` with provider registry pattern
   - 5 providers: OpenAI, LiteLLM, Groq, OpenRouter, BrowserOperator
   - Response parsing and error handling

4. **Agent Framework** (`/agent_framework/`)
   - `AgentRunner` - Core execution loop
   - `ConfigurableAgentTool` - Tool abstraction
   - Event bus for progress tracking
   - 15+ specialized agents (ActionAgent, ResearchAgent, WebTaskAgent, etc.)

5. **Tool System** (`/tools/`)
   - 25+ tools including extraction, navigation, file management, reasoning
   - Tool registry with dynamic lookup

6. **MCP Integration** (`/mcp/`)
   - Model Context Protocol support
   - Tool adapters for external integrations

7. **Tracing & Observability** (`/tracing/`)
   - Langfuse integration
   - Execution tracking

#### Current Dependencies

- ❌ **Tightly coupled** with Chrome DevTools (`SDK`, `UI.Legacy`, `Common`)
- ❌ Browser-specific features (CDP, accessibility trees)
- ❌ DevTools storage mechanisms
- ❌ Custom LLM provider implementations

#### Strengths to Preserve

- ✅ Powerful StateGraph orchestration
- ✅ Multi-agent coordination
- ✅ Comprehensive tool ecosystem
- ✅ MCP support
- ✅ Event-driven architecture

---

## Comparative Analysis

### Framework Comparison: ai_chat vs Mastra vs VoltAgent

#### Package Organization

| Aspect | **ai_chat (Current)** | **Mastra** | **VoltAgent** | **✅ Recommendation** |
|--------|----------------------|------------|---------------|----------------------|
| **Monorepo Tool** | None (DevTools monolith) | pnpm + Turborepo | pnpm + Lerna + Nx | **Use pnpm workspaces + Turborepo** |
| **Package Count** | 1 (embedded) | 26 packages | 27 packages | **Start with 8-10 focused packages** |
| **Namespace** | None | `@mastra/*` | `@voltagent/*` | **Use `@browser-operator/*`** |
| **Module System** | ESM only | ESM + CJS (dual) | ESM + CJS (dual) | **Dual ESM/CJS support** |
| **Build Tool** | Custom | tsup | tsup | **Use tsup for fast builds** |

#### Core Architecture Patterns

| Pattern | **ai_chat** | **Mastra** | **VoltAgent** | **✅ Best Practice** |
|---------|------------|------------|---------------|---------------------|
| **Agent Execution** | StateGraph + AgentRunner | Agent with workflows | Agent with workflows | **Keep StateGraph + workflows hybrid** |
| **LLM Integration** | Custom providers | Vercel AI SDK v5 | Vercel AI SDK v5 | **✅ Adopt Vercel AI SDK v5** |
| **Tool System** | Custom registry | Zod-based tools | Zod-based tools | **✅ Use Zod schemas** |
| **Memory** | File-based | Multiple adapters | Multiple adapters | **Pluggable storage adapters** |
| **Observability** | Langfuse only | OpenTelemetry + custom | OpenTelemetry + VoltOps | **✅ OpenTelemetry + Langfuse** |
| **Workflows** | Graph-based | XState + chainable | Chainable builders | **Keep graph + add builders** |

### Key Insights from Mastra

#### ✅ What to Adopt

1. **Vercel AI SDK v5 Integration**
   - Unified interface for 40+ providers
   - Better streaming, tool calling, and structured output support
   - Industry standard adoption

2. **Comprehensive Package Exports**
   ```json
   {
     "exports": {
       ".": "./dist/index.js",
       "./agent": "./dist/agent/index.js",
       "./tools": "./dist/tools/index.js",
       "./workflows": "./dist/workflows/index.js"
     }
   }
   ```
   Enables tree-shaking and selective imports

3. **Modular Package Structure**
   - Separate packages for concerns: core, memory, rag, mcp
   - Optional peer dependencies for advanced features

4. **Built-in Testing & Mocking**
   - `/test-utils/llm-mock` for mocking LLM responses
   - Makes SDK more testable for users

5. **CLI-First Experience**
   ```bash
   npm create mastra@latest
   ```
   Generates project scaffold with best practices

#### ❌ What to Avoid

1. **Over-abstraction** - Many abstraction layers that add complexity
2. **Breaking changes** - Still in beta with frequent API changes

### Key Insights from VoltAgent

#### ✅ What to Adopt

1. **Built-in OpenTelemetry**
   - Standard OTEL implementation, not just Langfuse
   - Standard spans, traces, and metrics
   - Can export to any OTEL-compatible backend

2. **Guardrails System**
   ```typescript
   createDefaultSafetyGuardrails() // PII, profanity, injection detection
   createInputGuardrail({ ... })
   createOutputGuardrail({ ... })
   ```
   Critical for production agents

3. **Workflow Suspend/Resume**
   ```typescript
   await workflow.suspend({
     reason: 'Awaiting user approval',
     context: data
   });
   ```
   Essential for human-in-the-loop workflows

4. **Memory Architecture**
   - Clear separation: `StorageAdapter`, `VectorAdapter`, `EmbeddingAdapter`
   - Multiple built-in adapters: LibSQL, Postgres, Supabase
   - Conversation-based memory with working memory scopes

5. **Agent Hooks System**
   ```typescript
   agent.hooks = {
     onStart: async (ctx) => { ... },
     onToolCall: async (ctx, tool) => { ... },
     onFinish: async (ctx, result) => { ... }
   }
   ```
   Allows customization without modifying core

6. **Subagent Pattern**
   - Supervisor agents coordinate subagents
   - Clear handoff mechanisms
   - Better than nested tool approach

7. **Comprehensive Examples**
   - 60+ examples covering specific use cases
   - Example-driven documentation

#### ❌ What to Avoid

1. **Tight coupling to VoltOps** - Proprietary observability platform
2. **Complex context management** - Symbol-based context (harder to debug)

---

## Improved Architecture

### Design Principles

1. **Modularity**: Split into focused, independently versioned packages
2. **Platform Agnostic**: Abstract platform-specific code with dependency injection
3. **Developer Experience**: Simple defaults, powerful customization
4. **Extensibility**: Plugin architecture for tools, adapters, and providers
5. **Production Ready**: Built-in error handling, retries, observability, and guardrails
6. **Compatibility**: ESM and CommonJS, browser and Node.js, tree-shakeable

### Core Architectural Patterns

#### Dependency Inversion

```typescript
// Instead of direct DevTools SDK dependency
interface PlatformAdapter {
  getPageContext(): Promise<PageContext>;
  executeAction(action: Action): Promise<ActionResult>;
  captureScreenshot(): Promise<Buffer>;
}

// Browser implementation
class BrowserPlatformAdapter implements PlatformAdapter { ... }

// Node implementation
class NodePlatformAdapter implements PlatformAdapter { ... }
```

#### Plugin Architecture

```typescript
// Tools become plugins
class ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
}

// Users can add custom tools
const agent = new Agent({
  tools: [
    ...defaultTools,
    new CustomScraperTool(),
  ]
});
```

---

## Package Structure

```
@browser-operator/agent-sdk/          # Monorepo root
├── packages/
│   ├── core/                         # Core agent framework
│   │   ├── src/
│   │   │   ├── agent/               # Agent execution (AgentRunner)
│   │   │   ├── graph/               # StateGraph execution
│   │   │   ├── state/               # State management
│   │   │   ├── hooks/               # Lifecycle hooks
│   │   │   ├── events/              # Event system
│   │   │   └── types/               # Core types
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── llm/                          # LLM integration (Vercel AI SDK)
│   │   ├── src/
│   │   │   ├── providers/           # Provider configs
│   │   │   ├── parsers/             # Response parsing
│   │   │   └── streaming/           # Streaming utilities
│   │   └── package.json
│   │
│   ├── tools/                        # Tool system
│   │   ├── src/
│   │   │   ├── base/                # Tool interfaces
│   │   │   ├── registry/            # Tool registry
│   │   │   ├── reasoning/           # Thinking tools
│   │   │   ├── storage/             # File tools
│   │   │   ├── web/                 # Web interaction
│   │   │   └── mcp/                 # MCP integration
│   │   └── package.json
│   │
│   ├── workflows/                    # Workflow engine
│   │   ├── src/
│   │   │   ├── builders/            # Chainable builders
│   │   │   ├── execution/           # Execution engine
│   │   │   ├── suspend/             # Suspend/resume
│   │   │   └── types/
│   │   └── package.json
│   │
│   ├── memory/                       # Memory management
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   ├── storage/         # Storage adapters
│   │   │   │   ├── vector/          # Vector adapters
│   │   │   │   └── embedding/       # Embedding adapters
│   │   │   ├── conversation/        # Conversation buffer
│   │   │   └── working/             # Working memory
│   │   └── package.json
│   │
│   ├── observability/                # Observability & tracing
│   │   ├── src/
│   │   │   ├── otel/                # OpenTelemetry
│   │   │   ├── langfuse/            # Langfuse integration
│   │   │   └── exporters/           # Custom exporters
│   │   └── package.json
│   │
│   ├── guardrails/                   # Safety & guardrails
│   │   ├── src/
│   │   │   ├── input/               # Input validation
│   │   │   ├── output/              # Output filtering
│   │   │   └── presets/             # Default guardrails
│   │   └── package.json
│   │
│   ├── platform-browser/             # Browser platform
│   │   ├── src/
│   │   │   ├── dom/                 # DOM interaction
│   │   │   ├── cdp/                 # Chrome DevTools Protocol
│   │   │   └── accessibility/       # Accessibility tree
│   │   └── package.json
│   │
│   ├── platform-node/                # Node.js platform
│   │   ├── src/
│   │   │   ├── http/                # HTTP client
│   │   │   ├── puppeteer/           # Puppeteer integration
│   │   │   └── filesystem/          # File system tools
│   │   └── package.json
│   │
│   ├── agents/                       # Pre-configured agents
│   │   ├── src/
│   │   │   ├── action/              # ActionAgent
│   │   │   ├── research/            # ResearchAgent
│   │   │   ├── web/                 # WebTaskAgent
│   │   │   └── content/             # ContentWriterAgent
│   │   └── package.json
│   │
│   ├── cli/                          # CLI tool
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── init.ts          # Initialize project
│   │   │   │   ├── agent.ts         # Generate agent
│   │   │   │   └── tool.ts          # Generate tool
│   │   │   └── templates/           # Project templates
│   │   └── package.json
│   │
│   ├── create-bo-agent/              # Project scaffolder
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── sdk/                          # Main aggregator package
│       ├── src/
│       │   └── index.ts             # Re-exports from all packages
│       └── package.json
│
├── adapters/                         # Storage/Vector adapters
│   ├── libsql/                      # LibSQL adapter
│   ├── postgres/                    # PostgreSQL adapter
│   ├── supabase/                    # Supabase adapter
│   └── chroma/                      # Chroma vector DB
│
├── examples/                         # Comprehensive examples
│   ├── 00-quickstart/
│   ├── 01-basic-agent/
│   ├── 02-custom-tools/
│   ├── 03-workflow-suspend-resume/
│   ├── 04-multi-agent/
│   ├── 05-browser-automation/
│   ├── 06-rag-agent/
│   ├── 07-human-in-the-loop/
│   ├── 08-mcp-integration/
│   ├── 09-observability/
│   └── 10-production-ready/
│
├── docs/                             # Documentation
│   ├── 00-introduction/
│   ├── 01-core-concepts/
│   ├── 02-guides/
│   ├── 03-api-reference/
│   ├── 04-platform-guides/
│   ├── 05-integrations/
│   └── 06-examples/
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # pnpm workspaces
├── tsconfig.base.json                # Base TypeScript config
└── package.json                      # Root package.json
```

---

## Technology Stack

### Build & Development Tools

| Tool | Choice | Rationale |
|------|--------|-----------|
| **Build System** | tsup | Fast, simple, used by both Mastra and VoltAgent |
| **Monorepo** | pnpm + Turborepo | Faster builds, better caching, efficient disk usage |
| **Testing** | Vitest | Fast, ESM-native, consistent with industry |
| **Linting** | ESLint + TypeScript ESLint | Industry standard |
| **Formatting** | Prettier | Industry standard |
| **Documentation** | TypeDoc + VitePress | Modern, fast, great DX |
| **CI/CD** | GitHub Actions | Free for open source, great ecosystem |

### Core Dependencies

```json
{
  "dependencies": {
    "ai": "^5.0.x",                              // Vercel AI SDK
    "@ai-sdk/provider-utils": "^3.0.x",          // Provider utilities
    "@modelcontextprotocol/sdk": "^1.x",         // MCP support
    "@opentelemetry/api": "^1.9.x",              // OpenTelemetry
    "@opentelemetry/sdk-trace-base": "^2.0.x",   // Tracing
    "zod": "^3.25.x",                            // Schema validation
    "xstate": "^5.x",                            // State machines
    "p-retry": "^7.x",                           // Retry logic
    "p-queue": "^8.x"                            // Task queuing
  },
  "peerDependencies": {
    "zod": "^3.25.0 || ^4.0.0",
    "@browser-operator/observability": ">=1.0.0 <2.0.0"
  },
  "peerDependenciesMeta": {
    "@browser-operator/observability": {
      "optional": true
    }
  }
}
```

### Package Configuration

Each package will have:

1. **Dual Module Support** (ESM + CJS)
   ```json
   {
     "type": "module",
     "main": "./dist/index.js",
     "module": "./dist/index.mjs",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "import": {
           "types": "./dist/index.d.mts",
           "default": "./dist/index.mjs"
         },
         "require": {
           "types": "./dist/index.d.ts",
           "default": "./dist/index.js"
         }
       }
     }
   }
   ```

2. **Granular Subpath Exports**
   ```json
   {
     "exports": {
       ".": "./dist/index.js",
       "./agent": "./dist/agent/index.js",
       "./tools": "./dist/tools/index.js",
       "./workflows": "./dist/workflows/index.js"
     }
   }
   ```

3. **Tree-Shaking Support**
   ```json
   {
     "sideEffects": false
   }
   ```

---

## API Design

### 1. Simple Agent API (Beginner-Friendly)

```typescript
import { Agent } from '@browser-operator/sdk';
import { openai } from 'ai';

// Simple API inspired by VoltAgent
const agent = new Agent({
  name: 'research-agent',
  instructions: 'You are a research assistant that helps users find information.',
  model: openai('gpt-4'),
  tools: [searchTool, extractTool],
});

// Generate text
const result = await agent.generateText('Research AI agents');
console.log(result.text);

// Stream text
const stream = await agent.streamText('Research AI agents');
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### 2. Advanced Agent with StateGraph (Power Users)

```typescript
import {
  createAgent,
  StateGraph,
  AgentNode,
  ToolNode,
  FinalNode
} from '@browser-operator/core';

// Advanced API for power users who want fine-grained control
const graph = new StateGraph()
  .addNode('agent', new AgentNode({
    model: openai('gpt-4'),
    tools
  }))
  .addNode('tools', new ToolNode())
  .addNode('final', new FinalNode())
  .addEdge('agent', 'tools')
  .addConditionalEdge('tools', (state) => {
    return state.shouldContinue ? 'agent' : 'final';
  });

const agent = createAgent({
  graph,
  initialState: createInitialState()
});

const result = await agent.run('Research AI agents');
```

### 3. Workflows with Suspend/Resume

```typescript
import {
  createWorkflowChain,
  andThen,
  suspend
} from '@browser-operator/workflows';
import { z } from 'zod';

// Human-in-the-loop workflow
const approvalWorkflow = createWorkflowChain({
  input: z.object({
    amount: z.number(),
    description: z.string()
  }),
  output: z.object({
    approved: z.boolean(),
    reason: z.string()
  })
})
  .andThen('analyze', async ({ input }) => {
    // Analyze expense using AI
    const analysis = await analyzeExpense(input);
    return {
      recommendation: analysis.recommendation,
      riskLevel: analysis.riskLevel
    };
  })
  .andThen('approval', async ({ input, output }) => {
    // Suspend for human approval if amount > $1000
    if (input.amount > 1000) {
      const response = await suspend({
        reason: 'Awaiting manager approval',
        data: {
          amount: input.amount,
          recommendation: output.analyze.recommendation
        }
      });
      return { approved: response.approved };
    }
    return { approved: true };
  })
  .andThen('finalize', async ({ input, output }) => {
    return {
      approved: output.approval.approved,
      reason: output.approval.approved
        ? 'Auto-approved'
        : 'Requires manual review'
    };
  });

// Run workflow
const result = await approvalWorkflow.run({
  amount: 5000,
  description: 'Conference attendance'
});

// Resume later if suspended
if (result.suspended) {
  await approvalWorkflow.resume(result.suspensionId, {
    approved: true
  });
}
```

### 4. Guardrails for Safety

```typescript
import {
  createInputGuardrail,
  createOutputGuardrail,
  createDefaultSafetyGuardrails,
  createDefaultPIIGuardrails
} from '@browser-operator/guardrails';

const agent = new Agent({
  name: 'safe-agent',
  model: openai('gpt-4'),

  // Input guardrails
  inputGuardrails: [
    ...createDefaultSafetyGuardrails(),
    ...createDefaultPIIGuardrails(),
    createInputGuardrail({
      name: 'sensitive-data',
      description: 'Detects and blocks sensitive data',
      validate: async (input) => {
        if (containsSSN(input)) {
          throw new GuardrailError('SSN detected in input');
        }
        if (containsCreditCard(input)) {
          throw new GuardrailError('Credit card detected in input');
        }
      }
    })
  ],

  // Output guardrails
  outputGuardrails: [
    createOutputGuardrail({
      name: 'pii-redactor',
      description: 'Redacts PII from output',
      transform: async (output) => {
        return redactPII(output);
      }
    }),
    createOutputGuardrail({
      name: 'toxicity-filter',
      description: 'Filters toxic content',
      validate: async (output) => {
        const toxicityScore = await checkToxicity(output);
        if (toxicityScore > 0.8) {
          throw new GuardrailError('Toxic content detected');
        }
      }
    })
  ]
});
```

### 5. Memory Management

```typescript
import { Memory } from '@browser-operator/memory';
import { PostgresStorageAdapter } from '@browser-operator/postgres';
import { ChromaVectorAdapter } from '@browser-operator/chroma';
import { AiSdkEmbeddingAdapter } from '@browser-operator/memory';
import { openai } from 'ai';

// Configure memory with adapters
const memory = new Memory({
  storage: new PostgresStorageAdapter({
    connectionString: process.env.DATABASE_URL
  }),
  vector: new ChromaVectorAdapter({
    url: process.env.CHROMA_URL,
    collection: 'agent-memory'
  }),
  embedding: new AiSdkEmbeddingAdapter({
    model: openai.embedding('text-embedding-3-small')
  })
});

// Create agent with memory
const agent = new Agent({
  name: 'memory-agent',
  model: openai('gpt-4'),
  memory,
  memoryMode: 'conversation', // 'conversation' | 'semantic' | 'working'
  memoryConfig: {
    maxMessages: 100,
    summaryThreshold: 50,
    vectorSearchTopK: 5
  }
});

// Agent automatically uses memory
const result = await agent.generateText('What did we discuss earlier?');

// Manually manage conversations
const conversation = await memory.createConversation({
  id: 'user-123',
  metadata: { userId: 'user-123', topic: 'research' }
});

await conversation.addMessage({
  role: 'user',
  content: 'Hello!'
});
```

### 6. Observability & Tracing

```typescript
import { VoltAgentObservability } from '@browser-operator/observability';
import { LangfuseExporter } from '@browser-operator/observability/langfuse';
import { ConsoleExporter } from '@opentelemetry/exporter-trace';

// Configure observability
const observability = new VoltAgentObservability({
  exporters: [
    new LangfuseExporter({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_URL
    }),
    new ConsoleExporter() // For development
  ],
  sampling: {
    rate: 1.0 // Sample 100% in dev, adjust for production
  }
});

// Create traced agent
const agent = new Agent({
  name: 'traced-agent',
  model: openai('gpt-4'),
  observability,

  // Custom metadata for traces
  metadata: {
    environment: 'production',
    version: '1.0.0'
  }
});

// All operations are automatically traced
const result = await agent.generateText('Hello');

// Manual span creation for custom operations
await observability.withSpan('custom-operation', async (span) => {
  span.setAttribute('custom.key', 'value');
  // Your custom logic
});
```

### 7. Custom Tools

```typescript
import { createTool } from '@browser-operator/tools';
import { z } from 'zod';

// Define custom tool with Zod schema
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name or coordinates'),
    units: z.enum(['celsius', 'fahrenheit']).optional()
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
    humidity: z.number()
  }),
  execute: async ({ location, units = 'celsius' }) => {
    const response = await fetch(
      `https://api.weather.com/v1/current?location=${location}`
    );
    const data = await response.json();
    return {
      temperature: data.temp,
      conditions: data.conditions,
      humidity: data.humidity
    };
  }
});

// Use in agent
const agent = new Agent({
  name: 'weather-agent',
  model: openai('gpt-4'),
  tools: [weatherTool]
});
```

### 8. Multi-Agent Systems

```typescript
import { Agent, createSubagent } from '@browser-operator/sdk';

// Create specialized agents
const researchAgent = new Agent({
  name: 'research',
  instructions: 'Expert at finding and analyzing information',
  model: openai('gpt-4'),
  tools: [searchTool, extractTool]
});

const writerAgent = new Agent({
  name: 'writer',
  instructions: 'Expert at writing clear, engaging content',
  model: openai('gpt-4'),
  tools: [formatTool, grammarTool]
});

// Create supervisor agent
const supervisorAgent = new Agent({
  name: 'supervisor',
  instructions: 'Coordinates research and writing tasks',
  model: openai('gpt-4'),
  subagents: [
    createSubagent(researchAgent, {
      handoffCondition: 'research',
      contextTransform: (ctx) => ({
        query: ctx.input.topic
      })
    }),
    createSubagent(writerAgent, {
      handoffCondition: 'write',
      contextTransform: (ctx) => ({
        content: ctx.researchResults
      })
    })
  ]
});

// Supervisor coordinates subagents
const result = await supervisorAgent.generateText(
  'Write an article about AI agents'
);
```

---

## CLI Experience

### Installation

```bash
# Create new project
npm create @browser-operator/agent
# or
npx create-bo-agent

# Interactive prompts
? Project name: my-agent
? Select template:
  ❯ Basic Agent
    Multi-Agent System
    RAG Agent
    Browser Automation
    Workflow with Suspend/Resume
? Select LLM provider:
  ❯ OpenAI
    Anthropic (Claude)
    Local (Ollama)
    Custom
? Add observability?
  ❯ Langfuse
    OpenTelemetry
    None
? TypeScript strict mode? (Y/n) y
```

### Generated Project Structure

```
my-agent/
├── src/
│   ├── agents/
│   │   └── main.ts              # Main agent definition
│   ├── tools/
│   │   └── example-tool.ts      # Example custom tool
│   ├── workflows/
│   │   └── example-workflow.ts  # Example workflow
│   └── index.ts                 # Entry point
├── tests/
│   └── agent.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### CLI Commands

```bash
# Generate new agent
npx bo-agent create research-agent --template=research

# Generate new tool
npx bo-agent tool create search-tool --schema

# Generate new workflow
npx bo-agent workflow create approval-flow

# Run agent in dev mode
npx bo-agent dev

# Test agent
npx bo-agent test

# Deploy agent
npx bo-agent deploy --platform=vercel
```

---

## Documentation Strategy

### Structure

```
docs/
├── 00-introduction/
│   ├── what-is-browser-operator-sdk.md
│   ├── quickstart.md
│   ├── installation.md
│   └── core-concepts.md
│
├── 01-core-concepts/
│   ├── agents.md
│   ├── tools.md
│   ├── workflows.md
│   ├── state-graphs.md
│   ├── memory.md
│   └── observability.md
│
├── 02-guides/
│   ├── building-your-first-agent.md
│   ├── creating-custom-tools.md
│   ├── multi-agent-systems.md
│   ├── human-in-the-loop.md
│   ├── browser-automation.md
│   ├── adding-memory.md
│   ├── implementing-guardrails.md
│   └── production-deployment.md
│
├── 03-api-reference/
│   ├── core/
│   │   ├── Agent.md
│   │   ├── StateGraph.md
│   │   └── AgentRunner.md
│   ├── llm/
│   ├── tools/
│   ├── workflows/
│   ├── memory/
│   └── observability/
│
├── 04-platform-guides/
│   ├── browser.md
│   ├── node.md
│   └── edge-runtime.md
│
├── 05-integrations/
│   ├── mcp.md
│   ├── langfuse.md
│   ├── vector-databases.md
│   └── storage-adapters.md
│
└── 06-examples/
    ├── basic-examples.md
    ├── advanced-examples.md
    └── production-examples.md
```

### Documentation Features

1. **Interactive Playground**
   - Live code editor with SDK loaded
   - Run examples directly in browser
   - Share and fork examples

2. **Video Tutorials**
   - YouTube channel with walkthroughs
   - 5-10 minute focused videos
   - Covers common use cases

3. **Migration Guide**
   - Detailed guide for migrating from ai_chat
   - Side-by-side code comparisons
   - Breaking changes and workarounds

4. **Comparison Guide**
   - Compare with LangChain, LlamaIndex, Mastra, VoltAgent
   - Feature matrix
   - When to use each framework

5. **API Reference**
   - Auto-generated from TypeDoc
   - Search functionality
   - Code examples for every API

---

## Testing Strategy

### Test Categories

1. **Unit Tests**
   - Core framework logic
   - Agent execution
   - Tool registry
   - State management
   - Graph execution

2. **Integration Tests**
   - End-to-end agent flows
   - Multi-agent coordination
   - Workflow execution
   - Memory operations

3. **Platform Tests**
   - Browser adapter with Playwright
   - Node adapter
   - Edge runtime compatibility

4. **Performance Tests**
   - Memory usage
   - Execution time
   - Streaming latency

### Testing Utilities

```typescript
// @browser-operator/core/test-utils

import { createMockLLM } from '@browser-operator/core/test-utils';

describe('Agent', () => {
  it('should execute tool calls', async () => {
    // Mock LLM
    const mockLLM = createMockLLM({
      responses: [
        {
          text: 'Calling search tool',
          toolCalls: [
            { name: 'search', arguments: { query: 'test' } }
          ]
        },
        {
          text: 'Final answer',
          toolCalls: []
        }
      ]
    });

    // Create agent
    const agent = new Agent({
      name: 'test-agent',
      model: mockLLM,
      tools: [searchTool]
    });

    // Test agent
    const result = await agent.generateText('Search for test');
    expect(result.text).toBe('Final answer');
    expect(result.toolCalls).toHaveLength(1);
  });
});
```

### Coverage Target

- **Overall:** > 80%
- **Core packages:** > 90%
- **Critical paths:** 100%

---

## Release Roadmap

### Phase 1: Foundation (Weeks 1-3)

**Goal:** Setup infrastructure and core extraction

**Tasks:**
- [ ] Setup monorepo with pnpm + Turborepo
- [ ] Configure build system (tsup)
- [ ] Setup CI/CD pipeline
- [ ] Extract `@browser-operator/core`
  - [ ] Agent, AgentRunner
  - [ ] StateGraph, Graph
  - [ ] Event system
  - [ ] State management
- [ ] Integrate Vercel AI SDK v5
- [ ] Extract `@browser-operator/tools`
  - [ ] Base tool interfaces
  - [ ] Tool registry
  - [ ] Zod schema support
- [ ] Add OpenTelemetry to `@browser-operator/observability`

**Deliverables:**
- Working monorepo
- Core agent execution
- Basic tool system
- Initial observability

### Phase 2: Core Features (Weeks 4-6)

**Goal:** Build essential SDK features

**Tasks:**
- [ ] Extract `@browser-operator/workflows`
  - [ ] Chainable builders (andThen, andAll, etc.)
  - [ ] Suspend/resume mechanism
  - [ ] Workflow execution engine
- [ ] Extract `@browser-operator/memory`
  - [ ] Storage adapter interface
  - [ ] Vector adapter interface
  - [ ] Embedding adapter interface
  - [ ] Conversation buffer
  - [ ] Working memory
- [ ] Create `@browser-operator/guardrails`
  - [ ] Input guardrails
  - [ ] Output guardrails
  - [ ] Default safety presets
- [ ] Create platform adapters
  - [ ] `@browser-operator/platform-browser`
  - [ ] `@browser-operator/platform-node`

**Deliverables:**
- Complete core feature set
- Memory management
- Safety guardrails
- Platform abstractions

### Phase 3: Developer Experience (Weeks 7-8)

**Goal:** Enhance developer experience

**Tasks:**
- [ ] Build `@browser-operator/cli`
  - [ ] Project initialization
  - [ ] Agent generation
  - [ ] Tool generation
  - [ ] Workflow generation
- [ ] Create `create-bo-agent` scaffolder
  - [ ] Project templates
  - [ ] Interactive prompts
  - [ ] Configuration presets
- [ ] Write comprehensive examples
  - [ ] Basic agent (quickstart)
  - [ ] Custom tools
  - [ ] Workflow with suspend/resume
  - [ ] Multi-agent system
  - [ ] Browser automation
  - [ ] RAG agent
  - [ ] Human-in-the-loop
  - [ ] MCP integration
  - [ ] Observability
  - [ ] Production-ready deployment
- [ ] Create interactive documentation
  - [ ] API reference (TypeDoc)
  - [ ] Guides
  - [ ] Examples
  - [ ] Playground

**Deliverables:**
- CLI tooling
- 10+ examples
- Comprehensive documentation
- Interactive playground

### Phase 4: Adapters & Integrations (Weeks 9-10)

**Goal:** Expand ecosystem

**Tasks:**
- [ ] Create storage adapters
  - [ ] `@browser-operator/postgres`
  - [ ] `@browser-operator/libsql`
  - [ ] `@browser-operator/supabase`
- [ ] Create vector adapters
  - [ ] `@browser-operator/chroma`
  - [ ] `@browser-operator/pinecone`
  - [ ] `@browser-operator/qdrant`
- [ ] Enhance MCP integration
  - [ ] MCP server support
  - [ ] MCP client utilities
  - [ ] Example MCP servers
- [ ] Add provider examples
  - [ ] OpenAI
  - [ ] Anthropic
  - [ ] Google
  - [ ] Local (Ollama)

**Deliverables:**
- Multiple storage options
- Vector database support
- Enhanced MCP support
- Provider examples

### Phase 5: Testing & Release (Weeks 11-12)

**Goal:** Ensure quality and release

**Tasks:**
- [ ] Comprehensive test suite
  - [ ] Unit tests (>90% coverage for core)
  - [ ] Integration tests
  - [ ] Platform tests
  - [ ] Performance tests
- [ ] Performance benchmarks
  - [ ] Memory usage
  - [ ] Execution time
  - [ ] Streaming latency
- [ ] Security audit
  - [ ] Dependency audit
  - [ ] Code security review
  - [ ] Guardrail testing
- [ ] Documentation review
  - [ ] API completeness
  - [ ] Code examples validation
  - [ ] Tutorial walkthroughs
- [ ] Beta release
  - [ ] `v1.0.0-beta.1`
  - [ ] Community feedback
  - [ ] Bug fixes
- [ ] Stable release
  - [ ] `v1.0.0`
  - [ ] Announcement
  - [ ] Marketing

**Deliverables:**
- High test coverage
- Performance benchmarks
- Security clearance
- Beta release
- Stable v1.0.0 release

---

## Success Metrics

### Developer Experience Metrics

- ⏱️ **Time to first agent:** < 5 minutes (with CLI)
- 📦 **Bundle size:** < 50KB (core package, tree-shaken)
- 🧪 **Test coverage:** > 80% overall, > 90% for core
- 📚 **Documentation coverage:** 100% API + 10+ guides
- 💬 **Community engagement:** Active Discord/GitHub discussions

### Performance Metrics

- 🚀 **Cold start:** < 100ms
- 💾 **Memory overhead:** < 10MB baseline
- 🔄 **Build time:** < 10s (full monorepo with cache)
- 📡 **Streaming latency:** < 50ms first token
- 🔁 **Tool execution:** < 1s average

### Adoption Metrics

- ⭐ **GitHub stars:** 1000+ in first 3 months
- 📥 **npm downloads:** 10K+/month after v1.0
- 💬 **Discord members:** 500+ in first 6 months
- 🐛 **Issue response time:** < 24 hours
- 🎯 **User retention:** 60%+ return users

### Quality Metrics

- 🐛 **Bug density:** < 1 critical bug per 1000 LOC
- 🔒 **Security vulnerabilities:** 0 high/critical
- 📊 **Code quality:** A+ on Code Climate
- ⚡ **Performance regression:** < 5% between versions
- 🔄 **Breaking changes:** Minimize in v1.x

---

## Key Decisions

### What to Keep from ai_chat

✅ **StateGraph Architecture**
- Powerful, flexible orchestration
- Better than simple chainable workflows for complex flows
- Allows fine-grained control

✅ **Multi-Agent Coordination**
- AgentRunner with nested execution
- Subagent handoff mechanisms
- Event-driven progress tracking

✅ **Comprehensive Tool System**
- 25+ existing tools
- Tool registry pattern
- MCP integration

✅ **Browser Integration**
- Chrome DevTools Protocol
- Accessibility tree extraction
- DOM interaction utilities

### What to Change

❌ **LLM Integration** → ✅ **Vercel AI SDK v5**
- Industry standard (40+ providers)
- Better streaming support
- Structured output with Zod
- Active development and community

❌ **DevTools Dependencies** → ✅ **Platform Adapters**
- Dependency injection pattern
- Browser and Node support
- Edge runtime compatible

❌ **File-based Memory** → ✅ **Pluggable Adapters**
- Storage adapters (Postgres, LibSQL, Supabase)
- Vector adapters (Chroma, Pinecone, Qdrant)
- Embedding adapters (OpenAI, Cohere)

❌ **Langfuse Only** → ✅ **OpenTelemetry + Langfuse**
- Standard OTEL implementation
- Multiple exporter support
- Better vendor neutrality

### What to Add

➕ **Guardrails System**
- Input validation
- Output filtering
- Default safety presets
- Custom guardrail creation

➕ **Workflow Suspend/Resume**
- Human-in-the-loop support
- State persistence
- Resume from any point

➕ **CLI Tooling**
- Project scaffolding
- Code generation
- Development server

➕ **Memory Architecture**
- Conversation memory
- Semantic memory
- Working memory scopes

➕ **Agent Hooks**
- Lifecycle customization
- Event interception
- Custom middleware

➕ **Subagent Pattern**
- Supervisor coordination
- Clear handoff mechanisms
- Better than nested tools

### Architectural Principles

1. **Simple by Default, Powerful When Needed**
   - Beginner API: Simple `Agent` class
   - Power user API: `StateGraph` with full control

2. **Platform Agnostic**
   - Works in browser, Node.js, edge runtimes
   - Adapter pattern for platform-specific features

3. **Type-Safe**
   - TypeScript-first
   - Zod schemas for runtime validation
   - Full type inference

4. **Modular**
   - Use only what you need
   - Tree-shakeable
   - Independent package versions

5. **Production Ready**
   - Error handling
   - Retry logic
   - Observability
   - Guardrails
   - Rate limiting

6. **Extensible**
   - Plugin architecture
   - Custom tools
   - Custom adapters
   - Custom providers

---

## Comparison with Original Plan

### Key Improvements

| Feature | **Original Plan** | **✅ Improved Plan** | **Source** |
|---------|------------------|---------------------|-----------|
| **LLM Integration** | Custom providers | Vercel AI SDK v5 | Mastra + VoltAgent |
| **Guardrails** | ❌ Not planned | ✅ Built-in safety | VoltAgent |
| **Suspend/Resume** | ❌ Not planned | ✅ Workflow suspension | VoltAgent |
| **CLI** | ❌ Not planned | ✅ Project scaffolder | Both |
| **Memory** | File-based | Pluggable adapters | VoltAgent |
| **Observability** | Langfuse only | OpenTelemetry + Langfuse | VoltAgent |
| **Tool System** | Custom | Zod-based | Both |
| **Examples** | 5 examples | 10+ comprehensive | VoltAgent (60+) |
| **Testing** | Basic | Mock utilities | Mastra |
| **Workflow API** | Graph only | Graph + chainable | Both |
| **Package Exports** | Basic | Granular subpath | Mastra |
| **Build Tool** | esbuild/Rollup | tsup | Both |
| **Monorepo** | Lerna | pnpm + Turborepo | Both |

### Benefits of Improved Plan

1. **Industry Standard Adoption**: Using Vercel AI SDK v5 aligns with ecosystem
2. **Production Safety**: Guardrails are essential for real-world deployment
3. **Better UX**: Human-in-the-loop with suspend/resume
4. **Developer Experience**: CLI tooling reduces friction
5. **Flexibility**: Pluggable adapters for storage, vectors, embeddings
6. **Observability**: OpenTelemetry is vendor-neutral standard
7. **Type Safety**: Zod schemas provide runtime + compile-time validation
8. **Comprehensive Examples**: Learn by example approach
9. **Testing Support**: Mock utilities make SDK more testable
10. **Performance**: tsup builds faster than custom Rollup config

---

## Next Steps

### Immediate Actions (Week 1)

1. **Create GitHub Repository**
   - Initialize monorepo structure
   - Setup branch protection
   - Configure issue templates

2. **Setup Development Environment**
   - Install pnpm, Turborepo
   - Configure TypeScript
   - Setup ESLint, Prettier

3. **Create RFC Document**
   - Share plan with team
   - Gather feedback
   - Finalize architecture decisions

4. **Start Phase 1 Implementation**
   - Setup monorepo
   - Begin core extraction
   - Integrate Vercel AI SDK

### Communication Plan

- **Internal:** Weekly sync meetings, Slack updates
- **External:** Blog posts, Discord community, Twitter updates
- **Documentation:** Progressive documentation as features complete

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking Browser Operator | HIGH | Incremental migration, feature flags, parallel development |
| Missing browser features | MEDIUM | Comprehensive platform adapter, feature parity testing |
| API instability | MEDIUM | Beta period, semver, detailed changelog |
| Performance regression | LOW | Continuous benchmarks, profiling |
| Adoption challenges | MEDIUM | Great docs, examples, CLI tooling |

---

## Conclusion

This improved SDK extraction plan incorporates best practices from Mastra and VoltAgent while preserving the unique strengths of Browser Operator's ai_chat system. The result will be a **production-ready, developer-friendly, and industry-standard AI agent SDK** that can compete with leading frameworks.

**Key Success Factors:**
- ✅ Modern architecture (Vercel AI SDK, OpenTelemetry, Zod)
- ✅ Excellent DX (CLI, examples, docs, playground)
- ✅ Production features (guardrails, memory, observability)
- ✅ Extensibility (plugins, adapters, hooks)
- ✅ Performance (tree-shaking, lazy loading, efficient builds)

**Timeline:** 12 weeks to v1.0.0 stable release

**Team:** Requires 2-3 engineers + 1 technical writer

**Expected Outcome:** Industry-leading AI agent SDK with strong community adoption
