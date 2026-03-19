# Agent Framework Comparison: pi-agent-core vs ai_chat

A deep comparison of two agent frameworks — OpenClaw's embedded pi-agent-core runtime and the ai_chat agent framework in devtools-frontend.

## Overview

| | pi-agent-core | ai_chat |
|---|---|---|
| **Repo** | openclaw (via @mariozechner/pi-mono) | blue-browser/new-devtools |
| **Core LOC** | ~700 (agent-loop + agent + types + proxy) | ~1675 (AgentRunner.ts alone) |
| **Design** | Minimal embeddable core, complexity in layers above/below | Self-contained multi-agent orchestration framework |
| **Primary use case** | General-purpose coding agent | Browser automation with specialized agents |

---

## Architecture

### pi-agent-core

Layered SDK — each package has a single responsibility:

```
pi-coding-agent  ← Full framework (sessions, tools, extensions, CLI modes) — ~32K LOC
    ↓
pi-agent-core    ← Stateful agent loop (this doc's focus) — ~700 LOC
    ↓
pi-ai            ← LLM provider abstraction (18+ providers) — ~21K LOC

pi-tui           ← Terminal UI (orthogonal) — ~8K LOC
```

4 source files:
- `types.ts` — AgentState, AgentMessage, AgentTool, AgentEvent, AgentLoopConfig
- `agent-loop.ts` — The core loop (async generator with nested while)
- `agent.ts` — `Agent` class wrapping the loop with state management
- `proxy.ts` — Proxy streaming client for server-routed LLM calls

### ai_chat

Flat module structure under `/front_end/panels/ai_chat/`:

```
agent_framework/
├── AgentRunner.ts              # Core execution loop (1675 lines)
├── AgentSessionTypes.ts        # Session & message types
├── ConfigurableAgentTool.ts    # Agent config, ToolRegistry
├── AgentRunnerEventBus.ts      # Progress events
└── implementation/
    ├── agents/                 # ~15 specialized agents
    └── ConfiguredAgents.ts     # Agent registration

LLM/                            # Provider abstraction
├── LLMClient.ts               # Singleton client
├── LLMProvider.ts             # Base provider interface
└── [OpenAI|Anthropic|...]Provider.ts

tools/                          # 40+ tool implementations
├── Tools.ts                   # Tool interface
├── NavigateURLTool.ts
├── PerformActionTool.ts
└── ...
```

---

## Agent Loop

### pi-agent-core

A single async generator (`agentLoop`) with a nested while loop:

```
OUTER LOOP (follow-ups):
  INNER LOOP (tool calls + steering):
    1. Check for steering messages (user interrupts)
    2. Inject any pending messages into context
    3. streamAssistantResponse():
       a. transformContext(messages)     — context pruning/injection
       b. convertToLlm(messages)        — AgentMessage[] → Message[]
       c. getApiKey(provider)           — resolve fresh token
       d. streamSimple(model, context)  — LLM API call, streaming events
    4. If error/abort → emit agent_end, return
    5. Extract ALL tool calls from response
    6. executeToolCalls() — run tools SEQUENTIALLY:
       - After each tool: check getSteeringMessages()
       - If steering found: skip remaining tools
    7. Check for more steering messages
  END INNER (when no more tool calls and no steering)
  Check getFollowUpMessages() → if any, continue outer loop
END OUTER → emit agent_end
```

Key properties:
- **Multiple tool calls per LLM turn** — processes entire batch before next LLM call
- **No iteration limit** — runs until LLM stops emitting tool calls (token-bounded)
- **Streaming** — token-level deltas (text, thinking, tool call arguments)
- **The LLM decides when to stop** — no explicit "final_answer" parsing

### ai_chat

A for-loop with iteration counter in `AgentRunner.ts`:

```
FOR i = 0 to maxIterations:
  1. Enhance system prompt (inject iteration count, TODO context, page info)
  2. convertToLLMMessages(ChatMessage[] → LLMMessage[])
  3. sanitizeMessagesForModel(strip images for non-vision models)
  4. LLMClient.call({provider, model, messages, tools})
  5. parseResponse → tool_call | final_answer | error
  6. If tool_call:
     - Lookup tool in toolMap
     - Is it a handoff_to_* tool? → recursive AgentRunner.run()
     - Otherwise: tool.execute(args, ctx)
     - Add ToolResultMessage to history
     - Continue
  7. If final_answer:
     - Add to history, break
  8. If error:
     - AgentErrorHandler, add error message, continue
TERMINATION: final_answer | max_iterations | error | handed_off
```

Key properties:
- **One tool call per LLM turn** — one action parsed per iteration
- **Explicit max_iterations** (typically 10-15)
- **Full response** — no streaming to the agent loop
- **Explicit action parsing** — LLM must produce `tool_call` or `final_answer`

---

## Tool System

### pi-agent-core

