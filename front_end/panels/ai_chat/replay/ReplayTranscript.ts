// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Unified Replay Transcript Format
 *
 * This format combines fields from multiple sources to enable robust replay:
 * - AI Agent tool calls (via Langfuse traces)
 * - User manual demonstrations (via DevTools Recorder UserFlow)
 *
 * The format is designed to support:
 * - Replay via stable selectors (CSS, XPath, ARIA)
 * - Debugging via session-specific nodeIds
 * - Understanding via reasoning and page changes
 */

// ============================================================================
// Selector Types
// ============================================================================

/**
 * Selector types supported for element resolution during replay.
 * These match the DevTools Recorder selector types.
 */
export type SelectorType = 'aria' | 'css' | 'xpath' | 'pierce' | 'text';

/**
 * A selector with its type and value.
 * During replay, selectors are tried in priority order until one resolves.
 */
export interface TypedSelector {
  type: SelectorType;
  value: string;
}

/**
 * Element resolution data captured during recording.
 * Contains multiple strategies for finding the element during replay.
 */
export interface ElementResolution {
  /**
   * Session-specific node ID from accessibility tree.
   * Only valid during the recording session - use selectors for replay.
   */
  nodeId?: string;

  /**
   * Backend DOM node ID (CDP backendNodeId).
   * More stable than accessibility nodeId but still session-specific.
   */
  backendDOMNodeId?: number;

  /**
   * Multiple selector strategies, tried in order during replay.
   * Each inner array contains equivalent selectors (any can match).
   */
  selectors: string[][];

  /**
   * Typed selectors with explicit type information.
   * Alternative to the string[][] selectors format.
   */
  typedSelectors?: TypedSelector[];

  /**
   * ARIA role of the element.
   */
  role?: string;

  /**
   * ARIA label or accessible name.
   */
  ariaLabel?: string;

  /**
   * HTML tag name (lowercase).
   */
  tag?: string;

  /**
   * Element attributes relevant for matching.
   */
  attributes?: Record<string, string>;

  /**
   * Text content of the element (for text-based matching).
   */
  textContent?: string;

  /**
   * XPath computed from the element.
   */
  xpath?: string;
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * Normalized action types that map to both AI agent tools and UserFlow steps.
 */
export type ActionType =
  | 'navigate'      // Navigate to URL
  | 'click'         // Click element
  | 'doubleClick'   // Double click element
  | 'fill'          // Fill input field
  | 'type'          // Type text (keystroke by keystroke)
  | 'press'         // Press keyboard key
  | 'scroll'        // Scroll page or element
  | 'hover'         // Hover over element
  | 'select'        // Select dropdown option
  | 'wait'          // Wait for condition
  | 'screenshot'    // Take screenshot
  | 'assert'        // Assert condition
  | 'custom';       // Custom action

/**
 * Arguments specific to each action type.
 */
export interface ActionArgs {
  // Navigate
  url?: string;

  // Click/DoubleClick
  offsetX?: number;
  offsetY?: number;
  button?: 'left' | 'middle' | 'right';
  duration?: number; // Long press duration in ms

  // Fill/Type
  text?: string;
  clearFirst?: boolean;

  // Press
  key?: string;
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;

  // Scroll
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  x?: number;
  y?: number;

  // Select
  value?: string;
  index?: number;
  label?: string;

  // Wait
  condition?: 'navigation' | 'networkIdle' | 'element' | 'timeout';
  timeout?: number;
  selector?: string;

  // Assert
  expectation?: string;
  actual?: string;

  // Custom
  customData?: any;
}

// ============================================================================
// Page Change Types
// ============================================================================

/**
 * Information about page state changes after an action.
 * Useful for validation during replay.
 */
export interface PageChange {
  hasChanges: boolean;
  summary?: string;

  /**
   * Elements added to the page (accessibility tree format).
   */
  added?: string[];

  /**
   * Elements removed from the page.
   */
  removed?: string[];

  /**
   * Elements that were modified.
   */
  modified?: string[];

