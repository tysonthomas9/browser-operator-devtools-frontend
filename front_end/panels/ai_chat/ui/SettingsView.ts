// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export interface ModelConfig {
  tier: 'main' | 'mini' | 'nano';
  label: string;
  description: string;
  selectedModel?: string;
  apiKey?: string;
  modelOptions: Array<{value: string, label: string}>;
}

export interface SettingsViewProps {
  modelConfigs?: ModelConfig[];
  onModelChange?: (tier: string, model: string) => void;
  onApiKeyChange?: (tier: string, apiKey: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  showAdvancedSettings?: boolean;
  onToggleAdvancedSettings?: (enabled: boolean) => void;
}

@customElement('ai-settings-view')
export class SettingsView extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-settings-view`;

  #modelConfigs: ModelConfig[] = [
    {
      tier: 'main',
      label: 'Main Model',
      description: 'Primary model for complex tasks',
      selectedModel: 'gpt-4',
      apiKey: '',
      modelOptions: [
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'claude-3-opus', label: 'Claude 3 Opus' },
      ],
    },
    {
      tier: 'mini',
      label: 'Mini Model',
      description: 'Fast model for simple tasks',
      selectedModel: 'gpt-3.5-turbo',
      apiKey: '',
      modelOptions: [
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
      ],
    },
    {
      tier: 'nano',
      label: 'Nano Model',
      description: 'Lightweight model for quick responses',
      selectedModel: 'gemini-flash',
      apiKey: '',
      modelOptions: [
        { value: 'gemini-flash', label: 'Gemini Flash' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ],
    },
  ];

  #showAdvancedSettings = false;
  #openDropdownTier: string | null = null;
  #onModelChange?: (tier: string, model: string) => void;
  #onApiKeyChange?: (tier: string, apiKey: string) => void;
  #onSave?: () => void;
  #onCancel?: () => void;
  #onToggleAdvancedSettings?: (enabled: boolean) => void;

  set modelConfigs(v: ModelConfig[]) { this.#modelConfigs = v; this.#render(); }
  set showAdvancedSettings(v: boolean) { this.#showAdvancedSettings = v; this.#render(); }
  set onModelChange(fn: (tier: string, model: string) => void) { this.#onModelChange = fn; }
  set onApiKeyChange(fn: (tier: string, apiKey: string) => void) { this.#onApiKeyChange = fn; }
  set onSave(fn: () => void) { this.#onSave = fn; }
  set onCancel(fn: () => void) { this.#onCancel = fn; }
  set onToggleAdvancedSettings(fn: (enabled: boolean) => void) { this.#onToggleAdvancedSettings = fn; }

  connectedCallback(): void { this.#render(); }

  #handleModelSelect(tier: string, model: string): void {
    if (this.#onModelChange) {
      this.#onModelChange(tier, model);
    }
    const config = this.#modelConfigs.find(c => c.tier === tier);
    if (config) {
      config.selectedModel = model;
      this.#openDropdownTier = null;
      this.#render();
    }
  }

  #handleApiKeyChange(tier: string, value: string): void {
    if (this.#onApiKeyChange) {
      this.#onApiKeyChange(tier, value);
    }
    const config = this.#modelConfigs.find(c => c.tier === tier);
    if (config) {
      config.apiKey = value;
      this.#render();
    }
  }

  #toggleDropdown(tier: string): void {
    this.#openDropdownTier = this.#openDropdownTier === tier ? null : tier;
    this.#render();
  }

  #toggleAdvancedSettings(): void {
    this.#showAdvancedSettings = !this.#showAdvancedSettings;
    if (this.#onToggleAdvancedSettings) {
      this.#onToggleAdvancedSettings(this.#showAdvancedSettings);
    }
    this.#render();
  }

  #render(): void {
    Lit.render(html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: white;
          overflow: hidden;
        }

        .settings-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          padding: 32px 24px;
          gap: 32px;
          overflow-y: auto;
        }

        .title {
          font-size: 24px;
          font-weight: 600;
          color: var(--slate-800);
          text-align: center;
          margin: 0;
        }

        .model-sections {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .model-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          border: 1px solid var(--slate-200);
          border-radius: 8px;
          background: white;
        }

        .model-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .model-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--slate-800);
        }

        .model-description {
          font-size: 12px;
          color: var(--slate-500);
          line-height: 1.4;
        }

        .dropdown-row {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dropdown-row:hover {
          border-color: var(--slate-300);
          background: #F7F9FC;
        }

        .dropdown-text {
          font-size: 14px;
          color: var(--slate-800);
        }

        .dropdown-chevron {
          width: 16px;
          height: 16px;
          color: var(--slate-500);
          transition: transform 0.2s ease;
        }

        .dropdown-chevron.open {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: white;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          overflow: hidden;
          max-height: 200px;
          overflow-y: auto;
        }

        .dropdown-option {
          padding: 10px 12px;
          font-size: 14px;
          color: var(--slate-800);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .dropdown-option:hover {
          background: #F7F9FC;
        }

        .dropdown-option.selected {
          background: var(--blue-selected);
          color: var(--blue);
          font-weight: 500;
        }

        .api-key-input {
          padding: 10px 12px;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          font-size: 14px;
          color: var(--slate-800);
          outline: none;
          transition: all 0.2s ease;
        }

        .api-key-input::placeholder {
          color: var(--slate-300);
        }

        .api-key-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px var(--blue-selected);
        }

        .actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--slate-200);
        }

        .button {
          padding: 10px 20px;
          border-radius: 8px; /* Updated to match Figma spec */
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .button-cancel {
          background: white;
          color: var(--slate-700);
          border: 1px solid var(--slate-200);
        }

        .button-cancel:hover {
          background: #F7F9FC;
          border-color: var(--slate-300);
        }

        .button-save {
          background: var(--blue);
          color: white;
        }

        .button-save:hover {
          background: #0E82D9;
        }

        .advanced-settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border: 1px solid var(--slate-200);
          border-radius: 8px;
          background: white;
        }

        .advanced-settings-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .advanced-settings-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--slate-800);
        }

        .advanced-settings-description {
          font-size: 12px;
          color: var(--slate-500);
        }

        /* Toggle switch */
        .toggle-switch {
          display: inline-flex;
          align-items: center;
          width: 44px;
          height: 24px;
          border-radius: 12px;
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
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          position: absolute;
          left: 2px;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .toggle-switch.enabled .toggle-knob {
          transform: translateX(20px);
        }
      </style>

      <div class="settings-container">
        <h1 class="title">Settings</h1>

        <div class="model-sections">
          ${this.#modelConfigs.map(config => {
            const isDropdownOpen = this.#openDropdownTier === config.tier;
            const selectedOption = config.modelOptions.find(opt => opt.value === config.selectedModel);

            return html`
              <div class="model-section">
                <div class="model-header">
                  <div class="model-label">${config.label}</div>
                  <div class="model-description">${config.description}</div>
                </div>

