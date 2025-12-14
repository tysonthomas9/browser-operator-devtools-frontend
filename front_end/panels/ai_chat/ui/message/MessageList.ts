// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';
import type { ChatMessage } from '../../models/ChatTypes.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

@customElement('ai-message-list')
export class MessageList extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-message-list`;
  // Use Light DOM
  // readonly #shadow = this.attachShadow({mode: 'open'});
  readonly #shadow = this;

  // Public API properties (no decorators; manual setters trigger render)
  #messages: ChatMessage[] = [];
  #state: 'idle'|'loading'|'error' = 'idle';
  #agentViewMode: 'simplified'|'enhanced' = 'simplified';

  set messages(value: ChatMessage[]) { this.#messages = value; this.#render(); }
  get messages(): ChatMessage[] { return this.#messages; }
  set state(value: 'idle'|'loading'|'error') { this.#state = value; this.#render(); }
  get state(): 'idle'|'loading'|'error' { return this.#state; }
  set agentViewMode(value: 'simplified'|'enhanced') { this.#agentViewMode = value; this.#render(); }
  get agentViewMode(): 'simplified'|'enhanced' { return this.#agentViewMode; }

  // Internal state
  #pinToBottom = true;
  #resizeObserver = new ResizeObserver(() => { if (this.#pinToBottom) this.#scrollToBottom(); });

  connectedCallback(): void {
    this.#render();
    this.addEventListener('scroll', this.#onScroll);
    this.#resizeObserver.observe(this);
  }
  
  disconnectedCallback(): void {
    this.#resizeObserver.disconnect();
    this.removeEventListener('scroll', this.#onScroll);
  }

  #onScroll = (e: Event) => {
    const el = e.target as HTMLElement;
    const SCROLL_ROUNDING_OFFSET = 1;
    this.#pinToBottom = el.scrollTop + el.clientHeight + SCROLL_ROUNDING_OFFSET >= el.scrollHeight;
  };

  #scrollToBottom(): void { this.scrollTop = this.scrollHeight; }

  #render(): void {
    // In Light DOM, we don't want to overwrite children projected by the parent (ChatView).
    // We only need to ensure styles are applied. 
    // ChatView renders <ai-message-list> ... children ... </ai-message-list>
    // So we don't need to Lit.render() content here, as it would wipe the children.
    
    // We just inject styles once if needed, or rely on global styles.
    // But to ensure self-contained behavior, we can inject a style tag if not present.
    if (!this.querySelector('style[data-message-list-styles]')) {
      const style = document.createElement('style');
      style.setAttribute('data-message-list-styles', '');
      style.textContent = `
        ai-message-list {
          display: block;
          height: 562px;
          max-height: 562px;
          flex: 1 1 auto;
          position: relative;
          z-index: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          scroll-behavior: smooth;
          padding: 12px 16px;
          background-color: var(--color-background);
          padding-bottom: 12px;
          min-height: 100px;
        }
        ai-message-list::-webkit-scrollbar { width: 4px; }
        ai-message-list::-webkit-scrollbar-track { background: transparent; }
        ai-message-list::-webkit-scrollbar-thumb { background-color: var(--color-scrollbar); border-radius: 4px; }
      `;
      this.prepend(style);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-message-list': MessageList; }
}
