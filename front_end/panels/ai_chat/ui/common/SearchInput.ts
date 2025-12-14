// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement, property} = Decorators;

@customElement('ai-search-input')
export class SearchInput extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-search-input`;

  @property({type: String}) placeholder = 'Search...';
  @property({type: String}) value = '';
  @property({type: Boolean}) disabled = false;

  connectedCallback(): void {
    this.#render();
  }

  #handleInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
    
    this.dispatchEvent(new CustomEvent('input', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }));
  }

  #render(): void {
    // clang-format off
    Lit.render(html`
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .search-container {
          position: relative;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 40px;
          padding: 8px 12px 8px 36px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          background: hsl(var(--background));
          font-size: 14px;
          color: hsl(var(--foreground));
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 1px hsl(var(--ring));
        }

        .search-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .search-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: hsl(var(--secondary));
        }
      </style>

      <div class="search-container">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder=${this.placeholder}
          .value=${this.value}
          ?disabled=${this.disabled}
          @input=${this.#handleInput.bind(this)}
        />
      </div>
    `, this, {host: this});
    // clang-format on
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-search-input': SearchInput;
  }
}
