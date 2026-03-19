// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { SkillStorageManager } from '../skills/SkillStorageManager.js';
import type { Tool, LLMContext } from './Tools.js';

const logger = createLogger('SearchSkillsTool');

interface SearchSkillsArgs {
  domain?: string;
  query?: string;
  verified_only?: boolean;
}

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  domain: string;
  verified: boolean;
  toolName: string;
}

interface SearchSkillsResult {
  skills: SkillInfo[];
  total: number;
}

/**
 * Tool for agents to search for available learned skills.
 */
export class SearchSkillsTool implements Tool<SearchSkillsArgs, SearchSkillsResult> {
  readonly name = 'search_skills';
  readonly description = 'Search for learned automation skills by domain or keywords. Returns skills that can be called as tools with the skill_ prefix.';

  readonly schema = {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Domain to search for skills (e.g., "amazon.com"). Supports subdomain matching.',
      },
      query: {
        type: 'string',
        description: 'Keyword search in skill names and descriptions.',
      },
      verified_only: {
        type: 'boolean',
        description: 'Only return verified skills (default: true).',
      },
    },
  };

  async execute(args: SearchSkillsArgs, _ctx?: LLMContext): Promise<SearchSkillsResult> {
    logger.info('Searching skills', args);

    const manager = SkillStorageManager.getInstance();
    const verifiedOnly = args.verified_only !== false;

    let skills;

    if (verifiedOnly) {
      skills = await manager.getVerifiedSkills(args.domain);
    } else if (args.domain) {
      skills = await manager.getSkillsByDomain(args.domain);
    } else {
      skills = await manager.getAllSkills();
    }

    // Apply keyword search
    if (args.query) {
      const query = args.query.toLowerCase();
      skills = skills.filter(skill =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query)
      );
    }

    const result: SearchSkillsResult = {
      skills: skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        domain: skill.domain,
        verified: skill.verification.status === 'verified',
        toolName: `skill_${skill.name}`,
      })),
      total: skills.length,
    };

    logger.info(`Found ${result.total} skills`);
    return result;
  }
}

export function createSearchSkillsTool(): SearchSkillsTool {
  return new SearchSkillsTool();
}
