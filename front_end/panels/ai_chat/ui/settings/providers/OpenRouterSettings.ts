// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BaseProviderSettings } from './BaseProviderSettings.js';
import { createModelSelector } from '../components/ModelSelectorFactory.js';
import { i18nString, UIStrings } from '../i18n-strings.js';
import { getValidModelForProvider } from '../utils/validation.js';
import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { OPENROUTER_API_KEY_STORAGE_KEY, MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY, OPENROUTER_MODELS_CACHE_DURATION_MS } from '../constants.js';
import type { UpdateModelOptionsFunction, GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction, ModelOption } from '../types.js';
import { LLMClient } from '../../../LLM/LLMClient.js';
import { createLogger } from '../../../core/Logger.js';

const logger = createLogger('OpenRouterSettings');

/**
 * OpenRouter provider settings
 *
 * Migrated from SettingsDialog.ts lines 2127-2541
 *
 * Special features:
 * - OAuth PKCE authentication flow
 * - Model caching with 60-minute expiration
 * - Dynamic OAuth module import
 */
export class OpenRouterSettings extends BaseProviderSettings {
  private apiKeyInput: HTMLInputElement | null = null;
  private oauthButton: HTMLButtonElement | null = null;
  private oauthStatus: HTMLElement | null = null;
  private fetchModelsButton: HTMLButtonElement | null = null;
  private fetchModelsStatus: HTMLElement | null = null;
  private updateModelOptions: UpdateModelOptionsFunction;
  private onSettingsSaved: () => void;
  private onDialogHide: () => void;

  // OAuth event handlers (stored for cleanup)
  private handleOAuthSuccess: (() => void) | null = null;
  private handleOAuthError: ((event: Event) => void) | null = null;
  private handleOAuthLogout: (() => void) | null = null;

  // Dynamically imported OAuth module
  private OpenRouterOAuth: any = null;

  constructor(
    container: HTMLElement,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction,
    updateModelOptions: UpdateModelOptionsFunction,
    onSettingsSaved: () => void,
    onDialogHide: () => void
  ) {
    super(container, 'openrouter', getModelOptions, addCustomModelOption, removeCustomModelOption);
    this.updateModelOptions = updateModelOptions;
    this.onSettingsSaved = onSettingsSaved;
    this.onDialogHide = onDialogHide;
  }

  private async getOpenRouterOAuth(): Promise<any> {
    if (!this.OpenRouterOAuth) {
      const module = await import('../../../auth/OpenRouterOAuth.js');
      this.OpenRouterOAuth = module.OpenRouterOAuth;
    }
    return this.OpenRouterOAuth;
  }