  /**
   * URL change if navigation occurred.
   */
  urlChange?: {
    from: string;
    to: string;
  };
}

/**
 * State verification performed after an action.
 */
export interface StateVerification {
  verified: boolean;
  summary?: string;
  checks?: Array<{
    type: 'element_exists' | 'element_visible' | 'text_content' | 'url' | 'custom';
    expected: any;
    actual?: any;
    passed: boolean;
  }>;
}

// ============================================================================
// Replay Step
// ============================================================================

/**
 * A single step in the replay transcript.
 * Represents one browser action (click, type, navigate, etc.).
 */
export interface ReplayStep {
  /**
   * Unique identifier for this step.
   */
  id: string;

  /**
   * Timestamp when the action was recorded.
   */
  timestamp: string;

  /**
   * Tool name from AI agent (e.g., 'navigate_url', 'perform_action').
   * Null for user demonstrations.
   */
  tool?: string;

  /**
   * Normalized action type.
   */
  action: ActionType;

  /**
   * Element targeting information (for element-based actions).
   */
  element?: ElementResolution;

  /**
   * Action-specific arguments.
   */
  args: ActionArgs;

  /**
   * AI reasoning for this action (from agent).
   * Useful for understanding the agent's decision.
   */
  reasoning?: string;

  /**
   * Result of executing the action.
   */
  result?: {
    success: boolean;
    output?: any;
    error?: string;
    duration_ms?: number;
  };

  /**
   * Page changes detected after the action.
   */
  pageChange?: PageChange;

  /**
   * State verification after the action.
   */
  stateVerification?: StateVerification;

  /**
   * Screenshot path (relative to transcript location).
   */
  screenshot?: string;

  /**
   * For iframe/popup targeting.
   */
  frame?: {
    frameId?: string;
    url?: string;
    name?: string;
    selectors?: string[][];
    frameIndices?: number[];
  };

  /**
   * For multi-tab targeting.
   */
  target?: {
    tabId?: string;
    url?: string;
  };
}

// ============================================================================
// Metadata
// ============================================================================

/**
 * Source of the recording.
 */
export type RecordingSource =
  | 'langfuse'        // From Langfuse AI agent trace
  | 'user_demo'       // From DevTools Recorder (user demonstration)
  | 'manual'          // Manually created
  | 'hybrid';         // Combined from multiple sources

/**
 * Metadata about the recording.
 */
export interface ReplayMetadata {
  /**
   * When the recording was created.
   */
  recordedAt: string;

  /**
   * Source of the recording.
   */
  source: RecordingSource;

  /**
   * Session ID (for grouping related recordings).
   */
  sessionId?: string;

  /**
   * Langfuse trace ID (if source is 'langfuse').
   */
  traceId?: string;

  /**
   * Starting URL for the recording.
   */
  startUrl: string;

  /**
   * The objective/task the agent was trying to accomplish.
   */
  objective?: string;

  /**
   * Agent name (if from AI agent).
   */
  agent?: string;

  /**
   * Model used (if from AI agent).
   */
  model?: string;

  /**
   * Provider used (if from AI agent).
   */
  provider?: string;

  /**
   * Viewport size at recording time.
   */
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };

  /**
   * Browser user agent at recording time.
   */
  userAgent?: string;

  /**
   * Custom tags for categorization.
   */
  tags?: string[];

  /**
   * Recording title/name.
   */
  title?: string;

  /**
   * Recording description.
   */
  description?: string;
}

// ============================================================================
// Final State
// ============================================================================

/**
 * Expected final state after replay completion.
 * Used for validation.
 */
export interface FinalState {
  /**
   * Expected final URL.
   */
  url?: string;

  /**
   * Screenshot of final state.
   */
  screenshot?: string;

  /**
   * Elements that should exist after replay.
   */
  expectedElements?: Array<{
    selector: string;
    minCount?: number;
    maxCount?: number;
    visible?: boolean;
  }>;

  /**
   * Text that should be present on the page.
   */
  expectedText?: string[];

  /**
   * Custom validation criteria.
   */
  customValidation?: any;
}

// ============================================================================
// Replay Transcript
// ============================================================================

/**
 * The complete replay transcript format.
 * This is the unified format for storing replayable browser recordings.
 */
