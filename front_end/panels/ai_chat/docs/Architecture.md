# AI Chat Panel Architecture

## 1. Overview

The AI Chat Panel is a sophisticated multi-agent browser automation framework integrated into Chromium DevTools. It provides a conversational interface that allows users to interact with AI assistants capable of leveraging browser context, executing complex tasks, and coordinating multiple specialized agents.

### Key Capabilities

- **Multi-Provider LLM Support**: OpenAI, LiteLLM (Claude, Gemini, Mistral, etc.), Groq, OpenRouter, and BrowserOperator
- **Multi-Agent Orchestration**: Primary orchestrator delegates to specialized agents with handoff capabilities
- **Rich Tool Ecosystem**: 40+ tools for browser automation, data extraction, and file management
- **Real-Time Updates**: Event-driven architecture with streaming updates to UI
- **Comprehensive Tracing**: Distributed tracing and observability via Langfuse integration
- **Evaluation Framework**: Testing and validation system for agents and tools
- **Page Context Integration**: Deep integration with DevTools SDK for accessibility trees, network data, and console logs

### Architecture Philosophy

The architecture follows several key design patterns:

- **Layered Architecture**: Clear separation of concerns across 7 distinct layers
- **Multi-Agent Pattern**: Primary orchestrator with specialized sub-agents
- **Provider Pattern**: Multiple LLM providers with unified interface
- **Event-Driven**: Decoupled components communicating via events
- **Singleton Pattern**: Shared services for state management
- **Observer Pattern**: UI components subscribe to state changes

## 2. Layered Architecture

The system is organized into 7 architectural layers, each with specific responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: UI Layer (Lit Components, Views, Dialogs)         │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Service/Orchestration (AgentService, Config Mgmt)  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Graph Execution (StateGraph, Nodes, Routing)      │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Agent Framework (Multi-Agent System, Handoffs)    │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: LLM Integration (Unified Client, 5 Providers)     │
├─────────────────────────────────────────────────────────────┤
│  Layer 6: Tools (40+ Tools, Tool Registry)                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 7: Supporting Systems (Tracing, Eval, Auth, MCP)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.1. Layer 1: UI Layer

**Location**: `/front_end/panels/ai_chat/ui/`

The UI layer is built with Lit components and provides a rich, interactive chat interface.

#### Core UI Components

**AIChatPanel.ts** (100KB)
- Main panel container and lifecycle manager
- Orchestrates ChatView and AgentService
- Handles panel registration with DevTools
- Manages global UI state

**ChatView.ts** (59KB)
- Primary Lit-based chat interface
- Renders message list and handles user input
- Manages loading states and animations
- Integrates markdown rendering
- Coordinates message display components

**SettingsDialog.ts** (168KB)
- Comprehensive configuration UI
- Manages API keys for all providers
- Model selection and custom model configuration
- Provider-specific settings
- LiteLLM endpoint configuration
- Custom prompts management

**EvaluationDialog.ts** (62KB)
- Agent evaluation and testing interface
- Test case configuration
- Real-time evaluation progress
- Results visualization
- Performance metrics display

#### Message Components

Located in `/front_end/panels/ai_chat/ui/`

- **MessageList.ts**: Container for all chat messages
- **UserMessage.ts**: Renders user input messages
- **ModelMessage.ts**: Displays AI model responses with markdown
- **ToolResultMessage.ts**: Shows tool execution results
- **StructuredResponseRender.ts**: Renders structured data
- **StructuredResponseController.ts**: Manages structured response state

#### Agent Session Components

Real-time visualization of agent execution:

- **LiveAgentSessionComponent.ts**: Displays active agent sessions
- **AgentSessionHeaderComponent.ts**: Agent session metadata
- **ToolCallComponent.ts**: Visualizes tool invocations
- **ToolResultComponent.ts**: Shows tool execution outcomes
- **AgentSessionMessage.ts**: Agent-specific messages

#### Input Components

- **ChatInput.ts**: Main input field with validation
- **InputBar.ts**: Input bar with send button and controls

#### Display Components

- **TodoListDisplay.ts**: Agent task tracking visualization
- **FileListDisplay.ts**: File system view for agent files
- **FileContentViewer.ts**: File content display and editing
- **AgentDropdownSelector.ts**: Agent type selection dropdown
- **SearchableAgentSelector.ts**: Searchable agent picker
- **HelpDialog.ts**: User help and documentation
- **PromptEditDialog.ts**: Custom prompt editor

### 2.2. Layer 2: Service/Orchestration Layer

**Location**: `/front_end/panels/ai_chat/core/`

This layer manages application state and coordinates between UI and execution layers.

#### AgentService.ts (1034 lines)

**Central singleton service with responsibilities**:

- **State Management**: Maintains `AgentState` (messages, context, selected agent)
- **Graph Orchestration**: Initializes and invokes primary `StateGraph`
- **LLM Configuration**: Manages LLM setup via `LLMConfigurationManager`
- **Execution Control**: Provides abort/cancellation for long-running operations
- **Event Broadcasting**: Dispatches events for UI updates:
  - `MESSAGES_CHANGED`: Message list updated
  - `AGENT_SESSION_STARTED`: New agent session began
  - `AGENT_TOOL_STARTED`: Agent started using a tool
  - `AGENT_TOOL_COMPLETED`: Tool execution finished
  - `AGENT_SESSION_COMPLETED`: Agent session ended
- **Page Context**: Fetches current page URL/title from DevTools SDK
- **Tracing Integration**: Manages tracing context for observability

**Key Methods**:
- `sendMessage(message)`: Primary entry point for user messages
- `initialize()`: Sets up LLM clients and graph configuration
- `abort()`: Cancels current agent execution
- `addEventListener()`: Subscribe to service events

#### LLMConfigurationManager.ts

- Manages LLM provider configuration
- Stores and retrieves API keys securely
- Handles model selection and validation
- Supports configuration overrides for testing
- Validates credentials and endpoints

