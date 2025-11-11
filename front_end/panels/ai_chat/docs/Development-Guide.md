# AI Chat Development Guide

Comprehensive guide for developers working on the AI Chat multi-agent framework.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Testing](#testing)
5. [Debugging](#debugging)
6. [Code Style](#code-style)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)

---

## Development Setup

### Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+
- **Python**: 3.x (for build tools)
- **Chrome/Chromium**: Latest stable or Canary
- **Git**: Latest version
- **depot_tools**: Chromium development tools

### Initial Setup

#### 1. Install depot_tools

```bash
# Clone depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git

# Add to PATH (add to .bashrc or .zshrc for persistence)
export PATH="$PATH:/path/to/depot_tools"
```

#### 2. Fetch DevTools Frontend

```bash
# Create workspace
mkdir devtools && cd devtools

# Fetch devtools-frontend
fetch devtools-frontend

cd devtools-frontend
```

#### 3. Switch to Browser Operator Fork

```bash
# Add upstream remote
git remote add upstream https://github.com/BrowserOperator/browser-operator-core.git

# Fetch upstream
git fetch upstream

# Checkout main branch
git checkout upstream/main
```

#### 4. Sync Dependencies

```bash
# Sync gclient dependencies
gclient sync

# Install npm dependencies
npm install
```

#### 5. Build

```bash
# Initial build
npm run build

# Watch mode for development
npm run build -- --watch
```

### Running DevTools

#### Method 1: Local Server

```bash
# Serve built files
cd out/Default/gen/front_end
python3 -m http.server 8000
```

```bash
# Launch Chrome with custom DevTools
# macOS
/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary \
  --custom-devtools-frontend=http://localhost:8000/

# Linux
google-chrome-unstable --custom-devtools-frontend=http://localhost:8000/

# Windows
"C:\Program Files\Google\Chrome Dev\Application\chrome.exe" \
  --custom-devtools-frontend=http://localhost:8000/
```

#### Method 2: Docker

```bash
# Build Docker image
docker build -f docker/Dockerfile -t devtools-frontend .

# Run container
docker run -d -p 8000:8000 --name devtools-frontend devtools-frontend

# Launch Chrome
chrome --custom-devtools-frontend=http://localhost:8000/
```

### Development Environment

#### VS Code Setup

Recommended extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "chrmarti.regex",
    "eamodio.gitlens"
  ]
}
```

Workspace settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": [
    "javascript",
    "typescript"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "**/out": true,
    "**/.git": true,
    "**/node_modules": true
  }
}
```

#### Debugging Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome with Custom DevTools",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:8000",
      "runtimeExecutable": "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "runtimeArgs": [
        "--custom-devtools-frontend=http://localhost:8000/",
        "--disable-extensions"
      ],
      "webRoot": "${workspaceFolder}/out/Default/gen/front_end"
    }
  ]
}
```

---

## Project Structure

### AI Chat Panel Structure

```
front_end/panels/ai_chat/
├── docs/                           # Documentation
│   ├── Architecture.md             # System architecture
│   ├── Tools-Reference.md          # Tool catalog
│   ├── Evaluation-Guide.md         # Testing guide
│   ├── LLM-Providers.md           # Provider comparison
│   ├── Specialized-Agents.md       # Agent details
│   └── Development-Guide.md        # This file
│
├── ui/                             # UI Components (Lit)
│   ├── AIChatPanel.ts             # Main panel
│   ├── ChatView.ts                # Chat interface
│   ├── SettingsDialog.ts          # Settings UI
│   ├── EvaluationDialog.ts        # Evaluation UI
│   ├── *Message.ts                # Message components
│   ├── *Component.ts              # Other UI components
│   └── ...
│
├── core/                           # Core Logic
│   ├── AgentService.ts            # Main service
│   ├── State.ts                   # State definitions
│   ├── Graph.ts                   # Primary graph
│   ├── StateGraph.ts              # State machine
│   ├── ConfigurableGraph.ts       # Graph builder
│   ├── GraphConfigs.ts            # Graph configurations
│   ├── GraphHelpers.ts            # Graph utilities
│   ├── AgentNodes.ts              # Node implementations
│   ├── BaseOrchestratorAgent.ts   # Agent configuration
│   ├── Constants.ts               # Constants
│   └── BuildConfig.ts             # Build config
│
├── agent_framework/               # Multi-Agent System
│   ├── ConfigurableAgentTool.ts   # Agent tool wrapper
│   ├── AgentRunner.ts             # Agent executor
│   ├── AgentRunnerEventBus.ts     # Event system
│   ├── AgentSessionTypes.ts       # Type definitions
│   ├── ConfiguredAgents.ts        # Agent registry
│   ├── ToolSurfaceProvider.ts     # Tool provider
│   ├── AgentDescriptorRegistry.ts # Agent metadata
│   └── implementation/
│       └── agents/                # Specialized agents
│           ├── ActionAgent.ts
│           ├── ResearchAgent.ts
│           ├── WebTaskAgent.ts
│           └── ...
│
├── LLM/                           # LLM Integration
│   ├── LLMClient.ts               # Unified client
│   ├── LLMProviderRegistry.ts     # Provider registry
│   ├── LLMTypes.ts                # Type definitions
│   ├── LLMResponseParser.ts       # Response parsing
│   ├── MessageSanitizer.ts        # Message sanitization
│   ├── LLMErrorHandler.ts         # Error handling
│   ├── LLMConfigurationManager.ts # Configuration
│   ├── OpenAIProvider.ts          # OpenAI
│   ├── LiteLLMProvider.ts         # LiteLLM
│   ├── GroqProvider.ts            # Groq
│   ├── OpenRouterProvider.ts      # OpenRouter
│   └── BrowserOperatorProvider.ts # Custom
│
├── tools/                         # Tools
│   ├── Tools.ts                   # Tool exports
│   ├── *Tool.ts                   # Individual tools
│   └── ...
│
├── tracing/                       # Observability
│   ├── TracingProvider.ts         # Provider interface
│   ├── LangfuseProvider.ts        # Langfuse impl
│   ├── TracingConfig.ts           # Configuration
│   └── README.md                  # Tracing docs
│
├── evaluation/                    # Testing Framework
│   ├── EvaluationRunner.ts        # Test runner
│   ├── EvaluationAgent.ts         # Remote eval
│   ├── GenericToolEvaluator.ts    # Tool evaluator
│   ├── LLMEvaluator.ts           # LLM judge
│   └── *-tests.ts                 # Test suites
│
├── mcp/                           # Model Context Protocol
│   ├── MCPRegistry.ts             # MCP registry
│   ├── MCPConfig.ts               # Configuration
│   └── MCPMetaTools.ts            # Meta tools
│
├── auth/                          # Authentication
│   ├── OpenRouterOAuth.ts         # OAuth flow
│   └── PKCEUtils.ts               # PKCE utilities
│
├── common/                        # Utilities
│   ├── context.ts
│   ├── page.ts
│   ├── utils.ts
│   ├── log.ts
│   ├── WebSocketRPCClient.ts
│   └── ...
│
├── models/                        # Type Definitions
│   ├── ChatTypes.ts               # Chat types
│   └── ...
│
├── ai_chat.ts                     # Module entry
├── ai_chat-meta.ts                # Panel registration
├── ai_chat_impl.ts                # Implementation export
└── Readme.md                      # Setup guide
```

### Key Files

- **Entry Points**: `ai_chat-meta.ts`, `ai_chat.ts`
- **Main Service**: `core/AgentService.ts`
- **UI Root**: `ui/AIChatPanel.ts`
- **Agent Executor**: `agent_framework/AgentRunner.ts`
- **Graph System**: `core/StateGraph.ts`, `core/Graph.ts`
- **LLM Client**: `LLM/LLMClient.ts`

---

## Development Workflow

### Making Changes

#### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

#### 2. Make Changes

```bash
# Edit files
vim front_end/panels/ai_chat/core/AgentService.ts

