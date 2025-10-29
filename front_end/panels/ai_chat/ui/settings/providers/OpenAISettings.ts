// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BaseProviderSettings } from './BaseProviderSettings.js';
import { createModelSelector } from '../components/ModelSelectorFactory.js';
import { i18nString } from '../i18n-strings.js';
import { getValidModelForProvider } from '../utils/validation.js';
import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { OPENAI_API_KEY_STORAGE_KEY, MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY } from '../constants.js';
import type { GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction } from '../types.js';

/**
 * OpenAI provider settings
 *
 * Migrated from SettingsDialog.ts lines 720-803
 */
export class OpenAISettings extends BaseProviderSettings {
  private apiKeyInput: HTMLInputElement | null = null;
  private settingsSection: HTMLElement | null = null;
  private apiKeyStatus: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction
  ) {
    super(container, 'openai', getModelOptions, addCustomModelOption, removeCustomModelOption);
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';

    // Setup OpenAI content
    this.settingsSection = document.createElement('div');
    this.settingsSection.className = 'settings-section';
    this.container.appendChild(this.settingsSection);

    const apiKeyLabel = document.createElement('div');
    apiKeyLabel.className = 'settings-label';
    apiKeyLabel.textContent = i18nString('apiKeyLabel');
    this.settingsSection.appendChild(apiKeyLabel);

    const apiKeyHint = document.createElement('div');
    apiKeyHint.className = 'settings-hint';
    apiKeyHint.textContent = i18nString('apiKeyHint');
    this.settingsSection.appendChild(apiKeyHint);

    const settingsSavedApiKey = getStorageItem(OPENAI_API_KEY_STORAGE_KEY, '');
    this.apiKeyInput = document.createElement('input');
    this.apiKeyInput.className = 'settings-input';
    this.apiKeyInput.type = 'password';
    this.apiKeyInput.placeholder = 'Enter your OpenAI API key';
    this.apiKeyInput.value = settingsSavedApiKey;
    this.settingsSection.appendChild(this.apiKeyInput);

    this.apiKeyStatus = document.createElement('div');
    this.apiKeyStatus.className = 'settings-status';
    this.apiKeyStatus.style.display = 'none';
    this.settingsSection.appendChild(this.apiKeyStatus);

    // Initialize OpenAI model selectors
    this.updateModelSelectors();
  }

  updateModelSelectors(): void {
    if (!this.container) return;

    // Get the latest model options filtered for OpenAI provider
    const openaiModels = this.getModelOptions('openai');

    // Get current mini and nano models from storage
    const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
    const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

    // Get valid models using generic helper
    const validMiniModel = getValidModelForProvider(miniModel, openaiModels, 'openai', 'mini');
    const validNanoModel = getValidModelForProvider(nanoModel, openaiModels, 'openai', 'nano');

    // Clear any existing model selectors
    const existingSelectors = this.container.querySelectorAll('.model-selection-section');
    existingSelectors.forEach(selector => selector.remove());

    // Create a new model selection section
    const openaiModelSection = document.createElement('div');
    openaiModelSection.className = 'settings-section model-selection-section';
    this.container.appendChild(openaiModelSection);

    const openaiModelSectionTitle = document.createElement('h3');
    openaiModelSectionTitle.className = 'settings-subtitle';
    openaiModelSectionTitle.textContent = 'Model Size Selection';
    openaiModelSection.appendChild(openaiModelSectionTitle);

    // No focus handler needed for OpenAI selectors as we don't need to fetch models on focus

    // Create OpenAI Mini Model selection and store reference
    this.miniModelSelector = createModelSelector(
      openaiModelSection,
      i18nString('miniModelLabel'),
      i18nString('miniModelDescription'),
      'mini-model-select',
      openaiModels,
      validMiniModel,
      i18nString('defaultMiniOption'),
      undefined // No focus handler for OpenAI
    );

    // Create OpenAI Nano Model selection and store reference
    this.nanoModelSelector = createModelSelector(
      openaiModelSection,
      i18nString('nanoModelLabel'),
      i18nString('nanoModelDescription'),
      'nano-model-select',
      openaiModels,
      validNanoModel,
      i18nString('defaultNanoOption'),
      undefined // No focus handler for OpenAI
    );
  }

  save(): void {
    // Save OpenAI API key
    if (this.apiKeyInput) {
      const newApiKey = this.apiKeyInput.value.trim();
      if (newApiKey) {
        setStorageItem(OPENAI_API_KEY_STORAGE_KEY, newApiKey);
      } else {
        setStorageItem(OPENAI_API_KEY_STORAGE_KEY, '');
      }
    }
  }
}