#### State Management

**State.ts** - Defines core state interfaces:

```typescript
interface AgentState {
  messages: ChatMessage[];
  context: DevToolsContext;
  error?: string;
  selectedAgentType?: string | null;
  currentPageUrl?: string;
  currentPageTitle?: string;
}

interface DevToolsContext {
  selectedElement?: string;
  networkRequests?: NetworkRequest[];
  tracingContext?: TracingContext;
  agentDescriptor?: AgentDescriptor;
  executionId?: string;
  abortSignal?: AbortSignal;
}
```

**Constants.ts**: Configuration constants and model sentinels
**BuildConfig.ts**: Build-time configuration flags

### 2.3. Layer 3: Graph Execution Layer

**Location**: `/front_end/panels/ai_chat/core/`

Implements the primary conversational flow as a state machine.

#### Graph System

**Graph.ts**
- `createAgentGraph()`: Main entry point for graph creation
- Defines the primary conversational flow
- Integrates with AgentService

**StateGraph.ts**
- Generic state machine executor
- Manages node execution and transitions
- Supports conditional edges
- Yields state updates via AsyncGenerator
- Enables streaming updates to UI

**ConfigurableGraph.ts**
- Builds graphs from JSON configuration
- `createAgentGraphFromConfig(config)`: Factory method
- Supports dynamic graph construction
- Condition factories for edge routing

**GraphConfigs.ts**
- Stores predefined graph configurations
- `defaultAgentGraphConfig`: Standard conversational flow
- Typed GraphConfig definitions
- Agent-specific graph templates

**GraphHelpers.ts**
- Routing logic: `routeNextNode(state)`
- System prompt creation and enhancement
- Tool selection based on agent type
- Context injection utilities

#### Graph Nodes

**AgentNodes.ts** - Core node implementations:

**AgentNode**
- Calls LLM (OpenAI, LiteLLM, etc.)
- Processes model responses
- Decides next action (tool use or final answer)
- Updates message history

**ToolExecutorNode**
- Executes requested tools
- Handles both simple tools and ConfigurableAgentTools
- Manages tool errors and retries
- Formats tool results for LLM

**FinalNode**
- Terminates successful execution
- Final state marker

#### Orchestrator Configuration

**BaseOrchestratorAgent.ts**
- Defines agent types: SEARCH, DEEP_RESEARCH, SHOPPING
- `getAgentTools(type)`: Returns type-specific tools
- `getSystemPrompt(type)`: Returns agent-specific prompts
- Agent personality and behavior configuration

**AgentDescriptorRegistry.ts**
- Central registry for agent metadata
- Stores agent versions, prompts, tools
- Enables agent lookup by name
- Caches agent descriptors for performance

**ToolSurfaceProvider.ts**
- Provides tools available to agents
- Filters tools based on agent type
- Manages tool permissions
- Dynamic tool surface configuration

### 2.4. Layer 4: Agent Framework (Multi-Agent System)

**Location**: `/front_end/panels/ai_chat/agent_framework/`

Implements a sophisticated multi-agent system with handoff capabilities.

#### ConfigurableAgentTool.ts

**Defines agents as reusable tools**:

- Implements standard `Tool` interface
- Configured via `AgentToolConfig`:
  - `name`: Agent identifier
  - `description`: Agent purpose
  - `systemPrompt`: Agent instructions
  - `tools`: Array of sub-tool names
  - `handoffs`: Handoff configuration
  - `maxIterations`: Execution limit
  - `modelName`: LLM to use
  - `temperature`: Sampling temperature
  - `schema`: Input schema
- Can be invoked by primary graph or other agents
- Supports nested agent execution
- Handoff mechanism for agent collaboration

```typescript
interface AgentToolConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  version?: string;
  handoffs?: HandoffConfig[];
  maxIterations?: number;
  modelName?: string | (() => string);
  temperature?: number;
  schema: { type: string, properties: Record<string, unknown> };
}
```

#### AgentRunner.ts

**Core agent execution engine**:

- Static `run()` method implements iteration-based execution
- Independent from primary StateGraph
- Manages agent execution loop:
  1. Call LLM with agent's system prompt
  2. Parse response for actions
  3. Execute tools (may invoke other agents)
  4. Check termination conditions
  5. Loop until final answer or max iterations
- **Handoff System**:
  - Agents can transfer control to other agents
  - Handoffs triggered by LLM tool selection or conditions
  - `executeHandoff()` manages control transfer
  - Recursive `AgentRunner.run` for target agent
  - Message history passed to handoff target
- Supports abort signals for cancellation
- Manages `AgentSession` lifecycle

**Termination Reasons**:
- `FINAL_ANSWER`: Agent completed task
- `MAX_ITERATIONS`: Reached iteration limit
- `HANDOFF`: Transferred to another agent
- `ERROR`: Execution error occurred
- `ABORT`: User cancelled execution

#### AgentRunnerEventBus.ts

**Event system for agent execution**:

Publishes events:
- `session_started`: New agent session began
- `tool_started`: Agent started using a tool
- `tool_completed`: Tool execution finished
- `session_completed`: Agent session ended
- `child_agent_started`: Nested agent invoked

AgentService subscribes to these events to update UI in real-time.

#### Specialized Agents

**Location**: `/front_end/panels/ai_chat/agent_framework/implementation/agents/`

The system includes 10+ specialized agents, each designed for specific tasks:

**1. ActionAgent.ts**
- **Purpose**: Executes browser actions (clicks, form fills, navigation)
- **Tools**: Click, FormFill, Hover, Keyboard, Scroll, Navigate
- **Use Cases**: Form automation, UI interaction, navigation flows

**2. ActionVerificationAgent.ts**
- **Purpose**: Verifies that actions were executed correctly
- **Tools**: DOM inspection, accessibility tree analysis
- **Use Cases**: Quality assurance, action validation, error detection

