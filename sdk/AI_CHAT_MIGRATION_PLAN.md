# AI Chat SDK Migration Plan

**Goal:** Migrate front_end/panels/ai_chat to use the new @browser-operator/core SDK, eliminating code duplication and leveraging improved architecture.

**Status:** Planning Phase
**Priority:** HIGH (Post-MVP Enhancement)
**Estimated Effort:** 2-3 weeks

---

## Executive Summary

The Browser Operator SDK now provides production-ready implementations of:
- ✅ 5 LLM Providers (OpenAI, Anthropic, Groq, OpenRouter, LiteLLM)
- ✅ 24 Production Tools with runtime injection
- ✅ Workflow System with persistence
- ✅ Memory System with IndexedDB
- ✅ Agent framework with state management

**Migration Benefits:**
- 📉 Reduce ai_chat codebase by ~40-50%
- 🔧 Eliminate duplicate LLM provider implementations
- 🎯 Leverage improved architecture (Zod schemas, runtime injection)
- 🧪 Use tested, type-safe SDK components
- 🚀 Easier maintenance and feature additions
- 🌐 Better browser compatibility

---

## Current State Analysis

### ai_chat Directory Structure
```
front_end/panels/ai_chat/
├── LLM/                          # 🔄 REPLACE with SDK providers
│   ├── OpenAIProvider.ts         # -> @browser-operator/core/llm
│   ├── AnthropicProvider.ts      # (doesn't exist, would use SDK)
│   ├── GroqProvider.ts           # -> @browser-operator/core/llm
│   ├── OpenRouterProvider.ts     # -> @browser-operator/core/llm
│   ├── LiteLLMProvider.ts        # -> @browser-operator/core/llm
│   ├── BrowserOperatorProvider.ts # KEEP (ai_chat specific)
│   ├── LLMClient.ts              # 🔄 ADAPT to use SDK providers
│   ├── LLMProviderRegistry.ts    # 🔄 ADAPT to use SDK providers
│   ├── LLMErrorHandler.ts        # KEEP (error handling logic)
│   ├── LLMResponseParser.ts      # KEEP (ai_chat specific parsing)
│   └── MessageSanitizer.ts       # KEEP (DevTools specific)
│
├── agent_framework/              # 🔄 REPLACE with SDK Agent
│   ├── AgentRunner.ts            # -> SDK Agent class + workflows
│   ├── ConfigurableAgentTool.ts  # -> SDK tool system
│   └── implementation/
│       └── agents/               # 🔄 ADAPT to use SDK Agent
│           ├── ActionAgent.ts    # Rewrite using SDK
│           ├── ResearchAgent.ts  # Rewrite using SDK
│           └── ...               # 15+ specialized agents
│
├── tools/                        # ✅ ALREADY MIGRATED to SDK
│   ├── ThinkingTool.ts           # -> @browser-operator/core/tools
│   ├── SchemaExtractorTool.ts    # -> @browser-operator/core/tools
│   └── ...                       # All 24 tools migrated
│
├── core/                         # KEEP (DevTools integration)
│   ├── FileStorageManager.ts     # Runtime dependency for SDK tools
│   ├── Logger.ts                 # Keep for ai_chat logging
│   └── ...
│
├── ui/                           # KEEP (UI components)
│   └── ...                       # React components, UI logic
│
├── mcp/                          # KEEP (MCP integration)
├── tracing/                      # KEEP (observability)
├── auth/                         # KEEP (authentication)
└── models/                       # KEEP (data models)
```

---

## Migration Strategy

### Phase 1: Setup & Preparation (1-2 days)

**Goal:** Add SDK as dependency and create integration layer

**Tasks:**
1. Add SDK to ai_chat dependencies
   ```json
   // front_end/panels/ai_chat/package.json (if separate)
   {
     "dependencies": {
       "@browser-operator/core": "workspace:*"
     }
   }
   ```

2. Create integration adapter layer
   ```typescript
   // front_end/panels/ai_chat/sdk_integration/
   ├── RuntimeDependencies.ts    // Inject FileStorageManager, CDP, etc.
   ├── ProviderAdapter.ts        // Adapt SDK providers to ai_chat interface
   └── ToolAdapter.ts            // Adapt SDK tools for ai_chat use
   ```