# Watch mode for fast iteration
npm run build -- --watch
```

#### 3. Test Changes

```bash
# Run tests
npm test

# Run specific test
npm test -- --grep="AgentService"

# Run evaluations
npm run eval
```

#### 4. Lint and Format

```bash
# Lint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Format code
npm run format
```

#### 5. Commit

```bash
git add .
git commit -m "feat: add new agent capability"
```

#### 6. Push and Create PR

```bash
git push origin feature/my-feature
# Create PR on GitHub
```

### Hot Reload

For fastest development iteration:

```bash
# Terminal 1: Watch build
npm run build -- --watch

# Terminal 2: Serve
cd out/Default/gen/front_end && python3 -m http.server 8000

# Terminal 3: Run tests in watch mode
npm test -- --watch
```

Then:
1. Make code changes
2. Build completes automatically
3. Refresh DevTools to see changes

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific file
npm test -- path/to/test-file.ts

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

### Writing Tests

```typescript
// Example: tools/NavigateURLTool.test.ts
import { NavigateURLTool } from './NavigateURLTool';

describe('NavigateURLTool', () => {
  let tool: NavigateURLTool;

  beforeEach(() => {
    tool = new NavigateURLTool();
  });

  it('should navigate to valid URL', async () => {
    const result = await tool.execute({
      url: 'https://example.com'
    });

    expect(result.success).toBe(true);
    expect(result.finalUrl).toBe('https://example.com');
  });

  it('should reject invalid URL', async () => {
    await expect(
      tool.execute({ url: 'invalid-url' })
    ).rejects.toThrow('Invalid URL');
  });
});
```

### Evaluation Tests

```bash
# Run all evaluations
npm run eval

