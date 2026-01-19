// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Host from '../../../core/host/host.js';
import * as Lit from '../../../ui/lit/lit.js';
import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import { createLogger } from '../core/Logger.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { CustomProviderDialog } from './CustomProviderDialog.js';
import { CustomProviderManager } from '../core/CustomProviderManager.js';

// Import settings utilities
import { i18nString, UIStrings } from './settings/i18n-strings.js';
import { PROVIDER_SELECTION_KEY, MINI_MODEL_STORAGE_KEY, NANO_MODEL_STORAGE_KEY, ADVANCED_SETTINGS_ENABLED_KEY, PANEL_FILTER_ENABLED_KEY } from './settings/constants.js';
import { isVectorDBEnabled } from './settings/utils/storage.js';
import type { ModelOption, ProviderType, FetchLiteLLMModelsFunction, UpdateModelOptionsFunction, GetModelOptionsFunction, AddCustomModelOptionFunction, RemoveCustomModelOptionFunction } from './settings/types.js';

// Re-export for backward compatibility
export { isVectorDBEnabled };

// Import provider settings classes
import { GenericProviderSettings } from './settings/providers/GenericProviderSettings.js';
import { LiteLLMSettings } from './settings/providers/LiteLLMSettings.js';
import { OpenRouterSettings } from './settings/providers/OpenRouterSettings.js';

// Import provider configurations
import { OpenAIConfig, BrowserOperatorConfig, GroqConfig, CerebrasConfig, AnthropicConfig, GoogleAIConfig } from './settings/providerConfigs.js';

// Import advanced feature settings classes
import { MCPSettings } from './settings/advanced/MCPSettings.js';
import { BrowsingHistorySettings } from './settings/advanced/BrowsingHistorySettings.js';
import { VectorDBSettings } from './settings/advanced/VectorDBSettings.js';
import { TracingSettings } from './settings/advanced/TracingSettings.js';
import { EvaluationSettings } from './settings/advanced/EvaluationSettings.js';
import { MemorySettings } from './settings/advanced/MemorySettings.js';

import './model_selector/ModelSelector.js';
import './common/Dropdown.js';

const logger = createLogger('SettingsDialog');

const {html, Decorators, nothing} = Lit;
const {customElement} = Decorators as any;

// Provider configuration registry
interface ProviderConfig {
  id: ProviderType;
  i18nKey: keyof typeof UIStrings;
  config?: any;
  settingsClass?: 'generic' | 'litellm' | 'openrouter';
}

const PROVIDER_REGISTRY: ProviderConfig[] = [
  { id: 'openai', i18nKey: 'openaiProvider', config: OpenAIConfig, settingsClass: 'generic' },
  { id: 'litellm', i18nKey: 'litellmProvider', settingsClass: 'litellm' },
  { id: 'groq', i18nKey: 'groqProvider', config: GroqConfig, settingsClass: 'generic' },
  { id: 'openrouter', i18nKey: 'openrouterProvider', settingsClass: 'openrouter' },
  { id: 'browseroperator', i18nKey: 'browseroperatorProvider', config: BrowserOperatorConfig, settingsClass: 'generic' },
  { id: 'cerebras', i18nKey: 'cerebrasProvider', config: CerebrasConfig, settingsClass: 'generic' },
  { id: 'anthropic', i18nKey: 'anthropicProvider', config: AnthropicConfig, settingsClass: 'generic' },
  { id: 'googleai', i18nKey: 'googleaiProvider', config: GoogleAIConfig, settingsClass: 'generic' },
];

// Provider auto-fetch configuration
interface ProviderAutoFetchConfig {
  fetchMethod: (apiKey: string) => Promise<any[]>;
  storageKey: string;
  hasNameField: boolean;
  cacheConfig?: {
    cacheKey: string;
    timestampKey: string;
  };
}

