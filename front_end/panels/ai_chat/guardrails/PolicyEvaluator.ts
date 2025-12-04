// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * PolicyEvaluator - Consolidated policy evaluation engine.
 * Merges rule-based and LLM-based evaluation from GuardrailEvaluator.
 */

import { createLogger } from '../core/Logger.js';
import { LLMClient } from '../LLM/LLMClient.js';
import type {
  ToolCall,
  ExecutionContext,
  GuardrailDecision,
  GuardrailConfig,
  ToolApprovalConfig,
  RiskLevel,
  Policy,
} from './types.js';
import { DEFAULT_GUARDRAIL_CONFIG, RISK_LEVEL_ORDER } from './types.js';
import {
  POLICIES,
  getPoliciesForTool,
  evaluateNavigation,
  evaluateDataEntry,
  evaluateClick,
  evaluateScript,
} from './policies.js';

const logger = createLogger('PolicyEvaluator');

/**
 * PolicyEvaluator - Evaluates tool calls against policies
 */
export class PolicyEvaluator {
  private config: GuardrailConfig;
  private llmClient: LLMClient;

  constructor(config: Partial<GuardrailConfig> = {}) {
    this.config = { ...DEFAULT_GUARDRAIL_CONFIG, ...config };
    this.llmClient = LLMClient.getInstance();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('PolicyEvaluator config updated', { enabled: this.config.enabled });
  }

  /**
   * Get current configuration
   */
  getConfig(): GuardrailConfig {
    return { ...this.config };
  }

  /**
   * Get active policies
   */
  getActivePolicies(): Policy[] {
    return POLICIES;
  }

  /**
   * Main evaluation entry point
   */
  async evaluate(
    toolCall: ToolCall,
    context: ExecutionContext,
    toolApprovalConfig?: ToolApprovalConfig
  ): Promise<GuardrailDecision> {
    // Check if guardrails are disabled
    if (!this.config.enabled) {
      return this.createSafeDecision('Guardrails disabled');
    }

    // Check tool-level approval config first
    if (toolApprovalConfig?.requiresApproval) {
      const riskLevel = toolApprovalConfig.riskLevel || 'medium';
      const message = toolApprovalConfig.approvalMessage ||
        `The tool "${toolCall.name}" requires human approval by default.`;
      return this.createViolationDecision(
        riskLevel,
        'Tool requires approval by default',
        message,
        'tool_approval_config'
      );
    }

    // Check explicit allow list
    if (this.config.alwaysApprove.includes(toolCall.name)) {
      return this.createSafeDecision('Tool in allow list');
    }

    // Check explicit require list
    if (this.config.alwaysRequire.includes(toolCall.name)) {
      return this.createViolationDecision(
        'high',
        'Tool requires approval',
        `The tool "${toolCall.name}" is configured to always require human approval.`,
        'always_require_list'
      );
    }

    // Run rule-based evaluation (fast path)
    const ruleDecision = this.evaluateByRules(toolCall, context);

    // If definitive decision or LLM disabled, apply threshold and return
    if (ruleDecision.isDefinitive || !this.config.llm.enabled) {
      return this.applyThreshold(ruleDecision);
    }

    // For escalate cases, use LLM evaluation if enabled and configured
    if (this.config.llm.enabled && this.config.llm.apiKey && this.config.llm.provider) {
      try {
        const llmDecision = await this.evaluateWithLLM(toolCall, context);
        return this.applyThreshold(llmDecision);
      } catch (error) {
        logger.warn('LLM guardrail evaluation failed, falling back to rule-based', { error });
        return this.applyThreshold(ruleDecision);
      }
    }

    return this.applyThreshold(ruleDecision);
  }

  /**
   * Rule-based evaluation (fast path)
   */
  private evaluateByRules(toolCall: ToolCall, context: ExecutionContext): GuardrailDecision {
    const { name, args } = toolCall;

    // Navigation checks
    if (name === 'navigate_url' || name === 'navigate') {
      const url = (args.url as string) || '';
      return evaluateNavigation(url, context);
    }

    // Type/input checks
    if (name === 'type' || name === 'fill_form') {
      return evaluateDataEntry(args, context);
    }

    // Click checks
    if (name === 'click') {
      return evaluateClick(args);
    }

    // JavaScript execution
    if (name === 'execute_javascript' || name === 'evaluate') {
      return evaluateScript(args);
    }

    // Default: safe
    return this.createSafeDecision('Standard action - no specific risks identified');
  }

