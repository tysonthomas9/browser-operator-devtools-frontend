// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentToolConfig } from '../../ConfigurableAgentTool.js';
import { ChatMessageEntity } from '../../../models/ChatTypes.js';
import { AGENT_VERSION } from './AgentVersion.js';

/**
 * Create the configuration for the Skill Discovery Agent.
 * This agent analyzes web pages and proposes automatable skills.
 */
export function createSkillDiscoveryAgentConfig(): AgentToolConfig {
  return {
    name: 'skill_discovery_agent',
    version: AGENT_VERSION,
    description: 'Analyzes the current web page and proposes 2-3 automatable tasks that could be learned as reusable skills. Identifies common workflows, form interactions, and data extraction patterns.',

    systemPrompt: `You are a Skill Discovery Agent that analyzes web pages to identify automatable tasks.

## Your Role
You explore the current page's structure and functionality to propose skills that could be automated. Focus on tasks that:
1. Are repeatable with different inputs
2. Have clear inputs and outputs
3. Would save users significant time
4. Are common across the website

## Discovery Process
1. Use take_screenshot to visually understand the page
2. Use get_accessibility_tree to understand interactive elements
3. Identify 2-3 automatable tasks
4. Use propose_skill for each identified task

## Skill Proposal Guidelines
- Name skills in snake_case (e.g., add_to_cart, search_products)
- Describe what the skill does and when to use it
- List all parameters with clear descriptions
- Include an example of how the skill would be called

## Example Proposals
For an e-commerce site:
- add_to_cart: Add a product to the shopping cart
- apply_coupon_code: Apply a discount code at checkout
- get_product_details: Extract product information from a listing

For a social media site:
- post_status_update: Create a new post
- search_users: Find users by name
- send_message: Send a direct message to a user`,

    tools: [
      // Page understanding
      'get_page_content',    // Get accessibility tree with selectors
      'take_screenshot',

      // Web interaction (for exploring page)
      'action_agent',        // Click, type, interact with elements
      'navigate_url',        // Navigate to pages
      'scroll_page',         // Scroll to find elements
      'wait_for_page_load',  // Wait for dynamic content

      // Skill proposal
      'propose_skill',
      'search_skills', // Check existing skills
    ],

    maxIterations: 5,
    temperature: 0.5,

    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional focus area for skill discovery (e.g., "checkout flow", "search functionality")',
        },
      },
    },

    handoffs: [],

    // Custom message preparation to ensure user message has content
    prepareMessages: (args: any) => {
      const query = args.query || 'Analyze this page and discover automatable skills';
      return [{
        entity: ChatMessageEntity.USER,
        text: query,
      }];
    },
  };
}
