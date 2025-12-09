// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Memory Module - Public API
 *
 * This module provides a consolidated memory system for the AI Chat panel.
 * All memory-related functionality should be accessed through this index.
 */

// Core exports
export { MemoryModule } from './MemoryModule.js';
export { MemoryBlockManager } from './MemoryBlockManager.js';
export { createMemoryAgentConfig } from './MemoryAgentConfig.js';

// Tool exports
export { SearchMemoryTool } from './SearchMemoryTool.js';
export { UpdateMemoryTool } from './UpdateMemoryTool.js';
export { ListMemoryBlocksTool } from './ListMemoryBlocksTool.js';

// Type exports
export type {
  BlockType,
  MemoryBlock,
  MemorySearchResult,
  MemoryConfig,
} from './types.js';
