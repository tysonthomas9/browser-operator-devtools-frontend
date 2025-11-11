# @browser-operator/core

Core agent framework for Browser Operator SDK - **Browser-compatible!**

## ✨ Features

- 🌐 **Browser-First** - Runs natively in the browser using `fetch()` API
- 🚀 **Simple API** - Easy to use, powerful when needed
- 📦 **Zero Dependencies** - Only Zod for runtime validation
- 🔧 **Extensible** - Hooks, events, and custom providers
- 🎯 **Type-Safe** - Full TypeScript support
- 🔄 **Streaming** - Real-time response streaming
- 🛠️ **Tool Support** - Function calling with OpenAI, Claude, etc.

## Installation

```bash
npm install @browser-operator/core zod
```

## Quick Start

### In the Browser

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        import { Agent, OpenAIProvider } from '@browser-operator/core';

        // Create provider
        const provider = new OpenAIProvider('your-api-key');

        // Create agent
        const agent = new Agent({
            name: 'my-agent',
            model: 'gpt-3.5-turbo',
            instructions: 'You are a helpful assistant.',
        }, provider);

        // Run agent
        const result = await agent.generateText('Hello!');
        console.log(result.text);
    </script>
</head>
<body>
    <h1>Browser Operator Agent</h1>
</body>
</html>
```

### In Node.js

```typescript
import { Agent, OpenAIProvider } from '@browser-operator/core';

const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);

const agent = new Agent({
  name: 'my-agent',
  model: 'gpt-4',
  instructions: 'You are a helpful assistant.',
  temperature: 0.7,
  maxIterations: 10,
}, provider);

const result = await agent.generateText('Tell me a joke');
console.log(result.text);
```

## Core Concepts

### Agent

The main class for creating and running AI agents.

```typescript
const agent = new Agent(config, provider);
```

### Providers

Browser-compatible LLM providers using `fetch()`:

- `OpenAIProvider` - OpenAI API (GPT-3.5, GPT-4, etc.)
- `BaseLLMProvider` - Base class for custom providers

```typescript
// OpenAI
const provider = new OpenAIProvider('your-api-key');

// Custom endpoint
const provider = new OpenAIProvider('your-api-key', 'https://api.custom.com/v1/chat/completions');
```

### Streaming

```typescript
const stream = await agent.streamText('Tell me a story');

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### Events

Subscribe to agent events for observability:

```typescript
import { AgentEvent } from '@browser-operator/core';

agent.on(AgentEvent.START, ({ context }) => {
  console.log('Agent started:', context.sessionId);
});

agent.on(AgentEvent.FINISH, ({ result }) => {
  console.log('Agent finished:', result.finishReason);
  console.log('Tokens used:', result.usage?.totalTokens);
});

agent.on(AgentEvent.ERROR, ({ error }) => {
  console.error('Agent error:', error.message);
});
```

### Hooks

Customize agent behavior with lifecycle hooks:

```typescript
const agent = new Agent({
  name: 'my-agent',
  model: 'gpt-4',
  hooks: {
    onStart: async (context) => {
      console.log('Starting agent...');
    },
    onIteration: async (context, iteration) => {
      console.log(`Iteration ${iteration}`);
    },
    onToolCall: async (context, toolCall) => {
      console.log(`Calling tool: ${toolCall.name}`);
    },
    onFinish: async (context, result) => {
      console.log('Agent finished:', result.finishReason);
    },
    onError: async (context, error) => {
      console.error('Error:', error);
    },
  },
}, provider);
```

## API Reference

### Agent

```typescript
class Agent<TTools extends ToolSet = ToolSet> {
  constructor(config: AgentConfig<TTools>, provider: ILLMProvider);

  // Generate text response
  generateText(input: string, options?: ExecutionOptions): Promise<AgentResult>;

  // Stream text response
  streamText(input: string, options?: ExecutionOptions): AsyncIterable<string>;

  // Event subscription
  on<E extends keyof AgentEventMap>(event: E, handler: (payload: AgentEventMap[E]) => void): void;
  off<E extends keyof AgentEventMap>(event: E, handler: (payload: AgentEventMap[E]) => void): void;

  // Get configuration
  getConfig(): AgentConfig<TTools>;
  getSessionId(): string;
}
```

### AgentConfig

```typescript
interface AgentConfig<TTools extends ToolSet = ToolSet> {
  name: string;
  instructions?: string;
  model: string;
  tools?: TTools;
  maxIterations?: number;
  temperature?: number;
  hooks?: AgentHooks;
  metadata?: Record<string, unknown>;
}
```

### AgentResult

```typescript
interface AgentResult {
  text: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool-calls' | 'error' | 'max-iterations';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  state: AgentState;
}
```

## Browser Compatibility

Works in all modern browsers with:
- ✅ ES Modules
- ✅ Fetch API
- ✅ Async/Await
- ✅ ReadableStream (for streaming)

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

## Examples

See the [examples](../../examples) directory:
- [browser-basic](../../examples/browser-basic) - Basic browser usage
- [streaming](../../examples/streaming) - Streaming responses
- [custom-provider](../../examples/custom-provider) - Custom LLM provider

## License

BSD-3-Clause
