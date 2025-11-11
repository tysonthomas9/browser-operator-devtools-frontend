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
- ✅ **Observability**: Built-in logging system
- ✅ **Agent Framework**: Configurable agents with tool execution and handoffs
- ✅ **Graph Orchestration**: State machine-based workflow orchestration

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
│   └── orchestration/   # Graph workflows (✅ Complete)
├── tests/               # 144 passing tests
├── examples/            # Usage examples (coming)
└── docs/                # Documentation (coming)
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

### Phase 4: Documentation & Examples
- [ ] Complete API documentation
- [ ] Usage examples (5+ scenarios)
- [ ] Migration guide
- [ ] Best practices guide

### Phase 5: Browser Operator Migration
- [ ] Extract remaining provider implementations
- [ ] Migrate Browser Operator to use SDK
- [ ] Create `@browser-operator/browser-tools` package
- [ ] Performance validation

## License

BSD-3-Clause - See LICENSE file for details

## Contributing

This project is currently in active development. Contribution guidelines will be added soon.

## Related Projects

- [Browser Operator](https://github.com/BrowserOperator/browser-operator-core) - Browser automation with AI agents
