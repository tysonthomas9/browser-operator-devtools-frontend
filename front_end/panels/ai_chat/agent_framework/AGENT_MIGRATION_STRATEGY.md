# Agent Framework Migration Strategy

## Current State

**AgentRunner (~800 lines):** Core agent execution loop
**ConfigurableAgentTool:** Agent-as-tool wrapper
**10+ Agent Implementations:** ResearchAgent, ActionAgent, WebTaskAgent, etc.

## SDK Equivalents

- `AgentRunner` → `SDK.Agent.createAgent()` + `SDK.Workflows`
- Agent execution loop → Workflow engine with tools
- Tool orchestration → Workflow steps with conditional branching
- Agent handoffs → Workflow composition

## Migration Complexity

**High Complexity Due To:**
1. **DevTools-Specific Dependencies:** CDP protocol, target management, DOM interaction
2. **Complex State Management:** Multi-step workflows with page state tracking
3. **Custom Tool System:** 24+ tools with DevTools-specific APIs
4. **Event System:** AgentRunnerEventBus for UI updates
5. **Tracing Integration:** Langfuse tracing hooks throughout

## Recommended Approach

### Option 1: Gradual Abstraction (Recommended)
**Keep AgentRunner, migrate internals incrementally:**
1. Replace LLM calls with SDK providers ✅ (Complete)
2. Wrap tools in SDK tool interface (partial migration)
3. Extract reusable patterns into SDK workflows
4. Maintain DevTools-specific orchestration layer

**Benefits:**
- Less risky, incremental changes
- Preserves existing functionality
- Allows testing at each step
- DevTools-specific code stays in DevTools

### Option 2: Full Rewrite (Future Work)
**Replace AgentRunner with SDK Agent + Workflows:**
1. Migrate all tools to SDK tool system
2. Convert agent implementations to SDK workflows
3. Replace execution loop with SDK workflow engine
4. Implement DevTools adapter layer

**Benefits:**
- Full code deduplication
- Leverage SDK workflow features (persistence, suspend/resume)
- Cleaner separation of concerns

**Challenges:**
- High effort (~2-3 weeks)
- Risk of breaking existing functionality
- Requires all 24+ tools migrated first

## Current Progress

✅ **Phase 1:** SDK integrated into DevTools
✅ **Phase 2:** LLM providers migrated to SDK
✅ **Phase 3:** Tool migration pattern documented
⏸️  **Phase 4:** Agent framework (deferred - use Option 1)

## Next Steps (Option 1)

1. ✅ LLM provider migration complete
2. 📋 Keep AgentRunner as-is (uses SDK providers internally)
3. 📋 Migrate individual tools to SDK over time (as needed)
4. 📋 Extract reusable workflow patterns to SDK
5. 📋 Future: Consider full migration when tools are ready

## Code Savings Estimate

**With Full Migration (Option 2):**
- AgentRunner: ~800 lines → ~200 lines (workflow definitions)
- Agent implementations: ~1,200 lines → ~400 lines (workflow configs)
- Tool boilerplate: ~1,000 lines → ~200 lines (Zod schemas)
- **Total: ~2,800 lines saved**

**With Gradual Approach (Option 1 - Current):**
- Provider duplication: ~730 lines ✅ (removed)
- Tool boilerplate: ~200 lines (when migrated)
- **Total: ~930 lines saved currently**

## Conclusion

**Current migration achieves primary goal:** Eliminate LLM provider duplication and establish SDK as canonical source.

**Agent framework migration is deferred** because:
1. AgentRunner works well with SDK providers
2. Tool migration requires significant effort
3. DevTools-specific functionality hard to abstract
4. Incremental approach is safer

**Future work:** Migrate tools and workflows as SDK patterns stabilize.
