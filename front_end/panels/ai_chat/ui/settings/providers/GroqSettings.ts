// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BaseProviderSettings } from './BaseProviderSettings.js';
import { createModelSelector, refreshModelSelectOptions } from '../components/ModelSelectorFactory.js';
import { i18nString } from '../i18n-strings.js';
import { getValidModelForProvider } from '../utils/validation.js';
import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { GROQ_API_KEY_STORAGE_KEY, MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY } from '../constants.js';
import type { UpdateModelOptionsFunction, GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction, ModelOption } from '../types.js';
import { LLMClient } from '../../../LLM/LLMClient.js';
import { createLogger } from '../../../core/Logger.js';

const logger = createLogger('GroqSettings');

/**
 * Groq provider settings
 *
 * Migrated from SettingsDialog.ts lines 1938-2125
 */
export class GroqSettings extends BaseProviderSettings {
  private apiKeyInput: HTMLInputElement | null = null;
  private fetchModelsButton: HTMLButtonElement | null = null;
  private fetchModelsStatus: HTMLElement | null = null;
  private updateModelOptions: UpdateModelOptionsFunction;

  constructor(
    container: HTMLElement,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction,
    updateModelOptions: UpdateModelOptionsFunction
  ) {
    super(container, 'groq', getModelOptions, addCustomModelOption, removeCustomModelOption);
    this.updateModelOptions = updateModelOptions;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';

    // Setup Groq content
    const groqSettingsSection = document.createElement('div');
    groqSettingsSection.className = 'settings-section';
    this.container.appendChild(groqSettingsSection);

    // Groq API Key
    const groqApiKeyLabel = document.createElement('div');
    groqApiKeyLabel.className = 'settings-label';
    groqApiKeyLabel.textContent = i18nString('groqApiKeyLabel');
    groqSettingsSection.appendChild(groqApiKeyLabel);

    const groqApiKeyHint = document.createElement('div');
    groqApiKeyHint.className = 'settings-hint';
    groqApiKeyHint.textContent = i18nString('groqApiKeyHint');
    groqSettingsSection.appendChild(groqApiKeyHint);

    const settingsSavedGroqApiKey = getStorageItem(GROQ_API_KEY_STORAGE_KEY, '');
    this.apiKeyInput = document.createElement('input');
    this.apiKeyInput.className = 'settings-input groq-api-key-input';
    this.apiKeyInput.type = 'password';
    this.apiKeyInput.placeholder = 'Enter your Groq API key';
    this.apiKeyInput.value = settingsSavedGroqApiKey;
    groqSettingsSection.appendChild(this.apiKeyInput);

    // Fetch Groq models button
    const groqFetchButtonContainer = document.createElement('div');
    groqFetchButtonContainer.className = 'fetch-button-container';
    groqSettingsSection.appendChild(groqFetchButtonContainer);

    this.fetchModelsButton = document.createElement('button');
    this.fetchModelsButton.className = 'settings-button';
    this.fetchModelsButton.setAttribute('type', 'button');
    this.fetchModelsButton.textContent = i18nString('fetchGroqModelsButton');
    this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
    groqFetchButtonContainer.appendChild(this.fetchModelsButton);

    this.fetchModelsStatus = document.createElement('div');
    this.fetchModelsStatus.className = 'settings-status';
    this.fetchModelsStatus.style.display = 'none';
    groqFetchButtonContainer.appendChild(this.fetchModelsStatus);

    // Update button state when API key changes
    this.apiKeyInput.addEventListener('input', () => {
      if (this.fetchModelsButton && this.apiKeyInput) {
        this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
      }
    });

    // Add click handler for fetch Groq models button
    this.fetchModelsButton.addEventListener('click', async () => {
      if (!this.fetchModelsButton || !this.fetchModelsStatus || !this.apiKeyInput) return;

      this.fetchModelsButton.disabled = true;
      this.fetchModelsStatus.textContent = i18nString('fetchingModels');
      this.fetchModelsStatus.style.display = 'block';
      this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-blue-background)';
      this.fetchModelsStatus.style.color = 'var(--color-accent-blue)';

      try {
        const groqApiKey = this.apiKeyInput.value.trim();

        // Fetch Groq models using LLMClient static method
        const groqModels = await LLMClient.fetchGroqModels(groqApiKey);

        // Convert Groq models to ModelOption format
        const modelOptions: ModelOption[] = groqModels.map(model => ({
          value: model.id,
          label: model.id,
          type: 'groq' as const
        }));

        // Update model options with fetched Groq models
        this.updateModelOptions(modelOptions, false);

        // Get all Groq models including any custom ones
        const allGroqModels = this.getModelOptions('groq');
        const actualModelCount = groqModels.length;

        // Get current mini and nano models from storage
        const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
        const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

        // Refresh existing model selectors with new options if they exist
        if (this.miniModelSelector) {
          refreshModelSelectOptions(this.miniModelSelector as any, allGroqModels, miniModel, i18nString('defaultMiniOption'));
        }
        if (this.nanoModelSelector) {
          refreshModelSelectOptions(this.nanoModelSelector as any, allGroqModels, nanoModel, i18nString('defaultNanoOption'));
        }

        this.fetchModelsStatus.textContent = i18nString('fetchedModels', {PH1: actualModelCount});
        this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-green-background)';
        this.fetchModelsStatus.style.color = 'var(--color-accent-green)';

        // Update Groq model selections
        this.updateModelSelectors();

      } catch (error) {
        logger.error('Failed to fetch Groq models:', error);
        this.fetchModelsStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-red-background)';
        this.fetchModelsStatus.style.color = 'var(--color-accent-red)';
      } finally {
        if (this.fetchModelsButton && this.apiKeyInput) {
          this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
        }
        setTimeout(() => {
          if (this.fetchModelsStatus) {
            this.fetchModelsStatus.style.display = 'none';
          }
        }, 3000);
      }
    });

    // Initialize Groq model selectors
    this.updateModelSelectors();
  }

  updateModelSelectors(): void {
    if (!this.container) return;

    logger.debug('Updating Groq model selectors');

    // Get the latest model options filtered for Groq provider
    const groqModels = this.getModelOptions('groq');
    logger.debug('Groq models from getModelOptions:', groqModels);

    // Get current mini and nano models from storage
    const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
    const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

    // Get valid models using generic helper
    const validMiniModel = getValidModelForProvider(miniModel, groqModels, 'groq', 'mini');
    const validNanoModel = getValidModelForProvider(nanoModel, groqModels, 'groq', 'nano');

    logger.debug('Groq model selection:', { originalMini: miniModel, validMini: validMiniModel, originalNano: nanoModel, validNano: validNanoModel });

    // Clear any existing model selectors
    const existingSelectors = this.container.querySelectorAll('.model-selection-section');
    existingSelectors.forEach(selector => selector.remove());

    // Create a new model selection section
    const groqModelSection = document.createElement('div');
    groqModelSection.className = 'settings-section model-selection-section';
    this.container.appendChild(groqModelSection);

    const groqModelSectionTitle = document.createElement('h3');
    groqModelSectionTitle.className = 'settings-subtitle';
    groqModelSectionTitle.textContent = 'Model Size Selection';
    groqModelSection.appendChild(groqModelSectionTitle);

    // Create Groq Mini Model selection and store reference
    this.miniModelSelector = createModelSelector(
      groqModelSection,
      i18nString('miniModelLabel'),
      i18nString('miniModelDescription'),
      'groq-mini-model-select',
      groqModels,
      validMiniModel,
      i18nString('defaultMiniOption'),
      undefined // No focus handler needed for Groq
    );

    logger.debug('Created Groq Mini Model Select:', this.miniModelSelector);

    // Create Groq Nano Model selection and store reference
    this.nanoModelSelector = createModelSelector(
      groqModelSection,
      i18nString('nanoModelLabel'),
      i18nString('nanoModelDescription'),
      'groq-nano-model-select',
      groqModels,
      validNanoModel,
      i18nString('defaultNanoOption'),
      undefined // No focus handler needed for Groq
    );

    logger.debug('Created Groq Nano Model Select:', this.nanoModelSelector);
  }

  save(): void {
    // Save Groq API key
    if (this.apiKeyInput) {
      const newApiKey = this.apiKeyInput.value.trim();
      if (newApiKey) {
        setStorageItem(GROQ_API_KEY_STORAGE_KEY, newApiKey);
      } else {
        setStorageItem(GROQ_API_KEY_STORAGE_KEY, '');
      }
    }
  }
}
