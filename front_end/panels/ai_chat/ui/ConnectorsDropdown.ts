// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export interface Connector {
  id: string;
  name: string;
  enabled: boolean;
  icon: string;
}

export interface ConnectorsDropdownProps {
  visible: boolean;
  connectors: Connector[];
  onToggle: (id: string, enabled: boolean) => void;
  onManage: () => void;
  onClose: () => void;
  position?: {left: number; top: number};
}

@customElement('ai-connectors-dropdown')
export class ConnectorsDropdown extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-connectors-dropdown`;

  #visible = false;
  #connectors: Connector[] = [
    { id: 'web-search', name: 'Web Search', enabled: true, icon: '🔍' },
    { id: 'notion', name: 'Notion', enabled: false, icon: '📝' },
    { id: 'gmail', name: 'Gmail', enabled: false, icon: '📧' },
    { id: 'gdrive', name: 'Google Drive', enabled: false, icon: '📁' },
  ];
  #onToggle?: (id: string, enabled: boolean) => void;
  #onManage?: () => void;
  #onClose?: () => void;
  #searchQuery = '';
  #position?: {left: number; top: number};

  set visible(v: boolean) { this.#visible = v; this.#render(); }
  set connectors(v: Connector[]) { this.#connectors = v; this.#render(); }
  set onToggle(fn: (id: string, enabled: boolean) => void) { this.#onToggle = fn; }
  set onManage(fn: () => void) { this.#onManage = fn; }
  set onClose(fn: () => void) { this.#onClose = fn; }
  set position(v: {left: number; top: number} | undefined) { this.#position = v; this.#render(); }

  connectedCallback(): void { 
    this.#render(); 
  }

  #handleToggle(id: string, enabled: boolean): void {
    if (this.#onToggle) {
      this.#onToggle(id, enabled);
    }
    // Update local state optimistically
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

  #handleManage(): void {
    if (this.#onManage) {
      this.#onManage();
    }
    if (this.#onClose) {
      this.#onClose();
    }
  }

  #render(): void {
    // Keep host footprint zero to avoid affecting layout; we render the surface in a fixed
    // positioned div so it overlays the input instead of expanding it.
    this.style.display = this.#visible ? 'block' : 'none';
    this.style.position = 'relative';
    this.style.width = '0';
    this.style.height = '0';
    this.style.overflow = 'visible';

    const filteredConnectors = this.#connectors.filter(c => 
      c.name.toLowerCase().includes(this.#searchQuery)
    );

    const fallbackPosition = (() => {
      const root = this.getRootNode() as Document | ShadowRoot;
      const trigger = root.querySelector?.('#connectors-button') as HTMLElement | null;
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
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid hsl(var(--border));
          width: 200px;
          z-index: 10000;
          overflow: hidden;
          animation: dropdownFadeIn 0.15s ease-out;
        }

        .search-container {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid hsl(var(--border));
          background: hsl(var(--background));
        }

        .search-icon {
          color: hsl(var(--muted-foreground));
          width: 12px;
          height: 12px;
          flex-shrink: 0;
        }

        .search-input {
          border: none;
          outline: none;
          font-size: 12px;
          color: hsl(var(--foreground));
          flex: 1;
          background: transparent;
        }

        .search-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px 6px;
          font-size: 10px;
          font-weight: 500;
          color: hsl(var(--foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: hsl(var(--background));
        }

        .section-header-hint {
          font-size: 10px;
          color: hsl(var(--muted-foreground));
          font-weight: 500;
        }

        .connector-list {
          padding: 2px 6px 6px;
          background: hsl(var(--background));
          max-height: 200px;
          overflow-y: auto;
        }

        .connector-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          border-radius: 4px;
        }

        .connector-item:hover {
          background: hsl(var(--sidebar-background));
        }

        .connector-item.active {
          background: transparent;
        }

        .connector-icon {
          width: 12px;
          height: 12px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: hsl(var(--foreground));
        }

        .connector-name {
          flex: 1;
          font-size: 12px;
          font-weight: 400;
          color: hsl(var(--foreground));
        }

        /* Smaller toggle switch */
        .toggle-switch {
          display: inline-flex;
          align-items: center;
          width: 32px;
          height: 18px;
          border-radius: 9px;
          background: hsl(var(--input));
          position: relative;
          transition: background-color 0.2s ease;
          cursor: pointer;
          flex-shrink: 0;
          border: 1.5px solid transparent;
        }

        .toggle-switch:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
        }

        .toggle-switch.enabled {
          background: hsl(var(--primary));
        }

        /* Smaller toggle knob */
        .toggle-knob {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: hsl(var(--background));
          position: absolute;
          left: 2px;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .toggle-switch.enabled .toggle-knob {
          transform: translateX(14px);
        }

        .divider {
          height: 1px;
          background: hsl(var(--border));
          margin: 0;
        }

        .manage-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          background: hsl(var(--background));
        }

        .manage-item:hover {
          background: hsl(var(--sidebar-background));
        }

        .manage-icon {
          width: 12px;
          height: 12px;
          color: hsl(var(--foreground));
          flex-shrink: 0;
        }

        .manage-text {
          font-size: 12px;
          font-weight: 400;
          color: hsl(var(--foreground));
        }
      </style>

      <div class="dropdown-surface" style=${surfaceStyle}>
        <div class="search-container">
          <svg class="search-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input 
            type="text" 
            class="search-input" 
            placeholder="Search connectors..."
            @input=${this.#handleSearchInput.bind(this)}
            .value=${this.#searchQuery}
          />
        </div>

        <div class="section-header">
          <span>Connectors</span>
          <span class="section-header-hint">⌘K</span>
        </div>

        <div class="connector-list">
          ${filteredConnectors.map(connector => html`
            <div class="connector-item ${connector.enabled ? 'active' : ''}">
              <div class="connector-icon">${connector.icon}</div>
              <div class="connector-name">${connector.name}</div>
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
                    e.stopPropagation();
                    this.#handleToggle(connector.id, !connector.enabled);
                  }
                }}
              >
                <div class="toggle-knob"></div>
              </div>
            </div>
          `)}
        </div>

        <div class="divider"></div>

        <div class="manage-item" @click=${this.#handleManage.bind(this)}>
          <svg class="manage-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 2C8 2 4 3 4 8C4 13 8 15 8 15C8 15 12 13 12 8C12 3 8 2 8 2Z" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.33"/>
          </svg>
          <div class="manage-text">Manage Connectors</div>
        </div>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-connectors-dropdown': ConnectorsDropdown; }
}
