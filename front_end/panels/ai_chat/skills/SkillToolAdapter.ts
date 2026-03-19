// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { SkillExecutor } from './SkillExecutor.js';
import type { Tool, LLMContext } from '../tools/Tools.js';
import type { LearnedSkill, SkillExecutionResult } from './types/SkillTypes.js';

const logger = createLogger('SkillToolAdapter');

/**
 * Wraps a LearnedSkill as a Tool that can be used by agents.
 */
export class SkillToolAdapter implements Tool<Record<string, unknown>, SkillExecutionResult> {
  readonly name: string;
  readonly description: string;
  readonly schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };

  private readonly skill: LearnedSkill;

  constructor(skill: LearnedSkill) {
    this.skill = skill;
    this.name = `skill_${skill.name}`;
    this.description = `${skill.description} [Domain: ${skill.domain}]`;
    this.schema = skill.schema;
  }

  async execute(args: Record<string, unknown>, _ctx?: LLMContext): Promise<SkillExecutionResult> {
    logger.info(`Executing skill: ${this.skill.name}`, { args: Object.keys(args) });

    const executor = SkillExecutor.getInstance();
    return executor.executeSkill(this.skill, args);
  }

  /**
   * Get the underlying skill
   */
  getSkill(): LearnedSkill {
    return this.skill;
  }
}
