// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as UI from '../../../ui/legacy/legacy.js';
import { CustomProviderManager } from '../core/CustomProviderManager.js';
import type { CustomProviderConfig } from '../core/CustomProviderManager.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { createLogger } from '../core/Logger.js';

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

    // Save button (disabled until test passes)
    const saveButton = document.createElement('button');
    saveButton.textContent = existingProvider ? 'Update Provider' : 'Add Provider';
    saveButton.className = 'devtools-button';
    saveButton.style.cssText = 'padding: 10px 20px; cursor: pointer; margin-top: 20px; width: 100%;';
    saveButton.disabled = !existingProvider; // Disabled for new providers until test passes
    container.appendChild(saveButton);

    let fetchedModels: string[] = [];

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
          fetchedModels = result.models;
          this.showStatus(statusDiv, `✓ Connection successful! Found ${result.models.length} models.`, true);
          this.showModels(modelsDiv, result.models);
          saveButton.disabled = false;
        } else if (result.success) {
          this.showStatus(statusDiv, `✓ Connection successful but no models found.`, false);
          saveButton.disabled = true;
        } else {
          this.showStatus(statusDiv, `✗ ${result.message}`, false);
          saveButton.disabled = true;
        }
      } catch (error) {
        this.showStatus(statusDiv, `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, false);
        saveButton.disabled = true;
      } finally {
        testButton.disabled = false;
        testButton.textContent = 'Test Connection & Fetch Models';
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

      if (fetchedModels.length === 0 && !existingProvider) {
        this.showStatus(statusDiv, 'Please test the connection and fetch models first', false);
        return;
      }

      try {
        if (existingProvider) {
          // Update existing provider
          CustomProviderManager.updateProvider(existingProvider.id, {
            baseURL,
            models: fetchedModels.length > 0 ? fetchedModels : existingProvider.models,
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
            models: fetchedModels,
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
