// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Unified types for the guardrail system.
 * Single source of truth - replaces fragmented types across multiple files.
 */

import type { LLMProvider } from '../LLM/LLMTypes.js';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Risk levels from lowest to highest
 */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Decision types following GPT-OSS Safeguard patterns
 */
export type DecisionType = 'safe' | 'violation' | 'escalate';

/**
 * Reasoning effort levels - controls LLM token budget and depth
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

// ============================================================================
// Tool Call Types
// ============================================================================

/**
 * Unified tool call representation
 */
export interface ToolCall {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Unique call ID */
  callId: string;
}

/**
 * Tool-level approval configuration (from tool definitions)
 */
export interface ToolApprovalConfig {
  /** Whether this tool always requires approval */
  requiresApproval?: boolean;
  /** Default risk level for this tool */
  riskLevel?: RiskLevel;
  /** Custom approval message */
  approvalMessage?: string;
}

// ============================================================================
// Execution Context
// ============================================================================

/**
 * Context provided during evaluation - always complete, no undefined values
 */
export interface ExecutionContext {
  /** Current page URL (required) */
  currentUrl: string;
  /** Current page domain (extracted from URL) */
  currentDomain: string;
  /** User's stated goal/task (optional) */
  userGoal?: string;
  /** Previous actions in this session */
  recentActions?: string[];
}

// ============================================================================
// Guardrail Decision
// ============================================================================

/**
 * Result of guardrail evaluation
 */
export interface GuardrailDecision {
  /** Whether human approval is required */
  requiresApproval: boolean;
  /** Risk level assessment */
  riskLevel: RiskLevel;
  /** Decision type */
  decision: DecisionType;
  /** Chain-of-thought reasoning (transparent audit trail) */
  reasoning: string;
  /** Which policy triggered this decision */
  policyMatched?: string;
  /** Human-readable message for the approval UI */
  suggestedMessage: string;
  /** Whether this is a definitive decision (no need for LLM escalation) */
  isDefinitive?: boolean;
}

// ============================================================================
// Approval Types
// ============================================================================

/**
 * Unified approval request (replaces dual message types)
 */
export interface ApprovalRequest {
  /** Unique approval ID */
  id: string;
  /** The tool call that requires approval */
  toolCall: ToolCall;
  /** Guardrail decision details */
  decision: GuardrailDecision;
  /** Current status */
  status: 'pending' | 'approved' | 'rejected';
  /** User feedback (especially on rejection) */
  feedback?: string;
  /** When the request was created */
  timestamp: number;
}

/**
 * Result of an approval decision
 */
export interface ApprovalResult {
  /** Whether the action was approved */
  approved: boolean;
  /** Optional feedback from user (especially on rejection) */
  feedback?: string;
  /** Time taken for user to respond (ms) */
  responseTimeMs?: number;
}

/**
 * Result of the guardrail gate
 */
export interface GateResult {
  /** Whether to proceed with tool execution */
  proceed: boolean;
  /** User feedback if rejected (passed to agent) */
  feedback?: string;
  /** The guardrail decision that was made */
  decision?: GuardrailDecision;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * LLM configuration for guardrail evaluation
 */
export interface LLMConfig {
  /** Enable LLM-based evaluation for nuanced decisions */
  enabled: boolean;
  /** LLM provider to use */
  provider?: LLMProvider;
  /** Model to use (defaults to gpt-4o-mini) */
  model?: string;
  /** API key for LLM calls */
  apiKey?: string;
  /** Reasoning effort level */
  reasoningEffort: ReasoningEffort;
}

/**
 * Main guardrail configuration
 */
export interface GuardrailConfig {
  /** Enable guardrail evaluation */
  enabled: boolean;
  /** Approval threshold - require approval for this risk level and above */
  approvalThreshold: RiskLevel;
  /** Tools that never require approval (bypass guardrails) */
  alwaysApprove: string[];
  /** Tools that always require approval */
  alwaysRequire: string[];
  /** LLM evaluation settings */
  llm: LLMConfig;
  /** Default timeout for approvals in ms */
  approvalTimeoutMs: number;
}

/**
 * Default configuration
 */
export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  enabled: true,
  approvalThreshold: 'medium',
  alwaysApprove: [
    'get_page_content',
    'get_element_info',
    'get_accessibility_tree',
    'wait',
    'screenshot',
  ],
  alwaysRequire: [],
  llm: {
    enabled: false,
    reasoningEffort: 'medium',
  },
  approvalTimeoutMs: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Policy example for training the LLM guardrail
 */
export interface PolicyExample {
  input: {
    toolName: string;
    args: Record<string, unknown>;
    context?: string;
  };
  decision: DecisionType;
  reasoning: string;
}

/**
 * A guardrail policy definition
 */
export interface Policy {
  /** Unique identifier for the policy */
  name: string;
  /** Human-readable description */
  description: string;
  /** Instructions for evaluating this policy */
  instructions: string;
  /** Key terms and their definitions */
  definitions: Record<string, string>;
  /** Criteria that trigger approval requirement */
  violations: string[];
  /** Criteria that allow auto-approval */
  safeContent: string[];
  /** Ambiguous cases requiring human judgment */
  escalateCriteria: string[];
  /** Few-shot examples for LLM evaluation */
  examples: PolicyExample[];
  /** Tools this policy applies to (empty = all tools) */
  applicableTools?: string[];
}

// ============================================================================
// Risk Level Utilities
// ============================================================================

/**
 * Risk level ordering for comparison
 */
export const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  'none': 0,
  'low': 1,
  'medium': 2,
  'high': 3,
  'critical': 4,
};

/**
 * Compare risk levels
 */
export function isRiskAtOrAbove(level: RiskLevel, threshold: RiskLevel): boolean {
  return RISK_LEVEL_ORDER[level] >= RISK_LEVEL_ORDER[threshold];
}
