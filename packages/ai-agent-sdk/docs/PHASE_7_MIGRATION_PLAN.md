# Phase 7: Browser Operator Migration Plan

**Date:** 2025-11-11
**Status:** In Progress - Analysis Complete

## Executive Summary

This document outlines the detailed migration plan for migrating Browser Operator's AI chat implementation to use the AI Agent SDK. The migration will be performed incrementally with validation after each step.

---

## Current State Analysis

### Browser Operator AI Chat Structure

```
front_end/panels/ai_chat/
├── LLM/                    ← MIGRATE to SDK
├── agent_framework/        ← PARTIALLY MIGRATE (core framework to SDK)
├── core/                   ← PARTIALLY MIGRATE (graph, logger to SDK)
├── tools/                  ← KEEP (browser-specific)
├── tracing/                ← MIGRATE to SDK
├── mcp/                    ← MIGRATE to SDK
├── ui/                     ← KEEP (browser-specific)
├── evaluation/             ← KEEP (testing framework)
├── common/                 ← KEEP (browser utilities)
├── auth/                   ← KEEP (OAuth flows)
├── models/                 ← KEEP (data models)
├── testing/                ← KEEP (test utilities)
└── docs/                   ← KEEP (documentation)
```

---

## Migration Breakdown

### Category 1: Direct SDK Replacements (Delete After Migration)

These files will be completely replaced with SDK imports and deleted:

#### LLM System (12 files)
- `LLM/LLMClient.ts` → `@browser-operator/ai-agent-sdk/llm/LLMClient`
- `LLM/LLMProvider.ts` → `@browser-operator/ai-agent-sdk/llm/LLMProvider`
- `LLM/LLMProviderRegistry.ts` → `@browser-operator/ai-agent-sdk/llm/LLMProviderRegistry`
- `LLM/LLMTypes.ts` → `@browser-operator/ai-agent-sdk/llm/LLMTypes`
- `LLM/LLMResponseParser.ts` → `@browser-operator/ai-agent-sdk/llm/LLMResponseParser`
- `LLM/LLMErrorHandler.ts` → `@browser-operator/ai-agent-sdk/llm/LLMErrorHandler`
- `LLM/MessageSanitizer.ts` → `@browser-operator/ai-agent-sdk/llm/MessageSanitizer`
- `LLM/OpenAIProvider.ts` → `@browser-operator/ai-agent-sdk/llm/OpenAIProvider`
- `LLM/LiteLLMProvider.ts` → `@browser-operator/ai-agent-sdk/llm/LiteLLMProvider`
- `LLM/GroqProvider.ts` → `@browser-operator/ai-agent-sdk/llm/GroqProvider`
- `LLM/OpenRouterProvider.ts` → `@browser-operator/ai-agent-sdk/llm/OpenRouterProvider`
- `LLM/BrowserOperatorProvider.ts` → `@browser-operator/ai-agent-sdk/llm/BrowserOperatorProvider`

#### Agent Framework Core (4 files)
- `agent_framework/AgentRunner.ts` → `@browser-operator/ai-agent-sdk/agent/AgentRunner`
- `agent_framework/ConfigurableAgentTool.ts` → `@browser-operator/ai-agent-sdk/agent/ConfigurableAgent`
- `agent_framework/AgentSessionTypes.ts` → `@browser-operator/ai-agent-sdk/messaging/*`
- `agent_framework/AgentRunnerEventBus.ts` → `@browser-operator/ai-agent-sdk/agent/AgentEventBus`

#### Core Graph & Orchestration (5 files)
- `core/StateGraph.ts` → `@browser-operator/ai-agent-sdk/orchestration/StateGraph`
- `core/Graph.ts` → `@browser-operator/ai-agent-sdk/orchestration/GraphBuilder`
- `core/GraphHelpers.ts` → `@browser-operator/ai-agent-sdk/orchestration/GraphNodeHelpers`
- `core/AgentErrorHandler.ts` → `@browser-operator/ai-agent-sdk/agent/AgentErrorHandler`
- `core/Logger.ts` → `@browser-operator/ai-agent-sdk/observability/Logger`

