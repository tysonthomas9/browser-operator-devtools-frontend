// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from './Logger.js';
import { ToolStorageManager, type StoredToolConfig, PRESET_LIBRARIES, type ToolDependency } from './ToolStorageManager.js';
import { DynamicJavaScriptTool } from '../tools/DynamicJavaScriptTool.js';
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';

const logger = createLogger('ToolStudioIntegration');

/**
 * Display information for a tool (used in Tool Studio UI)
 */
export interface ToolDisplayInfo {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
  isBuiltIn: boolean;
  isCustom: boolean;
  id?: string; // Only for custom tools
  code?: string;
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  timeout: number;
  hasPageAccess: boolean;
  dependencies: ToolDependency[];
  version: string;
}

/**
 * List of built-in tool names that cannot be overridden
 */
const BUILT_IN_TOOL_NAMES = [
  // Navigation tools
  'navigate_url',
  'navigate_back',
  'node_ids_to_urls',
  // Data tools
  'fetcher_tool',
  'extract_data',
  'extract_schema_streamlined',
  'finalize_with_critique',
  // Action tools
  'perform_action',
  'get_page_content',
  'search_content',
  'take_screenshot',
  'html_to_markdown',
  'readability_extractor',
  'scroll_page',
  'wait_for_page_load',
  // Code execution
  'execute_code',
  'execute_javascript',
  // File tools
  'create_file',
  'update_file',
  'delete_file',
  'read_file',
  'list_files',
  // Other tools
  'thinking',
  'update_todo',
  'render_webapp',
  'get_webapp_data',
  'remove_webapp',
  'bookmark_store',
  'document_search',
  'save_research_report',
  // Mini app tools
  'launch_mini_app',
  'get_mini_app_state',
  'update_mini_app_state',
  'execute_mini_app_action',
  'close_mini_app',
  'list_mini_apps',
  // Agent tools (custom agents)
  'search_custom_agents',
];

/**
 * Tracks registered custom tools for cleanup
 */
const registeredCustomTools = new Set<string>();

/**
 * Integrates custom tools from Tool Studio with the existing tool system.
 * Handles registration, refresh, and provides unified access to all tools.
 */
export class ToolStudioIntegration {
  private static initialized = false;

  /**
   * Initialize custom tools into ToolRegistry on startup.
   * Should be called during MiniApp initialization.
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('ToolStudioIntegration already initialized');
      return;
    }

    try {
      const storage = ToolStorageManager.getInstance();
      const customTools = await storage.getAllTools();

      for (const toolConfig of customTools) {
        this.registerCustomTool(toolConfig);
      }

      this.initialized = true;
      logger.info(`Initialized ${customTools.length} custom tools from Tool Studio`);
    } catch (error) {
      logger.error('Failed to initialize custom tools:', error);
      // Don't block startup if custom tools fail to load
      this.initialized = true;
    }
  }

  /**
   * Refresh custom tools after changes in Tool Studio.
   * Unregisters removed tools and registers new/updated ones.
   */
  static async refreshTools(): Promise<void> {
    try {
      const storage = ToolStorageManager.getInstance();
      const customTools = await storage.getAllTools();
      const currentNames = new Set(customTools.map(t => t.name));

      // Unregister tools that no longer exist
      for (const name of registeredCustomTools) {
        if (!currentNames.has(name)) {
          this.unregisterCustomTool(name);
        }
      }

      // Register or update all current custom tools
      for (const toolConfig of customTools) {
        this.registerCustomTool(toolConfig);
      }

      logger.info(`Refreshed custom tools: ${customTools.length} active`);
    } catch (error) {
      logger.error('Failed to refresh custom tools:', error);
    }
  }

  /**
   * Get all custom tools for display in Tool Studio UI.
   */
  static async getCustomToolsForDisplay(): Promise<ToolDisplayInfo[]> {
    const tools: ToolDisplayInfo[] = [];

    try {
      const storage = ToolStorageManager.getInstance();
      const customTools = await storage.getAllTools();

      for (const stored of customTools) {
        tools.push({
          name: stored.name,
          displayName: stored.ui.displayName,
          description: stored.description,
          icon: stored.ui.icon,
          color: stored.ui.color,
          backgroundColor: stored.ui.backgroundColor,
          isBuiltIn: false,
          isCustom: true,
          id: stored.id,
          code: stored.code,
          schema: stored.schema,
          timeout: stored.timeout,
          hasPageAccess: stored.hasPageAccess,
          dependencies: stored.dependencies || [],
          version: stored.version,
        });
      }
    } catch (error) {
      logger.error('Failed to load custom tools for display:', error);
    }

    return tools;
  }

  /**
   * Get list of all built-in tool names.
   */
  static getBuiltInToolNames(): string[] {
    return [...BUILT_IN_TOOL_NAMES];
  }

  /**
   * Get preset libraries for quick add in UI.
   */
  static getPresetLibraries(): ToolDependency[] {
    return [...PRESET_LIBRARIES];
  }

  /**
   * Check if a tool name conflicts with built-in tools.
   */
  static isBuiltInToolName(name: string): boolean {
    return BUILT_IN_TOOL_NAMES.includes(name);
  }

  /**
   * Check if a tool name is registered as a custom tool.
   */
  static isCustomToolName(name: string): boolean {
    return registeredCustomTools.has(name);
  }

  /**
   * Register a custom tool with ToolRegistry.
   */
  private static registerCustomTool(config: StoredToolConfig): void {
    try {
      // Check for conflicts with built-in tools
      if (this.isBuiltInToolName(config.name)) {
        logger.warn(`Cannot register custom tool "${config.name}" - conflicts with built-in tool`);
        return;
      }

      const tool = new DynamicJavaScriptTool(config);

      ToolRegistry.registerToolFactory(config.name, () => tool);
      registeredCustomTools.add(config.name);

      logger.info(`Registered custom tool: ${config.name}`);
    } catch (error) {
      logger.error(`Failed to register custom tool "${config.name}":`, error);
    }
  }

  /**
   * Unregister a custom tool from ToolRegistry.
   * Note: ToolRegistry doesn't support unregistration, so we just track it.
   */
  private static unregisterCustomTool(name: string): void {
    registeredCustomTools.delete(name);
    logger.info(`Marked custom tool as unregistered: ${name}`);
    // Note: Actual removal from ToolRegistry would require adding an unregister method
  }

  /**
   * Format tool name for display (snake_case to Title Case).
   */
  static formatToolName(name: string): string {
    return name
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Create a default tool configuration for new tools.
   */
  static createDefaultToolConfig(): Omit<StoredToolConfig, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'> {
    return {
      name: '',
      description: '',
      version: '1.0.0',
      code: `// Your code here
// Available variables:
// - args: The input arguments (validated against schema)
// - ctx: Execution context { provider, model }
//
// Return a JSON-serializable value

const result = {
  message: 'Hello from custom tool!',
  timestamp: new Date().toISOString()
};

return result;`,
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      ui: {
        displayName: '',
        icon: '🔧',
        color: '#00a4fe',
        backgroundColor: '#e2f3fb',
      },
      timeout: 10000,
      hasPageAccess: true,
      dependencies: [],
    };
  }
}