                <div class="dropdown-row" @click=${() => this.#toggleDropdown(config.tier)}>
                  <span class="dropdown-text">${selectedOption?.label || 'Select a model'}</span>
                  <svg class="dropdown-chevron ${isDropdownOpen ? 'open' : ''}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>

                  ${isDropdownOpen ? html`
                    <div class="dropdown-menu" @click=${(e: Event) => e.stopPropagation()}>
                      ${config.modelOptions.map(option => html`
                        <div
                          class="dropdown-option ${option.value === config.selectedModel ? 'selected' : ''}"
                          @click=${() => this.#handleModelSelect(config.tier, option.value)}
                        >
                          ${option.label}
                        </div>
                      `)}
                    </div>
                  ` : ''}
                </div>

                <input
                  type="password"
                  class="api-key-input"
                  placeholder="Enter API Key"
                  .value=${config.apiKey || ''}
                  @input=${(e: Event) => this.#handleApiKeyChange(config.tier, (e.target as HTMLInputElement).value)}
                />
              </div>
            `;
          })}
        </div>

        <div class="advanced-settings-row">
          <div class="advanced-settings-info">
            <div class="advanced-settings-label">Advanced Settings</div>
            <div class="advanced-settings-description">Show additional configuration options</div>
          </div>
          <div
            class="toggle-switch ${this.#showAdvancedSettings ? 'enabled' : ''}"
            role="switch"
            aria-checked=${this.#showAdvancedSettings}
            tabindex="0"
            @click=${() => this.#toggleAdvancedSettings()}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.#toggleAdvancedSettings();
              }
            }}
          >
            <div class="toggle-knob"></div>
          </div>
        </div>

        <div class="actions-row">
          <button class="button button-cancel" @click=${() => this.#onCancel?.()}>
            Cancel
          </button>
          <button class="button button-save" @click=${() => this.#onSave?.()}>
            Save
          </button>
        </div>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-settings-view': SettingsView; }
}
