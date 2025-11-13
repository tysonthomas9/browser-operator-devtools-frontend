# AgentRunner

Advanced multi-iteration agent execution engine for complex agentic workflows.

## Overview

`AgentRunner` provides enhanced capabilities beyond the basic `Agent` class:

- **Error Recovery** - Continue execution even when tools fail
- **Detailed Session Tracking** - Track every iteration, tool call, and result
- **Progress Events** - Real-time progress updates for UI integration
- **Tool Execution** - Seamlessly execute tools with result handling
- **Browser-Compatible** - Works in all modern browsers

## When to Use

| Use Case | Agent | AgentRunner |
|----------|-------|-------------|
| Simple one-shot queries | ✅ | ✅ |
| Multi-step workflows | ❌ | ✅ |
| Error recovery needed | ❌ | ✅ |
| Detailed progress tracking | ❌ | ✅ |
| Session persistence | ❌ | ✅ |
| Real-time UI updates | ❌ | ✅ |

**Use `Agent`** for simple, lightweight tasks.
**Use `AgentRunner`** for complex, multi-step agentic workflows.

## Installation

```bash
npm install @browser-operator/core
```

## Quick Start

```typescript
import { AgentRunner, createTool } from '@browser-operator/core';
import { OpenAIProvider } from '@browser-operator/core/llm';
import { z } from 'zod';

// Create a tool
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  schema: z.object({
    location: z.string(),
  }),
  execute: async (args) => {
    const response = await fetch(`https://api.weather.com/${args.location}`);
    return response.json();
  },
});

// Initialize provider
const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);

// Create runner
const runner = new AgentRunner({
  model: 'gpt-4o',
  provider,
  instructions: 'You are a helpful assistant with access to tools.',
  tools: {
    get_weather: weatherTool,
  },
  maxIterations: 10,
  continueOnError: true,
});

// Execute
const result = await runner.run('What is the weather in San Francisco?');

console.log(result.output);
// => "The current weather in San Francisco is 72°F and sunny with 65% humidity."
```

## Core Concepts

### 1. Session Tracking

Every execution creates a `session` that tracks:

- **Session ID** - Unique identifier
- **Messages** - All user, assistant, and tool messages
- **Tool Calls** - Every tool invocation with arguments
- **Tool Results** - Results, errors, and timing for each call
- **Iterations** - Progress through execution loop
- **Termination** - Why execution ended (final_answer | max_iterations | error)

```typescript
const result = await runner.run('Search for TypeScript info');

console.log(result.session);
// {
//   sessionId: 'session-1234...',
//   status: 'completed',
//   terminationReason: 'final_answer',
//   startTime: Date,
//   endTime: Date,
//   iterationCount: 3,
//   messages: [...],
//   toolCalls: [...],
//   toolResults: [...],
// }
```

### 2. Progress Events

Track execution in real-time:

```typescript
const result = await runner.run('Complex task...', {
  onProgress: (event) => {
    switch (event.type) {
      case 'session_started':
        console.log('Starting...');
        break;
      case 'iteration_started':
        console.log(`Iteration ${event.data.iteration}`);
        break;
      case 'tool_call':
        console.log(`Calling ${event.data.toolCall.toolName}`);
        break;
      case 'tool_result':
        console.log(`Result: ${event.data.toolResult.success}`);
        break;
      case 'session_completed':
        console.log(`Done: ${event.data.reason}`);
        break;
    }
  },
});
```

### 3. Error Recovery

Continue execution even when tools fail:

```typescript
const runner = new AgentRunner({
  // ...
  continueOnError: true, // ← Continue despite errors
});

const result = await runner.run('Try multiple approaches');

// Check for errors in session
const errors = result.session.toolResults.filter((r) => !r.success);
console.log(`Encountered ${errors.length} errors, but completed successfully!`);
```

### 4. Cancellation

Cancel long-running executions:

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const result = await runner.run('Long task...', {
  abortSignal: controller.signal,
});

console.log(result.session.terminationReason);
// => 'aborted'
```

## API Reference

### `AgentRunner` Constructor

```typescript
new AgentRunner(config: AgentRunnerConfig)
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | *required* | Model name (e.g., 'gpt-4o') |
| `provider` | `ILLMProvider` | *required* | LLM provider instance |
| `instructions` | `string` | - | System prompt/instructions |
| `tools` | `Record<string, Tool>` | - | Available tools |
| `maxIterations` | `number` | `10` | Max execution iterations |
| `temperature` | `number` | `0.7` | LLM temperature |
| `continueOnError` | `boolean` | `true` | Continue on tool errors |
| `runtimeContext` | `Record<string, unknown>` | - | Context for tool execution |
| `metadata` | `Record<string, unknown>` | - | Custom session metadata |

### `runner.run()`

```typescript
async run(input: string, options?: RunOptions): Promise<RunResult>
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `sessionId` | `string` | Custom session ID |
| `onProgress` | `(event: ProgressEvent) => void` | Progress callback |
| `abortSignal` | `AbortSignal` | Cancellation signal |
| `temperature` | `number` | Override temperature |
| `maxIterations` | `number` | Override max iterations |