3. Set up build configuration to import SDK
   - Update tsconfig.json paths if needed
   - Ensure bundler can resolve SDK imports

---

### Phase 2: Migrate LLM Providers (2-3 days)

**Goal:** Replace ai_chat provider implementations with SDK providers

#### 2.1 Update LLMProviderRegistry

**Before:**
```typescript
// ai_chat/LLM/LLMProviderRegistry.ts
import { OpenAIProvider } from './OpenAIProvider.js';
import { GroqProvider } from './GroqProvider.js';
// ... more local imports

export class LLMProviderRegistry {
  private providers = new Map<string, LLMBaseProvider>();

  registerProvider(name: string, provider: LLMBaseProvider) {
    this.providers.set(name, provider);
  }
}
```

**After:**
```typescript
// ai_chat/LLM/LLMProviderRegistry.ts
import {
  OpenAIProvider,
  AnthropicProvider,
  GroqProvider,
  OpenRouterProvider,
  LiteLLMProvider,
  type ILLMProvider
} from '@browser-operator/core/llm';

export class LLMProviderRegistry {
  private providers = new Map<string, ILLMProvider>();

  // Adapter to convert SDK providers to ai_chat interface
  private adaptProvider(sdkProvider: ILLMProvider): LLMBaseProvider {
    return new SDKProviderAdapter(sdkProvider);
  }

  registerProvider(name: string, provider: ILLMProvider) {
    this.providers.set(name, this.adaptProvider(provider));
  }
}
```

#### 2.2 Create Provider Adapter

```typescript
// ai_chat/sdk_integration/ProviderAdapter.ts
import type { ILLMProvider, LLMMessage, LLMResponse } from '@browser-operator/core/llm';
import { LLMBaseProvider } from '../LLM/LLMProvider.js';

/**
 * Adapts SDK providers to ai_chat's LLMBaseProvider interface
 */
export class SDKProviderAdapter extends LLMBaseProvider {
  constructor(private sdkProvider: ILLMProvider) {
    super();
  }

  async callWithMessages(
    model: string,
    messages: LLMMessage[],
    options?: any
  ): Promise<LLMResponse> {
    // Convert ai_chat options to SDK options if needed
    const sdkOptions = this.convertOptions(options);

    // Call SDK provider
    return this.sdkProvider.call(model, messages, sdkOptions);
  }

  async *streamWithMessages(
    model: string,
    messages: LLMMessage[],
    options?: any
  ): AsyncIterable<string> {
    const sdkOptions = this.convertOptions(options);

    if (this.sdkProvider.stream) {
      yield* this.sdkProvider.stream(model, messages, sdkOptions);
    } else {
      throw new Error('Streaming not supported');
    }
  }

  private convertOptions(options: any): any {
    // Map ai_chat options to SDK options
    return {
      temperature: options?.temperature,
      maxTokens: options?.max_tokens,
      tools: options?.tools,
      // ... other conversions
    };
  }
}
```

#### 2.3 Delete Old Provider Implementations

**Files to DELETE:**
- ❌ `ai_chat/LLM/OpenAIProvider.ts` (~120 lines)
- ❌ `ai_chat/LLM/GroqProvider.ts` (~480 lines)
- ❌ `ai_chat/LLM/OpenRouterProvider.ts` (~450 lines)
- ❌ `ai_chat/LLM/LiteLLMProvider.ts` (~350 lines)

**Total Code Reduction:** ~1,400 lines deleted! 🎉

---

### Phase 3: Migrate Tools (3-4 days)

**Goal:** Replace ai_chat tools with SDK tools and provide runtime dependencies

#### 3.1 Create Runtime Dependency Injector

