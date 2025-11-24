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
    }

    .history-content {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }

    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--sys-color-divider);
    }

    .history-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .history-close-button {
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 24px;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .history-close-button:hover {
      background-color: var(--color-background-elevation-1);
      color: var(--color-text-primary);
    }

    .history-conversations-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 20px 20px 20px;
    }

    .history-conversations-list::-webkit-scrollbar {
      width: 8px;
    }

    .history-conversations-list::-webkit-scrollbar-thumb {
      background-color: var(--sys-color-divider);
      border-radius: 4px;
    }

    .history-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: var(--color-text-secondary);
    }

    .history-empty-state p {
      margin: 8px 0;
    }

    .history-conversation-item {
      position: relative;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      background-color: transparent;
      border: 1px solid transparent;
    }

    .history-conversation-item:hover {
      background-color: var(--color-background-elevation-1);
      border-color: var(--sys-color-divider);
    }

    .history-conversation-item.active {
      background-color: var(--color-primary-container);
      border-color: var(--color-primary);
    }

    .history-conversation-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-right: 32px;
    }

    .history-conversation-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-conversation-preview {
      font-size: 12px;
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-conversation-metadata {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    }

    .history-delete-button {
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      padding: 0;
      background: var(--sys-color-cdt-base-container);
      border: 1px solid var(--sys-color-divider);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: none;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .history-conversation-item:hover .history-delete-button,
    .history-conversation-item.active .history-delete-button {
      display: flex;
    }

    .history-delete-button:hover {
      background-color: var(--sys-color-error-container);
      border-color: var(--sys-color-error);
      transform: translateY(-50%) scale(1.1);
    }
  `;
}
