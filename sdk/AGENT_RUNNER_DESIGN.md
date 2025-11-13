# AgentRunner Design

## Overview

The `AgentRunner` is an advanced execution engine for multi-iteration agentic workflows. It extends the basic `Agent` class with enhanced error recovery, detailed session tracking, and progress events.

## Architecture

```
Agent (Basic)
  ↓ uses
AgentRunner (Advanced)
  ↓ uses
Tools + LLM Providers + Memory
```

## Key Features

### 1. Multi-Iteration Loop with Error Recovery
- Execute tools and get results over multiple iterations
- Continue on errors instead of failing immediately
- Track max iterations and timeout gracefully
- Return partial results when iterations exhausted

### 2. Detailed Session Tracking
- **Session ID**: Unique identifier for each agent execution
- **Messages**: All user, assistant, and tool messages
- **Iterations**: Track progress through execution
- **Tool Calls**: Record all tool invocations with arguments
- **Tool Results**: Record results, errors, and timing
- **Status**: running | completed | error
- **Termination Reason**: final_answer | max_iterations | error

### 3. Progress Events
- `session_started`: Agent execution begins
- `iteration_started`: New iteration begins (with iteration count)
- `tool_call`: Tool is called (with tool name and args)
- `tool_result`: Tool completes (with result or error)
- `session_completed`: Agent execution ends (with reason)

### 4. Tool Result Formatting
- **Text results**: Simple string responses
- **Structured data**: JSON objects with metadata
- **Error handling**: Wrap errors in consistent format
- **Multi-modal support**: Handle text + images (future)

### 5. Browser-Compatible
- No Node.js dependencies
- Uses fetch() for API calls
- Works in browser, service worker, extension contexts
- IndexedDB for session persistence (optional)

## API Design

```typescript
// Create AgentRunner
const runner = new AgentRunner({
  model: 'gpt-4o',
  provider: openaiProvider,
  tools: {
    weather: weatherTool,
    search: searchTool,
  },
  maxIterations: 10,
  continueOnError: true,
});

// Execute with session tracking
const result = await runner.run('What is the weather in SF?', {
  sessionId: 'custom-session-id', // Optional
  onProgress: (event) => {
    console.log('Progress:', event);
  },
  abortSignal: signal, // Optional cancellation
});

// Result structure
interface RunResult {
  success: boolean;
  output?: string;
  error?: string;
  session: {
    sessionId: string;
    status: 'completed' | 'error';
    terminationReason: 'final_answer' | 'max_iterations' | 'error';
    startTime: Date;
    endTime: Date;
    iterationCount: number;
    messages: Message[];
    toolCalls: ToolCallRecord[];
  };
}
```

## Implementation Plan

### Phase 1: Core AgentRunner ✅
- [x] AgentRunner class with run() method
- [x] Multi-iteration execution loop
- [x] Tool execution and result handling
- [x] Session tracking structure
- [x] Basic error handling

### Phase 2: Error Recovery
- [ ] Continue on tool errors (configurable)
- [ ] Retry logic for transient failures
- [ ] Error message formatting for LLM
- [ ] Graceful degradation on max iterations

### Phase 3: Progress Events
- [ ] EventEmitter integration
- [ ] session_started event
- [ ] iteration_started event
- [ ] tool_call / tool_result events
- [ ] session_completed event

### Phase 4: Advanced Features
- [ ] Session persistence (IndexedDB)
- [ ] Resume from saved session
- [ ] Abort/cancellation support
- [ ] Streaming mode for real-time output

### Phase 5: Examples & Docs
- [ ] Basic agent runner example
- [ ] Error recovery example
- [ ] Progress tracking example
- [ ] API documentation

## Differences from Basic Agent

| Feature | Agent | AgentRunner |
|---------|-------|-------------|
| **Complexity** | Simple, minimal | Advanced, feature-rich |
| **Error Handling** | Throws on error | Continues with recovery |
| **Session Tracking** | Basic state | Detailed session with history |
| **Progress Events** | Basic events | Granular progress events |
| **Use Case** | Quick tasks, single tool | Complex workflows, multi-step |
| **Bundle Size** | Small (~2KB) | Larger (~8KB) |

## When to Use

**Use Agent when:**
- Simple one-shot queries
- Single tool execution
- Minimal bundle size needed
- Don't need detailed tracking

**Use AgentRunner when:**
- Multi-step agentic workflows
- Need error recovery
- Want detailed progress tracking
- Building complex AI applications
- Need session persistence

## Browser Compatibility

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

**Requirements:**
- ES2020 support
- fetch() API
- Promises/async-await
- Optional: IndexedDB (for persistence)

## Next Steps

1. Implement Phase 1 (Core AgentRunner)
2. Create basic example
3. Test with existing tools
4. Implement Phase 2-3 based on usage feedback
