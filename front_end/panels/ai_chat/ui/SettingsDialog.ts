// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as UI from '../../../ui/legacy/legacy.js';
import { createLogger } from '../core/Logger.js';
import { LLMClient } from '../LLM/LLMClient.js';

// Import settings utilities
import { i18nString, UIStrings } from './settings/i18n-strings.js';
import { PROVIDER_SELECTION_KEY, MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY, ADVANCED_SETTINGS_ENABLED_KEY } from './settings/constants.js';
import { applySettingsStyles } from './settings/utils/styles.js';
import { isVectorDBEnabled } from './settings/utils/storage.js';
import type { ModelOption, ProviderType, FetchLiteLLMModelsFunction, UpdateModelOptionsFunction, GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction } from './settings/types.js';

// Re-export for backward compatibility
export { isVectorDBEnabled };

// Import provider settings classes
import { OpenAISettings } from './settings/providers/OpenAISettings.js';
import { LiteLLMSettings } from './settings/providers/LiteLLMSettings.js';
import { GroqSettings } from './settings/providers/GroqSettings.js';
import { OpenRouterSettings } from './settings/providers/OpenRouterSettings.js';

// Import advanced feature settings classes
import { MCPSettings } from './settings/advanced/MCPSettings.js';
import { BrowsingHistorySettings } from './settings/advanced/BrowsingHistorySettings.js';
import { VectorDBSettings } from './settings/advanced/VectorDBSettings.js';
import { TracingSettings } from './settings/advanced/TracingSettings.js';
import { EvaluationSettings } from './settings/advanced/EvaluationSettings.js';

import './model_selector/ModelSelector.js';

const logger = createLogger('SettingsDialog');

export class SettingsDialog {
  static async show(
    selectedModel: string,
    miniModel: string,
    nanoModel: string,
    onSettingsSaved: () => void,
    fetchLiteLLMModels: FetchLiteLLMModelsFunction,
    updateModelOptions: UpdateModelOptionsFunction,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction,
  ): Promise<void> {

    // Create a settings dialog
    const dialog = new UI.Dialog.Dialog();
    dialog.setDimmed(true);
    dialog.setOutsideClickCallback(() => dialog.hide());
    dialog.contentElement.classList.add('settings-dialog');

    // Create settings content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'settings-content';
    contentDiv.style.overflowY = 'auto';
    dialog.contentElement.appendChild(contentDiv);

    // Create header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'settings-header';
    contentDiv.appendChild(headerDiv);

    const title = document.createElement('h2');
    title.className = 'settings-title';
    title.textContent = i18nString(UIStrings.settings);
    headerDiv.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.className = 'settings-close-button';
    closeButton.setAttribute('aria-label', 'Close settings');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => dialog.hide());
    headerDiv.appendChild(closeButton);

    // Add provider selection dropdown
    const providerSection = document.createElement('div');
    providerSection.className = 'provider-selection-section';
    contentDiv.appendChild(providerSection);

    const providerLabel = document.createElement('div');
    providerLabel.className = 'settings-label';
    providerLabel.textContent = i18nString(UIStrings.providerLabel);
    providerSection.appendChild(providerLabel);

    const providerHint = document.createElement('div');
    providerHint.className = 'settings-hint';
    providerHint.textContent = i18nString(UIStrings.providerHint);
    providerSection.appendChild(providerHint);

    // Use the stored provider from localStorage
    const currentProvider = (localStorage.getItem(PROVIDER_SELECTION_KEY) || 'openai') as ProviderType;

    // Create provider selection dropdown
    const providerSelect = document.createElement('select');
    providerSelect.className = 'settings-select provider-select';
    providerSection.appendChild(providerSelect);

    // Add options to the dropdown
    const openaiOption = document.createElement('option');
    openaiOption.value = 'openai';
    openaiOption.textContent = i18nString(UIStrings.openaiProvider);
    openaiOption.selected = currentProvider === 'openai';
    providerSelect.appendChild(openaiOption);

    const litellmOption = document.createElement('option');
    litellmOption.value = 'litellm';
    litellmOption.textContent = i18nString(UIStrings.litellmProvider);
    litellmOption.selected = currentProvider === 'litellm';
    providerSelect.appendChild(litellmOption);

    const groqOption = document.createElement('option');
    groqOption.value = 'groq';
    groqOption.textContent = i18nString(UIStrings.groqProvider);
    groqOption.selected = currentProvider === 'groq';
    providerSelect.appendChild(groqOption);

    const openrouterOption = document.createElement('option');
    openrouterOption.value = 'openrouter';
    openrouterOption.textContent = i18nString(UIStrings.openrouterProvider);
    openrouterOption.selected = currentProvider === 'openrouter';
    providerSelect.appendChild(openrouterOption);

