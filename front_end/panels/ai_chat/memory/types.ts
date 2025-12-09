// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Memory System Types
 *
 * Shared type definitions for the memory module.
 */

/**
 * Block types for memory storage.
 * - user: User preferences, name, coding style
 * - facts: Recent extracted facts from conversations
 * - project: Project-specific context (max 4 blocks)
 */
export type BlockType = 'user' | 'facts' | 'project';

/**
 * A memory block stored in the system.
 */
export interface MemoryBlock {
  filename: string;
  type: BlockType;
  label: string;
  description: string;
  content: string;
  charLimit: number;
  updatedAt: number;
}

/**
 * Result from searching memory blocks.
 */
export interface MemorySearchResult {
  block: MemoryBlock;
  matches: string[];
}

/**
 * Configuration constants for the memory system.
 */
export interface MemoryConfig {
  /** Character limit per block type */
  blockLimits: {
    user: number;
    facts: number;
    project: number;
  };
  /** Maximum number of project blocks allowed */
  maxProjectBlocks: number;
  /** Session ID used for global memory storage */
  sessionId: string;
  /** LocalStorage key for memory enabled setting */
  enabledKey: string;
}

/**
 * Operations supported by the unified memory tool.
 */
export type MemoryOperation = 'search' | 'update' | 'list' | 'delete';

/**
 * Arguments for the unified memory tool.
 */
export interface MemoryToolArgs {
  /** The operation to perform */
  operation: MemoryOperation;
  /** Search query (for search operation) */
  query?: string;
  /** Block type (for update/delete operations) */
  blockType?: BlockType;
  /** Content to write (for update operation) */
  content?: string;
  /** Project name (required for project block operations) */
  projectName?: string;
}

/**
 * Result from the unified memory tool.
 */
export interface MemoryToolResult {
  success: boolean;
  operation: MemoryOperation;
  data?: unknown;
  error?: string;
}
