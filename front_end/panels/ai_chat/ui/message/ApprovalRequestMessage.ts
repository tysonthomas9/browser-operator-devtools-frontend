// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * ApprovalRequestMessage - Inline UI component for human-in-the-loop approval requests
 *
 * Uses the same styling as agent-execution-timeline:
 * - .timeline-item, .tool-line, .tool-left, .tool-name-badge, .tool-status-marker
 * - ● bullet markers for status (pending=orange, approved=green, rejected=red)
 * - Compact layout matching tool execution entries
 */

import * as Lit from '../../../../ui/lit/lit.js';
import type { ApprovalRequestMessage as ApprovalRequestMessageType, RiskLevel } from '../../models/ChatTypes.js';
import { getGuardrailMiddleware } from '../../guardrails/index.js';

const {html, nothing} = Lit;

/**
 * Get CSS class for risk level badge
 */
function getRiskLevelClass(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'none':
      return 'risk-none';
    case 'low':
      return 'risk-low';
    case 'medium':
      return 'risk-medium';
    case 'high':
      return 'risk-high';
    case 'critical':
      return 'risk-critical';
    default:
      return 'risk-medium';
  }
}

/**
 * Get human-readable risk level label (short form)
 */
function getRiskLevelLabel(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'none':
      return 'Safe';
    case 'low':
      return 'Low';
    case 'medium':
      return 'Med';
    case 'high':
      return 'High';
    case 'critical':
      return 'Crit';
    default:
      return '?';
  }
}

/**
 * Render an approval request message (timeline style)
 */
