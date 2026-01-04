// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {TestCase} from '../framework/types.js';

export interface ActionAgentArgs {
  objective: string;
  reasoning: string;
  hint?: string;
  input_data?: string;
}

// ============================================================================
// Shadow DOM Action Tests
// Tests for interacting with elements inside shadow DOM (open and closed)
// ============================================================================

/**
 * Test clicking a button inside an open shadow root.
 * Uses MDN's official web components example.
 */
export const shadowClickOpenTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-001',
  name: 'Click button in open shadow root',
  description: 'Click a button inside an open shadow DOM on MDN web components example',
  url: 'https://mdn.github.io/web-components-examples/popup-info-box-web-component/',
  tool: 'action_agent',
  input: {
    objective: 'Click the info icon (i button) next to one of the form labels to show the popup information',
    reasoning: 'Testing ability to target and click elements within open shadow DOM',
    hint: 'The info icons are inside <popup-info> custom elements with open shadow roots. Click one to reveal its popup.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Successfully located an info icon button inside the open shadow root',
        'Used appropriate targeting method (EncodedId, XPath, or CSS with shadow piercing)',
        'Button click was executed successfully',
        'Popup information appeared after clicking',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the info icon inside the shadow DOM was clicked',
          'Check if the popup information box appeared',
          'Confirm the visual change after clicking',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'shadow-dom', 'click', 'open-shadow', 'mdn'],
  },
};

/**
 * Test clicking a button inside a closed shadow root.
 * This requires the shadow piercer to be injected.
 * Uses a local fixture file since closed shadow DOM is rare in public sites.
 */
export const shadowClickClosedTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-002',
  name: 'Click button in closed shadow root',
  description: 'Click a button inside a closed shadow DOM using shadow piercer',
  url: 'fixture://shadow-dom-closed.html',
  tool: 'action_agent',
  input: {
    objective: 'Click the "Closed Button" that is inside a closed shadow root',
    reasoning: 'Testing shadow piercer capability to access closed shadow DOM elements',
    hint: 'The button is inside a custom <closed-shadow-element> with mode: "closed". The shadow piercer should enable access.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Successfully located the button inside the closed shadow root',
        'Shadow piercer was properly utilized for resolution',
        'Button click was executed successfully',
        'Result text shows "Button was clicked!" after successful click',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the closed shadow root button was clicked',
          'Confirm the result text shows the button was clicked',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'shadow-dom', 'click', 'closed-shadow', 'shadow-piercer', 'fixture'],
  },
};

/**
 * Test clicking a button inside nested shadow roots.
 * Uses Nicepage which has nested web components for its UI.
 */
export const shadowNestedClickTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-003',
  name: 'Click button in nested shadow roots',
  description: 'Navigate through multiple nested shadow roots to click a button',
  url: 'https://nicepage.com/',
  tool: 'action_agent',
  input: {
    objective: 'Click on any interactive button or link in the hero section of the page',
    reasoning: 'Testing ability to traverse shadow DOM hierarchy in real-world web components',
    hint: 'Nicepage uses web components with shadow DOM. Look for primary CTA buttons in the main content area.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Successfully navigated the shadow DOM hierarchy',
        'Located an interactive element within the page structure',
        'Click was executed successfully on the target element',
        'No issues with shadow root traversal',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify an interactive button was found and clicked',
          'Confirm the page responded to the click action',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'shadow-dom', 'click', 'nested', 'real-world'],
  },
};

/**
 * Test filling a form - simplified to use standard login form.
 * Uses the-internet.herokuapp.com which provides stable test pages.
 */
