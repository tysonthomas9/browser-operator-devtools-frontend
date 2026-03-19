// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Semantic knowledge about a domain's website patterns and features.
 * Used as context for skill discovery and synthesis agents.
 */
export interface SemanticKnowledge {
  /** UUID */
  id: string;
  /** Domain this knowledge applies to (e.g., "amazon.com") */
  domain: string;
  /** Markdown content documenting website patterns and features */
  content: string;
  /** Feature categories covered (e.g., ["navigation", "cart", "account"]) */
  categories: string[];
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Number of times this knowledge was used in skill operations */
  useCount: number;
  /** ID of the last skill that triggered an update */
  lastUpdatedBySkillId?: string;
}

/**
 * Input for creating new semantic knowledge
 */
export interface CreateSemanticKnowledgeInput {
  domain: string;
  content: string;
  categories?: string[];
}

/**
 * Input for updating existing semantic knowledge
 */
export interface UpdateSemanticKnowledgeInput {
  content?: string;
  categories?: string[];
}

/**
 * Context provided to LLM for knowledge updates
 */
export interface KnowledgeUpdateContext {
  /** Skill that was successfully executed */
  skillId: string;
  skillName: string;
  /** Description of what the skill does */
  taskDescription: string;
  /** Result of the skill execution */
  executionResult: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  /** Accessibility tree of the current page */
  pageContent?: string;
  /** Current page URL */
  pageUrl?: string;
}

/**
 * Result of a knowledge update operation
 */
export interface KnowledgeUpdateResult {
  /** Whether the update was successful */
  success: boolean;
  /** The updated knowledge (if successful) */
  knowledge?: SemanticKnowledge;
  /** Error message (if failed) */
  error?: string;
  /** Whether new categories were added */
  newCategoriesAdded?: string[];
}

/**
 * Lightweight knowledge info for listings
 */
export interface SemanticKnowledgeInfo {
  id: string;
  domain: string;
  categories: string[];
  updatedAt: string;
  useCount: number;
  /** Excerpt of content (first 200 chars) */
  excerpt: string;
}
