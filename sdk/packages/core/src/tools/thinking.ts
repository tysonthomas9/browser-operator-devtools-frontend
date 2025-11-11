// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { z } from 'zod';
import { createTool } from './createTool.js';
import type { LLMProvider, PageContentAccessor } from './interfaces.js';

export const thinkingInputSchema = z.object({
  userRequest: z.string().describe('The original user request or goal to think about'),
  context: z.string().optional().describe('Optional additional context about the current situation'),
});

const thinkingResultSchema = z.object({
  visualSummary: z.string(),
  thingsToDoList: z.array(z.string()),
  currentProgress: z.string().optional(),
  observations: z.string().optional(),
});

export const thinkingOutputSchema = z.union([
  thinkingResultSchema,
  z.object({ error: z.string() }),
]);

export type ThinkingInput = z.infer<typeof thinkingInputSchema>;
export type ThinkingOutput = z.infer<typeof thinkingOutputSchema>;

/**
 * Tool for high-level thinking and planning with visual/accessibility context
 */
export const thinking = createTool({
  id: 'thinking',
  description: 'A flexible thinking tool that provides a high-level visual summary and creates an unstructured list of things to do. Useful for getting oriented, planning next steps, or reflecting on current state. Automatically adapts to use visual analysis for vision-capable models or accessibility tree analysis for text-only models.',
  inputSchema: thinkingInputSchema,
  outputSchema: thinkingOutputSchema,
  metadata: {
    category: 'thinking',
    tags: ['thinking', 'planning', 'reasoning', 'llm'],
    requiresRuntime: ['llmProvider', 'pageContentAccessor'],
  },
  execute: async ({ context, runtimeContext }): Promise<ThinkingOutput> => {
    const { userRequest, context: contextStr } = context as ThinkingInput;

    const llmProvider = runtimeContext?.get<LLMProvider>('llmProvider');
    const pageAccessor = runtimeContext?.get<PageContentAccessor>('pageContentAccessor');

    if (!llmProvider || !pageAccessor) {
      return {
        error: 'LLMProvider or PageContentAccessor not available in runtime context',
      };
    }

    try {
      // Get page context (accessibility tree for now)
      const tree = await pageAccessor.getAccessibilityTree();
      const url = await pageAccessor.getURL();
      const title = await pageAccessor.getTitle();

      const systemPrompt = `You are a thinking tool that helps with high-level planning and analysis. Your job is to understand the current state and think through what needs to be done in a flexible, unstructured way.

APPROACH:
1. Analyze the page structure to understand what's available
2. Create a flexible list of things that might need to be done
3. Think about current progress and what to focus on next
4. Be conversational and adaptive

OUTPUT FORMAT (JSON):
{
  "visualSummary": "Brief description of the page and relevant elements",
  "thingsToDoList": ["Thing 1", "Thing 2", "Thing 3"],
  "currentProgress": "Optional - where things stand",
  "observations": "Optional - interesting observations"
}`;

      const contextSection = contextStr ? `\nADDITIONAL CONTEXT: ${contextStr}` : '';

      const userPrompt = `USER REQUEST: ${userRequest}${contextSection}

CURRENT PAGE: ${title}
URL: ${url}

ACCESSIBILITY TREE:
${tree.substring(0, 3000)}

Think through what needs to be done to accomplish the user's request.`;

      const result = await llmProvider.generateText({
        model: 'gpt-4',
        messages: [{ role: 'user', content: userPrompt }],
        systemPrompt,
        temperature: 0.3,
      });

      try {
        const parsed = JSON.parse(result.text);
        return parsed;
      } catch {
        return {
          error: 'Failed to parse thinking result',
        };
      }
    } catch (error: any) {
      return {
        error: error?.message || 'Thinking failed',
      };
    }
  },
});
