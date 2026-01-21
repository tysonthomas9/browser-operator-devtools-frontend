// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString, UIStrings } from '../i18n-strings.js';
import {
  VECTOR_DB_ENABLED_KEY,
  MILVUS_ENDPOINT_KEY,
  MILVUS_USERNAME_KEY,
  MILVUS_PASSWORD_KEY,
  MILVUS_COLLECTION_KEY,
  MILVUS_OPENAI_KEY
} from '../constants.js';

/**
 * Vector Database (Milvus) Settings
 *
 * Migrated from SettingsDialog.ts lines 2543-2778
 */
export class VectorDBSettings {
  private container: HTMLElement;
  private isEnabled: boolean = false;
  private toggleElement: HTMLDivElement | null = null;
  private configContainer: HTMLDivElement | null = null;
  private vectorDBEndpointInput: HTMLInputElement | null = null;
  private vectorDBApiKeyInput: HTMLInputElement | null = null;
  private milvusPasswordInput: HTMLInputElement | null = null;
  private milvusOpenAIInput: HTMLInputElement | null = null;
  private vectorDBCollectionInput: HTMLInputElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';
    this.container.className = 'settings-section vector-db-section';

    this.isEnabled = localStorage.getItem(VECTOR_DB_ENABLED_KEY) === 'true';

    // Header with toggle
    const headerContainer = document.createElement('div');
    headerContainer.className = 'settings-toggle-container';
    this.container.appendChild(headerContainer);

    const infoContainer = document.createElement('div');
    infoContainer.className = 'settings-toggle-info';
    headerContainer.appendChild(infoContainer);

    const title = document.createElement('div');
    title.className = 'settings-toggle-title';
    title.textContent = i18nString(UIStrings.vectorDBLabel);
    infoContainer.appendChild(title);

    const description = document.createElement('div');
    description.className = 'settings-toggle-description';
    description.textContent = i18nString(UIStrings.vectorDBEnabledHint);
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
    this.configContainer.className = 'vector-db-config-container';
    this.configContainer.style.display = this.isEnabled ? 'flex' : 'none';
    this.configContainer.style.flexDirection = 'column';
    this.configContainer.style.gap = '20px';
    this.configContainer.style.marginTop = '20px';
    this.container.appendChild(this.configContainer);

    // Milvus Endpoint
    const endpointGroup = this.createFieldGroup(
      i18nString(UIStrings.vectorDBEndpoint),
      i18nString(UIStrings.vectorDBEndpointHint)
    );
    this.configContainer.appendChild(endpointGroup.container);

    this.vectorDBEndpointInput = document.createElement('input');
    this.vectorDBEndpointInput.classList.add('settings-input');
    this.vectorDBEndpointInput.type = 'text';
    this.vectorDBEndpointInput.placeholder = 'Enter URL';
    this.vectorDBEndpointInput.value = localStorage.getItem(MILVUS_ENDPOINT_KEY) || '';
    this.vectorDBEndpointInput.addEventListener('input', () => this.saveSettings());
    endpointGroup.container.appendChild(this.vectorDBEndpointInput);

    // Milvus Username
    const usernameGroup = this.createFieldGroup(
      i18nString(UIStrings.vectorDBApiKey),
      i18nString(UIStrings.vectorDBApiKeyHint)
    );
    this.configContainer.appendChild(usernameGroup.container);

    this.vectorDBApiKeyInput = document.createElement('input');
    this.vectorDBApiKeyInput.classList.add('settings-input');
    this.vectorDBApiKeyInput.type = 'text';
    this.vectorDBApiKeyInput.placeholder = 'Enter username';
    this.vectorDBApiKeyInput.value = localStorage.getItem(MILVUS_USERNAME_KEY) || 'root';
    this.vectorDBApiKeyInput.addEventListener('input', () => this.saveSettings());
    usernameGroup.container.appendChild(this.vectorDBApiKeyInput);

    // Milvus Password / API Token
    const passwordGroup = this.createFieldGroup(
      i18nString(UIStrings.milvusPassword),
      i18nString(UIStrings.milvusPasswordHint)
    );
    this.configContainer.appendChild(passwordGroup.container);

    this.milvusPasswordInput = document.createElement('input');
    this.milvusPasswordInput.classList.add('settings-input');
    this.milvusPasswordInput.type = 'password';
    this.milvusPasswordInput.placeholder = 'Enter password / api token';
    this.milvusPasswordInput.value = localStorage.getItem(MILVUS_PASSWORD_KEY) || '';
    this.milvusPasswordInput.addEventListener('input', () => this.saveSettings());
    passwordGroup.container.appendChild(this.milvusPasswordInput);