  render(): void {
    // Clear any existing content
    this.container.innerHTML = '';

    // Setup OpenRouter content
    const openrouterSettingsSection = document.createElement('div');
    openrouterSettingsSection.className = 'settings-section';
    this.container.appendChild(openrouterSettingsSection);

    // OpenRouter API Key
    const openrouterApiKeyLabel = document.createElement('div');
    openrouterApiKeyLabel.className = 'settings-label';
    openrouterApiKeyLabel.textContent = i18nString(UIStrings.openrouterApiKeyLabel);
    openrouterSettingsSection.appendChild(openrouterApiKeyLabel);

    const openrouterApiKeyHint = document.createElement('div');
    openrouterApiKeyHint.className = 'settings-hint';
    openrouterApiKeyHint.textContent = i18nString(UIStrings.openrouterApiKeyHint);
    openrouterSettingsSection.appendChild(openrouterApiKeyHint);

    const settingsSavedOpenRouterApiKey = getStorageItem(OPENROUTER_API_KEY_STORAGE_KEY, '');
    this.apiKeyInput = document.createElement('input');
    this.apiKeyInput.className = 'settings-input openrouter-api-key-input';
    this.apiKeyInput.type = 'password';
    this.apiKeyInput.placeholder = 'Enter your OpenRouter API key';
    this.apiKeyInput.value = settingsSavedOpenRouterApiKey;
    openrouterSettingsSection.appendChild(this.apiKeyInput);

    // OAuth section - alternative to API key
    const oauthDivider = document.createElement('div');
    oauthDivider.className = 'settings-divider';
    oauthDivider.textContent = 'OR';
    openrouterSettingsSection.appendChild(oauthDivider);

    const oauthButtonContainer = document.createElement('div');
    oauthButtonContainer.className = 'oauth-button-container';
    openrouterSettingsSection.appendChild(oauthButtonContainer);

    this.oauthButton = document.createElement('button');
    this.oauthButton.className = 'settings-button oauth-button';
    this.oauthButton.setAttribute('type', 'button');
    this.oauthButton.textContent = 'Connect with OpenRouter';
    oauthButtonContainer.appendChild(this.oauthButton);

    this.oauthStatus = document.createElement('div');
    this.oauthStatus.className = 'oauth-status';
    this.oauthStatus.style.display = 'none';
    oauthButtonContainer.appendChild(this.oauthStatus);

    // Add OAuth-specific styles
    const oauthStyles = document.createElement('style');
    oauthStyles.textContent = `
      .settings-divider {
        text-align: center;
        margin: 15px 0;
        color: var(--color-text-secondary);
        font-size: 12px;
        font-weight: bold;
      }
      .oauth-button-container {
        margin-bottom: 10px;
      }
      .oauth-button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s ease;
        width: 100%;
        margin-bottom: 8px;
      }
      .oauth-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }
      .oauth-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      .oauth-button.disconnect {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
      .oauth-status {
        font-size: 12px;
        margin-top: 5px;
        padding: 5px 8px;
        border-radius: 4px;
        background: var(--color-background-highlight);
      }
    `;
    document.head.appendChild(oauthStyles);

    // Update OAuth button state
    const updateOAuthButton = async () => {
      const OAuth = await this.getOpenRouterOAuth();
      if (await OAuth.isOAuthAuthenticated()) {
        if (this.oauthButton) {
          this.oauthButton.textContent = 'Disconnect OpenRouter';
          this.oauthButton.classList.add('disconnect');
        }
        if (this.oauthStatus) {
          this.oauthStatus.textContent = '✓ Connected via OpenRouter account';
          this.oauthStatus.style.color = 'var(--color-accent-green)';
          this.oauthStatus.style.display = 'block';
        }
      } else {
        if (this.oauthButton) {
          this.oauthButton.textContent = 'Connect with OpenRouter';
          this.oauthButton.classList.remove('disconnect');
        }
        if (this.oauthStatus) {
          this.oauthStatus.style.display = 'none';
        }
      }
    };

    updateOAuthButton();

    // OAuth button click handler
    this.oauthButton.addEventListener('click', async () => {
      if (!this.oauthButton) return;

      const OAuth = await this.getOpenRouterOAuth();
      this.oauthButton.disabled = true;

      try {
        if (await OAuth.isOAuthAuthenticated()) {
          // Disconnect
          if (confirm('Are you sure you want to disconnect your OpenRouter account?')) {
            await OAuth.revokeToken();
            updateOAuthButton();
          }
        } else {
          // Connect - provide clear feedback for tab-based flow
          this.oauthButton.textContent = 'Redirecting to OpenRouter...';
          if (this.oauthStatus) {
            this.oauthStatus.textContent = 'You will be redirected to OpenRouter to authorize access. The page will return here automatically after authorization.';
            this.oauthStatus.style.color = 'var(--color-text-secondary)';
            this.oauthStatus.style.display = 'block';
          }

          await OAuth.startAuthFlow();
          updateOAuthButton();
        }
      } catch (error) {
        logger.error('OAuth flow error:', error);
        if (this.oauthStatus) {
          this.oauthStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.oauthStatus.style.color = 'var(--color-accent-red)';
          this.oauthStatus.style.display = 'block';
        }
      } finally {
        this.oauthButton.disabled = false;
        if (!await OAuth.isOAuthAuthenticated()) {
          this.oauthButton.textContent = 'Connect with OpenRouter';
          if (this.oauthStatus) {
            this.oauthStatus.style.display = 'none';
          }
        }
      }
    });

    // Handle OAuth events
    this.handleOAuthSuccess = () => {
      updateOAuthButton();
      if (this.oauthStatus) {
        this.oauthStatus.textContent = '✓ Successfully connected to OpenRouter';
        this.oauthStatus.style.color = 'var(--color-accent-green)';
        this.oauthStatus.style.display = 'block';
      }

      // Trigger chat panel refresh to recognize new credentials
      const chatPanel = document.querySelector('ai-chat-panel') as any;
      if (chatPanel && typeof chatPanel.refreshCredentials === 'function') {
        chatPanel.refreshCredentials();
      }

      // Auto-save settings and close dialog after successful OAuth
      this.onSettingsSaved();
      setTimeout(() => {
        this.onDialogHide();
      }, 2000);
    };

    this.handleOAuthError = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (this.oauthStatus) {
        this.oauthStatus.textContent = `Error: ${customEvent.detail.error}`;
        this.oauthStatus.style.color = 'var(--color-accent-red)';
        this.oauthStatus.style.display = 'block';
      }
    };

