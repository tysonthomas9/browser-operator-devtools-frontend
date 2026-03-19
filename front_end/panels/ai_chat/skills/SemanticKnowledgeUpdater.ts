// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { LLMConfigurationManager } from '../core/LLMConfigurationManager.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { SemanticKnowledgeManager } from './SemanticKnowledgeManager.js';
import type {
  SemanticKnowledge,
  KnowledgeUpdateContext,
  KnowledgeUpdateResult,
} from './types/SemanticKnowledgeTypes.js';

const logger = createLogger('SemanticKnowledgeUpdater');

const KNOWLEDGE_UPDATE_PROMPT = `You are maintaining semantic knowledge about a website. Your task is to update the knowledge base with information learned from a successful task execution.

## Current Knowledge Base
{existingKnowledge}

## Recent Successful Task
- **Skill:** {skillName}
- **Task:** {taskDescription}
- **Result:** {executionResult}
- **Page URL:** {pageUrl}

## Page Structure (Accessibility Tree)
{pageContent}

## Instructions

Based on the successful execution and page structure, update the knowledge base to include:

1. **New patterns discovered** - Navigation flows, form structures, button locations
2. **Corrections** - Fix any inaccurate information based on actual behavior
3. **UI components** - Document any new elements or components found
4. **Terminology** - Domain-specific terms and their meanings
5. **Unexpected behaviors** - Any quirks or special handling needed

## Output Format

Write the updated knowledge in Markdown format:
- Use the domain name as the top-level heading (e.g., "# amazon.com")
- Organize into feature sections (## Navigation, ## Shopping Cart, ## Account, etc.)
- Be concise but comprehensive
- Preserve existing valuable knowledge while adding new insights
- Do NOT include any code - only describe patterns in natural language

## Important
- Preserve all existing knowledge that is still accurate
- Only add information that is confirmed by the successful task
- Write in professional documentation style`;

/**
 * Extracts categories from markdown knowledge content.
 */
function extractCategories(content: string): string[] {
  const categories: string[] = [];
  const headingPattern = /^##\s+(.+)$/gm;
  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    categories.push(match[1].toLowerCase().trim());
  }
  return categories;
}

/**
 * Handles LLM-driven updates to semantic knowledge after skill execution.
 */
export class SemanticKnowledgeUpdater {
  private static instance: SemanticKnowledgeUpdater | null = null;

  private constructor() {
    logger.info('Initialized SemanticKnowledgeUpdater');
  }

  static getInstance(): SemanticKnowledgeUpdater {
    if (!SemanticKnowledgeUpdater.instance) {
      SemanticKnowledgeUpdater.instance = new SemanticKnowledgeUpdater();
    }
    return SemanticKnowledgeUpdater.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    SemanticKnowledgeUpdater.instance = null;
  }

