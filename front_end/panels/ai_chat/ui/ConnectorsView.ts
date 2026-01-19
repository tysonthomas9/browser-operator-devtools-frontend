// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export interface Connector {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export interface ConnectorsViewProps {
  connectors?: Connector[];
  onToggle?: (id: string, enabled: boolean) => void;
  onManageConnections?: () => void;
}

@customElement('ai-connectors-view')
export class ConnectorsView extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-connectors-view`;

  #connectors: Connector[] = [
    // Media
    { id: 'invideo', name: 'invideo', category: 'Media', description: 'Build video creation capabilities into your applications', icon: '🎬', enabled: false },
    
    // Development
    { id: 'sentry', name: 'Sentry', category: 'Development', description: 'Error monitoring & debugging production issues', icon: '🐛', enabled: false },
    
    // Project Management
    { id: 'linear', name: 'Linear', category: 'Project Management', description: 'Issue tracking & project management', icon: '📈', enabled: false },
    
    // Documentation
    { id: 'notion', name: 'Notion', category: 'Documentation', description: 'Document & knowledge management', icon: '📝', enabled: false },
    
    // Communication
    { id: 'intercom', name: 'Intercom', category: 'Communication', description: 'Customer support & conversations', icon: '💬', enabled: false },
    
    // AI / ML
    { id: 'huggingface', name: 'Hugging Face', category: 'AI / ML', description: 'AI models & machine learning hub', icon: '🤗', enabled: false },
    
    // Design
    { id: 'canva', name: 'Canva', category: 'Design', description: 'Browse, summarize, autofill, and even generate new Canva designs', icon: '🎨', enabled: false },
    
    // Debugging
    { id: 'jam', name: 'Jam', category: 'Debugging', description: 'Debug faster with AI agents that can access Jam recordings', icon: '🔧', enabled: false },
  ];

  #searchQuery = '';
  #expandedCategories = new Set<string>(); // Start collapsed per Figma design
  #onToggle?: (id: string, enabled: boolean) => void;
  #onManageConnections?: () => void;

  set connectors(v: Connector[]) { this.#connectors = v; this.#render(); }
  set onToggle(fn: (id: string, enabled: boolean) => void) { this.#onToggle = fn; }
  set onManageConnections(fn: () => void) { this.#onManageConnections = fn; }

  connectedCallback(): void { this.#render(); }

  #handleToggle(id: string, enabled: boolean): void {
    if (this.#onToggle) {
      this.#onToggle(id, enabled);
    }
    const connector = this.#connectors.find(c => c.id === id);
    if (connector) {
      connector.enabled = enabled;
      this.#render();
    }
  }

  #handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.#searchQuery = input.value.toLowerCase();
    this.#render();
  }

  #toggleCategory(category: string): void {
    if (this.#expandedCategories.has(category)) {
      this.#expandedCategories.delete(category);
    } else {
      this.#expandedCategories.add(category);
    }
    this.#render();
  }

  #getConnectedCount(): number {
    return this.#connectors.filter(c => c.enabled).length;
  }

  #getTotalCount(): number {
    return this.#connectors.length;
  }

  #groupByCategory(): Map<string, Connector[]> {
    const groups = new Map<string, Connector[]>();
    const filtered = this.#connectors.filter(c =>
      c.name.toLowerCase().includes(this.#searchQuery) ||
      c.description.toLowerCase().includes(this.#searchQuery) ||
      c.category.toLowerCase().includes(this.#searchQuery)
    );

    filtered.forEach(connector => {
      const category = connector.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(connector);
    });

    return groups;
  }

  #render(): void {
    const groupedConnectors = this.#groupByCategory();
    const connectedCount = this.#getConnectedCount();
    const totalCount = this.#getTotalCount();

    Lit.render(html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: white;
          overflow: hidden;
          align-self: stretch;
          box-sizing: border-box;
        }

        .connectors-container {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          max-width: 100%;
          padding: 20px 16px;
          gap: 16px;
          overflow: hidden;
          font-size: 13px;
          box-sizing: border-box;
          flex: 1;
        }

        .header {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        .title {
          font-size: 16px;
          font-weight: 600;
          color: var(--slate-800);
          text-align: left;
          margin: 0;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 100%;
          padding: 0;
          box-sizing: border-box;
          flex-shrink: 0;
        }


        .connection-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--slate-800);
          font-weight: 500;
          white-space: nowrap;
        }

        .connection-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--blue);
          flex-shrink: 0;
        }

        .connection-count {
          color: var(--blue);
          font-weight: 600;
        }

        .manage-link {
          font-size: 12px;
          color: var(--blue);
          text-decoration: none;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s ease;
          white-space: nowrap;
        }

        .manage-link:hover {
          color: var(--slate-800);
          text-decoration: underline;
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          min-height: 32px;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .search-icon {
          width: 14px;
          height: 14px;
          color: var(--slate-400);
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 12px;
          color: var(--slate-800);
          background: transparent;
        }

        .search-input::placeholder {
          color: var(--slate-300);
        }

        .categories-card {
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          padding: 4px 16px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }

        .categories-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .category-section {
          overflow: hidden;
          background: white;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          cursor: pointer;
          transition: background-color 0.2s ease;
          user-select: none;
          box-shadow: inset 0px -1px 0px 0px var(--slate-200);
        }

        .category-section:last-child .category-header {
          box-shadow: none;
        }

        .category-header:hover {
          background: #F7F9FC;
        }

        .category-name {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: var(--slate-800);
          line-height: 18px;
          padding: 2px;
        }

        .category-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .category-badge {
          height: 14px;
          padding: 1px 5px;
          border-radius: 12px;
          background: var(--slate-300);
          border: 1px solid var(--slate-300);
          color: white;
          font-size: 9px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: -0.2px;
        }

        .category-badge.has-enabled {
          background: var(--blue);
          border-color: var(--blue);
        }

        .category-chevron {
          width: 12px;
          height: 12px;
          color: var(--slate-400);
          transition: transform 0.2s ease;
        }

        .category-chevron.expanded {
          transform: scaleY(-1);
        }

        .connectors-list {
          padding: 0 0 4px 0;
          display: none;
          flex-direction: column;
          gap: 0;
        }

        .connectors-list.expanded {
          display: flex;
        }

        .connector-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          min-height: 36px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        }

        .connector-row:hover {
          background: #F7F9FC;
        }

        .connector-icon {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          flex-shrink: 0;
        }

        .connector-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .connector-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--slate-800);
          line-height: 1.3;
        }

        .connector-description {
          font-size: 11px;
          color: var(--slate-500);
          line-height: 1.3;
        }

        /* Toggle switch matching Figma style */
        .toggle-switch {
          display: inline-flex;
          align-items: center;
          width: 32px;
          height: 18px;
          border-radius: 9px;
          background: var(--slate-200);
          position: relative;
          transition: background-color 0.2s ease;
          cursor: pointer;
          flex-shrink: 0;
        }

        .toggle-switch.enabled {
          background: var(--blue);
        }

        .toggle-knob {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          position: absolute;
          left: 2px;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .toggle-switch.enabled .toggle-knob {
          transform: translateX(14px);
        }
      </style>

      <div class="connectors-container">
        <div class="header">
          <h1 class="title">MCP Connectors</h1>

          <div class="search-row">
            <svg class="search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/>
              <path d="M14 14L18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input
              type="text"
              class="search-input"
              placeholder="Search connectors"
              @input=${this.#handleSearchInput.bind(this)}
              .value=${this.#searchQuery}
            />
          </div>

        </div>

        <div class="summary-row">
          <span class="connection-status">
            <span class="connection-dot"></span>
            <span><span class="connection-count">${connectedCount} of ${totalCount}</span> Connected</span>
          </span>
          <a class="manage-link" @click=${() => this.#onManageConnections?.()}>
            Manage Connections
          </a>
        </div>

        <div class="categories-card">
          <div class="categories-list">
            ${Array.from(groupedConnectors.entries()).map(([category, connectors]) => {
              const isExpanded = this.#expandedCategories.has(category);
              const enabledCount = connectors.filter(c => c.enabled).length;
              const hasEnabled = enabledCount > 0;
              return html`
                <div class="category-section">
                  <div class="category-header" @click=${() => this.#toggleCategory(category)}>
                    <span class="category-name">${category}</span>
                    <div class="category-right">
                      <span class="category-badge ${hasEnabled ? 'has-enabled' : ''}">${hasEnabled ? enabledCount : connectors.length}</span>
                      <svg class="category-chevron ${isExpanded ? 'expanded' : ''}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </div>

                <div class="connectors-list ${isExpanded ? 'expanded' : ''}">
                  ${connectors.map(connector => html`
                    <div class="connector-row">
                      <div class="connector-icon">${connector.icon}</div>
                      <div class="connector-info">
                        <div class="connector-name">${connector.name}</div>
                        <div class="connector-description">${connector.description}</div>
                      </div>
                      <div
                        class="toggle-switch ${connector.enabled ? 'enabled' : ''}"
                        role="switch"
                        aria-checked=${connector.enabled}
                        tabindex="0"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.#handleToggle(connector.id, !connector.enabled);
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.#handleToggle(connector.id, !connector.enabled);
                          }
                        }}
                      >
                        <div class="toggle-knob"></div>
                      </div>
                    </div>
                  `)}
                </div>
              </div>
            `;
            })}
          </div>
        </div>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-connectors-view': ConnectorsView; }
}
