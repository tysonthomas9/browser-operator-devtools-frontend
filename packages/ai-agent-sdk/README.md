# @browser-operator/ai-agent-sdk

Production-ready SDK for building multi-agent AI systems with LLM support.

## 🚧 Work in Progress

This SDK is currently being extracted from the Browser Operator project. It aims to provide a platform-agnostic framework for building sophisticated multi-agent AI systems.

## Features (In Development)

- ✅ **Multi-Provider LLM Support**: OpenAI, LiteLLM, Groq, OpenRouter, and more
- ✅ **Type-Safe**: Full TypeScript support with strict types
- ✅ **Minimal Dependencies**: Clean, focused dependencies
- 🚧 **Agent Framework**: Configurable agents with tool execution
- 🚧 **Graph Orchestration**: State machine-based workflows
- 🚧 **Tool System**: Extensible tool interface
- 🚧 **Observability**: Built-in logging and tracing

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
│   ├── llm/              # LLM provider implementations
│   ├── observability/    # Logging and tracing
│   ├── agent/           # Agent framework (coming soon)
│   ├── orchestration/   # Graph-based workflows (coming soon)
│   └── tools/           # Tool system (coming soon)
├── tests/               # Test files
├── examples/            # Usage examples
└── docs/                # Documentation
```

## Roadmap

### Phase 1: Core SDK Foundation (In Progress)
- [x] Package structure and build system
- [x] LLM types and interfaces
- [x] Provider registry
- [x] Response parser
- [x] Message sanitizer
- [x] Basic logger
- [ ] Unit tests for LLM layer
- [ ] OpenAI provider implementation
- [ ] LiteLLM provider implementation

### Phase 2: Agent Framework
- [ ] AgentRunner extraction
- [ ] ConfigurableAgent
- [ ] Tool system
- [ ] Agent handoffs

### Phase 3: Graph Orchestration
- [ ] StateGraph
- [ ] Graph configuration
- [ ] Conditional routing

### Phase 4: Documentation & Examples
- [ ] Complete API documentation
- [ ] Usage examples
- [ ] Migration guide

### Phase 5: Browser Operator Migration
- [ ] Migrate Browser Operator to use SDK
- [ ] Browser-specific tools package

## License

BSD-3-Clause - See LICENSE file for details

## Contributing

This project is currently in active development. Contribution guidelines will be added soon.

## Related Projects

- [Browser Operator](https://github.com/BrowserOperator/browser-operator-core) - Browser automation with AI agents
