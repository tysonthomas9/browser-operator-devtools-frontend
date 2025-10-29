// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Represents an AI model option in the settings dialog
 */
export interface ModelOption {
  value: string;
  label: string;
  type: 'openai' | 'litellm' | 'groq' | 'openrouter';
}

/**
 * Validation result for model selection
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Provider type
 */
export type ProviderType = 'openai' | 'litellm' | 'groq' | 'openrouter';

/**
 * Model tier type
 */
export type ModelTier = 'mini' | 'nano';

/**
 * Model selector element interface
 */
export interface ModelSelectorElement extends HTMLElement {
  value: string;
  selected: string;
  options: Array<{value: string, label: string}>;
  dataset: {
    modelType?: string;
  };
  forceSearchable?: boolean;
}

/**
 * Settings save callback
 */
export type OnSettingsSavedCallback = () => void;

/**
 * Fetch LiteLLM models result
 */
export interface FetchLiteLLMModelsResult {
  models: ModelOption[];
  hadWildcard: boolean;
}

/**
 * Fetch LiteLLM models function signature
 */
export type FetchLiteLLMModelsFunction = (
  apiKey: string | null,
  endpoint?: string
) => Promise<FetchLiteLLMModelsResult>;

/**
 * Update model options function signature
 */
export type UpdateModelOptionsFunction = (
  litellmModels: ModelOption[],
  hadWildcard?: boolean
) => void;

/**
 * Get model options function signature
 */
export type GetModelOptionsFunction = (
  provider?: ProviderType
) => ModelOption[];

/**
 * Add custom model option function signature
 */
export type AddCustomModelOptionFunction = (
  modelName: string,
  modelType?: ProviderType
) => ModelOption[];

/**
 * Remove custom model option function signature
 */
export type RemoveCustomModelOptionFunction = (
  modelName: string
) => ModelOption[];
