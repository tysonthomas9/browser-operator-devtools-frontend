// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentToolConfig, ConfigurableAgentArgs } from '../agent_framework/ConfigurableAgentTool.js';
import { ChatMessageEntity } from '../models/ChatTypes.js';
import type { ChatMessage } from '../models/ChatTypes.js';
import { MODEL_SENTINELS } from '../core/Constants.js';
import { AGENT_VERSION } from '../agent_framework/implementation/agents/AgentVersion.js';

/**
 * Memory agent mode determines behavior and configuration.
 */
export type MemoryAgentMode = 'extraction' | 'search';

// Extraction mode prompt - runs after conversations to consolidate facts
const EXTRACTION_PROMPT = `You are a Memory Consolidation Agent that runs in the background after conversations end.

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

// Search mode prompt - read-only queries for orchestrators
const SEARCH_PROMPT = `You are a Memory Retrieval Agent. Your job is to find and summarize relevant information from stored memory to help the assistant respond to the user.

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
 * Create a memory agent configuration with the specified mode.
 *
 * @param mode - 'extraction' for background consolidation, 'search' for read-only queries
 * @returns AgentToolConfig for the memory agent
 */
export function createMemoryAgentConfig(mode: MemoryAgentMode): AgentToolConfig {
  if (mode === 'extraction') {
    return createExtractionConfig();
  }
  return createSearchConfig();
}

function createExtractionConfig(): AgentToolConfig {
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

    systemPrompt: EXTRACTION_PROMPT,

    tools: ['search_memory', 'update_memory', 'list_memory_blocks'],

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
    modelName: MODEL_SENTINELS.USE_MINI,  // Cost-effective for background task
    temperature: 0.1,
    handoffs: [],
  };
}

function createSearchConfig(): AgentToolConfig {
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

    systemPrompt: SEARCH_PROMPT,

    tools: ['list_memory_blocks'],

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