export interface ReplayTranscript {
  /**
   * Format version for future compatibility.
   */
  version: '1.0';

  /**
   * Recording metadata.
   */
  metadata: ReplayMetadata;

  /**
   * The recorded steps.
   */
  steps: ReplayStep[];

  /**
   * Expected final state (optional, for validation).
   */
  finalState?: FinalState;
}

// ============================================================================
// Replay Options
// ============================================================================

/**
 * Options for controlling replay execution.
 */
export interface ReplayOptions {
  /**
   * How to handle divergence from recorded state.
   */
  divergenceMode: 'strict' | 'lenient' | 'interactive' | 'adaptive';

  /**
   * Whether to stop on the first divergence.
   */
  stopOnDivergence: boolean;

  /**
   * Whether to take screenshots at each step.
   */
  screenshotEachStep: boolean;

  /**
   * Default timeout for element resolution (ms).
   */
  elementTimeout: number;

  /**
   * Default timeout for actions (ms).
   */
  actionTimeout: number;

  /**
   * Delay between steps (ms).
   */
  stepDelay: number;

  /**
   * Whether to validate final state.
   */
  validateFinalState: boolean;

  /**
   * Custom element resolution callback.
   */
  onElementResolution?: (element: ElementResolution) => Promise<string | null>;

  /**
   * Custom divergence handler.
   */
  onDivergence?: (step: ReplayStep, expected: any, actual: any) => Promise<'continue' | 'skip' | 'fail' | 'retry'>;
}

/**
 * Default replay options.
 */
export const DEFAULT_REPLAY_OPTIONS: ReplayOptions = {
  divergenceMode: 'lenient',
  stopOnDivergence: false,
  screenshotEachStep: false,
  elementTimeout: 10000,
  actionTimeout: 30000,
  stepDelay: 100,
  validateFinalState: true,
};

// ============================================================================
// Replay Result
// ============================================================================

/**
 * Result of a single step execution during replay.
 */
export interface StepResult {
  stepId: string;
  success: boolean;
  duration_ms: number;
  divergence?: {
    type: 'element_not_found' | 'result_mismatch' | 'timeout' | 'error';
    expected?: any;
    actual?: any;
    message: string;
  };
  screenshot?: string;
}

/**
 * Result of executing a complete replay.
 */
export interface ReplayResult {
  success: boolean;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalDuration_ms: number;
  stepResults: StepResult[];
  finalStateValidation?: {
    passed: boolean;
    checks: Array<{
      type: string;
      passed: boolean;
      message?: string;
    }>;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique step ID.
 */
export function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an empty replay transcript.
 */
export function createEmptyTranscript(
  startUrl: string,
  source: RecordingSource = 'manual',
  title?: string
): ReplayTranscript {
  return {
    version: '1.0',
    metadata: {
      recordedAt: new Date().toISOString(),
      source,
      startUrl,
      title,
    },
    steps: [],
  };
}

/**
 * Validate a replay transcript structure.
 */
export function validateTranscript(transcript: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!transcript) {
    errors.push('Transcript is null or undefined');
    return { valid: false, errors };
  }

  if (transcript.version !== '1.0') {
    errors.push(`Unsupported version: ${transcript.version}`);
  }

  if (!transcript.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!transcript.metadata.recordedAt) {
      errors.push('Missing metadata.recordedAt');
    }
    if (!transcript.metadata.source) {
      errors.push('Missing metadata.source');
    }
    if (!transcript.metadata.startUrl) {
      errors.push('Missing metadata.startUrl');
    }
  }

  if (!Array.isArray(transcript.steps)) {
    errors.push('Steps must be an array');
  } else {
    transcript.steps.forEach((step: any, index: number) => {
      if (!step.id) {
        errors.push(`Step ${index}: missing id`);
      }
      if (!step.action) {
        errors.push(`Step ${index}: missing action`);
      }
      if (!step.timestamp) {
        errors.push(`Step ${index}: missing timestamp`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Serialize transcript to YAML-friendly format.
 * This converts dates to ISO strings and removes undefined values.
 */
export function serializeForYAML(transcript: ReplayTranscript): any {
  return JSON.parse(JSON.stringify(transcript));
}