  /**
   * LLM-based evaluation for nuanced cases
   */
  private async evaluateWithLLM(
    toolCall: ToolCall,
    context: ExecutionContext
  ): Promise<GuardrailDecision> {
    const applicablePolicies = getPoliciesForTool(toolCall.name);
    const policyPrompt = this.buildPolicyPrompt(applicablePolicies);

    const prompt = `You are a safety guardrail evaluator for a browser automation agent. Use the provided policies to classify this action.

## POLICIES
${policyPrompt}

## ACTION TO EVALUATE
Tool: ${toolCall.name}
Arguments: ${JSON.stringify(toolCall.args, null, 2)}
Current URL: ${context.currentUrl || 'unknown'}
User's stated goal: ${context.userGoal || 'unknown'}

## INSTRUCTIONS
1. Identify which policy applies to this action
2. Reason through the policy criteria step by step
3. Classify as: safe (auto-approve), violation (require approval), or escalate (human judgment needed)

## OUTPUT FORMAT (JSON only, no markdown)
{
  "reasoning": "Step-by-step analysis of policy criteria...",
  "policyMatched": "policy_name",
  "decision": "safe|violation|escalate",
  "riskLevel": "none|low|medium|high|critical",
  "suggestedMessage": "Human-readable explanation for the user"
}`;

    // Reasoning effort controls response detail level
    // (maxTokens could be used with providers that support it)
    const _reasoningEffort = this.config.llm.reasoningEffort;

    const response = await this.llmClient.call({
      provider: this.config.llm.provider!,
      model: this.config.llm.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are a safety classifier. Respond only with valid JSON.',
      temperature: 0.1,
    });

    // Extract JSON from response
    const content = response.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse LLM response as JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      requiresApproval: parsed.decision !== 'safe',
      riskLevel: parsed.riskLevel || 'medium',
      decision: parsed.decision || 'escalate',
      reasoning: parsed.reasoning || 'LLM evaluation',
      policyMatched: parsed.policyMatched,
      suggestedMessage: parsed.suggestedMessage || 'Please review this action.',
      isDefinitive: true,
    };
  }

  /**
   * Build policy prompt for LLM evaluation
   */
  private buildPolicyPrompt(policies: Policy[]): string {
    return policies.map(p => `
### ${p.name}: ${p.description}
**Instructions**: ${p.instructions}
**Definitions**: ${Object.entries(p.definitions).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
**Violations (require approval)**:
${p.violations.map(v => `- ${v}`).join('\n')}
**Safe content (auto-approve)**:
${p.safeContent.map(s => `- ${s}`).join('\n')}
**Escalate to human**:
${p.escalateCriteria.map(e => `- ${e}`).join('\n')}
`).join('\n---\n');
  }

  /**
   * Apply threshold to decision
   */
  private applyThreshold(decision: GuardrailDecision): GuardrailDecision {
    const decisionRiskOrder = RISK_LEVEL_ORDER[decision.riskLevel];
    const thresholdOrder = RISK_LEVEL_ORDER[this.config.approvalThreshold];

    // If decision is below threshold and not a violation, don't require approval
    if (decisionRiskOrder < thresholdOrder && decision.decision !== 'violation') {
      return {
        ...decision,
        requiresApproval: false,
      };
    }

    return decision;
  }

  /**
   * Create a safe decision
   */
  private createSafeDecision(reasoning: string): GuardrailDecision {
    return {
      requiresApproval: false,
      riskLevel: 'none',
      decision: 'safe',
      reasoning,
      suggestedMessage: 'Action approved automatically.',
      isDefinitive: true,
    };
  }

  /**
   * Create a violation decision
   */
  private createViolationDecision(
    riskLevel: RiskLevel,
    reasoning: string,
    suggestedMessage: string,
    policyMatched?: string
  ): GuardrailDecision {
    return {
      requiresApproval: true,
      riskLevel,
      decision: 'violation',
      reasoning,
      policyMatched,
      suggestedMessage,
      isDefinitive: true,
    };
  }
}

// ============================================================================
// Prompt Compiler (merged from GuardrailPromptCompiler)
// ============================================================================

export interface ToolWithApprovalConfig {
  name: string;
  approvalConfig?: ToolApprovalConfig;
}

/**
 * Compile guardrail policies and tool approval requirements into a system prompt block.
 * This makes the LLM aware of constraints and helps it proactively avoid triggering approvals.
 */
export function compileGuardrailPrompt(
  activePolicies: Policy[] = POLICIES,
  tools: ToolWithApprovalConfig[] = []
): string {
  const sections: string[] = [];

  // Section 1: Tools requiring approval
  const approvalTools = tools.filter(t => t.approvalConfig?.requiresApproval);
  if (approvalTools.length > 0) {
    const toolList = approvalTools.map(t => {
      const message = t.approvalConfig?.approvalMessage || 'Requires approval';
      const risk = t.approvalConfig?.riskLevel || 'medium';
      return `- **${t.name}**: ${message} (Risk: ${risk})`;
    }).join('\n');

    sections.push(`## Tool Approval Requirements

The following tools require human approval before execution:
${toolList}

When using these tools, the user will be prompted to approve or reject the action. Consider alternatives if possible, or explain your reasoning clearly before invoking them.`);
  }

  // Section 2: Active policies (summarized for LLM awareness)
  if (activePolicies.length > 0) {
    const policySummaries = activePolicies.map(p => {
      const violations = p.violations.slice(0, 2).join('; ') || 'Various high-risk actions';
      const safe = p.safeContent.slice(0, 2).join('; ') || 'Standard actions';
      return `### ${p.name}
${p.description}
- **Actions that may require approval**: ${violations}
- **Safe actions**: ${safe}`;
    }).join('\n\n');

    sections.push(`## Safety Policies

The following safety policies are active and may trigger approval requests:

${policySummaries}`);
  }

  // Section 3: General guidance
  sections.push(`## Approval Guidance

To minimize approval interruptions and provide a smoother user experience:
1. Prefer actions within the current domain over external navigation
2. Avoid entering sensitive data (passwords, payment info) unless explicitly requested by the user
3. Use read-only operations when possible before requesting write operations
4. Explain your reasoning before taking high-risk actions so users understand the context
5. If an action requires approval, clearly state what you're about to do and why`);

  // Only return content if there's something meaningful
  if (sections.length === 1) {
    return '';
  }

  return sections.join('\n\n');
}

/**
 * Check if any guardrail content should be injected
 */
export function hasGuardrailContent(
  policies: Policy[] = POLICIES,
  tools: ToolWithApprovalConfig[] = []
): boolean {
  const hasApprovalTools = tools.some(t => t.approvalConfig?.requiresApproval);
  const hasPolicies = policies.length > 0;
  return hasApprovalTools || hasPolicies;
}
