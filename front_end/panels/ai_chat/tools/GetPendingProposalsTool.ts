// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { Tool, LLMContext } from './Tools.js';
import type { SkillProposal } from '../skills/types/SkillTypes.js';
import { FileStorageManager } from './FileStorageManager.js';

const logger = createLogger('GetPendingProposalsTool');
const PROPOSALS_FILE = 'skill_proposals.json';

interface GetPendingProposalsArgs {
  // No arguments needed - retrieves all pending proposals
}

interface GetPendingProposalsResult {
  success: boolean;
  proposals: SkillProposal[];
  message: string;
}

/**
 * Tool for synthesis agent to retrieve pending skill proposals.
 */
export class GetPendingProposalsTool implements Tool<GetPendingProposalsArgs, GetPendingProposalsResult> {
  readonly name = 'get_pending_proposals';
  readonly description = 'Get the list of pending skill proposals that need to be synthesized. Returns all proposals from the discovery agent.';

  readonly schema = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(_args: GetPendingProposalsArgs, _ctx?: LLMContext): Promise<GetPendingProposalsResult> {
    logger.info('Getting pending skill proposals');

    try {
      const fileManager = FileStorageManager.getInstance();
      const file = await fileManager.readFile(PROPOSALS_FILE);

      if (!file) {
        return {
          success: true,
          proposals: [],
          message: 'No pending skill proposals found.',
        };
      }

      const proposals: SkillProposal[] = JSON.parse(file.content);
      logger.info(`Found ${proposals.length} pending proposals`);

      return {
        success: true,
        proposals,
        message: proposals.length > 0
          ? `Found ${proposals.length} pending skill proposal(s): ${proposals.map(p => p.name).join(', ')}`
          : 'No pending skill proposals found.',
      };
    } catch (e) {
      logger.error('Failed to read pending proposals', e);
      return {
        success: false,
        proposals: [],
        message: `Error reading pending proposals: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
}

export function createGetPendingProposalsTool(): GetPendingProposalsTool {
  return new GetPendingProposalsTool();
}
