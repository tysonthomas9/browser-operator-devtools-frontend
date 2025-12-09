// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Get CSS styles for conversation history dialog
 */
export function getConversationHistoryStyles(): string {
  return `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      --history-card-radius: 12px;
      --history-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      --history-card-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.08);
      --history-transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .history-content {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: var(--sys-color-cdt-base-container);
    }

    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--sys-color-divider);
      background: var(--color-background-elevation-0);
    }

    .history-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-primary);
      letter-spacing: -0.01em;
    }

    .history-close-button {
      width: 32px;
      height: 32px;
      padding: 0;
      background: var(--color-background-elevation-1);
      border: 1px solid var(--sys-color-divider);
      cursor: pointer;
      font-size: 18px;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all var(--history-transition);
    }

    .history-close-button:hover {
      background-color: var(--color-background-elevation-2);
      color: var(--color-text-primary);
      transform: scale(1.05);
    }

    .history-close-button:active {
      transform: scale(0.95);
    }

    .history-conversations-list {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px 20px 20px;
    }

    .history-conversations-list::-webkit-scrollbar {
      width: 6px;
    }

    .history-conversations-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .history-conversations-list::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.15);
      border-radius: 3px;
    }

    .history-conversations-list::-webkit-scrollbar-thumb:hover {
      background-color: rgba(0, 0, 0, 0.25);
    }

    /* Date group headers */
    .history-date-group {
      margin-bottom: 16px;
    }

    .history-date-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      padding: 0 4px;
    }

    .history-date-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .history-date-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, var(--sys-color-divider), transparent);
    }

    /* Empty state */
    .history-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: var(--color-text-secondary);
    }

    .history-empty-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.4;
    }

    .history-empty-state p {
      margin: 4px 0;
    }

    .history-empty-state p:first-of-type {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary);
    }

    /* Conversation items */
    .history-conversation-item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      margin-bottom: 6px;
      border-radius: var(--history-card-radius);
      cursor: pointer;
      transition: all var(--history-transition);
      background: var(--color-background-elevation-0);
      border: 1px solid var(--sys-color-divider);
      box-shadow: var(--history-card-shadow);
    }

    .history-conversation-item:hover {
      background: var(--color-background-elevation-1);
      border-color: rgba(0, 164, 254, 0.2);
      box-shadow: var(--history-card-shadow-hover);
      transform: translateY(-1px);
    }

    .history-conversation-item:active {
      transform: translateY(0);
      box-shadow: var(--history-card-shadow);
    }

    .history-conversation-item.active {
      background: var(--color-primary-container);
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary), var(--history-card-shadow-hover);
    }

    /* Chat icon */
    .history-conversation-icon {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(0, 164, 254, 0.1), rgba(0, 164, 254, 0.05));
      border-radius: 10px;
      color: var(--color-primary);
    }

    .history-conversation-icon svg {
      width: 18px;
      height: 18px;
    }

    .history-conversation-item.active .history-conversation-icon {
      background: linear-gradient(135deg, rgba(0, 164, 254, 0.2), rgba(0, 164, 254, 0.1));
    }

    .history-conversation-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-right: 28px;
    }

    .history-conversation-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.4;
    }

    .history-conversation-preview {
      font-size: 12px;
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.4;
    }

    .history-conversation-metadata {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 4px;
    }

    .history-metadata-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--color-text-secondary);
      opacity: 0.5;
    }

    /* Delete button */
    .history-delete-button {
      position: absolute;
      top: 50%;
      right: 12px;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      padding: 0;
      background: var(--color-background-elevation-1);
      border: 1px solid var(--sys-color-divider);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: all var(--history-transition);
    }

    .history-delete-button svg {
      width: 14px;
      height: 14px;
      color: var(--color-text-secondary);
      transition: color var(--history-transition);
      pointer-events: none;
    }

    .history-conversation-item:hover .history-delete-button,
    .history-conversation-item.active .history-delete-button {
      opacity: 1;
      pointer-events: auto;
    }

    .history-delete-button:hover {
      background: var(--sys-color-error-container);
      border-color: var(--sys-color-error);
      transform: translateY(-50%) scale(1.1);
    }

    .history-delete-button:hover svg {
      color: var(--sys-color-error);
    }

    .history-delete-button:active {
      transform: translateY(-50%) scale(0.95);
    }

    /* Entry animations */
    @keyframes historyItemFadeIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .history-conversation-item {
      animation: historyItemFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    }

    .history-conversation-item:nth-child(1) { animation-delay: 0.02s; }
    .history-conversation-item:nth-child(2) { animation-delay: 0.04s; }
    .history-conversation-item:nth-child(3) { animation-delay: 0.06s; }
    .history-conversation-item:nth-child(4) { animation-delay: 0.08s; }
    .history-conversation-item:nth-child(5) { animation-delay: 0.10s; }
    .history-conversation-item:nth-child(6) { animation-delay: 0.12s; }
    .history-conversation-item:nth-child(7) { animation-delay: 0.14s; }
    .history-conversation-item:nth-child(8) { animation-delay: 0.16s; }
    .history-conversation-item:nth-child(9) { animation-delay: 0.18s; }
    .history-conversation-item:nth-child(10) { animation-delay: 0.20s; }

    /* Date group animation */
    .history-date-group {
      animation: historyItemFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    }
  `;
}