    this.handleOAuthLogout = () => {
      // Clear the API key input field
      if (this.apiKeyInput) {
        this.apiKeyInput.value = '';
      }

      // Update OAuth button state
      updateOAuthButton();

      // Show logout confirmation
      if (this.oauthStatus) {
        this.oauthStatus.textContent = '✓ Disconnected from OpenRouter';
        this.oauthStatus.style.color = 'var(--color-text-secondary)';
        this.oauthStatus.style.display = 'block';
      }

      // Refresh chat panel to recognize credential removal
      const chatPanel = document.querySelector('ai-chat-panel') as any;
      if (chatPanel && typeof chatPanel.refreshCredentials === 'function') {
        chatPanel.refreshCredentials();
      }

      // Auto-close dialog after showing disconnect message
      setTimeout(() => {
        this.onDialogHide();
      }, 2000);
    };

    window.addEventListener('openrouter-oauth-success', this.handleOAuthSuccess);
    window.addEventListener('openrouter-oauth-error', this.handleOAuthError);
    window.addEventListener('openrouter-oauth-logout', this.handleOAuthLogout);

    // Update API key input behavior for OAuth compatibility
    this.apiKeyInput.addEventListener('input', async () => {
      if (!this.apiKeyInput) return;

      if (this.apiKeyInput.value.trim()) {
        // Switch to manual API key method
        localStorage.setItem('openrouter_auth_method', 'api_key');
        const OAuth = await this.getOpenRouterOAuth();
        if (await OAuth.isOAuthAuthenticated()) {
          OAuth.switchToManualApiKey();
        }
      }

      // Update fetch button state
      if (this.fetchModelsButton) {
        this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
      }
    });

    // Fetch OpenRouter models button
    const openrouterFetchButtonContainer = document.createElement('div');
    openrouterFetchButtonContainer.className = 'fetch-button-container';
    openrouterSettingsSection.appendChild(openrouterFetchButtonContainer);

    this.fetchModelsButton = document.createElement('button');
    this.fetchModelsButton.className = 'settings-button';
    this.fetchModelsButton.setAttribute('type', 'button');
    this.fetchModelsButton.textContent = i18nString(UIStrings.fetchOpenRouterModelsButton);
    this.fetchModelsButton.disabled = !this.apiKeyInput.value.trim();
    openrouterFetchButtonContainer.appendChild(this.fetchModelsButton);

    this.fetchModelsStatus = document.createElement('div');
    this.fetchModelsStatus.className = 'settings-status';
    this.fetchModelsStatus.style.display = 'none';
    openrouterFetchButtonContainer.appendChild(this.fetchModelsStatus);