#### Tracing (2+ files)
- `tracing/TracingProvider.ts` → `@browser-operator/ai-agent-sdk/tracing/TracingProvider`
- `tracing/LangfuseProvider.ts` → `@browser-operator/ai-agent-sdk/tracing/LangfuseProvider`
- `tracing/TracingConfig.ts` → `@browser-operator/ai-agent-sdk/tracing/TracingConfig`

#### MCP Integration (4+ files)
- `mcp/MCPToolAdapter.ts` → `@browser-operator/ai-agent-sdk/mcp/MCPToolAdapter`
- `mcp/MCPRegistry.ts` → `@browser-operator/ai-agent-sdk/mcp/MCPRegistry`
- `mcp/MCPConfig.ts` → `@browser-operator/ai-agent-sdk/mcp/MCPConfig`
- `core/ToolNameMap.ts` → `@browser-operator/ai-agent-sdk/mcp/ToolNameMap`

**Total: ~30 files to migrate and delete**

---

### Category 2: Files Requiring Updates (Keep, Modify Imports)

These files will stay in Browser Operator but need import updates:

#### Core Files (Keep with Import Updates)
- `core/AgentNodes.ts` - Uses StateGraph, needs SDK imports
- `core/ConfigurableGraph.ts` - Uses StateGraph, needs SDK imports
- `core/GraphConfigs.ts` - Graph configurations, needs SDK imports
- `core/BaseOrchestratorAgent.ts` - Base agent class, needs SDK imports
- `core/AgentService.ts` - Service layer, needs SDK imports
- `core/LLMConfigurationManager.ts` - LLM config UI, needs SDK imports
- `core/PageInfoManager.ts` - Browser-specific, needs SDK tool interface
- `core/ToolSurfaceProvider.ts` - Tool registration, needs SDK imports

#### Agent Implementations (~15 files)
- `agent_framework/implementation/ConfiguredAgents.ts` - Uses SDK agent framework
- `agent_framework/implementation/agents/*.ts` - All specific agents need SDK imports

#### All Browser Tools (~30 files)
- `tools/*.ts` - All tools need to implement SDK Tool interface
- Examples:
  - `tools/Tools.ts` - Main tool exports
  - `tools/HTMLToMarkdownTool.ts` - DOM access tool
  - `tools/DocumentSearchTool.ts` - Browser search
  - `tools/VisualIndicatorTool.ts` - UI tool
  - `tools/GetWebAppDataTool.ts` - Browser data access
  - And ~25 more...

**Total: ~50+ files need import updates**

---

### Category 3: Keep As-Is (No Changes)

These files remain unchanged:

- `ui/*` - UI components
- `evaluation/*` - Testing framework
- `common/*` - Browser utilities (context, page, log, utils)
- `auth/*` - OAuth implementations
- `models/*` - Data models
- `testing/*` - Test utilities
- `docs/*` - Documentation
- `scripts/*` - Build/dev scripts
- `ai_chat.ts`, `ai_chat_impl.ts`, `ai_chat-meta.ts` - Panel registration

**Total: ~100+ files unchanged**

---

## Migration Strategy

### Phase 7.1: Setup & Dependency Configuration
**Risk: Low**

1. Add SDK as dependency to Browser Operator's package.json
2. Update tsconfig.json if needed for SDK paths
3. Build SDK and ensure it's available
4. Create import mapping reference document

**Validation:**
- Build succeeds with SDK as dependency
- TypeScript can resolve SDK imports

---

### Phase 7.2: LLM System Migration
**Risk: Medium (Core system)**

**Order of migration:**
1. `LLM/LLMTypes.ts` - Types first (no dependencies)
2. `LLM/LLMProvider.ts` - Base class
3. `LLM/MessageSanitizer.ts` - Utility
4. `LLM/LLMResponseParser.ts` - Utility
5. `LLM/LLMErrorHandler.ts` - Error handling
6. `LLM/LLMProviderRegistry.ts` - Registry
7. Provider implementations:
   - `LLM/OpenAIProvider.ts`
   - `LLM/LiteLLMProvider.ts`
   - `LLM/GroqProvider.ts`
   - `LLM/OpenRouterProvider.ts`
   - `LLM/BrowserOperatorProvider.ts`
