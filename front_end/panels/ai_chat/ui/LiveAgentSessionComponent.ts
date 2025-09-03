// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';
import type { AgentSession, AgentMessage } from '../agent_framework/AgentSessionTypes.js';
import { getAgentUIConfig } from '../agent_framework/AgentSessionTypes.js';
import { ToolCallComponent } from './ToolCallComponent.js';
import { AgentSessionHeaderComponent } from './AgentSessionHeaderComponent.js';
import { ToolDescriptionFormatter } from './ToolDescriptionFormatter.js';

const {Decorators} = Lit;
const {customElement} = Decorators;

@customElement('live-agent-session')
export class LiveAgentSessionComponent extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`live-agent-session`;
  private readonly shadow = this.attachShadow({mode: 'open'});
  
  private session: AgentSession | null = null;
  private headerComponent: AgentSessionHeaderComponent | null = null;
  private toolComponents = new Map<string, ToolCallComponent>();
  private childComponents = new Map<string, LiveAgentSessionComponent>();
  private isExpanded = false;

  connectedCallback(): void {
    this.render();
  }

  setSession(session: AgentSession): void {
    this.session = session;
    
    // Update header component
    if (!this.headerComponent) {
      this.headerComponent = new AgentSessionHeaderComponent();
      this.headerComponent.addEventListener('toggle-expanded', (e: Event) => {
        const customEvent = e as CustomEvent;
        this.isExpanded = customEvent.detail.isExpanded;
        this.render();
      });
    }
    
    this.headerComponent.setSession(session);
    this.render();
  }

  addToolCall(toolCall: AgentMessage): void {
    if (!this.session) return;
    
    // Store the tool call (no longer using separate components)
    this.toolComponents.set(toolCall.id, null as any);
    
    // Re-render to show the updated timeline
    this.render();
  }

  updateToolResult(toolResult: AgentMessage): void {
    if (!this.session) return;
    
    // Re-render to show the updated status
    this.render();
  }

  addChildSession(sessionId: string, childComponent: LiveAgentSessionComponent): void {
    this.childComponents.set(sessionId, childComponent);
    
    // Re-render to show nested sessions
    this.render();
  }

  private render(): void {
    if (!this.session) return;

    // Get agent UI configuration for proper display name
    const uiConfig = getAgentUIConfig(this.session.agentName, this.session.config);
    
    // Generate timeline items HTML
    const timelineItemsHtml = this.generateTimelineItemsHtml();
    const nestedSessionsHtml = this.generateNestedSessionsHtml();
    
    // Determine if this is a single tool execution
    const toolMessages = this.session.messages.filter(msg => msg.type === 'tool_call');
    const isSingleTool = toolMessages.length === 1;
    
    this.shadow.innerHTML = `
      <style>
        /* Import timeline styles from chatView.css */
        :host {
          --sys-color-surface-variant-rgb: 128, 128, 128;
        }
        .agent-execution-timeline {
          position: relative;
          margin: 16px 0;
          font-size: 13px;
          line-height: 1.4;
          padding: 0;
          padding-right: 20px;
        }
        
        .agent-session-container {
          position: relative;
        }
        
        .agent-header {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--sys-color-on-surface);
        }
        
        .agent-marker {
          flex-shrink: 0;
          width: auto;
          height: auto;
          margin-right: 8px;
          font-size: 14px;
          color: #00a4fe;
        }
        
        .agent-marker::before {
          content: '●';
        }
        
        .agent-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--sys-color-on-surface);
          margin-right: 8px;
          white-space: nowrap;
        }
        
        .agent-divider {
          flex: 1;
          height: 1px;
          background-color: var(--sys-color-divider);
          position: relative;
          top: 1px;
        }
        
        .tool-toggle {
          background: none;
          border: none;
          color: var(--sys-color-on-surface-variant);
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background-color 0.2s ease;
        }
        
        .tool-toggle:hover {
          background-color: var(--sys-color-state-hover-on-subtle);
        }
        
        .toggle-icon { font-size: 10px; }
        
        .timeline-items {
          position: relative;
          padding: 0;
          margin: 0;
          margin-left: 0;
        }
        
        .timeline-items::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 0;
          bottom: 0;
          width: 1px;
          background-color: var(--sys-color-divider);
          z-index: 1;
        }
        
        .agent-execution-timeline.single-tool .timeline-items::before {
          display: none;
        }
        
        .agent-execution-timeline.single-tool .timeline-vertical-connector::before {
          content: '│';
          color: var(--sys-color-divider);
        }
        
        .timeline-items:empty::after {
          content: 'No tools executed yet...';
          color: var(--sys-color-on-surface-variant);
          font-style: italic;
          font-size: 12px;
          display: block;
          text-align: center;
          padding: 20px;
        }
        
        .timeline-item {
          position: relative;
          display: block;
          margin: 2px 0;
          border-radius: 4px;
          background: rgba(var(--sys-color-surface-variant-rgb), 0.2);
          border: 1px solid transparent;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        
        .tool-line {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          font-size: 13px;
          line-height: 1.4;
          padding: 2px 4px;
          overflow: visible;
        }
        
        .timeline-item-line {
          position: relative;
          display: flex;
          align-items: center;
          z-index: 2;
          margin-left: 0;
        }
        
        .timeline-vertical-connector {
          flex-shrink: 0;
          width: 14px;
        }
        
        .tool-description-multiline {
          flex: 1;
          color: var(--sys-color-on-surface);
        }
        
        .tool-description-indicator {
          color: var(--sys-color-divider);
        }
        
        .tool-arg {
          display: flex;
          margin-bottom: 1px;
          padding-left: 16px;
        }
        
        .tool-arg-key {
          color: var(--sys-color-on-surface);
          font-weight: 500;
          flex-shrink: 0;
          margin-right: 8px;
        }
        
        .tool-arg-value {
          color: var(--sys-color-on-surface-variant);
          word-break: break-word;
        }
        
        .tool-status-marker {
          flex-shrink: 0;
          margin-left: 8px;
          font-size: 13px;
          z-index: 9999;
        }
        
        .tool-status-marker.completed { color: var(--sys-color-green-bright); }
        .tool-status-marker.error { color: var(--sys-color-error); }
        .tool-status-marker.running { color: var(--sys-color-on-surface-variant); }
        
        .tool-status-marker:hover {
          transform: scale(1.2);
        }
        
        .timeline-item:hover {
          background: rgba(var(--sys-color-surface-variant-rgb), 0.3);
          border-color: var(--sys-color-outline-variant);
          transform: translateX(2px);
        }
        
        .timeline-items:empty {
          min-height: 40px;
        }
        
        .nested-sessions {
          margin-left: 20px;
          border-left: 2px solid var(--sys-color-outline-variant);
          padding-left: 16px;
          margin-top: 12px;
        }
        
        .handoff-indicator {
          color: var(--sys-color-on-surface-variant);
          font-size: 12px;
          margin-bottom: 8px;
          font-weight: 500;
        }
        
        .handoff-arrow {
          margin-right: 6px;
          color: var(--sys-color-primary);
        }
        
        .message {
          margin-bottom: 8px;
          color: var(--sys-color-on-surface);
        }
      </style>
      <div class="agent-execution-timeline${isSingleTool ? ' single-tool' : ''}">
        ${this.session.agentReasoning ? `<div class="message">${this.session.agentReasoning}</div>` : ''}
        <div class="agent-session-container">
          <div class="agent-header">
            <div class="agent-marker"></div>
            <div class="agent-title">${uiConfig.displayName}</div>
            <div class="agent-divider"></div>
            <button class="tool-toggle">
              <span class="toggle-icon">${this.isExpanded ? '▲' : '▼'}</span>
            </button>
          </div>
          <div class="timeline-items" style="display: ${this.isExpanded ? 'block' : 'none'};">
            ${timelineItemsHtml}
          </div>
          <div class="nested-sessions" style="display: ${this.isExpanded ? 'block' : 'none'};">
            ${nestedSessionsHtml}
          </div>
        </div>
      </div>
    `;
    
    // Add event listener for the toggle button
    const toggleButton = this.shadow.querySelector('.tool-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.isExpanded = !this.isExpanded;
        this.render(); // Re-render with new state
      });
    }
  }

  private generateTimelineItemsHtml(): string {
    if (!this.session) return '';
    
    const toolMessages = this.session.messages.filter(msg => msg.type === 'tool_call');
    const toolResults = this.session.messages.filter(msg => msg.type === 'tool_result');
    
    let html = '';
    
    // Add agent query if present (matching ChatView)
    if (this.session.agentQuery) {
      html += `
        <div class="timeline-item">
          <div class="tool-line">
            <div class="tool-description-multiline">
              <span class="tool-description-indicator">─</span>
              <span style="margin-left: 4px;">${this.session.agentQuery}</span>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add tool execution items
    html += toolMessages.map(toolMsg => {
      const toolContent = toolMsg.content as any;
      const toolName = toolContent.toolName;
      const toolArgs = toolContent.toolArgs || {};
      
      // Find matching tool result
      const toolResult = toolResults.find(result => {
        const resultContent = result.content as any;
        return resultContent.toolCallId === toolContent.toolCallId;
      });
      
      const resultContent = toolResult?.content as any;
      const status = toolResult && resultContent ? (resultContent.success ? 'completed' : 'error') : 'running';
      
      const icon = ToolDescriptionFormatter.getToolIcon(toolName);
      const toolNameDisplay = ToolDescriptionFormatter.formatToolName(toolName);
      const descriptionData = ToolDescriptionFormatter.getToolDescription(toolName, toolArgs);
      
      if (descriptionData.isMultiLine && Array.isArray(descriptionData.content)) {
        // Multi-line format matching the expected HTML
        const argsHtml = descriptionData.content.map(arg => 
          `<div class="tool-arg">
            <span class="tool-arg-key">${arg.key}:</span>
            <span class="tool-arg-value">${arg.value}</span>
          </div>`
        ).join('');
        
        return `
          <div class="timeline-item">
            <div class="tool-line">
              <div class="tool-description-multiline" style="display: block;">
                <span class="tool-description-indicator">─</span>
                <span style="margin-left: 4px;">${icon}  ${toolNameDisplay}:</span>
                ${argsHtml}
              </div>
              <span class="tool-status-marker ${status}" title="${status === 'running' ? 'Running' : status === 'completed' ? 'Completed' : 'Error'}">●</span>
            </div>
          </div>
        `;
      } else {
        // Single-line format
        const content = typeof descriptionData.content === 'string' ? descriptionData.content : String(descriptionData.content);
        return `
          <div class="timeline-item">
            <div class="tool-line">
              <div class="tool-description-multiline">
                <span class="tool-description-indicator">─</span>
                <span style="margin-left: 4px;">${icon}  ${content}</span>
              </div>
              <span class="tool-status-marker ${status}" title="${status === 'running' ? 'Running' : status === 'completed' ? 'Completed' : 'Error'}">●</span>
            </div>
          </div>
        `;
      }
    }).join('');
    
    return html;
  }


  private generateNestedSessionsHtml(): string {
    if (!this.session?.nestedSessions || this.session.nestedSessions.length === 0) return '';
    
    return this.session.nestedSessions.map(nested => {
      const nestedUiConfig = getAgentUIConfig(nested.agentName, nested.config);
      
      // Create a new LiveAgentSessionComponent for the nested session
      const nestedComponent = new LiveAgentSessionComponent();
      nestedComponent.setSession(nested);
      
      return `
        <div class="handoff-indicator">
          <span class="handoff-arrow">↓</span>
          <span class="handoff-text">Handoff to ${nestedUiConfig.displayName}</span>
        </div>
        ${nestedComponent.shadow.innerHTML || ''}
      `;
    }).join('');
  }
}