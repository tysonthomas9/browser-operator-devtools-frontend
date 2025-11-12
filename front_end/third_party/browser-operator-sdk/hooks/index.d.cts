import { AgentHooks, AgentContext, ToolCall, AgentResult } from '../types/index.cjs';

/**
 * Agent hooks system for customization
 */

/**
 * Execute onStart hook
 */
declare function executeOnStart(hooks: AgentHooks | undefined, context: AgentContext): Promise<void>;
/**
 * Execute onIteration hook
 */
declare function executeOnIteration(hooks: AgentHooks | undefined, context: AgentContext, iteration: number): Promise<void>;
/**
 * Execute onToolCall hook
 */
declare function executeOnToolCall(hooks: AgentHooks | undefined, context: AgentContext, toolCall: ToolCall): Promise<void>;
/**
 * Execute onToolResult hook
 */
declare function executeOnToolResult(hooks: AgentHooks | undefined, context: AgentContext, result: unknown): Promise<void>;
/**
 * Execute onFinish hook
 */
declare function executeOnFinish(hooks: AgentHooks | undefined, context: AgentContext, result: AgentResult): Promise<void>;
/**
 * Execute onError hook
 */
declare function executeOnError(hooks: AgentHooks | undefined, context: AgentContext, error: Error): Promise<void>;
/**
 * Create default hooks
 */
declare function createDefaultHooks(): AgentHooks;
/**
 * Merge hooks
 */
declare function mergeHooks(base: AgentHooks, override: AgentHooks): AgentHooks;

export { createDefaultHooks, executeOnError, executeOnFinish, executeOnIteration, executeOnStart, executeOnToolCall, executeOnToolResult, mergeHooks };
