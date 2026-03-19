// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Type definitions for the QA Agent Mini App
 *
 * These types define the data structures for test cases, test suites,
 * and CDP-based test execution commands.
 */

/**
 * CDP command that can be executed directly without AI.
 * This covers ALL Playwright-equivalent actions using pure CDP APIs.
 */
export interface CDPCommand {
  // =============================================================
  // NAVIGATION
  // =============================================================
  navigate?: {
    url: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  };

  // =============================================================
  // MOUSE ACTIONS
  // =============================================================
  click?: {
    xpath?: string;
    selector?: string;
    text?: string;
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  };

  hover?: {
    xpath?: string;
    selector?: string;
    text?: string;
  };

  // =============================================================
  // KEYBOARD/INPUT ACTIONS
  // =============================================================
  fill?: {
    xpath?: string;
    selector?: string;
    text?: string;
    value: string;
  };

  type?: {
    xpath?: string;
    selector?: string;
    text?: string;
    value: string;
    delay?: number;
  };

  press?: {
    xpath?: string;
    selector?: string;
    key: string;
    modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  };

  clear?: {
    xpath?: string;
    selector?: string;
    text?: string;
  };

  // =============================================================
  // FORM CONTROLS
  // =============================================================
  check?: {
    xpath?: string;
    selector?: string;
    text?: string;
  };

  uncheck?: {
    xpath?: string;
    selector?: string;
    text?: string;
  };

  setChecked?: {
    xpath?: string;
    selector?: string;
    text?: string;
    checked: boolean;
  };

  selectOption?: {
    xpath?: string;
    selector?: string;
    value?: string;
    label?: string;
    index?: number;
  };

  // =============================================================
  // SCROLL
  // =============================================================
  scroll?: {
    xpath?: string;
    selector?: string;
    text?: string;
    direction?: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom';
    amount?: number;
    pages?: number;
  };

  scrollIntoView?: {
    xpath?: string;
    selector?: string;
    text?: string;
    block?: 'start' | 'center' | 'end' | 'nearest';
  };

  // =============================================================
  // WAITS
  // =============================================================
  wait?: {
    type: 'load' | 'networkidle' | 'selector' | 'hidden' | 'timeout' | 'function';
    selector?: string;
    timeout?: number;
    predicate?: string;
  };

  // =============================================================
  // ASSERTIONS
  // =============================================================
  assert?: {
    type:
      | 'visible'
      | 'hidden'
      | 'exists'
      | 'notExists'
      | 'textContains'
      | 'textEquals'
      | 'valueEquals'
      | 'attributeEquals'
      | 'urlContains'
      | 'urlEquals'
      | 'titleContains'
      | 'titleEquals'
      | 'checked'
      | 'unchecked'
      | 'enabled'
      | 'disabled'
      | 'focused'
      | 'count'
      | 'custom';
    selector?: string;
    xpath?: string;
    expected?: string | number | boolean;
    attribute?: string;
    customCode?: string;
  };

  // =============================================================
  // SCREENSHOT
  // =============================================================
  screenshot?: {
    fullPage?: boolean;
    selector?: string;
    xpath?: string;
  };

  // =============================================================
  // IFRAME SUPPORT
  // =============================================================
  switchToFrame?: {
    selector?: string;
    xpath?: string;
    index?: number;
  };

  switchToMainFrame?: Record<string, never>;

  // =============================================================
  // FILE UPLOAD
  // =============================================================
  setInputFiles?: {
    selector?: string;
    xpath?: string;
    files: string[];
  };

  // =============================================================
  // DIALOG HANDLING
  // =============================================================
  handleDialog?: {
    action: 'accept' | 'dismiss';
    promptText?: string;
  };

  // =============================================================
  // JAVASCRIPT EXECUTION
  // =============================================================
  evaluate?: {
    code: string;
    returnValue?: boolean;
  };
}

/**
 * Step types for human-readable categorization
 */
export type TestStepType =
  | 'navigate'
  | 'click'
  | 'hover'
  | 'fill'
  | 'type'
  | 'press'
  | 'clear'
  | 'check'
  | 'uncheck'
  | 'selectOption'
  | 'scroll'
  | 'wait'
  | 'assert'
  | 'screenshot'
  | 'switchFrame'
  | 'fileUpload'
  | 'dialog'
  | 'evaluate';

/**
 * A single executable test step with CDP commands
 */
export interface TestStep {
  id: string;
  type: TestStepType;
  description: string;
  cdpCommand: CDPCommand;
  timeout?: number;
}

/**
 * Input for creating a new test case
 */
export interface CreateTestCaseInput {
  name: string;
  description: string;
  url: string;
  steps?: TestStep[];
}

/**
 * Stored test case in IndexedDB
 */
export interface StoredTestCase {
  id: string;
  name: string;
  description: string;
  url: string;
  steps: TestStep[];
  generatedCode?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new test suite
 */
export interface CreateTestSuiteInput {
  name: string;
  description: string;
  testCaseIds?: string[];
}

/**
 * Stored test suite in IndexedDB
 */
export interface StoredTestSuite {
  id: string;
  name: string;
  description: string;
  testCaseIds: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a single step execution
 */
export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
  actual?: unknown;
}

/**
 * Status of a test run
 */
export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'aborted';

/**
 * Stored test run in IndexedDB
 */
export interface StoredTestRun {
  id: string;
  testCaseId?: string;
  suiteId?: string;
  status: TestRunStatus;
  startTime: string;
  endTime?: string;
  results: StepResult[];
  error?: string;
  environment?: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
  };
}

/**
 * Test case info for display in the SPA
 */
export interface TestCaseInfo {
  id: string;
  name: string;
  description: string;
  url: string;
  stepCount: number;
  lastRunStatus?: TestRunStatus;
  lastRunTime?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Test suite info for display in the SPA
 */
export interface TestSuiteInfo {
  id: string;
  name: string;
  description: string;
  testCount: number;
  lastRunStatus?: TestRunStatus;
  lastRunTime?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * State for the QA Agent Mini App
 */
export interface QAAgentState {
  view: 'list' | 'test' | 'suite' | 'run';
  activeTab: 'tests' | 'suites';
  testCases: TestCaseInfo[];
  testSuites: TestSuiteInfo[];
  selectedTest: StoredTestCase | null;
  selectedSuite: StoredTestSuite | null;
  currentRun: StoredTestRun | null;
  isGeneratingSteps: boolean;
  isRunningTest: boolean;
  // Index signature for MiniAppState compatibility
  [key: string]: unknown;
}

/**
 * Actions from SPA to DevTools controller
 */
export interface QAAgentSPAAction {
  type: string;
  [key: string]: unknown;
}

/**
 * Form data for saving a test case
 */
export interface TestCaseFormData {
  name: string;
  description: string;
  url: string;
  steps: TestStep[];
}

/**
 * Form data for saving a test suite
 */
export interface TestSuiteFormData {
  name: string;
  description: string;
  testCaseIds: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}
