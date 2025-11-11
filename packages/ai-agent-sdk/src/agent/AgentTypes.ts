// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { ChatMessage } from '../messaging/ChatMessage.js';
import type { AgentSession } from '../messaging/AgentSession.js';
import type { LLMProvider } from '../llm/LLMTypes.js';

/**
 * Sentinel model identifiers used in agent configurations
 */
export const MODEL_SENTINELS = {
  USE_MINI: 'use-mini',
  USE_NANO: 'use-nano',
} as const;

/**
 * Defines the possible reasons an agent run might terminate.
 */
export type AgentRunTerminationReason = 'final_answer' | 'max_iterations' | 'error' | 'custom_exit' | 'handed_off';

/**
 * Defines the possible triggers for a handoff.
 */
export type HandoffTrigger = 'llm_tool_call' | 'max_iterations';

/**
 * Configuration for a specific handoff target.
 */
export interface HandoffConfig {
  /**
   * The registered name of the agent to hand off to.
   */
  targetAgentName: string;

  /**
   * The condition that triggers this handoff. Defaults to 'llm_tool_call'.
   */
  trigger?: HandoffTrigger;

  /**
   * Optional array of tool names. If specified, only the results from these tools
   * in the sending agent's history will be collected and potentially passed to the
   * target agent as handoff messages.
   */
  includeToolResults?: string[];
}

/**
 * UI display configuration for an agent
 */
export interface AgentUIConfig {
  /**
   * Display name for the agent (human-readable)
   */
  displayName?: string;

  /**
   * Avatar/icon for the agent (emoji or icon class)
   */
  avatar?: string;

  /**
   * Primary color for the agent (hex code)
   */
  color?: string;

  /**
   * Background color for the agent (hex code)
   */
  backgroundColor?: string;
}

/**
 * Context passed along with agent/tool calls
 */
export interface CallContext {
  apiKey?: string;
  provider?: LLMProvider;
  model?: string;
  miniModel?: string;
  nanoModel?: string;
  mainModel?: string;
  getVisionCapability?: (modelName: string) => Promise<boolean> | boolean;
  overrideSessionId?: string;
  overrideParentSessionId?: string;
  abortSignal?: AbortSignal;
}

/**
 * JSON configuration for an agent tool
 */
export interface AgentToolConfig {
  /**
   * Name of the agent tool
   */
  name: string;

  /**
   * Description of the agent tool
   */
  description: string;

  /**
   * System prompt for the agent
   */
  systemPrompt: string;

  /**
   * Tool names to make available to the agent
   */
  tools: string[];

  /**
   * Semantic version identifier for this agent configuration
   */
  version?: string;

  /**
   * Defines potential handoffs to other agents.
   * Handoffs triggered by 'llm_tool_call' are presented as tools to the LLM.
   * Handoffs triggered by 'max_iterations' are executed automatically if the agent hits the limit.
   */
  handoffs?: HandoffConfig[];

  /**
   * Maximum iterations for the agent loop
   */
  maxIterations?: number;

  /**
   * Model name to use for the agent. Can be a string or a function that returns a string.
   */
  modelName?: string | (() => string);

  /**
   * Temperature for the agent
   */
  temperature?: number;

  /**
   * Schema for the agent tool arguments
   */
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };

  /**
   * UI display configuration for the agent
   */
  ui?: AgentUIConfig;

  /**
   * Custom initialization function name
   */
  init?: (agent: any) => void;

  /**
   * Custom message preparation function name
   */
  prepareMessages?: (args: ConfigurableAgentArgs, config: AgentToolConfig) => ChatMessage[];

  /**
   * Custom success result creation function name
   */
  createSuccessResult?: (
    output: string,
    intermediateSteps: ChatMessage[],
    reason: AgentRunTerminationReason,
    config: AgentToolConfig
  ) => ConfigurableAgentResult;

  /**
   * Custom error result creation function name
   */
  createErrorResult?: (
    error: string,
    intermediateSteps: ChatMessage[],
    reason: AgentRunTerminationReason,
    config: AgentToolConfig
  ) => ConfigurableAgentResult;

  /**
   * If true, the agent WILL include intermediateSteps in its final returned result
   * (both success and error results). Defaults to false (steps are omitted).
   */
  includeIntermediateStepsOnReturn?: boolean;

  /**
   * If true, generate a summary of the agent's execution and append it to the final answer.
   * Summary includes: user request, agent decisions, and final outcome.
   * Defaults to false (no summary generated).
   * Use this for agents where understanding the execution process is valuable (e.g., web automation agents).
   */
  includeSummaryInAnswer?: boolean;

  /**
   * Optional lifecycle hook that runs before the agent starts executing.
   * Use this for agent-specific pre-execution logic such as environment setup,
   * page navigation, or prerequisite checks.
   *
   * @param callCtx - The call context containing API keys, models, and other execution context
   * @returns Promise that resolves when pre-execution is complete
   */
  beforeExecute?: (callCtx: CallContext) => Promise<void>;

  /**
   * Optional lifecycle hook that runs after the agent completes execution.
   * Use this for agent-specific post-execution logic such as saving results,
   * cleanup operations, or data aggregation.
   *
   * @param result - The final agent execution result (success or error)
   * @param agentSession - The complete agent session with all messages and tool calls
   * @param callCtx - The call context containing API keys, models, and other execution context
   * @returns Promise that resolves when post-execution is complete
   */
  afterExecute?: (result: ConfigurableAgentResult, agentSession: AgentSession, callCtx: CallContext) => Promise<void>;
}

/**
 * Arguments for the ConfigurableAgentTool
 */
export interface ConfigurableAgentArgs extends Record<string, unknown> {
  /**
   * Original query or input
   */
  query: string;

  /**
   * Reasoning for invocation
   */
  reasoning: string;

  /**
   * Additional arguments based on schema
   */
  [key: string]: unknown;
}

/**
 * Result from the ConfigurableAgentTool
 */
export interface ConfigurableAgentResult {
  /**
   * Whether the execution was successful
   */
  success: boolean;

  /**
   * Final output if successful
   */
  output?: string;

  /**
   * Error message if unsuccessful
   */
  error?: string;

  /**
   * Intermediate steps for debugging
   */
  intermediateSteps?: ChatMessage[];

  /**
   * Termination reason for the agent run
   */
  terminationReason: AgentRunTerminationReason;

  /**
   * Structured summary of agent execution
   */
  summary?: {
    /**
     * Type of completion
     */
    type: 'completion' | 'error' | 'timeout';

    /**
     * Formatted summary text
     */
    content: string;
  };
}