```typescript
// ai_chat/sdk_integration/RuntimeDependencies.ts
import { RuntimeContext } from '@browser-operator/core/tools';
import { FileStorageManager } from '../core/FileStorageManager.js';
import { CDPSession } from '../core/CDPSession.js';

/**
 * Creates runtime context for SDK tools with ai_chat dependencies
 */
export function createAIChatRuntimeContext(): RuntimeContext {
  const context = new RuntimeContext();

  // Inject ai_chat's FileStorageManager
  context.set('fileStorageManager', FileStorageManager.getInstance());

  // Inject CDP-based code executor
  context.set('codeExecutor', {
    async execute(code: string, options: any) {
      const session = await CDPSession.getInstance();
      return session.evaluate(code, options);
    }
  });

  // Inject other runtime dependencies
  context.set('pageContentAccessor', createPageContentAccessor());
  context.set('llmProvider', getLLMProvider());
  // ... etc

  return context;
}

function createPageContentAccessor() {
  return {
    async getURL(): Promise<string> {
      // Use DevTools SDK to get current URL
      return SDK.targetManager.mainTarget()?.url() || '';
    },
    async getTitle(): Promise<string> {
      // Get page title via CDP
      // ...
    },
    // ... implement other methods
  };
}
```

#### 3.2 Update Tool Usage

**Before:**
```typescript
// ai_chat usage
import { ThinkingTool } from './tools/ThinkingTool.js';

const tool = new ThinkingTool();
const result = await tool.execute({
  userPrompt: 'analyze this',
  includeVisuals: true
});
```

**After:**
```typescript
// SDK usage with runtime injection
import { thinking } from '@browser-operator/core/tools';
import { createAIChatRuntimeContext } from './sdk_integration/RuntimeDependencies.js';

const runtimeContext = createAIChatRuntimeContext();

const result = await thinking.execute({
  context: {
    inputData: {
      userPrompt: 'analyze this',
      includeVisuals: true
    },
    runtimeContext,
    state: {},
    setState: () => {},
    getStepResult: () => undefined,
    getInitData: () => ({})
  }
});
```

#### 3.3 Delete Old Tool Implementations

**Files to DELETE:**
- ❌ `ai_chat/tools/*.ts` (all 24 tool files, ~3,000+ lines)

**Keep Only:**
- ✅ Tool-specific UI components if any
- ✅ Tool configuration/settings

---

### Phase 4: Migrate Agent Framework (4-5 days)

**Goal:** Replace AgentRunner with SDK Agent class and workflows

#### 4.1 Agent Runner Migration

**Before (ai_chat):**
```typescript
// ai_chat/agent_framework/AgentRunner.ts (~800 lines)
export class AgentRunner {
  async run(
    agent: AgentConfig,
    userMessage: string,
    options: RunOptions
  ): Promise<AgentResult> {
    // Complex multi-iteration loop
    // Tool call handling
    // State management
    // Error recovery
    // ... 800 lines of logic
  }
}
```

**After (SDK):**
```typescript
// Use SDK Agent + Workflows
import { Agent } from '@browser-operator/core/agent';
import { createWorkflow, createStep } from '@browser-operator/core/workflows';
import { ConversationBufferMemory } from '@browser-operator/core/memory';

export class SDKAgentRunner {
  private agent: Agent;
  private memory: ConversationBufferMemory;

  constructor(provider: ILLMProvider) {
    this.agent = new Agent({
      name: 'ai-chat-agent',
      llmProvider: provider,
      tools: this.getTools(),
    });

    this.memory = new ConversationBufferMemory({
      maxMessages: 100
    });
  }

  async run(config: AgentConfig, userMessage: string): Promise<AgentResult> {
    // Add message to memory
    await this.memory.addMessage('user', userMessage);

    // Get conversation history
    const messages = await this.memory.getMessages({ limit: 50 });

    // Run agent with memory
    const response = await this.agent.generateText({
      messages,
      model: config.model,
      systemPrompt: config.systemPrompt,
    });

    // Add response to memory
    await this.memory.addMessage('assistant', response.text);

    return {
      response: response.text,
      toolCalls: response.toolCalls,
      // ...
    };
  }
}
```

#### 4.2 Specialized Agent Migration

Migrate 15+ specialized agents to use SDK:

**Before:**
```typescript
// ai_chat/agent_framework/implementation/agents/ResearchAgent.ts
export class ResearchAgent {
  constructor(private llm: LLMBaseProvider) {}

  async research(query: string): Promise<ResearchResult> {
    // Custom research logic
    // Uses local LLM provider
    // Manual tool orchestration
  }
}
```

