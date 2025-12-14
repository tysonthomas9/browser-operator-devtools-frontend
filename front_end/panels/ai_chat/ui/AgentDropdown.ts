// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export interface Agent {
  id: string;
  name: string;
  icon: string;  // SVG path or emoji
  description?: string;
}

export interface AgentDropdownProps {
  visible: boolean;
  agents: Agent[];
  selectedAgentId?: string;
  onSelect: (agent: Agent) => void;
  onAddAgent?: () => void;
  onClose: () => void;
  position?: {left: number; top: number};
}

@customElement('ai-agent-dropdown')
export class AgentDropdown extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-agent-dropdown`;

  #visible = false;
  #agents: Agent[] = [
    { id: 'sales', name: 'Sales Agent', icon: 'arrow-right' },
    { id: 'scraper', name: 'Scraper Agent', icon: 'network' },
    { id: 'assistant', name: 'Assistant Agent', icon: 'check-square' },
  ];
  #addAgentIcon = 'smile';
  #selectedAgentId?: string;
  #onSelect?: (agent: Agent) => void;
  #onAddAgent?: () => void;
  #onClose?: () => void;
  #position?: {left: number; top: number};
  #searchQuery = '';

  set visible(v: boolean) { this.#visible = v; this.#render(); }
  set agents(v: Agent[]) { this.#agents = v; this.#render(); }
  set selectedAgentId(v: string | undefined) { this.#selectedAgentId = v; this.#render(); }
  set onSelect(fn: (agent: Agent) => void) { this.#onSelect = fn; }
  set onAddAgent(fn: () => void) { this.#onAddAgent = fn; }
  set onClose(fn: () => void) { this.#onClose = fn; }
  set position(v: {left: number; top: number} | undefined) { this.#position = v; this.#render(); }

  connectedCallback(): void { 
    this.#render(); 
  }

  #handleSelect(agent: Agent): void {
    if (this.#onSelect) {
      this.#onSelect(agent);
    }
    if (this.#onClose) {
      this.#onClose();
    }
  }

  #handleAddAgent(): void {
    if (this.#onAddAgent) {
      this.#onAddAgent();
    }
    if (this.#onClose) {
      this.#onClose();
    }
  }

  #handleSearchInput(e: Event): void {
    this.#searchQuery = (e.target as HTMLInputElement).value;
    this.#render();
  }

  #getFilteredAgents(): Agent[] {
    if (!this.#searchQuery.trim()) {
      return this.#agents;
    }
    const query = this.#searchQuery.toLowerCase();
    return this.#agents.filter(agent => 
      agent.name.toLowerCase().includes(query)
    );
  }

  #renderIcon(iconType: string): Lit.TemplateResult {
    // Icons matching lucide-react style from demo-builder.io
    switch (iconType) {
      case 'arrow-right':
        // Lucide ArrowRight icon
        return html`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/>
            <path d="m12 5 7 7-7 7"/>
          </svg>
        `;
      case 'network':
        // Lucide Network icon
        return html`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="16" y="16" width="6" height="6" rx="1"/>
            <rect x="2" y="16" width="6" height="6" rx="1"/>
            <rect x="9" y="2" width="6" height="6" rx="1"/>
            <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
            <path d="M12 12V8"/>
          </svg>
        `;
      case 'check-square':
        // Lucide CheckSquare icon
        return html`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        `;
      case 'smile':
        // Lucide Smile icon
        return html`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" x2="9.01" y1="9" y2="9"/>
            <line x1="15" x2="15.01" y1="9" y2="9"/>
          </svg>
        `;
      case 'plus':
        // Lucide Plus icon
        return html`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
        `;
      default:
        // If it's an emoji or unknown, just render it as text
        return html`<span class="icon-emoji">${iconType}</span>`;
    }
  }

  #render(): void {
    // Keep host footprint zero; render dropdown as a fixed overlay tied to the trigger.
    if (!this.#visible) {
      Lit.render(html``, this, {host: this});
      return;
    }

    const fallbackPosition = (() => {
      const root = this.getRootNode() as Document | ShadowRoot;
      const trigger = root.querySelector?.('#agent-dropdown-button') as HTMLElement | null;
      if (!trigger) {
        return undefined;
      }
      const rect = trigger.getBoundingClientRect();
      return {
        left: rect.left + rect.width / 2 + window.scrollX,
        top: rect.top + window.scrollY,
      };
    })();

    const effectivePosition = this.#position ?? fallbackPosition;
    const surfaceStyle = effectivePosition ?
      `left:${effectivePosition.left}px; top:${effectivePosition.top}px;` : '';

    Lit.render(html`
      <style>
        :host {
          display: block;
          position: relative;
          width: 0;
          height: 0;
          overflow: visible;
        }

        @keyframes dropdownFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .dropdown-surface {
          position: fixed;
          transform: translate(-50%, calc(-100% - 8px));
          background: hsl(var(--background));
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid hsl(var(--border));
          width: 224px;
          z-index: 10000;
          overflow: hidden;
          animation: dropdownFadeIn 0.15s ease-out;
        }

        .search-box {
          padding: 12px;
          border-bottom: 1px solid hsl(var(--border));
        }

        .search-input-container {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: hsl(var(--muted-foreground));
        }

        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          background: hsl(var(--background));
          font-size: 14px;
          color: hsl(var(--foreground));
          outline: none;
        }

        .search-input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 1px hsl(var(--primary));
        }

        .search-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid hsl(var(--border));
        }

        .header-title {
          font-size: 12px;
          font-weight: 500;
          color: hsl(var(--foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-hint {
          font-size: 12px;
          color: hsl(var(--muted-foreground));
          font-weight: 500;
        }

        .agent-list {
          padding: 8px 0;
          max-height: 256px;
          overflow-y: auto;
        }

        .agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          font-family: inherit;
        }

        .agent-item:hover {
          background: hsl(var(--sidebar-background));
        }

        .agent-item.selected {
          background: hsl(var(--secondary));
        }

        .agent-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: hsl(var(--foreground));
        }

        .icon-emoji {
          font-size: 14px;
        }

        .agent-name {
          flex: 1;
          font-size: 14px;
          font-weight: 400;
          color: hsl(var(--foreground));
        }

        .divider {
          height: 1px;
          background: hsl(var(--border));
          margin: 0;
        }

        .add-agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          font-family: inherit;
        }

        .add-agent-item:hover {
          background: hsl(var(--sidebar-background));
        }

        .add-agent-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: hsl(var(--primary));
        }

        .add-agent-text {
          font-size: 14px;
          font-weight: 400;
          color: hsl(var(--foreground));
        }
      </style>

      <div class="dropdown-surface" style=${surfaceStyle}>
        <div class="search-box">
          <div class="search-input-container">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              class="search-input"
              placeholder="Search Agents"
              .value=${this.#searchQuery}
              @input=${this.#handleSearchInput.bind(this)}
            />
          </div>
        </div>

        <div class="header">
          <span class="header-title">Agents</span>
          <span class="header-hint">@</span>
        </div>

        <div class="agent-list">
          ${this.#getFilteredAgents().map(agent => html`
            <button 
              class="agent-item ${this.#selectedAgentId === agent.id ? 'selected' : ''}"
              @click=${() => this.#handleSelect(agent)}
            >
              <div class="agent-icon">${this.#renderIcon(agent.icon)}</div>
              <span class="agent-name">${agent.name}</span>
            </button>
          `)}
        </div>

        <div class="divider"></div>

        <button class="add-agent-item" @click=${this.#handleAddAgent.bind(this)}>
          <div class="add-agent-icon">${this.#renderIcon(this.#addAgentIcon)}</div>
          <span class="add-agent-text">Add your own Agent</span>
        </button>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-agent-dropdown': AgentDropdown; }
}
