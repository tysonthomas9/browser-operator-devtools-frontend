// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as UI from '../../../ui/legacy/legacy.js';
import * as Geometry from '../../../models/geometry/geometry.js';
import { CustomProviderManager } from '../core/CustomProviderManager.js';
import type { CustomProviderConfig } from '../core/CustomProviderManager.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { createLogger } from '../core/Logger.js';
import { PROVIDER_SELECTION_KEY } from './settings/constants.js';
import { applyCustomProviderStyles } from './customProviderStyles.js';

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
    this.dialog.contentElement.classList.add('custom-provider-dialog');

    const container = document.createElement('div');
    container.className = 'custom-provider-container';

    // Create header
    const header = document.createElement('div');
    header.className = 'custom-provider-header';

    const title = document.createElement('h2');
    title.textContent = 'Manage Custom Providers';
    title.className = 'custom-provider-title';
    header.appendChild(title);

    const addButton = document.createElement('button');
    addButton.textContent = '+ Add Provider';
    addButton.className = 'custom-provider-add-button';
    addButton.addEventListener('click', () => this.showAddEditDialog());
    header.appendChild(addButton);

    container.appendChild(header);

    // Create provider list
    const listContainer = document.createElement('div');
    listContainer.className = 'provider-list-container';

    if (this.providers.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No custom providers configured. Click "Add Provider" to add one.';
      emptyMessage.className = 'provider-empty-message';
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

    // Apply styles
    applyCustomProviderStyles(this.dialog.contentElement);

    this.dialog.show();
  }

  /**
   * Create a list item for a provider
   */
  private createProviderListItem(provider: CustomProviderConfig): HTMLElement {
    const item = document.createElement('div');
    item.className = 'provider-list-item';

    const info = document.createElement('div');
    info.className = 'provider-info';

    const name = document.createElement('div');
    name.textContent = provider.name;
    name.className = 'provider-name';
    info.appendChild(name);

    const url = document.createElement('div');
    url.textContent = provider.baseURL;
    url.className = 'provider-url';
    info.appendChild(url);

    const models = document.createElement('div');
    models.textContent = `Models: ${provider.models.length}`;
    models.className = 'provider-models-count';
    info.appendChild(models);

    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'provider-actions';

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.className = 'provider-edit-button';
    editButton.addEventListener('click', () => this.showAddEditDialog(provider));
    actions.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'provider-delete-button';
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
    addEditDialog.setSizeBehavior(UI.GlassPane.SizeBehavior.SET_EXACT_SIZE);
    addEditDialog.setMaxContentSize(new Geometry.Size(window.innerWidth, window.innerHeight));
    addEditDialog.setDimmed(true);
    addEditDialog.addCloseButton();
    addEditDialog.contentElement.classList.add('custom-provider-dialog', 'full-screen');

    const container = document.createElement('div');
    container.className = 'add-edit-container';

    // Title
    const title = document.createElement('h2');
    title.textContent = existingProvider ? 'Edit Custom Provider' : 'Add Custom Provider';
    title.className = 'add-edit-title';
    container.appendChild(title);

    // Form
    const form = document.createElement('div');
    form.className = 'add-edit-form';

    // Provider Name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Provider Name';
    nameLabel.className = 'form-field-label';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = existingProvider?.name || '';
    nameInput.placeholder = 'e.g., Z.AI';
    nameInput.className = 'form-field-input';
    nameInput.disabled = !!existingProvider; // Can't change name when editing
    form.appendChild(nameLabel);
    form.appendChild(nameInput);

    // Base URL
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'Base URL';
    urlLabel.className = 'form-field-label';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = existingProvider?.baseURL || '';
    urlInput.placeholder = 'https://api.example.com/v1';
    urlInput.className = 'form-field-input';
    form.appendChild(urlLabel);
    form.appendChild(urlInput);

    const urlHint = document.createElement('div');
    urlHint.textContent = 'The base URL for the OpenAI-compatible API (without /chat/completions)';
    urlHint.className = 'form-field-hint';
    form.appendChild(urlHint);

    // API Key (optional)
    const apiKeyLabel = document.createElement('label');
    apiKeyLabel.textContent = 'API Key (Optional)';
    apiKeyLabel.className = 'form-field-label';
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.value = existingProvider ? (CustomProviderManager.getApiKey(existingProvider.id) || '') : '';
    apiKeyInput.placeholder = 'Enter API key if required';
    apiKeyInput.className = 'form-field-input';
    form.appendChild(apiKeyLabel);
    form.appendChild(apiKeyInput);

    // Test Connection Section
    const testSection = document.createElement('div');
    testSection.className = 'test-connection-section';

    const testButton = document.createElement('button');
    testButton.textContent = 'Test Connection & Fetch Models';
    testButton.className = 'test-connection-button';
    testSection.appendChild(testButton);

    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    testSection.appendChild(statusDiv);

    const modelsDiv = document.createElement('div');
    modelsDiv.className = 'fetched-models-display';
    testSection.appendChild(modelsDiv);

    form.appendChild(testSection);

    container.appendChild(form);

    // Models Management Section
    const modelsSection = document.createElement('div');
    modelsSection.className = 'models-management-section';

    const modelsTitle = document.createElement('div');
    modelsTitle.textContent = 'Available Models';
    modelsTitle.className = 'models-section-title';
    modelsSection.appendChild(modelsTitle);

    const modelsListContainer = document.createElement('div');
    modelsListContainer.className = 'models-list-container';
    modelsSection.appendChild(modelsListContainer);

    // Add Model Section
    const addModelContainer = document.createElement('div');
    addModelContainer.className = 'add-model-container';

    const addModelLabel = document.createElement('label');
    addModelLabel.textContent = 'Add Model:';
    addModelLabel.className = 'add-model-label';
    addModelContainer.appendChild(addModelLabel);

    const modelNameInput = document.createElement('input');
    modelNameInput.type = 'text';
    modelNameInput.placeholder = 'Enter model name';
    modelNameInput.className = 'add-model-input';
    addModelContainer.appendChild(modelNameInput);

    const addModelButton = document.createElement('button');
    addModelButton.textContent = 'Add';
    addModelButton.className = 'add-model-button';
    addModelContainer.appendChild(addModelButton);

    modelsSection.appendChild(addModelContainer);
    container.appendChild(modelsSection);

    // Save button (disabled until at least one model exists)
    const saveButton = document.createElement('button');
    saveButton.textContent = existingProvider ? 'Update Provider' : 'Add Provider';
    saveButton.className = 'save-provider-button';
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
        emptyMessage.className = 'models-empty-message';
        modelsListContainer.appendChild(emptyMessage);
        saveButton.disabled = true;
      } else {
        allModels.forEach(modelName => {
          const modelItem = document.createElement('div');
          modelItem.className = 'model-item';

          const modelLabel = document.createElement('span');
          modelLabel.textContent = modelName;
          modelLabel.className = 'model-name';
          modelItem.appendChild(modelLabel);

          const removeButton = document.createElement('button');
          removeButton.textContent = '×';
          removeButton.className = 'model-remove-button';
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

    // Apply styles
    applyCustomProviderStyles(addEditDialog.contentElement);

    addEditDialog.show();
  }

  /**
   * Show status message
   */
  private showStatus(element: HTMLElement, message: string, success: boolean | null): void {
    element.classList.add('visible');
    element.textContent = message;

    // Remove existing status classes
    element.classList.remove('status-success', 'status-error', 'status-neutral');

    if (success === true) {
      element.classList.add('status-success');
    } else if (success === false) {
      element.classList.add('status-error');
    } else {
      element.classList.add('status-neutral');
    }
  }

  /**
   * Show fetched models
   */
  private showModels(element: HTMLElement, models: string[]): void {
    element.classList.add('visible');
    element.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'Available Models:';
    title.className = 'fetched-models-title';
    element.appendChild(title);

    const modelList = document.createElement('div');
    modelList.className = 'fetched-models-list';

    models.forEach(model => {
      const modelItem = document.createElement('div');
      modelItem.textContent = `• ${model}`;
      modelItem.className = 'fetched-model-item';
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
