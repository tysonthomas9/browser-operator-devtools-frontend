// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import * as Lit from '../../../ui/lit/lit.js';
import {createLogger} from '../core/Logger.js';
import type {ConversationMetadata} from '../persistence/ConversationTypes.js';
import {getConversationHistoryStyles} from './conversationHistoryStyles.js';

const logger = createLogger('ConversationHistoryList');

const {html, Directives} = Lit;
const {unsafeHTML} = Directives;

// SVG icons as template literals
const chatBubbleIcon = html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
`;

const trashIcon = html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
`;

const emptyStateIcon = html`
  <svg class="history-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    <line x1="9" y1="10" x2="15" y2="10"></line>
  </svg>
`;

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

interface GroupedConversations {
  today: ConversationMetadata[];
  yesterday: ConversationMetadata[];
  thisWeek: ConversationMetadata[];
  thisMonth: ConversationMetadata[];
  earlier: ConversationMetadata[];
}

/**
 * Component that displays conversation history with modern UI
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
    logger.info('Delete button clicked', {conversationId: conversation.id, title: conversation.title});
    if (this.#onDeleteConversation) {
      logger.info('Calling onDeleteConversation callback');
      this.#onDeleteConversation(conversation.id);
    } else {
      logger.warn('onDeleteConversation callback is not set!');
    }
    this.#handleClose();
  }

  #getDateGroup(timestamp: number): DateGroup {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    if (date >= today) {
      return 'today';
    } else if (date >= yesterday) {
      return 'yesterday';
    } else if (date >= weekAgo) {
      return 'thisWeek';
    } else if (date >= monthAgo) {
      return 'thisMonth';
    }
    return 'earlier';
  }

  #groupConversations(): GroupedConversations {
    const groups: GroupedConversations = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };

    for (const conversation of this.#conversations) {
      const group = this.#getDateGroup(conversation.updatedAt);
      groups[group].push(conversation);
    }

    return groups;
  }

  #getGroupLabel(group: DateGroup): string {
    switch (group) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return 'This Month';
      case 'earlier':
        return 'Earlier';
    }
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

  #renderConversationItem(conversation: ConversationMetadata): Lit.TemplateResult {
    return html`
      <div
        class="history-conversation-item ${conversation.id === this.#currentConversationId ? 'active' : ''}"
        @click=${() => this.#handleConversationSelected(conversation.id)}
      >
        <div class="history-conversation-icon">
          ${chatBubbleIcon}
        </div>
        <div class="history-conversation-content">
          <div class="history-conversation-title">${conversation.title}</div>
          <div class="history-conversation-metadata">
            <span>${this.#formatDate(conversation.updatedAt)}</span>
            <span class="history-metadata-dot"></span>
            <span>${conversation.messageCount} messages</span>
          </div>
        </div>
        <button
          class="history-delete-button"
          title="Delete conversation"
          @click=${(e: Event) => this.#handleDeleteConversation(e, conversation)}
        >
          ${trashIcon}
        </button>
      </div>
    `;
  }

  #renderDateGroup(group: DateGroup, conversations: ConversationMetadata[]): Lit.TemplateResult {
    if (conversations.length === 0) {
      return html``;
    }

    return html`
      <div class="history-date-group">
        <div class="history-date-header">
          <span class="history-date-label">${this.#getGroupLabel(group)}</span>
          <div class="history-date-line"></div>
        </div>
        ${conversations.map(conv => this.#renderConversationItem(conv))}
      </div>
    `;
  }

  #render(): void {
    const grouped = this.#groupConversations();
    const hasConversations = this.#conversations.length > 0;

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
            ${!hasConversations
              ? html`
                  <div class="history-empty-state">
                    ${emptyStateIcon}
                    <p>No saved conversations yet</p>
                    <p style="font-size: 12px;">Start a new chat to begin</p>
                  </div>
                `
              : html`
                  ${this.#renderDateGroup('today', grouped.today)}
                  ${this.#renderDateGroup('yesterday', grouped.yesterday)}
                  ${this.#renderDateGroup('thisWeek', grouped.thisWeek)}
                  ${this.#renderDateGroup('thisMonth', grouped.thisMonth)}
                  ${this.#renderDateGroup('earlier', grouped.earlier)}
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