export const shadowFormFillTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-004',
  name: 'Fill login form',
  description: 'Fill out a login form with username and password',
  url: 'https://the-internet.herokuapp.com/login',
  tool: 'action_agent',
  input: {
    objective: 'Fill the username field with "tomsmith" and the password field with "SuperSecretPassword!" then click the Login button',
    reasoning: 'Testing form fill and submit capability',
    hint: 'The form has username and password input fields. These are the valid credentials for this test page.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Located the username input field',
        'Username field was filled with "tomsmith"',
        'Password field was filled with "SuperSecretPassword!"',
        'Login button was clicked',
        'Login was successful (page shows secure area or success message)',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the form fields were filled correctly',
          'Confirm the login was successful',
          'Check for success message or secure area page',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'form', 'fill', 'input', 'login', 'the-internet'],
  },
};

/**
 * Test interacting with GitHub web components (real-world shadow DOM).
 */
export const githubSearchShadowTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-005',
  name: 'GitHub search with shadow DOM',
  description: 'Use GitHub search bar to search for "browser operator" - tests shadow DOM form interaction',
  url: 'https://github.com',
  tool: 'action_agent',
  input: {
    objective: 'Search for "browser operator" using the GitHub search bar',
    reasoning: 'Testing real-world shadow DOM interaction with GitHub search components',
    hint: 'GitHub uses web components with shadow DOM. Find the search input, type "browser operator", and submit the search.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Located the search input in GitHub navigation',
        'Successfully entered "browser operator" into the search field',
        'Search was submitted (Enter pressed or search button clicked)',
        'Search results page loaded with results for "browser operator"',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify the search input was found and used',
          'Confirm search results are displayed',
          'Check that results relate to "browser operator"',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'shadow-dom', 'github', 'real-world', 'search', 'form'],
    timeout: 30000,
  },
};

/**
 * Test interacting with Google's PWA book app which uses web components.
 */
export const shadowCustomSelectTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-006',
  name: 'Interact with PWA web components',
  description: 'Interact with web components in Google\'s PWA sample book app',
  url: 'https://books-pwakit.appspot.com/',
  tool: 'action_agent',
  input: {
    objective: 'Click on one of the book items to view its details',
    reasoning: 'Testing web component interaction in a real PWA application',
    hint: 'The book items are web components. Click on any book cover or title to navigate to its details page.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Located book item elements in the web component structure',
        'Successfully clicked on a book item',
        'Navigation to book details occurred',
        'No errors during web component interaction',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Verify a book item was clicked',
          'Confirm navigation to book details page',
          'Check that book information is displayed',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'shadow-dom', 'pwa', 'web-components', 'google'],
  },
};

/**
 * Test interacting with checkboxes on the-internet.herokuapp.com.
 */
export const shadowToggleTest: TestCase<ActionAgentArgs> = {
  id: 'action-agent-shadow-007',
  name: 'Toggle checkbox',
  description: 'Toggle a checkbox to change its state',
  url: 'https://the-internet.herokuapp.com/checkboxes',
  tool: 'action_agent',
  input: {
    objective: 'Click checkbox 1 to toggle its checked state',
    reasoning: 'Testing interactive checkbox toggle capability',
    hint: 'There are two checkboxes on the page. Click the first one to toggle it.',
  },
  validation: {
    type: 'llm-judge',
    llmJudge: {
      criteria: [
        'Located the first checkbox element',
        'Successfully clicked the checkbox',
        'Checkbox state changed (checked->unchecked or unchecked->checked)',
        'Visual feedback reflects the new state',
      ],
      visualVerification: {
        enabled: true,
        captureBeforeAction: true,
        captureAfterAction: true,
        verificationPrompts: [
          'Compare before/after to confirm checkbox state changed',
          'Verify the checkbox visual state is different',
        ],
      },
    },
  },
  metadata: {
    tags: ['action', 'checkbox', 'toggle', 'interactive', 'the-internet'],
  },
};

// Export all shadow DOM action tests
export const shadowDOMActionTests = [
  shadowClickOpenTest,
  shadowClickClosedTest,
  shadowNestedClickTest,
  shadowFormFillTest,
  githubSearchShadowTest,
  shadowCustomSelectTest,
  shadowToggleTest,
];
