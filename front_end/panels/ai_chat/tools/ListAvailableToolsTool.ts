// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';
import type { Tool, LLMContext, ErrorResult } from './Tools.js';

const logger = createLogger('ListAvailableToolsTool');

/**
 * Arguments for listing available tools
 */
export interface ListAvailableToolsArgs {
  reasoning: string;
}

/**
 * Information about a single tool
 */
export interface ToolInfo {
  name: string;
  description: string;
  category: string;
}

/**
 * Result of listing available tools
 */
export interface ListAvailableToolsResult {
  success: boolean;
  tools: ToolInfo[];
  categories: string[];
  message: string;
}

/**
 * Tool for listing all available tools registered in the ToolRegistry.
 * Used by agent editor to populate the tool selection checkboxes.
 */
export class ListAvailableToolsTool implements Tool<ListAvailableToolsArgs, ListAvailableToolsResult | ErrorResult> {
  name = 'list_available_tools';
  description = 'Lists all available tools registered in the system. Returns tool names, descriptions, and categorization for UI display. Used when creating or editing agents to show which tools can be selected.';

  async execute(args: ListAvailableToolsArgs, _ctx?: LLMContext): Promise<ListAvailableToolsResult | ErrorResult> {
    logger.info('Listing available tools', {
      reasoning: args.reasoning
    });

    const { reasoning } = args;

    // Validate required arguments
    if (!reasoning || typeof reasoning !== 'string') {
      return { error: 'Reasoning is required and must be a string' };
    }

    try {
      // Access the private registeredTools map via bracket notation
      const toolMap = (ToolRegistry as any).registeredTools as Map<string, Tool<any, any>>;

      if (!toolMap || !(toolMap instanceof Map)) {
        logger.error('ToolRegistry.registeredTools is not accessible or not a Map');
        return { error: 'Failed to access tool registry' };
      }

      const tools: ToolInfo[] = [];
      const categorySet = new Set<string>();

      toolMap.forEach((tool, name) => {
        const category = this.categorize(tool.name);
        categorySet.add(category);

        tools.push({
          name: tool.name,
          description: tool.description || 'No description available',
          category
        });
      });

      // Sort by category, then name
      tools.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });

      const categories = Array.from(categorySet).sort();

      logger.info('Successfully listed tools', {
        toolCount: tools.length,
        categoryCount: categories.length
      });

      return {
        success: true,
        tools,
        categories,
        message: `Found ${tools.length} available tools across ${categories.length} categories`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to list available tools:', errorMsg);
      return { error: `Failed to list available tools: ${errorMsg}` };
    }
  }

  /**
   * Categorize tools based on name patterns
   */
  private categorize(toolName: string): string {
    const lower = toolName.toLowerCase();

    if (lower.includes('navigate') || lower.includes('scroll') || lower.includes('back') || lower.includes('forward')) {
      return 'Navigation';
    }

    if (lower.includes('extract') || lower.includes('search') || lower.includes('fetch') || lower.includes('markdown')) {
      return 'Data Extraction';
    }

    if (lower.includes('click') || lower.includes('action') || lower.includes('type') || lower.includes('fill')) {
      return 'Actions';
    }

    if (lower.includes('agent') && !lower.includes('webapp')) {
      return 'Agents';
    }

    if (lower.includes('webapp') || lower.includes('render')) {
      return 'WebApp';
    }

    if (lower.includes('finalize') || lower.includes('critique') || lower.includes('thinking')) {
      return 'Meta';
    }

    if (lower.includes('bookmark') || lower.includes('store') || lower.includes('save')) {
      return 'Storage';
    }

    return 'Other';
  }

  schema = {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'Required explanation for why this tool list is being retrieved (e.g., "Populating agent editor form")',
      },
    },
    required: ['reasoning'],
  };
}
