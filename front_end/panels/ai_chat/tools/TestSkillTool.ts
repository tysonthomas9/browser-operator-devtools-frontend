// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { SkillStorageManager } from '../skills/SkillStorageManager.js';
import { SkillExecutor } from '../skills/SkillExecutor.js';
import type { Tool, LLMContext } from './Tools.js';
import type { SkillExecutionResult } from '../skills/types/SkillTypes.js';

const logger = createLogger('TestSkillTool');

interface TestSkillArgs {
  skill_id: string;
  args: Record<string, unknown>;
}

/**
 * Tool for testing skills during synthesis. Runs in test mode to record results.
 */
export class TestSkillTool implements Tool<TestSkillArgs, SkillExecutionResult> {
  readonly name = 'test_skill';
  readonly description = 'Execute a skill in test mode to verify it works correctly. Records test results for verification.';

  readonly schema = {
    type: 'object',
    properties: {
      skill_id: {
        type: 'string',
        description: 'The ID of the skill to test.',
      },
      args: {
        type: 'object',
        description: 'Arguments to pass to the skill.',
      },
    },
    required: ['skill_id', 'args'],
  };

  async execute(args: TestSkillArgs, _ctx?: LLMContext): Promise<SkillExecutionResult> {
    logger.info('Testing skill', { skillId: args.skill_id });

    const manager = SkillStorageManager.getInstance();
    const skill = await manager.getSkill(args.skill_id);

    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${args.skill_id}`,
        executionTimeMs: 0,
        capturedAt: new Date().toISOString(),
      };
    }

    const executor = SkillExecutor.getInstance();
    return executor.executeSkill(skill, args.args, { testMode: true });
  }
}

export function createTestSkillTool(): TestSkillTool {
  return new TestSkillTool();
}