```typescript
interface AgentTool<TParams extends TSchema, TDetails> extends Tool<TParams> {
  label: string;
  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal?: AbortSignal,
    onUpdate?: (partialResult: AgentToolResult<TDetails>) => void
  ): Promise<AgentToolResult<TDetails>>;
}

// Result type
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];
  details: T;
}
```

- TypeBox schemas for compile-time + runtime validation
- **Streaming partial results** via `onUpdate` callback
- Results carry structured `details` alongside LLM-visible `content`
- Validation at call boundary (`validateToolArguments`)

### ai_chat

```typescript
interface Tool<TArgs, TResult> {
  name: string;
  description: string;
  schema: { type: string; properties: Record<string, unknown>; required?: string[] };
  execute(args: TArgs, ctx?: LLMContext): Promise<TResult>;
}

// Context passed to tools
interface LLMContext {
  apiKey?: string;
  provider: LLMProvider;
  model: string;
  miniModel?: string;      // For cheaper sub-tasks
  nanoModel?: string;      // For even cheaper sub-tasks
  abortSignal?: AbortSignal;
  getVisionCapability?: (modelName: string) => boolean;
}
```

- Plain JSON Schema objects
- **No streaming** during tool execution
- Results are arbitrary objects, sanitized via `sanitizeToolResultForText()` (strips imageData, agentSession, etc.)
- Tools receive model tier info (mini/nano) for cost-aware sub-calls
- 40+ built-in tools for browser automation, file operations, data extraction

---

## Context Management

### pi-agent-core

Two-stage pluggable pipeline, runs before every LLM call:

```
AgentMessage[] → transformContext() → convertToLlm() → Message[] → LLM
```

**`transformContext(messages) → AgentMessage[]`**
- Extension pipeline — each registered extension can modify messages
- OpenClaw adds a tool-result context guard:
  - Truncates any single tool result > 50% of context window
  - Compacts oldest tool results if total exceeds 75% of window
  - Replaces content with "[compacted: tool output removed to free context]"

**`convertToLlm(messages) → Message[]`**
- Maps custom message types to LLM-compatible format:
  - `bashExecution` → user message with formatted command + output
  - `compactionSummary` → user message in `<summary>` tags
  - `branchSummary` → user message in `<summary>` tags
  - `custom` → user message
  - Standard messages pass through
- Image blocking filter (defense-in-depth)

### ai_chat

Direct conversion + sanitization:

```
ChatMessage[] → convertToLLMMessages() → sanitizeMessagesForModel() → LLMMessage[] → LLM
```

- `convertToLLMMessages`: Maps ChatMessage types to OpenAI format
- `sanitizeMessagesForModel`: Strips images for non-vision models
- `sanitizeToolResultForText`: Removes binary data from tool results
- System prompt enhanced per-iteration (iteration count, TODO list, page context)
- **No pluggable context transformation** — relies on max_iterations as the limit

---

## Interruption / Steering

### pi-agent-core — First-class mid-run steering

```typescript
// Queue an interrupt — checked after each tool execution
agent.steer(message);
// Remaining tool calls skipped: "Skipped due to queued user message"

// Queue for after completion
agent.followUp(message);

// Cancel entirely
agent.abort();

// Wait for current run to finish
await agent.waitForIdle();
```

Dequeue modes:
- `"one-at-a-time"` (default) — delivers one steering message per check
- `"all"` — delivers all queued messages at once

### ai_chat — Abort only

```typescript
// Only mechanism: AbortSignal passed through LLMContext
const abortController = new AbortController();
// ... later:
abortController.abort();
```

No mid-run steering, no follow-up queue.

---

## Multi-Agent / Handoffs

### pi-agent-core

No built-in multi-agent concept. The `Agent` class is a single loop. Multi-agent orchestration is handled externally (OpenClaw's session routing, Reachy Mini's peer agent system, etc.).

### ai_chat — First-class handoff system

```typescript
interface AgentToolConfig {
  handoffs?: HandoffConfig[];
}

interface HandoffConfig {
  targetAgentName: string;
  trigger: 'llm_tool_call' | 'max_iterations';
  includeToolResults?: string[];  // Filter context for child
}
```

- Handoffs appear as callable tools (`handoff_to_<agent_name>`)
- LLM can choose to delegate by "calling" the handoff tool
- Automatic handoff on max_iterations (fallback delegation)
- Recursive `AgentRunner.run()` creates nested `AgentSession`
- Parent tracks children in `nestedSessions[]`
- ~15 agents cooperate: WebTaskAgent → ActionAgent → ActionVerificationAgent, etc.

---

## LLM Provider Abstraction

### pi-agent-core

Delegates to `pi-ai` package:

```typescript
// Typed model reference with full autocomplete
const model: Model<"anthropic"> = getModel("anthropic", "claude-sonnet-4-20250514");

// Single streaming function
streamSimple(model, context, options) → AsyncIterable<AssistantMessageEvent>
```

