// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString } from '../i18n-strings.js';
import {
  getEvaluationConfig,
  setEvaluationConfig,
  isEvaluationEnabled,
  connectToEvaluationService,
  disconnectFromEvaluationService,
  getEvaluationClientId,
  isEvaluationConnected
} from '../../../common/EvaluationConfig.js';
import { createLogger } from '../../../core/Logger.js';

const logger = createLogger('EvaluationSettings');

/**
 * Evaluation Service Settings
 *
 * Migrated from SettingsDialog.ts lines 2953-3185
 */
export class EvaluationSettings {
  private container: HTMLElement;
  private statusUpdateInterval: number | null = null;
  private evaluationEnabledCheckbox: HTMLInputElement | null = null;
  private evaluationEndpointInput: HTMLInputElement | null = null;
  private evaluationSecretKeyInput: HTMLInputElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';
    this.container.className = 'settings-section evaluation-section';

    // Title
    const evaluationSectionTitle = document.createElement('h3');
    evaluationSectionTitle.className = 'settings-subtitle';
    evaluationSectionTitle.textContent = i18nString('evaluationSection');
    this.container.appendChild(evaluationSectionTitle);

    // Get current evaluation configuration
    const currentEvaluationConfig = getEvaluationConfig();

    // Evaluation enabled checkbox
    const evaluationEnabledContainer = document.createElement('div');
    evaluationEnabledContainer.className = 'evaluation-enabled-container';
    this.container.appendChild(evaluationEnabledContainer);

    this.evaluationEnabledCheckbox = document.createElement('input');
    this.evaluationEnabledCheckbox.type = 'checkbox';
    this.evaluationEnabledCheckbox.id = 'evaluation-enabled';
    this.evaluationEnabledCheckbox.className = 'evaluation-checkbox';
    this.evaluationEnabledCheckbox.checked = isEvaluationEnabled();
    evaluationEnabledContainer.appendChild(this.evaluationEnabledCheckbox);

    const evaluationEnabledLabel = document.createElement('label');
    evaluationEnabledLabel.htmlFor = 'evaluation-enabled';
    evaluationEnabledLabel.className = 'evaluation-label';
    evaluationEnabledLabel.textContent = i18nString('evaluationEnabled');
    evaluationEnabledContainer.appendChild(evaluationEnabledLabel);

    const evaluationEnabledHint = document.createElement('div');
    evaluationEnabledHint.className = 'settings-hint';
    evaluationEnabledHint.textContent = i18nString('evaluationEnabledHint');
    this.container.appendChild(evaluationEnabledHint);

    // Connection status indicator
    const connectionStatusContainer = document.createElement('div');
    connectionStatusContainer.className = 'connection-status-container';
    connectionStatusContainer.style.display = 'flex';
    connectionStatusContainer.style.alignItems = 'center';
    connectionStatusContainer.style.gap = '8px';
    connectionStatusContainer.style.marginTop = '8px';
    connectionStatusContainer.style.fontSize = '13px';
    this.container.appendChild(connectionStatusContainer);

    const connectionStatusDot = document.createElement('div');
    connectionStatusDot.className = 'connection-status-dot';
    connectionStatusDot.style.width = '8px';
    connectionStatusDot.style.height = '8px';
    connectionStatusDot.style.borderRadius = '50%';
    connectionStatusDot.style.flexShrink = '0';
    connectionStatusContainer.appendChild(connectionStatusDot);

    const connectionStatusText = document.createElement('span');
    connectionStatusText.className = 'connection-status-text';
    connectionStatusContainer.appendChild(connectionStatusText);

    // Function to update connection status
    const updateConnectionStatus = () => {
      const isConnected = isEvaluationConnected();

      logger.debug('Updating connection status', { isConnected });

      if (isConnected) {
        connectionStatusDot.style.backgroundColor = 'var(--color-accent-green)';
        connectionStatusText.textContent = 'Connected to evaluation server';
        connectionStatusText.style.color = 'var(--color-accent-green)';
      } else {
        connectionStatusDot.style.backgroundColor = 'var(--color-text-disabled)';
        connectionStatusText.textContent = 'Not connected';
        connectionStatusText.style.color = 'var(--color-text-disabled)';
      }
    };

