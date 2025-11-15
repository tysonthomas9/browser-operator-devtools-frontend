// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { DEFAULT_PROVIDER_MODELS } from '../../AIChatPanel.js';
import type { ModelOption, ProviderType, ModelTier } from '../types.js';

/**
 * Get a valid model for a specific provider, falling back to defaults if needed
 */
export function getValidModelForProvider(
  currentModel: string,
  providerModels: ModelOption[],
  provider: ProviderType,
  modelType: ModelTier,
): string {
  // Check if current model is valid for this provider
  if (providerModels.some(model => model.value === currentModel)) {
    return currentModel;
  }

  // Get defaults from AIChatPanel's DEFAULT_PROVIDER_MODELS
  const defaults = DEFAULT_PROVIDER_MODELS[provider] || DEFAULT_PROVIDER_MODELS.openai;
  const defaultModel = modelType === 'mini' ? defaults.mini : defaults.nano;

  // Return default if it exists in provider models
  if (defaultModel && providerModels.some(model => model.value === defaultModel)) {
    return defaultModel;
  }

  // If no valid model found, return empty string to indicate no selection
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
