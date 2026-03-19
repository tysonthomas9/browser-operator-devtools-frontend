# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Build (requires gn gen out/Default first)
npm run build
npm run build -- --watch    # Development mode with file watching

# Run unit tests (Karma/Mocha in Chrome)
npm run test

# Run specific test file
npm run test -- --grep "AgentRunner"

# Run E2E tests (Puppeteer)
npm run webtest
npm run debug-webtest -- --spec=path/to/test

# Type checking
gn gen out/Default && autoninja -C out/Default devtools_frontend_typescript

# Lint
npm run lint
```

## Running DevTools with Custom Build

```bash
# Terminal 1: Build with watch
npm run build -- --watch

# Terminal 2: Serve built files
cd out/Default/gen/front_end && python3 -m http.server

# Terminal 3: Launch Chrome with custom DevTools
/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary \
  --disable-infobars --custom-devtools-frontend=http://localhost:8000/
```

## AI Chat Panel Architecture

The AI Chat panel (`front_end/panels/ai_chat/`) implements a multi-agent framework:

### Directory Structure

- `agent_framework/` - Core agent system (ConfigurableAgentTool, AgentRunner, ToolRegistry)
- `core/` - Orchestration (BaseOrchestratorAgent, StateGraph, GraphConfigs)
- `LLM/` - Provider implementations (OpenAI, Anthropic, Google, Groq, LiteLLM, OpenRouter)
- `tools/` - Individual tools for browser interactions
- `mini_apps/` - Self-contained UI modules running in iframes
- `ui/` - React-like components for the chat interface

### Key Files

| File | Purpose |
|------|---------|
| `agent_framework/ConfigurableAgentTool.ts` | Defines agents via config objects; contains ToolRegistry |
| `agent_framework/AgentRunner.ts` | Executes agent loops, handles tool calls and handoffs |
| `core/BaseOrchestratorAgent.ts` | Central controller selecting agent configs |
| `core/StateGraph.ts` | Graph-based workflow orchestration |
| `core/GraphConfigs.ts` | Predefined workflow graphs |
| `LLM/LLMClient.ts` | Unified interface to all LLM providers |

### Adding a New Agent

1. Define config in `agent_framework/implementation/ConfiguredAgents.ts`:
```typescript
function createYourAgentConfig(): AgentToolConfig {
  return {
    name: 'your_agent',
    description: 'What it does',
    systemPrompt: 'Instructions...',
    tools: ['tool1', 'tool2'],  // Registered tool names
    schema: { /* JSON schema */ },
    handoffs: [{ targetAgentName: 'other_agent', trigger: 'llm_tool_call' }],
  };
}
```

2. Register in `initializeConfiguredAgents()`:
```typescript
const yourAgent = new ConfigurableAgentTool(createYourAgentConfig());
ToolRegistry.registerToolFactory('your_agent', () => yourAgent);
```

3. Add to `AGENT_CONFIGS` in `core/BaseOrchestratorAgent.ts`

### Adding a New Tool

1. Implement `Tool` interface with `name`, `description`, `schema`, `execute()`
2. Register via `ToolRegistry.registerToolFactory('tool_name', () => new YourTool())`

## Mini Apps Architecture

Mini apps run in iframes and communicate with DevTools via CDP bindings.

### Structure

Each mini app has:
- **Controller** (`mini_apps/apps/*/YourMiniApp.ts`) - DevTools context, business logic
- **SPA** (`ui/your_app/YourAppSPA.ts`) - iframe content, UI rendering

### Communication Pattern

SPA → DevTools:
```typescript
window.miniApp.sendAction('action-type', { data: payload });
// Creates: { type: 'action-type', payload: { data: payload } }
```

Controller handles via `handleSPAAction()`:
```typescript
case 'action-type': {
  const payload = action.payload as { data: YourType };
  // Process payload.data
  break;
}
```

### URL Routing

Mini apps use hash-based routing via `window.miniAppRouter`:
```typescript
window.miniAppRouter.navigate('route-name', { id: 'param' });
window.miniAppRouter.replace('route-name', { id: 'param' });
```

### SPA Initialization Pattern

Handle DOM-already-loaded case (iframe timing):
```typescript
function initialize() {
  cacheElements();
  setupEventListeners();
  window.miniApp?.sendAction('ready', {});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
```

### Adding a New Mini App

1. Create controller: `mini_apps/apps/your_app/YourAppMiniApp.ts`
2. Create SPA: `ui/your_app/YourAppSPA.ts`
3. Register in `mini_apps/MiniAppInitialization.ts`
4. Add files to `BUILD.gn` (both `sources` arrays)

## Test Patterns

Tests use Mocha/Chai with Karma runner. Test files go in `__tests__/` subdirectories.

```typescript
describe('YourComponent', () => {
  it('does something', () => {
    assert.strictEqual(actual, expected);
  });
});
```

For SPA testing, create iframe and inject content:
```typescript
const iframe = document.createElement('iframe');
document.body.appendChild(iframe);
iframe.contentDocument!.write(YourSPA.html);
// Inject CSS and JS, test interactions
```

## BUILD.gn Registration

Add new TypeScript files to `BUILD.gn`:
```gn
devtools_module("ai_chat") {
  sources = [
    "path/to/YourFile.ts",
  ]
}
```

For test files, also add to the test sources array.

## LLM Providers

Supported providers in `LLM/`:
- OpenAI, Anthropic, Google AI, Groq, Cerebras
- OpenRouter (unified gateway)
- LiteLLM (local proxy for any model)

Configuration stored via `LLMConfigurationManager` in `core/`.
