// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { MemoryConfig } from './types.js';

/**
 * Memory Module - Central facade for the memory system.
 *
 * Provides:
 * - Configuration constants
 * - Settings management (enable/disable)
 * - Memory instructions for prompts
 * - Tool availability checks
 */

// Memory instructions prepended to orchestrator prompts when memory is enabled
const MEMORY_INSTRUCTIONS_TEXT = `<memory>
You have a persistent memory system that remembers information across conversations.

Memory is organized into blocks:
- **user**: Information about the user (name, preferences, working style)
- **facts**: Important facts learned from past conversations
- **project_***: Project-specific context (tech stack, goals, current work)

**To access memory, use the 'search_memory_agent' tool.** Call it when:
- The user asks about something you might have discussed before
- You need to recall user preferences or past context
- The conversation involves a project you may have worked on

Memory is updated automatically after conversations end.
</memory>

`;

// Default configuration
const DEFAULT_CONFIG: MemoryConfig = {
  blockLimits: {
    user: 20000,
    facts: 20000,
    project: 20000,
  },
  maxProjectBlocks: 4,
  sessionId: '__global_memory__',
  enabledKey: 'ai_chat_memory_enabled',
};

/**
 * Singleton class for memory system configuration and settings.
 */
export class MemoryModule {
  private static instance: MemoryModule | null = null;
  private config: MemoryConfig;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): MemoryModule {
    if (!MemoryModule.instance) {
      MemoryModule.instance = new MemoryModule();
    }
    return MemoryModule.instance;
  }

  /**
   * Get the memory configuration.
   */
  getConfig(): MemoryConfig {
    return this.config;
  }

  /**
   * Check if memory is enabled in settings.
   * Memory is enabled by default (returns true if not explicitly set to 'false').
   */
  isEnabled(): boolean {
    return localStorage.getItem(this.config.enabledKey) !== 'false';
  }

  /**
   * Enable or disable memory.
   */
  setEnabled(enabled: boolean): void {
    localStorage.setItem(this.config.enabledKey, enabled.toString());
  }

  /**
   * Get memory instructions for prompt injection.
   * Returns empty string if memory is disabled.
   */
  getInstructions(): string {
    return this.isEnabled() ? MEMORY_INSTRUCTIONS_TEXT : '';
  }

  /**
   * Check if memory tool should be included in agent tools.
   * Shorthand for isEnabled() - useful for tool filtering.
   */
  shouldIncludeMemoryTool(): boolean {
    return this.isEnabled();
  }

  /**
   * Get the character limit for a specific block type.
   */
  getBlockLimit(type: 'user' | 'facts' | 'project'): number {
    return this.config.blockLimits[type];
  }

  /**
   * Get the maximum number of project blocks allowed.
   */
  getMaxProjectBlocks(): number {
    return this.config.maxProjectBlocks;
  }

  /**
   * Get the session ID used for global memory storage.
   */
  getSessionId(): string {
    return this.config.sessionId;
  }
}
