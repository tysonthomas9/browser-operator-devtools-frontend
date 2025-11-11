# Glossary

> **Last updated**: 2025-01-11

Definitions of key terms and concepts used in AI Chat documentation.

---

## A

### Accessibility Tree
The hierarchical representation of a web page's semantic structure exposed through the browser's accessibility API. AI Chat uses this tree to understand page structure and identify elements for interaction. Each node in the tree has a **NodeID** for reference.

**Related**: [NodeID](#nodeid), [BackendNodeId](#backendnodeid)

### Agent
An AI assistant with specific capabilities and tools. Agents use LLMs to understand requests, plan actions, and execute tools. AI Chat has 13+ specialized agents including ActionAgent, ResearchAgent, and SearchAgent.

**Types**: [Orchestrator](#orchestrator), [Specialized Agent](#specialized-agent)

### Agent Handoff
The mechanism by which one agent transfers control to another agent for specialized task handling. The receiving agent executes its task and returns control along with results.

**Example**:
```
MainAgent → encounters research task
→ Handoff to ResearchAgent
→ ResearchAgent completes research
→ Returns control to MainAgent with results
```

**Related**: [Multi-Agent System](#multi-agent-system)

### AgentRunner
The execution engine that runs iteration-based agent workflows. Unlike StateGraph (graph-based), AgentRunner uses a loop: call LLM → execute tools → check completion → repeat.

**Location**: `agent_framework/AgentRunner.ts`

### AgentService
The singleton service that orchestrates all agent interactions. It manages conversation lifecycle, emits events for UI updates, and coordinates between the UI layer and execution engines.

**Location**: `core/AgentService.ts`

### AsyncGenerator
A JavaScript feature that allows functions to yield multiple values asynchronously over time. Used by StateGraph to stream execution updates to the UI in real-time.

**Example**:
```typescript
async *execute() {
  for (const step of steps) {
    yield stepResult; // Stream to UI
  }
}
```

---

## B

### BackendNodeId
The unique identifier used by the Chrome DevTools Protocol to reference DOM nodes. Links between the DOM tree and accessibility tree. Also called "backend node ID" in CDP documentation.

**Related**: [NodeID](#nodeid), [Accessibility Tree](#accessibility-tree)

### BrowserOperator
A custom LLM provider option in AI Chat. Appears to be an internal or specialized provider configuration.

---

## C

### CDP (Chrome DevTools Protocol)
The protocol that allows tools to instrument, inspect, debug, and profile Chromium-based browsers. AI Chat uses CDP to interact with the browser and web pages.

**Docs**: [chromedevtools.github.io/devtools-protocol](https://chromedevtools.github.io/devtools-protocol/)

### ConfigurableAgentTool
A wrapper that exposes agents as tools, enabling agent composition. Any ConfigurableAgentTool can be called by other agents, allowing complex multi-agent workflows.

**Location**: `agent_framework/ConfigurableAgentTool.ts`

### Context Window
The maximum amount of text (measured in tokens) that an LLM can process in a single request. Includes both input (messages, tools, system prompt) and output. Varies by model (e.g., GPT-4: 8K-128K tokens).

---

## D

### DevTools
Chrome DevTools - the set of web developer tools built directly into Chrome/Chromium browsers. AI Chat is integrated as a panel within DevTools.

---

## E

### Event-Driven Architecture
A design pattern where components communicate by emitting and listening to events rather than direct function calls. AI Chat uses this for UI updates - AgentService emits events, UI components listen and react.

**Events**: `MESSAGES_CHANGED`, `AGENT_TOOL_STARTED`, `AGENT_SESSION_COMPLETED`

### Evaluation
The process of testing agents and tools against predefined test cases to measure reliability and accuracy. AI Chat includes a comprehensive evaluation framework with rule-based and LLM-based validation.

**Guide**: [Evaluation-Guide.md](./Evaluation-Guide.md)

---

## F

### Factory Pattern
A design pattern for creating objects without specifying their exact class. Used by ToolRegistry to create tool instances on demand.

**Example**:
```typescript
ToolRegistry.registerToolFactory('navigate_url', () => new NavigateURLTool());
```

---

## G

### Graph Execution
The execution model where workflows are represented as directed graphs with nodes (operations) and edges (transitions). StateGraph implements this model for the primary orchestrator.

**Related**: [StateGraph](#stategraph), [Node](#node)

### Groq
An LLM inference provider known for extremely fast performance using custom LPU (Language Processing Unit) hardware. One of the 5 supported providers in AI Chat.

**Website**: [groq.com](https://groq.com)

---

## H

### Handoff
See [Agent Handoff](#agent-handoff)

---

## I

### Iteration
A single cycle in an agent's execution loop: LLM call → tool execution → result processing → check completion. Agents have a maximum iteration limit (default: 10) to prevent infinite loops.

---

## L

### Langfuse
An open-source LLM observability platform that AI Chat integrates with for tracing, monitoring, and debugging agent executions.

**Website**: [langfuse.com](https://langfuse.com)

### LiteLLM
A proxy server that provides a unified API for 100+ LLM providers including Claude (Anthropic), Gemini (Google), Mistral, and more. One of AI Chat's supported providers.

**Website**: [litellm.ai](https://litellm.ai)

### LLM (Large Language Model)
AI models trained on vast amounts of text data to understand and generate human-like text. Examples: GPT-4, Claude, Gemini. AI Chat uses LLMs for reasoning, planning, and tool selection.

### LocalStorage
Browser API for storing data persistently in the user's browser. AI Chat uses LocalStorage to save configuration, API keys, and preferences.

### LPU (Language Processing Unit)
Custom hardware designed by Groq specifically for fast LLM inference. Achieves 18x faster performance compared to traditional GPUs.

---

## M

### MCP (Model Context Protocol)
An open standard by Anthropic for connecting AI systems to external data sources and tools. AI Chat supports MCP for dynamic tool discovery and invocation.

**Specification**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

### Multi-Agent System
An architecture where multiple specialized agents collaborate to complete complex tasks. AI Chat has 13+ agents, each optimized for specific task types (research, actions, content creation, etc.).

---

## N

### Node
In graph execution, a node is a single unit of computation. StateGraph executes nodes sequentially, with each node transforming the state.

**Types**: OrchestratorNode, ToolExecutorNode, TerminatorNode

### NodeID
An identifier for elements in the accessibility tree. Used by tools like `perform_action` to reference specific page elements. NodeIDs are unique within a single frame.

**Related**: [BackendNodeId](#backendnodeid), [Accessibility Tree](#accessibility-tree)

---

## O

### Orchestrator
The primary agent that coordinates task execution. It receives user requests, plans workflows, delegates to specialized agents, and synthesizes final responses. Implemented using StateGraph.

**Also called**: Primary Orchestrator, Main Agent

### OpenRouter
An LLM API aggregator providing unified access to 500+ models from 60+ providers. Includes automatic failover and intelligent routing.

**Website**: [openrouter.ai](https://openrouter.ai)

---

## P

### Provider
An LLM service that AI Chat can use for reasoning and planning. Supported providers: OpenAI, LiteLLM, Groq, OpenRouter, BrowserOperator.

---

## R

### Rate Limit
The maximum number of API requests allowed within a time period. Varies by provider and plan tier. Exceeding limits results in "Rate limit exceeded" errors.

**Example**: OpenAI free tier = 3 requests/minute

---

## S

### Schema
A JSON structure defining the expected format of data. Used by extraction tools to specify which fields to extract from web pages.

**Example**:
```json
{
  "type": "object",
  "properties": {
    "product_name": {"type": "string"},
    "price": {"type": "number"}
  }
}
```

### Singleton Pattern
A design pattern ensuring only one instance of a class exists. Used by AgentService, LocalStorage, and PageInfoManager to provide centralized state management.

### SPA (Single Page Application)
Web applications that dynamically update content without full page reloads. Can be challenging for automation because traditional page load events don't fire. Requires explicit waits.

**Examples**: React apps, Vue apps, Angular apps

### Specialized Agent
An agent optimized for specific task types. Examples: ResearchAgent (research tasks), ActionAgent (browser automation), SearchAgent (fact-finding). Contrast with the general-purpose orchestrator.

### StateGraph
The state machine executor used for graph-based workflows. Implements iteration using AsyncGenerator for streaming updates. The primary orchestrator runs on StateGraph.

**Location**: `core/StateGraph.ts`

### Streaming
The technique of sending data incrementally as it becomes available rather than waiting for completion. StateGraph streams execution updates to the UI in real-time using AsyncGenerator.

### System Prompt
The initial instructions given to an LLM that define its role and behavior. Each agent has a specific system prompt. Users can create custom prompts in Settings.

**Example**:
```
You are a research specialist. Your job is to gather information
from multiple sources and synthesize comprehensive findings...
```

---

## T

### Temperature
An LLM parameter controlling randomness in responses. Range: 0.0 (deterministic) to 2.0 (very creative). Default: 0.7 (balanced).

- **0.0**: Consistent, predictable responses
- **0.7**: Balanced creativity and consistency
- **1.5+**: Creative, varied responses

### Token
The unit of text that LLMs process. Roughly 4 characters or 0.75 words in English. Models have token limits for context window and output.

**Example**: "Hello world" ≈ 2 tokens

### Tool
A function that agents can call to perform actions. AI Chat has 47 tools for navigation, data extraction, form filling, file management, etc. All tools implement a standard interface.

**Interface**:
```typescript
interface Tool<TArgs, TResult> {
  name: string;
  description: string;
  schema: JSONSchema;
  execute(args: TArgs, ctx?: CallCtx): Promise<TResult>;
}
```

### ToolRegistry
The central registry for all tools. Manages tool instances, provides tool lookup by name, and supports dynamic tool registration.

**Location**: `agent_framework/ConfigurableAgentTool.ts:ToolRegistry`

### Tracing
The practice of recording and analyzing execution flows. AI Chat integrates with Langfuse for distributed tracing, allowing developers to see exactly what agents did, which tools were called, and how long operations took.

---

## U

### User Agent
Not to be confused with "Agent" in AI Chat. The User Agent is the string identifying the browser and version (e.g., "Mozilla/5.0 Chrome/120.0...").

---

## V

### Vision Model
An LLM capable of processing images in addition to text. Examples: GPT-4V, Claude 3, Gemini Pro Vision. AI Chat's ThinkingTool adapts to use screenshots when vision models are available.

---

## W

### Workflow
A sequence of steps to accomplish a task. Can be represented as:
- **Graph-based**: Nodes and edges (StateGraph)
- **Iteration-based**: Loop with LLM calls (AgentRunner)
- **Multi-agent**: Sequence of agent handoffs

---

## Common Abbreviations

| Abbreviation | Full Term |
|--------------|-----------|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| CDP | Chrome DevTools Protocol |
| JSON | JavaScript Object Notation |
| LLM | Large Language Model |
| LPU | Language Processing Unit (Groq) |
| MCP | Model Context Protocol |
| QA | Quality Assurance |
| SPA | Single Page Application |
| TOC | Table of Contents |
| UI | User Interface |
| URL | Uniform Resource Locator |

---

## Related Documentation

- [Architecture Overview](./Architecture-Overview.md) - System design
- [Tools Reference](./Tools-Reference.md) - Complete tool catalog
- [Specialized Agents](./Specialized-Agents.md) - All agent types
- [User Guide](./User-Guide.md) - Using AI Chat

---

*See a missing term? [Open an issue](https://github.com/BrowserOperator/browser-operator-core/issues) to suggest additions.*
