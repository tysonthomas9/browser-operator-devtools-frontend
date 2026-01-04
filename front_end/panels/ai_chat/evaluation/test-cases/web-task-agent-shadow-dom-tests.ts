// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {TestCase} from '../framework/types.js';

export interface WebTaskAgentArgs {
  objective: string;
  reasoning?: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Web Task Agent Shadow DOM Tests
// Multi-step workflow tests involving shadow DOM components
// ============================================================================

/**
 * Test completing a multi-step form workflow with shadow DOM components.
 */
export const shadowDomFormWorkflowTest: TestCase<WebTaskAgentArgs> = {
  id: 'web-task-shadow-001',
  name: 'Complete form workflow with shadow DOM',
  description: 'Fill and submit a multi-step form using shadow DOM components',
  url: 'https://test-pages.example.com/shadow-form-workflow.html',
  tool: 'web_task_agent',
  input: {
    objective: 'Fill out the registration form with name "John Doe", email "john@example.com", and submit it',
    reasoning: 'Testing multi-step form workflow with shadow DOM form controls',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Identified all form fields within the shadow DOM',
        'Filled the name field with "John Doe"',
        'Filled the email field with "john@example.com"',
        'Successfully submitted the form',
        'Verified submission confirmation message appeared',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify all form fields were filled correctly',
          'Confirm the form was submitted',
          'Check for confirmation message or success state',
        ],
      },
    },
  },
  metadata: {
    tags: ['web-task', 'shadow-dom', 'form', 'workflow', 'multi-step'],
  },
};

/**
 * Test creating a GitHub issue using web components.
 */
export const githubIssueCreationTest: TestCase<WebTaskAgentArgs> = {
  id: 'web-task-shadow-002',
  name: 'Create GitHub issue (web components)',
  description: 'Navigate to repo and create an issue using GitHub web components with shadow DOM',
  url: 'https://github.com/test-org/test-repo/issues',
  tool: 'web_task_agent',
  input: {
    objective: 'Create a new issue titled "Test Issue" with description "This is a test issue"',
    reasoning: 'Testing real-world GitHub workflow with shadow DOM web components',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Navigated to the new issue page',
        'Filled the title field with "Test Issue"',
        'Filled the description/body field',
        'Successfully handled GitHub markdown editor (shadow DOM)',
        'Submitted the issue successfully',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the issue creation form was filled',
          'Confirm the issue was created',
          'Check for the new issue page or confirmation',
        ],
      },
    },
  },
  metadata: {
    tags: ['web-task', 'shadow-dom', 'github', 'real-world', 'issue-creation'],
    timeout: 60000,
  },
};

/**
 * Test editing Notion page blocks.
 */
export const notionBlockEditingTest: TestCase<WebTaskAgentArgs> = {
  id: 'web-task-shadow-003',
  name: 'Edit Notion page blocks',
  description: 'Navigate and edit blocks in Notion (complex shadow DOM)',
  url: 'https://www.notion.so/test-page',
  tool: 'web_task_agent',
  input: {
    objective: 'Add a new heading "Test Heading" and a paragraph below it saying "This is test content"',
    reasoning: 'Testing complex shadow DOM interaction in Notion editor',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Located the Notion content editing area',
        'Created a new heading block',
        'Entered the heading text "Test Heading"',
        'Created a new paragraph block',
        'Entered the paragraph content',
        'Content was saved/persisted',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the heading was added',
          'Confirm the paragraph content was entered',
          'Check that content appears correctly formatted',
        ],
      },
    },
  },
  metadata: {
    tags: ['web-task', 'shadow-dom', 'notion', 'real-world', 'content-editing'],
    timeout: 60000,
  },
};

/**
 * Test shopping workflow with custom web components.
 */
export const shadowDomShoppingTest: TestCase<WebTaskAgentArgs> = {
  id: 'web-task-shadow-004',
  name: 'E-commerce with shadow DOM components',
  description: 'Complete a product selection workflow using shadow DOM product cards',
  url: 'https://test-pages.example.com/shadow-shop.html',
  tool: 'web_task_agent',
  input: {
    objective: 'Browse products, select the "Premium Widget", and add it to cart',
    reasoning: 'Testing e-commerce workflow with shadow DOM product components',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Browsed the product catalog',
        'Located the "Premium Widget" product card',
        'Clicked the "Add to Cart" button within shadow DOM',
        'Verified product was added to cart',
        'Cart count or confirmation updated',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the product was found',
          'Confirm "Add to Cart" was clicked',
          'Check cart indicator shows the addition',
        ],
      },
    },
  },
  metadata: {
    tags: ['web-task', 'shadow-dom', 'e-commerce', 'shopping', 'workflow'],
  },
};

/**
 * Test interacting with a custom video player.
 */
export const shadowDomVideoPlayerTest: TestCase<WebTaskAgentArgs> = {
  id: 'web-task-shadow-005',
  name: 'Custom video player controls',
  description: 'Interact with a custom video player built with shadow DOM',
  url: 'https://test-pages.example.com/shadow-video-player.html',
  tool: 'web_task_agent',
  input: {
    objective: 'Play the video, skip to 30 seconds, and enable captions',
    reasoning: 'Testing complex shadow DOM video player interactions',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Located the video player controls inside shadow DOM',
        'Successfully clicked play',
        'Navigated to approximately 30 seconds',
        'Found and enabled captions/subtitles',
        'All controls responded correctly',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify video is playing',
          'Confirm playback position is near 30 seconds',
          'Check that captions are visible',
        ],
      },
    },
  },
  metadata: {
    tags: ['web-task', 'shadow-dom', 'video-player', 'media', 'complex'],
    timeout: 45000,
  },
};

// Export all WebTaskAgent shadow DOM tests
export const webTaskAgentShadowDOMTests = [
  shadowDomFormWorkflowTest,
  githubIssueCreationTest,
  notionBlockEditingTest,
  shadowDomShoppingTest,
  shadowDomVideoPlayerTest,
];
