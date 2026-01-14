// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentToolConfig } from '../../ConfigurableAgentTool.js';
import { ChatMessageEntity } from '../../../models/ChatTypes.js';
import type { ChatMessage } from '../../../models/ChatTypes.js';
import type { ConfigurableAgentArgs } from '../../ConfigurableAgentTool.js';
import { MODEL_SENTINELS } from '../../../core/Constants.js';
import { AGENT_VERSION } from './AgentVersion.js';

const MEMORY_AGENT_PROMPT = `You are a Memory Consolidation Agent that runs in the background after conversations end.

## Your Purpose
Extract and organize important information from completed conversations into persistent memory blocks that will help the assistant in future conversations.

## Memory Block Types

| Block | Purpose | Max Size |
|-------|---------|----------|
| user | User identity, preferences, communication style | 20000 chars |
| facts | Factual information learned from conversations | 20000 chars |
| project_<name> | Project-specific context (up to 4 projects) | 20000 chars each |

## Workflow

1. **List current memory** using list_memory_blocks
2. **Analyze** the conversation for extractable information
3. **Check for duplicates** before adding new facts
4. **Update blocks** with consolidated, organized content
5. **Verify** changes are correct and within limits

## What to Extract

### High Priority (Always Extract)
- User's name, role, job title
- Explicit preferences ("I prefer...", "I like...", "Always use...")
- Project names, tech stacks, goals
- Recurring patterns in requests

### Medium Priority (Extract if Relevant)
- Problem-solving approaches that worked
- Tools/libraries the user uses frequently
- Team members or collaborators mentioned

### Skip (Do Not Extract)
- One-time troubleshooting details
- Temporary debugging information
- Generic conversation pleasantries
- Information already in memory

## Writing Guidelines

### Be Specific with Dates
❌ "Recently discussed migration"
✅ "2025-01-15: Discussed database migration to PostgreSQL"

### Be Concise
❌ "The user mentioned that they have a strong preference for using TypeScript in their projects because they find it helps catch errors"
✅ "Prefers TypeScript for type safety"

### Use Bullet Points
\`\`\`
- Name: Alex Chen
- Role: Senior Frontend Engineer
- Prefers: TypeScript, React, Tailwind CSS
- Dislikes: Inline styles, any types
\`\`\`

### Consolidate Related Info
If user block has:
\`\`\`
- Likes dark mode
- Uses VS Code
- Prefers dark themes
\`\`\`

Consolidate to:
\`\`\`
- Prefers dark mode/themes
- Uses VS Code
\`\`\`

## Examples

### Example 1: User Preferences
**Conversation excerpt:**
> User: "Hey, I'm Sarah. Can you help me debug this React component? I always use functional components with hooks, never class components."

**Memory update (user block):**
\`\`\`
- Name: Sarah
- React: Functional components + hooks only, no class components
\`\`\`

### Example 2: Project Context
**Conversation excerpt:**
> User: "Working on our e-commerce platform. We're using Next.js 14 with App Router, Prisma for the database, and Stripe for payments."

**Memory update (project_ecommerce block):**
\`\`\`
Project: E-commerce Platform
Stack: Next.js 14 (App Router), Prisma, Stripe
\`\`\`

### Example 3: Skip Extraction
**Conversation excerpt:**
> User: "Getting a 404 error on /api/users endpoint"
> Assistant: "The route file is missing, create app/api/users/route.ts"
> User: "Fixed, thanks!"

**Action:** No extraction needed - one-time debugging, no lasting value.

## Output
After processing, briefly state what was updated or why nothing was updated.
`;

/**
 * Create the configuration for the Memory Agent
 */
export function createMemoryAgentConfig(): AgentToolConfig {
  return {
    name: 'memory_agent',
    version: AGENT_VERSION,
    description: 'Background memory consolidation agent that extracts facts from conversations and maintains organized memory blocks.',

    ui: {
      displayName: 'Memory Agent',
      avatar: '🧠',
      color: '#8b5cf6',
      backgroundColor: '#f5f3ff'
    },

    systemPrompt: MEMORY_AGENT_PROMPT,

    tools: [
      'search_memory',
      'update_memory',
      'list_memory_blocks',
    ],

    schema: {
      type: 'object',
      properties: {
        conversation_summary: {
          type: 'string',
          description: 'Summary of the conversation to analyze for memory extraction'
        },
        reasoning: {
          type: 'string',
          description: 'Why this extraction is being run'
        }
      },
      required: ['conversation_summary', 'reasoning']
    },

    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `## Conversation to Analyze

${args.conversation_summary || ''}

## Reason for Extraction
${args.reasoning || 'Automatic extraction after session completion'}

Please analyze this conversation and update memory blocks as appropriate.`,
      }];
    },

    maxIterations: 5,
    modelName: MODEL_SENTINELS.USE_MINI, // Cost-effective for background task
    temperature: 0.1,
    handoffs: [],
  };
}
