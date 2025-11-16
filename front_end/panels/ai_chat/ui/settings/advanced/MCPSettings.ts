// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString, UIStrings } from '../i18n-strings.js';
import {
  getMCPConfig,
  setMCPConfig,
  getStoredAuthErrors,
  clearStoredAuthError
} from '../../../mcp/MCPConfig.js';
import { MCPRegistry } from '../../../mcp/MCPRegistry.js';
import { MCPConnectionsDialog } from '../../mcp/MCPConnectionsDialog.js';
import { createLogger } from '../../../core/Logger.js';

const logger = createLogger('MCPSettings');

/**
 * MCP (Model Context Protocol) Integration Settings
 *
 * Migrated from SettingsDialog.ts lines 1309-1858
 *
 * Features:
 * - Connection management (manage/reconnect buttons)
 * - Tool selection mode (all/router/meta)
 * - Budget controls (max tools per turn)
 * - Real-time status updates (every 10 seconds)
 * - Per-server status indicators
 */
export class MCPSettings {
  private container: HTMLElement;
  private statusUpdateInterval: number | null = null;
  private mcpActionsContainer: HTMLElement | null = null;
  private mcpStatusDetails: HTMLElement | null = null;
  private mcpStatusDot: HTMLElement | null = null;
  private mcpStatusText: HTMLElement | null = null;
  private onSettingsSaved: () => void;
  private onDialogHide: () => void;

  constructor(container: HTMLElement, onSettingsSaved: () => void, onDialogHide: () => void) {
    this.container = container;
    this.onSettingsSaved = onSettingsSaved;
    this.onDialogHide = onDialogHide;
  }

  render(): void {
    // Implementation split into parts due to size - continued below
    this.renderHeader();
    this.renderStatusDisplay();
    this.renderActionButtons();
    this.renderConnectionManagement();
    this.renderConfigOptions();
  }

  private renderHeader(): void {
    // Clear any existing content
    this.container.innerHTML = '';
    this.container.className = 'settings-section mcp-section';
    this.container.style.display = 'block';

    // Title
    const mcpSectionTitle = document.createElement('h3');
    mcpSectionTitle.className = 'settings-subtitle';
    mcpSectionTitle.textContent = i18nString(UIStrings.mcpSection);
    this.container.appendChild(mcpSectionTitle);
  }

  private renderStatusDisplay(): void {
    // Status indicator
    const mcpStatusContainer = document.createElement('div');
    mcpStatusContainer.className = 'connection-status-container';
    mcpStatusContainer.style.display = 'flex';
    mcpStatusContainer.style.alignItems = 'center';
    mcpStatusContainer.style.gap = '8px';
    mcpStatusContainer.style.marginTop = '8px';
    mcpStatusContainer.style.fontSize = '13px';
    this.container.appendChild(mcpStatusContainer);

    this.mcpStatusDot = document.createElement('div');
    this.mcpStatusDot.className = 'connection-status-dot';
    this.mcpStatusDot.style.width = '8px';
    this.mcpStatusDot.style.height = '8px';
    this.mcpStatusDot.style.borderRadius = '50%';
    this.mcpStatusDot.style.flexShrink = '0';
    mcpStatusContainer.appendChild(this.mcpStatusDot);

    this.mcpStatusText = document.createElement('span');
    this.mcpStatusText.className = 'connection-status-text';
    mcpStatusContainer.appendChild(this.mcpStatusText);

    this.mcpStatusDetails = document.createElement('div');
    this.mcpStatusDetails.className = 'settings-hint';
    this.mcpStatusDetails.style.marginTop = '12px';
    this.mcpStatusDetails.style.display = 'flex';
    this.mcpStatusDetails.style.flexDirection = 'column';
    this.mcpStatusDetails.style.gap = '8px';
    this.container.appendChild(this.mcpStatusDetails);

    // Update status initially
    this.updateMCPStatus();

    // Set up periodic MCP status updates every 10 seconds
    this.statusUpdateInterval = setInterval(() => this.updateMCPStatus(), 10000);
  }