**3. ResearchAgent.ts**
- **Purpose**: Conducts in-depth research on topics
- **Tools**: Web search, content extraction, bookmark storage
- **Use Cases**: Information gathering, competitive analysis, research tasks

**4. SearchAgent.ts**
- **Purpose**: Performs web searches and analyzes results
- **Tools**: Search tools, HTML extraction, schema-based extraction
- **Use Cases**: Quick information lookup, search result analysis

**5. WebTaskAgent.ts**
- **Purpose**: Coordinates complex multi-step web tasks
- **Tools**: Navigation, extraction, action agents (via handoff)
- **Use Cases**: E-commerce workflows, multi-page tasks, complex automation
- **Handoffs**: ActionAgent, ResearchAgent

**6. ClickActionAgent.ts**
- **Purpose**: Specialized click action execution
- **Tools**: Visual indicators, accessibility tree, DOM analysis
- **Use Cases**: Precise element clicking, button activation

**7. FormFillActionAgent.ts**
- **Purpose**: Intelligent form filling
- **Tools**: Form detection, input field analysis, validation
- **Use Cases**: Form automation, data entry, account creation

**8. HoverActionAgent.ts**
- **Purpose**: Hover interactions and tooltip triggers
- **Tools**: Element highlighting, hover simulation
- **Use Cases**: Menu navigation, tooltip inspection

**9. KeyboardInputActionAgent.ts**
- **Purpose**: Keyboard input and shortcuts
- **Tools**: Key press simulation, focus management
- **Use Cases**: Text entry, keyboard shortcuts, accessibility testing

**10. ScrollActionAgent.ts**
- **Purpose**: Intelligent scrolling and viewport management
- **Tools**: Scroll simulation, lazy-load triggering
- **Use Cases**: Infinite scroll, content discovery, viewport positioning

**11. DirectURLNavigatorAgent.ts**
- **Purpose**: Direct navigation to URLs
- **Tools**: Navigation tools, page load detection
- **Use Cases**: Site navigation, URL validation

**12. ContentWriterAgent.ts**
- **Purpose**: Content creation and editing
- **Tools**: Text generation, formatting, file storage
- **Use Cases**: Documentation, content generation, report writing

**13. EcommerceProductInfoAgent.ts**
- **Purpose**: E-commerce product information extraction
- **Tools**: Schema-based extraction, price parsing, review analysis
- **Use Cases**: Product research, price comparison, review aggregation

#### ConfiguredAgents.ts

- Central registry of all specialized agents
- Initializes agent configurations
- Manages agent instances
- Provides agent discovery

### 2.5. Layer 5: LLM Integration Layer

**Location**: `/front_end/panels/ai_chat/LLM/`

Provides unified interface to multiple LLM providers.

#### Unified Client Architecture

**LLMClient.ts** (Previously UnifiedLLMClient.ts)
- Main coordinator for all LLM interactions
- Provider-agnostic interface
- Routes requests to appropriate provider
- Handles configuration and credentials
- Manages model selection logic

**Key Methods**:
```typescript
interface LLMClient {
  call(request: LLMRequest): Promise<LLMResponse>;
  testModel(config: ModelConfig): Promise<boolean>;
  getAvailableModels(provider: LLMProvider): Promise<Model[]>;
}
```

#### LLM Provider Registry

**LLMProviderRegistry.ts**
- Manages provider instances
- Singleton pattern for efficiency
- Provider lifecycle management
- Configuration validation

**LLMTypes.ts** - Common type definitions:
```typescript
type LLMProvider = 'openai' | 'litellm' | 'groq' | 'openrouter' | 'browseroperator';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface LLMResponse {
  text?: string;
  tool_calls?: ToolCall[];
  reasoning?: string[];
  usage?: TokenUsage;
}

interface LLMRequest {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}
```

#### Provider Implementations

**1. OpenAIProvider.ts**
- **Direct OpenAI API integration**
- **Models**: GPT-4, GPT-4-turbo, GPT-3.5-turbo
- **Features**:
  - Function calling
  - Streaming responses
  - Vision capabilities (GPT-4V)
  - JSON mode
- **Authentication**: API key via headers
- **Endpoint**: https://api.openai.com/v1/chat/completions

**2. LiteLLMProvider.ts**
- **LiteLLM proxy support**
- **Supported Providers** (via proxy):
  - Anthropic Claude (claude-3-5-sonnet, claude-3-opus, etc.)
  - Google Gemini (gemini-pro, gemini-ultra)
  - Mistral AI (mistral-large, mistral-medium)
  - Cohere (command, command-light)
  - Local models (Ollama, vLLM, etc.)
- **Features**:
  - Unified API across providers
  - Automatic format conversion
  - Model discovery from proxy
  - Local and cloud deployments
- **Configuration**:
  - Custom endpoint URL
  - API key (proxy auth)
  - Per-model credentials
- **Tool Support**: Adapts tool definitions to provider format

**3. GroqProvider.ts**
- **Groq API integration**
- **Models**: Llama-3-70B, Mixtral-8x7B, Gemma-7B
- **Features**:
  - Ultra-fast inference
  - OpenAI-compatible API
  - Tool/function calling
- **Authentication**: Groq API key
- **Endpoint**: https://api.groq.com/openai/v1/chat/completions
- **Use Case**: High-speed inference for latency-sensitive tasks

**4. OpenRouterProvider.ts**
- **OpenRouter API integration**
- **Features**:
  - Access to 100+ models
  - Unified pricing
  - Automatic failover
  - Model routing
- **Authentication**:
  - API key
  - OAuth 2.0 flow (PKCE)
- **Models**: GPT-4, Claude, Llama, Mistral, and many more
- **Endpoint**: https://openrouter.ai/api/v1/chat/completions
- **Special Features**:
  - Credit system
  - Usage tracking
  - Model preferences
  - Fallback chains

**5. BrowserOperatorProvider.ts**
- **Custom Browser Operator API**
- **Purpose**: Specialized for browser automation tasks
- **Features**:
  - Browser-context-aware models
  - Custom tool definitions
  - Optimized for DOM understanding