  /**
   * Update semantic knowledge after a successful skill execution.
   * Uses LLM to analyze the execution and update/create knowledge.
   */
  async updateKnowledge(
    domain: string,
    context: KnowledgeUpdateContext
  ): Promise<KnowledgeUpdateResult> {
    logger.info('Updating semantic knowledge', { domain, skillName: context.skillName });

    try {
      // Get LLM configuration
      const configManager = LLMConfigurationManager.getInstance();
      const config = configManager.getConfiguration();

      if (!config.provider || !config.mainModel) {
        logger.warn('LLM not configured, skipping knowledge update');
        return {
          success: false,
          error: 'LLM not configured',
        };
      }

      // Get existing knowledge
      const knowledgeManager = SemanticKnowledgeManager.getInstance();
      const existing = await knowledgeManager.getKnowledgeByDomain(domain);
      const existingContent = existing?.content || 'No existing knowledge for this domain.';

      // Prepare prompt
      const prompt = this.buildPrompt(domain, existingContent, context);

      // Call LLM
      const llmClient = LLMClient.getInstance();
      const response = await llmClient.call({
        provider: config.provider,
        model: config.mainModel,
        systemPrompt: KNOWLEDGE_UPDATE_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for consistent updates
      });

      if (!response.text) {
        logger.warn('Empty LLM response for knowledge update');
        return {
          success: false,
          error: 'Empty LLM response',
        };
      }

      // Parse and validate the response
      const updatedContent = this.parseResponse(response.text);
      if (!updatedContent) {
        logger.warn('Failed to parse knowledge update response');
        return {
          success: false,
          error: 'Failed to parse LLM response',
        };
      }

      // Extract categories from the content
      const categories = extractCategories(updatedContent);
      const previousCategories = existing?.categories || [];
      const newCategoriesAdded = categories.filter(c => !previousCategories.includes(c));

      // Save updated knowledge
      const knowledge = await knowledgeManager.upsertKnowledge(
        domain,
        updatedContent,
        categories,
        context.skillId
      );

      logger.info('Semantic knowledge updated', {
        domain,
        categoriesCount: categories.length,
        newCategories: newCategoriesAdded,
      });

      return {
        success: true,
        knowledge,
        newCategoriesAdded,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update semantic knowledge', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate initial semantic knowledge for a new domain.
   */
  async generateInitialKnowledge(
    domain: string,
    pageContent: string,
    pageUrl: string
  ): Promise<KnowledgeUpdateResult> {
    logger.info('Generating initial semantic knowledge', { domain });

    try {
      const configManager = LLMConfigurationManager.getInstance();
      const config = configManager.getConfiguration();

      if (!config.provider || !config.mainModel) {
        return {
          success: false,
          error: 'LLM not configured',
        };
      }

      const prompt = `Analyze this website and create initial semantic knowledge:

## Domain
${domain}

## Page URL
${pageUrl}

## Page Structure (Accessibility Tree)
${pageContent}

Create a comprehensive knowledge base documenting:
1. Website structure and navigation patterns
2. Key features and components visible on the page
3. Form elements and input patterns
4. Any interactive elements and their expected behaviors

Output in Markdown format with the domain as the main heading.`;

      const llmClient = LLMClient.getInstance();
      const response = await llmClient.call({
        provider: config.provider,
        model: config.mainModel,
        systemPrompt: KNOWLEDGE_UPDATE_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      if (!response.text) {
        return {
          success: false,
          error: 'Empty LLM response',
        };
      }

      const content = this.parseResponse(response.text);
      if (!content) {
        return {
          success: false,
          error: 'Failed to parse LLM response',
        };
      }

      const categories = extractCategories(content);
      const knowledgeManager = SemanticKnowledgeManager.getInstance();
      const knowledge = await knowledgeManager.createKnowledge({
        domain,
        content,
        categories,
      });

      logger.info('Initial semantic knowledge generated', { domain, categoriesCount: categories.length });

      return {
        success: true,
        knowledge,
        newCategoriesAdded: categories,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to generate initial knowledge', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build the prompt for knowledge update.
   */
  private buildPrompt(
    domain: string,
    existingKnowledge: string,
    context: KnowledgeUpdateContext
  ): string {
    const resultSummary = context.executionResult.success
      ? `Success: ${JSON.stringify(context.executionResult.output || 'completed')}`
      : `Failed: ${context.executionResult.error}`;

    return `Update the semantic knowledge for domain "${domain}".

## Existing Knowledge
${existingKnowledge}

## Successful Task Details
- **Skill Name:** ${context.skillName}
- **Task Description:** ${context.taskDescription}
- **Result:** ${resultSummary}
- **Page URL:** ${context.pageUrl || 'Not available'}

## Current Page Structure
${context.pageContent || 'Not available'}

Please provide the updated knowledge base in Markdown format.`;
  }

  /**
   * Parse and clean the LLM response.
   */
  private parseResponse(response: string): string | null {
    // Remove any code blocks if the LLM wrapped the response
    let content = response.trim();

    // Remove markdown code block wrappers if present
    if (content.startsWith('```markdown')) {
      content = content.slice(11);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }

    content = content.trim();

    // Basic validation - should have at least one heading
    if (!content.includes('#')) {
      logger.warn('Response missing headings, may be invalid');
      return null;
    }

    return content;
  }
}