  private renderActionButtons(): void {
    // Action buttons row (shown when connected)
    this.mcpActionsContainer = document.createElement('div');
    this.mcpActionsContainer.style.marginTop = '12px';
    this.mcpActionsContainer.style.marginBottom = '8px';
    this.mcpActionsContainer.style.display = 'flex';
    this.mcpActionsContainer.style.gap = '8px';
    this.mcpActionsContainer.style.flexWrap = 'wrap';
    this.container.appendChild(this.mcpActionsContainer);

    // Disconnect button
    const mcpDisconnectButton = document.createElement('button');
    mcpDisconnectButton.textContent = 'Disconnect';
    mcpDisconnectButton.className = 'settings-button';
    mcpDisconnectButton.style.backgroundColor = '#fee2e2';
    mcpDisconnectButton.style.border = '1px solid #fecaca';
    mcpDisconnectButton.style.color = '#dc2626';
    mcpDisconnectButton.style.padding = '6px 12px';
    mcpDisconnectButton.style.borderRadius = '6px';
    mcpDisconnectButton.style.cursor = 'pointer';
    mcpDisconnectButton.style.fontSize = '12px';
    mcpDisconnectButton.style.fontWeight = '500';
    mcpDisconnectButton.addEventListener('click', async () => {
      try {
        MCPRegistry.dispose();
        this.updateMCPStatus();
        this.updateActionButtons();
      } catch (err) {
        logger.error('Failed to disconnect MCP:', err);
      }
    });
    this.mcpActionsContainer.appendChild(mcpDisconnectButton);

    // Manage connections button
    const mcpManageButton = document.createElement('button');
    mcpManageButton.textContent = 'Manage connections';
    mcpManageButton.className = 'settings-button';
    mcpManageButton.style.backgroundColor = 'var(--color-background-elevation-1)';
    mcpManageButton.style.border = '1px solid var(--color-details-hairline)';
    mcpManageButton.style.color = 'var(--color-text-primary)';
    mcpManageButton.style.padding = '6px 12px';
    mcpManageButton.style.borderRadius = '6px';
    mcpManageButton.style.cursor = 'pointer';
    mcpManageButton.style.fontSize = '12px';
    mcpManageButton.style.fontWeight = '500';
    mcpManageButton.addEventListener('click', () => {
      this.onDialogHide();
      MCPConnectionsDialog.show();
    });
    this.mcpActionsContainer.appendChild(mcpManageButton);

    // Reconnect all button
    const mcpReconnectAllButton = document.createElement('button');
    mcpReconnectAllButton.textContent = 'Reconnect all';
    mcpReconnectAllButton.className = 'settings-button';
    mcpReconnectAllButton.style.backgroundColor = '#dbeafe';
    mcpReconnectAllButton.style.border = '1px solid #bfdbfe';
    mcpReconnectAllButton.style.color = '#1d4ed8';
    mcpReconnectAllButton.style.padding = '6px 12px';
    mcpReconnectAllButton.style.borderRadius = '6px';
    mcpReconnectAllButton.style.cursor = 'pointer';
    mcpReconnectAllButton.style.fontSize = '12px';
    mcpReconnectAllButton.style.fontWeight = '500';
    mcpReconnectAllButton.addEventListener('click', async () => {
      mcpReconnectAllButton.disabled = true;
      mcpReconnectAllButton.textContent = 'Reconnecting...';
      try {
        await MCPRegistry.init(true);
        this.updateMCPStatus();
        this.updateActionButtons();
      } catch (err) {
        logger.error('Failed to reconnect all MCP servers:', err);
      } finally {
        mcpReconnectAllButton.disabled = false;
        mcpReconnectAllButton.textContent = 'Reconnect all';
      }
    });
    this.mcpActionsContainer.appendChild(mcpReconnectAllButton);

    this.updateActionButtons();
  }

