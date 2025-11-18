// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as UI from '../../../ui/legacy/legacy.js';
import { CustomProviderManager } from '../core/CustomProviderManager.js';
import type { CustomProviderConfig } from '../core/CustomProviderManager.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { createLogger } from '../core/Logger.js';
import { PROVIDER_SELECTION_KEY } from './settings/constants.js';

const logger = createLogger('CustomProviderDialog');

/**
 * Dialog for managing custom OpenAI-compatible providers
 */
export class CustomProviderDialog {
  private dialog: UI.Dialog.Dialog | null = null;
  private providers: CustomProviderConfig[] = [];
  private onProvidersChanged?: () => void;

  constructor(onProvidersChanged?: () => void) {
    this.onProvidersChanged = onProvidersChanged;
    this.loadProviders();
  }

  /**
   * Load providers from storage
   */
  private loadProviders(): void {
    this.providers = CustomProviderManager.listProviders();
  }

  /**
   * Show the custom provider management dialog
   */
  show(): void {
    if (this.dialog) {
      return;
    }

    this.loadProviders();

    // Create dialog
    this.dialog = new UI.Dialog.Dialog();
    this.dialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MEASURE_CONTENT);
    this.dialog.setDimmed(true);
    this.dialog.addCloseButton();

    const container = document.createElement('div');
    container.style.cssText = 'min-width: 500px; max-width: 600px; padding: 20px;';

    // Create header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';

    const title = document.createElement('h2');
    title.textContent = 'Manage Custom Providers';
    title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 500;';
    header.appendChild(title);

    const addButton = document.createElement('button');
    addButton.textContent = '+ Add Provider';
    addButton.className = 'devtools-button';
    addButton.style.cssText = 'padding: 6px 12px; cursor: pointer;';
    addButton.addEventListener('click', () => this.showAddEditDialog());
    header.appendChild(addButton);

    container.appendChild(header);

    // Create provider list
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'max-height: 400px; overflow-y: auto;';

    if (this.providers.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No custom providers configured. Click "Add Provider" to add one.';
      emptyMessage.style.cssText = 'color: var(--sys-color-token-subtle); text-align: center; padding: 32px;';
      listContainer.appendChild(emptyMessage);
    } else {
      this.providers.forEach(provider => {
        const providerItem = this.createProviderListItem(provider);
        listContainer.appendChild(providerItem);
      });
    }

    container.appendChild(listContainer);