    // Ensure the select's value reflects the computed currentProvider
    providerSelect.value = currentProvider;

    // Create provider-specific content containers
    const openaiContent = document.createElement('div');
    openaiContent.className = 'provider-content openai-content';
    openaiContent.style.display = currentProvider === 'openai' ? 'block' : 'none';
    contentDiv.appendChild(openaiContent);

    const litellmContent = document.createElement('div');
    litellmContent.className = 'provider-content litellm-content';
    litellmContent.style.display = currentProvider === 'litellm' ? 'block' : 'none';
    contentDiv.appendChild(litellmContent);

    const groqContent = document.createElement('div');
    groqContent.className = 'provider-content groq-content';
    groqContent.style.display = currentProvider === 'groq' ? 'block' : 'none';
    contentDiv.appendChild(groqContent);

    const openrouterContent = document.createElement('div');
    openrouterContent.className = 'provider-content openrouter-content';
    openrouterContent.style.display = currentProvider === 'openrouter' ? 'block' : 'none';
    contentDiv.appendChild(openrouterContent);

    // Instantiate provider settings classes
    const openaiSettings = new OpenAISettings(
      openaiContent,
      getModelOptions,
      addCustomModelOption,
      removeCustomModelOption
    );

    const litellmSettings = new LiteLLMSettings(
      litellmContent,
      getModelOptions,
      addCustomModelOption,
      removeCustomModelOption,
      updateModelOptions,
      fetchLiteLLMModels
    );

    const groqSettings = new GroqSettings(
      groqContent,
      getModelOptions,
      addCustomModelOption,
      removeCustomModelOption,
      updateModelOptions
    );

    const openrouterSettings = new OpenRouterSettings(
      openrouterContent,
      getModelOptions,
      addCustomModelOption,
      removeCustomModelOption,
      updateModelOptions,
      onSettingsSaved,
      () => dialog.hide()
    );

    // Render all providers (only visible one will be shown)
    openaiSettings.render();
    litellmSettings.render();
    groqSettings.render();
    openrouterSettings.render();

    // Store provider settings for later access
    const providerSettings = new Map<ProviderType, any>([
      ['openai', openaiSettings],
      ['litellm', litellmSettings],
      ['groq', groqSettings],
      ['openrouter', openrouterSettings],
    ]);

    // Event listener for provider change
    providerSelect.addEventListener('change', async () => {
      const selectedProvider = providerSelect.value as ProviderType;

      // Toggle visibility of provider content
      openaiContent.style.display = selectedProvider === 'openai' ? 'block' : 'none';
      litellmContent.style.display = selectedProvider === 'litellm' ? 'block' : 'none';
      groqContent.style.display = selectedProvider === 'groq' ? 'block' : 'none';
      openrouterContent.style.display = selectedProvider === 'openrouter' ? 'block' : 'none';

      // If switching to LiteLLM, fetch the latest models if endpoint is configured
      if (selectedProvider === 'litellm') {
        const endpoint = localStorage.getItem('ai_chat_litellm_endpoint');
        const liteLLMApiKey = localStorage.getItem('ai_chat_litellm_api_key') || '';

        if (endpoint) {
          try {
            logger.debug('Fetching LiteLLM models after provider change...');
            const { models: litellmModels, hadWildcard } = await fetchLiteLLMModels(liteLLMApiKey, endpoint);
            updateModelOptions(litellmModels, hadWildcard);
            litellmSettings.updateModelSelectors();
            logger.debug('Successfully refreshed LiteLLM models after provider change');
          } catch (error) {
            logger.error('Failed to fetch LiteLLM models after provider change:', error);
          }
        }
      } else if (selectedProvider === 'groq') {
        // If switching to Groq, fetch models if API key is configured
        const groqApiKey = localStorage.getItem('ai_chat_groq_api_key') || '';

        if (groqApiKey) {
          try {
            logger.debug('Fetching Groq models after provider change...');
            const groqModels = await LLMClient.fetchGroqModels(groqApiKey);
            const modelOptions: ModelOption[] = groqModels.map(model => ({
              value: model.id,
              label: model.id,
              type: 'groq' as const
            }));
            updateModelOptions(modelOptions, false);
            groqSettings.updateModelSelectors();
            logger.debug('Successfully refreshed Groq models after provider change');
          } catch (error) {
            logger.error('Failed to fetch Groq models after provider change:', error);
          }
        }
      } else if (selectedProvider === 'openrouter') {
        // If switching to OpenRouter, fetch models if API key is configured
        const openrouterApiKey = localStorage.getItem('ai_chat_openrouter_api_key') || '';

        if (openrouterApiKey) {
          try {
            logger.debug('Fetching OpenRouter models after provider change...');
            const openrouterModels = await LLMClient.fetchOpenRouterModels(openrouterApiKey);
            const modelOptions: ModelOption[] = openrouterModels.map(model => ({
              value: model.id,
              label: model.name || model.id,
              type: 'openrouter' as const
            }));
            updateModelOptions(modelOptions, false);
            // Persist cache alongside timestamp for consistency
            localStorage.setItem('openrouter_models_cache', JSON.stringify(modelOptions));
            localStorage.setItem('openrouter_models_cache_timestamp', Date.now().toString());
            openrouterSettings.updateModelSelectors();
            logger.debug('Successfully refreshed OpenRouter models after provider change');
          } catch (error) {
            logger.error('Failed to fetch OpenRouter models after provider change:', error);
          }
        }
      }
    });

