// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';

const {html, Decorators, nothing} = Lit;
const {customElement, property} = Decorators;

export interface SwitchChangeEvent {
  checked: boolean;
}

@customElement('ai-switch')
export class Switch extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-switch`;

  @property({type: Boolean}) checked = false;
  @property({type: Boolean}) disabled = false;

  #onChange?: (event: SwitchChangeEvent) => void;

  set onChange(fn: (event: SwitchChangeEvent) => void | undefined) {
    this.#onChange = fn;
  }

  connectedCallback(): void {
    this.#render();
  }

  #handleClick(): void {
    if (this.disabled) {
      return;
    }
    
    this.checked = !this.checked;
    
    if (this.#onChange) {
      this.#onChange({checked: this.checked});
    }
    
    this.dispatchEvent(new CustomEvent('change', {
      detail: {checked: this.checked},
      bubbles: true,
      composed: true
    }));
    
    this.#render();
  }

  #render(): void {
    // clang-format off
    Lit.render(html`
      <style>
        :host {
          display: inline-flex;
          cursor: pointer;
        }

        :host([disabled]) {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          width: 44px;
          height: 24px;
          border-radius: 12px;
          background: hsl(var(--input, 210 20.5% 84.3%));
          border: 2px solid transparent;
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: inherit;
        }

        .switch[data-state="checked"] {
          background: hsl(var(--primary, 213.8 97.5% 49.8%));
        }

        .switch:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px hsl(var(--background, 0 0% 100%)), 
                      0 0 0 4px hsl(var(--ring, 213.8 97.5% 49.8%));
        }

        .switch-thumb {
          display: block;
          width: 20px;
          height: 20px;
          border-radius: 10px;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(0);
        }

        .switch[data-state="checked"] .switch-thumb {
          transform: translateX(20px);
        }
      </style>

      <div 
        class="switch"
        data-state=${this.checked ? 'checked' : 'unchecked'}
        role="switch"
        aria-checked=${this.checked}
        tabindex=${this.disabled ? -1 : 0}
        @click=${this.#handleClick}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.#handleClick();
          }
        }}
      >
        <span class="switch-thumb"></span>
      </div>
    `, this, {host: this});
    // clang-format on
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-switch': Switch;
  }
}

