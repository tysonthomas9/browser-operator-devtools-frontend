// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import { AgentConfigManager } from '../core/AgentConfigManager.js';
import { GetWebAppDataTool } from './GetWebAppDataTool.js';
import type { Tool, LLMContext, ErrorResult } from './Tools.js';
import type { AgentConfig } from '../core/BaseOrchestratorAgent.js';

const logger = createLogger('GetAgentConfigDataTool');

/**
 * Arguments for retrieving agent config data
 */
export interface GetAgentConfigDataArgs {
  webappId: string;
  reasoning: string;
  waitForSubmit?: boolean;
}

/**
 * Result of agent config data retrieval
 */
export interface GetAgentConfigDataResult {
  success: boolean;
  cancelled?: boolean;
  agentConfig?: AgentConfig;
  message: string;
}

/**
 * Tool for retrieving and validating agent configuration data from the
 * rendered agent editor form. Wraps GetWebAppDataTool with agent-specific
 * validation and transformation logic.
 */
export class GetAgentConfigDataTool implements Tool<GetAgentConfigDataArgs, GetAgentConfigDataResult | ErrorResult> {
  name = 'get_agent_config_data';
  description = 'Retrieves agent configuration data from the rendered agent editor form. Can optionally wait for form submission. Returns a validated AgentConfig object ready to be saved. Detects if user cancelled the form.';

  async execute(args: GetAgentConfigDataArgs, ctx?: LLMContext): Promise<GetAgentConfigDataResult | ErrorResult> {
    logger.info('Retrieving agent config data', {
      webappId: args.webappId,
      reasoning: args.reasoning,
      waitForSubmit: args.waitForSubmit
    });

    const { webappId, reasoning, waitForSubmit = true } = args;

    // Validate required arguments
    if (!webappId || typeof webappId !== 'string') {
      return { error: 'webappId is required and must be a string' };
    }

    if (!reasoning || typeof reasoning !== 'string') {
      return { error: 'Reasoning is required and must be a string' };
    }

    // Check if cancelled before waiting
    const cancelledCheck = await this.checkCancelled(webappId);
    if (cancelledCheck) {
      logger.info('User cancelled agent editor form', { webappId });
      return {
        success: false,
        cancelled: true,
        message: 'User cancelled agent creation/editing'
      };
    }

    // Use GetWebAppDataTool to extract form data
    const webappDataTool = new GetWebAppDataTool();
    const result = await webappDataTool.execute({
      webappId,
      reasoning: 'Extracting agent configuration from editor form',
      waitForSubmit
    }, ctx);

    if ('error' in result) {
      return result;
    }

    // Check if cancelled after submission wait
    const cancelledAfter = await this.checkCancelled(webappId);
    if (cancelledAfter) {
      logger.info('User cancelled agent editor form', { webappId });
      return {
        success: false,
        cancelled: true,
        message: 'User cancelled agent creation/editing'
      };
    }

    // Transform form data to AgentConfig
    try {
      const formData = result.formData;

      // Extract tool names from checkbox array
      let toolNames: string[] = [];
      if (Array.isArray(formData.tools)) {
        toolNames = formData.tools;
      } else if (formData.tools) {
        toolNames = [formData.tools];
      }

      if (toolNames.length === 0) {
        return { error: 'No tools selected. At least one tool is required.' };
      }

      const agentConfig: AgentConfig = {
        type: String(formData.type || ''),
        label: String(formData.label || ''),
        icon: String(formData.icon || '🤖'),
        description: String(formData.description || ''),
        systemPrompt: String(formData.systemPrompt || ''),
        toolNames: toolNames,
        availableTools: [], // Will be resolved by AgentConfigManager
        isCustom: true,
        version: '1.0.0'
      };

      // Validate the config
      const validation = AgentConfigManager.validateAgentConfig(agentConfig);
      if (!validation.valid) {
        logger.error('Agent config validation failed', {
          errors: validation.errors
        });
        return { error: `Invalid agent configuration: ${validation.errors.join(', ')}` };
      }

      logger.info('Successfully extracted and validated agent config', {
        agentType: agentConfig.type,
        label: agentConfig.label,
        toolCount: toolNames.length
      });

      return {
        success: true,
        agentConfig,
        message: `Agent configuration extracted successfully for "${agentConfig.label}"`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to transform form data to agent config:', errorMsg);
      return { error: `Failed to extract agent configuration: ${errorMsg}` };
    }
  }

  /**
   * Check if user cancelled the form
   */
  private async checkCancelled(webappId: string): Promise<boolean> {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      return false;
    }

    try {
      const result = await target.runtimeAgent().invoke_evaluate({
        expression: `
          (() => {
            const iframe = document.getElementById(${JSON.stringify(webappId)});
            if (!iframe) return false;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) return false;
            return iframeDoc.body.getAttribute('data-cancelled') === 'true';
          })()
        `,
        returnByValue: true
      });

      return Boolean(result.result.value);
    } catch (error) {
      logger.warn('Failed to check cancellation status', error);
      return false;
    }
  }

  schema = {
    type: 'object',
    properties: {
      webappId: {
        type: 'string',
        description: 'The unique webapp ID returned from render_agent_editor tool. Used to identify which editor form to retrieve data from.',
      },
      reasoning: {
        type: 'string',
        description: 'Required explanation for why this data is being retrieved (e.g., "Collecting agent configuration after user submission")',
      },
      waitForSubmit: {
        type: 'boolean',
        description: 'If true, waits indefinitely for form submission before retrieving data. The tool will poll until the form is submitted or cancelled. Default: true',
      },
    },
    required: ['webappId', 'reasoning'],
  };
}