    // Add click handler for fetch OpenRouter models button
    this.fetchModelsButton.addEventListener('click', async () => {
      if (!this.fetchModelsButton || !this.fetchModelsStatus || !this.apiKeyInput) return;

      this.fetchModelsButton.disabled = true;
      this.fetchModelsStatus.textContent = i18nString(UIStrings.fetchingModels);
      this.fetchModelsStatus.style.display = 'block';
      this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-blue-background)';
      this.fetchModelsStatus.style.color = 'var(--color-accent-blue)';

      try {
        const openrouterApiKey = this.apiKeyInput.value.trim();

        // Fetch OpenRouter models using LLMClient static method
        const openrouterModels = await LLMClient.fetchOpenRouterModels(openrouterApiKey);

        // Convert OpenRouter models to ModelOption format
        const modelOptions: ModelOption[] = openrouterModels.map(model => ({
          value: model.id,
          label: model.name || model.id,
          type: 'openrouter' as const
        }));

        // Update model options with fetched OpenRouter models
        this.updateModelOptions(modelOptions, false);

        // Update timestamp for cache management
        localStorage.setItem('openrouter_models_cache_timestamp', Date.now().toString());

        const actualModelCount = openrouterModels.length;

        // Update the model selectors with the new models
        await this.updateModelSelectors();

        // Update status to show success
        this.fetchModelsStatus.textContent = i18nString(UIStrings.fetchedModels, {PH1: actualModelCount});
        this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-green-background)';
        this.fetchModelsStatus.style.color = 'var(--color-accent-green)';

        logger.debug(`Successfully fetched ${actualModelCount} OpenRouter models`);
      } catch (error) {
        logger.error('Error fetching OpenRouter models:', error);
        this.fetchModelsStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.fetchModelsStatus.style.backgroundColor = 'var(--color-accent-red-background)';
        this.fetchModelsStatus.style.color = 'var(--color-accent-red)';
      } finally {
        this.fetchModelsButton.disabled = false;

        // Hide status message after 3 seconds
        setTimeout(() => {
          if (this.fetchModelsStatus) {
            this.fetchModelsStatus.style.display = 'none';
          }
        }, 3000);
      }
    });

    // Initialize OpenRouter model selectors
    this.updateModelSelectors();
  }

  private async checkAndRefreshOpenRouterCache(): Promise<void> {
    try {
      const cacheTimestamp = localStorage.getItem('openrouter_models_cache_timestamp');
      const now = Date.now();

      // If no timestamp, cache is considered stale
      if (!cacheTimestamp) {
        logger.debug('OpenRouter models cache has no timestamp, considering stale');
        await this.autoRefreshOpenRouterModels();
        return;
      }

      const cacheAge = now - parseInt(cacheTimestamp, 10);
      const isStale = cacheAge > OPENROUTER_MODELS_CACHE_DURATION_MS;

      if (isStale) {
        const ageMinutes = Math.round(cacheAge / (1000 * 60));
        logger.debug(`OpenRouter models cache is stale (${ageMinutes} minutes old), auto-refreshing...`);
        await this.autoRefreshOpenRouterModels();
      } else {
        const remainingMinutes = Math.round((OPENROUTER_MODELS_CACHE_DURATION_MS - cacheAge) / (1000 * 60));
        logger.debug(`OpenRouter models cache is fresh (expires in ${remainingMinutes} minutes)`);
      }
    } catch (error) {
      logger.warn('Failed to check OpenRouter models cache age:', error);
    }
  }

  private async autoRefreshOpenRouterModels(): Promise<void> {
    try {
      const openrouterApiKey = this.apiKeyInput?.value.trim();

      if (!openrouterApiKey) {
        logger.debug('No OpenRouter API key available for auto-refresh');
        return;
      }

      logger.debug('Auto-refreshing OpenRouter models...');
      const openrouterModels = await LLMClient.fetchOpenRouterModels(openrouterApiKey);

      // Convert OpenRouter models to ModelOption format
      const modelOptions: ModelOption[] = openrouterModels.map(model => ({
        value: model.id,
        label: model.name || model.id,
        type: 'openrouter' as const
      }));

      // Store in localStorage with timestamp
      localStorage.setItem('openrouter_models_cache', JSON.stringify(modelOptions));
      localStorage.setItem('openrouter_models_cache_timestamp', Date.now().toString());

      // Also update global model options so UI immediately sees models
      this.updateModelOptions(modelOptions, false);

      logger.debug(`Auto-refreshed ${modelOptions.length} OpenRouter models`);
    } catch (error) {
      logger.warn('Failed to auto-refresh OpenRouter models:', error);
    }
  }

  async updateModelSelectors(): Promise<void> {
    if (!this.container) return;

    logger.debug('Updating OpenRouter model selectors');

    // Check if OpenRouter models cache is stale and auto-refresh if needed
    await this.checkAndRefreshOpenRouterCache();

    // Get the latest model options filtered for OpenRouter provider
    const openrouterModels = this.getModelOptions('openrouter');
    logger.debug('OpenRouter models from getModelOptions:', openrouterModels);

    // Get current mini and nano models from storage
    const miniModel = getStorageItem(MINI_MODEL_STORAGE_KEY, '');
    const nanoModel = getStorageItem(NANO_MODEL_STORAGE_KEY, '');

    // Get valid models using generic helper
    const validMiniModel = getValidModelForProvider(miniModel, openrouterModels, 'openrouter', 'mini');
    const validNanoModel = getValidModelForProvider(nanoModel, openrouterModels, 'openrouter', 'nano');

    logger.debug('OpenRouter model selection:', { originalMini: miniModel, validMini: validMiniModel, originalNano: nanoModel, validNano: validNanoModel });

    // Clear any existing model selectors
    const existingSelectors = this.container.querySelectorAll('.model-selection-section');
    existingSelectors.forEach(selector => selector.remove());

    // Create a new model selection section
    const openrouterModelSection = document.createElement('div');
    openrouterModelSection.className = 'model-selection-section';
    this.container.appendChild(openrouterModelSection);

    // Create Mini Model selection for OpenRouter and store reference
    this.miniModelSelector = createModelSelector(
      openrouterModelSection,
      i18nString(UIStrings.miniModelLabel),
      i18nString(UIStrings.miniModelDescription),
      'openrouter-mini-model-select',
      openrouterModels,
      validMiniModel,
      i18nString(UIStrings.defaultMiniOption),
      undefined // No focus handler needed for OpenRouter
    );

    // Create Nano Model selection for OpenRouter and store reference
    this.nanoModelSelector = createModelSelector(
      openrouterModelSection,
      i18nString(UIStrings.nanoModelLabel),
      i18nString(UIStrings.nanoModelDescription),
      'openrouter-nano-model-select',
      openrouterModels,
      validNanoModel,
      i18nString(UIStrings.defaultNanoOption),
      undefined // No focus handler needed for OpenRouter
    );
  }

  save(): void {
    // Save OpenRouter API key
    if (this.apiKeyInput) {
      const newApiKey = this.apiKeyInput.value.trim();
      if (newApiKey) {
        setStorageItem(OPENROUTER_API_KEY_STORAGE_KEY, newApiKey);
      } else {
        setStorageItem(OPENROUTER_API_KEY_STORAGE_KEY, '');
      }
    }
  }

  override cleanup(): void {
    // Remove OAuth event listeners
    if (this.handleOAuthSuccess) {
      window.removeEventListener('openrouter-oauth-success', this.handleOAuthSuccess);
    }
    if (this.handleOAuthError) {
      window.removeEventListener('openrouter-oauth-error', this.handleOAuthError);
    }
    if (this.handleOAuthLogout) {
      window.removeEventListener('openrouter-oauth-logout', this.handleOAuthLogout);
    }

    super.cleanup();
  }
}