**Returns:** `RunResult`

```typescript
interface RunResult {
  success: boolean;
  output?: string;     // Final answer (if successful)
  error?: string;      // Error message (if failed)
  session: AgentSession; // Complete session data
  usage?: {            // Token usage
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### Session Structure

```typescript
interface AgentSession {
  sessionId: string;
  status: 'running' | 'completed' | 'error';
  terminationReason?: 'final_answer' | 'max_iterations' | 'error' | 'aborted';
  startTime: Date;
  endTime?: Date;
  iterationCount: number;
  messages: SessionMessage[];
  toolCalls: ToolCallRecord[];
  toolResults: ToolResultRecord[];
  model: string;
  maxIterations: number;
  metadata?: Record<string, unknown>;
}
```

## Examples

### Basic Multi-Step Task

```typescript
const result = await runner.run(
  'What is the weather in SF? Then search for things to do there.'
);

console.log(`Used ${result.session.iterationCount} iterations`);
console.log(`Called ${result.session.toolCalls.length} tools`);
console.log(`Final answer: ${result.output}`);
```

### Progress Tracking with UI

```typescript
const progressDiv = document.getElementById('progress');

const result = await runner.run('Complex task...', {
  onProgress: (event) => {
    const msg = document.createElement('div');
    msg.textContent = `[${event.type}] ${JSON.stringify(event.data)}`;
    progressDiv.appendChild(msg);
  },
});
```

### Custom Session ID for Persistence

```typescript
// First execution
const result1 = await runner.run('Start task...', {
  sessionId: 'task-123',
});

// Save session for later
localStorage.setItem('session-123', JSON.stringify(result1.session));

// Later: retrieve and analyze
const savedSession = JSON.parse(localStorage.getItem('session-123'));
console.log('Previous execution used', savedSession.iterationCount, 'iterations');
```

### Retry Failed Tools

```typescript
const result = await runner.run('Try the flaky tool multiple times', {
  maxIterations: 20, // Allow many retries
});

// Analyze failure pattern
const attempts = result.session.toolResults.filter(
  (r) => r.toolName === 'flaky_tool'
);
console.log(`Succeeded after ${attempts.length} attempts`);
```

## Best Practices

### 1. Set Appropriate Max Iterations

```typescript
// Quick tasks
maxIterations: 5

// Medium complexity
maxIterations: 10 // (default)

// Complex workflows
maxIterations: 20

// Research/exploration
maxIterations: 50
```

### 2. Use Progress Events for UI

```typescript
const updateUI = (event: ProgressEvent) => {
  switch (event.type) {
    case 'tool_call':
      showSpinner(`Calling ${event.data.toolCall.toolName}...`);
      break;
    case 'tool_result':
      hideSpinner();
      break;
  }
};

const result = await runner.run(input, { onProgress: updateUI });
```

### 3. Handle Errors Gracefully

```typescript
const result = await runner.run('Task that might fail');

if (!result.success) {
  if (result.session.terminationReason === 'max_iterations') {
    // Agent ran out of time
    console.log('Task was too complex, here are partial results:', result.session.toolResults);
  } else {
    // Other error
    console.error('Error:', result.error);
  }
}
```

### 4. Analyze Sessions for Debugging

```typescript
const result = await runner.run('Complex task');

// Find slowest tool calls
const slowest = result.session.toolResults
  .sort((a, b) => (b.duration || 0) - (a.duration || 0))
  .slice(0, 3);

console.log('Slowest tools:', slowest);

// Find error patterns
const errors = result.session.toolResults.filter((r) => !r.success);
console.log('Error rate:', errors.length / result.session.toolResults.length);
```

## Performance

| Metric | Value |
|--------|-------|
| **Bundle Size** | ~8KB (gzipped) |
| **Overhead** | <1ms per iteration |
| **Memory** | ~100KB per session |
| **Concurrency** | Unlimited (client-side) |

## Browser Support

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

**Requirements:**
- ES2020 support
- `fetch()` API
- Promises/async-await

## Debugging

Enable debug logging:

```typescript
// Set environment variable
process.env.DEBUG = 'agent-runner:*';

// Or use console logging
const runner = new AgentRunner({
  // ...
  onProgress: (event) => console.log('[AgentRunner]', event),
});
```

## Common Issues

### "Tool not found" error

Make sure tools are registered correctly:

```typescript
const runner = new AgentRunner({
  tools: {
    my_tool: myTool, // ← Key must match tool name
  },
});
```

### Max iterations reached

Increase limit or simplify task:

```typescript
const result = await runner.run(input, {
  maxIterations: 20, // ← Increase limit
});
```

### Slow execution

Tools may be taking too long:

```typescript
// Analyze tool timing
result.session.toolResults.forEach((r) => {
  console.log(`${r.toolName}: ${r.duration}ms`);
});
```

## Next Steps

- See [examples/agent-runner-example.ts](../../../../examples/agent-runner-example.ts) for complete examples
- Read [AGENT_RUNNER_DESIGN.md](../../../../AGENT_RUNNER_DESIGN.md) for architecture details
- Check out [Tools documentation](../tools/README.md) for creating custom tools

## License

MIT