    // Create MCP section container
    const mcpSection = document.createElement('div');
    mcpSection.className = 'settings-section mcp-section';
    mcpSection.style.display = 'block';
    contentDiv.appendChild(mcpSection);

    // Instantiate MCP settings
    const mcpSettings = new MCPSettings(
      mcpSection,
      onSettingsSaved,
      () => dialog.hide()
    );
    mcpSettings.render();

    // Add Advanced Settings Toggle
    const advancedToggleContainer = document.createElement('div');
    advancedToggleContainer.className = 'advanced-toggle-container';
    contentDiv.appendChild(advancedToggleContainer);

    const advancedToggleCheckbox = document.createElement('input');
    advancedToggleCheckbox.type = 'checkbox';
    advancedToggleCheckbox.id = 'advanced-settings-toggle';
    advancedToggleCheckbox.className = 'advanced-toggle-checkbox';
    advancedToggleCheckbox.checked = localStorage.getItem(ADVANCED_SETTINGS_ENABLED_KEY) === 'true';
    advancedToggleContainer.appendChild(advancedToggleCheckbox);

    const advancedToggleLabel = document.createElement('label');
    advancedToggleLabel.htmlFor = 'advanced-settings-toggle';
    advancedToggleLabel.className = 'advanced-toggle-label';
    advancedToggleLabel.textContent = '⚙️ Advanced Settings';
    advancedToggleContainer.appendChild(advancedToggleLabel);

    // Create advanced feature sections
    const historySection = document.createElement('div');
    historySection.className = 'settings-section history-section';
    contentDiv.appendChild(historySection);

    const vectorDBSection = document.createElement('div');
    vectorDBSection.className = 'settings-section vector-db-section';
    contentDiv.appendChild(vectorDBSection);

    const tracingSection = document.createElement('div');
    tracingSection.className = 'settings-section tracing-section';
    contentDiv.appendChild(tracingSection);

    const evaluationSection = document.createElement('div');
    evaluationSection.className = 'settings-section evaluation-section';
    contentDiv.appendChild(evaluationSection);

    // Instantiate advanced feature settings classes
    const browsingHistorySettings = new BrowsingHistorySettings(historySection);
    const vectorDBSettings = new VectorDBSettings(vectorDBSection);
    const tracingSettings = new TracingSettings(tracingSection);
    const evaluationSettings = new EvaluationSettings(evaluationSection);

    // Render advanced features
    browsingHistorySettings.render();
    vectorDBSettings.render();
    tracingSettings.render();
    evaluationSettings.render();

    // Store advanced features for cleanup
    const advancedFeatures = [
      browsingHistorySettings,
      vectorDBSettings,
      tracingSettings,
      evaluationSettings,
      mcpSettings
    ];

    // Advanced Settings Toggle Logic
    function toggleAdvancedSections(show: boolean): void {
      const display = show ? 'block' : 'none';
      historySection.style.display = display;
      vectorDBSection.style.display = display;
      tracingSection.style.display = display;
      evaluationSection.style.display = display;

      // Save state to localStorage
      localStorage.setItem(ADVANCED_SETTINGS_ENABLED_KEY, show.toString());
    }

    // Set initial state of advanced sections
    toggleAdvancedSections(advancedToggleCheckbox.checked);

    // Add event listener for toggle
    advancedToggleCheckbox.addEventListener('change', () => {
      toggleAdvancedSections(advancedToggleCheckbox.checked);
    });

    // Create disclaimer
    const disclaimer = document.createElement('div');
    disclaimer.className = 'settings-disclaimer';
    disclaimer.textContent = i18nString(UIStrings.disclaimer);
    contentDiv.appendChild(disclaimer);

    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    contentDiv.appendChild(footer);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'settings-buttons';
    footer.appendChild(buttonContainer);