- 18+ providers (Anthropic, OpenAI, Google, Bedrock, Azure, Groq, Cerebras, xAI, etc.)
- Token-level streaming events: `text_delta`, `thinking_delta`, `toolcall_delta`
- Proxy support for server-routed calls
- Dynamic API key resolution per call

### ai_chat

Own provider registry:

```typescript
// Singleton client
const client = LLMClient.getInstance();
await client.call({ provider, model, messages, tools }) → LLMResponse;

// Provider interface
interface LLMProviderInterface {
  callWithMessages(model, messages, options): Promise<LLMResponse>;
  getModels(): Promise<ModelInfo[]>;
  validateCredentials(): { isValid, message };
}
```

- 8 providers (OpenAI, Anthropic, Google, Groq, Cerebras, OpenRouter, LiteLLM, BrowserOperator)
- Full response (no streaming to agent loop)
- Generic OpenAI-compatible provider for custom endpoints
- Credential validation per provider

---

## Event System

### pi-agent-core

9 event types via `EventStream` (async iterable):

```typescript
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; assistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId; toolName; args }
  | { type: "tool_execution_update"; toolCallId; toolName; args; partialResult }
  | { type: "tool_execution_end"; toolCallId; toolName; result; isError }
```

Consumed via `for await (const event of stream)` or `agent.subscribe(fn)`.

### ai_chat

6 event types via `AgentRunnerEventBus` (pub/sub singleton):

```typescript
type AgentRunnerProgressEvent = {
  type: 'session_started' | 'tool_started' | 'tool_completed'
      | 'session_updated' | 'child_agent_started' | 'session_completed';
  sessionId: string;
  parentSessionId?: string;
  agentName: string;
  timestamp: Date;
  data: any;
};
```

Plus Langfuse tracing integration for hierarchical observation tracking.

---

## Hook / Extension Points

### pi-agent-core — 4 runtime hooks

| Hook | When | Purpose |
|------|------|---------|
| `convertToLlm(messages)` | Before each LLM call | Map AgentMessage[] → Message[] |
| `transformContext(messages)` | Before convertToLlm | Context pruning, injection, modification |
| `getSteeringMessages()` | After each tool execution | Mid-run interruption |
| `getFollowUpMessages()` | When agent would stop | Post-completion continuation |

Plus `getApiKey(provider)` for dynamic credential resolution.

These are **runtime hooks** — they fire during execution and modify behavior mid-flight.

### ai_chat — 5 lifecycle hooks

| Hook | When | Purpose |
|------|------|---------|
| `beforeExecute(ctx)` | Before agent starts | Setup (navigate, auth) |
| `afterExecute(result, session, ctx)` | After agent finishes | Cleanup, save results |
| `prepareMessages(args, config)` | Before first LLM call | Initial message formatting |
| `createSuccessResult(output, ...)` | On success | Custom result formatting |
| `createErrorResult(error, ...)` | On error | Custom error formatting |

These are **lifecycle hooks** — they fire at boundaries but don't intervene during the loop.

---

## Session / Persistence

### pi-agent-core

No built-in persistence. Handled by pi-coding-agent's `SessionManager`:
- JSONL files at `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
- Tree-structured branching (conversation forks)
- Compaction (lossy summarization of old messages to reclaim context)
- Sessions survive across process restarts

### ai_chat

In-memory `AgentSession`:

```typescript
interface AgentSession {
  agentName: string;
  sessionId: string;
  parentSessionId?: string;
  status: 'running' | 'completed' | 'error';
  messages: AgentMessage[];
  nestedSessions: AgentSession[];
  iterationCount?: number;
  terminationReason?: AgentRunTerminationReason;
}
```

- Lives for the duration of the agent run
- No disk persistence
- Nested sessions for handoff audit trail
- Post-hoc analysis via Langfuse tracing

---

## Summary

| Dimension | pi-agent-core | ai_chat |
|-----------|--------------|---------|
| Core loop LOC | ~310 | ~1675 |
| Tool calls per LLM turn | Multiple (batch) | One |
| Streaming | Token-level deltas | Full response |
| Context management | Pluggable pipeline | Sanitization + iteration limit |
| Mid-run steering | First-class (steer + followUp) | Abort only |
| Multi-agent | External orchestration | Built-in handoffs |
| Persistence | JSONL sessions with compaction | In-memory only |
| Extension model | Functional runtime hooks | OOP lifecycle hooks |
| Iteration limit | None (token-bounded) | Explicit max_iterations |
| Agent specialization | 1 general-purpose | ~15 specialized |
| Providers | 18+ (via pi-ai) | 8 |

**pi-agent-core** is a minimal, streaming-first, embeddable agent core designed to be wrapped by larger systems. Its power comes from composability — the 4 hooks are the only extension points, and everything else is layered on top.

**ai_chat** is a self-contained, multi-agent orchestration framework designed for browser automation. Its power comes from specialization — purpose-built agents cooperate via handoffs, with rich tooling for web interaction.
