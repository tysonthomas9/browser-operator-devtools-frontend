// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Shared runtime interfaces for tools
 * These interfaces define contracts for runtime dependencies that can be injected via runtimeContext
 */

/**
 * Interface for LLM provider that can generate text
 */
export interface LLMProvider {
  /**
   * Generate text completion from messages
   */
  generateText(params: {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<{ type: string; [key: string]: unknown }>;
    }>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    abortSignal?: AbortSignal;
  }): Promise<{
    text: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}

/**
 * Interface for page content accessor
 */
export interface PageContentAccessor {
  /**
   * Get current page URL
   */
  getURL(): Promise<string>;

  /**
   * Get page title
   */
  getTitle(): Promise<string>;

  /**
   * Get page HTML content
   */
  getHTML(): Promise<string>;

  /**
   * Get accessibility tree as text
   */
  getAccessibilityTree(): Promise<string>;

  /**
   * Take screenshot of current page
   */
  takeScreenshot(fullPage?: boolean): Promise<string>; // Base64 image data
}

/**
 * Interface for page navigation
 */
export interface NavigationManager {
  /**
   * Navigate to a URL
   */
  navigateTo(url: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }>;

  /**
   * Wait for page to be ready
   */
  waitForPageLoad(timeoutMs?: number): Promise<void>;
}

/**
 * Interface for vector database operations
 */
export interface VectorDBClient {
  /**
   * Store a document with embeddings
   */
  store(document: {
    id?: string;
    content: string;
    metadata: {
      title: string;
      url: string;
      tags?: string[];
      [key: string]: unknown;
    };
  }): Promise<{
    success: boolean;
    id?: string;
    error?: string;
  }>;

  /**
   * Search for similar documents
   */
  search(query: string, options?: {
    limit?: number;
    filter?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    results?: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>;
    error?: string;
  }>;
}

/**
 * Interface for HTML to Markdown conversion
 */
export interface HTMLToMarkdownConverter {
  /**
   * Convert HTML content to clean markdown
   */
  convert(html: string, options?: {
    instruction?: string;
    baseURL?: string;
  }): Promise<{
    success: boolean;
    markdown?: string;
    error?: string;
  }>;
}