    // Update status initially and when evaluation is enabled/disabled
    updateConnectionStatus();

    // Set up periodic status updates every 2 seconds
    this.statusUpdateInterval = setInterval(updateConnectionStatus, 2000);

    // Evaluation configuration container (shown when enabled)
    const evaluationConfigContainer = document.createElement('div');
    evaluationConfigContainer.className = 'evaluation-config-container';
    evaluationConfigContainer.style.display = this.evaluationEnabledCheckbox.checked ? 'block' : 'none';
    this.container.appendChild(evaluationConfigContainer);

    // Client ID display (read-only)
    const clientIdLabel = document.createElement('div');
    clientIdLabel.className = 'settings-label';
    clientIdLabel.textContent = 'Client ID';
    evaluationConfigContainer.appendChild(clientIdLabel);

    const clientIdHint = document.createElement('div');
    clientIdHint.className = 'settings-hint';
    clientIdHint.textContent = 'Unique identifier for this DevTools instance';
    evaluationConfigContainer.appendChild(clientIdHint);

    const clientIdInput = document.createElement('input');
    clientIdInput.type = 'text';
    clientIdInput.className = 'settings-input';
    clientIdInput.value = currentEvaluationConfig.clientId || 'Auto-generated on first connection';
    clientIdInput.readOnly = true;
    clientIdInput.style.backgroundColor = 'var(--color-background-elevation-1)';
    clientIdInput.style.cursor = 'default';
    evaluationConfigContainer.appendChild(clientIdInput);

    // Evaluation endpoint
    const evaluationEndpointLabel = document.createElement('div');
    evaluationEndpointLabel.className = 'settings-label';
    evaluationEndpointLabel.textContent = i18nString('evaluationEndpoint');
    evaluationConfigContainer.appendChild(evaluationEndpointLabel);

    const evaluationEndpointHint = document.createElement('div');
    evaluationEndpointHint.className = 'settings-hint';
    evaluationEndpointHint.textContent = i18nString('evaluationEndpointHint');
    evaluationConfigContainer.appendChild(evaluationEndpointHint);

    this.evaluationEndpointInput = document.createElement('input');
    this.evaluationEndpointInput.type = 'text';
    this.evaluationEndpointInput.className = 'settings-input';
    this.evaluationEndpointInput.placeholder = 'ws://localhost:8080';
    this.evaluationEndpointInput.value = currentEvaluationConfig.endpoint || 'ws://localhost:8080';
    evaluationConfigContainer.appendChild(this.evaluationEndpointInput);

    // Evaluation secret key
    const evaluationSecretKeyLabel = document.createElement('div');
    evaluationSecretKeyLabel.className = 'settings-label';
    evaluationSecretKeyLabel.textContent = i18nString('evaluationSecretKey');
    evaluationConfigContainer.appendChild(evaluationSecretKeyLabel);

    const evaluationSecretKeyHint = document.createElement('div');
    evaluationSecretKeyHint.className = 'settings-hint';
    evaluationSecretKeyHint.textContent = i18nString('evaluationSecretKeyHint');
    evaluationConfigContainer.appendChild(evaluationSecretKeyHint);

    this.evaluationSecretKeyInput = document.createElement('input');
    this.evaluationSecretKeyInput.type = 'password';
    this.evaluationSecretKeyInput.className = 'settings-input';
    this.evaluationSecretKeyInput.placeholder = 'Optional secret key';
    this.evaluationSecretKeyInput.value = currentEvaluationConfig.secretKey || '';
    evaluationConfigContainer.appendChild(this.evaluationSecretKeyInput);

