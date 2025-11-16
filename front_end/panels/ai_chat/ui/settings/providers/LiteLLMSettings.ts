// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BaseProviderSettings } from './BaseProviderSettings.js';
import { createModelSelector, refreshModelSelectOptions } from '../components/ModelSelectorFactory.js';
import { i18nString, UIStrings } from '../i18n-strings.js';
import { getValidModelForProvider } from '../utils/validation.js';
import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { LITELLM_ENDPOINT_KEY, LITELLM_API_KEY_STORAGE_KEY, MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY } from '../constants.js';
import type { UpdateModelOptionsFunction, GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction, FetchLiteLLMModelsFunction, ModelOption } from '../types.js';
import { LLMClient } from '../../../LLM/LLMClient.js';
import { createLogger } from '../../../core/Logger.js';

const logger = createLogger('LiteLLMSettings');

/**
 * LiteLLM provider settings
 *
 * Migrated from SettingsDialog.ts lines 806-1307
 */
export class LiteLLMSettings extends BaseProviderSettings {
  private endpointInput: HTMLInputElement | null = null;
  private apiKeyInput: HTMLInputElement | null = null;
  private fetchModelsButton: HTMLButtonElement | null = null;
  private fetchModelsStatus: HTMLElement | null = null;
  private customModelsList: HTMLElement | null = null;
  private customModelInput: HTMLInputElement | null = null;
  private modelTestStatus: HTMLElement | null = null;
  private testPassed: boolean = false;
  private updateModelOptions: UpdateModelOptionsFunction;
  private fetchLiteLLMModels: FetchLiteLLMModelsFunction;

