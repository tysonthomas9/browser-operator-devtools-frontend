# AI Agent SDK Examples

This directory contains comprehensive examples demonstrating how to use the AI Agent SDK for building sophisticated AI agent workflows.

## Available Examples

### 1. Basic LLM Usage (`01-basic-llm-usage.ts`)

Learn the fundamentals of LLM integration:
- Initialize `LLMClient` with multiple providers
- Make basic LLM calls
- Parse responses and extract tool calls
- Switch between different providers (OpenAI, Groq, etc.)
- Query available models

**Key Concepts**: Provider initialization, API calls, tool/function calling, model selection

**Run**:
```bash
cd packages/ai-agent-sdk
npm run build
node examples/01-basic-llm-usage.js
```

### 2. Graph Workflow with Helpers (`02-graph-workflow.ts`)

Build state machines using the graph orchestration system:
- Create nodes using `GraphNodeHelpers`
- Implement conditional routing with `GraphRoutingHelpers`
- Handle errors and retries in workflows
- Monitor progress with callbacks
- Use streaming execution for real-time updates

**Key Concepts**: State machines, node patterns, routing logic, error handling, progress monitoring

**Run**:
```bash
cd packages/ai-agent-sdk
npm run build
node examples/02-graph-workflow.js
```

### 3. Multi-Agent Handoff (`03-multi-agent-handoff.ts`)

Coordinate multiple specialized agents:
- Create agents with specific capabilities (researcher, coder, reviewer)
- Implement task routing based on requirements
- Enable automatic agent-to-agent handoffs
- Pass context between agents
- Build collaborative multi-agent workflows

**Key Concepts**: Agent specialization, task routing, agent collaboration, context sharing

**Run**:
```bash
cd packages/ai-agent-sdk
npm run build
node examples/03-multi-agent-handoff.js
```

### 4. Error Handling and Retry (`04-error-handling-retry.ts`)

Build resilient AI workflows:
- Classify different types of LLM errors
- Implement exponential backoff retry logic
- Use `LLMRetryManager` for automatic retries
- Create provider fallback strategies
- Monitor and log retry attempts

**Key Concepts**: Error classification, retry patterns, fallback strategies, resilience

**Run**:
```bash
cd packages/ai-agent-sdk
npm run build
node examples/04-error-handling-retry.js
```

### 5. Advanced Routing Patterns (`05-advanced-routing.ts`)

Master sophisticated routing techniques:
- Property-based routing for state-driven workflows
- Range-based routing for numeric thresholds
- Cycle routers for iterative batch processing
- Multi-condition routing for complex logic
- Combine multiple routers with fallback

**Key Concepts**: Routing strategies, conditional logic, batch processing, complex workflows

**Run**:
```bash
cd packages/ai-agent-sdk
npm run build
node examples/05-advanced-routing.js
```

## Setup

### Prerequisites

1. **Node.js**: Version 18+ required
2. **TypeScript**: Installed automatically with dependencies
3. **API Keys**: Set environment variables for LLM providers

### Environment Variables

Create a `.env` file in the `packages/ai-agent-sdk` directory:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Groq
GROQ_API_KEY=gsk_...

# LiteLLM (if using)
LITELLM_API_KEY=...
LITELLM_BASE_URL=http://localhost:4000

# OpenRouter (if using)
OPENROUTER_API_KEY=...

# BrowserOperator (if using)
BROWSEROPERATOR_API_KEY=...
BROWSEROPERATOR_BASE_URL=http://localhost:3000
```

### Installation

```bash
# Install dependencies
cd packages/ai-agent-sdk
npm install

# Build the SDK
npm run build

# Run tests (optional)
npm test
```

## Running Examples

All examples are written in TypeScript and need to be compiled before running:

```bash
# Build the SDK
npm run build

# Run a specific example
node examples/01-basic-llm-usage.js

# Or with ts-node (if installed)
npx ts-node examples/01-basic-llm-usage.ts
```

## Example Structure

Each example follows a consistent structure:

1. **Header Comment**: Describes what the example demonstrates
2. **Imports**: Shows which SDK components are used
3. **Type Definitions**: Defines state interfaces and types
4. **Step-by-Step Implementation**: Numbered steps with explanations
5. **Console Output**: Informative logging to show what's happening
6. **Key Takeaways**: Summary of important concepts

## Learning Path

We recommend going through the examples in order:

1. **Start with Example 1**: Learn basic LLM integration
2. **Move to Example 2**: Understand state machine orchestration
3. **Try Example 3**: See multi-agent collaboration in action
4. **Study Example 4**: Master error handling and resilience
5. **Explore Example 5**: Learn advanced routing techniques

## Common Patterns

### Creating Nodes

```typescript
import { createAsyncTransformNode } from '../src/index.js';

const myNode = createAsyncTransformNode<MyState>(
  'nodeName',
  async (state) => {
    // Transform state
    return { ...state, newField: 'value' };
  }
);
```

### Building Graphs

```typescript
import { GraphBuilder, END_NODE } from '../src/index.js';

const graph = new GraphBuilder<MyState>()
  .addNode('start', startNode)
  .addNode('process', processNode)
  .addEdge('start', 'process')
  .addEdge('process', END_NODE)
  .setEntryPoint('start')
  .build();
```

### Executing Workflows

```typescript
const result = await graph.invoke(initialState, {
  maxSteps: 10,
  onProgress: (state, nodeName) => {
    console.log(`Executed: ${nodeName}`);
  }
});
```

### Error Handling

```typescript
import { LLMRetryManager } from '../src/index.js';

const retryManager = new LLMRetryManager();

const result = await retryManager.executeWithRetry(
  async () => {
    // Your operation
  },
  {
    customRetryConfig: { maxRetries: 3, baseDelayMs: 1000 }
  }
);
```

## Troubleshooting

### "Module not found" errors

Make sure you've built the SDK:
```bash
npm run build
```

### API key errors

Verify your environment variables are set:
```bash
echo $OPENAI_API_KEY
```

### TypeScript compilation errors

Ensure you're using Node.js 18+ and have the latest dependencies:
```bash
node --version
npm install
```

## Next Steps

After working through these examples:

1. **Read the API Documentation**: See `../docs/API.md` for detailed reference
2. **Review Best Practices**: Check `../docs/BEST_PRACTICES.md` for guidelines
3. **Explore Migration Guide**: If migrating from another framework, see `../docs/MIGRATION.md`
4. **Build Your Own**: Start creating your own AI agent workflows!

## Contributing

Have an idea for a new example? We welcome contributions!

1. Create a new file following the naming convention: `NN-example-name.ts`
2. Follow the existing example structure
3. Add clear comments and console output
4. Update this README with your example
5. Submit a pull request

## Support

For questions or issues:

1. Check the main SDK documentation in `../README.md`
2. Review the API reference in `../docs/API.md`
3. Look at the test files in `../tests/` for more usage examples
4. Open an issue on GitHub

## License

Copyright 2025 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be found in the LICENSE file.