# Run specific suite
npm run eval -- --suite=research-agent

# With verbose output
npm run eval -- --verbose

# Generate HTML report
npm run eval -- --report=html --output=./eval-results.html
```

### Integration Tests

```bash
# Run end-to-end tests
npm run test:e2e

# With specific browser
npm run test:e2e -- --browser=chrome
```

---

## Debugging

### Browser DevTools

Debug the DevTools itself:

1. Open Chrome with custom DevTools
2. Press `Ctrl+Shift+I` (Cmd+Option+I on Mac) to open DevTools on DevTools
3. Navigate to Sources tab
4. Set breakpoints in `out/Default/gen/front_end/panels/ai_chat/`

### Console Logging

```typescript
// Import logging utility
import { log } from './common/log';

// Use log levels
log.info('Starting agent execution');
log.debug('State:', state);
log.warn('Unexpected condition');
log.error('Error occurred:', error);
```

### Tracing

Enable tracing for execution visibility:

```typescript
// Enable via settings UI or console
localStorage.setItem('ai_chat_tracing_enabled', 'true');

// View traces in Langfuse
// Navigate to http://localhost:3000 (or your Langfuse instance)
```

### Debugging Agents

```typescript
// Add debug hooks to AgentRunner
const hooks = {
  onIterationStart: (iteration, messages) => {
    console.log(`Iteration ${iteration}:`, messages);
  },
  onToolCall: (toolName, args) => {
    console.log(`Calling tool: ${toolName}`, args);
  },
  onToolResult: (toolName, result) => {
    console.log(`Tool result: ${toolName}`, result);
  }
};

await AgentRunner.run(messages, args, config, hooks, agent);
```

### Network Debugging

Monitor LLM API calls:

1. Open DevTools Network tab
2. Filter by:
   - `api.openai.com` (OpenAI)
   - `api.groq.com` (Groq)
   - `openrouter.ai` (OpenRouter)
   - Your LiteLLM endpoint
3. Inspect request/response payloads

### Memory Profiling

Check for memory leaks:

1. Open DevTools on DevTools
2. Navigate to Memory tab
3. Take heap snapshot
4. Perform actions
5. Take another snapshot
6. Compare for leaked objects

---

## Code Style

### TypeScript Guidelines

**Type Safety**:
```typescript
// ✅ Good: Explicit types
function processMessage(message: ChatMessage): ProcessedMessage {
  return { /* ... */ };
}

// ❌ Bad: Implicit any
function processMessage(message) {
  return { /* ... */ };
}
```

**Interface vs Type**:
```typescript
// Use interface for object shapes
interface AgentConfig {
  name: string;
  tools: string[];
}