    this.dialog.contentElement.appendChild(container);
    this.dialog.setOutsideClickCallback(() => this.hide());
    this.dialog.show();
  }

  /**
   * Create a list item for a provider
   */
  private createProviderListItem(provider: CustomProviderConfig): HTMLElement {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 12px; margin-bottom: 8px; border: 1px solid var(--sys-color-divider); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';

    const name = document.createElement('div');
    name.textContent = provider.name;
    name.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
    info.appendChild(name);

    const url = document.createElement('div');
    url.textContent = provider.baseURL;
    url.style.cssText = 'font-size: 12px; color: var(--sys-color-token-subtle);';
    info.appendChild(url);

    const models = document.createElement('div');
    models.textContent = `Models: ${provider.models.length}`;
    models.style.cssText = 'font-size: 11px; color: var(--sys-color-token-subtle); margin-top: 2px;';
    info.appendChild(models);

    item.appendChild(info);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px;';

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.className = 'devtools-button';
    editButton.style.cssText = 'padding: 4px 8px; cursor: pointer;';
    editButton.addEventListener('click', () => this.showAddEditDialog(provider));
    actions.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'devtools-button';
    deleteButton.style.cssText = 'padding: 4px 8px; cursor: pointer; color: var(--sys-color-error);';
    deleteButton.addEventListener('click', () => this.deleteProvider(provider.id));
    actions.appendChild(deleteButton);

    item.appendChild(actions);

    return item;
  }

  /**
   * Show the add/edit provider dialog
   */
  private showAddEditDialog(existingProvider?: CustomProviderConfig): void {
    const addEditDialog = new UI.Dialog.Dialog();
    addEditDialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MEASURE_CONTENT);
    addEditDialog.setDimmed(true);
    addEditDialog.addCloseButton();

    const container = document.createElement('div');
    container.style.cssText = 'min-width: 450px; padding: 20px;';

    // Title
    const title = document.createElement('h2');
    title.textContent = existingProvider ? 'Edit Custom Provider' : 'Add Custom Provider';
    title.style.cssText = 'margin: 0 0 20px 0; font-size: 16px; font-weight: 500;';
    container.appendChild(title);

    // Form
    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // Provider Name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Provider Name';
    nameLabel.style.cssText = 'font-weight: 500; margin-bottom: 4px; display: block;';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = existingProvider?.name || '';
    nameInput.placeholder = 'e.g., Z.AI';
    nameInput.style.cssText = 'padding: 8px; border: 1px solid var(--sys-color-divider); border-radius: 4px; width: 100%;';
    nameInput.disabled = !!existingProvider; // Can't change name when editing
    form.appendChild(nameLabel);
    form.appendChild(nameInput);

    // Base URL
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'Base URL';
    urlLabel.style.cssText = 'font-weight: 500; margin-bottom: 4px; display: block;';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = existingProvider?.baseURL || '';
    urlInput.placeholder = 'https://api.example.com/v1';
    urlInput.style.cssText = 'padding: 8px; border: 1px solid var(--sys-color-divider); border-radius: 4px; width: 100%;';
    form.appendChild(urlLabel);
    form.appendChild(urlInput);

    const urlHint = document.createElement('div');
    urlHint.textContent = 'The base URL for the OpenAI-compatible API (without /chat/completions)';
    urlHint.style.cssText = 'font-size: 12px; color: var(--sys-color-token-subtle); margin-top: -8px;';
    form.appendChild(urlHint);

    // API Key (optional)
    const apiKeyLabel = document.createElement('label');
    apiKeyLabel.textContent = 'API Key (Optional)';
    apiKeyLabel.style.cssText = 'font-weight: 500; margin-bottom: 4px; display: block;';
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.value = existingProvider ? (CustomProviderManager.getApiKey(existingProvider.id) || '') : '';
    apiKeyInput.placeholder = 'Enter API key if required';
    apiKeyInput.style.cssText = 'padding: 8px; border: 1px solid var(--sys-color-divider); border-radius: 4px; width: 100%;';
    form.appendChild(apiKeyLabel);
    form.appendChild(apiKeyInput);

    // Test Connection Section
    const testSection = document.createElement('div');
    testSection.style.cssText = 'padding: 12px; background: var(--sys-color-surface2); border-radius: 4px;';

    const testButton = document.createElement('button');
    testButton.textContent = 'Test Connection & Fetch Models';
    testButton.className = 'devtools-button';
    testButton.style.cssText = 'padding: 8px 16px; cursor: pointer; width: 100%;';
    testSection.appendChild(testButton);

    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'margin-top: 12px; padding: 8px; border-radius: 4px; display: none;';
    testSection.appendChild(statusDiv);

    const modelsDiv = document.createElement('div');
    modelsDiv.style.cssText = 'margin-top: 12px; display: none;';
    testSection.appendChild(modelsDiv);

    form.appendChild(testSection);

    container.appendChild(form);

    // Models Management Section
    const modelsSection = document.createElement('div');
    modelsSection.style.cssText = 'margin-top: 16px; padding: 12px; background: var(--sys-color-surface2); border-radius: 4px;';

    const modelsTitle = document.createElement('div');
    modelsTitle.textContent = 'Available Models';
    modelsTitle.style.cssText = 'font-weight: 500; margin-bottom: 8px;';
    modelsSection.appendChild(modelsTitle);

    const modelsListContainer = document.createElement('div');
    modelsListContainer.style.cssText = 'max-height: 200px; overflow-y: auto; margin-bottom: 12px; padding: 8px; background: var(--sys-color-surface1); border-radius: 4px; min-height: 40px;';
    modelsSection.appendChild(modelsListContainer);

    // Add Model Section
    const addModelContainer = document.createElement('div');
    addModelContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    const addModelLabel = document.createElement('label');
    addModelLabel.textContent = 'Add Model:';
    addModelLabel.style.cssText = 'font-weight: 500; min-width: 80px;';
    addModelContainer.appendChild(addModelLabel);

    const modelNameInput = document.createElement('input');
    modelNameInput.type = 'text';
    modelNameInput.placeholder = 'Enter model name';
    modelNameInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid var(--sys-color-divider); border-radius: 4px;';
    addModelContainer.appendChild(modelNameInput);

    const addModelButton = document.createElement('button');
    addModelButton.textContent = 'Add';
    addModelButton.className = 'devtools-button';
    addModelButton.style.cssText = 'padding: 6px 16px; cursor: pointer;';
    addModelContainer.appendChild(addModelButton);

    modelsSection.appendChild(addModelContainer);
    container.appendChild(modelsSection);

    // Save button (disabled until at least one model exists)
    const saveButton = document.createElement('button');
    saveButton.textContent = existingProvider ? 'Update Provider' : 'Add Provider';
    saveButton.className = 'devtools-button';
    saveButton.style.cssText = 'padding: 10px 20px; cursor: pointer; margin-top: 20px; width: 100%;';
    saveButton.disabled = !existingProvider; // Disabled for new providers until models exist
    container.appendChild(saveButton);

    // Track all models (fetched + manually added)
    let allModels: string[] = existingProvider ? [...existingProvider.models] : [];

    // Helper function to render models list
    const renderModelsList = (): void => {
      modelsListContainer.innerHTML = '';

      if (allModels.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No models added yet. Test connection to fetch models or add manually.';
        emptyMessage.style.cssText = 'color: var(--sys-color-token-subtle); font-size: 12px; padding: 8px; text-align: center;';
        modelsListContainer.appendChild(emptyMessage);
        saveButton.disabled = true;
      } else {
        allModels.forEach(modelName => {
          const modelItem = document.createElement('div');
          modelItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 4px; background: var(--sys-color-surface2); border-radius: 3px;';

          const modelLabel = document.createElement('span');
          modelLabel.textContent = modelName;
          modelLabel.style.cssText = 'font-family: monospace; font-size: 12px; flex: 1;';
          modelItem.appendChild(modelLabel);

          const removeButton = document.createElement('button');
          removeButton.textContent = '×';
          removeButton.className = 'devtools-button';
          removeButton.style.cssText = 'padding: 2px 8px; cursor: pointer; color: var(--sys-color-error); font-size: 16px; line-height: 1;';
          removeButton.title = 'Remove model';
          removeButton.addEventListener('click', () => {
            allModels = allModels.filter(m => m !== modelName);
            renderModelsList();
          });
          modelItem.appendChild(removeButton);

          modelsListContainer.appendChild(modelItem);
        });
        saveButton.disabled = false;
      }
    };

    // Initial render
    renderModelsList();

    // Test connection handler
    testButton.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const baseURL = urlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();

      if (!name) {
        this.showStatus(statusDiv, 'Please enter a provider name', false);
        return;
      }

      if (!baseURL) {
        this.showStatus(statusDiv, 'Please enter a base URL', false);
        return;
      }

      testButton.disabled = true;
      testButton.textContent = 'Testing...';
      this.showStatus(statusDiv, 'Testing connection...', null);

      try {
        const result = await LLMClient.testCustomProviderConnection(name, baseURL, apiKey || undefined);

        if (result.success && result.models && result.models.length > 0) {
          // Merge fetched models with existing models (avoid duplicates)
          const newModels = result.models.filter(m => !allModels.includes(m));
          allModels = [...allModels, ...newModels];
          renderModelsList();

          this.showStatus(statusDiv, `✓ Connection successful! Found ${result.models.length} models${newModels.length < result.models.length ? ' (' + (result.models.length - newModels.length) + ' duplicates skipped)' : ''}.`, true);
          this.showModels(modelsDiv, result.models);
        } else if (result.success) {
          this.showStatus(statusDiv, `✓ Connection successful but no models found. You can add models manually below.`, true);
        } else {
          this.showStatus(statusDiv, `✗ ${result.message}`, false);
        }
      } catch (error) {
        this.showStatus(statusDiv, `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, false);
      } finally {
        testButton.disabled = false;
        testButton.textContent = 'Test Connection & Fetch Models';
      }
    });

    // Add Model button handler
    addModelButton.addEventListener('click', () => {
      const modelName = modelNameInput.value.trim();

      if (!modelName) {
        this.showStatus(statusDiv, 'Please enter a model name', false);
        return;
      }

      if (allModels.includes(modelName)) {
        this.showStatus(statusDiv, `Model "${modelName}" already exists`, false);
        return;
      }

      allModels.push(modelName);
      renderModelsList();
      modelNameInput.value = '';
      this.showStatus(statusDiv, `✓ Added model: ${modelName}`, true);
    });

    // Allow Enter key to add model
    modelNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addModelButton.click();
      }
    });

    // Save button handler
    saveButton.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const baseURL = urlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();

      if (!name || !baseURL) {
        this.showStatus(statusDiv, 'Please fill in all required fields', false);
        return;
      }

      if (allModels.length === 0) {
        this.showStatus(statusDiv, 'Please add at least one model (test connection to fetch or add manually)', false);
        return;
      }

      try {
        if (existingProvider) {
          // Update existing provider
          CustomProviderManager.updateProvider(existingProvider.id, {
            baseURL,
            models: allModels,
            enabled: true
          });

          // Update API key if changed
          if (apiKey) {
            CustomProviderManager.setApiKey(existingProvider.id, apiKey);
          }

          logger.info(`Updated custom provider: ${existingProvider.name}`);
        } else {
          // Add new provider
          const newProvider = CustomProviderManager.addProvider({
            name,
            baseURL,
            models: allModels,
            enabled: true
          });

          // Save API key if provided
          if (apiKey) {
            CustomProviderManager.setApiKey(newProvider.id, apiKey);
          }

          logger.info(`Added custom provider: ${name}`);
        }

        // Notify listeners
        if (this.onProvidersChanged) {
          this.onProvidersChanged();
        }

        // Close dialogs
        addEditDialog.hide();
        this.hide();
      } catch (error) {
        this.showStatus(statusDiv, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, false);
      }
    });

    addEditDialog.contentElement.appendChild(container);
    addEditDialog.setOutsideClickCallback(() => addEditDialog.hide());
    addEditDialog.show();
  }

  /**
   * Show status message
   */
  private showStatus(element: HTMLElement, message: string, success: boolean | null): void {
    element.style.display = 'block';
    element.textContent = message;

    if (success === true) {
      element.style.background = 'var(--sys-color-green-container)';
      element.style.color = 'var(--sys-color-on-green-container)';
    } else if (success === false) {
      element.style.background = 'var(--sys-color-error-container)';
      element.style.color = 'var(--sys-color-on-error-container)';
    } else {
      element.style.background = 'var(--sys-color-neutral-container)';
      element.style.color = 'var(--sys-color-on-surface)';
    }
  }

  /**
   * Show fetched models
   */
  private showModels(element: HTMLElement, models: string[]): void {
    element.style.display = 'block';
    element.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'Available Models:';
    title.style.cssText = 'font-weight: 500; margin-bottom: 8px;';
    element.appendChild(title);

    const modelList = document.createElement('div');
    modelList.style.cssText = 'max-height: 150px; overflow-y: auto; padding: 8px; background: var(--sys-color-surface1); border-radius: 4px;';

    models.forEach(model => {
      const modelItem = document.createElement('div');
      modelItem.textContent = `• ${model}`;
      modelItem.style.cssText = 'padding: 4px 0; font-size: 12px; font-family: monospace;';
      modelList.appendChild(modelItem);
    });

    element.appendChild(modelList);
  }

  /**
   * Delete a provider
   */
  private async deleteProvider(providerId: string): Promise<void> {
    const provider = CustomProviderManager.getProvider(providerId);
    if (!provider) {
      return;
    }

    // Simple confirmation
    if (confirm(`Are you sure you want to delete the provider "${provider.name}"?`)) {
      CustomProviderManager.deleteProvider(providerId);
      logger.info(`Deleted custom provider: ${provider.name}`);

      // Check if the deleted provider is currently selected
      const currentProvider = localStorage.getItem(PROVIDER_SELECTION_KEY);
      if (currentProvider === providerId) {
        // Switch to default provider (openai)
        localStorage.setItem(PROVIDER_SELECTION_KEY, 'openai');
        logger.info(`Switched from deleted provider ${providerId} to openai`);
      }

      // Notify listeners
      if (this.onProvidersChanged) {
        this.onProvidersChanged();
      }

      // Refresh the list
      this.hide();
      this.show();
    }
  }

  /**
   * Hide the dialog
   */
  hide(): void {
    if (this.dialog) {
      this.dialog.hide();
      this.dialog = null;
    }
  }
}