  private renderConnectionManagement(): void {
    // Connections management
    const mcpConnectionsLabel = document.createElement('div');
    mcpConnectionsLabel.className = 'settings-label';
    mcpConnectionsLabel.textContent = i18nString(UIStrings.mcpConnectionsHeader);
    this.container.appendChild(mcpConnectionsLabel);

    const mcpConnectionsHint = document.createElement('div');
    mcpConnectionsHint.className = 'settings-hint';
    mcpConnectionsHint.textContent = i18nString(UIStrings.mcpConnectionsHint);
    this.container.appendChild(mcpConnectionsHint);

    const mcpConnectionsActions = document.createElement('div');
    mcpConnectionsActions.className = 'mcp-connections-actions';
    mcpConnectionsActions.style.display = 'flex';
    mcpConnectionsActions.style.gap = '8px';
    mcpConnectionsActions.style.marginBottom = '12px';
    this.container.appendChild(mcpConnectionsActions);

    const manageConnectionsButton = document.createElement('button');
    manageConnectionsButton.className = 'settings-button';
    manageConnectionsButton.textContent = i18nString(UIStrings.mcpManageConnections);
    manageConnectionsButton.addEventListener('click', () => {
      MCPConnectionsDialog.show({
        onSave: async () => {
          try {
            await MCPRegistry.init(true);
            await MCPRegistry.refresh();
          } catch (err) {
            logger.error('Failed to refresh MCP connections after save', err);
          } finally {
            this.updateMCPStatus();
            this.updateActionButtons();
            this.onSettingsSaved();
          }
        },
      });
    });
    mcpConnectionsActions.appendChild(manageConnectionsButton);

    const refreshConnectionsButton = document.createElement('button');
    refreshConnectionsButton.className = 'settings-button';
    refreshConnectionsButton.textContent = i18nString(UIStrings.mcpRefreshConnections);
    refreshConnectionsButton.addEventListener('click', async () => {
      try {
        await MCPRegistry.init(true);
        await MCPRegistry.refresh();
      } catch (err) {
        logger.error('Failed to refresh MCP connections', err);
      } finally {
        this.updateMCPStatus();
        this.updateActionButtons();
      }
    });
    mcpConnectionsActions.appendChild(refreshConnectionsButton);
  }