// Use type for unions, intersections
type ChatMessage = UserMessage | ModelMessage | ToolResultMessage;
```

**Async/Await**:
```typescript
// ✅ Good: Async/await
async function executeAgent() {
  try {
    const result = await agent.execute(args);
    return result;
  } catch (error) {
    handleError(error);
  }
}

// ❌ Bad: Promise chains
function executeAgent() {
  return agent.execute(args)
    .then(result => result)
    .catch(error => handleError(error));
}
```

### Naming Conventions

- **Files**: `PascalCase.ts` for classes, `camelCase.ts` for utilities
- **Classes**: `PascalCase` (e.g., `AgentService`)
- **Interfaces**: `PascalCase` (e.g., `ChatMessage`)
- **Functions**: `camelCase` (e.g., `executeAgent`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_ITERATIONS`)
- **Private members**: `_camelCase` (e.g., `_internalState`)

### File Organization

```typescript
// 1. Imports (external, then internal)
import { LitElement } from 'lit';
import { AgentService } from '../core/AgentService';

// 2. Constants
const MAX_RETRIES = 3;

// 3. Interfaces/Types
interface Config {
  // ...
}

// 4. Class definition
export class MyClass {
  // Public properties
  public name: string;

  // Private properties
  private _state: State;

  // Constructor
  constructor() {
    // ...
  }

  // Public methods
  public execute() {
    // ...
  }

  // Private methods
  private _internalMethod() {
    // ...
  }
}

// 5. Helper functions
function helperFunction() {
  // ...
}
```

### Comments

```typescript
/**
 * Execute an agent with the given configuration.
 *
 * @param agent - The agent to execute
 * @param args - Execution arguments
 * @param context - Execution context
 * @returns Promise resolving to agent result
 * @throws {AgentError} If execution fails
 */
async function executeAgent(
  agent: Agent,
  args: AgentArgs,
  context: Context
): Promise<AgentResult> {
  // Implementation
}
```

### Error Handling

```typescript
// Custom error classes
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// Usage
try {
  await executeAgent(args);
} catch (error) {
  if (error instanceof AgentError) {
    log.error(`Agent error: ${error.code}`, error.details);
  } else {
    log.error('Unexpected error:', error);
  }
  throw error;
}
```

---

## Common Tasks

### Adding a New Tool

See [Tools-Reference.md](./Tools-Reference.md) for comprehensive guide.

Quick steps:

```typescript
// 1. Create tool file: tools/MyNewTool.ts
export class MyNewTool implements Tool<MyArgs, MyResult> {
  name = 'my_new_tool';
  description = 'Does something useful';
  schema = { /* JSON Schema */ };

  async execute(args: MyArgs): Promise<MyResult> {
    // Implementation
  }
}

// 2. Register in Tools.ts
import { MyNewTool } from './MyNewTool';
export function getTools() {
  return [
    // ...existing tools,
    new MyNewTool()
  ];
}

// 3. Write tests: tools/MyNewTool.test.ts
describe('MyNewTool', () => {
  it('should work correctly', async () => {
    const tool = new MyNewTool();
    const result = await tool.execute({ /* args */ });
    expect(result).toBeDefined();
  });
});
```

### Adding a New Agent

See [Specialized-Agents.md](./Specialized-Agents.md) for comprehensive guide.

Quick steps:

```typescript
// 1. Define configuration
const myAgentConfig: AgentToolConfig = {
  name: 'MyAgent',
  description: 'My custom agent',
  systemPrompt: '...',
  tools: ['tool1', 'tool2'],
  maxIterations: 10
};

// 2. Register in ConfiguredAgents.ts
ToolRegistry.registerTool(
  'MyAgent',
  (ctx) => new ConfigurableAgentTool(myAgentConfig, ctx)
);

// 3. Add tests: evaluation/my-agent-tests.ts
export const myAgentTests: TestSuite = {
  agentName: 'MyAgent',
  testCases: [ /* ... */ ]
};
```

### Adding a New LLM Provider

See [LLM-Providers.md](./LLM-Providers.md) for comprehensive guide.

Quick steps:

```typescript
// 1. Implement provider: LLM/MyProvider.ts
export class MyProvider implements LLMProvider {
  async call(request: LLMRequest): Promise<LLMResponse> {
    // Implementation
  }
}

// 2. Register in LLMProviderRegistry.ts
LLMProviderRegistry.register('myprovider', MyProvider);

// 3. Update types in LLMTypes.ts
type LLMProvider = 'openai' | 'litellm' | 'groq' | 'openrouter' | 'myprovider';

// 4. Add UI configuration in SettingsDialog.ts
```

### Modifying the Graph

```typescript
// core/GraphConfigs.ts

// Add new node type
enum CustomNodeType {
  MY_CUSTOM_NODE = 'my_custom_node'
}

// Define custom node
function myCustomNode(state: AgentState): AgentState {
  // Node logic
  return updatedState;
}

// Add to graph configuration
export const myGraphConfig: GraphConfig = {
  nodes: [
    { id: 'start', type: NodeType.AGENT },
    { id: 'custom', type: CustomNodeType.MY_CUSTOM_NODE, fn: myCustomNode },
    { id: 'end', type: NodeType.FINAL }
  ],
  edges: [
    { from: 'start', to: 'custom', condition: (state) => true },
    { from: 'custom', to: 'end', condition: (state) => true }
  ]
};
```

---

## Troubleshooting

### Build Issues

**Issue**: Build fails with TypeScript errors.

**Solutions**:
1. Clear build cache: `rm -rf out/`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Sync dependencies: `gclient sync`
4. Check TypeScript version: `npx tsc --version`

### Runtime Errors

**Issue**: Panel doesn't load or shows errors.

**Solutions**:
1. Check browser console for errors
2. Verify build completed: Check `out/Default/gen/front_end/panels/ai_chat/`
3. Clear browser cache
4. Restart local server
5. Check for conflicting extensions

### API Errors

**Issue**: LLM API calls failing.

**Solutions**:
1. Verify API keys in settings
2. Check network connectivity
3. Inspect network tab for error responses
4. Test API directly with curl:
   ```bash
   curl https://api.openai.com/v1/chat/completions \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'
   ```

### Agent Loops

**Issue**: Agent stuck in infinite loop.

**Solutions**:
1. Check `maxIterations` setting
2. Add debug logging in `AgentRunner`
3. Review agent system prompt
4. Check handoff conditions
5. Enable tracing to visualize execution

### Memory Leaks

**Issue**: DevTools becomes slow/unresponsive.

**Solutions**:
1. Profile memory usage
2. Check for event listener leaks
3. Ensure proper cleanup in components
4. Review singleton lifecycle
5. Check for circular references

---

## Contributing

### Contribution Guidelines

1. **Fork and Clone**: Fork repo, clone locally
2. **Create Branch**: Feature branch from `main`
3. **Make Changes**: Follow code style
4. **Write Tests**: Add/update tests
5. **Run Tests**: Ensure all pass
6. **Lint**: Fix linting issues
7. **Commit**: Clear, descriptive messages
8. **Push**: Push to your fork
9. **Pull Request**: Create PR with description

### Commit Message Format

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Examples**:
```
feat(agents): add EcommerceAgent for product extraction

Implement new specialized agent for extracting product information
from e-commerce sites. Includes schema-based extraction and price
comparison capabilities.

Closes #123
```

```
fix(llm): handle timeout errors in GroqProvider

Add proper timeout handling and retry logic for Groq API calls.
Prevents agent failures on network issues.
```

### Code Review Checklist

- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console.log() left in code
- [ ] Error handling implemented
- [ ] Performance considered
- [ ] Security reviewed
- [ ] Breaking changes noted

### Getting Help

- **Documentation**: Check docs/ directory
- **Issues**: Search GitHub issues
- **Discussions**: GitHub Discussions
- **Slack**: Join team Slack (if available)
- **Email**: Contact maintainers

---

## Related Documentation

- [Architecture.md](./Architecture.md) - System architecture
- [Tools-Reference.md](./Tools-Reference.md) - Tool catalog
- [Evaluation-Guide.md](./Evaluation-Guide.md) - Testing guide
- [LLM-Providers.md](./LLM-Providers.md) - Provider comparison
- [Specialized-Agents.md](./Specialized-Agents.md) - Agent details
- [Tracing README](../tracing/README.md) - Tracing setup

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team