- **Use Case**: Internal provider for specialized browser automation

#### Supporting Components

**LLMResponseParser.ts**
- Parses LLM responses into standardized format
- Handles different response structures across providers
- Extracts tool calls, reasoning, and text
- Error handling for malformed responses

**MessageSanitizer.ts**
- Sanitizes messages before sending to LLM
- Removes sensitive data
- Truncates long content
- Validates message format

**LLMErrorHandler.ts**
- Unified error handling across providers
- Retry logic with exponential backoff
- Rate limit handling
- Error categorization and reporting

**ChatOpenAI.ts** & **ChatLiteLLM.ts**
- High-level wrappers for agent system
- Manage prompts and tool definitions
- Handle streaming responses
- Format conversion

### 2.6. Layer 6: Tools Layer

**Location**: `/front_end/panels/ai_chat/tools/`

Comprehensive tool ecosystem providing 40+ capabilities.

#### Core Tool System

**Tools.ts**
- Central tool registry
- Exports all tools
- `getTools()`: Returns available tools

**Tool Interface**:
```typescript
interface Tool<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute(args: TArgs, ctx?: CallCtx): Promise<TResult>;
}

interface CallCtx {
  signal?: AbortSignal;
  tracingContext?: TracingContext;
  agentContext?: AgentContext;
}
```

**ToolRegistry** (in ConfigurableAgentTool.ts)
- Manages tool instances
- Tool lookup by name
- Dynamic tool registration
- Tool factory pattern

#### Tools by Category

**Browser/Page Tools** (10 tools)

1. **NavigateURLTool**: Navigate to specific URLs
2. **NavigateBackTool**: Browser back navigation
3. **HTMLToMarkdownTool**: Convert page HTML to markdown
4. **FullPageAccessibilityTreeToMarkdownTool**: Extract accessibility tree
5. **SchemaBasedExtractorTool**: Extract data using JSON schema
6. **StreamlinedSchemaExtractorTool**: Optimized schema extraction
7. **CombinedExtractionTool**: Multiple extraction strategies
8. **RenderWebAppTool**: Render web app state
9. **GetWebAppDataTool**: Retrieve web app data
10. **RemoveWebAppTool**: Clean up web app instances
11. **VisualIndicatorTool**: Highlight elements on page

**Data Collection Tools** (8 tools)

1. **FetcherTool**: HTTP requests (GET, POST, etc.)
2. **BookmarkStoreTool**: Store bookmarks for later
3. **DocumentSearchTool**: Search stored documents
4. **GetVisitsByDomainTool**: Retrieve visit history by domain
5. **GetVisitsByKeywordTool**: Search visit history
6. **SearchVisitHistoryTool**: Full-text history search
7. **VectorDBClient**: Semantic search capabilities
8. **WebSearchTool**: Web search integration

**File Management Tools** (5 tools)

Uses **FileStorageManager** (in-memory file system):

1. **CreateFileTool**: Create new files
2. **UpdateFileTool**: Modify existing files
3. **DeleteFileTool**: Remove files
4. **ReadFileTool**: Read file contents
5. **ListFilesTool**: List available files

**Quality Assurance Tools** (3 tools)

1. **CritiqueTool**: Critique agent's own work
2. **FinalizeWithCritiqueTool**: Final answer with self-assessment
3. **UpdateTodoTool**: Update task list

**Development Tools** (2 tools)

1. **ExecuteCodeTool**: Execute JavaScript code
2. **DebugTool**: Debugging utilities

**LLM Tools** (1 tool)

1. **LLMTracingWrapper**: Wraps LLM calls with tracing

**Agent Tools** (Dynamic)

- All `ConfigurableAgentTool`s are available as tools
- Enables agent composition
- Supports multi-agent workflows

#### Tool Execution Flow

```
1. Agent/Node requests tool execution
   ↓
2. ToolExecutorNode retrieves tool from ToolRegistry
   ↓
3. Tool.execute(args, context) called
   ↓
4. Tool performs operation (may be async)
   ↓
5. Tool returns result or throws error
   ↓
6. Result formatted and added to message history
   ↓
7. Execution continues in graph/agent
```

### 2.7. Layer 7: Supporting Systems

**Location**: Various directories under `/front_end/panels/ai_chat/`

#### Page Context Management

**PageInfoManager.ts** (Singleton)
- **Rich page context**:
  - Current URL and title
  - Full accessibility tree
  - Iframe structure
  - DOM summary
  - Network state
- **Integration**: Used by `enhancePromptWithPageContext()`
- **Lazy Loading**: Fetches context on-demand
- **Caching**: Caches context for performance

**VisitHistoryManager.ts**
- Stores page visit history
- Provides search capabilities
- Supports temporal queries
- Integrates with history tools

#### Tracing & Observability

**Location**: `/front_end/panels/ai_chat/tracing/`

**TracingConfig.ts**
- Creates tracing providers
- Configures Langfuse integration
- Manages tracing lifecycle

**TracingProvider.ts**
- Interface for distributed tracing
- Trace hierarchy:
  - **Sessions**: Top-level conversations
  - **Observations**: Agent executions
  - **Spans**: Individual operations
  - **Events**: Point-in-time occurrences
- Supports Langfuse backend

**Integration**:
- LLMTracingWrapper wraps LLM calls
- AgentRunner emits trace events
- Tools can emit custom spans
- Full execution visibility

**Langfuse Features**:
- Session tracking
- Cost analysis
- Latency monitoring
- Error tracking
- Custom metadata

#### Evaluation Framework

**Location**: `/front_end/panels/ai_chat/evaluation/`

**EvaluationRunner.ts**
- Orchestrates agent evaluations
- Loads test cases
- Executes tests
- Collects metrics
- Generates reports

