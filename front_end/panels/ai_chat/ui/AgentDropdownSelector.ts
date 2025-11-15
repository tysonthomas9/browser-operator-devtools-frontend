// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';
import type { AgentConfig } from '../core/BaseOrchestratorAgent.js';

const {html, nothing, Decorators} = Lit;
const {customElement, property, state} = Decorators;

export interface AgentDropdownSelectorOptions {
  selectedAgentType: string | null;
  agentConfigs: {[key: string]: AgentConfig};
  onAgentSelect: (agentType: string) => void;
  onAddAgent?: () => void;
  onDeleteAgent?: (agentType: string) => void;
  onEditAgent?: (agentType: string) => void;
  showLabels?: boolean;
}

@customElement('agent-dropdown-selector')
export class AgentDropdownSelector extends Lit.LitElement {
  @property({type: String}) selectedAgentType: string | null = null;
  @property({type: Object}) agentConfigs: {[key: string]: AgentConfig} = {};
  @property({type: Boolean}) showLabels = false;
  @state() private isOpen = false;

  // Callback properties
  onAgentSelect?: (agentType: string) => void;
  onAddAgent?: () => void;
  onDeleteAgent?: (agentType: string) => void;
  onEditAgent?: (agentType: string) => void;

  override render(): Lit.TemplateResult {
    const { selectedAgentType, agentConfigs, showLabels } = this;

    // Get all agents as an array
    const allAgents = Object.values(agentConfigs);

    // First 2 agents shown as buttons
    const firstTwoAgents = allAgents.slice(0, 2);

    // Remaining agents shown in dropdown (if more than 2)
    const remainingAgents = allAgents.length > 2 ? allAgents.slice(2) : [];

    // Find selected agent from remaining agents
    const selectedFromRemaining = remainingAgents.find(config =>
      config.type === selectedAgentType
    );

    return html`
      <div class="agent-dropdown-selector">
        <div class="agent-buttons-row">
          <!-- First 2 agents as buttons -->
          ${firstTwoAgents.map(config => this.renderAgentButton(config, selectedAgentType, showLabels))}

          <!-- Dropdown for remaining agents (if > 2) -->
          ${remainingAgents.length > 0 ? this.renderDropdownSelector(remainingAgents, selectedFromRemaining, showLabels) : nothing}

          <!-- Add button -->
          ${this.onAddAgent ? html`
            <button
              class="agent-icon-button"
              @click=${() => this.onAddAgent?.()}
              title="Add new agent"
              aria-label="Add new agent"
            >
              <span class="icon-text">+</span>
            </button>
          ` : nothing}

          <!-- Edit button -->
          ${this.onEditAgent ? html`
            <button
              class="agent-icon-button"
              @click=${() => {
                if (this.selectedAgentType) {
                  this.onEditAgent?.(this.selectedAgentType);
                }
              }}
              title="Edit current agent"
              aria-label="Edit current agent"
              ?disabled=${!this.selectedAgentType}
            >
              <span class="icon-text">✏️</span>
            </button>
          ` : nothing}
        </div>
      </div>
    `;
  }

  private renderAgentButton(
    config: AgentConfig,
    selectedAgentType: string | null,
    showLabels: boolean
  ): Lit.TemplateResult {
    const isSelected = selectedAgentType === config.type;
    const isCustomized = this.hasCustomPrompt(config.type);

    const buttonClasses = [
      'agent-button',
      isSelected ? 'selected' : '',
      isCustomized ? 'customized' : ''
    ].filter(Boolean).join(' ');

    const title = isCustomized ?
      `${config.description || config.label} (Customized)` :
      (config.description || config.label);

    return html`
      <button
        class=${buttonClasses}
        data-agent-type=${config.type}
        @click=${() => this.handleAgentSelect(config.type)}
        title=${title}
      >
        ${showLabels ? html`<span class="agent-button-text">${config.label}</span>` : html`<span class="agent-button-icon">${config.icon}</span>`}
        ${isCustomized ? html`<span class="agent-custom-indicator">●</span>` : nothing}
      </button>
    `;
  }