    // Connection status message
    const connectionStatusMessage = document.createElement('div');
    connectionStatusMessage.className = 'settings-status';
    connectionStatusMessage.style.display = 'none';
    evaluationConfigContainer.appendChild(connectionStatusMessage);

    // Auto-connect when evaluation is enabled/disabled
    this.evaluationEnabledCheckbox.addEventListener('change', async () => {
      const isEnabled = this.evaluationEnabledCheckbox!.checked;
      evaluationConfigContainer.style.display = isEnabled ? 'block' : 'none';

      // Show connection status
      connectionStatusMessage.style.display = 'block';

      if (isEnabled) {
        // Auto-connect when enabled
        connectionStatusMessage.textContent = 'Connecting...';
        connectionStatusMessage.style.backgroundColor = 'var(--color-background-elevation-1)';
        connectionStatusMessage.style.color = 'var(--color-text-primary)';

        try {
          const endpoint = this.evaluationEndpointInput!.value.trim() || 'ws://localhost:8080';
          const secretKey = this.evaluationSecretKeyInput!.value.trim();

          // Update config and connect
          setEvaluationConfig({
            enabled: true,
            endpoint,
            secretKey
          });

          await connectToEvaluationService();

          // Update client ID display after connection
          const clientId = getEvaluationClientId();
          if (clientId) {
            clientIdInput.value = clientId;
          }

          connectionStatusMessage.textContent = '✓ Connected successfully';
          connectionStatusMessage.style.backgroundColor = 'var(--color-accent-green-background)';
          connectionStatusMessage.style.color = 'var(--color-accent-green)';

          // Update connection status indicator
          setTimeout(updateConnectionStatus, 500);
        } catch (error) {
          connectionStatusMessage.textContent = `✗ ${error instanceof Error ? error.message : 'Connection failed'}`;
          connectionStatusMessage.style.backgroundColor = 'var(--color-accent-red-background)';
          connectionStatusMessage.style.color = 'var(--color-accent-red)';

          // Uncheck the checkbox if connection failed
          this.evaluationEnabledCheckbox!.checked = false;
          evaluationConfigContainer.style.display = 'none';
        }
      } else {
        // Auto-disconnect when disabled
        connectionStatusMessage.textContent = 'Disconnecting...';
        connectionStatusMessage.style.backgroundColor = 'var(--color-background-elevation-1)';
        connectionStatusMessage.style.color = 'var(--color-text-primary)';

        try {
          disconnectFromEvaluationService();

          // Update config
          setEvaluationConfig({
            enabled: false,
            endpoint: this.evaluationEndpointInput!.value.trim() || 'ws://localhost:8080',
            secretKey: this.evaluationSecretKeyInput!.value.trim()
          });

          connectionStatusMessage.textContent = '✓ Disconnected';
          connectionStatusMessage.style.backgroundColor = 'var(--color-background-elevation-1)';
          connectionStatusMessage.style.color = 'var(--color-text-primary)';

          // Update connection status indicator
          updateConnectionStatus();
        } catch (error) {
          connectionStatusMessage.textContent = `✗ Disconnect error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          connectionStatusMessage.style.backgroundColor = 'var(--color-accent-red-background)';
          connectionStatusMessage.style.color = 'var(--color-accent-red)';
        }
      }

      // Hide status message after 3 seconds
      setTimeout(() => {
        connectionStatusMessage.style.display = 'none';
      }, 3000);
    });
  }

  save(): void {
    // Evaluation settings are auto-saved on enable/disable toggle
    // Final save happens in the checkbox change handler
    if (!this.evaluationEnabledCheckbox || !this.evaluationEndpointInput || !this.evaluationSecretKeyInput) {
      return;
    }

    setEvaluationConfig({
      enabled: this.evaluationEnabledCheckbox.checked,
      endpoint: this.evaluationEndpointInput.value.trim() || 'ws://localhost:8080',
      secretKey: this.evaluationSecretKeyInput.value.trim()
    });
  }

  cleanup(): void {
    if (this.statusUpdateInterval !== null) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }
}
