// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';
import '../common/Dropdown.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export interface ModelOption { value: string; label: string; }

@customElement('ai-model-selector')
export class ModelSelector extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-model-selector`;

  #options: ModelOption[] = [];
  #selected: string | undefined;
  #disabled = false;

  get options(): ModelOption[] { return this.#options; }
  set options(v: ModelOption[]) { this.#options = v || []; this.#render(); }
  get selected(): string | undefined { return this.#selected; }
  set selected(v: string | undefined) { this.#selected = v; this.#render(); }
  get disabled(): boolean { return this.#disabled; }
  set disabled(v: boolean) { this.#disabled = !!v; this.#render(); }

  connectedCallback(): void { this.#render(); }

  #emitChange(value: string): void {
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value }}));
  }

  #handleChange = (value: string): void => {
    this.#selected = value;
    this.#emitChange(value);
    this.#render();
  };

  #handleFocus = (): void => {
    // Notify host that the selector opened (used to lazily refresh models)
    this.dispatchEvent(new CustomEvent('model-selector-focus', {bubbles: true}));
  };

  #render(): void {
    Lit.render(html`
      <style>
        :host {
          display: block;
        }

        .model-selector {
          width: 100%;
        }

        .model-selector.disabled {
          opacity: 0.6;
          pointer-events: none;
        }

        ai-dropdown {
          width: 100%;
        }
      </style>

      <div class="model-selector ${this.#disabled ? 'disabled' : ''}" @click=${this.#handleFocus}>
        <ai-dropdown
          .options=${this.#options}
          .selectedValue=${this.#selected || ''}
          .placeholder=${'Select Model'}
          .onChange=${this.#handleChange}
        ></ai-dropdown>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-model-selector': ModelSelector; }
}
