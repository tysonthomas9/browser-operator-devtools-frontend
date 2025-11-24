// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { TestCase } from '../framework/types.js';
import type { HTMLToMarkdownArgs } from '../../tools/HTMLToMarkdownTool.js';

/**
 * Test cases for HTMLToMarkdownTool evaluation
 *
 * These tests validate:
 * - HTML-to-Markdown conversion quality
 * - Content extraction and filtering
 * - Accessibility tree chunking for large pages
 * - Chunk boundary handling (new accessibility-tree strategy)
 */

/**
 * Simple stable page - baseline test without chunking
 */
export const simpleArticleTest: TestCase<HTMLToMarkdownArgs> = {
  id: 'html-to-markdown-simple-001',
  name: 'Extract Simple Article',
  description: 'Extract markdown from a simple, well-structured article page without chunking',
  url: 'https://en.wikipedia.org/wiki/Markdown',
  tool: 'html_to_markdown',
  input: {
    instruction: 'Convert the main article content to clean, well-formatted Markdown',
    reasoning: 'Testing extraction from a stable Wikipedia page with clear structure'
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Markdown output is well-formatted and readable',
        'Main article content is preserved completely',
        'Navigation and ads are removed',
        'Heading hierarchy (H1, H2, H3) is maintained',
        'Links are properly formatted as [text](url)',
        'Images are formatted as ![alt](src)',
        'No HTML artifacts or tags remain',
        'Code blocks and formatting are preserved'
      ],
      temperature: 0  // Deterministic evaluation
    }
  },
  metadata: {
    tags: ['simple', 'wikipedia', 'stable', 'baseline'],
    timeout: 45000,
    retries: 2,
    flaky: false
  }
};

/**
 * Large page requiring chunking - PRIMARY CHUNKING TEST
 * This is the Wikipedia Australia page (100k+ tokens) that Tyson tested
 */
export const largeArticleChunkingTest: TestCase<HTMLToMarkdownArgs> = {
  id: 'html-to-markdown-chunking-001',
  name: 'Extract Large Article with Accessibility Tree Chunking',
  description: 'Extract markdown from Wikipedia Australia page (100k+ tokens) using new accessibility-tree chunking strategy that splits on [nodeId] boundaries',
  url: 'https://en.wikipedia.org/wiki/Australia',
  tool: 'html_to_markdown',
  input: {
    instruction: 'Convert the complete article to Markdown, ensuring all sections are captured without loss at chunk boundaries',
    reasoning: 'Testing new accessibility-tree chunking strategy on confirmed 100k+ token page'
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'All major sections are included (Geography, History, Demographics, Culture, Economy, etc.)',
        'No content truncation occurs at chunk boundaries',
        'Chunking boundaries respect [nodeId] patterns without splitting mid-node',
        'Heading hierarchy is consistent across entire output',
        'No duplicate paragraphs from chunk overlaps',
        'Cross-references and internal links between sections are preserved',
        'Final markdown is coherent and reads as a complete article',
        'Section transitions are smooth (no jarring breaks between chunks)',
        'Lists and tables that span multiple nodes are complete',
        'Images and captions are properly associated'
      ],
      temperature: 0
    }
  },
  metadata: {
    tags: ['large', 'chunking', 'accessibility-tree', 'wikipedia', '100k-tokens'],
    timeout: 90000,  // 90s for chunked processing (13+ LLM calls)
    retries: 2,
    flaky: false
  }
};

/**
 * Test at chunking threshold boundary (exactly 10k tokens)
 */
export const chunkingThresholdTest: TestCase<HTMLToMarkdownArgs> = {
  id: 'html-to-markdown-threshold-001',
  name: 'Test Chunking Threshold Detection',
  description: 'Test with page near 10k token threshold to validate chunking trigger logic',
  url: 'https://en.wikipedia.org/wiki/History_of_the_Internet',
  tool: 'html_to_markdown',
  input: {
    instruction: 'Extract the complete article ensuring threshold detection works correctly',
    reasoning: 'Validating that pages just over 10k tokens trigger chunking appropriately'
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Complete article content is extracted',
        'All timeline sections are captured',
        'Historical events are in chronological order',
        'Technical details are preserved',
        'Output quality is consistent regardless of chunking decision'
      ],
      temperature: 0
    }
  },
  metadata: {
    tags: ['threshold', 'chunking', 'wikipedia', 'boundary-test'],
    timeout: 60000,
    retries: 2,
    flaky: false
  }
};

/**
 * Complex real-world page with ads, sidebars, and dynamic content
 */
export const complexPageTest: TestCase<HTMLToMarkdownArgs> = {
  id: 'html-to-markdown-complex-001',
  name: 'Extract Content from Complex Page',
  description: 'Extract main content from page with sidebars, ads, navigation, and complex layout',
  url: 'https://www.theguardian.com/technology',
  tool: 'html_to_markdown',
  input: {
    instruction: 'Extract the main news articles and headlines, filtering out sidebars, ads, and navigation',
    reasoning: 'Testing content filtering on real-world complex page layout'
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Main article headlines are extracted correctly',
        'Article summaries/previews are included',
        'Related articles sidebar is filtered out',
        'Advertisement content is completely removed',
        'Navigation menus are excluded',
        'Recommended content sections are filtered',
        'Links to full articles are preserved',
        'Bylines and publication dates are captured'
      ],
      temperature: 0
    }
  },
  metadata: {
    tags: ['complex', 'real-world', 'filtering', 'dynamic', 'news'],
    timeout: 60000,
    retries: 3,
    flaky: true  // News sites have dynamic content
  }
};

