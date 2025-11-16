// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BaseProviderSettings } from './BaseProviderSettings.js';
import { i18nString, UIStrings } from '../i18n-strings.js';
import { getStorageItem, setStorageItem } from '../utils/storage.js';
import type { GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction } from '../types.js';

// Storage key for BrowserOperator API key (defined in LLMConfigurationManager.ts)
const BROWSEROPERATOR_API_KEY_STORAGE_KEY = 'ai_chat_browseroperator_api_key';

/**
 * BrowserOperator provider settings
 *
 * BrowserOperator is a managed hosted service with agent-based routing.
 * - API key is optional
 * - Endpoint is hardcoded to https://api.browseroperator.io/v1
 * - Models are static aliases (main, mini, nano) not real model names
 */
export class BrowserOperatorSettings extends BaseProviderSettings {
  private apiKeyInput: HTMLInputElement | null = null;
  private settingsSection: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction
  ) {
    super(container, 'browseroperator', getModelOptions, addCustomModelOption, removeCustomModelOption);
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';

    // Setup BrowserOperator content
    this.settingsSection = document.createElement('div');
    this.settingsSection.className = 'settings-section';
    this.container.appendChild(this.settingsSection);

    // Optional API key section
    const apiKeyLabel = document.createElement('div');
    apiKeyLabel.className = 'settings-label';
    apiKeyLabel.textContent = i18nString(UIStrings.browseroperatorApiKeyLabel);
    this.settingsSection.appendChild(apiKeyLabel);

    const apiKeyHint = document.createElement('div');
    apiKeyHint.className = 'settings-hint';
    apiKeyHint.textContent = i18nString(UIStrings.browseroperatorApiKeyHint);
    this.settingsSection.appendChild(apiKeyHint);

    const settingsSavedApiKey = getStorageItem(BROWSEROPERATOR_API_KEY_STORAGE_KEY, '');
    this.apiKeyInput = document.createElement('input');
    this.apiKeyInput.className = 'settings-input';
    this.apiKeyInput.type = 'password';
    this.apiKeyInput.placeholder = 'Enter your BrowserOperator API key (optional)';
    this.apiKeyInput.value = settingsSavedApiKey;
    this.settingsSection.appendChild(this.apiKeyInput);
  }

  updateModelSelectors(): void {
    // BrowserOperator doesn't need model selectors - models are managed automatically
    return;
  }

  save(): void {
    // Save BrowserOperator API key (optional)
    if (this.apiKeyInput) {
      const newApiKey = this.apiKeyInput.value.trim();
      if (newApiKey) {
        setStorageItem(BROWSEROPERATOR_API_KEY_STORAGE_KEY, newApiKey);
      } else {
        // Remove from storage if empty (API key is optional)
        localStorage.removeItem(BROWSEROPERATOR_API_KEY_STORAGE_KEY);
      }
    }
  }
}
