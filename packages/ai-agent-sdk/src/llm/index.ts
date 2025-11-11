// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * LLM Module - Unified interface for multiple LLM providers
 *
 * This module provides a provider-agnostic way to interact with various LLM services.
 * @module llm
 */

// Types
export type * from './LLMTypes.js';
export * from './LLMTypes.js';

// Provider interfaces
export * from './LLMProvider.js';

// Registry
export * from './LLMProviderRegistry.js';

// Utilities
export * from './LLMResponseParser.js';
export * from './MessageSanitizer.js';
export * from './LLMErrorHandler.js';

// Client coordinator
export * from './LLMClient.js';

// Provider implementations
export * from './OpenAIProvider.js';
export * from './LiteLLMProvider.js';
export * from './GroqProvider.js';
export * from './OpenRouterProvider.js';
export * from './BrowserOperatorProvider.js';
