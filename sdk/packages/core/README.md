# @browser-operator/core

Core agent framework for Browser Operator SDK.

## Features

- **Agent Execution** - Core agent runner with iteration loops
- **State Graphs** - Powerful state machine orchestration
- **Event System** - Track agent execution progress
- **Hooks** - Customize agent behavior with lifecycle hooks
- **Type-Safe** - Full TypeScript support

## Installation

```bash
npm install @browser-operator/core ai zod
```

## Usage

```typescript
import { Agent, StateGraph, AgentNode } from '@browser-operator/core';
import { openai } from 'ai';

// Simple agent
const agent = new Agent({
  name: 'my-agent',
  model: openai('gpt-4'),
  tools: [myTool],
});

// Advanced state graph
const graph = new StateGraph()
  .addNode('agent', new AgentNode({ model, tools }))
  .addEdge('agent', 'final');

const result = await graph.run({ input: 'Hello!' });
```

## API Reference

See [documentation](https://docs.browseroperator.io/sdk/core) for full API reference.

## License

BSD-3-Clause
