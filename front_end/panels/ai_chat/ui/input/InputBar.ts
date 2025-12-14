// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';
import type { ImageInputData } from '../../models/ChatTypes.js';
import '../model_selector/ModelSelector.js';
import './ChatInput.js';
import '../ConnectorsDropdown.js';
import '../AgentDropdown.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

@customElement('ai-input-bar')
export class InputBar extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-input-bar`;

  // Props
  #placeholder = '';
  #disabled = false;
  #sendDisabled = true;
  #imageInput?: ImageInputData;
  #modelOptions?: Array<{value: string, label: string}>;
  #selectedModel?: string;
  #modelSelectorDisabled = false;
  #currentProvider?: string;
  #selectedPromptType?: string|null;
  #agentButtonsHandler: (event: Event) => void = () => {};
  #centered = false;
  #showAgentMenu = false;
  #showConnectorsDropdown = false;
  #showAgentDropdown = false;
  #selectedAgentId?: string;
  #connectorsDropdownPosition?: {left: number; top: number};
  #agentDropdownPosition?: {left: number; top: number};

  set placeholder(v: string) { this.#placeholder = v || ''; this.#render(); }
  set disabled(v: boolean) { this.#disabled = !!v; this.#render(); }
  set sendDisabled(v: boolean) { this.#sendDisabled = !!v; this.#render(); }
  set imageInput(v: ImageInputData|undefined) { this.#imageInput = v; this.#render(); }
  set modelOptions(v: Array<{value: string, label: string}>|undefined) { this.#modelOptions = v; this.#render(); }
  set selectedModel(v: string|undefined) { this.#selectedModel = v; this.#render(); }
  set modelSelectorDisabled(v: boolean) { this.#modelSelectorDisabled = !!v; this.#render(); }
  set currentProvider(v: string|undefined) { this.#currentProvider = v; this.#render(); }
  set selectedPromptType(v: string|null|undefined) { this.#selectedPromptType = v ?? null; this.#render(); }
  set agentButtonsHandler(fn: (event: Event) => void) { this.#agentButtonsHandler = fn || (() => {}); this.#render(); }
  set centered(v: boolean) { this.#centered = !!v; this.#render(); }

  connectedCallback(): void { this.#render(); }

  // Public API to set the input value programmatically (e.g., from example suggestions)
  setInputValue(text: string): void {
    const inputEl = this.querySelector('ai-chat-input') as (HTMLElement & { value?: string, focusInput?: () => void }) | null;
    if (inputEl) {
      // Set value via property setter to update the UI
      (inputEl as any).value = text ?? '';
      // Focus textarea for immediate editing
      if (typeof (inputEl as any).focusInput === 'function') {
        (inputEl as any).focusInput();
      }
      // Bubble an inputchange event so parent updates sendDisabled state
      this.dispatchEvent(new CustomEvent('inputchange', { bubbles: true, detail: { value: text ?? '' } }));
    }
  }

  #emitSendAndClear(detail: any): void {
    // Re-emit send upward
    this.dispatchEvent(new CustomEvent('send', { bubbles: true, detail }));
    // Proactively clear the child input to avoid any stale content
    const inputEl = this.querySelector('ai-chat-input') as (HTMLElement & { clear?: () => void }) | null;
    if (inputEl) {
      // Prefer component clear() if available
      if (typeof (inputEl as any).clear === 'function') {
        (inputEl as any).clear();
      } else if ('value' in (inputEl as any)) {
        // Fall back to resetting value via setter
        (inputEl as any).value = '';
      }
    }
  }

  // Public API for parent to explicitly clear the input field
  clearInput(): void {
    const inputEl = this.querySelector('ai-chat-input') as (HTMLElement & { clear?: () => void, value?: string }) | null;
    if (typeof inputEl?.clear === 'function') {
      inputEl.clear();
    } else if (inputEl && 'value' in inputEl) {
      (inputEl as any).value = '';
    }
  }

  #sendFromInput(): void {
    const inputEl = this.querySelector('ai-chat-input') as (HTMLElement & { value?: string, clear?: () => void }) | null;
    const text = (inputEl?.value ?? '').trim();
    if (!text) {
      return;
    }
    this.dispatchEvent(new CustomEvent('send', { bubbles: true, detail: { text }}));
    if (typeof inputEl?.clear === 'function') {
      inputEl.clear();
    }
  }

  #toggleAgentMenu(e: Event): void {
    e.stopPropagation();
    this.#showAgentMenu = !this.#showAgentMenu;
    this.#showConnectorsDropdown = false; // Close connectors when opening agents
    this.#render();
    
    if (this.#showAgentMenu) {
      // Close menu when clicking outside
      const closeMenu = () => {
        this.#showAgentMenu = false;
        this.#render();
        window.removeEventListener('click', closeMenu);
      };
      // Delay listener attachment to avoid immediate close
      setTimeout(() => window.addEventListener('click', closeMenu), 0);
    }
  }

  #toggleConnectorsDropdown(e: Event): void {
    e.stopPropagation();
    this.#showConnectorsDropdown = !this.#showConnectorsDropdown;
    this.#showAgentMenu = false; // Close agents when opening connectors
    this.#showAgentDropdown = false; // Close agent dropdown
    
    if (this.#showConnectorsDropdown) {
      const btn = this.querySelector('#connectors-button') as HTMLElement | null;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        this.#connectorsDropdownPosition = {
          left: rect.left + rect.width / 2 + window.scrollX,
          top: rect.top + window.scrollY,
        };
      } else {
        this.#connectorsDropdownPosition = undefined;
      }
    } else {
      this.#connectorsDropdownPosition = undefined;
    }

    this.#render();
    
    if (this.#showConnectorsDropdown) {
      // Close dropdown when clicking outside
      const closeDropdown = () => {
        this.#showConnectorsDropdown = false;
        this.#render();
        window.removeEventListener('click', closeDropdown);
      };
      // Delay listener attachment to avoid immediate close
      setTimeout(() => window.addEventListener('click', closeDropdown), 0);
    }
  }

  #toggleAgentDropdown(e: Event): void {
    e.stopPropagation();
    this.#showAgentDropdown = !this.#showAgentDropdown;
    this.#showAgentMenu = false;
    this.#showConnectorsDropdown = false;
    if (this.#showAgentDropdown) {
      const btn = this.querySelector('#agent-dropdown-button') as HTMLElement | null;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        this.#agentDropdownPosition = {
          left: rect.left + rect.width / 2 + window.scrollX,
          top: rect.top + window.scrollY,
        };
      } else {
        this.#agentDropdownPosition = undefined;
      }
    } else {
      this.#agentDropdownPosition = undefined;
    }
    this.#render();
    
    if (this.#showAgentDropdown) {
      const closeDropdown = () => {
        this.#showAgentDropdown = false;
        this.#agentDropdownPosition = undefined;
        this.#render();
        window.removeEventListener('click', closeDropdown);
      };
      setTimeout(() => window.addEventListener('click', closeDropdown), 0);
    }
  }

  #handleAgentSelect(agent: { id: string; name: string }): void {
    this.#selectedAgentId = agent.id;
    this.dispatchEvent(new CustomEvent('agent-changed', { 
      bubbles: true, 
      detail: { agentId: agent.id, agentName: agent.name }
    }));
    this.#render();
  }

  #render(): void {
    const imagePreview = this.#imageInput ? html`
      <div class="image-preview">
        <img src=${this.#imageInput.url} alt="Image input" />
        <button class="image-remove-button" @click=${() => this.dispatchEvent(new CustomEvent('image-clear', {bubbles: true}))}>
          <span class="icon">×</span>
        </button>
      </div>
    ` : Lit.nothing;

    const modelSelector = (
      this.#currentProvider !== 'browseroperator' &&
      this.#modelOptions &&
      this.#modelOptions.length &&
      this.#selectedModel
    ) ? html`
      <ai-model-selector
        .options=${this.#modelOptions}
        .selected=${this.#selectedModel}
        .disabled=${this.#modelSelectorDisabled}
        .preferAbove=${!this.#centered}
        @change=${(e: CustomEvent) => {
          const value = (e.detail as any)?.value as string | undefined;
          if (value) {
            this.dispatchEvent(new CustomEvent('model-changed', { bubbles: true, detail: { value }}));
          }
        }}
        @model-selector-focus=${() => this.dispatchEvent(new CustomEvent('model-selector-focus', { bubbles: true }))}
      ></ai-model-selector>
    ` : Lit.nothing;

    // SVG icons matching demo-builder.io / lucide-react style
    const inlineActions = html`
      <div class="inline-actions">
        <!-- Plus button - matches demo-builder.io line 100-113 -->
        <button class="icon-chip" title="Attach file">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 8C14 8.13261 13.9473 8.25979 13.8536 8.35355C13.7598 8.44732 13.6326 8.5 13.5 8.5H8.5V13.5C8.5 13.6326 8.44732 13.7598 8.35355 13.8536C8.25979 13.9473 8.13261 14 8 14C7.86739 14 7.74021 13.9473 7.64645 13.8536C7.55268 13.7598 7.5 13.6326 7.5 13.5V8.5H2.5C2.36739 8.5 2.24021 8.44732 2.14645 8.35355C2.05268 8.25979 2 8.13261 2 8C2 7.86739 2.05268 7.74021 2.14645 7.64645C2.24021 7.55268 2.36739 7.5 2.5 7.5H7.5V2.5C7.5 2.36739 7.55268 2.24021 7.64645 2.14645C7.74021 2.05268 7.86739 2 8 2C8.13261 2 8.25979 2.05268 8.35355 2.14645C8.44732 2.24021 8.5 2.36739 8.5 2.5V7.5H13.5C13.6326 7.5 13.7598 7.55268 13.8536 7.64645C13.9473 7.74021 14 7.86739 14 8Z" fill="currentColor"/>
          </svg>
        </button>
        <!-- Connectors button - matches demo-builder.io settings/gear style line 137-149 -->
        <div class="connectors-wrapper">
          <button 
            class="icon-chip ${this.#showConnectorsDropdown ? 'active' : ''}" 
            title="Connectors" 
            id="connectors-button"
            @click=${this.#toggleConnectorsDropdown.bind(this)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.7678 9.90868C13.6965 9.86371 13.615 9.8375 13.5309 9.83247C13.4467 9.82745 13.3627 9.84377 13.2865 9.87993C13.096 9.97003 12.8858 10.0105 12.6755 9.99758C12.4651 9.98465 12.2614 9.91874 12.0834 9.80599C11.9053 9.69323 11.7587 9.53729 11.657 9.35265C11.5554 9.16802 11.5021 8.96068 11.5021 8.74993C11.5021 8.53918 11.5554 8.33184 11.657 8.14721C11.7587 7.96257 11.9053 7.80663 12.0834 7.69387C12.2614 7.58112 12.4651 7.51521 12.6755 7.50228C12.8858 7.48936 13.096 7.52983 13.2865 7.61993C13.3628 7.6561 13.4469 7.6724 13.5311 7.6673C13.6153 7.66221 13.6969 7.63588 13.7682 7.59078C13.8395 7.54567 13.8982 7.48326 13.9389 7.40935C13.9796 7.33543 14.0009 7.25243 14.0009 7.16806V4.49993C14.0009 4.23471 13.8956 3.98036 13.708 3.79282C13.5205 3.60529 13.2661 3.49993 13.0009 3.49993H10.7372C10.7465 3.41692 10.7511 3.33346 10.7509 3.24993C10.7505 2.94263 10.6872 2.63867 10.5652 2.35666C10.4431 2.07466 10.2647 1.82055 10.0409 1.60993C9.73108 1.31894 9.34516 1.12166 8.92784 1.04094C8.51052 0.960225 8.07887 0.999369 7.68288 1.15384C7.28688 1.30832 6.94275 1.5718 6.69032 1.91378C6.43789 2.25576 6.28749 2.66225 6.25654 3.08618C6.24694 3.22408 6.24986 3.36256 6.26529 3.49993H4.00092C3.7357 3.49993 3.48134 3.60529 3.29381 3.79282C3.10627 3.98036 3.00092 4.23471 3.00092 4.49993V6.51368C2.91791 6.50438 2.83444 6.49979 2.75092 6.49993C2.44362 6.50043 2.13967 6.56365 1.85767 6.68574C1.57567 6.80782 1.32156 6.9862 1.11092 7.20993C0.898758 7.43404 0.735396 7.69971 0.631153 7.99017C0.526909 8.28063 0.484052 8.58956 0.50529 8.89743C0.54112 9.43954 0.771463 9.95049 1.15396 10.3363C1.53646 10.7221 2.04539 10.9569 2.58717 10.9974C2.72506 11.0073 2.86357 11.0044 3.00092 10.9887V12.9999C3.00092 13.2651 3.10627 13.5195 3.29381 13.707C3.48134 13.8946 3.7357 13.9999 4.00092 13.9999H13.0009C13.2661 13.9999 13.5205 13.8946 13.708 13.707C13.8956 13.5195 14.0009 13.2651 14.0009 12.9999V10.3318C14.001 10.2473 13.9796 10.1642 13.9388 10.0902C13.8981 10.0162 13.8392 9.95377 13.7678 9.90868ZM13.0009 12.9999H4.00092V10.3318C4.00094 10.2474 3.97962 10.1644 3.93893 10.0905C3.89824 10.0166 3.83951 9.95419 3.7682 9.90908C3.6969 9.86398 3.61534 9.83765 3.53112 9.83255C3.4469 9.82746 3.36276 9.84376 3.28654 9.87993C3.09602 9.97003 2.88581 10.0105 2.67545 9.99758C2.46509 9.98465 2.26142 9.91874 2.08336 9.80599C1.90531 9.69323 1.75865 9.53729 1.65703 9.35265C1.55541 9.16802 1.50212 8.96068 1.50212 8.74993C1.50212 8.53918 1.55541 8.33184 1.65703 8.14721C1.75865 7.96257 1.90531 7.80663 2.08336 7.69387C2.26142 7.58112 2.46509 7.51521 2.67545 7.50228C2.88581 7.48936 3.09602 7.52983 3.28654 7.61993C3.36276 7.6561 3.4469 7.6724 3.53112 7.6673C3.61534 7.66221 3.6969 7.63588 3.7682 7.59078C3.83951 7.54567 3.89824 7.48326 3.93893 7.40935C3.97962 7.33543 4.00094 7.25243 4.00092 7.16806V4.49993H6.91904C7.00341 4.49996 7.08642 4.47863 7.16033 4.43794C7.23425 4.39725 7.29666 4.33852 7.34176 4.26722C7.38687 4.19591 7.41319 4.11435 7.41829 4.03014C7.42339 3.94592 7.40709 3.86178 7.37091 3.78555C7.28081 3.59503 7.24034 3.38482 7.25327 3.17446C7.2662 2.96411 7.3321 2.76043 7.44486 2.58238C7.55761 2.40432 7.71356 2.25767 7.89819 2.15605C8.08283 2.05443 8.29016 2.00114 8.50092 2.00114C8.71167 2.00114 8.919 2.05443 9.10364 2.15605C9.28827 2.25767 9.44422 2.40432 9.55697 2.58238C9.66973 2.76043 9.73563 2.96411 9.74856 3.17446C9.76149 3.38482 9.72102 3.59503 9.63092 3.78555C9.59474 3.86178 9.57844 3.94592 9.58354 4.03014C9.58864 4.11435 9.61496 4.19591 9.66007 4.26722C9.70517 4.33852 9.76758 4.39725 9.8415 4.43794C9.91541 4.47863 9.99842 4.49996 10.0828 4.49993H13.0009V6.51431C12.8636 6.49857 12.7251 6.49564 12.5872 6.50555C12.0052 6.54676 11.4621 6.81238 11.0722 7.24639C10.6824 7.6804 10.4763 8.24886 10.4976 8.83186C10.5188 9.41486 10.7657 9.96682 11.1861 10.3713C11.6065 10.7758 12.1675 11.0012 12.7509 10.9999C12.8344 11.0001 12.9179 10.9955 13.0009 10.9862V12.9999Z" fill="currentColor"/>
            </svg>
          </button>
          ${this.#showConnectorsDropdown ? html`
            <ai-connectors-dropdown
              .visible=${this.#showConnectorsDropdown}
              .position=${this.#connectorsDropdownPosition}
              @click=${(e: Event) => e.stopPropagation()}
            ></ai-connectors-dropdown>
          ` : Lit.nothing}
        </div>
        <!-- Agents button - using lucide Bot icon style -->
        <div class="agent-dropdown-wrapper">
          <button 
            id="agent-dropdown-button"
            class="icon-chip ${this.#showAgentDropdown ? 'active' : ''}" 
            title="Select Agent (@)" 
            @click=${this.#toggleAgentDropdown.bind(this)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 8V4H8"/>
              <rect width="16" height="12" x="4" y="8" rx="2"/>
              <path d="M2 14h2"/>
              <path d="M20 14h2"/>
              <path d="M15 13v2"/>
              <path d="M9 13v2"/>
            </svg>
          </button>
          ${this.#showAgentDropdown ? html`
            <ai-agent-dropdown
              .visible=${this.#showAgentDropdown}
              .selectedAgentId=${this.#selectedAgentId}
              .position=${this.#agentDropdownPosition}
              .onSelect=${(agent: { id: string; name: string; icon: string }) => this.#handleAgentSelect(agent)}
              .onClose=${() => { this.#showAgentDropdown = false; this.#render(); }}
              @click=${(e: Event) => e.stopPropagation()}
            ></ai-agent-dropdown>
          ` : Lit.nothing}
        </div>
      </div>
    `;

    const micButton = html`
      <button class="icon-chip mic-button" title="Voice input" aria-label="Voice input">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="currentColor"/>
          <path d="M6 12a6 6 0 0 0 12 0m-6 6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    Lit.render(html`
      <div
        class="input-container ${this.#centered ? 'centered' : ''}"
        data-selected-prompt-type=${this.#selectedPromptType ?? ''}
      >
        ${imagePreview}
        <div class="input-row stacked">
          <ai-chat-input
            .placeholder=${this.#placeholder}
            .disabled=${this.#disabled}
            @send=${(e: Event) => this.#emitSendAndClear((e as CustomEvent).detail)}
            @inputchange=${(e: Event) => this.dispatchEvent(new CustomEvent('inputchange', { bubbles: true, detail: (e as CustomEvent).detail }))}
          ></ai-chat-input>
          
          <div class="input-actions-toolbar">
            <div class="left-actions">
              ${inlineActions}
            </div>
            <div class="right-actions">
              <div class="actions-container">
                ${modelSelector}
                ${micButton}
                <button
                  class="send-button ${this.#sendDisabled ? 'disabled' : ''}"
                  ?disabled=${this.#sendDisabled}
                  @click=${() => this.#sendFromInput()}
                  title="Send message"
                  aria-label="Send message"
                >
                  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M29.4,15.1 l-8.9-3.5 l-3.5-8.9 C16.8,2.3,16.4,2,16,2 s-0.8,0.3-0.9,0.6 l-3.5,8.9 l-8.9,3.5 C2.3,15.2,2,15.6,2,16 s0.3,0.8,0.6,0.9 l8.9,3.5 l3.5,8.9 c0.2,0.4,0.5,0.6,0.9,0.6 s0.8-0.3,0.9-0.6 l3.5-8.9 l8.9-3.5 c0.4-0.2,0.6-0.5,0.6-0.9 S29.7,15.2,29.4,15.1 z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-input-bar': InputBar; }
}