/**
 * Technical documentation page with code blocks
 */
export const technicalDocsTest: TestCase<HTMLToMarkdownArgs> = {
  id: 'html-to-markdown-docs-001',
  name: 'Extract Technical Documentation',
  description: 'Extract documentation with code blocks, API references, and technical content',
  url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
  tool: 'html_to_markdown',
  input: {
    instruction: 'Convert the documentation to Markdown preserving code examples and syntax highlighting',
    reasoning: 'Testing code block preservation and technical content extraction'
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Code blocks are properly formatted with triple backticks',
        'Code syntax and indentation is preserved',
        'API method signatures are accurate',
        'Parameter descriptions are complete',
        'Example code is runnable and correct',
        'Technical terminology is preserved',
        'Navigation breadcrumbs are removed',
        'Related API links are included'
      ],
      temperature: 0
    }
  },
  metadata: {
    tags: ['technical', 'documentation', 'code-blocks', 'mdn'],
    timeout: 45000,
    retries: 2,
    flaky: false
  }
};

/**
 * Chunking stress test - extremely large page
 */
export const massiveArticleTest: TestCase<HTMLToMarkdownArgs> = {
  id: 'html-to-markdown-massive-001',
  name: 'Extract Massive Article (Stress Test)',
  description: 'Extract extremely long article to stress-test chunking with 20+ chunks',
  url: 'https://en.wikipedia.org/wiki/List_of_countries_by_population',
  tool: 'html_to_markdown',
  input: {
    instruction: 'Extract the complete list maintaining table structure and country data',
    reasoning: 'Stress testing chunking system with very large tabular data'
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'All countries in the list are included',
        'Table structure is preserved in markdown format',
        'Population data is accurate and aligned',
        'No countries are duplicated from chunk boundaries',
        'Headers and footers are included once',
        'References and notes section is complete'
      ],
      temperature: 0
    }
  },
  metadata: {
    tags: ['stress-test', 'massive', 'chunking', 'tables', 'wikipedia'],
    timeout: 120000,  // 2 minutes for very large content
    retries: 2,
    flaky: false
  }
};

/**
 * All HTMLToMarkdownTool test cases
 */
export const htmlToMarkdownTests: TestCase<HTMLToMarkdownArgs>[] = [
  simpleArticleTest,
  largeArticleChunkingTest,
  chunkingThresholdTest,
  complexPageTest,
  technicalDocsTest,
  massiveArticleTest,
];

/**
 * Basic tests for quick validation (no chunking)
 */
export const basicHtmlToMarkdownTests: TestCase<HTMLToMarkdownArgs>[] = [
  simpleArticleTest,
  technicalDocsTest,
];

/**
 * Chunking-specific tests
 */
export const chunkingTests: TestCase<HTMLToMarkdownArgs>[] = [
  largeArticleChunkingTest,
  chunkingThresholdTest,
  massiveArticleTest,
];

/**
 * Comprehensive test suite including dynamic content
 */
export const comprehensiveHtmlToMarkdownTests: TestCase<HTMLToMarkdownArgs>[] = [
  simpleArticleTest,
  largeArticleChunkingTest,
  chunkingThresholdTest,
  complexPageTest,
  technicalDocsTest,
];

/**
 * Stable tests only (no flaky dynamic content)
 */
export const stableHtmlToMarkdownTests: TestCase<HTMLToMarkdownArgs>[] =
  htmlToMarkdownTests.filter(test => !test.metadata.flaky);

/**
 * Get a specific test by ID
 */
export function getHtmlToMarkdownTestById(
  id: string
): TestCase<HTMLToMarkdownArgs> | undefined {
  return htmlToMarkdownTests.find(test => test.id === id);
}

/**
 * Get tests by tag
 */
export function getHtmlToMarkdownTestsByTag(
  tag: string
): TestCase<HTMLToMarkdownArgs>[] {
  return htmlToMarkdownTests.filter(test =>
    test.metadata.tags.includes(tag)
  );
}

/**
 * Get only chunking-related tests
 */
export function getChunkingSpecificTests(): TestCase<HTMLToMarkdownArgs>[] {
  return htmlToMarkdownTests.filter(test =>
    test.metadata.tags.includes('chunking') ||
    test.metadata.tags.includes('large') ||
    test.metadata.tags.includes('massive')
  );
}

/**
 * Get tests by expected duration (for CI optimization)
 */
export function getTestsByDuration(
  maxTimeout: number
): TestCase<HTMLToMarkdownArgs>[] {
  return htmlToMarkdownTests.filter(test =>
    (test.metadata.timeout || 45000) <= maxTimeout
  );
}

/**
 * CommonJS export for Node.js compatibility
 * Allows backend evaluation runner to import test cases
 */
// @ts-ignore - module is not defined in browser context
if (typeof module !== 'undefined' && module.exports) {
  // @ts-ignore
  module.exports = {
    simpleArticleTest,
    largeArticleChunkingTest,
    chunkingThresholdTest,
    complexPageTest,
    technicalDocsTest,
    massiveArticleTest,
    htmlToMarkdownTests,
    basicHtmlToMarkdownTests,
    chunkingTests,
    comprehensiveHtmlToMarkdownTests,
    stableHtmlToMarkdownTests,
    getHtmlToMarkdownTestById,
    getHtmlToMarkdownTestsByTag,
    getChunkingSpecificTests,
    getTestsByDuration,
  };
}
