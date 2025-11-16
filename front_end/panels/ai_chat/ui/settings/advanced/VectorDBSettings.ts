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
  private vectorDBEnabledCheckbox: HTMLInputElement | null = null;
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

    // Title
    const vectorDBTitle = document.createElement('h3');
    vectorDBTitle.textContent = i18nString(UIStrings.vectorDBLabel);
    vectorDBTitle.classList.add('settings-subtitle');
    this.container.appendChild(vectorDBTitle);

    // Vector DB enabled checkbox
    const vectorDBEnabledContainer = document.createElement('div');
    vectorDBEnabledContainer.className = 'tracing-enabled-container';
    this.container.appendChild(vectorDBEnabledContainer);

    this.vectorDBEnabledCheckbox = document.createElement('input');
    this.vectorDBEnabledCheckbox.type = 'checkbox';
    this.vectorDBEnabledCheckbox.id = 'vector-db-enabled';
    this.vectorDBEnabledCheckbox.className = 'tracing-checkbox';
    this.vectorDBEnabledCheckbox.checked = localStorage.getItem(VECTOR_DB_ENABLED_KEY) === 'true';
    vectorDBEnabledContainer.appendChild(this.vectorDBEnabledCheckbox);

    const vectorDBEnabledLabel = document.createElement('label');
    vectorDBEnabledLabel.htmlFor = 'vector-db-enabled';
    vectorDBEnabledLabel.className = 'tracing-label';
    vectorDBEnabledLabel.textContent = i18nString(UIStrings.vectorDBEnabled);
    vectorDBEnabledContainer.appendChild(vectorDBEnabledLabel);

    const vectorDBEnabledHint = document.createElement('div');
    vectorDBEnabledHint.className = 'settings-hint';
    vectorDBEnabledHint.textContent = i18nString(UIStrings.vectorDBEnabledHint);
    this.container.appendChild(vectorDBEnabledHint);

    // Vector DB configuration container (shown when enabled)
    const vectorDBConfigContainer = document.createElement('div');
    vectorDBConfigContainer.className = 'tracing-config-container';
    vectorDBConfigContainer.style.display = this.vectorDBEnabledCheckbox.checked ? 'block' : 'none';
    this.container.appendChild(vectorDBConfigContainer);

    // Vector DB Endpoint
    const vectorDBEndpointDiv = document.createElement('div');
    vectorDBEndpointDiv.classList.add('settings-field');
    vectorDBConfigContainer.appendChild(vectorDBEndpointDiv);

    const vectorDBEndpointLabel = document.createElement('label');
    vectorDBEndpointLabel.textContent = i18nString(UIStrings.vectorDBEndpoint);
    vectorDBEndpointLabel.classList.add('settings-label');
    vectorDBEndpointDiv.appendChild(vectorDBEndpointLabel);

    const vectorDBEndpointHint = document.createElement('div');
    vectorDBEndpointHint.textContent = i18nString(UIStrings.vectorDBEndpointHint);
    vectorDBEndpointHint.classList.add('settings-hint');
    vectorDBEndpointDiv.appendChild(vectorDBEndpointHint);

    this.vectorDBEndpointInput = document.createElement('input');
    this.vectorDBEndpointInput.classList.add('settings-input');
    this.vectorDBEndpointInput.type = 'text';
    this.vectorDBEndpointInput.placeholder = 'http://localhost:19530';
    this.vectorDBEndpointInput.value = localStorage.getItem(MILVUS_ENDPOINT_KEY) || '';
    vectorDBEndpointDiv.appendChild(this.vectorDBEndpointInput);

    // Vector DB API Key (Username)
    const vectorDBApiKeyDiv = document.createElement('div');
    vectorDBApiKeyDiv.classList.add('settings-field');
    vectorDBConfigContainer.appendChild(vectorDBApiKeyDiv);

    const vectorDBApiKeyLabel = document.createElement('label');
    vectorDBApiKeyLabel.textContent = i18nString(UIStrings.vectorDBApiKey);
    vectorDBApiKeyLabel.classList.add('settings-label');
    vectorDBApiKeyDiv.appendChild(vectorDBApiKeyLabel);

    const vectorDBApiKeyHint = document.createElement('div');
    vectorDBApiKeyHint.textContent = i18nString(UIStrings.vectorDBApiKeyHint);
    vectorDBApiKeyHint.classList.add('settings-hint');
    vectorDBApiKeyDiv.appendChild(vectorDBApiKeyHint);

    this.vectorDBApiKeyInput = document.createElement('input');
    this.vectorDBApiKeyInput.classList.add('settings-input');
    this.vectorDBApiKeyInput.type = 'text';
    this.vectorDBApiKeyInput.placeholder = 'root';
    this.vectorDBApiKeyInput.value = localStorage.getItem(MILVUS_USERNAME_KEY) || 'root';
    vectorDBApiKeyDiv.appendChild(this.vectorDBApiKeyInput);

    // Milvus Password
    const milvusPasswordDiv = document.createElement('div');
    milvusPasswordDiv.classList.add('settings-field');
    vectorDBConfigContainer.appendChild(milvusPasswordDiv);

    const milvusPasswordLabel = document.createElement('label');
    milvusPasswordLabel.textContent = i18nString(UIStrings.milvusPassword);
    milvusPasswordLabel.classList.add('settings-label');
    milvusPasswordDiv.appendChild(milvusPasswordLabel);

    const milvusPasswordHint = document.createElement('div');
    milvusPasswordHint.textContent = i18nString(UIStrings.milvusPasswordHint);
    milvusPasswordHint.classList.add('settings-hint');
    milvusPasswordDiv.appendChild(milvusPasswordHint);

    this.milvusPasswordInput = document.createElement('input');
    this.milvusPasswordInput.classList.add('settings-input');
    this.milvusPasswordInput.type = 'password';
    this.milvusPasswordInput.placeholder = 'Milvus (self-hosted) or API token (cloud)';
    this.milvusPasswordInput.value = localStorage.getItem(MILVUS_PASSWORD_KEY) || 'Milvus';
    milvusPasswordDiv.appendChild(this.milvusPasswordInput);

    // OpenAI API Key for embeddings
    const milvusOpenAIDiv = document.createElement('div');
    milvusOpenAIDiv.classList.add('settings-field');
    vectorDBConfigContainer.appendChild(milvusOpenAIDiv);

    const milvusOpenAILabel = document.createElement('label');
    milvusOpenAILabel.textContent = i18nString(UIStrings.milvusOpenAIKey);
    milvusOpenAILabel.classList.add('settings-label');
    milvusOpenAIDiv.appendChild(milvusOpenAILabel);

    const milvusOpenAIHint = document.createElement('div');
    milvusOpenAIHint.textContent = i18nString(UIStrings.milvusOpenAIKeyHint);
    milvusOpenAIHint.classList.add('settings-hint');
    milvusOpenAIDiv.appendChild(milvusOpenAIHint);

    this.milvusOpenAIInput = document.createElement('input');
    this.milvusOpenAIInput.classList.add('settings-input');
    this.milvusOpenAIInput.type = 'password';
    this.milvusOpenAIInput.placeholder = 'sk-...';
    this.milvusOpenAIInput.value = localStorage.getItem(MILVUS_OPENAI_KEY) || '';
    milvusOpenAIDiv.appendChild(this.milvusOpenAIInput);

    // Vector DB Collection Name
    const vectorDBCollectionDiv = document.createElement('div');
    vectorDBCollectionDiv.classList.add('settings-field');
    vectorDBConfigContainer.appendChild(vectorDBCollectionDiv);

    const vectorDBCollectionLabel = document.createElement('label');
    vectorDBCollectionLabel.textContent = i18nString(UIStrings.vectorDBCollection);
    vectorDBCollectionLabel.classList.add('settings-label');
    vectorDBCollectionDiv.appendChild(vectorDBCollectionLabel);

    const vectorDBCollectionHint = document.createElement('div');
    vectorDBCollectionHint.textContent = i18nString(UIStrings.vectorDBCollectionHint);
    vectorDBCollectionHint.classList.add('settings-hint');
    vectorDBCollectionDiv.appendChild(vectorDBCollectionHint);

    this.vectorDBCollectionInput = document.createElement('input');
    this.vectorDBCollectionInput.classList.add('settings-input');
    this.vectorDBCollectionInput.type = 'text';
    this.vectorDBCollectionInput.placeholder = 'bookmarks';
    this.vectorDBCollectionInput.value = localStorage.getItem(MILVUS_COLLECTION_KEY) || 'bookmarks';
    vectorDBCollectionDiv.appendChild(this.vectorDBCollectionInput);

    // Test Vector DB Connection Button
    const vectorDBTestDiv = document.createElement('div');
    vectorDBTestDiv.classList.add('settings-field', 'test-connection-field');
    vectorDBConfigContainer.appendChild(vectorDBTestDiv);

    const vectorDBTestButton = document.createElement('button');
    vectorDBTestButton.classList.add('settings-button', 'test-button');
    vectorDBTestButton.setAttribute('type', 'button');
    vectorDBTestButton.textContent = i18nString(UIStrings.testVectorDBConnection);
    vectorDBTestDiv.appendChild(vectorDBTestButton);

    const vectorDBTestStatus = document.createElement('div');
    vectorDBTestStatus.classList.add('settings-status');
    vectorDBTestStatus.style.display = 'none';
    vectorDBTestDiv.appendChild(vectorDBTestStatus);

    // Toggle vector DB config visibility
    this.vectorDBEnabledCheckbox.addEventListener('change', () => {
      vectorDBConfigContainer.style.display = this.vectorDBEnabledCheckbox!.checked ? 'block' : 'none';
      localStorage.setItem(VECTOR_DB_ENABLED_KEY, this.vectorDBEnabledCheckbox!.checked.toString());
    });

    // Save Vector DB settings on input change
    const saveVectorDBSettings = () => {
      if (!this.vectorDBEnabledCheckbox || !this.vectorDBEndpointInput || !this.vectorDBApiKeyInput ||
          !this.milvusPasswordInput || !this.vectorDBCollectionInput || !this.milvusOpenAIInput) {
        return;
      }

      localStorage.setItem(VECTOR_DB_ENABLED_KEY, this.vectorDBEnabledCheckbox.checked.toString());
      localStorage.setItem(MILVUS_ENDPOINT_KEY, this.vectorDBEndpointInput.value);
      localStorage.setItem(MILVUS_USERNAME_KEY, this.vectorDBApiKeyInput.value);
      localStorage.setItem(MILVUS_PASSWORD_KEY, this.milvusPasswordInput.value);
      localStorage.setItem(MILVUS_COLLECTION_KEY, this.vectorDBCollectionInput.value);
      localStorage.setItem(MILVUS_OPENAI_KEY, this.milvusOpenAIInput.value);
    };

    this.vectorDBEndpointInput.addEventListener('input', saveVectorDBSettings);
    this.vectorDBApiKeyInput.addEventListener('input', saveVectorDBSettings);
    this.milvusPasswordInput.addEventListener('input', saveVectorDBSettings);
    this.vectorDBCollectionInput.addEventListener('input', saveVectorDBSettings);
    this.milvusOpenAIInput.addEventListener('input', saveVectorDBSettings);

    // Test Vector DB connection
    vectorDBTestButton.addEventListener('click', async () => {
      if (!this.vectorDBEndpointInput || !this.vectorDBApiKeyInput ||
          !this.milvusPasswordInput || !this.vectorDBCollectionInput || !this.milvusOpenAIInput) {
        return;
      }

      const endpoint = this.vectorDBEndpointInput.value.trim();

      if (!endpoint) {
        vectorDBTestStatus.textContent = 'Please enter an endpoint URL';
        vectorDBTestStatus.style.color = 'var(--color-accent-red)';
        vectorDBTestStatus.style.display = 'block';
        setTimeout(() => {
          vectorDBTestStatus.style.display = 'none';
        }, 3000);
        return;
      }

      vectorDBTestButton.disabled = true;
      vectorDBTestStatus.textContent = i18nString(UIStrings.testingVectorDBConnection);
      vectorDBTestStatus.style.color = 'var(--color-text-secondary)';
      vectorDBTestStatus.style.display = 'block';

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
          vectorDBTestStatus.textContent = i18nString(UIStrings.vectorDBConnectionSuccess);
          vectorDBTestStatus.style.color = 'var(--color-accent-green)';
        } else {
          vectorDBTestStatus.textContent = `${i18nString(UIStrings.vectorDBConnectionFailed)}: ${testResult.error}`;
          vectorDBTestStatus.style.color = 'var(--color-accent-red)';
        }
      } catch (error: any) {
        vectorDBTestStatus.textContent = `${i18nString(UIStrings.vectorDBConnectionFailed)}: ${error.message}`;
        vectorDBTestStatus.style.color = 'var(--color-accent-red)';
      } finally {
        vectorDBTestButton.disabled = false;
        setTimeout(() => {
          vectorDBTestStatus.style.display = 'none';
        }, 5000);
      }
    });
  }

  save(): void {
    // Vector DB settings are auto-saved on input change
    // No need to save on dialog save
  }

  cleanup(): void {
    // No cleanup needed
  }
}