    // OpenAI API Key for embeddings
    const openaiGroup = this.createFieldGroup(
      i18nString(UIStrings.milvusOpenAIKey),
      i18nString(UIStrings.milvusOpenAIKeyHint)
    );
    this.configContainer.appendChild(openaiGroup.container);

    this.milvusOpenAIInput = document.createElement('input');
    this.milvusOpenAIInput.classList.add('settings-input');
    this.milvusOpenAIInput.type = 'password';
    this.milvusOpenAIInput.placeholder = 'Enter api key';
    this.milvusOpenAIInput.value = localStorage.getItem(MILVUS_OPENAI_KEY) || '';
    this.milvusOpenAIInput.addEventListener('input', () => this.saveSettings());
    openaiGroup.container.appendChild(this.milvusOpenAIInput);

    // Collection Name
    const collectionGroup = this.createFieldGroup(
      i18nString(UIStrings.vectorDBCollection),
      i18nString(UIStrings.vectorDBCollectionHint)
    );
    this.configContainer.appendChild(collectionGroup.container);

    this.vectorDBCollectionInput = document.createElement('input');
    this.vectorDBCollectionInput.classList.add('settings-input');
    this.vectorDBCollectionInput.type = 'text';
    this.vectorDBCollectionInput.placeholder = 'Enter collection name';
    this.vectorDBCollectionInput.value = localStorage.getItem(MILVUS_COLLECTION_KEY) || 'bookmarks';
    this.vectorDBCollectionInput.addEventListener('input', () => this.saveSettings());
    collectionGroup.container.appendChild(this.vectorDBCollectionInput);

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

    localStorage.setItem(VECTOR_DB_ENABLED_KEY, this.isEnabled.toString());
  }

  private saveSettings(): void {
    if (!this.vectorDBEndpointInput || !this.vectorDBApiKeyInput ||
        !this.milvusPasswordInput || !this.vectorDBCollectionInput || !this.milvusOpenAIInput) {
      return;
    }

    localStorage.setItem(VECTOR_DB_ENABLED_KEY, this.isEnabled.toString());
    localStorage.setItem(MILVUS_ENDPOINT_KEY, this.vectorDBEndpointInput.value);
    localStorage.setItem(MILVUS_USERNAME_KEY, this.vectorDBApiKeyInput.value);
    localStorage.setItem(MILVUS_PASSWORD_KEY, this.milvusPasswordInput.value);
    localStorage.setItem(MILVUS_COLLECTION_KEY, this.vectorDBCollectionInput.value);
    localStorage.setItem(MILVUS_OPENAI_KEY, this.milvusOpenAIInput.value);
  }

  private async testConnection(testButton: HTMLButtonElement): Promise<void> {
    if (!this.vectorDBEndpointInput || !this.vectorDBApiKeyInput ||
        !this.milvusPasswordInput || !this.vectorDBCollectionInput || !this.milvusOpenAIInput) {
      return;
    }

    const endpoint = this.vectorDBEndpointInput.value.trim();

    if (!endpoint) {
      testButton.textContent = 'Enter endpoint';
      setTimeout(() => {
        testButton.textContent = 'Test Connection';
      }, 2000);
      return;
    }

    testButton.disabled = true;
    testButton.textContent = 'Testing...';

    try {
      // Import and test the Vector DB client
      const { VectorDBClient } = await import('../../../tools/VectorDBClient.js');
      const vectorClient = new VectorDBClient({
        endpoint,
        username: this.vectorDBApiKeyInput.value || 'root',
        password: this.milvusPasswordInput.value || 'Milvus',
        collection: this.vectorDBCollectionInput.value || 'bookmarks',
        openaiApiKey: this.milvusOpenAIInput.value || undefined
      });

      const testResult = await vectorClient.testConnection();

      if (testResult.success) {
        testButton.textContent = 'Connected!';
        // Enable toggle if not already
        if (!this.isEnabled) {
          this.isEnabled = true;
          if (this.toggleElement) {
            this.toggleElement.classList.add('active');
          }
          localStorage.setItem(VECTOR_DB_ENABLED_KEY, 'true');
        }
      } else {
        testButton.textContent = 'Failed';
        console.error('Vector DB test failed:', testResult.error);
      }
    } catch (error: any) {
      testButton.textContent = 'Failed';
      console.error('Vector DB test error:', error.message);
    } finally {
      setTimeout(() => {
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
      }, 2000);
    }
  }

  save(): void {
    this.saveSettings();
  }

  cleanup(): void {
    // No cleanup needed
  }
}
