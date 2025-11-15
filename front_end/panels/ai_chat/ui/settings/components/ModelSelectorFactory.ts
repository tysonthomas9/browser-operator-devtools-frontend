// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { ModelOption, ModelSelectorElement } from '../types.js';
import '../../model_selector/ModelSelector.js';

/**
 * Create a model selector component
 *
 * @param container - Parent element to append the selector to
 * @param labelText - Label text for the selector
 * @param description - Description text below the label
 * @param selectorType - Semantic identifier for the selector
 * @param modelOptions - Available model options
 * @param selectedModel - Currently selected model value
 * @param defaultOptionText - Text for the default option
 * @param onFocus - Optional callback for when the selector is opened/focused
 * @returns The created model selector element
 */
export function createModelSelector(
  container: HTMLElement,
  labelText: string,
  description: string,
  selectorType: string,
  modelOptions: ModelOption[],
  selectedModel: string,
  defaultOptionText: string,
  onFocus?: () => void,
): HTMLElement {
  const modelContainer = document.createElement('div');
  modelContainer.className = 'model-selection-container';
  container.appendChild(modelContainer);

  const modelLabel = document.createElement('div');
  modelLabel.className = 'settings-label';
  modelLabel.textContent = labelText;
  modelContainer.appendChild(modelLabel);

  const modelDescription = document.createElement('div');
  modelDescription.className = 'settings-hint';
  modelDescription.textContent = description;
  modelContainer.appendChild(modelDescription);

  const selectorEl = document.createElement('ai-model-selector') as unknown as ModelSelectorElement;
  selectorEl.dataset.modelType = selectorType;
  selectorEl.options = [{value: '', label: defaultOptionText}, ...modelOptions];
  selectorEl.selected = selectedModel || '';
  selectorEl.forceSearchable = true; // Ensure consistent UI in Settings

  // Expose a `.value` API similar to native <select> for existing code paths
  try {
    Object.defineProperty(selectorEl, 'value', {
      get() {
        return selectorEl.selected || '';
      },
      set(v: string) {
        selectorEl.selected = v || '';
      },
      configurable: true,
    });
  } catch {
    // Property may already be defined
  }

  if (onFocus) {
    selectorEl.addEventListener('model-selector-focus', onFocus);
  }

  modelContainer.appendChild(selectorEl);
  return selectorEl as HTMLElement;
}

/**
 * Refresh the options in a model selector
 *
 * @param select - The model selector element
 * @param models - New model options
 * @param currentValue - Current selected value
 * @param defaultLabel - Label for the default option
 */
export function refreshModelSelectOptions(
  select: ModelSelectorElement | HTMLSelectElement,
  models: ModelOption[],
  currentValue: string,
  defaultLabel: string,
): void {
  // Custom component path
  if ('tagName' in select && select.tagName.toLowerCase() === 'ai-model-selector') {
    const modelSelect = select as ModelSelectorElement;
    const previousValue = modelSelect.value || modelSelect.selected || '';
    const opts = [{value: '', label: defaultLabel}, ...models];
    modelSelect.options = opts;
    if (previousValue && opts.some((o) => o.value === previousValue)) {
      modelSelect.value = previousValue;
    } else if (currentValue && opts.some((o) => o.value === currentValue)) {
      modelSelect.value = currentValue;
    } else {
      modelSelect.value = '';
    }
    return;
  }

  // Native <select> fallback
  const nativeSelect = select as HTMLSelectElement;
  const previousValue = nativeSelect.value;
  while (nativeSelect.options.length > 1) {
    nativeSelect.remove(1);
  }
  models.forEach((option: ModelOption) => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    nativeSelect.appendChild(optionElement);
  });
  if (previousValue && Array.from(nativeSelect.options).some((opt) => opt.value === previousValue)) {
    nativeSelect.value = previousValue;
  } else if (currentValue && Array.from(nativeSelect.options).some((opt) => opt.value === currentValue)) {
    nativeSelect.value = currentValue;
  }
}
