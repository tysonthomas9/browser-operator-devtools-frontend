// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import type { SkillProposal } from '../skills/types/SkillTypes.js';
import { FileStorageManager } from './FileStorageManager.js';

const logger = createLogger('ProposeSkillTool');
const PROPOSALS_FILE = 'skill_proposals.json';

interface ProposeSkillArgs {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  example_usage: string;
}

interface ProposeSkillResult {
  success: boolean;
  proposal: SkillProposal;
  message: string;
}

/**
 * Tool for discovery agent to propose new skills.
 */
export class ProposeSkillTool implements Tool<ProposeSkillArgs, ProposeSkillResult> {
  readonly name = 'propose_skill';
  readonly description = 'Propose a new automation skill to be synthesized. Use this after analyzing the page to suggest automatable tasks.';

  readonly schema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Snake_case name for the skill (e.g., add_to_cart, search_products)',
      },
      description: {
        type: 'string',
        description: 'Clear description of what the skill does and when to use it',
      },
      parameters: {
        type: 'array',
        description: 'List of parameters the skill accepts',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' },
            required: { type: 'boolean' },
          },
        },
      },
      example_usage: {
        type: 'string',
        description: 'Example of how the skill would be called with sample arguments',
      },
    },
    required: ['name', 'description', 'parameters', 'example_usage'],
  };

  async execute(args: ProposeSkillArgs, _ctx?: LLMContext): Promise<ProposeSkillResult> {
    logger.info('Proposing skill', { name: args.name });

    // Extract domain from current page
    let domain = '';
    try {
      const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
      if (target) {
        const url = target.inspectedURL();
        if (url) {
          domain = new URL(url).hostname;
        }
      }
    } catch (e) {
      logger.warn('Failed to extract domain from current page', e);
    }

    const proposal: SkillProposal = {
      name: args.name,
      description: args.description,
      parameters: args.parameters,
      exampleUsage: args.example_usage,
      domain,
    };

    // Persist to file storage
    try {
      const fileManager = FileStorageManager.getInstance();
      let proposals: SkillProposal[] = [];

      // Read existing proposals
      const existingFile = await fileManager.readFile(PROPOSALS_FILE);
      if (existingFile) {
        proposals = JSON.parse(existingFile.content);
      }

      // Add new proposal
      proposals.push(proposal);

      // Write back
      if (existingFile) {
        await fileManager.updateFile(PROPOSALS_FILE, JSON.stringify(proposals, null, 2));
      } else {
        await fileManager.createFile(PROPOSALS_FILE, JSON.stringify(proposals, null, 2), 'application/json');
      }

      logger.info('Proposal saved to file storage', { name: args.name, domain });
    } catch (e) {
      logger.error('Failed to persist proposal to file storage', e);
    }

    return {
      success: true,
      proposal,
      message: `Skill "${args.name}" proposed successfully for domain "${domain}". It will be synthesized next.`,
    };
  }

  /**
   * Get all pending proposals from file storage
   */
  static async getProposals(): Promise<SkillProposal[]> {
    try {
      const fileManager = FileStorageManager.getInstance();
      const file = await fileManager.readFile(PROPOSALS_FILE);
      if (file) {
        return JSON.parse(file.content);
      }
    } catch (e) {
      logger.error('Failed to read proposals from file storage', e);
    }
    return [];
  }

  /**
   * Clear all proposals from file storage
   */
  static async clearProposals(): Promise<void> {
    try {
      const fileManager = FileStorageManager.getInstance();
      const file = await fileManager.readFile(PROPOSALS_FILE);
      if (file) {
        await fileManager.deleteFile(PROPOSALS_FILE);
      }
    } catch (e) {
      logger.error('Failed to clear proposals from file storage', e);
    }
  }

  /**
   * Get and remove a specific proposal from file storage
   */
  static async consumeProposal(name: string): Promise<SkillProposal | undefined> {
    try {
      const fileManager = FileStorageManager.getInstance();
      const file = await fileManager.readFile(PROPOSALS_FILE);
      if (!file) return undefined;

      const proposals: SkillProposal[] = JSON.parse(file.content);
      const index = proposals.findIndex(p => p.name === name);
      if (index !== -1) {
        const [consumed] = proposals.splice(index, 1);

        // Update file with remaining proposals
        if (proposals.length > 0) {
          await fileManager.updateFile(PROPOSALS_FILE, JSON.stringify(proposals, null, 2));
        } else {
          await fileManager.deleteFile(PROPOSALS_FILE);
        }

        return consumed;
      }
    } catch (e) {
      logger.error('Failed to consume proposal from file storage', e);
    }
    return undefined;
  }
}

export function createProposeSkillTool(): ProposeSkillTool {
  return new ProposeSkillTool();
}
