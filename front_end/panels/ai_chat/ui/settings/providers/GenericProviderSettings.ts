// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BaseProviderSettings } from './BaseProviderSettings.js';
import { createModelSelector, refreshModelSelectOptions } from '../components/ModelSelectorFactory.js';
import { i18nString, UIStrings } from '../i18n-strings.js';
import { getValidModelForProvider } from '../utils/validation.js';
import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY } from '../constants.js';
import type { UpdateModelOptionsFunction, GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction, ModelOption, ProviderType } from '../types.js';
import { LLMClient } from '../../../LLM/LLMClient.js';
import { createLogger } from '../../../core/Logger.js';

/**
 * Configuration for a generic provider
 */
export interface ProviderConfig {
  id: ProviderType;
  displayName: string;
  apiKeyStorageKey: string;
  apiKeyLabel: string;
  apiKeyHint: string;
  apiKeyPlaceholder: string;
  hasModelSelectors?: boolean; // Default: true
  hasFetchButton?: boolean; // Default: false
  fetchButtonLabel?: string;
  fetchMethodName?: keyof typeof LLMClient; // e.g., 'fetchGroqModels'
  useNameAsLabel?: boolean; // Use model.name || model.id instead of just model.id (Default: false)
  apiKeyOptional?: boolean; // Default: false
}

/**
 * Generic provider settings class
 * Handles all simple providers through configuration
 */
export class GenericProviderSettings extends BaseProviderSettings {
  private config: ProviderConfig;
  private logger: any;
  private apiKeyInput: HTMLInputElement | null = null;
  private fetchModelsButton: HTMLButtonElement | null = null;
  private fetchModelsStatus: HTMLElement | null = null;
  private updateModelOptions: UpdateModelOptionsFunction | null = null;

  constructor(
    container: HTMLElement,
    config: ProviderConfig,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction,
    updateModelOptions?: UpdateModelOptionsFunction
  ) {
    super(container, config.id, getModelOptions, addCustomModelOption, removeCustomModelOption);
    this.config = config;
    this.logger = createLogger(`${config.displayName}Settings`);
    this.updateModelOptions = updateModelOptions || null;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';

    // Setup provider content section
    const settingsSection = document.createElement('div');
    settingsSection.className = 'settings-section';
    this.container.appendChild(settingsSection);

    // API Key Label
    const apiKeyLabel = document.createElement('div');
    apiKeyLabel.className = 'settings-label';
    apiKeyLabel.textContent = this.config.apiKeyLabel;
    settingsSection.appendChild(apiKeyLabel);

    // API Key Hint
    const apiKeyHint = document.createElement('div');
    apiKeyHint.className = 'settings-hint';
    apiKeyHint.textContent = this.config.apiKeyHint;
    settingsSection.appendChild(apiKeyHint);

    // API Key Input
    const savedApiKey = getStorageItem(this.config.apiKeyStorageKey, '');
    this.apiKeyInput = document.createElement('input');
    this.apiKeyInput.className = `settings-input ${this.config.id}-api-key-input`;
    this.apiKeyInput.type = 'password';
    this.apiKeyInput.placeholder = this.config.apiKeyPlaceholder;
    this.apiKeyInput.value = savedApiKey;
    settingsSection.appendChild(this.apiKeyInput);

    // Fetch Models Button (if configured)
    if (this.config.hasFetchButton && this.config.fetchMethodName) {
      const fetchButtonContainer = document.createElement('div');
      fetchButtonContainer.className = 'fetch-button-container';
      settingsSection.appendChild(fetchButtonContainer);

      this.fetchModelsButton = document.createElement('button');
      this.fetchModelsButton.className = 'settings-button';
      this.fetchModelsButton.setAttribute('type', 'button');
      this.fetchModelsButton.textContent = this.config.fetchButtonLabel || `Fetch ${this.config.displayName} Models`;
      this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
      fetchButtonContainer.appendChild(this.fetchModelsButton);

      this.fetchModelsStatus = document.createElement('div');
      this.fetchModelsStatus.className = 'settings-status';
      this.fetchModelsStatus.style.display = 'none';
      fetchButtonContainer.appendChild(this.fetchModelsStatus);

      // Update button state when API key changes
      this.apiKeyInput.addEventListener('input', () => {
        if (this.fetchModelsButton && this.apiKeyInput) {
          this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
        }
      });

      // Add click handler for fetch models button
      this.fetchModelsButton.addEventListener('click', async () => {
        await this.handleFetchModels();
      });
    }

    // Initialize model selectors if configured
    if (this.config.hasModelSelectors !== false) {
      this.updateModelSelectors();
    }
  }

  private async handleFetchModels(): Promise<void> {
    if (!this.fetchModelsButton || !this.fetchModelsStatus || !this.apiKeyInput || !this.config.fetchMethodName) {
      return;
    }

    this.fetchModelsButton.disabled = true;
    this.fetchModelsStatus.textContent = i18nString(UIStrings.fetchingModels);
    this.fetchModelsStatus.style.display = 'block';
    this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-blue-background)';
    this.fetchModelsStatus.style.color = 'var(--color-accent-blue)';

