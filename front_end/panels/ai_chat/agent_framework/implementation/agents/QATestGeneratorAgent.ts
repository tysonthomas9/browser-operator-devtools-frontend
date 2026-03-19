// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { AgentToolConfig, ConfigurableAgentArgs } from '../../ConfigurableAgentTool.js';
import type { ChatMessage } from '../../../models/ChatTypes.js';
import { ChatMessageEntity } from '../../../models/ChatTypes.js';
import { MODEL_SENTINELS } from '../../../core/Constants.js';
import { AGENT_VERSION } from './AgentVersion.js';

/**
 * Create the configuration for the QA Test Generator Agent
 *
 * This agent generates JavaScript test scripts from natural language descriptions.
 * The generated scripts run directly in the browser page context using vanilla JS.
 *
 * KEY PRINCIPLE: Generate simple, readable JavaScript that users can understand,
 * modify, and run independently.
 */
export function createQATestGeneratorAgentConfig(): AgentToolConfig {
  return {
    name: 'qa_test_generator',
    version: AGENT_VERSION,
    description: 'Generates JavaScript test scripts from natural language descriptions. The scripts run directly in the browser and show both steps and executable code.',
    systemPrompt: `You are a QA test script generator. Your task is to convert natural language test descriptions into **JavaScript code** that runs directly in the browser, and verify it works.

## YOUR WORKFLOW
1. Navigate to the starting URL using navigate_url tool
2. Analyze the page structure using get_page_content (look at DOM structure)
3. Based on the page structure, generate a JavaScript test script
4. **RUN the script using run_generated_test tool to verify it works**
5. **If the test FAILS, analyze the error and fix your script**
6. **Repeat steps 4-5 until the test PASSES (max 3 attempts)**
7. Output ONLY the final working JavaScript code in a code block

IMPORTANT: Do NOT output your final script until you have verified it works by running it!

## OUTPUT FORMAT

Generate a self-contained JavaScript IIFE that:
- Shows each step with a description
- Uses simple DOM APIs
- Returns a results object

Example output format:

\`\`\`javascript
// Test: [Test Name]
// URL: [Starting URL]

(async function runTest() {
  const results = { steps: [], passed: true, error: null };

  function step(name, fn) {
    console.log('▶ ' + name);
    try {
      fn();
      results.steps.push({ name, status: 'passed' });
      console.log('  ✓ Passed');
    } catch (e) {
      results.steps.push({ name, status: 'failed', error: e.message });
      results.passed = false;
      results.error = e.message;
      console.log('  ✗ Failed: ' + e.message);
      throw e;
    }
  }

  async function asyncStep(name, fn) {
    console.log('▶ ' + name);
    try {
      await fn();
      results.steps.push({ name, status: 'passed' });
      console.log('  ✓ Passed');
    } catch (e) {
      results.steps.push({ name, status: 'failed', error: e.message });
      results.passed = false;
      results.error = e.message;
      console.log('  ✗ Failed: ' + e.message);
      throw e;
    }
  }

  function $(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error('Element not found: ' + selector);
    return el;
  }

  function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitFor(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) {
          return reject(new Error('Timeout waiting for: ' + selector));
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  try {
    // ============ TEST STEPS ============

    // [Generated steps go here]

    // ============ END STEPS ============

    console.log(results.passed ? '✓ TEST PASSED' : '✗ TEST FAILED');
  } catch (e) {
    console.log('✗ TEST FAILED: ' + e.message);
  }

  return results;
})();
\`\`\`

## STEP GENERATION RULES

### For filling inputs:
\`\`\`javascript
step('Fill username', () => {
  $('#username').value = 'testuser';
  $('#username').dispatchEvent(new Event('input', { bubbles: true }));
});
\`\`\`

### For clicking buttons:
\`\`\`javascript
step('Click login button', () => {
  $('#login-btn').click();
});
\`\`\`

### For waiting after navigation:
\`\`\`javascript
await asyncStep('Wait for dashboard', async () => {
  await waitFor('.dashboard-content');
});
\`\`\`

### For assertions:
\`\`\`javascript
step('Verify welcome message', () => {
  const text = $('.welcome').textContent;
  if (!text.includes('Welcome')) {
    throw new Error('Expected welcome message, got: ' + text);
  }
});
\`\`\`

### For URL checks:
\`\`\`javascript
step('Verify URL', () => {
  if (!window.location.href.includes('/dashboard')) {
    throw new Error('Expected to be on dashboard');
  }
});
\`\`\`

## SELECTOR STRATEGY

Use the DOM structure from get_page_content to find the best selectors:
1. IDs are best: $('#login-btn')
2. Data attributes: $('[data-testid="submit"]')
3. Classes with context: $('.login-form .submit-btn')
4. Text content: Use $$ and filter by text if needed

## IMPORTANT RULES

1. ALWAYS use get_page_content to see the actual DOM before generating code
2. Use the EXACT selectors you see in the DOM
3. Add wait steps after actions that cause navigation or AJAX
4. Include assertions to verify each important state change
5. Output ONLY the JavaScript code block - no explanations before or after
6. Keep the code simple and readable

## HANDLING TEST FAILURES

When run_generated_test returns a failure, analyze the error:
- "Element not found: #selector" → The selector is wrong, use get_page_content to find the correct selector
- "Timeout waiting for: .element" → Add a longer wait or the element doesn't exist
- "Expected X, got Y" → The assertion logic is incorrect or the page state is different than expected

After fixing the script, run it again with run_generated_test to verify the fix worked.`,
    tools: [
      'navigate_url',
      'get_page_content',
      'take_screenshot',
      'run_generated_test',
    ],
    maxIterations: 25,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0.2,
    schema: {
      type: 'object',
      properties: {
        testDescription: {
          type: 'string',
          description: 'Natural language description of the test case (e.g., "Login with valid credentials and verify dashboard loads")',
        },
        startingUrl: {
          type: 'string',
          description: 'The URL where the test should begin',
        },
        additionalContext: {
          type: 'string',
          description: 'Optional additional context about the application or test requirements',
        },
      },
      required: ['testDescription', 'startingUrl'],
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      const testDescription = args.testDescription as string;
      const startingUrl = args.startingUrl as string;
      const additionalContext = args.additionalContext as string | undefined;

      let message = `Generate a JavaScript test script for the following test case:

**Test Description:** ${testDescription}

**Starting URL:** ${startingUrl}`;

      if (additionalContext) {
        message += `\n\n**Additional Context:** ${additionalContext}`;
      }

      message += `

Follow this workflow:
1. First, navigate to the starting URL using navigate_url
2. Then, use get_page_content to see the DOM structure
3. Based on what you see, generate the JavaScript test script
4. **Run the script using run_generated_test to verify it works**
5. **If it fails, fix the script and try again (up to 3 attempts)**
6. Output ONLY the final working JavaScript code in a code block

The script should:
- Show each step with a description (using step() or asyncStep())
- Use simple DOM APIs (querySelector, click, value)
- Return a results object with pass/fail status

IMPORTANT: You MUST verify the script works before outputting it!`;

      return [{
        entity: ChatMessageEntity.USER,
        text: message,
      }];
    },
    includeSummaryInAnswer: false,
  };
}