export function renderApprovalRequestMessage(
  msg: ApprovalRequestMessageType,
  onApprove?: (approvalId: string) => void,
  onReject?: (approvalId: string, feedback?: string) => void
): Lit.TemplateResult {
  const isPending = msg.status === 'pending';
  const isApproved = msg.status === 'approved';
  const isRejected = msg.status === 'rejected';

  // Handle approve click
  const handleApprove = () => {
    if (onApprove) {
      onApprove(msg.approvalId);
    } else {
      getGuardrailMiddleware().approve(msg.approvalId);
    }
  };

  // Handle reject click
  const handleReject = () => {
    if (onReject) {
      onReject(msg.approvalId);
    } else {
      getGuardrailMiddleware().reject(msg.approvalId);
    }
  };

  // Handle reject with feedback
  const handleRejectWithFeedback = (e: Event) => {
    const container = (e.target as HTMLElement).closest('.timeline-item');
    const textarea = container?.querySelector('.feedback-textarea') as HTMLTextAreaElement;
    const feedback = textarea?.value || '';

    if (onReject) {
      onReject(msg.approvalId, feedback);
    } else {
      getGuardrailMiddleware().reject(msg.approvalId, feedback);
    }
  };

  // Toggle feedback section visibility
  const toggleFeedback = (e: Event) => {
    const container = (e.target as HTMLElement).closest('.timeline-item');
    const feedbackSection = container?.querySelector('.feedback-section') as HTMLElement;
    if (feedbackSection) {
      feedbackSection.style.display = feedbackSection.style.display === 'none' ? 'block' : 'none';
    }
  };

  return html`
    <style>
      /* Timeline item - matches agent-execution-timeline exactly */
      .timeline-item {
        position: relative;
        display: block;
        margin: 2px 0;
        border-radius: 4px;
      }

      .tool-line {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        font-size: 13px;
        line-height: 1.4;
        padding: 2px 4px;
        position: relative;
      }

      .tool-left {
        flex: 1;
        color: var(--sys-color-on-surface);
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
      }

      /* Reasoning/title with ─ prefix */
      .tool-reasoning-inline {
        color: var(--sys-color-on-surface-variant);
        font-size: 12px;
        padding-left: 4px;
      }

      .tool-reasoning-inline::before {
        content: '─';
        color: var(--sys-color-divider);
        margin-right: 4px;
      }

      /* Tool name badge - pill style */
      .tool-name-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 8px;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 11px;
        background: var(--sys-color-surface-variant);
        color: var(--sys-color-on-surface-variant);
      }

      /* Risk level badge inside tool name */
      .risk-badge {
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .risk-none { background: #e8f5e9; color: #2e7d32; }
      .risk-low { background: #e3f2fd; color: #1565c0; }
      .risk-medium { background: #fff3e0; color: #e65100; }
      .risk-high { background: #ffebee; color: #c62828; }
      .risk-critical { background: #f3e5f5; color: #6a1b9a; }

      /* Status marker - colored bullet on right */
      .tool-status-marker {
        flex-shrink: 0;
        margin-left: 8px;
        font-size: 13px;
      }

      .tool-status-marker.pending { color: #f5a623; }
      .tool-status-marker.approved { color: var(--sys-color-green-bright); }
      .tool-status-marker.rejected { color: var(--sys-color-error); }

      /* Pending animation */
      .tool-status-marker.pending {
        animation: dotPulse 1.5s ease-in-out infinite;
      }

      @keyframes dotPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      /* Approval details section */
      .approval-details {
        margin-top: 4px;
        padding-left: 16px;
      }

      .approval-description {
        color: var(--sys-color-on-surface-variant);
        font-size: 12px;
        margin-bottom: 4px;
      }

      /* Tool info - minimal */
      .approval-tool-info {
        margin: 4px 0;
        padding: 4px 6px;
        background: var(--sys-color-surface);
        border-radius: 4px;
        border: 1px solid var(--sys-color-divider);
      }

      .tool-args {
        font-family: var(--monospace-font-family);
        font-size: 10px;
        max-height: 60px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-all;
        color: var(--sys-color-on-surface-variant);
        margin: 0;
      }

      /* Compact action buttons */
      .approval-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
        align-items: center;
      }

      .approve-btn, .reject-btn {
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .approve-btn {
        background: var(--sys-color-green-bright);
        color: white;
        border: none;
      }

      .approve-btn:hover {
        filter: brightness(0.9);
      }

      .reject-btn {
        background: transparent;
        color: var(--sys-color-error);
        border: 1px solid var(--sys-color-error);
      }

      .reject-btn:hover {
        background: var(--sys-color-error);
        color: white;
      }

      .feedback-toggle-btn {
        background: transparent;
        color: var(--sys-color-on-surface-variant);
        border: none;
        font-size: 10px;
        cursor: pointer;
        padding: 3px 6px;
      }

      .feedback-toggle-btn:hover {
        text-decoration: underline;
      }

      /* Feedback section */
      .feedback-section {
        display: none;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid var(--sys-color-divider);
      }

      .feedback-textarea {
        width: 100%;
        min-height: 40px;
        padding: 4px 6px;
        border: 1px solid var(--sys-color-divider);
        border-radius: 4px;
        font-family: inherit;
        font-size: 11px;
        resize: vertical;
        margin-bottom: 4px;
        background: var(--sys-color-surface);
        color: var(--sys-color-on-surface);
      }

      .feedback-textarea:focus {
        outline: none;
        border-color: var(--sys-color-primary);
      }

      /* Feedback display in resolved state */
      .feedback-display {
        margin-top: 2px;
        padding-left: 16px;
        font-size: 11px;
        font-style: italic;
        color: var(--sys-color-on-surface-variant);
      }
    </style>

    <div class="timeline-item">
      <div class="tool-line">
        <div class="tool-left">
          <span class="tool-reasoning-inline">
            ${isPending ? 'Approval Required' : isApproved ? 'Approved' : 'Rejected'}
          </span>
          <span class="tool-name-badge">
            ${isPending ? html`<span class="risk-badge ${getRiskLevelClass(msg.riskLevel)}">${getRiskLevelLabel(msg.riskLevel)}</span>` : nothing}
            ${msg.toolName}
          </span>
        </div>
        <span class="tool-status-marker ${msg.status}">●</span>
      </div>

      ${isPending ? html`
        <div class="approval-details">
          <div class="approval-description">${msg.description}</div>

          <div class="approval-tool-info">
            <pre class="tool-args">${JSON.stringify(msg.toolArgs, null, 2)}</pre>
          </div>

          <div class="approval-actions">
            <button class="approve-btn" @click=${handleApprove}>Approve</button>
            <button class="reject-btn" @click=${handleReject}>Reject</button>
            <button class="feedback-toggle-btn" @click=${toggleFeedback}>+ feedback</button>
          </div>

          <div class="feedback-section">
            <textarea
              class="feedback-textarea"
              placeholder="Help the agent try a different approach..."
            ></textarea>
            <button class="reject-btn" @click=${handleRejectWithFeedback}>
              Reject with Feedback
            </button>
          </div>
        </div>
      ` : nothing}

      ${isRejected && msg.feedback ? html`
        <div class="feedback-display">${msg.feedback}</div>
      ` : nothing}
    </div>
  `;
}