    const saveStatusMessage = document.createElement('div');
    saveStatusMessage.className = 'settings-status save-status';
    saveStatusMessage.style.display = 'none';
    buttonContainer.appendChild(saveStatusMessage);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = i18nString(UIStrings.cancelButton);
    cancelButton.className = 'settings-button cancel-button';
    cancelButton.setAttribute('type', 'button');
    cancelButton.addEventListener('click', () => dialog.hide());
    buttonContainer.appendChild(cancelButton);

    const saveButton = document.createElement('button');
    saveButton.textContent = i18nString(UIStrings.saveButton);
    saveButton.className = 'settings-button save-button';
    saveButton.setAttribute('type', 'button');
    buttonContainer.appendChild(saveButton);

    saveButton.addEventListener('click', async () => {
      // Disable save button while saving
      saveButton.disabled = true;

      // Show saving status
      saveStatusMessage.textContent = 'Saving settings...';
      saveStatusMessage.style.backgroundColor = 'var(--color-accent-blue-background)';
      saveStatusMessage.style.color = 'var(--color-accent-blue)';
      saveStatusMessage.style.display = 'block';

      // Save provider selection
      const selectedProvider = providerSelect.value;
      localStorage.setItem(PROVIDER_SELECTION_KEY, selectedProvider);

      // Save all provider settings
      openaiSettings.save();
      litellmSettings.save();
      groqSettings.save();
      openrouterSettings.save();

      // Save mini/nano model selections from current provider
      const currentProviderSettings = providerSettings.get(selectedProvider as ProviderType);
      if (currentProviderSettings) {
        const miniModelValue = currentProviderSettings.getMiniModel();
        const nanoModelValue = currentProviderSettings.getNanoModel();

        logger.debug('Mini model value to save:', miniModelValue);
        if (miniModelValue) {
          localStorage.setItem(MINI_MODEL_STORAGE_KEY, miniModelValue);
        } else {
          localStorage.removeItem(MINI_MODEL_STORAGE_KEY);
        }

        logger.debug('Nano model value to save:', nanoModelValue);
        if (nanoModelValue) {
          localStorage.setItem(NANO_MODEL_STORAGE_KEY, nanoModelValue);
        } else {
          localStorage.removeItem(NANO_MODEL_STORAGE_KEY);
        }
      }

      // Save all advanced feature settings
      vectorDBSettings.save();
      tracingSettings.save();
      evaluationSettings.save();
      // browsingHistorySettings and mcpSettings don't have save() methods as they auto-save

      logger.debug('Settings saved successfully');
      logger.debug('Mini Model:', localStorage.getItem(MINI_MODEL_STORAGE_KEY));
      logger.debug('Nano Model:', localStorage.getItem(NANO_MODEL_STORAGE_KEY));
      logger.debug('Provider:', selectedProvider);

      // Set success message and notify parent
      saveStatusMessage.textContent = 'Settings saved successfully';
      saveStatusMessage.style.backgroundColor = 'var(--color-accent-green-background)';
      saveStatusMessage.style.color = 'var(--color-accent-green)';
      saveStatusMessage.style.display = 'block';

      onSettingsSaved();

      setTimeout(() => {
        dialog.hide();
      }, 1500);
    });

    // Apply styles
    applySettingsStyles(dialog.contentElement);

    // Show the dialog
    dialog.show();

    // Cleanup when dialog is hidden
    dialog.contentElement.addEventListener('DOMNodeRemovedFromDocument', () => {
      // Cleanup all advanced features that have cleanup methods
      advancedFeatures.forEach(feature => {
        if (feature.cleanup) {
          feature.cleanup();
        }
      });

      // Cleanup all provider settings that have cleanup methods
      providerSettings.forEach(provider => {
        if (provider.cleanup) {
          provider.cleanup();
        }
      });
    });
  }

  /**
   * Static method to update OpenRouter models cache
   * Called from AIChatPanel when OAuth credentials are available
   */
  static updateOpenRouterModels(openrouterModels: Array<{id: string, name?: string}>): void {
    // Convert OpenRouter models to ModelOption format
    const modelOptions: ModelOption[] = openrouterModels.map(model => ({
      value: model.id,
      label: model.name || model.id,
      type: 'openrouter' as const
    }));

    // Store in localStorage with timestamp
    localStorage.setItem('openrouter_models_cache', JSON.stringify(modelOptions));
    localStorage.setItem('openrouter_models_cache_timestamp', Date.now().toString());
  }
}
