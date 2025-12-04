// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * GuardrailMiddleware - Single entry point for guardrail evaluation and approval.
 * Merges evaluation and approval management into one clean interface.
 */

import * as Common from '../../../core/common/common.js';
import { createLogger } from '../core/Logger.js';
import { PolicyEvaluator } from './PolicyEvaluator.js';
import type {
  ToolCall,
  ExecutionContext,
  GuardrailConfig,
  GuardrailDecision,
  ApprovalRequest,
  ApprovalResult,
  GateResult,
  ToolApprovalConfig,
} from './types.js';
import { DEFAULT_GUARDRAIL_CONFIG } from './types.js';

const logger = createLogger('GuardrailMiddleware');

// ============================================================================
// Events
// ============================================================================

export enum GuardrailEvents {
  APPROVAL_REQUESTED = 'approval-requested',
  APPROVAL_RESOLVED = 'approval-resolved',
  APPROVAL_TIMEOUT = 'approval-timeout',
}

export interface ApprovalRequestedEvent {
  request: ApprovalRequest;
}

export interface ApprovalResolvedEvent {
  approvalId: string;
  result: ApprovalResult;
}

// ============================================================================
// Pending Approval State
// ============================================================================

interface PendingApproval {
  resolve: (result: ApprovalResult) => void;
  reject: (error: Error) => void;
  request: ApprovalRequest;
  timeoutId?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// GuardrailMiddleware
// ============================================================================

/**
 * GuardrailMiddleware - Single entry point for all guardrail operations.
 * Combines evaluation and approval gate into one async flow.
 */
export class GuardrailMiddleware extends Common.ObjectWrapper.ObjectWrapper<{
  [GuardrailEvents.APPROVAL_REQUESTED]: ApprovalRequestedEvent,
  [GuardrailEvents.APPROVAL_RESOLVED]: ApprovalResolvedEvent,
  [GuardrailEvents.APPROVAL_TIMEOUT]: { approvalId: string },
}> {
  private static instance: GuardrailMiddleware | null = null;

  private config: GuardrailConfig;
  private evaluator: PolicyEvaluator;
  private pendingApprovals = new Map<string, PendingApproval>();

  private constructor(config: Partial<GuardrailConfig> = {}) {
    super();
    this.config = { ...DEFAULT_GUARDRAIL_CONFIG, ...config };
    this.evaluator = new PolicyEvaluator(this.config);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GuardrailMiddleware {
    if (!GuardrailMiddleware.instance) {
      GuardrailMiddleware.instance = new GuardrailMiddleware();
    }
    return GuardrailMiddleware.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    if (GuardrailMiddleware.instance) {
      GuardrailMiddleware.instance.cancelAllPending();
    }
    GuardrailMiddleware.instance = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...config };
    this.evaluator.updateConfig(this.config);
    logger.info('GuardrailMiddleware config updated', { enabled: this.config.enabled });
  }

  /**
   * Get current configuration
   */
  getConfig(): GuardrailConfig {
    return { ...this.config };
  }

  /**
   * Get the policy evaluator (for prompt compilation)
   */
  getEvaluator(): PolicyEvaluator {
    return this.evaluator;
  }

  // ==========================================================================
  // Main Gate API
  // ==========================================================================

  /**
   * Main entry point - evaluate tool call and gate execution if needed.
   *
   * This is the single integration point that replaces both:
   * - AgentRunner guardrail check
   * - AgentNodes guardrail check
   *
   * @param toolCall - The tool call to evaluate
   * @param context - Execution context (current URL, domain, user goal)
   * @param onApprovalNeeded - Callback when approval is needed (for UI updates)
   * @param toolApprovalConfig - Tool-level approval configuration (optional)
   * @returns GateResult with proceed flag and optional feedback
   */
  async gate(
    toolCall: ToolCall,
    context: ExecutionContext,
    onApprovalNeeded?: (request: ApprovalRequest) => void,
    toolApprovalConfig?: ToolApprovalConfig
  ): Promise<GateResult> {
    // Step 1: Evaluate tool call against policies
    const decision = await this.evaluator.evaluate(toolCall, context, toolApprovalConfig);

    // Step 2: If safe, proceed immediately
    if (!decision.requiresApproval) {
      return { proceed: true, decision };
    }

    // Step 3: Create approval request
    const request = this.createApprovalRequest(toolCall, decision);

    // Step 4: Notify UI (if callback provided)
    if (onApprovalNeeded) {
      onApprovalNeeded(request);
    }

    // Step 5: Dispatch event for other listeners
    this.dispatchEventToListeners(GuardrailEvents.APPROVAL_REQUESTED, { request });

    // Step 6: Wait for user response
    const result = await this.waitForApproval(request.id);

    // Step 7: Return result with feedback for agent
    return {
      proceed: result.approved,
      feedback: result.feedback,
      decision,
    };
  }

  /**
   * Simplified gate that evaluates and returns decision without blocking for approval.
   * Useful for checking if a tool would require approval without actually waiting.
   */
  async evaluate(
    toolCall: ToolCall,
    context: ExecutionContext,
    toolApprovalConfig?: ToolApprovalConfig
  ): Promise<GuardrailDecision> {
    return this.evaluator.evaluate(toolCall, context, toolApprovalConfig);
  }

  // ==========================================================================
  // Approval Management
  // ==========================================================================

  /**
   * Wait for approval with timeout
   */
  private waitForApproval(approvalId: string): Promise<ApprovalResult> {
    return new Promise<ApprovalResult>((resolve, reject) => {
      const pending = this.pendingApprovals.get(approvalId);
      if (!pending) {
        // Approval was already resolved or doesn't exist
        reject(new Error(`Approval ${approvalId} not found`));
        return;
      }

      // Update resolve/reject functions
      pending.resolve = resolve;
      pending.reject = reject;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.handleTimeout(approvalId);
      }, this.config.approvalTimeoutMs);

      pending.timeoutId = timeoutId;
    });
  }

  /**
   * Create an approval request
   */
  private createApprovalRequest(toolCall: ToolCall, decision: GuardrailDecision): ApprovalRequest {
    const id = this.generateApprovalId();
    const request: ApprovalRequest = {
      id,
      toolCall,
      decision,
      status: 'pending',
      timestamp: Date.now(),
    };

    // Store pending approval (without resolve/reject yet - set in waitForApproval)
    this.pendingApprovals.set(id, {
      resolve: () => {},
      reject: () => {},
      request,
    });

    return request;
  }

  /**
   * Resolve an approval with user's decision.
   * Called by UI when user clicks approve/reject.
   */
  resolveApproval(approvalId: string, approved: boolean, feedback?: string): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      logger.warn('Approval not found', { approvalId });
      return;
    }

    // Clear timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Calculate response time
    const responseTimeMs = Date.now() - pending.request.timestamp;

    const result: ApprovalResult = {
      approved,
      feedback,
      responseTimeMs,
    };

    logger.info('Approval resolved', { approvalId, approved, responseTimeMs });

    // Update request status
    pending.request.status = approved ? 'approved' : 'rejected';
    pending.request.feedback = feedback;

    // Remove from pending
    this.pendingApprovals.delete(approvalId);

    // Resolve the promise
    pending.resolve(result);

    // Dispatch event
    this.dispatchEventToListeners(GuardrailEvents.APPROVAL_RESOLVED, {
      approvalId,
      result,
    });
  }

  /**
   * Approve an action
   */
  approve(approvalId: string): void {
    this.resolveApproval(approvalId, true);
  }

  /**
   * Reject an action with optional feedback
   */
  reject(approvalId: string, feedback?: string): void {
    this.resolveApproval(approvalId, false, feedback);
  }

  /**
   * Cancel a pending approval
   */
  cancelApproval(approvalId: string, reason?: string): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      return;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pendingApprovals.delete(approvalId);
    pending.reject(new Error(reason || 'Approval cancelled'));

    logger.info('Approval cancelled', { approvalId, reason });
  }

  /**
   * Cancel all pending approvals
   */
  cancelAllPending(): void {
    for (const approvalId of this.pendingApprovals.keys()) {
      this.cancelApproval(approvalId, 'All approvals cancelled');
    }
  }

  /**
   * Handle timeout
   */
  private handleTimeout(approvalId: string): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      return;
    }

    logger.warn('Approval timed out', { approvalId, toolName: pending.request.toolCall.name });

    // Update request status
    pending.request.status = 'rejected';

    // Remove from pending
    this.pendingApprovals.delete(approvalId);

    // Reject with timeout error
    pending.reject(new Error('Approval request timed out'));

    // Dispatch timeout event
    this.dispatchEventToListeners(GuardrailEvents.APPROVAL_TIMEOUT, { approvalId });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if an approval is pending
   */
  hasPendingApproval(approvalId: string): boolean {
    return this.pendingApprovals.has(approvalId);
  }

  /**
   * Get pending approval details
   */
  getPendingApproval(approvalId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(approvalId)?.request;
  }

  /**
   * Get all pending approval IDs
   */
  getPendingApprovalIds(): string[] {
    return Array.from(this.pendingApprovals.keys());
  }

  /**
   * Get count of pending approvals
   */
  getPendingCount(): number {
    return this.pendingApprovals.size;
  }

  /**
   * Generate a unique approval ID
   */
  private generateApprovalId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate approval ID (static method for external use)
   */
  static generateApprovalId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Get the singleton GuardrailMiddleware instance
 */
export function getGuardrailMiddleware(): GuardrailMiddleware {
  return GuardrailMiddleware.getInstance();
}

/**
 * Reset the singleton (for testing)
 */
export function resetGuardrailMiddleware(): void {
  GuardrailMiddleware.resetInstance();
}
