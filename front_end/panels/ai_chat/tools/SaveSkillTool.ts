// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { SkillStorageManager } from '../skills/SkillStorageManager.js';
import type { Tool, LLMContext } from './Tools.js';
import type { LearnedSkill } from '../skills/types/SkillTypes.js';

const logger = createLogger('SaveSkillTool');

interface SaveSkillArgs {
  skill_id: string;
  tags?: string[];
}

interface SaveSkillResult {
  success: boolean;
  message: string;
  skill?: LearnedSkill;
}

/**
 * Tool for finalizing and saving a verified skill.
 * Should only be called after the skill has passed verification.
 */
export class SaveSkillTool implements Tool<SaveSkillArgs, SaveSkillResult> {
  readonly name = 'save_skill';
  readonly description = 'Finalize and save a skill after it has been verified (3 successful tests). Optionally add tags for categorization.';

  readonly schema = {
    type: 'object',
    properties: {
      skill_id: {
        type: 'string',
        description: 'ID of the skill to save',
      },
      tags: {
        type: 'array',
        description: 'Optional tags for categorizing the skill',
        items: { type: 'string' },
      },
    },
    required: ['skill_id'],
  };

  async execute(args: SaveSkillArgs, _ctx?: LLMContext): Promise<SaveSkillResult> {
    logger.info('Saving skill', { skillId: args.skill_id });

    const manager = SkillStorageManager.getInstance();

    try {
      const skill = await manager.getSkill(args.skill_id);

      if (!skill) {
        return {
          success: false,
          message: `Skill not found: ${args.skill_id}`,
        };
      }

      // Check if verified
      if (skill.verification.status !== 'verified') {
        return {
          success: false,
          message: `Skill "${skill.name}" is not verified yet. Status: ${skill.verification.status}. It needs ${skill.verification.requiredSuccesses - skill.verification.successCount} more successful tests.`,
        };
      }

      // Update tags if provided
      if (args.tags && args.tags.length > 0) {
        const updated = await manager.updateSkill(args.skill_id, {
          tags: args.tags,
        });

        return {
          success: true,
          message: `Skill "${skill.name}" saved successfully with tags: ${args.tags.join(', ')}`,
          skill: updated,
        };
      }

      return {
        success: true,
        message: `Skill "${skill.name}" is verified and ready to use. It can be called as "skill_${skill.name}".`,
        skill,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save skill: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export function createSaveSkillTool(): SaveSkillTool {
  return new SaveSkillTool();
}
