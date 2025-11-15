// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { AgentConfigManager } from '../core/AgentConfigManager.js';
import type { Tool, LLMContext, ErrorResult } from './Tools.js';
import type { AgentConfig } from '../core/BaseOrchestratorAgent.js';

const logger = createLogger('SaveAgentConfigTool');

/**
 * Arguments for saving agent config
 */
export interface SaveAgentConfigArgs {
  agentConfig: AgentConfig;
  reasoning: string;
}

/**
 * Result of saving agent config
 */
export interface SaveAgentConfigResult {
  success: boolean;
  agentType: string;
  message: string;
}

/**
 * Tool for persisting agent configuration to localStorage.
 * Validates the configuration and registers it with AgentDescriptorRegistry.
 */
export class SaveAgentConfigTool implements Tool<SaveAgentConfigArgs, SaveAgentConfigResult | ErrorResult> {
  name = 'save_agent_config';
  description = 'Saves an agent configuration to localStorage. Validates the configuration, registers with AgentDescriptorRegistry for tracing/evaluation, and triggers cross-tab synchronization. Returns success confirmation with agent type.';

  async execute(args: SaveAgentConfigArgs, _ctx?: LLMContext): Promise<SaveAgentConfigResult | ErrorResult> {
    logger.info('Saving agent config', {
      agentType: args.agentConfig?.type,
      label: args.agentConfig?.label,
      reasoning: args.reasoning
    });

    const { agentConfig, reasoning } = args;

    // Validate required arguments
    if (!agentConfig || typeof agentConfig !== 'object') {
      return { error: 'agentConfig is required and must be an object' };
    }

    if (!reasoning || typeof reasoning !== 'string') {
      return { error: 'Reasoning is required and must be a string' };
    }

    try {
      // Validate before saving (AgentConfigManager.saveCustomAgent will also validate)
      const validation = AgentConfigManager.validateAgentConfig(agentConfig);
      if (!validation.valid) {
        logger.error('Agent config validation failed', {
          errors: validation.errors
        });
        return { error: `Validation failed: ${validation.errors.join(', ')}` };
      }

      // Save via AgentConfigManager
      // This will:
      // - Store in localStorage
      // - Register with AgentDescriptorRegistry
      // - Trigger storage events for cross-tab sync
      AgentConfigManager.saveCustomAgent(agentConfig);

      logger.info('Agent configuration saved successfully', {
        agentType: agentConfig.type,
        label: agentConfig.label,
        toolCount: agentConfig.toolNames?.length || agentConfig.availableTools?.length || 0
      });

      return {
        success: true,
        agentType: agentConfig.type,
        message: `Agent "${agentConfig.label}" (${agentConfig.type}) saved successfully`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save agent configuration', error);
      return { error: `Failed to save agent: ${errorMsg}` };
    }
  }

  schema = {
    type: 'object',
    properties: {
      agentConfig: {
        type: 'object',
        description: 'Complete agent configuration object from get_agent_config_data tool',
        properties: {
          type: {
            type: 'string',
            description: 'Unique agent type ID (kebab-case)'
          },
          label: {
            type: 'string',
            description: 'Human-readable agent label'
          },
          icon: {
            type: 'string',
            description: 'Emoji icon for the agent'
          },
          description: {
            type: 'string',
            description: 'Brief description of agent purpose'
          },
          systemPrompt: {
            type: 'string',
            description: 'System prompt defining agent behavior'
          },
          toolNames: {
            type: 'array',
            description: 'Array of tool names the agent can use',
            items: { type: 'string' }
          }
        },
        required: ['type', 'label', 'systemPrompt', 'toolNames']
      },
      reasoning: {
        type: 'string',
        description: 'Required explanation for why this agent configuration is being saved (e.g., "User completed agent creation")',
      },
    },
    required: ['agentConfig', 'reasoning'],
  };
}