  private renderConfigOptions(): void {
    const currentMCPConfig = getMCPConfig();

    // MCP config inputs (always visible since MCP is always enabled)
    const mcpConfigContainer = document.createElement('div');
    mcpConfigContainer.className = 'mcp-config-container';
    mcpConfigContainer.style.display = 'block';
    this.container.appendChild(mcpConfigContainer);

    // Tool mode selection
    const mcpToolModeLabel = document.createElement('div');
    mcpToolModeLabel.className = 'settings-label';
    mcpToolModeLabel.textContent = i18nString(UIStrings.mcpToolMode);
    mcpConfigContainer.appendChild(mcpToolModeLabel);

    const mcpToolModeHint = document.createElement('div');
    mcpToolModeHint.className = 'settings-hint';
    mcpToolModeHint.textContent = i18nString(UIStrings.mcpToolModeHint);
    mcpConfigContainer.appendChild(mcpToolModeHint);

    const mcpToolModeSelect = document.createElement('select');
    mcpToolModeSelect.className = 'settings-select';
    mcpConfigContainer.appendChild(mcpToolModeSelect);

    // Tool mode options
    const toolModeOptions = [
      { value: 'all', text: i18nString(UIStrings.mcpToolModeAll) },
      { value: 'router', text: i18nString(UIStrings.mcpToolModeRouter) },
      { value: 'meta', text: i18nString(UIStrings.mcpToolModeMeta) },
    ];

    toolModeOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if ((currentMCPConfig.toolMode || 'router') === option.value) {
        optionElement.selected = true;
      }
      mcpToolModeSelect.appendChild(optionElement);
    });

    // Ensure the select reflects the currently stored mode
    mcpToolModeSelect.value = (currentMCPConfig.toolMode || 'router');

    // Handle tool mode changes
    mcpToolModeSelect.addEventListener('change', () => {
      setMCPConfig({ toolMode: mcpToolModeSelect.value as 'all' | 'router' | 'meta' });
      this.onSettingsSaved();
    });

    // Advanced budget controls
    const mcpMaxToolsLabel = document.createElement('div');
    mcpMaxToolsLabel.className = 'settings-label';
    mcpMaxToolsLabel.textContent = i18nString(UIStrings.mcpMaxToolsPerTurn);
    mcpConfigContainer.appendChild(mcpMaxToolsLabel);

    const mcpMaxToolsHint = document.createElement('div');
    mcpMaxToolsHint.className = 'settings-hint';
    mcpMaxToolsHint.textContent = i18nString(UIStrings.mcpMaxToolsPerTurnHint);
    mcpConfigContainer.appendChild(mcpMaxToolsHint);

    const mcpMaxToolsInput = document.createElement('input');
    mcpMaxToolsInput.type = 'number';
    mcpMaxToolsInput.className = 'settings-input';
    mcpMaxToolsInput.min = '1';
    mcpMaxToolsInput.max = '100';
    mcpMaxToolsInput.value = String(currentMCPConfig.maxToolsPerTurn || 20);
    mcpConfigContainer.appendChild(mcpMaxToolsInput);

    const mcpMaxMcpLabel = document.createElement('div');
    mcpMaxMcpLabel.className = 'settings-label';
    mcpMaxMcpLabel.textContent = i18nString(UIStrings.mcpMaxMcpPerTurn);
    mcpConfigContainer.appendChild(mcpMaxMcpLabel);

    const mcpMaxMcpHint = document.createElement('div');
    mcpMaxMcpHint.className = 'settings-hint';
    mcpMaxMcpHint.textContent = i18nString(UIStrings.mcpMaxMcpPerTurnHint);
    mcpConfigContainer.appendChild(mcpMaxMcpHint);

    const mcpMaxMcpInput = document.createElement('input');
    mcpMaxMcpInput.type = 'number';
    mcpMaxMcpInput.className = 'settings-input';
    mcpMaxMcpInput.min = '1';
    mcpMaxMcpInput.max = '50';
    mcpMaxMcpInput.value = String(currentMCPConfig.maxMcpPerTurn || 8);
    mcpConfigContainer.appendChild(mcpMaxMcpInput);

    // Handle budget control changes
    const updateBudgetControls = () => {
      const maxTools = Math.max(1, Math.min(100, parseInt(mcpMaxToolsInput.value, 10) || 20));
      const maxMcp = Math.max(1, Math.min(50, parseInt(mcpMaxMcpInput.value, 10) || 8));
      setMCPConfig({
        maxToolsPerTurn: maxTools,
        maxMcpPerTurn: maxMcp,
      });
      this.onSettingsSaved();
    };

    mcpMaxToolsInput.addEventListener('change', updateBudgetControls);
    mcpMaxMcpInput.addEventListener('change', updateBudgetControls);
  }

  private formatTimestamp(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleString();
  }

  private formatMCPError(error: string, errorType?: string): {message: string, hint?: string} {
    if (!errorType) return {message: error};
    switch (errorType) {
      case 'connection':
        return {message: `Connection failed: ${error}`, hint: 'Check if the MCP server is running and the endpoint URL is correct.'};
      case 'authentication':
        return {message: `Authentication failed: ${error}`, hint: 'Verify your auth token is correct and has not expired.'};
      case 'configuration':
        return {message: `Configuration error: ${error}`, hint: 'Check your endpoint URL format (should be ws:// or wss://).'};
      case 'network':
        return {message: `Network error: ${error}`, hint: 'Check your internet connection and firewall settings.'};
      case 'server_error':
        return {message: `Server error: ${error}`, hint: 'The MCP server encountered an internal error. Contact the server administrator.'};
      default:
        return {message: error};
    }
  }

  private updateMCPStatus(): void {
    if (!this.mcpStatusDot || !this.mcpStatusText || !this.mcpStatusDetails) {
      return;
    }

    const status = MCPRegistry.getStatus();

    const appendServerRow = (server: typeof status.servers[number], isConnected: boolean) => {
      if (!this.mcpStatusDetails) return;

      const authErrors = getStoredAuthErrors();
      const serverAuthError = authErrors.find(error => error.serverId === server.id);

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'flex-start';
      row.style.gap = '8px';
      row.style.marginBottom = '6px';
      row.style.padding = '8px';
      row.style.borderRadius = '6px';
      row.style.backgroundColor = 'var(--color-background-elevation-1)';
      row.style.border = '1px solid var(--color-details-hairline)';

      const statusDot = document.createElement('span');
      statusDot.style.width = '6px';
      statusDot.style.height = '6px';
      statusDot.style.borderRadius = '50%';
      statusDot.style.marginTop = '8px';
      statusDot.style.flexShrink = '0';

      const serverInfo = document.createElement('div');
      serverInfo.style.flex = '1';
      serverInfo.style.minWidth = '0';

      const serverNameLine = document.createElement('div');
      serverNameLine.style.display = 'flex';
      serverNameLine.style.alignItems = 'center';
      serverNameLine.style.gap = '8px';
      serverNameLine.style.marginBottom = '4px';
      serverNameLine.style.flexWrap = 'wrap';

      const serverName = document.createElement('span');
      serverName.style.fontWeight = '600';
      serverName.style.color = 'var(--color-text-primary)';
      serverName.style.fontSize = '13px';
      serverName.textContent = server.name || server.id;

      const statusBadge = document.createElement('span');
      statusBadge.style.fontSize = '10px';
      statusBadge.style.padding = '2px 6px';
      statusBadge.style.borderRadius = '12px';
      statusBadge.style.fontWeight = '500';
      statusBadge.style.textTransform = 'uppercase';
      statusBadge.style.letterSpacing = '0.5px';

      if (isConnected) {
        if (server.toolCount === 0) {
          statusDot.style.backgroundColor = '#f59e0b';
          statusBadge.style.backgroundColor = '#fef3c7';
          statusBadge.style.color = '#92400e';
          statusBadge.textContent = 'Discovering';
        } else {
          statusDot.style.backgroundColor = '#10b981';
          statusBadge.style.backgroundColor = '#d1fae5';
          statusBadge.style.color = '#065f46';
          statusBadge.textContent = 'Connected';
        }
      } else {
        if (serverAuthError) {
          statusDot.style.backgroundColor = '#ef4444';
          statusBadge.style.backgroundColor = '#fee2e2';
          statusBadge.style.color = '#991b1b';
          statusBadge.textContent = 'Auth Required';
        } else {
          statusDot.style.backgroundColor = '#9ca3af';
          statusBadge.style.backgroundColor = '#f3f4f6';
          statusBadge.style.color = '#6b7280';
          statusBadge.textContent = 'Disconnected';
        }
      }

      serverNameLine.appendChild(serverName);
      serverNameLine.appendChild(statusBadge);

      const detailsLine = document.createElement('div');
      detailsLine.style.fontSize = '11px';
      detailsLine.style.color = 'var(--color-text-secondary)';
      const toolCountText = server.toolCount === 0 && isConnected ? 'Tools loading...' : `${server.toolCount} tools`;
      detailsLine.textContent = `${toolCountText} • ${server.authType === 'oauth' ? 'OAuth' : 'Bearer'}`;

      serverInfo.appendChild(serverNameLine);
      serverInfo.appendChild(detailsLine);
      row.appendChild(statusDot);
      row.appendChild(serverInfo);

      const needsReconnect = server.authType === 'oauth' && !isConnected;
      if (needsReconnect) {
        const reconnectButton = document.createElement('button');
        reconnectButton.className = 'settings-button';
        reconnectButton.style.padding = '2px 8px';
        reconnectButton.style.fontSize = '12px';
        reconnectButton.textContent = i18nString(UIStrings.mcpReconnectButton);
        reconnectButton.addEventListener('click', async () => {
          reconnectButton.disabled = true;
          reconnectButton.textContent = i18nString(UIStrings.mcpReconnectInProgress);
          try {
            await MCPRegistry.reconnect(server.id);
            clearStoredAuthError(server.id);
          } catch (err) {
            logger.error('Failed to reconnect MCP server', { serverId: server.id, error: err });
            reconnectButton.disabled = false;
            reconnectButton.textContent = i18nString(UIStrings.mcpReconnectRetry);
            return;
          } finally {
            this.updateMCPStatus();
            this.updateActionButtons();
          }
        });
        row.appendChild(reconnectButton);
      }

      this.mcpStatusDetails!.appendChild(row);

      if (serverAuthError) {
        const errorDetails = document.createElement('div');
        errorDetails.className = 'settings-hint';
        errorDetails.style.color = 'var(--color-error)';
        errorDetails.style.fontSize = '12px';
        errorDetails.style.marginTop = '2px';
        errorDetails.style.marginLeft = '16px';
        errorDetails.style.marginBottom = '4px';
        const timestamp = new Date(serverAuthError.timestamp).toLocaleString();
        errorDetails.textContent = `Last error (${timestamp}): ${serverAuthError.message}`;
        this.mcpStatusDetails!.appendChild(errorDetails);
      }
    };

    if (!status.enabled) {
      this.mcpStatusDot.style.backgroundColor = 'var(--color-text-disabled)';
      this.mcpStatusText.innerHTML = `<span style="color: var(--color-text-disabled); font-weight: 500;">⚫ Disabled</span>`;
      this.mcpStatusDetails.textContent = '';
      return;
    }

    const anyConnected = status.servers.some(s => s.connected);
    const toolCount = status.registeredToolNames.length;
    const authErrors = getStoredAuthErrors();
    const hasAuthErrors = authErrors.length > 0;

    if (anyConnected) {
      if (hasAuthErrors) {
        this.mcpStatusDot.style.backgroundColor = 'var(--color-warning)';
        this.mcpStatusText.innerHTML = `<span style="color: var(--color-warning); font-weight: 500;">🟡 Connected with issues</span> <span style="color: var(--color-text-secondary); font-size: 12px;">(${toolCount} tools)</span>`;
      } else {
        this.mcpStatusDot.style.backgroundColor = 'var(--color-accent-green)';
        this.mcpStatusText.innerHTML = `<span style="color: var(--color-accent-green); font-weight: 500;">🟢 Connected</span> <span style="color: var(--color-text-secondary); font-size: 12px;">(${toolCount} tools)</span>`;
      }

      this.mcpStatusDetails.textContent = '';
      if (status.servers.length > 0) {
        status.servers.forEach(server => appendServerRow(server, server.connected));
      }
      if (status.lastConnected) {
        const line = document.createElement('div');
        line.style.fontSize = '11px';
        line.style.color = 'var(--color-text-secondary)';
        line.style.marginTop = '8px';
        line.textContent = `Last connected: ${this.formatTimestamp(status.lastConnected)}`;
        this.mcpStatusDetails.appendChild(line);
      }
      if (status.lastError) {
        const {message, hint} = this.formatMCPError(status.lastError, status.lastErrorType);
        const errLine = document.createElement('div');
        const errSpan = document.createElement('span');
        errSpan.style.color = 'var(--color-error-text)';
        errSpan.textContent = message;
        errLine.appendChild(errSpan);
        this.mcpStatusDetails.appendChild(errLine);
        if (hint) {
          const hintLine = document.createElement('div');
          hintLine.style.color = 'var(--color-text-secondary)';
          hintLine.style.fontSize = '12px';
          hintLine.textContent = hint;
          this.mcpStatusDetails.appendChild(hintLine);
        }
      }
    } else {
      if (hasAuthErrors) {
        this.mcpStatusDot.style.backgroundColor = 'var(--color-error)';
        this.mcpStatusText.innerHTML = `<span style="color: var(--color-error); font-weight: 500;">🔴 Authentication required</span>`;
      } else {
        this.mcpStatusDot.style.backgroundColor = 'var(--color-text-disabled)';
        this.mcpStatusText.innerHTML = `<span style="color: var(--color-text-disabled); font-weight: 500;">⚪ Not connected</span>`;
      }

      this.mcpStatusDetails.textContent = '';
      if (status.servers.length > 0) {
        status.servers.forEach(server => appendServerRow(server, false));
      }
      if (status.lastDisconnected) {
        const line = document.createElement('div');
        line.style.fontSize = '11px';
        line.style.color = 'var(--color-text-secondary)';
        line.style.marginTop = '8px';
        line.textContent = `Last disconnected: ${this.formatTimestamp(status.lastDisconnected)}`;
        this.mcpStatusDetails.appendChild(line);
      }
      if (status.lastError) {
        const {message, hint} = this.formatMCPError(status.lastError, status.lastErrorType);
        const errLine = document.createElement('div');
        const errSpan = document.createElement('span');
        errSpan.style.color = 'var(--color-error-text)';
        errSpan.textContent = message;
        errLine.appendChild(errSpan);
        this.mcpStatusDetails.appendChild(errLine);
        if (hint) {
          const hintLine = document.createElement('div');
          hintLine.style.color = 'var(--color-text-secondary)';
          hintLine.style.fontSize = '12px';
          hintLine.textContent = hint;
          this.mcpStatusDetails.appendChild(hintLine);
        }
      }
    }
  }

  private updateActionButtons(): void {
    if (!this.mcpActionsContainer) return;
    const status = MCPRegistry.getStatus();
    const anyConnected = status.enabled && status.servers.some(s => s.connected);
    this.mcpActionsContainer.style.display = anyConnected ? 'flex' : 'none';
  }

  save(): void {
    // MCP settings are auto-saved on change
    // No need to save on dialog save
  }

  cleanup(): void {
    if (this.statusUpdateInterval !== null) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }
}
