// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AgentDescriptorRegistry } from './AgentDescriptorRegistry.js';
import { createLogger } from './Logger.js';
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';
import type { AgentConfig } from './BaseOrchestratorAgent.js';
import type { Tool } from '../tools/Tools.js';

const logger = createLogger('AgentConfigManager');

const CUSTOM_AGENTS_STORAGE_KEY = 'ai_chat_custom_agents';

export interface CustomAgentConfig extends AgentConfig {
  isCustom: true;
  createdAt: string;
  modifiedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Manages custom agent configurations with localStorage persistence,
 * AgentDescriptorRegistry integration, and cross-tab synchronization.
 */
export class AgentConfigManager {
  private static storageListeners: Set<() => void> = new Set();

  /**
   * Get all custom agents from localStorage
   */
  static getCustomAgents(): {[key: string]: CustomAgentConfig} {
    try {
      const stored = localStorage.getItem(CUSTOM_AGENTS_STORAGE_KEY);
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored);
      if (typeof parsed !== 'object' || parsed === null) {
        logger.warn('Invalid custom agents data in localStorage, resetting');
        return {};
      }

      return parsed;
    } catch (error) {
      logger.error('Error loading custom agents from localStorage', error);
      return {};
    }
  }

  /**
   * Get all agents (built-in + custom merged)
   * Resolves tool names to tool instances
   */
  static async getAllAgents(): Promise<{[key: string]: AgentConfig}> {
    // Import built-in configs dynamically to avoid circular dependency
    const { BUILT_IN_AGENT_CONFIGS } = await import('./BaseOrchestratorAgent.js');

    const customAgents = this.getCustomAgents();

    // Resolve tool names to tool instances for custom agents
    const resolvedCustomAgents: {[key: string]: AgentConfig} = {};

    for (const [type, config] of Object.entries(customAgents)) {
      resolvedCustomAgents[type] = {
        ...config,
        availableTools: this.resolveToolNames(config.toolNames || [])
      };
    }

    return { ...BUILT_IN_AGENT_CONFIGS, ...resolvedCustomAgents };
  }

  /**
   * Resolve tool names to tool instances
   */
  private static resolveToolNames(toolNames: string[]): Tool<any, any>[] {
    const tools: Tool<any, any>[] = [];

    for (const name of toolNames) {
      const tool = ToolRegistry.getRegisteredTool(name);
      if (tool) {
        tools.push(tool);
      } else {
        logger.warn(`Tool not found in registry: ${name}`);
      }
    }

    return tools;
  }