    try {
      const apiKey = this.apiKeyInput.value.trim();

      // Call the appropriate LLMClient static method dynamically
      const fetchMethod = LLMClient[this.config.fetchMethodName] as (apiKey: string) => Promise<any[]>;
      if (typeof fetchMethod !== 'function') {
        throw new Error(`Invalid fetch method: ${this.config.fetchMethodName}`);
      }

      const models = await fetchMethod.call(LLMClient, apiKey);

      // Convert models to ModelOption format
      const modelOptions: ModelOption[] = models.map(model => ({
        value: model.id,
        label: this.config.useNameAsLabel ? (model.name || model.id) : model.id,
        type: this.config.id as any
      }));

      // Update model options
      if (this.updateModelOptions) {
        this.updateModelOptions(modelOptions, false);
      }

      // Get all provider models including any custom ones
      const allModels = this.getModelOptions(this.config.id);
      const actualModelCount = models.length;

      // Get current mini and nano models from storage
      const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
      const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

      // Refresh existing model selectors with new options if they exist
      if (this.miniModelSelector) {
        refreshModelSelectOptions(
          this.miniModelSelector as any,
          allModels,
          miniModel,
          i18nString(UIStrings.defaultMiniOption)
        );
      }
      if (this.nanoModelSelector) {
        refreshModelSelectOptions(
          this.nanoModelSelector as any,
          allModels,
          nanoModel,
          i18nString(UIStrings.defaultNanoOption)
        );
      }

      this.fetchModelsStatus.textContent = i18nString(UIStrings.fetchedModels, {PH1: actualModelCount});
      this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-green-background)';
      this.fetchModelsStatus.style.color = 'var(--color-accent-green)';

      // Update model selections
      this.updateModelSelectors();

    } catch (error) {
      this.logger.error(`Failed to fetch ${this.config.displayName} models:`, error);
      this.fetchModelsStatus!.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.fetchModelsStatus!.style.backgroundColor = 'var(--color-accent-red-background)';
      this.fetchModelsStatus!.style.color = 'var(--color-accent-red)';
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
  }

  updateModelSelectors(): void {
    // Skip if model selectors are not configured
    if (this.config.hasModelSelectors === false) {
      return;
    }

    if (!this.container) {
      return;
    }

    this.logger.debug(`Updating ${this.config.displayName} model selectors`);

    // Get the latest model options filtered for this provider
    const providerModels = this.getModelOptions(this.config.id);
    this.logger.debug(`${this.config.displayName} models from getModelOptions:`, providerModels);

    // Get current mini and nano models from storage
    const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
    const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

    // Get valid models using generic helper
    const validMiniModel = getValidModelForProvider(miniModel, providerModels, this.config.id, 'mini');
    const validNanoModel = getValidModelForProvider(nanoModel, providerModels, this.config.id, 'nano');

    this.logger.debug(`${this.config.displayName} model selection:`, {
      originalMini: miniModel,
      validMini: validMiniModel,
      originalNano: nanoModel,
      validNano: validNanoModel
    });

    // Clear any existing model selectors
    const existingSelectors = this.container.querySelectorAll('.model-selection-section');
    existingSelectors.forEach(selector => selector.remove());

    // Create a new model selection section
    const modelSection = document.createElement('div');
    modelSection.className = 'settings-section model-selection-section';
    this.container.appendChild(modelSection);

    const modelSectionTitle = document.createElement('h3');
    modelSectionTitle.className = 'settings-subtitle';
    modelSectionTitle.textContent = 'Model Size Selection';
    modelSection.appendChild(modelSectionTitle);

    // Create Mini Model selection and store reference
    this.miniModelSelector = createModelSelector(
      modelSection,
      i18nString(UIStrings.miniModelLabel),
      i18nString(UIStrings.miniModelDescription),
      `${this.config.id}-mini-model-select`,
      providerModels,
      validMiniModel,
      i18nString(UIStrings.defaultMiniOption),
      undefined
    );

    this.logger.debug(`Created ${this.config.displayName} Mini Model Select:`, this.miniModelSelector);

    // Create Nano Model selection and store reference
    this.nanoModelSelector = createModelSelector(
      modelSection,
      i18nString(UIStrings.nanoModelLabel),
      i18nString(UIStrings.nanoModelDescription),
      `${this.config.id}-nano-model-select`,
      providerModels,
      validNanoModel,
      i18nString(UIStrings.defaultNanoOption),
      undefined
    );

    this.logger.debug(`Created ${this.config.displayName} Nano Model Select:`, this.nanoModelSelector);
  }

  save(): void {
    // Save API key
    if (this.apiKeyInput) {
      const newApiKey = this.apiKeyInput.value.trim();
      if (newApiKey) {
        setStorageItem(this.config.apiKeyStorageKey, newApiKey);
      } else {
        // If API key is optional and empty, remove from storage
        if (this.config.apiKeyOptional) {
          localStorage.removeItem(this.config.apiKeyStorageKey);
        } else {
          setStorageItem(this.config.apiKeyStorageKey, '');
        }
      }
    }
  }
}
