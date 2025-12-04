// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Guardrails Module - Public API
 *
 * Provides a unified interface for:
 * - Policy-based tool evaluation
 * - Human-in-the-loop approval gating
 * - LLM-enhanced safety assessment
 */

// Types
export type {
  RiskLevel,
  DecisionType,
  ReasoningEffort,
  ToolCall,
  ToolApprovalConfig,
  ExecutionContext,
  GuardrailDecision,
  ApprovalRequest,
  ApprovalResult,
  GateResult,
  LLMConfig,
  GuardrailConfig,
  PolicyExample,
  Policy,
} from './types.js';

export {
  DEFAULT_GUARDRAIL_CONFIG,
  RISK_LEVEL_ORDER,
  isRiskAtOrAbove,
} from './types.js';

// Policy definitions
export { POLICIES, getPoliciesForTool, getPolicy } from './policies.js';

// Policy evaluator
export { PolicyEvaluator, compileGuardrailPrompt, hasGuardrailContent } from './PolicyEvaluator.js';

// Main middleware
export {
  GuardrailMiddleware,
  GuardrailEvents,
  getGuardrailMiddleware,
  resetGuardrailMiddleware,
} from './GuardrailMiddleware.js';

export type {
  ApprovalRequestedEvent,
  ApprovalResolvedEvent,
} from './GuardrailMiddleware.js';
