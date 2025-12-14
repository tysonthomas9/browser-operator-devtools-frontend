// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';

const {html, Decorators, nothing} = Lit;
const {customElement, property} = Decorators;

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

@customElement('ai-button')
export class Button extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-button`;

  @property({type: String}) variant: ButtonVariant = 'default';
  @property({type: String}) size: ButtonSize = 'default';
  @property({type: Boolean}) disabled = false;
  @property({type: String}) label = '';

  connectedCallback(): void {
    this.#render();
  }

  #render(): void {
    const variantClasses = {
      'default': 'btn-default',
      'outline': 'btn-outline',
      'ghost': 'btn-ghost',
      'destructive': 'btn-destructive'
    };

    const sizeClasses = {
      'default': 'btn-default-size',
      'sm': 'btn-sm',
      'lg': 'btn-lg',
      'icon': 'btn-icon'
    };

    const classes = `btn ${variantClasses[this.variant]} ${sizeClasses[this.size]} ${this.disabled ? 'btn-disabled' : ''}`;

    // clang-format off
    Lit.render(html`
      <style>
        :host {
          display: inline-flex;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: 1px solid transparent;
          font-family: inherit;
        }

        .btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px hsl(var(--background)), 
                      0 0 0 4px hsl(var(--ring));
        }

        /* Variant: Default (Primary) */
        .btn-default {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }

        .btn-default:hover:not(.btn-disabled) {
          background: hsl(var(--primary) / 0.9);
        }

        /* Variant: Outline */
        .btn-outline {
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
        }

        .btn-outline:hover:not(.btn-disabled) {
          background: hsl(var(--secondary));
        }

        /* Variant: Ghost */
        .btn-ghost {
          background: transparent;
          color: hsl(var(--foreground));
          border: none;
        }

        .btn-ghost:hover:not(.btn-disabled) {
          background: hsl(var(--secondary));
        }

        /* Variant: Destructive */
        .btn-destructive {
          background: hsl(var(--destructive));
          color: hsl(var(--destructive-foreground));
          border-color: hsl(var(--destructive));
        }

        .btn-destructive:hover:not(.btn-disabled) {
          background: hsl(var(--destructive) / 0.9);
        }

        /* Size: Default */
        .btn-default-size {
          height: 40px;
          padding: 8px 16px;
        }

        /* Size: Small */
        .btn-sm {
          height: 36px;
          padding: 6px 12px;
          font-size: 13px;
        }

        /* Size: Large */
        .btn-lg {
          height: 44px;
          padding: 10px 20px;
          font-size: 16px;
        }

        /* Size: Icon */
        .btn-icon {
          width: 40px;
          height: 40px;
          padding: 0;
        }

        /* Disabled state */
        .btn-disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
      </style>

      <button
        class=${classes}
        ?disabled=${this.disabled}
        @click=${(e: Event) => this.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }))}
      >
        <slot></slot>
        ${this.label ? html`<span>${this.label}</span>` : nothing}
      </button>
    `, this, {host: this});
    // clang-format on
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-button': Button;
  }
}
