// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../../core/common/common.js';
import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import { MiniAppRegistry } from './MiniAppRegistry.js';
import { MiniAppRouter } from './routing/MiniAppRouter.js';

const logger = createLogger('MiniAppPageMonitor');

interface ParsedHash {
  appId: string;
  initialState?: Record<string, unknown>;
}

/**
 * MiniAppPageMonitor - Monitors page lifecycle events to handle page refresh
 *
 * When the inspected page is refreshed:
 * 1. The mini app iframe is cleared
 * 2. The URL hash remains (e.g., #data-studio/table/123)
 * 3. This monitor detects the page change and restores the mini app
 */
export class MiniAppPageMonitor {
  private static _instance: MiniAppPageMonitor | null = null;
  private initialized = false;
  private targetObserver: SDK.TargetManager.Observer | null = null;
  private isRestoring = false;

  private constructor() {}

  static getInstance(): MiniAppPageMonitor {
    if (!MiniAppPageMonitor._instance) {
      MiniAppPageMonitor._instance = new MiniAppPageMonitor();
    }
    return MiniAppPageMonitor._instance;
  }

  /**
   * Initialize the page monitor
   * Should be called once during mini app system startup
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('MiniAppPageMonitor already initialized');
      return;
    }

    const targetManager = SDK.TargetManager.TargetManager.instance();

    // Create and register target observer
    this.targetObserver = {
      targetAdded: (target: SDK.Target.Target) => this.onTargetAdded(target),
      targetRemoved: () => {},
    };

    targetManager.observeTargets(this.targetObserver);

    this.initialized = true;
    logger.info('MiniAppPageMonitor initialized');
  }

  /**
   * Handle when a target (frame) is added
   */
  private onTargetAdded(target: SDK.Target.Target): void {
    // Only monitor frame targets
    if (target.type() !== SDK.Target.Type.FRAME) {
      return;
    }

    const resourceTreeModel = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!resourceTreeModel) {
      return;
    }

    // Listen for primary page changes (includes refresh)
    resourceTreeModel.addEventListener(
      SDK.ResourceTreeModel.Events.PrimaryPageChanged,
      this.onPrimaryPageChanged.bind(this)
    );

    logger.info('Listening to ResourceTreeModel for page changes');
  }

  /**
   * Handle when the primary page changes (navigation, refresh)
   */
  private onPrimaryPageChanged(
    event: Common.EventTarget.EventTargetEvent<{
      frame: SDK.ResourceTreeModel.ResourceTreeFrame;
      type: SDK.ResourceTreeModel.PrimaryPageChangeType;
    }>
  ): void {
    const { frame, type } = event.data;

    // Only handle main frame changes
    if (!frame.isMainFrame()) {
      return;
    }

    logger.info('Primary page changed:', { url: frame.url, type });

    // For about:blank pages, we need special handling:
    // - If a mini app is already running (isRestoring), skip entirely
    // - Otherwise, check for hash via JavaScript (frame.url doesn't include hash fragments)
    if (frame.url === 'about:blank' || frame.url.startsWith('about:blank#')) {
      if (this.isRestoring) {
        logger.info('Skipping about:blank navigation (mini app rendering in progress)');
        return;
      }
      // Check for hash via JavaScript since frame.url doesn't include it
      void this.handleAboutBlankRestoration(frame);
      return;
    }

    // Clear stale instances since the page was refreshed/navigated
    MiniAppRegistry.reset();

    // Check for mini app hash in URL and restore if present
    void this.handleHashRestoration(frame.url);
  }

  /**
   * Handle restoration for about:blank pages
   * We need to query the hash via JavaScript since frame.url doesn't include hash fragments
   */
  private async handleAboutBlankRestoration(
    frame: SDK.ResourceTreeModel.ResourceTreeFrame
  ): Promise<void> {
    try {
      // Get the target to execute JavaScript
      const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
      if (!target) {
        logger.warn('No primary page target for hash query');
        return;
      }

      const runtimeAgent = target.runtimeAgent();
      const hashResult = await runtimeAgent.invoke_evaluate({
        expression: 'window.location.hash',
        returnByValue: true,
      });

      const hash = hashResult.result?.value as string || '';
      logger.info('about:blank hash query result:', hash);

      if (!hash) {
        logger.info('No hash in about:blank URL, skipping restoration');
        return;
      }

      const parsed = this.parseHash(hash);
      if (!parsed) {
        logger.info('Hash does not match any mini app pattern:', hash);
        return;
      }

      logger.info('Restoring mini app from about:blank hash:', parsed);

      // Clear stale instances before restoration
      MiniAppRegistry.reset();

      this.isRestoring = true;
      try {
        // Small delay to let the page settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Launch the mini app
        const instance = await MiniAppRegistry.launch(parsed.appId);

        // Send initial state to the SPA if we have state to restore
        if (parsed.initialState && instance) {
          // Wait for the SPA to signal ready
          await new Promise(resolve => setTimeout(resolve, 500));

          await instance.bridge.sendToSPA({
            action: 'restore-state',
            payload: parsed.initialState,
          });

          logger.info('Sent restore-state to SPA:', parsed.initialState);
        }
      } finally {
        this.isRestoring = false;
      }
    } catch (error) {
      this.isRestoring = false;
      logger.error('Failed to restore mini app from about:blank:', error);
    }
  }

  /**
   * Parse the URL hash and restore the appropriate mini app
   */
  private async handleHashRestoration(url: string): Promise<void> {
    // Prevent double-restoration when RenderWebAppTool navigates to about:blank
    // and then restores the hash
    if (this.isRestoring) {
      logger.info('Already restoring, skipping');
      return;
    }

    try {
      const parsedUrl = new URL(url);
      const hash = parsedUrl.hash;

      if (!hash) {
        logger.info('No hash in URL, skipping restoration');
        return;
      }

      const parsed = this.parseHash(hash);
      if (!parsed) {
        logger.info('Hash does not match any mini app pattern:', hash);
        return;
      }

      logger.info('Restoring mini app from hash:', parsed);

      this.isRestoring = true;

      try {
        // Small delay to let the page settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Launch the mini app
        const instance = await MiniAppRegistry.launch(parsed.appId);

        // Send initial state to the SPA if we have state to restore
        if (parsed.initialState && instance) {
          // Wait for the SPA to signal ready
          await new Promise(resolve => setTimeout(resolve, 500));

          await instance.bridge.sendToSPA({
            action: 'restore-state',
            payload: parsed.initialState,
          });

          logger.info('Sent restore-state to SPA:', parsed.initialState);
        }
      } finally {
        this.isRestoring = false;
      }
    } catch (error) {
      this.isRestoring = false;
      logger.error('Failed to restore mini app from hash:', error);
    }
  }

  /**
   * Parse a URL hash into app ID and initial state
   *
   * Uses the central MiniAppRouter to parse hashes based on registered routes.
   * Each mini app defines its own routes in its definition, making this method
   * route-agnostic and scalable.
   */
  private parseHash(hash: string): ParsedHash | null {
    const router = MiniAppRouter.getInstance();
    const parsed = router.parseHash(hash);

    if (!parsed) {
      return null;
    }

    return {
      appId: parsed.appId,
      initialState: parsed.params,
    };
  }

  /**
   * Cleanup the monitor
   */
  dispose(): void {
    if (this.targetObserver) {
      SDK.TargetManager.TargetManager.instance().unobserveTargets(this.targetObserver);
      this.targetObserver = null;
    }
    this.initialized = false;
    logger.info('MiniAppPageMonitor disposed');
  }
}