**EvaluationAgent.ts**
- Remote evaluation via WebSocket
- Connects to evaluation server
- Real-time test execution
- Bidirectional communication

**GenericToolEvaluator.ts**
- Generic tool evaluation framework
- Configurable test scenarios
- Assertion system
- Performance metrics

**LLMEvaluator.ts**
- LLM-based evaluation judge
- Evaluates agent outputs using LLM
- Scoring and feedback generation
- Multi-criteria assessment

**Test Suites**:
- `research-agent-tests.ts`: Research agent scenarios
- `action-agent-tests.ts`: Browser action tests
- `search-agent-tests.ts`: Search functionality tests
- `web-task-agent-tests.ts`: End-to-end workflows

**Test Case Structure**:
```typescript
interface TestCase {
  name: string;
  description: string;
  input: string;
  expectedBehavior: string;
  assertions: Assertion[];
  timeout?: number;
}
```

#### MCP (Model Context Protocol)

**Location**: `/front_end/panels/ai_chat/mcp/`

**MCPRegistry.ts**
- Manages MCP server connections
- Discovers available tools/resources
- Handles MCP lifecycle

**MCPConfig.ts**
- MCP server configuration
- Connection settings
- Authentication

**MCPMetaTools.ts**
- Meta tools for MCP interaction
- Tool discovery
- Resource access

**Integration**:
- MCP tools registered in ToolRegistry
- Available to agents like standard tools
- See `/docs/MCP_OAuth_Implementation_Plan.md` for OAuth details

#### Authentication

**Location**: `/front_end/panels/ai_chat/auth/`

**OpenRouterOAuth.ts**
- Implements OAuth 2.0 flow for OpenRouter
- PKCE (Proof Key for Code Exchange) support
- Token management
- Refresh token handling

**PKCEUtils.ts**
- PKCE utilities for secure OAuth
- Code verifier generation
- Code challenge creation
- State parameter management

**Credential Management**:
- Secure storage of API keys
- Token refresh automation
- Multi-provider credential handling

#### Common Utilities

**Location**: `/front_end/panels/ai_chat/common/`

- **context.ts**: Context utilities
- **page.ts**: Page interaction utilities
- **utils.ts**: General utilities
- **accessibility-utils.test.ts**: Accessibility testing
- **action-utils.test.ts**: Action utility tests
- **xpath-utils.test.ts**: XPath helper tests
- **MarkdownViewerUtil.ts**: Markdown rendering
- **log.ts**: Logging utilities
- **WebSocketRPCClient.ts**: WebSocket RPC communication
- **EvaluationConfig.ts**: Evaluation configuration

## 3. Event-Driven Architecture

The system uses extensive event-driven communication for decoupling and real-time updates.

### 3.1. AgentService Events

**Published by AgentService.ts**:

```typescript
enum AgentServiceEvent {
  MESSAGES_CHANGED = 'messagesChanged',
  AGENT_SESSION_STARTED = 'agentSessionStarted',
  AGENT_TOOL_STARTED = 'agentToolStarted',
  AGENT_TOOL_COMPLETED = 'agentToolCompleted',
  AGENT_SESSION_COMPLETED = 'agentSessionCompleted',
  STATE_UPDATED = 'stateUpdated',
  ERROR_OCCURRED = 'errorOccurred',
}
```

**Event Payloads**:

- `MESSAGES_CHANGED`: `{ messages: ChatMessage[] }`
- `AGENT_SESSION_STARTED`: `{ sessionId: string, agentName: string }`
- `AGENT_TOOL_STARTED`: `{ sessionId: string, toolName: string, args: unknown }`
- `AGENT_TOOL_COMPLETED`: `{ sessionId: string, toolName: string, result: unknown }`
- `AGENT_SESSION_COMPLETED`: `{ sessionId: string, status: string, result: unknown }`
- `STATE_UPDATED`: `{ state: AgentState }`
- `ERROR_OCCURRED`: `{ error: Error, context: string }`

**UI Subscription Pattern**:
```typescript
agentService.addEventListener('messagesChanged', (event) => {
  this.messages = event.detail.messages;
  this.requestUpdate();
});
```

### 3.2. AgentRunnerEventBus Events

**Published by AgentRunner.ts**:

```typescript
enum AgentRunnerEvent {
  SESSION_STARTED = 'session_started',
  TOOL_STARTED = 'tool_started',
  TOOL_COMPLETED = 'tool_completed',
  SESSION_COMPLETED = 'session_completed',
  CHILD_AGENT_STARTED = 'child_agent_started',
  ITERATION_COMPLETED = 'iteration_completed',
  HANDOFF_INITIATED = 'handoff_initiated',
}
```

**Event Flow**:
```
AgentRunner.run()
  ↓ emits SESSION_STARTED
  ↓
  [Iteration Loop]
    ↓ emits TOOL_STARTED
    Tool.execute()
    ↓ emits TOOL_COMPLETED
    ↓ (if tool is ConfigurableAgentTool)
    ↓ emits CHILD_AGENT_STARTED
    Nested AgentRunner.run()
    ↓
    ↓ emits ITERATION_COMPLETED
  ↓
  ↓ emits SESSION_COMPLETED (or HANDOFF_INITIATED)
```

**AgentService Integration**:
- AgentService subscribes to AgentRunnerEventBus
- Translates runner events to service events
- Updates UI components in real-time
- Maintains agent session state

### 3.3. Communication Patterns

**1. Async Generator Streaming**
```typescript
// StateGraph yields state updates
async *invoke(initialState: AgentState): AsyncGenerator<AgentState> {
  let currentState = initialState;
  while (!isTerminal(currentState)) {
    currentState = await executeNode(currentState);
    yield currentState; // Stream to caller
  }
}
```

**2. WebSocket RPC**
```typescript
// EvaluationAgent uses WebSocket for remote eval
const wsClient = new WebSocketRPCClient(wsUrl);
await wsClient.call('runEvaluation', { testCase });
```