**After:**
```typescript
// Rewrite using SDK Agent + Workflows
import { Agent } from '@browser-operator/core/agent';
import { createWorkflow, createStep } from '@browser-operator/core/workflows';
import { thinking, fetcher, schemaExtractor } from '@browser-operator/core/tools';

export class ResearchAgent {
  private workflow: CompiledWorkflow;

  constructor(private agent: Agent) {
    this.workflow = this.createResearchWorkflow();
  }

  private createResearchWorkflow() {
    const analyzeStep = createStep({
      id: 'analyze',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ searchTerms: z.array(z.string()) }),
      execute: async ({ inputData, runtimeContext }) => {
        // Use thinking tool to analyze query
        const result = await thinking.execute({
          context: { inputData, runtimeContext, ... }
        });
        return { searchTerms: result.searchTerms };
      }
    });

    const fetchStep = createStep({
      id: 'fetch',
      inputSchema: z.object({ searchTerms: z.array(z.string()) }),
      outputSchema: z.object({ results: z.array(z.any()) }),
      execute: async ({ inputData, runtimeContext }) => {
        // Use fetcher tool in parallel
        // ...
      }
    });

    return createWorkflow({
      id: 'research-workflow',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ findings: z.array(z.any()) })
    })
      .then(analyzeStep)
      .parallel([fetchStep, ...])
      .then(synthesizeStep)
      .commit();
  }

  async research(query: string): Promise<ResearchResult> {
    const result = await this.workflow.start({ query });
    return result.output;
  }
}
```

**Benefits:**
- ✅ Declarative workflow definition
- ✅ Built-in persistence (can save/resume research)
- ✅ Type-safe with Zod schemas
- ✅ Reusable steps
- ✅ Better error handling

---

### Phase 5: Integration & Testing (3-4 days)

**Goal:** Ensure all ai_chat features work with SDK

#### 5.1 Integration Testing

**Test Areas:**
1. ✅ Provider switching (OpenAI → Anthropic → Groq)
2. ✅ Tool execution with DevTools integration
3. ✅ Agent multi-turn conversations
4. ✅ Memory persistence across page reloads
5. ✅ Streaming responses in UI
6. ✅ Error handling and recovery
7. ✅ Settings/configuration
8. ✅ MCP tool integration
9. ✅ Tracing and observability

#### 5.2 UI Integration

**Update UI components to use SDK:**

```typescript
// ai_chat/ui/ChatPanel.tsx
import { Agent } from '@browser-operator/core/agent';
import { OpenAIProvider } from '@browser-operator/core/llm';
import { ConversationBufferMemory } from '@browser-operator/core/memory';

export class ChatPanel {
  private agent: Agent;
  private memory: ConversationBufferMemory;

  async initialize() {
    const provider = new OpenAIProvider(this.getAPIKey());

    this.agent = new Agent({
      name: 'ai-chat',
      llmProvider: provider,
      tools: this.getSDKTools(),
    });

    this.memory = new ConversationBufferMemory({
      storage: new IndexedDBStorage('ai-chat-memory')
    });
  }

  async sendMessage(text: string) {
    // Add to memory
    await this.memory.addMessage('user', text);

    // Get context
    const messages = await this.memory.getMessages();

    // Stream response
    for await (const chunk of this.agent.streamText({
      messages,
      model: this.getCurrentModel()
    })) {
      this.updateUI(chunk);
    }
  }
}
```

#### 5.3 Backward Compatibility

**Create compatibility layer if needed:**

```typescript
// ai_chat/sdk_integration/BackwardCompatibility.ts

/**
 * Provides backward-compatible interface for old ai_chat code
 */
export class LegacyAgentRunnerAdapter {
  constructor(private sdkRunner: SDKAgentRunner) {}

  // Old interface
  async run(config: OldConfig): Promise<OldResult> {
    // Convert old config to new format
    const newConfig = this.convertConfig(config);

    // Run with SDK
    const result = await this.sdkRunner.run(newConfig);

    // Convert back to old format
    return this.convertResult(result);
  }
}
```

---

### Phase 6: Cleanup & Documentation (1-2 days)

**Goal:** Remove old code, update docs, verify everything works

#### 6.1 Delete Old Implementations

