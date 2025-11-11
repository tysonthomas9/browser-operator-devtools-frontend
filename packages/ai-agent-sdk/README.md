# @browser-operator/ai-agent-sdk

Production-ready SDK for building multi-agent AI systems with LLM support.

## 🚧 Work in Progress

This SDK is currently being extracted from the Browser Operator project. It aims to provide a platform-agnostic framework for building sophisticated multi-agent AI systems.

## Features

- ✅ **Multi-Provider LLM Support**: OpenAI, LiteLLM, Groq, OpenRouter, and more
- ✅ **Type-Safe**: Full TypeScript support with strict types
- ✅ **Minimal Dependencies**: Zero runtime dependencies
- ✅ **Message Types**: Complete chat and agent session types
- ✅ **Tool System**: Extensible tool interface with registry
- ✅ **Observability**: Built-in logging and tracing system
- ✅ **Agent Framework**: Configurable agents with tool execution and handoffs
- ✅ **Graph Orchestration**: State machine-based workflow orchestration
- ✅ **Tracing**: Langfuse integration for distributed tracing
- ✅ **MCP Integration**: Model Context Protocol for third-party tools

## Installation

```bash
npm install @browser-operator/ai-agent-sdk
```

## Quick Start

```typescript
import { LLMProviderRegistry, LLMTypes } from '@browser-operator/ai-agent-sdk';

// More examples coming soon as we complete the extraction
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

## Project Structure

```
packages/ai-agent-sdk/
├── src/
│   ├── llm/              # LLM provider system (✅ Complete)
│   ├── observability/    # Logging system (✅ Complete)
│   ├── messaging/        # Message types (✅ Complete)
│   ├── tools/            # Tool system (✅ Complete)
│   ├── agent/           # Agent framework (✅ Complete)
│   ├── orchestration/   # Graph workflows (✅ Complete)
│   ├── tracing/         # Tracing system (✅ Complete)
│   └── mcp/             # MCP integration (✅ Complete)
├── tests/               # 140 passing tests
├── examples/            # Usage examples (✅ Complete - 5 examples)
└── docs/                # Documentation (✅ Complete - API, Best Practices, Migration)
```

## Roadmap

### Phase 1: Core SDK Foundation ✅ COMPLETE
- [x] Package structure and build system
- [x] LLM types and interfaces
- [x] Provider registry
- [x] Response parser
- [x] Message sanitizer
- [x] Structured logger with log levels
- [x] Unit tests (56 tests passing)

### Phase 2A: Messaging & Tools ✅ COMPLETE
- [x] Chat message types (User, Model, Tool Result)
- [x] Agent session types
- [x] Tool interface and context
- [x] Tool registry with factory pattern
- [x] Unit tests (27 new tests, 83 total)

### Phase 2B: Agent Framework ✅ COMPLETE
- [x] AgentRunner extraction (execution loop)
- [x] ConfigurableAgent (agents as tools)
- [x] Agent handoff system
- [x] Event bus for agent communication
- [x] Unit tests (115 tests passing)

### Phase 3: Graph Orchestration ✅ COMPLETE
- [x] StateGraph (state machine executor)
- [x] Conditional routing with targetMaps
- [x] Graph builder utilities
- [x] Error handling (abort, max steps, routing errors)
- [x] Progress monitoring callbacks
- [x] Unit tests (29 new tests, 144 total)

### Phase 4: LLM Infrastructure ✅ COMPLETE
- [x] LLMClient coordinator (singleton with provider management)
- [x] LLMErrorHandler (error classification, retry logic with backoff)
- [x] OpenAIProvider (Responses API with GPT-4.1, O-series support)
- [x] LiteLLMProvider (OpenAI-compatible proxy with dynamic models)
- [x] GroqProvider (Fast inference with Llama, Mixtral, Gemma)
- [x] OpenRouterProvider (100+ models with vision support)
- [x] BrowserOperatorProvider (Semantic routing with X-Agent header)
- [x] Unit tests (44 new tests, 188 total)

### Phase 5: Graph Infrastructure ✅ COMPLETE
- [x] GraphNodeHelpers (8 helper functions for common node patterns)
  - createTransformNode, createAsyncTransformNode
  - createConditionalNode, createValidationNode
  - createRetryNode, createLoggingNode
  - createFinalNode, createPassthroughNode
- [x] GraphRoutingHelpers (11 routing utilities)
  - createPropertyRouter, createConditionalRouter
  - createErrorRouter, createMultiConditionRouter
  - createRangeRouter, createCycleRouter
  - createEndRouter, createFixedRouter
  - combineRouters, createTypeRouter
- [x] Platform-agnostic implementations (no browser dependencies)
- [x] Unit tests (38 new tests, 226 total)

### Phase 6: Documentation & Examples ✅ COMPLETE
- [x] Complete API documentation (API.md - full reference)
- [x] Usage examples (5 comprehensive examples)
  - 01-basic-llm-usage.ts (Provider initialization, API calls)
  - 02-graph-workflow.ts (State machines, node patterns, routing)
  - 03-multi-agent-handoff.ts (Agent coordination, task routing)
  - 04-error-handling-retry.ts (Error classification, retry patterns, fallback)
  - 05-advanced-routing.ts (Property, range, cycle, multi-condition routing)
- [x] Best practices guide (BEST_PRACTICES.md - production guidelines)
- [x] Migration guide (MIGRATION.md - from Browser Operator, LangChain, LlamaIndex)

### Phase 6.5: Tracing & MCP Integration ✅ COMPLETE
- [x] Tracing system base (TracingProvider abstract class)
- [x] LangfuseProvider implementation (batch ingestion, auto-flush, observation store)
- [x] TracingConfig (platform-agnostic configuration)
- [x] MCP integration (MCPToolAdapter for third-party tools)
- [x] MCPRegistry (connection management with retry logic)
- [x] MCPConfig (provider configuration and OAuth support)
- [x] ToolNameMap (conflict resolution utilities)

### Phase 7: Browser Operator Migration
- [ ] Migrate Browser Operator to use SDK
- [ ] Create `@browser-operator/browser-tools` package
- [ ] Performance validation
- [ ] Production deployment

## License

BSD-3-Clause - See LICENSE file for details

## Contributing

This project is currently in active development. Contribution guidelines will be added soon.

## Related Projects

- [Browser Operator](https://github.com/BrowserOperator/browser-operator-core) - Browser automation with AI agents