**3. Event Broadcasting**
```typescript
// Publisher
eventBus.emit('tool_completed', { sessionId, toolName, result });

// Subscriber
eventBus.on('tool_completed', (data) => {
  updateToolResultInUI(data);
});
```

## 4. Data Flow Architecture

### 4.1. Primary Conversation Flow

```
1. User Input
   ↓ ChatView captures input
   ↓
2. AIChatPanel → AgentService.sendMessage(text)
   ↓
3. AgentService:
   ↓ - Fetches page URL/title from DevTools SDK
   ↓ - Creates tracing context
   ↓ - Initializes LLMClient if needed
   ↓ - Updates AgentState with user message
   ↓
4. AgentService.invoke(primaryGraph, state)
   ↓
5. StateGraph.invoke(state)* [AsyncGenerator]
   ↓
6. AgentNode:
   ↓ - Enhances prompt with page context
   ↓ - Calls LLM (via LLMClient → Provider)
   ↓ - Receives response with actions
   ↓ - Updates state.messages
   ↓ *yields state*
   ↓
7. Routing Decision:
   ↓ - If tool_calls → ToolExecutorNode
   ↓ - If final answer → FinalNode
   ↓
8. ToolExecutorNode:
   ↓ - Retrieves tool from ToolRegistry
   ↓ - Executes tool(args, context)
   ↓ - (May invoke ConfigurableAgentTool → see 4.2)
   ↓ - Adds tool result to state.messages
   ↓ *yields state*
   ↓
9. Loop back to AgentNode
   ↓ (continues until FinalNode)
   ↓
10. FinalNode reached
   ↓ *yields final state*
   ↓
11. AgentService:
   ↓ - Emits MESSAGES_CHANGED events (streamed)
   ↓ - Updates tracing
   ↓
12. ChatView:
   ↓ - Receives MESSAGES_CHANGED event
   ↓ - Re-renders with new messages
   ↓ - Updates UI state
```

* StateGraph yields state at each step, enabling real-time UI updates

### 4.2. ConfigurableAgentTool Flow (Nested Agents)

```
1. ToolExecutorNode calls ConfigurableAgentTool.execute(args)
   ↓
2. ConfigurableAgentTool prepares:
   ↓ - AgentRunnerConfig (system prompt, tools, model)
   ↓ - AgentRunnerHooks (callbacks)
   ↓ - Initial messages for agent
   ↓
3. ConfigurableAgentTool.execute() → AgentRunner.run()
   ↓
4. AgentRunner.run() iteration loop:
   ↓
   ↓ Emit: SESSION_STARTED
   ↓
   ├─ Iteration 1:
   │  ↓ - Call LLM with agent's system prompt
   │  ↓ - Parse response (text/tool_calls)
   │  ↓
   │  ├─ If tool_calls:
   │  │  ↓ Emit: TOOL_STARTED
   │  │  ↓ - Retrieve sub-tool from ToolRegistry
   │  │  ↓ - Execute sub-tool
   │  │  ↓   (may be simple tool or another ConfigurableAgentTool)
   │  │  ↓   (if ConfigurableAgentTool → recursive AgentRunner.run)
   │  │  ↓ Emit: TOOL_COMPLETED
   │  │  ↓ - Add tool result to messages
   │  │  ↓
   │  ├─ If handoff requested:
   │  │  ↓ Emit: HANDOFF_INITIATED
   │  │  ↓ - Execute handoff to target agent
   │  │  ↓ - Transfer message history
   │  │  ↓ - Call AgentRunner.run for target
   │  │  ↓ - Return handoff result
   │  │  ↓ [TERMINATE]
   │  │
   │  ├─ If final answer:
   │  │  ↓ - Return ConfigurableAgentResult
   │  │  ↓ [TERMINATE]
   │  │
   │  ↓ Emit: ITERATION_COMPLETED
   │  ↓
   ├─ Iteration 2, 3, ... (repeat)
   │  ↓ (max: config.maxIterations)
   │  ↓
   │  If max iterations reached:
   │     ↓ - Auto-handoff (if configured)
   │     ↓ - OR return error result
   │     ↓ [TERMINATE]
   │
   ↓ Emit: SESSION_COMPLETED
   ↓
5. AgentRunner.run() returns ConfigurableAgentResult
   ↓
6. ConfigurableAgentTool.execute() formats result
   ↓
7. Returns to ToolExecutorNode
   ↓
8. ToolExecutorNode adds result to primary graph state.messages
   ↓
9. Primary graph continues (back to AgentNode)
```

**Handoff Example**:
```
WebTaskAgent
  ↓ delegates to ResearchAgent (via handoff)
  ↓
  ResearchAgent.run()
    ↓ uses search tools
    ↓ completes research
    ↓ returns result
  ↓
  Result returned to WebTaskAgent
  ↓ (or directly to primary graph if configured)
```

### 4.3. LLM Call Flow (Multi-Provider)

```
1. Agent/Node requests LLM call
   ↓
2. LLMClient.call(request):
   ↓ - request: { provider, model, messages, tools, ... }
   ↓
3. LLMProviderRegistry.getProvider(provider)
   ↓
4. Provider Selection:
   ├─ OpenAIProvider → OpenAI API
   ├─ LiteLLMProvider → LiteLLM Proxy → (Claude/Gemini/Mistral/...)
   ├─ GroqProvider → Groq API
   ├─ OpenRouterProvider → OpenRouter API
   └─ BrowserOperatorProvider → Custom API
   ↓
5. Provider.call(request):
   ↓ - Formats request for provider
   ↓ - Adds authentication
   ↓ - Converts tool definitions
   ↓ - Makes HTTP/API call
   ↓
6. Provider receives response
   ↓ - Parses response
   ↓ - Extracts text, tool_calls, reasoning
   ↓
7. LLMResponseParser.parseResponse(rawResponse)
   ↓ - Standardizes format
   ↓ - Validates structure
   ↓
8. Returns LLMResponse:
   {
     text?: string,
     tool_calls?: ToolCall[],
     reasoning?: string[],
     usage?: TokenUsage
   }
   ↓
9. Caller processes LLMResponse
   ↓
10. (If tracing enabled)
    ↓ - Log to Langfuse
    ↓ - Record latency, tokens, cost
```