  private renderDropdownSelector(
    remainingAgents: AgentConfig[],
    selectedAgent: AgentConfig | undefined,
    showLabels: boolean
  ): Lit.TemplateResult {
    const dropdownText = selectedAgent ? selectedAgent.label : 'More...';

    const isSelected = Boolean(selectedAgent);
    const dropdownClasses = [
      'agent-dropdown-trigger',
      isSelected ? 'selected' : '',
      this.isOpen ? 'open' : ''
    ].filter(Boolean).join(' ');

    return html`
      <div class="dropdown-container">
        <button
          class=${dropdownClasses}
          @click=${this.toggleDropdown}
          @keydown=${this.handleDropdownKeydown}
          title="More agents"
          aria-haspopup="true"
          aria-expanded=${this.isOpen}
        >
          <span class="dropdown-text">${dropdownText}</span>
          <span class="dropdown-arrow ${this.isOpen ? 'open' : ''}">▼</span>
        </button>

        ${this.isOpen ? html`
          <div class="dropdown-menu" @click=${this.handleDropdownItemClick}>
            ${remainingAgents.map(config => this.renderDropdownItem(config))}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderDropdownItem(config: AgentConfig): Lit.TemplateResult {
    const isSelected = this.selectedAgentType === config.type;
    const isCustomized = this.hasCustomPrompt(config.type);

    const itemClasses = [
      'dropdown-item',
      isSelected ? 'selected' : '',
      isCustomized ? 'customized' : ''
    ].filter(Boolean).join(' ');

    return html`
      <button
        class=${itemClasses}
        data-agent-type=${config.type}
        data-action="select"
        title=${config.description || config.label}
      >
        <span class="dropdown-item-icon">${config.icon}</span>
        <span class="dropdown-item-label">${config.label}</span>
        ${isCustomized ? html`<span class="dropdown-item-indicator">●</span>` : nothing}
      </button>
    `;
  }

  private toggleDropdown = (e: Event): void => {
    e.stopPropagation();
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      this.addGlobalClickListener();
    } else {
      this.removeGlobalClickListener();
    }
  };

  private handleDropdownItemClick = (e: Event): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLButtonElement;

    if (!button) return;

    const action = button.dataset.action;
    const agentType = button.dataset.agentType;

    if (action === 'select' && agentType) {
      this.handleAgentSelect(agentType);
      this.closeDropdown();
    }
  };

  private handleDropdownKeydown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.toggleDropdown(e);
        break;
      case 'Escape':
        if (this.isOpen) {
          e.preventDefault();
          this.closeDropdown();
        }
        break;
      case 'ArrowDown':
        if (!this.isOpen) {
          e.preventDefault();
          this.toggleDropdown(e);
        }
        break;
    }
  };

  private handleAgentSelect(agentType: string): void {
    this.onAgentSelect?.(agentType);
  }

  private handleEditAgent(agentType: string): void {
    this.onEditAgent?.(agentType);
  }

  private closeDropdown(): void {
    this.isOpen = false;
    this.removeGlobalClickListener();
  }

  private addGlobalClickListener(): void {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        this.closeDropdown();
      }
    };
    
    document.addEventListener('click', handler);
    this.cleanupFunctions.push(() => document.removeEventListener('click', handler));
  }

  private cleanupFunctions: (() => void)[] = [];

  private removeGlobalClickListener(): void {
    // Run cleanup functions
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];
  }

  private hasCustomPrompt(agentType: string): boolean {
    // Check new custom agents system first
    const customAgents = localStorage.getItem('ai_chat_custom_agents');
    if (customAgents) {
      try {
        const agents = JSON.parse(customAgents);
        if (agents[agentType]) {
          return true;
        }
      } catch {
        // Continue to check old system
      }
    }

    // Check old custom prompts system for backward compatibility
    const customPrompts = localStorage.getItem('ai_chat_custom_prompts');
    if (!customPrompts) return false;

    try {
      const prompts = JSON.parse(customPrompts);
      return Boolean(prompts[agentType]);
    } catch {
      return false;
    }
  }

  // Lifecycle methods
  override disconnectedCallback(): void {
    super.disconnectedCallback?.();
    this.removeGlobalClickListener();
  }
}

// Helper function to create and render the dropdown selector
export function renderAgentDropdownSelector(options: AgentDropdownSelectorOptions): Lit.TemplateResult {
  return html`
    <agent-dropdown-selector
      .selectedAgentType=${options.selectedAgentType}
      .agentConfigs=${options.agentConfigs}
      .showLabels=${options.showLabels || false}
      .onAgentSelect=${options.onAgentSelect}
      .onAddAgent=${options.onAddAgent}
      .onDeleteAgent=${options.onDeleteAgent}
      .onEditAgent=${options.onEditAgent}
    ></agent-dropdown-selector>
  `;
}