// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { DEFAULT_PROVIDER_MODELS } from '../../AIChatPanel.js';
import type { ModelOption, ProviderType, ModelTier } from '../types.js';
import { findClosestModel } from '../../../LLM/FuzzyModelMatcher.js';

/**
 * Get a valid model for a specific provider, falling back to defaults if needed
 */
export function getValidModelForProvider(
  currentModel: string,
  providerModels: ModelOption[],
  provider: ProviderType,
  modelType: ModelTier,
): string {
  const availableValues = providerModels.map(m => m.value);

  // 1. Check if current model is valid (exact match only)
  if (providerModels.some(model => model.value === currentModel)) {
    return currentModel;
  }

  // 2. Get defaults from AIChatPanel's DEFAULT_PROVIDER_MODELS
  const defaults = DEFAULT_PROVIDER_MODELS[provider] || DEFAULT_PROVIDER_MODELS.openai;
  const defaultModel = modelType === 'mini' ? defaults.mini : defaults.nano;

  // 3. Check exact match for default
  if (defaultModel && providerModels.some(model => model.value === defaultModel)) {
    return defaultModel;
  }

  // 4. Try fuzzy match for default only
  if (defaultModel) {
    const fuzzyDefault = findClosestModel(defaultModel, availableValues);
    if (fuzzyDefault) {
      return fuzzyDefault;
    }
  }

  // 5. If no valid model found, return empty string to indicate no selection
  // The UI should handle this by showing a placeholder or the first available option
  return '';
}

/**
 * Validate that a model selection is valid for the given provider
 */
export function validateModelSelection(
  modelValue: string,
  providerModels: ModelOption[],
): boolean {
  if (!modelValue) {
    return true; // Empty selection is valid (will use default)
  }
  return providerModels.some(model => model.value === modelValue);
}

/**
 * Validate API key format (basic check for non-empty string)
 */
export function validateApiKey(apiKey: string): boolean {
  return apiKey.trim().length > 0;
}

/**
 * Validate endpoint URL format
 */
export function validateEndpoint(endpoint: string): boolean {
  if (!endpoint.trim()) {
    return false;
  }
  try {
    new URL(endpoint);
    return true;
  } catch {
    return false;
  }
}