8. `LLM/LLMClient.ts` - Top-level client

**Files to update imports:**
- `core/LLMConfigurationManager.ts`
- `core/BaseOrchestratorAgent.ts`
- `tools/LLMTracingWrapper.ts`
- All agent implementations

**Validation:**
- Build succeeds
- No TypeScript errors
- LLM configuration UI still works
- Can make test LLM call

---

### Phase 7.3: Observability Migration
**Risk: Low**

1. Migrate `core/Logger.ts` → SDK Logger
2. Update all files importing Logger (~50+ files)

**Validation:**
- Build succeeds
- Logging still works in UI
- Log levels work correctly

---

### Phase 7.4: Messaging Types Migration
**Risk: Low**

1. Migrate `agent_framework/AgentSessionTypes.ts` → SDK messaging types
2. Update all files using session types

**Validation:**
- Build succeeds
- Chat messages render correctly
- Tool results display properly

---

### Phase 7.5: Tool System Migration
**Risk: Medium (Many dependent files)**

1. Update all tools to import SDK Tool interface
2. Update ToolRegistry imports
3. Update `core/ToolSurfaceProvider.ts`

**Validation:**
- Build succeeds
- All tools registered correctly
- Tools can be executed
- Tool schemas validated

---

### Phase 7.6: Agent Framework Migration
**Risk: High (Core functionality)**

1. Migrate `agent_framework/AgentRunner.ts` → SDK
2. Migrate `agent_framework/ConfigurableAgentTool.ts` → SDK
3. Migrate `agent_framework/AgentRunnerEventBus.ts` → SDK
4. Migrate `core/AgentErrorHandler.ts` → SDK
5. Update all agent implementations

**Validation:**
- Build succeeds
- Agents can be instantiated
- Agent execution works
- Agent handoffs work
- Error handling works

---

### Phase 7.7: Graph Orchestration Migration
**Risk: High (Core orchestration)**

1. Migrate `core/StateGraph.ts` → SDK
2. Migrate `core/Graph.ts` → SDK (GraphBuilder)
3. Migrate `core/GraphHelpers.ts` → SDK helpers
4. Update `core/AgentNodes.ts`
5. Update `core/ConfigurableGraph.ts`
6. Update `core/GraphConfigs.ts`
7. Update `core/BaseOrchestratorAgent.ts`

**Validation:**
- Build succeeds
- State machines execute correctly
- Conditional routing works
- Graph progress tracking works
- Multi-agent workflows work

---

### Phase 7.8: Tracing Migration
**Risk: Low (Optional feature)**

1. Migrate tracing files to SDK
2. Update `tools/LLMTracingWrapper.ts`

**Validation:**
- Build succeeds
- Tracing can be enabled/disabled
- Langfuse integration works

---

### Phase 7.9: MCP Migration
**Risk: Medium (Third-party integrations)**

1. Migrate MCP files to SDK
2. Update MCP UI components if needed

**Validation:**
- Build succeeds
- MCP providers can connect
- MCP tools work correctly
- OAuth flows work

---

### Phase 7.10: Cleanup & Testing
**Risk: Low**

1. Delete old migrated files
2. Remove unused imports
3. Run full test suite
4. Run evaluation framework
5. Test all agent workflows

**Validation:**
- No old files remain
- No import errors
- All tests pass
- All evaluations pass
- Manual testing successful

---

### Phase 7.11: Performance Validation
**Risk: Low**

1. Benchmark agent execution time
2. Benchmark LLM call latency
3. Benchmark graph execution
4. Compare with pre-migration baseline

**Validation:**
- No performance degradation (or <5% acceptable)
- Memory usage similar or improved

---

### Phase 7.12: Documentation & Finalization
**Risk: Low**

1. Update Browser Operator README
2. Update migration documentation
3. Create changelog entry
4. Final commit and PR

---

## Import Mapping Reference

