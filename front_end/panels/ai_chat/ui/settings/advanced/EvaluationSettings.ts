// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString, UIStrings } from '../i18n-strings.js';
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
  private isEnabled: boolean = false;
  private toggleElement: HTMLDivElement | null = null;
  private evaluationEndpointInput: HTMLInputElement | null = null;
  private evaluationSecretKeyInput: HTMLInputElement | null = null;
  private configContainer: HTMLDivElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';
    this.container.className = 'settings-section evaluation-section';

    // Get current evaluation configuration
    const currentEvaluationConfig = getEvaluationConfig();
    this.isEnabled = isEvaluationEnabled();

    // Header with toggle
    const headerContainer = document.createElement('div');
    headerContainer.className = 'settings-toggle-container';
    this.container.appendChild(headerContainer);

    const infoContainer = document.createElement('div');
    infoContainer.className = 'settings-toggle-info';
    headerContainer.appendChild(infoContainer);

    const title = document.createElement('div');
    title.className = 'settings-toggle-title';
    title.textContent = i18nString(UIStrings.evaluationSection);
    infoContainer.appendChild(title);

    const description = document.createElement('div');
    description.className = 'settings-toggle-description';
    description.textContent = i18nString(UIStrings.evaluationEnabledHint);
    infoContainer.appendChild(description);

    // Toggle switch
    this.toggleElement = document.createElement('div');
    this.toggleElement.className = 'settings-toggle';
    if (this.isEnabled) {
      this.toggleElement.classList.add('active');
    }
    this.toggleElement.addEventListener('click', () => this.handleToggle());
    headerContainer.appendChild(this.toggleElement);

    // Configuration container (shown when enabled)
    this.configContainer = document.createElement('div');
    this.configContainer.className = 'evaluation-config-container';
    this.configContainer.style.display = this.isEnabled ? 'flex' : 'none';
    this.configContainer.style.flexDirection = 'column';
    this.configContainer.style.gap = '20px';
    this.configContainer.style.marginTop = '20px';
    this.container.appendChild(this.configContainer);

    // Client ID display (read-only)
    const clientIdGroup = this.createFieldGroup(
      'Client ID',
      'Unique identifier for this DevTools instance'
    );
    this.configContainer.appendChild(clientIdGroup.container);

    const clientIdInput = document.createElement('input');
    clientIdInput.type = 'text';
    clientIdInput.className = 'settings-input';
    clientIdInput.value = currentEvaluationConfig.clientId || 'Auto-generated on first connection';
    clientIdInput.readOnly = true;
    clientIdInput.style.backgroundColor = 'var(--color-background-elevation-1)';
    clientIdInput.style.cursor = 'default';
    clientIdGroup.container.appendChild(clientIdInput);

    // Evaluation endpoint
    const endpointGroup = this.createFieldGroup(
      i18nString(UIStrings.evaluationEndpoint),
      i18nString(UIStrings.evaluationEndpointHint)
    );
    this.configContainer.appendChild(endpointGroup.container);

    this.evaluationEndpointInput = document.createElement('input');
    this.evaluationEndpointInput.type = 'text';
    this.evaluationEndpointInput.className = 'settings-input';
    this.evaluationEndpointInput.placeholder = 'ws://localhost:8080';
    this.evaluationEndpointInput.value = currentEvaluationConfig.endpoint || 'ws://localhost:8080';
    endpointGroup.container.appendChild(this.evaluationEndpointInput);

    // Evaluation secret key
    const secretKeyGroup = this.createFieldGroup(
      i18nString(UIStrings.evaluationSecretKey),
      i18nString(UIStrings.evaluationSecretKeyHint)
    );
    this.configContainer.appendChild(secretKeyGroup.container);

    this.evaluationSecretKeyInput = document.createElement('input');
    this.evaluationSecretKeyInput.type = 'password';
    this.evaluationSecretKeyInput.className = 'settings-input';
    this.evaluationSecretKeyInput.placeholder = 'Evaluation secret key (optional)';
    this.evaluationSecretKeyInput.value = currentEvaluationConfig.secretKey || '';
    secretKeyGroup.container.appendChild(this.evaluationSecretKeyInput);

    // Footer with Test Connection button
    const footer = document.createElement('div');
    footer.className = 'settings-section-footer';
    this.configContainer.appendChild(footer);

    const testButton = document.createElement('button');
    testButton.className = 'settings-button primary';
    testButton.textContent = 'Test Connection';
    testButton.addEventListener('click', () => this.testConnection(clientIdInput));
    footer.appendChild(testButton);
  }

  private createFieldGroup(label: string, hint: string): { container: HTMLDivElement } {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const labelEl = document.createElement('div');
    labelEl.className = 'settings-label';
    labelEl.textContent = label;
    container.appendChild(labelEl);

    const hintEl = document.createElement('div');
    hintEl.className = 'settings-hint';
    hintEl.textContent = hint;
    container.appendChild(hintEl);

    return { container };
  }

  private async handleToggle(): Promise<void> {
    this.isEnabled = !this.isEnabled;

    if (this.toggleElement) {
      this.toggleElement.classList.toggle('active', this.isEnabled);
    }

    if (this.configContainer) {
      this.configContainer.style.display = this.isEnabled ? 'flex' : 'none';
    }

    if (this.isEnabled) {
      // Auto-connect when enabled
      try {
        const endpoint = this.evaluationEndpointInput?.value.trim() || 'ws://localhost:8080';
        const secretKey = this.evaluationSecretKeyInput?.value.trim() || '';

        setEvaluationConfig({
          enabled: true,
          endpoint,
          secretKey
        });

        await connectToEvaluationService();
      } catch (error) {
        logger.error('Failed to connect to evaluation service', error);
        // Revert toggle on failure
        this.isEnabled = false;
        if (this.toggleElement) {
          this.toggleElement.classList.remove('active');
        }
        if (this.configContainer) {
          this.configContainer.style.display = 'none';
        }
      }
    } else {
      // Disconnect when disabled
      try {
        disconnectFromEvaluationService();
        setEvaluationConfig({
          enabled: false,
          endpoint: this.evaluationEndpointInput?.value.trim() || 'ws://localhost:8080',
          secretKey: this.evaluationSecretKeyInput?.value.trim() || ''
        });
      } catch (error) {
        logger.error('Failed to disconnect from evaluation service', error);
      }
    }
  }

  private async testConnection(clientIdInput: HTMLInputElement): Promise<void> {
    try {
      const endpoint = this.evaluationEndpointInput?.value.trim() || 'ws://localhost:8080';
      const secretKey = this.evaluationSecretKeyInput?.value.trim() || '';

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

      // Update toggle state
      this.isEnabled = true;
      if (this.toggleElement) {
        this.toggleElement.classList.add('active');
      }

      logger.info('Test connection successful');
    } catch (error) {
      logger.error('Test connection failed', error);
    }
  }

  save(): void {
    if (!this.evaluationEndpointInput || !this.evaluationSecretKeyInput) {
      return;
    }

    setEvaluationConfig({
      enabled: this.isEnabled,
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
