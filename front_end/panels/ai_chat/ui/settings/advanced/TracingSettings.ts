// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString, UIStrings } from '../i18n-strings.js';
import { getTracingConfig, setTracingConfig, isTracingEnabled } from '../../../tracing/TracingConfig.js';

/**
 * Tracing (Langfuse) Settings
 *
 * Migrated from SettingsDialog.ts lines 2780-2951
 */
export class TracingSettings {
  private container: HTMLElement;
  private isEnabled: boolean = false;
  private toggleElement: HTMLDivElement | null = null;
  private configContainer: HTMLDivElement | null = null;
  private endpointInput: HTMLInputElement | null = null;
  private publicKeyInput: HTMLInputElement | null = null;
  private secretKeyInput: HTMLInputElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';
    this.container.className = 'settings-section tracing-section';

    // Get current tracing configuration
    const currentTracingConfig = getTracingConfig();
    this.isEnabled = isTracingEnabled();

    // Header with toggle
    const headerContainer = document.createElement('div');
    headerContainer.className = 'settings-toggle-container';
    this.container.appendChild(headerContainer);

    const infoContainer = document.createElement('div');
    infoContainer.className = 'settings-toggle-info';
    headerContainer.appendChild(infoContainer);

    const title = document.createElement('div');
    title.className = 'settings-toggle-title';
    title.textContent = i18nString(UIStrings.tracingSection);
    infoContainer.appendChild(title);

    const description = document.createElement('div');
    description.className = 'settings-toggle-description';
    description.textContent = i18nString(UIStrings.tracingEnabledHint);
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
    this.configContainer.className = 'tracing-config-container';
    this.configContainer.style.display = this.isEnabled ? 'flex' : 'none';
    this.configContainer.style.flexDirection = 'column';
    this.configContainer.style.gap = '20px';
    this.configContainer.style.marginTop = '20px';
    this.container.appendChild(this.configContainer);

    // Langfuse endpoint
    const endpointGroup = this.createFieldGroup(
      i18nString(UIStrings.langfuseEndpoint),
      i18nString(UIStrings.langfuseEndpointHint)
    );
    this.configContainer.appendChild(endpointGroup.container);

    this.endpointInput = document.createElement('input');
    this.endpointInput.className = 'settings-input';
    this.endpointInput.type = 'text';
    this.endpointInput.placeholder = 'Enter URL';
    this.endpointInput.value = currentTracingConfig.endpoint || '';
    endpointGroup.container.appendChild(this.endpointInput);

    // Langfuse public key
    const publicKeyGroup = this.createFieldGroup(
      i18nString(UIStrings.langfusePublicKey),
      i18nString(UIStrings.langfusePublicKeyHint)
    );
    this.configContainer.appendChild(publicKeyGroup.container);

    this.publicKeyInput = document.createElement('input');
    this.publicKeyInput.className = 'settings-input';
    this.publicKeyInput.type = 'text';
    this.publicKeyInput.placeholder = 'Enter public key';
    this.publicKeyInput.value = currentTracingConfig.publicKey || '';
    publicKeyGroup.container.appendChild(this.publicKeyInput);

    // Langfuse secret key
    const secretKeyGroup = this.createFieldGroup(
      i18nString(UIStrings.langfuseSecretKey),
      i18nString(UIStrings.langfuseSecretKeyHint)
    );
    this.configContainer.appendChild(secretKeyGroup.container);

    this.secretKeyInput = document.createElement('input');
    this.secretKeyInput.className = 'settings-input';
    this.secretKeyInput.type = 'password';
    this.secretKeyInput.placeholder = 'Enter secret key';
    this.secretKeyInput.value = currentTracingConfig.secretKey || '';
    secretKeyGroup.container.appendChild(this.secretKeyInput);

    // Footer with Test Connection button
    const footer = document.createElement('div');
    footer.className = 'settings-section-footer';
    this.configContainer.appendChild(footer);

    const testButton = document.createElement('button');
    testButton.className = 'settings-button primary';
    testButton.textContent = 'Test Connection';
    testButton.addEventListener('click', () => this.testConnection(testButton));
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

  private handleToggle(): void {
    this.isEnabled = !this.isEnabled;

    if (this.toggleElement) {
      this.toggleElement.classList.toggle('active', this.isEnabled);
    }

    if (this.configContainer) {
      this.configContainer.style.display = this.isEnabled ? 'flex' : 'none';
    }

    // Auto-save toggle state
    if (!this.isEnabled) {
      setTracingConfig({ provider: 'disabled' });
    }
  }

  private async testConnection(testButton: HTMLButtonElement): Promise<void> {
    testButton.disabled = true;
    testButton.textContent = 'Testing...';

    try {
      const endpoint = this.endpointInput?.value.trim() || '';
      const publicKey = this.publicKeyInput?.value.trim() || '';
      const secretKey = this.secretKeyInput?.value.trim() || '';

      if (!endpoint || !publicKey || !secretKey) {
        throw new Error('All fields are required for testing');
      }

      // Test the connection with a simple trace
      const testPayload = {
        batch: [{
          id: `test-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'trace-create',
          body: {
            id: `trace-test-${Date.now()}`,
            name: 'Connection Test',
            timestamp: new Date().toISOString()
          }
        }]
      };

      const response = await fetch(`${endpoint}/api/public/ingestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${publicKey}:${secretKey}`)
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        testButton.textContent = 'Connected!';
        // Enable toggle if not already
        if (!this.isEnabled) {
          this.isEnabled = true;
          if (this.toggleElement) {
            this.toggleElement.classList.add('active');
          }
        }
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      testButton.textContent = 'Failed';
      console.error('Tracing test failed:', error);
    } finally {
      setTimeout(() => {
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
      }, 2000);
    }
  }

  save(): void {
    if (!this.endpointInput || !this.publicKeyInput || !this.secretKeyInput) {
      return;
    }

    if (this.isEnabled) {
      const endpoint = this.endpointInput.value.trim();
      const publicKey = this.publicKeyInput.value.trim();
      const secretKey = this.secretKeyInput.value.trim();

      if (endpoint && publicKey && secretKey) {
        setTracingConfig({
          provider: 'langfuse',
          endpoint,
          publicKey,
          secretKey
        });
      }
    } else {
      setTracingConfig({ provider: 'disabled' });
    }
  }

  cleanup(): void {
    // No cleanup needed
  }
}