### LLM Imports
```typescript
// Before
import { LLMClient } from '../LLM/LLMClient.js';
import { OpenAIProvider } from '../LLM/OpenAIProvider.js';
import type { LLMMessage, LLMCallRequest } from '../LLM/LLMTypes.js';

// After
import { LLMClient, OpenAIProvider, type LLMMessage, type LLMCallRequest } from '@browser-operator/ai-agent-sdk';
```

### Agent Framework Imports
```typescript
// Before
import { AgentRunner } from '../agent_framework/AgentRunner.js';
import { ConfigurableAgent } from '../agent_framework/ConfigurableAgentTool.js';

// After
import { AgentRunner, ConfigurableAgent } from '@browser-operator/ai-agent-sdk';
```

### Graph Orchestration Imports
```typescript
// Before
import { StateGraph } from '../core/StateGraph.js';
import { GraphBuilder } from '../core/Graph.js';
import { createTransformNode } from '../core/GraphHelpers.js';

// After
import { StateGraph, GraphBuilder, createTransformNode } from '@browser-operator/ai-agent-sdk';
```

### Tool System Imports
```typescript
// Before
import type { Tool, ToolContext } from '../core/Types.js';
import { ToolRegistry } from '../core/ToolRegistry.js';

// After
import { type Tool, type ToolContext, ToolRegistry } from '@browser-operator/ai-agent-sdk';
```

### Observability Imports
```typescript
// Before
import { logger } from '../core/Logger.js';

// After
import { logger } from '@browser-operator/ai-agent-sdk';
```

### Tracing Imports
```typescript
// Before
import { TracingProvider } from '../tracing/TracingProvider.js';
import { LangfuseProvider } from '../tracing/LangfuseProvider.js';

// After
import { TracingProvider, LangfuseProvider, configureTracing } from '@browser-operator/ai-agent-sdk';
```

### MCP Imports
```typescript
// Before
import { MCPRegistry } from '../mcp/MCPRegistry.js';
import { MCPToolAdapter } from '../mcp/MCPToolAdapter.js';

// After
import { MCPRegistry, MCPToolAdapter, getMCPConfig } from '@browser-operator/ai-agent-sdk';
```

---

## Risk Assessment

### High Risk Areas
1. **Graph Orchestration** - Complex state machine logic, many dependents
2. **Agent Framework** - Core execution loop, affects all agents
3. **Tool System** - 30+ tools need updates

### Medium Risk Areas
1. **LLM System** - Many files but well-isolated
2. **MCP Integration** - Third-party dependencies

### Low Risk Areas
1. **Observability** - Simple logger replacement
2. **Tracing** - Optional feature
3. **Cleanup** - No functional changes

---

## Rollback Plan

Each phase includes validation. If validation fails:

1. **Identify failing component** - Use TypeScript errors, runtime errors, or test failures
2. **Revert last commit** - `git revert HEAD` or `git reset --hard HEAD^`
3. **Document issue** - Add to migration issues log
4. **Fix in SDK or adjust migration strategy** - Determine root cause
5. **Retry phase** - After fix is in place

---

## Success Criteria

✅ All TypeScript compilation errors resolved
✅ All existing tests pass
✅ All evaluation test cases pass
✅ Manual testing of key workflows successful
✅ No performance degradation (within 5%)
✅ All old migrated files deleted
✅ Documentation updated

---

## Timeline Estimate

- **Phase 7.1** (Setup): 15 minutes
- **Phase 7.2** (LLM): 1 hour
- **Phase 7.3** (Observability): 30 minutes
- **Phase 7.4** (Messaging): 30 minutes
- **Phase 7.5** (Tools): 1.5 hours
- **Phase 7.6** (Agent Framework): 2 hours
- **Phase 7.7** (Graph Orchestration): 2 hours
- **Phase 7.8** (Tracing): 30 minutes
- **Phase 7.9** (MCP): 1 hour
- **Phase 7.10** (Cleanup): 1 hour
- **Phase 7.11** (Performance): 30 minutes
- **Phase 7.12** (Documentation): 30 minutes

**Total Estimated Time:** ~11.5 hours (can be done incrementally)

---

## Next Steps

1. Review and approve migration plan
2. Begin Phase 7.1 (Setup)
3. Proceed incrementally through each phase
4. Validate after each phase
5. Document any issues encountered
