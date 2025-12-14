// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Host from '../../../core/host/host.js';
import * as i18n from '../../../core/i18n/i18n.js';
import * as SDK from '../../../core/sdk/sdk.js';
import type * as Protocol from '../../../generated/protocol.js';
import * as UI from '../../../ui/legacy/legacy.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('TabSelector');

const UIStrings = {
  /**
   * @description Tooltip for the tab selector button
   */
  selectTab: 'Select Browser Tab',
  /**
   * @description Text shown when no tabs are available
   */
  noTabsAvailable: 'No browser tabs available',
  /**
   * @description Format for tab menu item showing URL
   * @example {https://example.com} PH1
   */
  tabItem: '{PH1}',
} as const;

const str_ = i18n.i18n.registerUIStrings('panels/ai_chat/ui/TabSelector.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

/**
 * TabSelector provides a UI component to select different browser tabs (page targets)
 * and interact with them. Currently used for testing multi-tab functionality.
 */
export class TabSelector implements SDK.TargetManager.Observer {
  readonly #menuButton: UI.Toolbar.ToolbarMenuButton;
  readonly #availableTargets: Map<string, SDK.Target.Target> = new Map();
  readonly #discoveredTargetInfos: Map<string, Protocol.Target.TargetInfo> = new Map();
  readonly #webSocketUrls: Map<string, string> = new Map();  // targetId -> webSocketDebuggerUrl
  #hasBrowserTarget: boolean = false;
  #cdpPort: number | null = null;
  static readonly CDP_PORTS = [9222, 9223, 9224, 9229];  // Common CDP ports
  static readonly CDP_PORT_STORAGE_KEY = 'ai_chat_cdp_port';

  constructor() {
    // Create menu button with tab icon
    this.#menuButton = new UI.Toolbar.ToolbarMenuButton(
      this.#populateMenu.bind(this),
      /* isIconDropdown */ true,  // Must be true for icon buttons with tooltips
      /* useSoftMenu */ true,
      /* jslogContext */ 'ai-chat.tab-selector',
      /* iconName */ 'select-element'
    );
    this.#menuButton.setTitle(i18nString(UIStrings.selectTab));

    // Observe targets to keep the list updated
    SDK.TargetManager.TargetManager.instance().observeTargets(this);

    // Initial population of targets (async)
    void this.#updateAvailableTargets();
  }

  /**
   * Get the toolbar item for this selector
   */
  item(): UI.Toolbar.ToolbarItem {
    return this.#menuButton;
  }

  /**
   * Try to enumerate tabs via CDP HTTP endpoint (http://localhost:PORT/json/list)
   * This works even without browserTarget if browser was launched with --remote-debugging-port
   */
  async #tryEnumerateViaHTTP(): Promise<boolean> {
    logger.info('HTTP enumeration', 'Attempting to enumerate tabs via CDP HTTP endpoint...');

    // Try saved port first
    const savedPort = localStorage.getItem(TabSelector.CDP_PORT_STORAGE_KEY);
    if (savedPort) {
      const port = parseInt(savedPort, 10);
      logger.info('Saved port', `Trying saved CDP port: ${port}`);
      if (await this.#fetchTabsFromCDPPort(port)) {
        this.#cdpPort = port;  // Set instance variable for later use (e.g., opening DevTools)
        logger.info('Port confirmed', `Using saved CDP port ${port}`);
        return true;
      }
    }

    // Try common CDP ports
    for (const port of TabSelector.CDP_PORTS) {
      logger.info('Port scan', `Trying CDP port: ${port}`);
      if (await this.#fetchTabsFromCDPPort(port)) {
        // Save working port
        this.#cdpPort = port;
        localStorage.setItem(TabSelector.CDP_PORT_STORAGE_KEY, port.toString());
        logger.info('Port found', `CDP port ${port} works - saved for future use`);
        return true;
      }
    }

    logger.info('HTTP failed', 'Could not connect to any CDP HTTP endpoint');
    return false;
  }

  /**
   * Fetch tabs from a specific CDP port
   */
  async #fetchTabsFromCDPPort(port: number): Promise<boolean> {
    try {
      const url = `http://localhost:${port}/json/list`;
      logger.debug('Fetching', url);

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) {
        logger.debug('HTTP error', `${response.status} ${response.statusText}`);
        return false;
      }

      const targets = await response.json();
      logger.info('HTTP response', `Received ${targets.length} targets from CDP`);

      // Log all target types for debugging
      const typeCount = targets.reduce((acc: any, t: any) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      logger.info('Target types', JSON.stringify(typeCount));

      // Filter for page targets
      const pageTabs = targets.filter((t: any) => t.type === 'page');
      logger.info('Page tabs', `Found ${pageTabs.length} page targets out of ${targets.length} total`);

      // Convert to Protocol.Target.TargetInfo format
      for (const tab of pageTabs) {
        const targetInfo: Protocol.Target.TargetInfo = {
          targetId: tab.id as Protocol.Target.TargetID,
          type: tab.type,
          title: tab.title,
          url: tab.url,
          attached: false,  // HTTP endpoint shows unattached targets
          canAccessOpener: false,
        };

        this.#discoveredTargetInfos.set(tab.id, targetInfo);

        // Store WebSocket URL for direct CDP access
        if (tab.webSocketDebuggerUrl) {
          this.#webSocketUrls.set(tab.id, tab.webSocketDebuggerUrl);
          logger.debug('Added to discovered', `[${tab.id}] ${tab.title} - ${tab.url} (wsUrl: ${tab.webSocketDebuggerUrl})`);
        } else {
          logger.debug('Added to discovered', `[${tab.id}] ${tab.title} - ${tab.url} (no wsUrl)`);
        }

        // Try to find matching Target object in TargetManager
        const targetManager = SDK.TargetManager.TargetManager.instance();
        const target = targetManager.targetById(tab.id);
        if (target) {
          this.#availableTargets.set(tab.id, target);
          logger.debug('Matched target', `${tab.title} (${tab.url})`);
        } else {
          logger.debug('HTTP-only target', `${tab.title} (${tab.url}) - no Target object`);
        }
      }

      logger.info('HTTP enumeration complete', `Added ${this.#discoveredTargetInfos.size} targets to discovered map`);

      return pageTabs.length > 0;

    } catch (error) {
      logger.debug('Fetch failed', `Port ${port}: ${error}`);
      return false;
    }
  }

  /**
   * Update the list of available targets using hybrid approach:
   * 1. Try Target.getTargets if browserTarget available (browser-level CDP access)
   * 2. Try CDP HTTP endpoint (/json/list) if no browserTarget (requires --remote-debugging-port)
   * 3. Fall back to TargetManager.targets() (local DevTools session only)
   */
  async #updateAvailableTargets(): Promise<void> {
    this.#availableTargets.clear();
    this.#discoveredTargetInfos.clear();

    const targetManager = SDK.TargetManager.TargetManager.instance();
    const browserTarget = targetManager.browserTarget();

    logger.info('Tab enumeration', 'Starting tab enumeration...');

    // APPROACH 1: Use browser-level Target.getTargets (best - via CDP protocol)
    if (browserTarget) {
      this.#hasBrowserTarget = true;
      logger.info('Browser target', 'Browser target available - using Target.getTargets for all tabs');

      try {
        // Get all targets from the browser via CDP
        const response = await browserTarget.targetAgent().invoke_getTargets({
          filter: [{ type: 'page' }]  // Filter for page targets only
        });

        logger.info('CDP response', `Target.getTargets returned ${response.targetInfos.length} page targets`);

        // Store discovered target infos
        for (const targetInfo of response.targetInfos) {
          this.#discoveredTargetInfos.set(targetInfo.targetId, targetInfo);

          // Try to find existing Target object in TargetManager
          const target = targetManager.targetById(targetInfo.targetId);
          if (target && target.type() === SDK.Target.Type.FRAME) {
            this.#availableTargets.set(targetInfo.targetId, target);
            logger.debug('Matched target', `${targetInfo.title} (${targetInfo.url})`);
          } else {
            logger.debug('Unattached target', `${targetInfo.title} (${targetInfo.url}) - no Target object`);
          }
        }

        logger.info('Enumeration result', `Found ${this.#availableTargets.size} attached tabs, ${this.#discoveredTargetInfos.size} total tabs`);

      } catch (error) {
        logger.error('CDP enumeration failed', error);
        logger.info('Fallback', 'Falling back to HTTP endpoint');

        // Try HTTP fallback
        const httpSuccess = await this.#tryEnumerateViaHTTP();
        if (!httpSuccess) {
          logger.info('Final fallback', 'Falling back to TargetManager.targets()');
          this.#fallbackToLocalTargets();
        }
      }
    } else {
      // APPROACH 2: Try CDP HTTP endpoint (good - via HTTP)
      this.#hasBrowserTarget = false;
      logger.info('No browser target', 'DevTools not in browserConnection mode - trying CDP HTTP endpoint');

      const httpSuccess = await this.#tryEnumerateViaHTTP();

      if (!httpSuccess) {
        // APPROACH 3: Fall back to local targets (limited - only inspected tab)
        logger.info('HTTP failed', 'Falling back to local targets only');
        this.#fallbackToLocalTargets();
      }
    }

    logger.info('Final count', `Total available targets: ${this.#availableTargets.size}, discovered: ${this.#discoveredTargetInfos.size}`);
  }

  /**
   * Fallback to showing only targets in the current DevTools session
   * (inspected tab and its children like iframes)
   */
  #fallbackToLocalTargets(): void {
    const allTargets = SDK.TargetManager.TargetManager.instance().targets();

    // Filter for outermost FRAME targets
    for (const target of allTargets) {
      if (target.type() === SDK.Target.Type.FRAME && target.outermostTarget() === target) {
        this.#availableTargets.set(target.id(), target);

        const targetInfo = target.targetInfo();
        if (targetInfo) {
          this.#discoveredTargetInfos.set(targetInfo.targetId, targetInfo);
        }
      }
    }

    logger.info('Local targets', `Found ${this.#availableTargets.size} local targets`);
  }

  /**
   * Populate the context menu with available tabs
   * Note: This is synchronous, so we use cached data from the last async update
   */
  #populateMenu(contextMenu: UI.ContextMenu.ContextMenu): void {
    logger.info('Menu populate', `Showing menu with ${this.#discoveredTargetInfos.size} discovered targets`);

    if (this.#discoveredTargetInfos.size === 0) {
      contextMenu.defaultSection().appendItem(
        i18nString(UIStrings.noTabsAvailable),
        () => {},
        {disabled: true}
      );

      // Show diagnostic info
      if (!this.#hasBrowserTarget) {
        contextMenu.defaultSection().appendItem(
          'ℹ️ No browser target - can only see inspected tab',
          () => {},
          {disabled: true}
        );
      }
      return;
    }

    // Add header showing mode
    if (this.#hasBrowserTarget) {
      contextMenu.defaultSection().appendItem(
        `📋 All Browser Tabs (${this.#discoveredTargetInfos.size} found)`,
        () => {},
        {disabled: true}
      );
    } else {
      contextMenu.defaultSection().appendItem(
        `📋 Inspected Tab Only (no browser target)`,
        () => {},
        {disabled: true}
      );
    }

    contextMenu.defaultSection().appendSeparator();

    // Add a menu item for each discovered tab
    for (const [targetId, targetInfo] of this.#discoveredTargetInfos) {
      const url = targetInfo.url || 'about:blank';
      const title = targetInfo.title || 'Untitled';

      // Check if we have a Target object for this
      const target = this.#availableTargets.get(targetId);

      // Check if we have WebSocket URL for this
      const hasWebSocket = this.#webSocketUrls.has(targetId);

      let label: string;
      let disabled = false;

      if (target) {
        // Has Target object - best option
        label = `${title}\n${url}\n✓ Read Page + Open DevTools`;
      } else if (hasWebSocket) {
        // Can read via CDP attachment + open DevTools
        label = `${title}\n${url}\n⚡ Read Page + Open DevTools`;
      } else {
        // No way to control this tab
        label = `${title}\n${url}\n✗ Not accessible`;
        disabled = true;
      }

      contextMenu.defaultSection().appendItem(
        label,
        () => {
          if (target) {
            void this.#onTabSelected(target);
          } else if (hasWebSocket) {
            void this.#onTabSelected(targetId);
          }
        },
        {disabled}
      );
    }
  }

  /**
   * Open DevTools via primary page target's agent
   * This uses the SDK's targetAgent to send Target.openDevTools
   */
  async #openDevToolsViaExistingConnection(targetId: string): Promise<void> {
    logger.info('Existing connection', `Sending Target.openDevTools for ${targetId} via primaryPageTarget`);

    const targetManager = SDK.TargetManager.TargetManager.instance();
    const primaryTarget = targetManager.primaryPageTarget();

    if (!primaryTarget) {
      throw new Error('No primary page target available');
    }

    try {
      const targetAgent = primaryTarget.targetAgent();
      logger.info('Using targetAgent', 'Calling invoke_openDevTools() on primary page target agent');

      const result = await targetAgent.invoke_openDevTools({
        targetId: targetId as Protocol.Target.TargetID,
      });

      if (result.targetId) {
        logger.info('DevTools opened', `Native window opened - DevTools target ID: ${result.targetId}`);
      } else {
        logger.warn('Unexpected result', `openDevTools returned but targetId is: ${result.targetId}`);
        throw new Error('Target.openDevTools returned undefined targetId');
      }
    } catch (error) {
      logger.error('targetAgent.invoke_openDevTools failed', error);
      throw error;
    }
  }

  /**
   * Open DevTools for a target
   *
   * Strategy:
   * 1. Try browserTarget.targetAgent().invoke_openDevTools() - for SDK-managed connections
   * 2. Try browser-level WebSocket + Target.openDevTools - opens native DevTools window
   * 3. Skip gracefully if neither works
   */
  async #openDevToolsForTarget(targetId: string): Promise<void> {
    logger.info('Opening DevTools', `Target: ${targetId}`);

    const targetManager = SDK.TargetManager.TargetManager.instance();
    const browserTarget = targetManager.browserTarget();

    // APPROACH 1: Use browserTarget.targetAgent() (if available)
    if (browserTarget) {
      try {
        const targetAgent = browserTarget.targetAgent();
        logger.info('Approach 1', 'Using browserTarget.targetAgent().invoke_openDevTools()...');

        const result = await targetAgent.invoke_openDevTools({
          targetId: targetId as Protocol.Target.TargetID,
        });

        logger.info('DevTools opened', `Via browserTarget - DevTools target ID: ${result.targetId}`);
        return;
      } catch (error) {
        logger.error('browserTarget approach failed', error);
        // Fall through to browser WebSocket approach
      }
    }

    // APPROACH 2: Use DevTools' existing CDP connection (works without browserTarget, avoids 403)
    try {
      logger.info('Approach 2', 'Using DevTools existing CDP connection...');
      await this.#openDevToolsViaExistingConnection(targetId);
      return;
    } catch (error) {
      logger.error('Existing connection approach failed', error);
      // Fall through to graceful degradation
    }

    // APPROACH 3: Graceful degradation
    logger.warn('DevTools not opened',
      'Unable to open DevTools. Ensure browser is running with --remote-debugging-port flag. ' +
      'Navigation still works.');

    // Don't throw - let the caller continue with other actions
  }

  /**
   * Read page content from a tab via CDP Target.attachToTarget
   * Attaches to the target, reads content, then detaches
   */
  async #readPageViaAttachment(targetId: string): Promise<void> {
    logger.info('CDP attachment', `Attaching to target ${targetId} to read page content`);

    // Get the primary page target (the tab being inspected)
    const targetManager = SDK.TargetManager.TargetManager.instance();
    const primaryTarget = targetManager.primaryPageTarget();

    if (!primaryTarget) {
      throw new Error('No primary page target available');
    }

    const targetAgent = primaryTarget.targetAgent();
    let sessionId: string | null = null;

    try {
      // Attach to the target - this auto-creates a Target object in TargetManager!
      logger.info('Attaching', 'Calling Target.attachToTarget...');
      const response = await targetAgent.invoke_attachToTarget({
        targetId: targetId as Protocol.Target.TargetID,
        flatten: true,  // Flat mode for easier session management
      });

      sessionId = response.sessionId;
      logger.info('Attached', `Session ID: ${sessionId}`);

      // Wait a moment for the Target object to be registered in TargetManager
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now get the auto-created Target object
      const attachedTarget = targetManager.targetById(targetId);

      if (!attachedTarget) {
        throw new Error('Target object not created after attachment');
      }

      logger.info('Target found', `Using auto-created Target object for ${targetId}`);

      // Read page content using Runtime.evaluate
      const runtimeAgent = attachedTarget.runtimeAgent();

      // Get page title
      const titleResult = await runtimeAgent.invoke_evaluate({
        expression: 'document.title',
        returnByValue: true,
      });

      // Get page URL
      const urlResult = await runtimeAgent.invoke_evaluate({
        expression: 'window.location.href',
        returnByValue: true,
      });

      // Get page text preview (first 500 chars)
      const textResult = await runtimeAgent.invoke_evaluate({
        expression: 'document.body ? document.body.innerText.substring(0, 500) : "No body content"',
        returnByValue: true,
      });

      // Log the results
      logger.info('📄 Page Title', titleResult.result.value || 'No title');
      logger.info('🔗 Page URL', urlResult.result.value || 'No URL');
      logger.info('📝 Content Preview', textResult.result.value || 'No content');

      logger.info('Read complete', 'Successfully read page content!');

    } catch (error) {
      logger.error('Attachment/reading failed', error);
      throw error;

    } finally {
      // Always detach when done
      if (sessionId) {
        try {
          await targetAgent.invoke_detachFromTarget({sessionId: sessionId as Protocol.Target.SessionID});
          logger.info('Detached', 'Detached from target');
        } catch (detachError) {
          logger.error('Detach failed', detachError);
        }
      }
    }
  }

  /**
   * Read page content from a target that's already attached
   */
  async #readPageContent(target: SDK.Target.Target): Promise<void> {
    logger.info('Reading page', `Reading content from ${target.id()}`);

    try {
      const runtimeAgent = target.runtimeAgent();

      // Get page title
      const titleResult = await runtimeAgent.invoke_evaluate({
        expression: 'document.title',
        returnByValue: true,
      });

      // Get page URL
      const urlResult = await runtimeAgent.invoke_evaluate({
        expression: 'window.location.href',
        returnByValue: true,
      });

      // Get page text preview
      const textResult = await runtimeAgent.invoke_evaluate({
        expression: 'document.body ? document.body.innerText.substring(0, 500) : "No body content"',
        returnByValue: true,
      });

      // Log the results
      logger.info('📄 Page Title', titleResult.result.value || 'No title');
      logger.info('🔗 Page URL', urlResult.result.value || 'No URL');
      logger.info('📝 Content Preview', textResult.result.value || 'No content');

      logger.info('Read complete', 'Successfully read page content!');
    } catch (error) {
      logger.error('Reading failed', error);
      throw error;
    }
  }

  /**
   * Handle tab selection - read page content AND open DevTools
   * Supports both attached targets (via Target object) and HTTP-discovered targets (via CDP attachment)
   */
  async #onTabSelected(targetOrId: SDK.Target.Target | string): Promise<void> {
    let targetId: string;
    let targetInfo: Protocol.Target.TargetInfo | undefined;

    // Get target ID and info
    if (typeof targetOrId === 'string') {
      targetId = targetOrId;
      targetInfo = this.#discoveredTargetInfos.get(targetId);
    } else {
      const target = targetOrId;
      targetId = target.id();
      targetInfo = target.targetInfo();
    }

    if (!targetInfo) {
      logger.error('Action failed', 'Target info not found');
      return;
    }

    logger.info('Tab selected', `${targetInfo.title} (${targetInfo.url})`);
    logger.info('Actions', 'Will read page content AND open DevTools');

    // ACTION 1: Read page content
    // Try local SDK access first (fast path), fall back to CDP attachment if needed
    try {
      const targetManager = SDK.TargetManager.TargetManager.instance();
      const localTarget = targetManager.targetById(targetId);

      if (localTarget) {
        // FAST PATH: Use local SDK access (no attachment needed)
        logger.info('Reading', 'Using local Target object (fast path)...');
        await this.#readPageContent(localTarget);
      } else {
        // FALLBACK: Use CDP attachment (remote access)
        logger.info('Reading', 'No local Target - using CDP attachment (fallback)...');
        await this.#readPageViaAttachment(targetId);
      }
    } catch (readError) {
      logger.error('Reading failed', readError);
      // Continue to try opening DevTools even if reading fails
    }

    // ACTION 2: Open DevTools
    try {
      logger.info('DevTools action', 'Opening DevTools for tab...');
      await this.#openDevToolsForTarget(targetId);
    } catch (devtoolsError) {
      logger.error('DevTools opening failed', devtoolsError);
      // Reading already completed, so this is not critical
    }

    logger.info('Actions complete', 'Both actions attempted');
  }

  /**
   * Called when a target is added to the browser
   */
  targetAdded(target: SDK.Target.Target): void {
    if (target.type() === SDK.Target.Type.FRAME && target.outermostTarget() === target) {
      logger.debug(`Target added: ${target.name()}`);
      this.#updateAvailableTargets();
    }
  }

  /**
   * Called when a target is removed from the browser
   */
  targetRemoved(target: SDK.Target.Target): void {
    if (target.type() === SDK.Target.Type.FRAME && target.outermostTarget() === target) {
      logger.debug(`Target removed: ${target.name()}`);
      this.#updateAvailableTargets();
    }
  }
}