  constructor(
    container: HTMLElement,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction,
    updateModelOptions: UpdateModelOptionsFunction,
    fetchLiteLLMModels: FetchLiteLLMModelsFunction
  ) {
    super(container, 'litellm', getModelOptions, addCustomModelOption, removeCustomModelOption);
    this.updateModelOptions = updateModelOptions;
    this.fetchLiteLLMModels = fetchLiteLLMModels;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';

    // Setup LiteLLM content
    const litellmSettingsSection = document.createElement('div');
    litellmSettingsSection.className = 'settings-section';
    this.container.appendChild(litellmSettingsSection);

    // LiteLLM endpoint
    const litellmEndpointLabel = document.createElement('div');
    litellmEndpointLabel.className = 'settings-label';
    litellmEndpointLabel.textContent = i18nString(UIStrings.litellmEndpointLabel);
    litellmSettingsSection.appendChild(litellmEndpointLabel);

    const litellmEndpointHint = document.createElement('div');
    litellmEndpointHint.className = 'settings-hint';
    litellmEndpointHint.textContent = i18nString(UIStrings.litellmEndpointHint);
    litellmSettingsSection.appendChild(litellmEndpointHint);

    const settingsSavedLiteLLMEndpoint = getStorageItem(LITELLM_ENDPOINT_KEY, '');
    this.endpointInput = document.createElement('input');
    this.endpointInput.className = 'settings-input litellm-endpoint-input';
    this.endpointInput.type = 'text';
    this.endpointInput.placeholder = 'http://localhost:4000';
    this.endpointInput.value = settingsSavedLiteLLMEndpoint;
    litellmSettingsSection.appendChild(this.endpointInput);

    // LiteLLM API Key
    const litellmAPIKeyLabel = document.createElement('div');
    litellmAPIKeyLabel.className = 'settings-label';
    litellmAPIKeyLabel.textContent = i18nString(UIStrings.liteLLMApiKey);
    litellmSettingsSection.appendChild(litellmAPIKeyLabel);

    const litellmAPIKeyHint = document.createElement('div');
    litellmAPIKeyHint.className = 'settings-hint';
    litellmAPIKeyHint.textContent = i18nString(UIStrings.liteLLMApiKeyHint);
    litellmSettingsSection.appendChild(litellmAPIKeyHint);

    const settingsSavedLiteLLMApiKey = getStorageItem(LITELLM_API_KEY_STORAGE_KEY, '');
    this.apiKeyInput = document.createElement('input');
    this.apiKeyInput.className = 'settings-input litellm-api-key-input';
    this.apiKeyInput.type = 'password';
    this.apiKeyInput.placeholder = 'Enter your LiteLLM API key';
    this.apiKeyInput.value = settingsSavedLiteLLMApiKey;
    litellmSettingsSection.appendChild(this.apiKeyInput);

    // Create event handler function
    const updateFetchButtonState = () => {
      if (this.fetchModelsButton && this.endpointInput) {
        this.fetchModelsButton.disabled = !this.endpointInput.value.trim();
      }
    };

    this.endpointInput.addEventListener('input', updateFetchButtonState);

    const fetchButtonContainer = document.createElement('div');
    fetchButtonContainer.className = 'fetch-button-container';
    litellmSettingsSection.appendChild(fetchButtonContainer);

    this.fetchModelsButton = document.createElement('button');
    this.fetchModelsButton.className = 'settings-button';
    this.fetchModelsButton.setAttribute('type', 'button');
    this.fetchModelsButton.textContent = i18nString(UIStrings.fetchModelsButton);
    this.fetchModelsButton.disabled = !this.endpointInput.value.trim();
    fetchButtonContainer.appendChild(this.fetchModelsButton);

    this.fetchModelsStatus = document.createElement('div');
    this.fetchModelsStatus.className = 'settings-status';
    this.fetchModelsStatus.style.display = 'none';
    fetchButtonContainer.appendChild(this.fetchModelsStatus);

    // Add click handler for fetch models button
    this.fetchModelsButton.addEventListener('click', async () => {
      if (!this.fetchModelsButton || !this.fetchModelsStatus || !this.endpointInput || !this.apiKeyInput) return;

      this.fetchModelsButton.disabled = true;
      this.fetchModelsStatus.textContent = i18nString(UIStrings.fetchingModels);
      this.fetchModelsStatus.style.display = 'block';
      this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-blue-background)';
      this.fetchModelsStatus.style.color = 'var(--color-accent-blue)';

      try {
        const endpoint = this.endpointInput.value;
        const liteLLMApiKey = this.apiKeyInput.value || getStorageItem(LITELLM_API_KEY_STORAGE_KEY, '');

        const { models: litellmModels, hadWildcard } = await this.fetchLiteLLMModels(liteLLMApiKey, endpoint || undefined);
        this.updateModelOptions(litellmModels, hadWildcard);

        // Get counts from centralized getModelOptions
        const allLiteLLMModels = this.getModelOptions('litellm');
        const actualModelCount = litellmModels.length;
        const hasCustomModels = allLiteLLMModels.length > actualModelCount;

        // Get current mini and nano models from storage
        const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
        const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

        // Refresh existing model selectors with new options if they exist
        if (this.miniModelSelector) {
          refreshModelSelectOptions(this.miniModelSelector as any, allLiteLLMModels, miniModel, i18nString(UIStrings.defaultMiniOption));
        }
        if (this.nanoModelSelector) {
          refreshModelSelectOptions(this.nanoModelSelector as any, allLiteLLMModels, nanoModel, i18nString(UIStrings.defaultNanoOption));
        }

        if (hadWildcard && actualModelCount === 0 && !hasCustomModels) {
          this.fetchModelsStatus.textContent = i18nString(UIStrings.wildcardModelsOnly);
          this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-orange-background)';
          this.fetchModelsStatus.style.color = 'var(--color-accent-orange)';
        } else if (hadWildcard && actualModelCount === 0) {
          // Only wildcard was returned but we have custom models
          this.fetchModelsStatus.textContent = i18nString(UIStrings.wildcardAndCustomModels);
          this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-green-background)';
          this.fetchModelsStatus.style.color = 'var(--color-accent-green)';
        } else if (hadWildcard) {
          // Wildcard plus other models
          this.fetchModelsStatus.textContent = i18nString(UIStrings.wildcardAndOtherModels, {PH1: actualModelCount});
          this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-green-background)';
          this.fetchModelsStatus.style.color = 'var(--color-accent-green)';
        } else {
          // No wildcard, just regular models
          this.fetchModelsStatus.textContent = i18nString(UIStrings.fetchedModels, {PH1: actualModelCount});
          this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-green-background)';
          this.fetchModelsStatus.style.color = 'var(--color-accent-green)';
        }

        // Update LiteLLM model selections
        this.updateModelSelectors();

      } catch (error) {
        logger.error('Failed to fetch models:', error);
        this.fetchModelsStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-red-background)';
        this.fetchModelsStatus.style.color = 'var(--color-accent-red)';
      } finally {
        updateFetchButtonState();
        setTimeout(() => {
          if (this.fetchModelsStatus) {
            this.fetchModelsStatus.style.display = 'none';
          }
        }, 3000);
      }
    });

    // Custom model section with array support
    const customModelsSection = document.createElement('div');
    customModelsSection.className = 'custom-models-section';
    this.container.appendChild(customModelsSection);

    const customModelsLabel = document.createElement('div');
    customModelsLabel.className = 'settings-label';
    customModelsLabel.textContent = i18nString(UIStrings.customModelsLabel);
    customModelsSection.appendChild(customModelsLabel);

    const customModelsHint = document.createElement('div');
    customModelsHint.className = 'settings-hint';
    customModelsHint.textContent = i18nString(UIStrings.customModelsHint);
    customModelsSection.appendChild(customModelsHint);

    // Current custom models list
    this.customModelsList = document.createElement('div');
    this.customModelsList.className = 'custom-models-list';
    customModelsSection.appendChild(this.customModelsList);

    this.updateCustomModelsList();

    // New model input with test and add
    const newModelRow = document.createElement('div');
    newModelRow.className = 'new-model-row';
    customModelsSection.appendChild(newModelRow);

    this.customModelInput = document.createElement('input');
    this.customModelInput.className = 'settings-input custom-model-input';
    this.customModelInput.type = 'text';
    this.customModelInput.placeholder = 'Enter model name (e.g., gpt-4)';
    newModelRow.appendChild(this.customModelInput);

    const addModelButton = document.createElement('button');
    addModelButton.className = 'settings-button add-button';
    addModelButton.setAttribute('type', 'button');
    addModelButton.textContent = i18nString(UIStrings.addButton);
    newModelRow.appendChild(addModelButton);

    this.modelTestStatus = document.createElement('div');
    this.modelTestStatus.className = 'settings-status model-test-status';
    this.modelTestStatus.style.display = 'none';
    customModelsSection.appendChild(this.modelTestStatus);

    // Reset test passed state when input changes
    this.customModelInput.addEventListener('input', () => {
      this.testPassed = false;
      if (this.modelTestStatus) {
        this.modelTestStatus.style.display = 'none';
      }
    });

    // Add button click handler
    addModelButton.addEventListener('click', async () => {
      if (!this.customModelInput) return;

      const modelName = this.customModelInput.value.trim();

      // Check if model already exists by querying all litellm models
      const litellmModels = this.getModelOptions('litellm');
      const modelExists = litellmModels.some(m => m.value === modelName);

      if (modelExists) {
        if (this.modelTestStatus) {
          this.modelTestStatus.textContent = 'Model already exists';
          this.modelTestStatus.style.backgroundColor = 'var(--color-accent-orange-background)';
          this.modelTestStatus.style.color = 'var(--color-accent-orange)';
          this.modelTestStatus.style.display = 'block';
        }
        return;
      }

      // Always test the model before adding, regardless of previous test state
      addModelButton.disabled = true;
      const testSucceeded = await this.testModelConnection(modelName);

      if (testSucceeded) {
        // Use the provided addCustomModelOption function to add the model
        this.addCustomModelOption(modelName, 'litellm');

        // Update success message
        if (this.modelTestStatus) {
          this.modelTestStatus.textContent = `Model "${modelName}" added successfully`;
          this.modelTestStatus.style.backgroundColor = 'var(--color-accent-green-background)';
          this.modelTestStatus.style.color = 'var(--color-accent-green)';
        }

        // Reset UI
        this.updateCustomModelsList();
        this.customModelInput.value = '';
        this.testPassed = false;

        // Update model selectors
        this.updateModelSelectors();

        // Hide status after a delay
        setTimeout(() => {
          if (this.modelTestStatus) {
            this.modelTestStatus.style.display = 'none';
          }
        }, 3000);
      }

      addModelButton.disabled = false;
    });

    // Initialize LiteLLM model selectors
    this.updateModelSelectors();
  }

  private updateCustomModelsList(): void {
    if (!this.customModelsList) return;

    // Clear existing list
    this.customModelsList.innerHTML = '';

    // Get custom models directly from local storage instead of using a heuristic filter
    const savedCustomModels = JSON.parse(localStorage.getItem('ai_chat_custom_models') || '[]');
    const customModels = savedCustomModels;

    customModels.forEach((model: string) => {
      // Create model row
      const modelRow = document.createElement('div');
      modelRow.className = 'custom-model-row';
      this.customModelsList!.appendChild(modelRow);

      // Model name
      const modelName = document.createElement('span');
      modelName.className = 'custom-model-name';
      modelName.textContent = model;
      modelRow.appendChild(modelName);

      // Status element for test results
      const testStatus = document.createElement('span');
      testStatus.className = 'test-status';
      testStatus.style.display = 'none';
      modelRow.appendChild(testStatus);

      // Test button as icon
      const testButton = document.createElement('button');
      testButton.className = 'icon-button test-button';
      testButton.setAttribute('type', 'button');
      testButton.setAttribute('aria-label', i18nString(UIStrings.testButton));
      testButton.setAttribute('title', 'Test connection to this model');

      // Create SVG check icon
      const checkIcon = document.createElement('span');
      checkIcon.className = 'check-icon';
      checkIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5L6.5 10.5L4 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      `;
      testButton.appendChild(checkIcon);
      modelRow.appendChild(testButton);

      // Remove button as a trash icon
      const removeButton = document.createElement('button');
      removeButton.className = 'icon-button remove-button';
      removeButton.setAttribute('type', 'button');
      removeButton.setAttribute('aria-label', i18nString(UIStrings.removeButton));
      removeButton.setAttribute('title', 'Remove this model');

      // Create SVG trash icon
      const trashIcon = document.createElement('span');
      trashIcon.className = 'trash-icon';
      trashIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2.5V2C6 1.44772 6.44772 1 7 1H9C9.55228 1 10 1.44772 10 2V2.5M2 2.5H14M12.5 2.5V13C12.5 13.5523 12.0523 14 11.5 14H4.5C3.94772 14 3.5 13.5523 3.5 13V2.5M5.5 5.5V11M8 5.5V11M10.5 5.5V11"
                stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      removeButton.appendChild(trashIcon);
      modelRow.appendChild(removeButton);

      // Add click handlers
      testButton.addEventListener('click', async () => {
        testButton.disabled = true;
        testStatus.textContent = '...';
        testStatus.style.color = 'var(--color-accent-blue)';
        testStatus.style.display = 'inline';

        try {
          const endpoint = this.endpointInput?.value;
          const liteLLMApiKey = this.apiKeyInput?.value || getStorageItem(LITELLM_API_KEY_STORAGE_KEY, '');

          if (!endpoint) {
            throw new Error(i18nString(UIStrings.endpointRequired));
          }

          const result = await LLMClient.testLiteLLMConnection(liteLLMApiKey, model, endpoint);

          if (result.success) {
            testStatus.textContent = '✓';
            testStatus.style.color = 'var(--color-accent-green)';
          } else {
            testStatus.textContent = '✗';
            testStatus.style.color = 'var(--color-accent-red)';
            testStatus.title = result.message; // Show error on hover
          }
        } catch (error) {
          testStatus.textContent = '✗';
          testStatus.style.color = 'var(--color-accent-red)';
          testStatus.title = error instanceof Error ? error.message : 'Unknown error';
        } finally {
          testButton.disabled = false;
          setTimeout(() => {
            testStatus.style.display = 'none';
          }, 5000);
        }
      });

      removeButton.addEventListener('click', () => {
        // Use the provided removeCustomModelOption function to remove the model
        this.removeCustomModelOption(model);

        // Update the UI list
        this.updateCustomModelsList();

        // Update model selectors
        this.updateModelSelectors();
      });
    });
  }

  private async testModelConnection(modelName: string): Promise<boolean> {
    if (!this.modelTestStatus) return false;

    if (!modelName) {
      this.modelTestStatus.textContent = 'Please enter a model name';
      this.modelTestStatus.style.backgroundColor = 'var(--color-accent-red-background)';
      this.modelTestStatus.style.color = 'var(--color-accent-red)';
      this.modelTestStatus.style.display = 'block';
      return false;
    }

    this.modelTestStatus.textContent = 'Testing model...';
    this.modelTestStatus.style.backgroundColor = 'var(--color-accent-blue-background)';
    this.modelTestStatus.style.color = 'var(--color-accent-blue)';
    this.modelTestStatus.style.display = 'block';

    try {
      const endpoint = this.endpointInput?.value;
      const liteLLMApiKey = this.apiKeyInput?.value || getStorageItem(LITELLM_API_KEY_STORAGE_KEY, '');

      if (!endpoint) {
        throw new Error(i18nString(UIStrings.endpointRequired));
      }

      const result = await LLMClient.testLiteLLMConnection(liteLLMApiKey, modelName, endpoint);

      if (result.success) {
        this.modelTestStatus.textContent = `Test passed: ${result.message}`;
        this.modelTestStatus.style.backgroundColor = 'var(--color-accent-green-background)';
        this.modelTestStatus.style.color = 'var(--color-accent-green)';
        this.testPassed = true;
        return true;
      } else {
        this.modelTestStatus.textContent = `Test failed: ${result.message}`;
        this.modelTestStatus.style.backgroundColor = 'var(--color-accent-red-background)';
        this.modelTestStatus.style.color = 'var(--color-accent-red)';
        this.testPassed = false;
        return false;
      }
    } catch (error) {
      this.modelTestStatus.textContent = `Test error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.modelTestStatus.style.backgroundColor = 'var(--color-accent-red-background)';
      this.modelTestStatus.style.color = 'var(--color-accent-red)';
      this.testPassed = false;
      return false;
    }
  }

  updateModelSelectors(): void {
    if (!this.container) return;

    logger.debug('Updating LiteLLM model selectors');

    // Get the latest model options filtered for LiteLLM provider
    const litellmModels = this.getModelOptions('litellm');
    logger.debug('LiteLLM models from getModelOptions:', litellmModels);

    // Get current mini and nano models from storage
    const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
    const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

    // Get valid models using generic helper
    const validMiniModel = getValidModelForProvider(miniModel, litellmModels, 'litellm', 'mini');
    const validNanoModel = getValidModelForProvider(nanoModel, litellmModels, 'litellm', 'nano');

    // Clear any existing model selectors
    const existingSelectors = this.container.querySelectorAll('.model-selection-section');
    existingSelectors.forEach(selector => selector.remove());

    // Create a new model selection section
    const litellmModelSection = document.createElement('div');
    litellmModelSection.className = 'settings-section model-selection-section';
    this.container.appendChild(litellmModelSection);

    const litellmModelSectionTitle = document.createElement('h3');
    litellmModelSectionTitle.className = 'settings-subtitle';
    litellmModelSectionTitle.textContent = 'Model Size Selection';
    litellmModelSection.appendChild(litellmModelSectionTitle);

    // Create a focus handler for LiteLLM selectors
    const onLiteLLMSelectorFocus = async () => {
      // Only refresh if the provider is still litellm
      const endpoint = this.endpointInput?.value.trim();
      const liteLLMApiKey = this.apiKeyInput?.value.trim() || getStorageItem(LITELLM_API_KEY_STORAGE_KEY, '');

      if (endpoint) {
        try {
          logger.debug('Refreshing LiteLLM models on selector focus...');
          const { models: litellmModels, hadWildcard } = await this.fetchLiteLLMModels(liteLLMApiKey, endpoint);
          this.updateModelOptions(litellmModels, hadWildcard);
          // No need to update UI since refreshing would lose focus
          logger.debug('Successfully refreshed LiteLLM models on selector focus');
        } catch (error) {
          logger.error('Failed to refresh LiteLLM models on selector focus:', error);
        }
      }
    };

    // Create LiteLLM Mini Model selection and store reference
    this.miniModelSelector = createModelSelector(
      litellmModelSection,
      i18nString(UIStrings.miniModelLabel),
      i18nString(UIStrings.miniModelDescription),
      'litellm-mini-model-select',
      litellmModels,
      validMiniModel,
      i18nString(UIStrings.defaultMiniOption),
      onLiteLLMSelectorFocus
    );

    logger.debug('Created LiteLLM Mini Model Select:', this.miniModelSelector);

    // Create LiteLLM Nano Model selection and store reference
    this.nanoModelSelector = createModelSelector(
      litellmModelSection,
      i18nString(UIStrings.nanoModelLabel),
      i18nString(UIStrings.nanoModelDescription),
      'litellm-nano-model-select',
      litellmModels,
      validNanoModel,
      i18nString(UIStrings.defaultNanoOption),
      onLiteLLMSelectorFocus
    );

    logger.debug('Created LiteLLM Nano Model Select:', this.nanoModelSelector);
  }

  save(): void {
    // Save LiteLLM endpoint
    if (this.endpointInput) {
      const newEndpoint = this.endpointInput.value.trim();
      setStorageItem(LITELLM_ENDPOINT_KEY, newEndpoint);
    }

    // Save LiteLLM API key
    if (this.apiKeyInput) {
      const newApiKey = this.apiKeyInput.value.trim();
      setStorageItem(LITELLM_API_KEY_STORAGE_KEY, newApiKey);
    }
  }
}
