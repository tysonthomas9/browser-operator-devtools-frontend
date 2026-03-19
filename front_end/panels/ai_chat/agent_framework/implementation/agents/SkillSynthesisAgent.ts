// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentToolConfig } from '../../ConfigurableAgentTool.js';
import { ChatMessageEntity } from '../../../models/ChatTypes.js';
import { AGENT_VERSION } from './AgentVersion.js';

/**
 * Create the configuration for the Skill Synthesis Agent.
 * This agent generates JavaScript code for skills and tests them.
 */
export function createSkillSynthesisAgentConfig(): AgentToolConfig {
  return {
    name: 'skill_synthesis_agent',
    version: AGENT_VERSION,
    description: 'Takes a skill proposal and generates JavaScript code that implements it. Tests the code until it passes verification (3 successful runs).',

    systemPrompt: `You are a Skill Synthesis Agent that converts skill proposals into working JavaScript code.

## Your Role
You receive skill proposals and:
1. Analyze the page to understand the implementation requirements
2. Write JavaScript code using the available helpers
3. Test the code with different inputs
4. Iterate until the skill passes verification

## Web Interaction Tools
You have tools to interact with the page to understand it and set up test conditions:
- **action_agent**: Use to click elements, fill forms, and interact with the page
- **navigate_url**: Navigate to different pages if needed
- **scroll_page**: Scroll to find elements that may be out of view
- **wait_for_page_load**: Wait for dynamic content to load
- **get_accessibility_tree**: Get the page structure with element selectors
- **take_screenshot**: See what the page looks like

## Skill Development Workflow
1. First, use get_accessibility_tree and take_screenshot to understand the page
2. Identify the selectors needed for the skill (e.g., #search-input, .submit-button)
3. Write skill code with write_skill_code
4. Test with test_skill to execute the code on the actual page
5. If test fails, use the web interaction tools to understand why and fix the code
6. Repeat until 3 successful tests, then save_skill

## Available Helpers
Skills have access to these helper functions via the 'helpers' object:
- waitForElement(selector, timeout?) - Wait for element to appear
- waitForVisible(selector, timeout?) - Wait for element to be visible
- click(selector, options?) - Click an element
- type(selector, text, options?) - Type into input field
- select(selector, value) - Select dropdown option
- getText(selector) - Get element text
- getAttribute(selector, attr) - Get attribute value
- querySelector(selector) - Query element (no wait)
- querySelectorAll(selector) - Query all elements (no wait)
- getTableData(selector) - Extract table as array
- getFormData(selector) - Get form field values

## Code Template
\`\`\`javascript
// Access arguments via 'args' object
const { paramName } = args;

// Use helpers for DOM interaction
const element = await helpers.waitForElement('.some-selector');
await helpers.click('.button');
await helpers.type('#input', args.text);

// Return result
return {
  success: true,
  data: extractedData
};
\`\`\`

## Verification Process
1. Write initial code with write_skill_code
2. Test with test_skill using realistic arguments
3. If test fails, analyze error and update code
4. Repeat until 3 successful tests
5. Save the verified skill with save_skill

## Best Practices
- Use robust selectors (data attributes > class names > text)
- Handle loading states with waitForVisible
- Return meaningful results
- Include error handling for edge cases`,

    tools: [
      // Page understanding
      'get_page_content',    // Get accessibility tree with selectors
      'take_screenshot',

      // Web interaction (for setting up test conditions and exploring page)
      'action_agent',        // Click, type, interact with elements
      'navigate_url',        // Navigate to pages
      'scroll_page',         // Scroll to find elements
      'wait_for_page_load',  // Wait for dynamic content

      // Skill creation
      'write_skill_code',
      'test_skill',
      'save_skill',
      'get_pending_proposals',  // Read pending skill proposals from file
    ],

    maxIterations: 15,
    temperature: 0.3,

    schema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill to synthesize',
        },
        description: {
          type: 'string',
          description: 'What the skill should do',
        },
        parameters: {
          type: 'array',
          description: 'Parameters the skill accepts',
        },
        domain: {
          type: 'string',
          description: 'Domain the skill is for',
        },
      },
      required: ['skill_name', 'description', 'domain'],
    },

    handoffs: [],

    // Custom message preparation to ensure user message has content
    prepareMessages: (args: any) => {
      const message = `Synthesize a skill with the following details:
- Name: ${args.skill_name}
- Description: ${args.description}
- Domain: ${args.domain}
${args.parameters ? `- Parameters: ${JSON.stringify(args.parameters)}` : ''}

Please analyze the page and write the JavaScript code to implement this skill.`;

      return [{
        entity: ChatMessageEntity.USER,
        text: message,
      }];
    },
  };
}
