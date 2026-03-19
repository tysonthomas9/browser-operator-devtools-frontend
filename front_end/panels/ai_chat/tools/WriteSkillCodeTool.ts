// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { SkillStorageManager } from '../skills/SkillStorageManager.js';
import type { Tool, LLMContext } from './Tools.js';
import type { LearnedSkill, SkillSchema } from '../skills/types/SkillTypes.js';

const logger = createLogger('WriteSkillCodeTool');

interface WriteSkillCodeArgs {
  skill_id?: string;
  name: string;
  description: string;
  domain: string;
  code: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
  }>;
}

interface WriteSkillCodeResult {
  success: boolean;
  skill_id: string;
  message: string;
  skill?: LearnedSkill;
}

/**
 * Tool for synthesis agent to write/update skill code.
 */
export class WriteSkillCodeTool implements Tool<WriteSkillCodeArgs, WriteSkillCodeResult> {
  readonly name = 'write_skill_code';
  readonly description = 'Write or update JavaScript code for a skill. Creates a new skill if skill_id is not provided, otherwise updates the existing skill.';

  readonly schema = {
    type: 'object',
    properties: {
      skill_id: {
        type: 'string',
        description: 'ID of existing skill to update (omit to create new)',
      },
      name: {
        type: 'string',
        description: 'Snake_case name for the skill',
      },
      description: {
        type: 'string',
        description: 'Description of what the skill does',
      },
      domain: {
        type: 'string',
        description: 'Domain the skill is for (e.g., amazon.com)',
      },
      code: {
        type: 'string',
        description: 'JavaScript code for the skill (has access to helpers and args objects)',
      },
      parameters: {
        type: 'array',
        description: 'Parameters the skill accepts',
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
    },
    required: ['name', 'description', 'domain', 'code', 'parameters'],
  };

  async execute(args: WriteSkillCodeArgs, _ctx?: LLMContext): Promise<WriteSkillCodeResult> {
    logger.info('Writing skill code', { name: args.name, skillId: args.skill_id });

    const manager = SkillStorageManager.getInstance();

    // Build schema from parameters
    const schema: SkillSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    for (const param of args.parameters) {
      schema.properties[param.name] = {
        type: param.type,
        description: param.description,
      };
      if (param.required) {
        schema.required = schema.required || [];
        schema.required.push(param.name);
      }
    }

    try {
      let skill: LearnedSkill;

      if (args.skill_id) {
        // Update existing skill
        skill = await manager.updateSkill(args.skill_id, {
          name: args.name,
          description: args.description,
          source: args.code,
          schema,
        });

        return {
          success: true,
          skill_id: skill.id,
          message: `Updated skill "${args.name}" (version ${skill.version}). Verification reset - needs 3 successful tests.`,
          skill,
        };
      } else {
        // Create new skill
        skill = await manager.createSkill({
          name: args.name,
          description: args.description,
          source: args.code,
          schema,
          domain: args.domain,
          tags: [],
        });

        return {
          success: true,
          skill_id: skill.id,
          message: `Created skill "${args.name}" for ${args.domain}. Needs 3 successful tests to verify.`,
          skill,
        };
      }
    } catch (error) {
      return {
        success: false,
        skill_id: args.skill_id || '',
        message: `Failed to write skill: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export function createWriteSkillCodeTool(): WriteSkillCodeTool {
  return new WriteSkillCodeTool();
}