  /**
   * Save or update a custom agent
   * Registers with AgentDescriptorRegistry for tracing/evaluation
   */
  static saveCustomAgent(config: AgentConfig): void {
    try {
      // Validate before saving
      const validation = this.validateAgentConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid agent config: ${validation.errors.join(', ')}`);
      }

      const customAgents = this.getCustomAgents();
      const now = new Date().toISOString();

      // Extract tool names from availableTools if not provided
      const toolNames = config.toolNames || config.availableTools.map(tool => tool.name);

      const customConfig: CustomAgentConfig = {
        type: config.type,
        icon: config.icon,
        label: config.label,
        description: config.description,
        systemPrompt: config.systemPrompt,
        toolNames: toolNames,
        availableTools: [], // Don't serialize tool instances
        version: config.version || '1.0.0',
        isCustom: true,
        createdAt: customAgents[config.type]?.createdAt || now,
        modifiedAt: now
      };

      customAgents[config.type] = customConfig;
      localStorage.setItem(CUSTOM_AGENTS_STORAGE_KEY, JSON.stringify(customAgents));

      // Register with AgentDescriptorRegistry
      this.registerAgentDescriptor(customConfig);

      logger.info('Custom agent saved', {
        agentType: config.type,
        toolCount: toolNames.length
      });
    } catch (error) {
      logger.error('Failed to save custom agent', error);
      throw error;
    }
  }

  /**
   * Delete a custom agent
   * Unregisters from AgentDescriptorRegistry
   */
  static async deleteCustomAgent(agentType: string): Promise<void> {
    if (await this.isBuiltInAgent(agentType)) {
      throw new Error('Cannot delete built-in agent');
    }

    try {
      const customAgents = this.getCustomAgents();

      if (!customAgents[agentType]) {
        throw new Error(`Custom agent not found: ${agentType}`);
      }

      delete customAgents[agentType];
      localStorage.setItem(CUSTOM_AGENTS_STORAGE_KEY, JSON.stringify(customAgents));

      // Unregister from AgentDescriptorRegistry
      this.unregisterAgentDescriptor(agentType);

      logger.info('Custom agent deleted', { agentType });
    } catch (error) {
      logger.error('Failed to delete custom agent', error);
      throw error;
    }
  }

  /**
   * Validate agent configuration
   */
  static validateAgentConfig(config: Partial<AgentConfig>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!config.type) {
      errors.push('Agent type is required');
    }
    if (!config.label) {
      errors.push('Agent label is required');
    }
    if (!config.systemPrompt) {
      errors.push('System prompt is required');
    }

    // Check for tools
    const toolNames = config.toolNames || (config.availableTools?.map(t => t.name) || []);
    if (toolNames.length === 0) {
      errors.push('At least one tool must be selected');
    }

    // Type format validation
    if (config.type && !/^[a-z0-9-_]+$/.test(config.type)) {
      errors.push('Agent type must contain only lowercase letters, numbers, hyphens, and underscores');
    }

    // Reserved type names (built-in agents)
    if (config.type) {
      const reservedTypes = ['search', 'deep-research', 'shopping', 'default'];
      if (reservedTypes.includes(config.type)) {
        errors.push('Cannot use reserved agent type name');
      }
    }

    // Validate tools exist in registry
    for (const toolName of toolNames) {
      if (!ToolRegistry.getRegisteredTool(toolName)) {
        errors.push(`Tool not found in registry: ${toolName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if agent is built-in
   */
  static async isBuiltInAgent(agentType: string): Promise<boolean> {
    const { BUILT_IN_AGENT_CONFIGS } = await import('./BaseOrchestratorAgent.js');
    return agentType in BUILT_IN_AGENT_CONFIGS;
  }

  /**
   * Register agent descriptor for tracing/evaluation
   */
  private static registerAgentDescriptor(config: CustomAgentConfig): void {
    AgentDescriptorRegistry.registerSource({
      name: `orchestrator:${config.type}`,
      type: config.type,
      version: config.version ?? '1.0.0',
      promptProvider: () => config.systemPrompt,
      toolNamesProvider: () => config.toolNames || [],
      metadataProvider: () => ({
        isCustom: true,
        icon: config.icon,
        label: config.label,
        description: config.description
      })
    });

    logger.debug('Registered agent descriptor', { agentType: config.type });
  }

  /**
   * Unregister agent descriptor when deleted
   */
  private static unregisterAgentDescriptor(agentType: string): void {
    AgentDescriptorRegistry.removeSource(`orchestrator:${agentType}`);
    logger.debug('Unregistered agent descriptor', { agentType });
  }

  /**
   * Initialize storage event listener for cross-tab sync
   * Returns cleanup function
   */
  static initializeStorageSync(callback: () => void): (() => void) {
    this.storageListeners.add(callback);

    const storageHandler = (event: StorageEvent) => {
      // Only react to changes to our custom agents key
      if (event.key === CUSTOM_AGENTS_STORAGE_KEY) {
        logger.debug('Storage event detected for custom agents', {
          oldValue: event.oldValue?.substring(0, 50),
          newValue: event.newValue?.substring(0, 50),
          url: event.url
        });

        // Re-register all descriptors from updated storage
        this.syncDescriptorsFromStorage();

        // Notify all registered callbacks
        this.storageListeners.forEach(cb => {
          try {
            cb();
          } catch (error) {
            logger.error('Error in storage sync callback', error);
          }
        });
      }
    };

    window.addEventListener('storage', storageHandler);

    logger.debug('Storage sync initialized');

    // Return cleanup function
    return () => {
      window.removeEventListener('storage', storageHandler);
      this.storageListeners.delete(callback);
    };
  }

  /**
   * Re-register all custom agent descriptors after cross-tab update
   */
  private static syncDescriptorsFromStorage(): void {
    const customAgents = this.getCustomAgents();

    Object.values(customAgents).forEach(config => {
      this.registerAgentDescriptor(config);
    });

    logger.debug('Synced agent descriptors from storage', {
      count: Object.keys(customAgents).length
    });
  }

  /**
   * Initialize all custom agent descriptors on module load
   */
  static initializeDescriptors(): void {
    this.syncDescriptorsFromStorage();
    logger.debug('Initialized custom agent descriptors');
  }

  /**
   * Migrate old custom prompts to new custom agents format
   * This handles backward compatibility for users who have existing custom prompts
   */
  static async migrateOldCustomPrompts(): Promise<void> {
    const OLD_PROMPTS_STORAGE_KEY = 'ai_chat_custom_prompts';

    try {
      const oldPromptsData = localStorage.getItem(OLD_PROMPTS_STORAGE_KEY);
      if (!oldPromptsData) {
        logger.debug('No old custom prompts to migrate');
        return;
      }

      const oldPrompts = JSON.parse(oldPromptsData);
      if (typeof oldPrompts !== 'object' || oldPrompts === null) {
        logger.warn('Invalid old prompts format, skipping migration');
        return;
      }

      // Load built-in configs to get default values
      const { BUILT_IN_AGENT_CONFIGS } = await import('./BaseOrchestratorAgent.js');
      const customAgents = this.getCustomAgents();
      let migratedCount = 0;

      for (const [agentType, customPrompt] of Object.entries(oldPrompts)) {
        // Skip if already migrated
        if (customAgents[agentType]) {
          logger.debug(`Agent ${agentType} already migrated, skipping`);
          continue;
        }

        // Get built-in config as base
        const builtInConfig = BUILT_IN_AGENT_CONFIGS[agentType];
        if (!builtInConfig) {
          logger.warn(`No built-in config found for ${agentType}, skipping migration`);
          continue;
        }

        // Create custom agent config from old prompt
        const migratedConfig: AgentConfig = {
          type: builtInConfig.type,
          icon: builtInConfig.icon,
          label: builtInConfig.label,
          description: builtInConfig.description,
          systemPrompt: customPrompt as string,
          availableTools: builtInConfig.availableTools,
          toolNames: builtInConfig.availableTools.map(tool => tool.name),
          version: builtInConfig.version || '1.0.0',
          isCustom: true
        };

        // Save as custom agent
        this.saveCustomAgent(migratedConfig);
        migratedCount++;

        logger.info(`Migrated custom prompt for ${agentType}`);
      }

      if (migratedCount > 0) {
        logger.info(`Migrated ${migratedCount} custom prompts to new system`);

        // Optionally keep old prompts for safety (don't delete)
        // Users can manually delete 'ai_chat_custom_prompts' from localStorage if desired
      }
    } catch (error) {
      logger.error('Error migrating old custom prompts', error);
    }
  }
}

// Auto-initialize descriptors when module loads
AgentConfigManager.initializeDescriptors();
