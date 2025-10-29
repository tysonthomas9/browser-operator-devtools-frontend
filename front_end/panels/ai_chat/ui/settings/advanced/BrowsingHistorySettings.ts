// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString } from '../i18n-strings.js';
import * as Common from '../../../../../core/common/common.js';

const logger = Common.Console.Console.instance();

/**
 * Browsing History Settings
 *
 * Migrated from SettingsDialog.ts lines 1889-1933
 */
export class BrowsingHistorySettings {
  private container: HTMLElement;
  private statusMessage: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';
    this.container.className = 'settings-section history-section';

    // Title
    const historyTitle = document.createElement('h3');
    historyTitle.className = 'settings-subtitle';
    historyTitle.textContent = i18nString('browsingHistoryTitle');
    this.container.appendChild(historyTitle);

    // Description
    const historyDescription = document.createElement('p');
    historyDescription.className = 'settings-description';
    historyDescription.textContent = i18nString('browsingHistoryDescription');
    this.container.appendChild(historyDescription);

    // Status message element (initially hidden)
    this.statusMessage = document.createElement('div');
    this.statusMessage.className = 'settings-status history-status';
    this.statusMessage.style.display = 'none';
    this.statusMessage.textContent = i18nString('historyCleared');
    this.container.appendChild(this.statusMessage);

    // Clear history button
    const clearHistoryButton = document.createElement('button');
    clearHistoryButton.textContent = i18nString('clearHistoryButton');
    clearHistoryButton.className = 'settings-button clear-button';
    clearHistoryButton.setAttribute('type', 'button');
    this.container.appendChild(clearHistoryButton);

    clearHistoryButton.addEventListener('click', async () => {
      try {
        // Import the VisitHistoryManager from its dedicated file
        const { VisitHistoryManager } = await import('../../../tools/VisitHistoryManager.js');
        await VisitHistoryManager.getInstance().clearHistory();

        // Show success message
        if (this.statusMessage) {
          this.statusMessage.style.display = 'block';

          // Hide message after 3 seconds
          setTimeout(() => {
            if (this.statusMessage) {
              this.statusMessage.style.display = 'none';
            }
          }, 3000);
        }
      } catch (error) {
        logger.error('Error clearing browsing history:', error);
      }
    });
  }

  save(): void {
    // Browsing history doesn't need to save settings
    // It only provides a "Clear History" button
  }

  cleanup(): void {
    // No cleanup needed
  }
}
