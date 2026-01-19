// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import * as Lit from '../../../ui/lit/lit.js';
import {createLogger} from '../core/Logger.js';
import type {ConversationMetadata} from '../persistence/ConversationTypes.js';

const logger = createLogger('HistoryView');

const {html} = Lit;

/**
 * Events dispatched by HistoryView
 */
export const HistoryViewEvents = {
  LOAD_CONVERSATION: 'history-load-conversation',
  DELETE_CONVERSATION: 'history-delete-conversation',
  REQUEST_DATA: 'history-request-data',
} as const;

export interface HistoryViewEventDetail {
  conversationId?: string;
}

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

interface GroupedConversations {
  today: ConversationMetadata[];
  yesterday: ConversationMetadata[];
  thisWeek: ConversationMetadata[];
  thisMonth: ConversationMetadata[];
  earlier: ConversationMetadata[];
}

/**
 * Inline view for displaying conversation history
 * Design matches ConnectorsView patterns
 */
export class HistoryView extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-history-view`;
  readonly #boundRender = this.#render.bind(this);

  #conversations: ConversationMetadata[] = [];
  #currentConversationId: string | null = null;
  #searchQuery = '';

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

  connectedCallback(): void {
    this.dispatchEvent(new CustomEvent(HistoryViewEvents.REQUEST_DATA, {
      bubbles: true,
      composed: true,
    }));
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  #handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.#searchQuery = input.value.toLowerCase();
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  #handleConversationSelected(id: string): void {
    if (id !== this.#currentConversationId) {
      this.dispatchEvent(new CustomEvent(HistoryViewEvents.LOAD_CONVERSATION, {
        bubbles: true,
        composed: true,
        detail: {conversationId: id},
      }));
    }
  }

  #handleDeleteConversation(event: Event, conversation: ConversationMetadata): void {
    event.stopPropagation();
    logger.info('Delete button clicked', {conversationId: conversation.id, title: conversation.title});
    this.dispatchEvent(new CustomEvent(HistoryViewEvents.DELETE_CONVERSATION, {
      bubbles: true,
      composed: true,
      detail: {conversationId: conversation.id},
    }));
  }

  #getFilteredConversations(): ConversationMetadata[] {
    if (!this.#searchQuery) {
      return this.#conversations;
    }
    return this.#conversations.filter(c =>
      c.title.toLowerCase().includes(this.#searchQuery)
    );
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

  #groupConversations(conversations: ConversationMetadata[]): GroupedConversations {
    const groups: GroupedConversations = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };

    for (const conversation of conversations) {
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
    const isActive = conversation.id === this.#currentConversationId;
    return html`
      <div
        class="history-item ${isActive ? 'active' : ''}"
        @click=${() => this.#handleConversationSelected(conversation.id)}
      >
        <div class="history-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="history-content">
          <div class="history-title">${conversation.title}</div>
          <div class="history-meta">
            <span>${this.#formatDate(conversation.updatedAt)}</span>
            <span class="history-dot"></span>
            <span>${conversation.messageCount} messages</span>
          </div>
        </div>
        <button
          class="history-delete"
          title="Delete conversation"
          @click=${(e: Event) => this.#handleDeleteConversation(e, conversation)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  }

  #renderDateGroup(group: DateGroup, conversations: ConversationMetadata[]): Lit.TemplateResult {
    if (conversations.length === 0) {
      return html``;
    }

    return html`
      <div class="history-group">
        <div class="history-group-header">
          <span class="history-group-label">${this.#getGroupLabel(group)}</span>
          <span class="history-group-count">${conversations.length}</span>
        </div>
        ${conversations.map(conv => this.#renderConversationItem(conv))}
      </div>
    `;
  }

  #render(): void {
    const filtered = this.#getFilteredConversations();
    const grouped = this.#groupConversations(filtered);
    const hasConversations = filtered.length > 0;
    const totalCount = this.#conversations.length;

    Lit.render(
      html`
        <style>
          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            background: white;
            overflow: hidden;
            align-self: stretch;
            box-sizing: border-box;
          }

          .history-container {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            max-width: 100%;
            padding: 20px 16px;
            gap: 16px;
            overflow: hidden;
            font-size: 13px;
            box-sizing: border-box;
            flex: 1;
          }

          .header {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            width: 100%;
            box-sizing: border-box;
          }

          .title {
            font-size: 16px;
            font-weight: 600;
            color: var(--slate-800);
            text-align: left;
            margin: 0;
          }

          .summary-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
          }

          .conversation-count {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--slate-800);
            font-weight: 500;
          }

          .count-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--blue);
          }

          .count-value {
            color: var(--blue);
            font-weight: 600;
          }

          .search-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            min-height: 32px;
            border: 1px solid var(--slate-200);
            border-radius: 6px;
            background: white;
            width: 100%;
            box-sizing: border-box;
          }

          .search-icon {
            width: 14px;
            height: 14px;
            color: var(--slate-400);
            flex-shrink: 0;
          }

          .search-input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 12px;
            color: var(--slate-800);
            background: transparent;
          }

          .search-input::placeholder {
            color: var(--slate-300);
          }

          .history-list {
            border: 1px solid var(--slate-200);
            border-radius: 6px;
            background: white;
            padding: 4px 0;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
          }

          .history-group {
            margin-bottom: 8px;
          }

          .history-group:last-child {
            margin-bottom: 0;
          }

          .history-group-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 16px 6px;
          }

          .history-group-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--slate-500);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .history-group-count {
            font-size: 10px;
            color: var(--slate-400);
            background: var(--slate-100, #f1f5f9);
            padding: 1px 6px;
            border-radius: 10px;
          }

          .history-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            cursor: pointer;
            transition: background-color 0.2s ease;
            position: relative;
          }

          .history-item:hover {
            background: #F7F9FC;
          }

          .history-item.active {
            background: rgba(16, 147, 244, 0.08);
            border-left: 3px solid var(--blue);
            padding-left: 13px;
          }

          .history-icon {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(16, 147, 244, 0.08);
            border-radius: 6px;
            flex-shrink: 0;
          }

          .history-icon svg {
            width: 14px;
            height: 14px;
            color: var(--blue);
          }

          .history-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .history-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--slate-800);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .history-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--slate-500);
          }

          .history-dot {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background: var(--slate-300);
          }

          .history-delete {
            width: 26px;
            height: 26px;
            padding: 0;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }

          .history-delete svg {
            width: 14px;
            height: 14px;
            color: var(--slate-400);
          }

          .history-item:hover .history-delete {
            opacity: 1;
          }

          .history-delete:hover {
            background: rgba(234, 67, 53, 0.1);
            border-color: rgba(234, 67, 53, 0.3);
          }

          .history-delete:hover svg {
            color: #ea4335;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
            color: var(--slate-500);
          }

          .empty-icon {
            width: 40px;
            height: 40px;
            margin-bottom: 12px;
            opacity: 0.4;
            color: var(--slate-400);
          }

          .empty-text {
            font-size: 13px;
            font-weight: 500;
            color: var(--slate-600);
            margin: 0 0 4px;
          }

          .empty-subtext {
            font-size: 12px;
            color: var(--slate-400);
            margin: 0;
          }
        </style>

        <div class="history-container">
          <div class="header">
            <h1 class="title">Chat History</h1>

            <div class="search-row">
              <svg class="search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M14 14L18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search conversations"
                @input=${this.#handleSearchInput.bind(this)}
                .value=${this.#searchQuery}
              />
            </div>
          </div>

          <div class="summary-row">
            <span class="conversation-count">
              <span class="count-dot"></span>
              <span><span class="count-value">${totalCount}</span> Conversations</span>
            </span>
          </div>

          <div class="history-list">
            ${!hasConversations
              ? html`
                  <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      <line x1="9" y1="10" x2="15" y2="10"></line>
                    </svg>
                    <p class="empty-text">${this.#searchQuery ? 'No matching conversations' : 'No conversations yet'}</p>
                    <p class="empty-subtext">${this.#searchQuery ? 'Try a different search term' : 'Start a new chat to begin'}</p>
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
      this,
      {host: this},
    );
  }
}

customElements.define('ai-history-view', HistoryView);

declare global {
  interface HTMLElementTagNameMap {
    'ai-history-view': HistoryView;
  }
}