## 5. Storage and State Management

### 5.1. LocalStorage Keys

**LLM Configuration**:
- `ai_chat_api_key`: OpenAI API key
- `ai_chat_litellm_endpoint`: LiteLLM proxy URL
- `ai_chat_litellm_api_key`: LiteLLM API key
- `ai_chat_groq_api_key`: Groq API key
- `ai_chat_openrouter_api_key`: OpenRouter API key
- `ai_chat_custom_models`: Custom model configurations (JSON)
- `ai_chat_selected_model`: Currently selected model

**User Preferences**:
- `ai_chat_custom_prompts`: User-defined prompts (JSON)
- `ai_chat_selected_agent_type`: Default agent type
- `ai_chat_theme`: UI theme preference

**Tracing Configuration**:
- `ai_chat_langfuse_public_key`: Langfuse public key
- `ai_chat_langfuse_secret_key`: Langfuse secret key
- `ai_chat_langfuse_host`: Langfuse instance URL
- `ai_chat_tracing_enabled`: Tracing on/off

**OAuth Tokens**:
- `ai_chat_openrouter_access_token`: OpenRouter OAuth token
- `ai_chat_openrouter_refresh_token`: OpenRouter refresh token

### 5.2. In-Memory State

**Singleton Services**:
- `AgentService`: Conversation state, current execution
- `LLMClient`: Provider instances, configuration
- `FileStorageManager`: In-memory file system for agents
- `ToolRegistry`: Tool instances and factories
- `AgentDescriptorRegistry`: Agent metadata cache
- `LLMProviderRegistry`: Provider instances
- `PageInfoManager`: Page context cache
- `VisitHistoryManager`: Page visit history

**State Lifecycle**:
```
1. Service initialized (singleton)
   ↓
2. Configuration loaded from LocalStorage
   ↓
3. State populated (messages, context, etc.)
   ↓
4. State updated during execution
   ↓
5. Events emitted on state changes
   ↓
6. UI components re-render
   ↓
7. (On page refresh, state resets)
```

**State Persistence Strategy**:
- Configuration: LocalStorage (persisted)
- Conversation history: In-memory only (not persisted)
- File storage: In-memory only (cleared on refresh)
- Agent sessions: In-memory only
- Tracing data: Sent to Langfuse (external persistence)

### 5.3. Singleton Pattern Usage

All major services use singleton pattern for:
- **Shared state**: Single source of truth
- **Resource efficiency**: One instance per service
- **Event coordination**: Central event bus
- **Configuration management**: Unified config access

**Example**:
```typescript
export class AgentService {
  private static instance: AgentService;

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  private constructor() {
    // Initialize
  }
}
```

## 6. Key Interfaces and Types

### 6.1. Core Message Types

**Location**: `/front_end/panels/ai_chat/models/ChatTypes.ts`

```typescript
enum ChatMessageEntity {
  USER = 'user',
  MODEL = 'model',
  TOOL_RESULT = 'tool_result',
  AGENT_SESSION = 'agent_session',
}

interface UserChatMessage {
  entity: ChatMessageEntity.USER;
  text: string;
  timestamp: number;
}

interface ModelChatMessage {
  entity: ChatMessageEntity.MODEL;
  text?: string;
  tool_calls?: ToolCall[];
  reasoning?: string[];
  timestamp: number;
}

interface ToolResultMessage {
  entity: ChatMessageEntity.TOOL_RESULT;
  tool_call_id: string;
  tool_name: string;
  result: unknown;
  error?: string;
  timestamp: number;
}

interface AgentSessionMessage {
  entity: ChatMessageEntity.AGENT_SESSION;
  sessionId: string;
  agentName: string;
  status: 'active' | 'completed' | 'error';
  messages: AgentMessage[];
  nestedSessions?: AgentSessionMessage[];
  timestamp: number;
}

type ChatMessage = UserChatMessage | ModelChatMessage | ToolResultMessage | AgentSessionMessage;
```

### 6.2. Agent Session Types

**Location**: `/front_end/panels/ai_chat/agent_framework/AgentSessionTypes.ts`

```typescript
interface AgentSession {
  sessionId: string;
  agentName: string;
  status: 'active' | 'completed' | 'error';
  messages: AgentMessage[];
  toolCalls: AgentMessage[];
  toolResults: AgentMessage[];
  nestedSessions?: AgentSession[];
  terminationReason?: AgentRunTerminationReason;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

enum AgentRunTerminationReason {
  FINAL_ANSWER = 'final_answer',
  MAX_ITERATIONS = 'max_iterations',
  HANDOFF = 'handoff',
  ERROR = 'error',
  ABORT = 'abort',
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  timestamp: number;
}
```