**Files/Directories to DELETE:**
- ❌ `ai_chat/LLM/OpenAIProvider.ts`
- ❌ `ai_chat/LLM/GroqProvider.ts`
- ❌ `ai_chat/LLM/OpenRouterProvider.ts`
- ❌ `ai_chat/LLM/LiteLLMProvider.ts`
- ❌ `ai_chat/tools/*.ts` (24 files)
- ❌ `ai_chat/agent_framework/AgentRunner.ts` (if fully replaced)

**Estimated Code Reduction:**
- LLM Providers: ~1,400 lines
- Tools: ~3,000 lines
- Agent Runner: ~800 lines (if replaced with workflows)
- **Total: ~5,200 lines deleted** 🎉

#### 6.2 Update Documentation

**Update docs to reference SDK:**
- Migration guide for developers
- New architecture diagrams showing SDK integration
- API documentation updates
- Example code snippets

#### 6.3 Update Dependencies

**package.json:**
```json
{
  "dependencies": {
    "@browser-operator/core": "workspace:*"
  },
  "devDependencies": {
    // Remove any duplicate dependencies now provided by SDK
  }
}
```

---

## Migration Phases Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Setup | 1-2 days | SDK integrated, adapter layer created |
| Phase 2: Providers | 2-3 days | All providers using SDK, old code deleted |
| Phase 3: Tools | 3-4 days | All tools using SDK with runtime injection |
| Phase 4: Agents | 4-5 days | Agent framework using SDK Agent + Workflows |
| Phase 5: Integration | 3-4 days | All features tested and working |
| Phase 6: Cleanup | 1-2 days | Old code removed, docs updated |
| **TOTAL** | **14-20 days** | **ai_chat fully SDK-powered** |

---

## Risk Mitigation

### Risks & Mitigation Strategies

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK interface incompatibility | HIGH | Create adapter layer, maintain backward compat |
| Missing runtime dependencies | HIGH | Comprehensive runtime injection layer |
| Performance regression | MEDIUM | Benchmark before/after, optimize if needed |
| Breaking UI integration | HIGH | Thorough testing, gradual rollout |
| DevTools API changes | MEDIUM | Keep CDP integration isolated in adapters |

### Rollback Plan

1. Keep all old code in separate branch
2. Feature flag SDK integration (gradual rollout)
3. Monitor errors/metrics after each phase
4. Quick rollback mechanism if critical issues arise

---

## Success Metrics

### Quantitative Metrics
- ✅ **Code Reduction:** 40-50% (5,200+ lines deleted)
- ✅ **Build Size:** Smaller bundle (shared SDK code)
- ✅ **Type Safety:** 100% TypeScript strict mode
- ✅ **Test Coverage:** Maintain or improve existing coverage
- ✅ **Performance:** Equal or better response times

### Qualitative Metrics
- ✅ Easier to add new providers (just import from SDK)
- ✅ Easier to add new tools (use SDK createTool)
- ✅ Better maintainability (single source of truth in SDK)
- ✅ Improved developer experience (consistent APIs)
- ✅ Better documentation (SDK docs apply to ai_chat)

---

## Post-Migration Benefits

### Immediate Benefits
1. **Code Simplification:** 5,200+ fewer lines to maintain
2. **Consistency:** All features use same SDK patterns
3. **Type Safety:** Full TypeScript coverage with Zod validation
4. **Browser Compatibility:** Leverage SDK's browser-first design

### Long-term Benefits
1. **Faster Feature Development:** New tools/providers just need SDK import
2. **Better Testing:** SDK is tested, ai_chat focuses on integration tests
3. **Easier Onboarding:** New developers learn SDK once, applies everywhere
4. **Future-Proof:** SDK improvements automatically benefit ai_chat

---

## Next Steps

1. **Review this plan** with team
2. **Create detailed tasks** for each phase
3. **Set up feature flags** for gradual rollout
4. **Create migration branch** for development
5. **Start with Phase 1** (Setup & Preparation)

---

## Questions for Discussion

1. **Timeline:** Is 2-3 weeks acceptable for this migration?
2. **Rollout:** Should we use feature flags for gradual rollout?
3. **Testing:** What's the minimum test coverage required before merging?
4. **Compatibility:** Do we need to maintain old interfaces for some time?
5. **Performance:** What are the acceptable performance benchmarks?

---

**Document Version:** 1.0
**Last Updated:** 2025-01-11
**Status:** Ready for Review
