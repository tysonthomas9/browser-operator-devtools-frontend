// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { MiniAppRegistry } from '../mini_apps/MiniAppRegistry.js';
import type { MiniApp } from '../mini_apps/types/MiniAppTypes.js';

const logger = createLogger('MiniAppsLauncher');

/**
 * MiniAppsLauncher - Full-screen launcher view for mini apps
 *
 * Displays all registered mini apps as clickable cards.
 * Clicking a card launches that mini app in full-screen.
 */
export class MiniAppsLauncher {
  private element: HTMLElement | null = null;
  private onCloseCallback: (() => void) | null = null;

  constructor(onClose?: () => void) {
    this.onCloseCallback = onClose || null;
  }

  /**
   * Show the launcher
   */
  show(): void {
    if (this.element) {
      logger.info('MiniAppsLauncher already visible');
      return;
    }

    this.element = this.createUI();
    document.body.appendChild(this.element);
    logger.info('MiniAppsLauncher shown');
  }

  /**
   * Hide the launcher
   */
  hide(): void {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
      this.element = null;
      logger.info('MiniAppsLauncher hidden');

      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    }
  }

  /**
   * Check if launcher is visible
   */
  isVisible(): boolean {
    return this.element !== null;
  }

  /**
   * Create the launcher UI
   */
  private createUI(): HTMLElement {
    // Full-screen container
    const container = document.createElement('div');
    container.className = 'mini-apps-launcher';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-background, #1e1e1e);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid var(--color-details-hairline, #3c3c3c);
    `;

    const title = document.createElement('h1');
    title.textContent = 'Apps';
    title.style.cssText = `
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-text-primary, #e8eaed);
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.style.cssText = `
      background: none;
      border: none;
      color: var(--color-text-secondary, #9aa0a6);
      font-size: 24px;
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
      transition: background-color 0.2s;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = 'var(--color-background-elevation-1, #2d2d2d)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
    });
    closeButton.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeButton);
    container.appendChild(header);

    // Content area with app cards
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    `;

    // App cards grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    `;

    // Get all registered mini apps and create cards
    const apps = MiniAppRegistry.getAllApps();
    for (const app of apps) {
      const card = this.createAppCard(app);
      grid.appendChild(card);
    }

    // If no apps registered, show message
    if (apps.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No apps available';
      emptyMessage.style.cssText = `
        color: var(--color-text-secondary, #9aa0a6);
        text-align: center;
        padding: 40px;
        font-size: 16px;
      `;
      grid.appendChild(emptyMessage);
    }

    content.appendChild(grid);
    container.appendChild(content);

    // Handle Escape key to close
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    return container;
  }

  /**
   * Create an app card
   */
  private createAppCard(app: MiniApp): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mini-app-card';
    card.style.cssText = `
      background: var(--color-background-elevation-1, #2d2d2d);
      border: 1px solid var(--color-details-hairline, #3c3c3c);
      border-radius: 12px;
      padding: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    `;

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'var(--color-primary, #8ab4f8)';
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'var(--color-details-hairline, #3c3c3c)';
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });

    // Icon
    const icon = document.createElement('div');
    icon.textContent = app.icon;
    icon.style.cssText = `
      font-size: 48px;
      margin-bottom: 16px;
      line-height: 1;
    `;

    // Name
    const name = document.createElement('div');
    name.textContent = app.name;
    name.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-primary, #e8eaed);
      margin-bottom: 8px;
    `;

    // Description
    const description = document.createElement('div');
    description.textContent = app.description;
    description.style.cssText = `
      font-size: 14px;
      color: var(--color-text-secondary, #9aa0a6);
      line-height: 1.4;
    `;

    // Running indicator
    if (MiniAppRegistry.isRunning(app.id)) {
      const runningBadge = document.createElement('div');
      runningBadge.textContent = 'Running';
      runningBadge.style.cssText = `
        margin-top: 12px;
        padding: 4px 12px;
        background: var(--color-accent-green-background, #1e3a29);
        color: var(--color-accent-green, #81c995);
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      `;
      card.appendChild(runningBadge);
    }

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(description);

    // Click to launch app
    card.addEventListener('click', () => this.launchApp(app.id));

    return card;
  }

  /**
   * Launch a mini app
   */
  private async launchApp(appId: string): Promise<void> {
    try {
      logger.info('Launching mini app:', appId);

      // Hide launcher first
      this.hide();

      // Launch the app
      await MiniAppRegistry.launch(appId);

      logger.info('Mini app launched successfully:', appId);
    } catch (error) {
      logger.error('Failed to launch mini app:', error);
      // Could show an error toast here
    }
  }
}
