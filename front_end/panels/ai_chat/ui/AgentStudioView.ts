// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { AgentStudioController } from './AgentStudioController.js';
import { AgentStudioSPA } from './agent_studio/AgentStudioSPA.js';

const logger = createLogger('AgentStudioView');

/**
 * AgentStudioView - Full-screen agent management UI
 *
 * Provides CRUD operations for custom agents with:
 * - Agent list (built-in and custom)
 * - Agent detail/edit form
 * - Tool selection
 * - Schema editor
 * - Manual test runs
 *
 * Architecture:
 * - SPA rendered in inspected page via RenderWebAppTool
 * - Two-way communication via Runtime.addBinding (SPA→DevTools) and Runtime.evaluate (DevTools→SPA)
 * - Business logic handled by AgentStudioController
 */
export class AgentStudioView {
  private webappId: string | null = null;
  private controller: AgentStudioController | null = null;
  private closeCallback: (() => void) | null = null;

  /**
   * Show the Agent Studio in full-screen
   */
  async show(): Promise<void> {
    if (this.webappId) {
      logger.info('Agent Studio already open');
      return;
    }

    try {
      // Import RenderWebAppTool dynamically
      const { RenderWebAppTool } = await import('../tools/RenderWebAppTool.js');

      // Render SPA in inspected page
      const tool = new RenderWebAppTool();
      const result = await tool.execute({
        html: AgentStudioSPA.html,
        css: AgentStudioSPA.css,
        js: AgentStudioSPA.js,
        reasoning: 'Display Agent Studio for managing custom agents',
      });

      if ('error' in result) {
        throw new Error(result.error);
      }

      this.webappId = result.webappId;

      // Create and initialize controller with bridge
      this.controller = new AgentStudioController();
      await this.controller.initialize(this.webappId);

      // Set up close handling via controller callback (not bridge.onAction which would overwrite the controller's handler)
      this.controller.onClose(async () => {
        await this.hide();
        if (this.closeCallback) {
          this.closeCallback();
        }
      });

      logger.info('Agent Studio opened', { webappId: this.webappId });
    } catch (error) {
      logger.error('Failed to open Agent Studio:', error);
      throw error;
    }
  }

  /**
   * Hide the Agent Studio
   */
  async hide(): Promise<void> {
    // Cleanup controller
    if (this.controller) {
      await this.controller.cleanup();
      this.controller = null;
    }

    // Remove webapp
    if (this.webappId) {
      try {
        const { RemoveWebAppTool } = await import('../tools/RemoveWebAppTool.js');
        const tool = new RemoveWebAppTool();
        await tool.execute({
          webappId: this.webappId,
          reasoning: 'Closing Agent Studio',
        });
      } catch (error) {
        logger.error('Failed to remove webapp:', error);
      }

      this.webappId = null;
    }

    logger.info('Agent Studio closed');
  }

  /**
   * Set callback for when studio is closed
   */
  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  /**
   * Check if Agent Studio is visible
   */
  isVisible(): boolean {
    return this.webappId !== null;
  }
}
