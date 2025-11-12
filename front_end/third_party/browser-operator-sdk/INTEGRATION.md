# Browser Operator SDK - DevTools Integration

This directory contains the Browser Operator AI Agent SDK, vendored for use in the AI Chat panel.

## What's Included

The SDK provides:

- **LLM Providers**: OpenAI, Anthropic, Groq, OpenRouter, LiteLLM
- **Tool System**: Runtime-agnostic tools with context injection
- **Workflows**: Declarative workflow engine with persistence
- **Agent Framework**: Multi-agent coordination system
- **State Management**: Reactive state with subscriptions
- **Memory System**: Conversation history management
- **Hooks & Events**: Lifecycle hooks and event bus

## Integration Status

### ✅ Phase 1 Complete (Setup & Preparation)

- [x] SDK vendored into `front_end/third_party/browser-operator-sdk/`
- [x] BUILD.gn created with all SDK modules
- [x] Entrypoint file created: `browser-operator-sdk.ts`
- [x] RuntimeContext adapter created: `core/DevToolsRuntimeContext.ts`
- [x] Dependencies configured in `ai_chat/BUILD.gn`
- [x] Integration test file created: `core/SDKIntegrationTest.ts`

### 📋 Next Steps (Phase 2: Migrate LLM Providers)

Follow the migration plan in `/sdk/AI_CHAT_MIGRATION_PLAN.md`

## Usage Example

```typescript
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import {devToolsRuntimeContext} from './core/DevToolsRuntimeContext.js';

// Create an LLM provider
const provider = new SDK.LLM.OpenAIProvider(apiKey);

// Create a tool with runtime context injection
const tool = SDK.Tools.createTool({
  name: 'my_tool',
  description: 'Example tool',
  parameters: SDK.z.object({
    input: SDK.z.string(),
  }),
  execute: async (params, context) => {
    // Use injected runtime context for browser APIs
    context.logger.info('Tool executed');
    await context.copyToClipboard(params.input);
    return {success: true};
  },
});

// Use the tool with DevTools runtime context
const result = await tool.execute({input: 'test'}, devToolsRuntimeContext);
```

## Files

### SDK Core Files
- `index.js`, `index.d.ts` - Main SDK exports
- `llm/` - LLM provider implementations
- `tools/` - Tool system
- `workflows/` - Workflow engine
- `agent/` - Agent framework
- `state/` - State management
- `memory/` - Conversation memory
- `hooks/` - Lifecycle hooks
- `events/` - Event bus
- `types/` - TypeScript types

### Integration Files
- `BUILD.gn` - GN build configuration
- `browser-operator-sdk.ts` - DevTools entrypoint
- `browser-operator-sdk-tsconfig.json` - TypeScript config
- `README.chromium` - Chromium third-party documentation
- `INTEGRATION.md` - This file

### DevTools Adapter Files (in ai_chat/)
- `core/DevToolsRuntimeContext.ts` - Runtime context implementation
- `core/SDKIntegrationTest.ts` - Integration verification

## Build Process

The SDK is built separately in the `/sdk` directory and vendored here.

To update the SDK:

```bash
cd /home/user/browser-operator-core/sdk
pnpm build
cd /home/user/browser-operator-core
rm -rf front_end/third_party/browser-operator-sdk/
mkdir -p front_end/third_party/browser-operator-sdk/
cp -r sdk/packages/core/dist/* front_end/third_party/browser-operator-sdk/
# Re-create BUILD.gn, browser-operator-sdk.ts, and other config files
```

## Dependencies

- **Zod**: Schema validation (shared with mcp-sdk)
- **No other runtime dependencies** - fully browser-compatible

## License

BSD-3-Clause (same as Chromium and Browser Operator)

## Documentation

Full SDK documentation available in `/sdk/packages/core/README.md`
Migration plan available in `/sdk/AI_CHAT_MIGRATION_PLAN.md`
