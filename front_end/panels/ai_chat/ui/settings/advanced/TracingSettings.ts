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
  private tracingEnabledCheckbox: HTMLInputElement | null = null;
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

    // Title
    const tracingSectionTitle = document.createElement('h3');
    tracingSectionTitle.className = 'settings-subtitle';
    tracingSectionTitle.textContent = i18nString(UIStrings.tracingSection);
    this.container.appendChild(tracingSectionTitle);

    // Get current tracing configuration
    const currentTracingConfig = getTracingConfig();

    // Tracing enabled checkbox
    const tracingEnabledContainer = document.createElement('div');
    tracingEnabledContainer.className = 'tracing-enabled-container';
    this.container.appendChild(tracingEnabledContainer);

    this.tracingEnabledCheckbox = document.createElement('input');
    this.tracingEnabledCheckbox.type = 'checkbox';
    this.tracingEnabledCheckbox.id = 'tracing-enabled';
    this.tracingEnabledCheckbox.className = 'tracing-checkbox';
    this.tracingEnabledCheckbox.checked = isTracingEnabled();
    tracingEnabledContainer.appendChild(this.tracingEnabledCheckbox);

    const tracingEnabledLabel = document.createElement('label');
    tracingEnabledLabel.htmlFor = 'tracing-enabled';
    tracingEnabledLabel.className = 'tracing-label';
    tracingEnabledLabel.textContent = i18nString(UIStrings.tracingEnabled);
    tracingEnabledContainer.appendChild(tracingEnabledLabel);

    const tracingEnabledHint = document.createElement('div');
    tracingEnabledHint.className = 'settings-hint';
    tracingEnabledHint.textContent = i18nString(UIStrings.tracingEnabledHint);
    this.container.appendChild(tracingEnabledHint);

    // Tracing configuration container (shown when enabled)
    const tracingConfigContainer = document.createElement('div');
    tracingConfigContainer.className = 'tracing-config-container';
    tracingConfigContainer.style.display = this.tracingEnabledCheckbox.checked ? 'block' : 'none';
    this.container.appendChild(tracingConfigContainer);

    // Langfuse endpoint
    const endpointLabel = document.createElement('div');
    endpointLabel.className = 'settings-label';
    endpointLabel.textContent = i18nString(UIStrings.langfuseEndpoint);
    tracingConfigContainer.appendChild(endpointLabel);

    const endpointHint = document.createElement('div');
    endpointHint.className = 'settings-hint';
    endpointHint.textContent = i18nString(UIStrings.langfuseEndpointHint);
    tracingConfigContainer.appendChild(endpointHint);

    this.endpointInput = document.createElement('input');
    this.endpointInput.className = 'settings-input';
    this.endpointInput.type = 'text';
    this.endpointInput.placeholder = 'http://localhost:3000';
    this.endpointInput.value = currentTracingConfig.endpoint || 'http://localhost:3000';
    tracingConfigContainer.appendChild(this.endpointInput);

    // Langfuse public key
    const publicKeyLabel = document.createElement('div');
    publicKeyLabel.className = 'settings-label';
    publicKeyLabel.textContent = i18nString(UIStrings.langfusePublicKey);
    tracingConfigContainer.appendChild(publicKeyLabel);

    const publicKeyHint = document.createElement('div');
    publicKeyHint.className = 'settings-hint';
    publicKeyHint.textContent = i18nString(UIStrings.langfusePublicKeyHint);
    tracingConfigContainer.appendChild(publicKeyHint);

    this.publicKeyInput = document.createElement('input');
    this.publicKeyInput.className = 'settings-input';
    this.publicKeyInput.type = 'text';
    this.publicKeyInput.placeholder = 'pk-lf-...';
    this.publicKeyInput.value = currentTracingConfig.publicKey || '';
    tracingConfigContainer.appendChild(this.publicKeyInput);

    // Langfuse secret key
    const secretKeyLabel = document.createElement('div');
    secretKeyLabel.className = 'settings-label';
    secretKeyLabel.textContent = i18nString(UIStrings.langfuseSecretKey);
    tracingConfigContainer.appendChild(secretKeyLabel);

    const secretKeyHint = document.createElement('div');
    secretKeyHint.className = 'settings-hint';
    secretKeyHint.textContent = i18nString(UIStrings.langfuseSecretKeyHint);
    tracingConfigContainer.appendChild(secretKeyHint);

    this.secretKeyInput = document.createElement('input');
    this.secretKeyInput.className = 'settings-input';
    this.secretKeyInput.type = 'password';
    this.secretKeyInput.placeholder = 'sk-lf-...';
    this.secretKeyInput.value = currentTracingConfig.secretKey || '';
    tracingConfigContainer.appendChild(this.secretKeyInput);

    // Test connection button
    const testTracingButton = document.createElement('button');
    testTracingButton.className = 'settings-button test-button';
    testTracingButton.textContent = i18nString(UIStrings.testTracing);
    tracingConfigContainer.appendChild(testTracingButton);

    // Test status message
    const testTracingStatus = document.createElement('div');
    testTracingStatus.className = 'settings-status';
    testTracingStatus.style.display = 'none';
    tracingConfigContainer.appendChild(testTracingStatus);

    // Toggle tracing config visibility
    this.tracingEnabledCheckbox.addEventListener('change', () => {
      tracingConfigContainer.style.display = this.tracingEnabledCheckbox!.checked ? 'block' : 'none';
    });

    // Test tracing connection
    testTracingButton.addEventListener('click', async () => {
      testTracingButton.disabled = true;
      testTracingStatus.style.display = 'block';
      testTracingStatus.textContent = 'Testing connection...';
      testTracingStatus.style.backgroundColor = 'var(--color-background-elevation-1)';
      testTracingStatus.style.color = 'var(--color-text-primary)';

      try {
        const endpoint = this.endpointInput!.value.trim();
        const publicKey = this.publicKeyInput!.value.trim();
        const secretKey = this.secretKeyInput!.value.trim();

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
          testTracingStatus.textContent = '✓ Connection successful';
          testTracingStatus.style.backgroundColor = 'var(--color-accent-green-background)';
          testTracingStatus.style.color = 'var(--color-accent-green)';
        } else {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        testTracingStatus.textContent = `✗ ${error instanceof Error ? error.message : 'Connection failed'}`;
        testTracingStatus.style.backgroundColor = 'var(--color-accent-red-background)';
        testTracingStatus.style.color = 'var(--color-accent-red)';
      } finally {
        testTracingButton.disabled = false;
        setTimeout(() => {
          testTracingStatus.style.display = 'none';
        }, 5000);
      }
    });
  }

  save(): void {
    if (!this.tracingEnabledCheckbox || !this.endpointInput || !this.publicKeyInput || !this.secretKeyInput) {
      return;
    }

    if (this.tracingEnabledCheckbox.checked) {
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
