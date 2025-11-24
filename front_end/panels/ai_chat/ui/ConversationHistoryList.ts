// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import * as Lit from '../../../ui/lit/lit.js';
import {createLogger} from '../core/Logger.js';
import type {ConversationMetadata} from '../persistence/ConversationTypes.js';
import {getConversationHistoryStyles} from './conversationHistoryStyles.js';

const logger = createLogger('ConversationHistoryList');

const {html, nothing, Directives} = Lit;
const {unsafeHTML} = Directives;

/**
 * Component that displays conversation history
 */
export class ConversationHistoryList extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-conversation-history-list`;
  readonly #shadow = this.attachShadow({mode: 'open'});
  readonly #boundRender = this.#render.bind(this);

  #conversations: ConversationMetadata[] = [];
  #currentConversationId: string | null = null;
  #onConversationSelected: ((id: string) => void) | null = null;
  #onDeleteConversation: ((id: string) => void) | null = null;
  #onClose: (() => void) | null = null;

  get conversations(): ConversationMetadata[] {
    return this.#conversations;
  }

  set conversations(value: ConversationMetadata[]) {
    this.#conversations = value;
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  get currentConversationId(): string | null {
    return this.#currentConversationId;
  }

  set currentConversationId(value: string | null) {
    this.#currentConversationId = value;
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  get onConversationSelected(): ((id: string) => void) | null {
    return this.#onConversationSelected;
  }

  set onConversationSelected(value: ((id: string) => void) | null) {
    this.#onConversationSelected = value;
  }

  get onDeleteConversation(): ((id: string) => void) | null {
    return this.#onDeleteConversation;
  }

  set onDeleteConversation(value: ((id: string) => void) | null) {
    this.#onDeleteConversation = value;
  }

  get onClose(): (() => void) | null {
    return this.#onClose;
  }

  set onClose(value: (() => void) | null) {
    this.#onClose = value;
  }

  connectedCallback(): void {
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  #handleClose(): void {
    if (this.#onClose) {
      this.#onClose();
    }
  }

  #handleConversationSelected(id: string): void {
    if (id !== this.#currentConversationId && this.#onConversationSelected) {
      this.#onConversationSelected(id);
    }
    this.#handleClose();
  }

  #handleDeleteConversation(event: Event, conversation: ConversationMetadata): void {
    event.stopPropagation();
    if (this.#onDeleteConversation) {
      this.#onDeleteConversation(conversation.id);
    }
    this.#handleClose();
  }

  #formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  #render(): void {
    Lit.render(
      html`
        <style>
          ${unsafeHTML(getConversationHistoryStyles())}
        </style>

        <div class="history-content">
          <div class="history-header">
            <h2 class="history-title">Chat History</h2>
            <button
              class="history-close-button"
              aria-label="Close chat history"
              @click=${() => this.#handleClose()}
            >
              ×
            </button>
          </div>

          <div class="history-conversations-list">
            ${this.#conversations.length === 0
              ? html`
                  <div class="history-empty-state">
                    <p>No saved conversations yet</p>
                    <p style="font-size: 12px; opacity: 0.8;">Start a new chat to begin</p>
                  </div>
                `
              : html`
                  ${this.#conversations.map(
                    conversation => html`
                      <div
                        class="history-conversation-item ${conversation.id === this.#currentConversationId
                          ? 'active'
                          : ''}"
                        @click=${() => this.#handleConversationSelected(conversation.id)}
                      >
                        <div class="history-conversation-content">
                          <div class="history-conversation-title">${conversation.title}</div>
                          ${conversation.preview
                            ? html`<div class="history-conversation-preview">
                                ${conversation.preview}
                              </div>`
                            : nothing}
                          <div class="history-conversation-metadata">
                            <span>${this.#formatDate(conversation.updatedAt)}</span>
                            <span>${conversation.messageCount} messages</span>
                          </div>
                        </div>
                        <button
                          class="history-delete-button"
                          title="Delete conversation"
                          @click=${(e: Event) => this.#handleDeleteConversation(e, conversation)}
                        >
                          🗑️
                        </button>
                      </div>
                    `,
                  )}
                `}
          </div>
        </div>
      `,
      this.#shadow,
      {host: this},
    );
  }
}

customElements.define('ai-conversation-history-list', ConversationHistoryList);

declare global {
  interface HTMLElementTagNameMap {
    'ai-conversation-history-list': ConversationHistoryList;
  }
}
