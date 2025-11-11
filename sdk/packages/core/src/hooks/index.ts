/**
 * Agent hooks system for customization
 */

import type { AgentContext, AgentHooks, AgentResult, ToolCall } from '../types/index.js';

/**
 * Execute onStart hook
 */
export async function executeOnStart(
  hooks: AgentHooks | undefined,
  context: AgentContext
): Promise<void> {
  if (hooks?.onStart) {
    await hooks.onStart(context);
  }
}

/**
 * Execute onIteration hook
 */
export async function executeOnIteration(
  hooks: AgentHooks | undefined,
  context: AgentContext,
  iteration: number
): Promise<void> {
  if (hooks?.onIteration) {
    await hooks.onIteration(context, iteration);
  }
}

/**
 * Execute onToolCall hook
 */
export async function executeOnToolCall(
  hooks: AgentHooks | undefined,
  context: AgentContext,
  toolCall: ToolCall
): Promise<void> {
  if (hooks?.onToolCall) {
    await hooks.onToolCall(context, toolCall);
  }
}

/**
 * Execute onToolResult hook
 */
export async function executeOnToolResult(
  hooks: AgentHooks | undefined,
  context: AgentContext,
  result: unknown
): Promise<void> {
  if (hooks?.onToolResult) {
    await hooks.onToolResult(context, result);
  }
}

/**
 * Execute onFinish hook
 */
export async function executeOnFinish(
  hooks: AgentHooks | undefined,
  context: AgentContext,
  result: AgentResult
): Promise<void> {
  if (hooks?.onFinish) {
    await hooks.onFinish(context, result);
  }
}

/**
 * Execute onError hook
 */
export async function executeOnError(
  hooks: AgentHooks | undefined,
  context: AgentContext,
  error: Error
): Promise<void> {
  if (hooks?.onError) {
    await hooks.onError(context, error);
  }
}

/**
 * Create default hooks
 */
export function createDefaultHooks(): AgentHooks {
  return {
    onStart: async () => {},
    onIteration: async () => {},
    onToolCall: async () => {},
    onToolResult: async () => {},
    onFinish: async () => {},
    onError: async () => {},
  };
}

/**
 * Merge hooks
 */
export function mergeHooks(base: AgentHooks, override: AgentHooks): AgentHooks {
  return {
    onStart: override.onStart || base.onStart,
    onIteration: override.onIteration || base.onIteration,
    onToolCall: override.onToolCall || base.onToolCall,
    onToolResult: override.onToolResult || base.onToolResult,
    onFinish: override.onFinish || base.onFinish,
    onError: override.onError || base.onError,
  };
}