### 6.3. Tool Call Types

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}
```

### 6.4. LLM Types

See Layer 5 section for complete LLM type definitions.

## 7. Extensibility and Future Directions

### 7.1. Adding New Agents

**Steps**:

1. **Create Agent Configuration**:
```typescript
const myNewAgent: AgentToolConfig = {
  name: 'MyNewAgent',
  description: 'Agent that does X',
  systemPrompt: 'You are an agent specialized in...',
  tools: ['tool1', 'tool2', 'tool3'],
  handoffs: [
    { targetAgent: 'ResearchAgent', condition: 'needs_research' }
  ],
  maxIterations: 10,
  modelName: 'gpt-4',
  temperature: 0.7,
  schema: { type: 'object', properties: { ... } }
};
```

2. **Register in ConfiguredAgents.ts**:
```typescript
ToolRegistry.registerTool(
  'MyNewAgent',
  (ctx) => new ConfigurableAgentTool(myNewAgent, ctx)
);
```

3. **Add to AgentDescriptorRegistry** (if primary agent):
```typescript
AgentDescriptorRegistry.register({
  type: 'my_new_agent',
  name: 'My New Agent',
  description: '...',
  version: '1.0.0',
  tools: ['tool1', 'tool2'],
  systemPrompt: '...'
});
```

### 7.2. Adding New Tools

**Steps**:

1. **Implement Tool Interface**:
```typescript
export class MyNewTool implements Tool<MyArgs, MyResult> {
  name = 'my_new_tool';
  description = 'Does something useful';
  schema = {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '...' },
      param2: { type: 'number', description: '...' }
    },
    required: ['param1']
  };

  async execute(args: MyArgs, ctx?: CallCtx): Promise<MyResult> {
    // Implementation
    return result;
  }
}
```

2. **Register Tool**:
```typescript
// In Tools.ts or during initialization
ToolRegistry.registerTool('my_new_tool', () => new MyNewTool());
```

3. **Add to Agent Tool Lists**:
```typescript
// In agent configuration
tools: ['existing_tool', 'my_new_tool']
```

### 7.3. Adding New LLM Providers

**Steps**:

1. **Implement Provider Interface**:
```typescript
export class MyNewProvider implements LLMProvider {
  async call(request: LLMRequest): Promise<LLMResponse> {
    // Convert request format
    const providerRequest = this.formatRequest(request);

    // Call provider API
    const rawResponse = await this.apiCall(providerRequest);

    // Parse and standardize response
    return LLMResponseParser.parse(rawResponse);
  }

  async testConnection(config: ProviderConfig): Promise<boolean> {
    // Test connection
  }

  async getAvailableModels(): Promise<Model[]> {
    // Fetch models
  }
}
```

2. **Register Provider**:
```typescript
// In LLMProviderRegistry.ts
LLMProviderRegistry.register('mynewprovider', MyNewProvider);
```

3. **Update Type Definitions**:
```typescript
// In LLMTypes.ts
type LLMProvider = 'openai' | 'litellm' | 'groq' | 'openrouter' | 'browseroperator' | 'mynewprovider';
```

4. **Add UI Configuration**:
```typescript
// In SettingsDialog.ts, add provider-specific settings
```

### 7.4. Creating Custom Graph Configurations

**Steps**:

1. **Define Graph Config**:
```typescript
const myGraphConfig: GraphConfig = {
  nodes: [
    { id: 'start', type: NodeType.AGENT, config: { ... } },
    { id: 'custom_node', type: NodeType.CUSTOM, config: { ... } },
    { id: 'end', type: NodeType.FINAL }
  ],
  edges: [
    { from: 'start', to: 'custom_node', condition: (state) => ... },
    { from: 'custom_node', to: 'end', condition: (state) => ... }
  ],
  entryPoint: 'start'
};
```

2. **Create Graph Instance**:
```typescript
const graph = createAgentGraphFromConfig(myGraphConfig);
```

3. **Use in AgentService**:
```typescript
// Set as primary graph or agent-specific graph
AgentService.getInstance().setPrimaryGraph(graph);
```

### 7.5. Extending Evaluation Framework

**Steps**:

1. **Create Test Cases**:
```typescript
const myTestCases: TestCase[] = [
  {
    name: 'Test Scenario 1',
    description: 'Tests agent behavior when...',
    input: 'User query...',
    expectedBehavior: 'Agent should...',
    assertions: [
      { type: 'contains', value: 'expected text' },
      { type: 'toolCalled', value: 'expected_tool' }
    ],
    timeout: 30000
  }
];
```

2. **Register Test Suite**:
```typescript
// In evaluation test file
export const myAgentTests = {
  agentName: 'MyNewAgent',
  testCases: myTestCases
};
```

3. **Run Evaluations**:
```typescript
const runner = new EvaluationRunner();
await runner.runTestSuite(myAgentTests);
```

## 8. Documentation References

### Primary Documentation

- **Architecture.md** (this file): Comprehensive architecture overview
- **Readme.md**: Setup and development guide
- **tracing/README.md**: Tracing configuration and usage
- **MCP_OAuth_Implementation_Plan.md**: MCP OAuth implementation details
- **FutureGraphExtensions.md**: Planned graph system enhancements

### External Documentation

- **Chromium DevTools**: https://chromium.googlesource.com/devtools/devtools-frontend/
- **Langfuse Tracing**: https://langfuse.com/docs
- **OpenAI API**: https://platform.openai.com/docs
- **LiteLLM**: https://docs.litellm.ai/
- **Groq**: https://console.groq.com/docs
- **OpenRouter**: https://openrouter.ai/docs

### Code-Level Documentation

Extensive TypeScript interfaces and JSDoc comments throughout the codebase. Key locations:

- `/front_end/panels/ai_chat/core/` - Core system types
- `/front_end/panels/ai_chat/agent_framework/` - Agent interfaces
- `/front_end/panels/ai_chat/LLM/` - LLM types and interfaces
- `/front_end/panels/ai_chat/tools/` - Tool definitions

## 9. Summary

The AI Chat Panel is a production-ready, enterprise-grade multi-agent browser automation framework featuring:

- **Modular 7-layer architecture** with clear separation of concerns
- **Multi-provider LLM support** with unified interface (5 providers)
- **Sophisticated multi-agent system** with 13+ specialized agents and handoff capabilities
- **Comprehensive tool ecosystem** with 40+ tools across 6 categories
- **Event-driven architecture** enabling real-time UI updates and loose coupling
- **Full observability** via Langfuse integration and distributed tracing
- **Robust evaluation framework** for testing and validation
- **Extensible design** allowing easy addition of agents, tools, and providers
- **Deep DevTools integration** with full page context and browser automation

The system provides a powerful platform for building AI-powered browser automation agents, from simple single-task agents to complex multi-agent workflows with sophisticated coordination and handoff patterns.

---

**Document Version**: 2.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team
