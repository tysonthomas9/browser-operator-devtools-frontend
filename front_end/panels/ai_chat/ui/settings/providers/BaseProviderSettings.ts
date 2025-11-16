// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {
  ModelOption,
  ProviderType,
  GetModelOptionsFunction,
  AddCustomModelOptionFunction,
  RemoveCustomModelOptionFunction,
} from '../types.js';
import { i18nString } from '../i18n-strings.js';
import { createLogger } from '../../../core/Logger.js';

const logger = createLogger('BaseProviderSettings');

/**
 * Base class for provider-specific settings
 */
export abstract class BaseProviderSettings {
  protected container: HTMLElement;
  protected providerType: ProviderType;
  protected getModelOptions: GetModelOptionsFunction;
  protected addCustomModelOption: AddCustomModelOptionFunction;
  protected removeCustomModelOption: RemoveCustomModelOptionFunction;
  protected miniModelSelector: HTMLElement | null = null;
  protected nanoModelSelector: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    providerType: ProviderType,
    getModelOptions: GetModelOptionsFunction,
    addCustomModelOption: AddCustomModelOptionFunction,
    removeCustomModelOption: RemoveCustomModelOptionFunction,
  ) {
    this.container = container;
    this.providerType = providerType;
    this.getModelOptions = getModelOptions;
    this.addCustomModelOption = addCustomModelOption;
    this.removeCustomModelOption = removeCustomModelOption;
  }

  /**
   * Render the provider settings UI
   */
  abstract render(): void;

  /**
   * Update model selectors with latest models
   */
  abstract updateModelSelectors(): void;

  /**
   * Get the currently selected mini model
   */
  getMiniModel(): string {
    return this.miniModelSelector ? (this.miniModelSelector as any).value || '' : '';
  }

  /**
   * Get the currently selected nano model
   */
  getNanoModel(): string {
    return this.nanoModelSelector ? (this.nanoModelSelector as any).value || '' : '';
  }

  /**
   * Save provider-specific settings to localStorage
   */
  abstract save(): void;

  /**
   * Clean up resources (event listeners, intervals, etc.)
   */
  cleanup(): void {
    // Base cleanup - subclasses can override
  }
}
