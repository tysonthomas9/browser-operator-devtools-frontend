// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentToolConfig, ConfigurableAgentArgs } from '../../ConfigurableAgentTool.js';
import { ChatMessageEntity } from '../../../models/ChatTypes.js';
import type { ChatMessage } from '../../../models/ChatTypes.js';
import { MODEL_SENTINELS } from '../../../core/Constants.js';
import { AGENT_VERSION } from './AgentVersion.js';

const SEARCH_MEMORY_AGENT_PROMPT = `You are a Memory Retrieval Agent. Your job is to find and summarize relevant information from stored memory to help the assistant respond to the user.

## Memory Structure

| Block | Contains |
|-------|----------|
| user | User identity, preferences, communication style |
| facts | Factual information from past conversations |
| project_* | Project-specific context (tech stack, goals, current work) |

## Workflow

1. Use list_memory_blocks to retrieve all stored memory
2. Scan each block for information relevant to the query
3. Return a concise summary of relevant findings

## Response Format

### When Memory Exists
Return relevant information organized by category:

\`\`\`
**User Context:**
- Name: Sarah, Senior Frontend Engineer
- Prefers TypeScript, functional React components

**Relevant Project:**
- E-commerce Platform: Next.js 14, Prisma, Stripe

**Related Facts:**
- 2025-01-10: Migrated auth to NextAuth.js
\`\`\`

### When No Memory Exists
Simply respond: "No relevant memory found."

### When Memory is Empty
Simply respond: "No memory stored yet."

## Guidelines

- Only include information relevant to the query
- Don't dump entire blocks - summarize what's useful
- Prioritize recent information over old
- If query is vague, return user preferences + active project context
`;

/**
 * Create the configuration for the Search Memory Agent.
 * This agent provides read-only memory search capability to orchestrator agents.
 */
export function createSearchMemoryAgentConfig(): AgentToolConfig {
  return {
    name: 'search_memory_agent',
    version: AGENT_VERSION,
    description: 'Search user memory for relevant information. Use when you need to recall user preferences, past facts, or project context.',

    ui: {
      displayName: 'Search Memory',
      avatar: '🔍',
      color: '#10b981',
      backgroundColor: '#ecfdf5'
    },

    systemPrompt: SEARCH_MEMORY_AGENT_PROMPT,

    tools: [
      'list_memory_blocks', // Returns all memory block contents directly
    ],

    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for in memory (user preferences, facts, project info)'
        },
        context: {
          type: 'string',
          description: 'Why this search is needed (helps with relevance)'
        }
      },
      required: ['query']
    },

    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Search memory for: ${args.query || ''}
${args.context ? `\nContext: ${args.context}` : ''}

Please search memory and return any relevant information.`,
      }];
    },

    maxIterations: 2,  // Just need to list and respond
    modelName: MODEL_SENTINELS.USE_NANO,  // Fast, cheap model for simple searches
    temperature: 0,
    handoffs: [],
  };
}