const providerAutoFetchMap: Record<string, ProviderAutoFetchConfig> = {
  groq: {
    fetchMethod: LLMClient.fetchGroqModels,
    storageKey: 'ai_chat_groq_api_key',
    hasNameField: false
  },
  openrouter: {
    fetchMethod: LLMClient.fetchOpenRouterModels,
    storageKey: 'ai_chat_openrouter_api_key',
    hasNameField: true,
    cacheConfig: {
      cacheKey: 'openrouter_models_cache',
      timestampKey: 'openrouter_models_cache_timestamp'
    }
  },
  cerebras: {
    fetchMethod: LLMClient.fetchCerebrasModels,
    storageKey: 'ai_chat_cerebras_api_key',
    hasNameField: false
  },
  anthropic: {
    fetchMethod: LLMClient.fetchAnthropicModels,
    storageKey: 'ai_chat_anthropic_api_key',
    hasNameField: true
  },
  googleai: {
    fetchMethod: LLMClient.fetchGoogleAIModels,
    storageKey: 'ai_chat_googleai_api_key',
    hasNameField: true
  }
};

@customElement('ai-settings-dialog')
export class SettingsDialog extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-settings-dialog`;
  readonly #boundRender = this.#render.bind(this);

  // Props passed from parent
  #selectedModel = '';
  #miniModel = '';
  #nanoModel = '';
  #onSettingsSaved?: () => void;
  #fetchLiteLLMModels?: FetchLiteLLMModelsFunction;
  #updateModelOptions?: UpdateModelOptionsFunction;
  #getModelOptions?: GetModelOptionsFunction;
  #addCustomModelOption?: AddCustomModelOptionFunction;
  #removeCustomModelOption?: RemoveCustomModelOptionFunction;

  // Internal state
  #currentProvider: ProviderType = 'openai';
  #showAdvancedSettings = false;
  #saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';
  #initialized = false;

  // Provider settings instances
  #providerSettings = new Map<ProviderType, any>();
  #customProviderSettings: GenericProviderSettings | null = null;

  // Advanced feature settings instances
  #mcpSettings?: MCPSettings;
  #memorySettings?: MemorySettings;
  #browsingHistorySettings?: BrowsingHistorySettings;
  #vectorDBSettings?: VectorDBSettings;
  #tracingSettings?: TracingSettings;
  #evaluationSettings?: EvaluationSettings;

  // DOM refs for settings that need containers
  #providerContainerRefs = new Map<string, HTMLElement>();
  #mcpContainerRef?: HTMLElement;
  #memoryContainerRef?: HTMLElement;
  #historyContainerRef?: HTMLElement;
  #vectorDBContainerRef?: HTMLElement;
  #tracingContainerRef?: HTMLElement;
  #evaluationContainerRef?: HTMLElement;
  #customProviderContainerRef?: HTMLElement;

  // Property setters
  set selectedModel(v: string) { this.#selectedModel = v; }
  set miniModel(v: string) { this.#miniModel = v; }
  set nanoModel(v: string) { this.#nanoModel = v; }
  set onSettingsSaved(fn: () => void) { this.#onSettingsSaved = fn; }
  set fetchLiteLLMModels(fn: FetchLiteLLMModelsFunction) { this.#fetchLiteLLMModels = fn; }
  set updateModelOptions(fn: UpdateModelOptionsFunction) { this.#updateModelOptions = fn; }
  set getModelOptions(fn: GetModelOptionsFunction) { this.#getModelOptions = fn; }
  set addCustomModelOption(fn: AddCustomModelOptionFunction) { this.#addCustomModelOption = fn; }
  set removeCustomModelOption(fn: RemoveCustomModelOptionFunction) { this.#removeCustomModelOption = fn; }

  connectedCallback(): void {
    this.#currentProvider = (localStorage.getItem(PROVIDER_SELECTION_KEY) || 'openai') as ProviderType;
    this.#showAdvancedSettings = localStorage.getItem(ADVANCED_SETTINGS_ENABLED_KEY) === 'true';
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  disconnectedCallback(): void {
    this.#cleanup();
  }

  #cleanup(): void {
    // Cleanup provider settings
    this.#providerSettings.forEach(settings => {
      if (settings?.cleanup) {
        settings.cleanup();
      }
    });
    this.#providerSettings.clear();

    if (this.#customProviderSettings?.cleanup) {
      this.#customProviderSettings.cleanup();
    }
    this.#customProviderSettings = null;

    // Cleanup advanced features
    this.#mcpSettings?.cleanup?.();
    this.#memorySettings?.cleanup?.();
    this.#browsingHistorySettings?.cleanup?.();
    this.#vectorDBSettings?.cleanup?.();
    this.#tracingSettings?.cleanup?.();
    this.#evaluationSettings?.cleanup?.();

    this.#mcpSettings = undefined;
    this.#memorySettings = undefined;
    this.#browsingHistorySettings = undefined;
    this.#vectorDBSettings = undefined;
    this.#tracingSettings = undefined;
    this.#evaluationSettings = undefined;

    this.#initialized = false;
  }

  #initializeProviderSettings(): void {
    if (!this.#getModelOptions || !this.#addCustomModelOption || !this.#removeCustomModelOption) {
      return;
    }

    // Initialize provider settings for each provider
    PROVIDER_REGISTRY.forEach(provider => {
      const container = this.#providerContainerRefs.get(provider.id);
      if (!container) return;

      // Clear existing content
      container.innerHTML = '';

      let settings;
      if (provider.settingsClass === 'litellm') {
        settings = new LiteLLMSettings(
          container,
          this.#getModelOptions!,
          this.#addCustomModelOption!,
          this.#removeCustomModelOption!,
          this.#updateModelOptions!,
          this.#fetchLiteLLMModels!
        );
      } else if (provider.settingsClass === 'openrouter') {
        settings = new OpenRouterSettings(
          container,
          this.#getModelOptions!,
          this.#addCustomModelOption!,
          this.#removeCustomModelOption!,
          this.#updateModelOptions!,
          () => this.#onSettingsSaved?.(),
          () => {} // No dialog to hide in inline mode
        );
      } else {
        const hasUpdateModelOptions = ['groq', 'cerebras', 'anthropic', 'googleai'].includes(provider.id);
        settings = new GenericProviderSettings(
          container,
          provider.config!,
          this.#getModelOptions!,
          this.#addCustomModelOption!,
          this.#removeCustomModelOption!,
          hasUpdateModelOptions ? this.#updateModelOptions : undefined
        );
      }

      settings.render();
      this.#providerSettings.set(provider.id, settings);
    });

    // Initialize custom provider if needed
    if (CustomProviderManager.isCustomProvider(this.#currentProvider)) {
      this.#initializeCustomProviderSettings(this.#currentProvider);
    }
  }

  #initializeCustomProviderSettings(providerId: string): void {
    const container = this.#customProviderContainerRef;
    if (!container || !this.#addCustomModelOption || !this.#removeCustomModelOption) return;

    const customConfig = CustomProviderManager.getProvider(providerId);
    if (!customConfig) return;

    // Clear existing content
    container.innerHTML = '';

    const providerConfig = {
      id: customConfig.id,
      displayName: customConfig.name,
      apiKeyStorageKey: CustomProviderManager.getApiKeyStorageKey(customConfig.id),
      apiKeyLabel: `${customConfig.name} API Key`,
      apiKeyHint: `API key for ${customConfig.name} (optional)`,
      apiKeyPlaceholder: 'Enter API key (optional)',
      hasModelSelectors: true,
      hasFetchButton: false,
      apiKeyOptional: true
    };

    const getModelOptions = (_provider?: ProviderType) => {
      const config = CustomProviderManager.getProvider(providerId);
      if (!config) return [];
      return config.models.map(modelId => ({
        value: modelId,
        label: modelId,
        type: providerId
      }));
    };

    this.#customProviderSettings = new GenericProviderSettings(
      container,
      providerConfig,
      getModelOptions,
      this.#addCustomModelOption!,
      this.#removeCustomModelOption!
    );
    this.#customProviderSettings.render();
  }

  #initializeMCPAndMemory(): void {
    // MCP Settings (always visible)
    if (this.#mcpContainerRef && !this.#mcpSettings) {
      this.#mcpContainerRef.innerHTML = '';
      this.#mcpSettings = new MCPSettings(
        this.#mcpContainerRef,
        () => this.#onSettingsSaved?.(),
        () => {} // No dialog to hide
      );
      this.#mcpSettings.render();
    }

    // Memory Settings (always visible)
    if (this.#memoryContainerRef && !this.#memorySettings) {
      this.#memoryContainerRef.innerHTML = '';
      this.#memorySettings = new MemorySettings(this.#memoryContainerRef);
      this.#memorySettings.render();
    }
  }

  #initializeAdvancedSettings(): void {
    // Ensure MCP and Memory are initialized first
    this.#initializeMCPAndMemory();

    // Browsing History Settings
    if (this.#historyContainerRef && !this.#browsingHistorySettings) {
      this.#historyContainerRef.innerHTML = '';
      this.#browsingHistorySettings = new BrowsingHistorySettings(this.#historyContainerRef);
      this.#browsingHistorySettings.render();
    }

    // Vector DB Settings
    if (this.#vectorDBContainerRef && !this.#vectorDBSettings) {
      this.#vectorDBContainerRef.innerHTML = '';
      this.#vectorDBSettings = new VectorDBSettings(this.#vectorDBContainerRef);
      this.#vectorDBSettings.render();
    }

    // Tracing Settings
    if (this.#tracingContainerRef && !this.#tracingSettings) {
      this.#tracingContainerRef.innerHTML = '';
      this.#tracingSettings = new TracingSettings(this.#tracingContainerRef);
      this.#tracingSettings.render();
    }

    // Evaluation Settings
    if (this.#evaluationContainerRef && !this.#evaluationSettings) {
      this.#evaluationContainerRef.innerHTML = '';
      this.#evaluationSettings = new EvaluationSettings(this.#evaluationContainerRef);
      this.#evaluationSettings.render();
    }
  }

  async #handleProviderChange(value: string): Promise<void> {
    const selectedProvider = value as ProviderType;
    this.#currentProvider = selectedProvider;

    // Re-render to show/hide provider sections
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);

    // Handle custom provider
    const isCustom = CustomProviderManager.isCustomProvider(selectedProvider);
    if (isCustom) {
      if (this.#customProviderSettings) {
        this.#customProviderSettings.cleanup();
      }
      // Will be initialized after render
      setTimeout(() => this.#initializeCustomProviderSettings(selectedProvider), 0);
    }

    // Handle LiteLLM
    if (selectedProvider === 'litellm' && this.#fetchLiteLLMModels && this.#updateModelOptions) {
      const endpoint = localStorage.getItem('ai_chat_litellm_endpoint');
      const apiKey = localStorage.getItem('ai_chat_litellm_api_key') || '';

      if (endpoint) {
        try {
          logger.debug('Fetching LiteLLM models after provider change...');
          const { models, hadWildcard } = await this.#fetchLiteLLMModels(apiKey, endpoint);
          this.#updateModelOptions(models, hadWildcard);
          const settings = this.#providerSettings.get('litellm');
          if (settings) {
            settings.updateModelSelectors();
          }
        } catch (error) {
          logger.error('Failed to fetch LiteLLM models:', error);
        }
      }
    }
    // Generic handler for other providers
    else if (providerAutoFetchMap[selectedProvider] && this.#updateModelOptions) {
      const config = providerAutoFetchMap[selectedProvider];
      const apiKey = localStorage.getItem(config.storageKey) || '';

      if (apiKey) {
        try {
          logger.debug(`Fetching ${selectedProvider} models after provider change...`);
          const models = await config.fetchMethod(apiKey);
          const modelOptions: ModelOption[] = models.map(model => ({
            value: model.id,
            label: config.hasNameField ? (model.name || model.id) : model.id,
            type: selectedProvider as any
          }));
          this.#updateModelOptions(modelOptions, false);

          if (config.cacheConfig) {
            localStorage.setItem(config.cacheConfig.cacheKey, JSON.stringify(modelOptions));
            localStorage.setItem(config.cacheConfig.timestampKey, Date.now().toString());
          }

          const settings = this.#providerSettings.get(selectedProvider);
          if (settings) {
            settings.updateModelSelectors();
          }
        } catch (error) {
          logger.error(`Failed to fetch ${selectedProvider} models:`, error);
        }
      }
    }
  }

  #handleManageCustomProviders(): void {
    const customProviderDialog = new CustomProviderDialog(() => {
      // Re-render to show updated custom providers
      void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
    });
    customProviderDialog.show();
  }

  #handleAdvancedToggle(): void {
    this.#showAdvancedSettings = !this.#showAdvancedSettings;
    localStorage.setItem(ADVANCED_SETTINGS_ENABLED_KEY, this.#showAdvancedSettings.toString());
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  #handlePanelFilterChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    localStorage.setItem(PANEL_FILTER_ENABLED_KEY, checkbox.checked.toString());
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.reattach(() => window.location.reload());
  }

  async #handleSave(): Promise<void> {
    this.#saveStatus = 'saving';
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);

    try {
      // Save provider selection
      localStorage.setItem(PROVIDER_SELECTION_KEY, this.#currentProvider);

      // Save all provider settings
      this.#providerSettings.forEach(settings => {
        settings.save();
      });

      // Save custom provider settings if active
      if (this.#customProviderSettings) {
        this.#customProviderSettings.save();
      }

      // Get current provider settings
      const currentSettings = CustomProviderManager.isCustomProvider(this.#currentProvider)
        ? this.#customProviderSettings
        : this.#providerSettings.get(this.#currentProvider);

      if (currentSettings) {
        const miniModelValue = currentSettings.getMiniModel();
        const nanoModelValue = currentSettings.getNanoModel();

        if (miniModelValue) {
          localStorage.setItem(MINI_MODEL_STORAGE_KEY, miniModelValue);
        } else {
          localStorage.removeItem(MINI_MODEL_STORAGE_KEY);
        }

        if (nanoModelValue) {
          localStorage.setItem(NANO_MODEL_STORAGE_KEY, nanoModelValue);
        } else {
          localStorage.removeItem(NANO_MODEL_STORAGE_KEY);
        }
      }

      // Save advanced feature settings
      this.#vectorDBSettings?.save();
      this.#tracingSettings?.save();
      this.#evaluationSettings?.save();

      logger.debug('Settings saved successfully');

      this.#saveStatus = 'success';
      this.#onSettingsSaved?.();

      // Reset status after delay
      setTimeout(() => {
        this.#saveStatus = 'idle';
        void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
      }, 2000);

    } catch (error) {
      logger.error('Failed to save settings:', error);
      this.#saveStatus = 'error';
    }

    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  #getProviderOptions(): Array<{value: string, label: string}> {
    const customProviders = CustomProviderManager.listEnabledProviders();

    const options: Array<{value: string, label: string}> = PROVIDER_REGISTRY.map(provider => ({
      value: provider.id,
      label: i18nString(UIStrings[provider.i18nKey])
    }));

    // Add custom providers
    customProviders.forEach(provider => {
      options.push({
        value: provider.id,
        label: `${provider.name} (Custom)`
      });
    });

    return options;
  }

  #renderSaveStatus(): Lit.TemplateResult {
    if (this.#saveStatus === 'idle') {
      return html``;
    }

    const statusClass = this.#saveStatus === 'success' ? 'success' : this.#saveStatus === 'error' ? 'error' : '';
    const statusText = this.#saveStatus === 'saving' ? 'Saving settings...'
      : this.#saveStatus === 'success' ? 'Settings saved successfully'
      : 'Failed to save settings';

    return html`<div class="save-status ${statusClass}">${statusText}</div>`;
  }

  #render(): void {
    const isCustomProvider = CustomProviderManager.isCustomProvider(this.#currentProvider);
    const panelFilterEnabled = localStorage.getItem(PANEL_FILTER_ENABLED_KEY) !== 'false';

    Lit.render(html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #fafafa;
          overflow: hidden;
        }

        ai-settings-dialog {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #fafafa;
          overflow: hidden;
        }

        .settings-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          padding: 24px 20px;
          gap: 16px;
          overflow: hidden;
          flex: 1;
          min-height: 0;
          box-sizing: border-box;
        }

        .settings-scroll-area {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          min-height: 0;
        }

        .settings-header {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
          padding-bottom: 8px;
        }

        .settings-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
          text-align: center;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .settings-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          line-height: 1.4;
          min-height: 20px;
        }

        .settings-hint {
          display: block;
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
          min-height: 16px;
        }

        .settings-select {
          width: 100%;
          height: auto;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #1e293b;
          font-size: 14px;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }

        .settings-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .settings-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #1e293b;
          font-size: 14px;
        }

        .settings-input::placeholder {
          color: #94a3b8;
        }

        .settings-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .settings-button {
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #475569;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .settings-button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .settings-button.primary {
          background: #3b82f6;
          color: white;
          border: none;
        }

        .settings-button.primary:hover {
          background: #2563eb;
        }

        .settings-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .provider-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .provider-content:empty {
          display: none;
        }

        /* Nested settings-section inside provider-content from provider classes */
        .provider-content .settings-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .settings-content-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .settings-content-container:empty {
          display: none;
        }

        /* Nested settings-section inside content containers from settings classes */
        .settings-content-container .settings-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .advanced-toggle-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          box-sizing: border-box;
          width: 100%;
          min-height: 60px;
        }

        .advanced-toggle-container:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .advanced-toggle-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .advanced-label {
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          line-height: 1.4;
        }

        .advanced-hint {
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
        }

        /* Toggle Switch */
        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #3b82f6;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .advanced-checkbox {
          display: none;
        }

        .panel-filter-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Checkbox container styles for advanced settings */
        .tracing-enabled-container {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .tracing-checkbox {
          width: 14px;
          height: 14px;
          margin: 0;
          cursor: pointer;
          flex-shrink: 0;
        }

        .tracing-label {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          cursor: pointer;
        }

        .evaluation-enabled-container {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .evaluation-checkbox {
          width: 14px;
          height: 14px;
          margin: 0;
          cursor: pointer;
          flex-shrink: 0;
        }

        .evaluation-label {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          cursor: pointer;
        }

        .settings-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 0;
          flex-shrink: 0;
        }

        .save-status {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-right: auto;
        }

        .save-status.success {
          background: #dcfce7;
          color: #166534;
        }

        .save-status.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .disclaimer-section {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }

        .disclaimer-section p {
          margin: 8px 0;
        }

        .disclaimer-warning {
          color: #dc2626;
        }

        .settings-subtitle {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 8px 0;
        }
      </style>

      <div class="settings-container">
        <div class="settings-header">
          <h2 class="settings-title">${i18nString(UIStrings.settings)}</h2>
        </div>

        <div class="settings-scroll-area">
        <!-- Provider Selection -->
        <div class="settings-section">
          <div class="settings-label">${i18nString(UIStrings.providerLabel)}</div>
          <div class="settings-hint">${i18nString(UIStrings.providerHint)}</div>
          <ai-dropdown
            .options=${this.#getProviderOptions()}
            .selectedValue=${this.#currentProvider ?? ''}
            .placeholder=${'Select provider'}
            .onChange=${(value: string) => this.#handleProviderChange(value)}
          ></ai-dropdown>
          <button class="settings-button" @click=${this.#handleManageCustomProviders.bind(this)}>
            ${i18nString(UIStrings.manageCustomProvidersButton)}
          </button>
        </div>

        <!-- Provider-specific Settings -->
        ${PROVIDER_REGISTRY.map(provider => html`
          <div
            class="provider-content"
            style="display: ${this.#currentProvider === provider.id ? 'flex' : 'none'}"
            ${Lit.Directives.ref((el?: Element) => {
              if (el) {
                this.#providerContainerRefs.set(provider.id, el as HTMLElement);
                if (!this.#initialized) {
                  setTimeout(() => {
                    this.#initializeProviderSettings();
                    this.#initialized = true;
                  }, 0);
                }
              }
            })}
          ></div>
        `)}

        <!-- Custom Provider Content -->
        <div
          class="provider-content"
          style="display: ${isCustomProvider ? 'block' : 'none'}"
          ${Lit.Directives.ref((el?: Element) => {
            if (el) {
              this.#customProviderContainerRef = el as HTMLElement;
            }
          })}
        ></div>

        <!-- MCP Settings (always visible) -->
        <div
          class="settings-content-container"
          ${Lit.Directives.ref((el?: Element) => {
            if (el) {
              this.#mcpContainerRef = el as HTMLElement;
              if (!this.#mcpSettings) {
                setTimeout(() => this.#initializeMCPAndMemory(), 0);
              }
            }
          })}
        ></div>

        <!-- Memory Settings (always visible) -->
        <div
          class="settings-content-container"
          ${Lit.Directives.ref((el?: Element) => {
            if (el) {
              this.#memoryContainerRef = el as HTMLElement;
              if (!this.#memorySettings) {
                setTimeout(() => this.#initializeMCPAndMemory(), 0);
              }
            }
          })}
        ></div>

        <!-- Advanced Settings Toggle -->
        <div class="advanced-toggle-container" @click=${this.#handleAdvancedToggle.bind(this)}>
          <div class="advanced-toggle-info">
            <label class="advanced-label">Advanced Settings</label>
            <span class="advanced-hint">Show Browsing History, Vector DB, Tracing, Evaluation</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              .checked=${this.#showAdvancedSettings}
              @click=${(e: Event) => e.stopPropagation()}
              @change=${this.#handleAdvancedToggle.bind(this)}
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- Advanced Feature Sections (conditionally shown) -->
        ${this.#showAdvancedSettings ? html`
          <div
            class="settings-content-container"
            ${Lit.Directives.ref((el?: Element) => {
              if (el) {
                this.#historyContainerRef = el as HTMLElement;
                setTimeout(() => this.#initializeAdvancedSettings(), 0);
              }
            })}
          ></div>

          <div
            class="settings-content-container"
            ${Lit.Directives.ref((el?: Element) => {
              if (el) {
                this.#vectorDBContainerRef = el as HTMLElement;
                setTimeout(() => this.#initializeAdvancedSettings(), 0);
              }
            })}
          ></div>

          <div
            class="settings-content-container"
            ${Lit.Directives.ref((el?: Element) => {
              if (el) {
                this.#tracingContainerRef = el as HTMLElement;
                setTimeout(() => this.#initializeAdvancedSettings(), 0);
              }
            })}
          ></div>

          <div
            class="settings-content-container"
            ${Lit.Directives.ref((el?: Element) => {
              if (el) {
                this.#evaluationContainerRef = el as HTMLElement;
                setTimeout(() => this.#initializeAdvancedSettings(), 0);
              }
            })}
          ></div>

          <!-- Panel Filter -->
          <div class="settings-section">
            <h3 class="settings-subtitle">Panel Visibility</h3>
            <div class="panel-filter-container">
              <input
                type="checkbox"
                id="panel-filter-toggle"
                .checked=${panelFilterEnabled}
                @change=${this.#handlePanelFilterChange.bind(this)}
              />
              <label for="panel-filter-toggle">Show only AI Chat panel</label>
            </div>
            <div class="settings-hint">
              When disabled, shows all standard DevTools panels (Elements, Console, etc.). Requires DevTools reload.
            </div>
          </div>
        ` : nothing}

        <!-- Disclaimer -->
        <div class="settings-section disclaimer-section">
          <h3 class="settings-subtitle">${i18nString(UIStrings.importantNotice)}</h3>
          <p class="disclaimer-warning">
            <strong>Beta Version:</strong> This is a beta version of the Browser Operator - AI Assistant feature.
          </p>
          <p>
            <strong>Data Sharing:</strong> When using this feature, your browser data and conversation content will be sent to the AI model for processing.
          </p>
          <p>
            <strong>Provider Support:</strong> We currently support OpenAI, Groq and OpenRouter providers directly. And we support LiteLLM as a proxy to access 100+ other models.
          </p>
          <p>
            By using this feature, you acknowledge that your data will be processed according to Model Provider's privacy policy and terms of service.
          </p>
        </div>
        </div><!-- End settings-scroll-area -->

        <!-- Footer -->
        <div class="settings-footer">
          ${this.#renderSaveStatus()}
          <button
            class="settings-button primary"
            @click=${this.#handleSave.bind(this)}
            ?disabled=${this.#saveStatus === 'saving'}
          >
            ${i18nString(UIStrings.saveButton)}
          </button>
        </div>
      </div>
    `, this, {host: this});
  }

  /**
   * Static method to update OpenRouter models cache
   * Called from AIChatPanel when OAuth credentials are available
   */
  static updateOpenRouterModels(openrouterModels: Array<{id: string, name?: string}>): void {
    const modelOptions: ModelOption[] = openrouterModels.map(model => ({
      value: model.id,
      label: model.name || model.id,
      type: 'openrouter' as const
    }));

    localStorage.setItem('openrouter_models_cache', JSON.stringify(modelOptions));
    localStorage.setItem('openrouter_models_cache_timestamp', Date.now().toString());
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-settings-dialog': SettingsDialog;
  }
}
