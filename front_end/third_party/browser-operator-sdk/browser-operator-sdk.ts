// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Browser Operator AI Agent SDK entrypoint for DevTools
 *
 * This module exports the Browser Operator SDK for use in the AI Chat panel.
 * The SDK provides:
 * - LLM provider abstractions (OpenAI, Anthropic, Groq, OpenRouter, LiteLLM)
 * - Tool system with runtime context injection
 * - Workflow engine with persistence
 * - Agent framework
 * - State management
 * - Memory system
 */

// Re-export all SDK modules
export * from './index.js';

// Submodule exports for direct access
export * as Agent from './agent/index.js';
export * as Tools from './tools/index.js';
export * as Workflows from './workflows/index.js';
export * as State from './state/index.js';
export * as Hooks from './hooks/index.js';
export * as Events from './events/index.js';
export * as Types from './types/index.js';
export * as LLM from './llm/index.js';
export * as Memory from './memory/index.js';

// Zod is a peer dependency, re-export from mcp-sdk vendor
export {z} from '../mcp-sdk/zod/lib/index.js';
