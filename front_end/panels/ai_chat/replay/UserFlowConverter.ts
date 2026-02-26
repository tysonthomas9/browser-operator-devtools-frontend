// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Converts DevTools Recorder UserFlow (Puppeteer format) to unified ReplayTranscript.
 *
 * The DevTools Recorder captures user interactions and exports them as UserFlow JSON.
 * This converter transforms that format into ReplayTranscript for unified replay.
 */

import type {
  ReplayTranscript,
  ReplayStep,
  SelectorType,
  TypedSelector,
  ElementResolution,
} from './ReplayTranscript.js';
import { generateStepId } from './ReplayTranscript.js';
import type {
  UserFlow,
  Step,
  Selector,
  FrameSelector,
  StepWithSelectors,
} from '../../recorder/models/Schema.js';

// Re-export UserFlow for convenience
export type { UserFlow } from '../../recorder/models/Schema.js';

// ============================================================================
// Converter Options
// ============================================================================

export interface ConverterOptions {
  /**
   * Session ID for grouping.
   */
  sessionId?: string;

  /**
   * Override the title from UserFlow.
   */
  title?: string;

  /**
   * Add custom tags.
   */
  tags?: string[];

  /**
   * User agent string (if known).
   */
  userAgent?: string;
}

// ============================================================================
// Converter Implementation
// ============================================================================

/**
 * Parse selector string to extract type and value.
 * Selectors can be in format:
 * - "aria/Label Text" -> { type: 'aria', value: 'Label Text' }
 * - "xpath//div[@id='foo']" -> { type: 'xpath', value: '//div[@id="foo"]' }
 * - "text/Submit" -> { type: 'text', value: 'Submit' }
 * - "pierce/#shadow-element" -> { type: 'pierce', value: '#shadow-element' }
 * - "#css-selector" -> { type: 'css', value: '#css-selector' }
 */
function parseSelector(selector: string): TypedSelector {
  // Check for prefixed selectors
  if (selector.startsWith('aria/')) {
    return { type: 'aria', value: selector.substring(5) };
  }
  if (selector.startsWith('xpath/')) {
    return { type: 'xpath', value: selector.substring(6) };
  }
  if (selector.startsWith('text/')) {
    return { type: 'text', value: selector.substring(5) };
  }
  if (selector.startsWith('pierce/')) {
    return { type: 'pierce', value: selector.substring(7) };
  }
  // Default to CSS
  return { type: 'css', value: selector };
}

/**
 * Normalize a Selector (string | string[]) to string[].
 */
function normalizeSelector(selector: Selector): string[] {
  return Array.isArray(selector) ? selector : [selector];
}

/**
 * Convert UserFlow selectors to ElementResolution.
 * Selectors in puppeteer-replay are Selector[] where Selector = string | string[]
 */
function convertSelectors(selectors?: Selector[]): ElementResolution | undefined {
  if (!selectors || selectors.length === 0) {
    return undefined;
  }

  // Normalize all selectors to string[][] format for our internal use
  const normalizedSelectors: string[][] = selectors.map(normalizeSelector);

  // Parse selectors to extract type information
  const typedSelectors: TypedSelector[] = [];
  const selectorsByType: Map<SelectorType, string[]> = new Map();

  for (const selectorGroup of normalizedSelectors) {
    for (const selector of selectorGroup) {
      const parsed = parseSelector(selector);
      typedSelectors.push(parsed);

      const existing = selectorsByType.get(parsed.type) || [];
      existing.push(parsed.value);
      selectorsByType.set(parsed.type, existing);
    }
  }

  // Extract specific values for ElementResolution
  const ariaSelectors = selectorsByType.get('aria') || [];
  const xpathSelectors = selectorsByType.get('xpath') || [];

  return {
    selectors: normalizedSelectors,
    typedSelectors,
    ariaLabel: ariaSelectors[0], // First ARIA selector as label
    xpath: xpathSelectors[0], // First XPath as primary
  };
}

/**
 * Convert UserFlow button to standard button name.
 */
function convertButton(button?: string): 'left' | 'middle' | 'right' | undefined {
  switch (button) {
    case 'primary':
      return 'left';
    case 'auxiliary':
      return 'middle';
    case 'secondary':
      return 'right';
    default:
      return undefined;
  }
}

/**
 * Convert frame selectors to ReplayStep frame format.
 * FrameSelector in puppeteer-replay is number[] (frame indices).
 */
function convertFrame(frame?: FrameSelector): ReplayStep['frame'] | undefined {
  if (!frame || frame.length === 0) {
    return undefined;
  }

  // Convert frame indices to selectors format
  return {
    selectors: [frame.map(index => `[data-frame-index="${index}"]`)],
    frameIndices: frame,
  };
}

/**
 * Type guard to check if step has selectors.
 */
function hasSelectors(step: Step): step is StepWithSelectors & Step {
  return 'selectors' in step;
}

/**
 * Get selectors from step if available.
 */
function getSelectors(step: Step): Selector[] | undefined {
  if (hasSelectors(step)) {
    return (step as StepWithSelectors).selectors;
  }
  return undefined;
}

/**
 * Get frame from step if available.
 */
function getFrame(step: Step): FrameSelector | undefined {
  if ('frame' in step) {
    return (step as { frame?: FrameSelector }).frame;
  }
  return undefined;
}

/**
 * Get target from step if available.
 */
function getTarget(step: Step): string | undefined {
  if ('target' in step) {
    return (step as { target?: string }).target;
  }
  return undefined;
}

/**
 * Convert a single UserFlow step to ReplayStep.
 */
function convertStep(step: Step, index: number, baseTimestamp: Date): ReplayStep {
  const timestamp = new Date(baseTimestamp.getTime() + index * 1000).toISOString();
  const id = generateStepId();

  switch (step.type) {
    case 'setViewport':
      return {
        id,
        timestamp,
        action: 'custom',
        args: {
          customData: {
            type: 'setViewport',
            width: step.width,
            height: step.height,
            deviceScaleFactor: step.deviceScaleFactor,
            isMobile: step.isMobile,
            hasTouch: step.hasTouch,
            isLandscape: step.isLandscape,
          },
        },
      };

    case 'navigate':
      return {
        id,
        timestamp,
        tool: 'navigate_url',
        action: 'navigate',
        args: {
          url: step.url,
        },
      };

    case 'click':
      return {
        id,
        timestamp,
        tool: 'perform_action',
        action: 'click',
        element: convertSelectors(getSelectors(step)),
        args: {
          offsetX: step.offsetX,
          offsetY: step.offsetY,
          button: convertButton(step.button),
          duration: step.duration,
        },
        frame: convertFrame(getFrame(step)),
        target: getTarget(step) ? { tabId: getTarget(step)! } : undefined,
      };

    case 'doubleClick':
      return {
        id,
        timestamp,
        tool: 'perform_action',
        action: 'doubleClick',
        element: convertSelectors(getSelectors(step)),
        args: {
          offsetX: step.offsetX,
          offsetY: step.offsetY,
          button: convertButton(step.button),
        },
        frame: convertFrame(getFrame(step)),
        target: getTarget(step) ? { tabId: getTarget(step)! } : undefined,
      };

    case 'hover':
      return {
        id,
        timestamp,
        tool: 'perform_action',
        action: 'hover',
        element: convertSelectors(getSelectors(step)),
        args: {},
        frame: convertFrame(getFrame(step)),
        target: getTarget(step) ? { tabId: getTarget(step)! } : undefined,
      };

    case 'change':
      return {
        id,
        timestamp,
        tool: 'perform_action',
        action: 'fill',
        element: convertSelectors(getSelectors(step)),
        args: {
          text: step.value,
        },
        frame: convertFrame(getFrame(step)),
        target: getTarget(step) ? { tabId: getTarget(step)! } : undefined,
      };

    case 'keyDown':
      return {
        id,
        timestamp,
        tool: 'perform_action',
        action: 'press',
        args: {
          key: step.key,
        },
      };

    case 'keyUp':
      // Key up is often paired with key down, skip or mark as custom
      return {
        id,
        timestamp,
        action: 'custom',
        args: {
          customData: {
            type: 'keyUp',
            key: step.key,
          },
        },
      };

    case 'scroll':
      return {
        id,
        timestamp,
        tool: 'perform_action',
        action: 'scroll',
        element: convertSelectors(getSelectors(step)),
        args: {
          x: step.x,
          y: step.y,
          // Infer direction from x/y values
          direction: step.y && step.y > 0 ? 'down' : step.y && step.y < 0 ? 'up' :
                     step.x && step.x > 0 ? 'right' : step.x && step.x < 0 ? 'left' : undefined,
          amount: step.y ? Math.abs(step.y) : step.x ? Math.abs(step.x) : undefined,
        },
        frame: convertFrame(getFrame(step)),
        target: getTarget(step) ? { tabId: getTarget(step)! } : undefined,
      };

    case 'waitForElement':
      return {
        id,
        timestamp,
        action: 'wait',
        element: convertSelectors(getSelectors(step)),
        args: {
          condition: 'element',
          timeout: step.timeout,
        },
        frame: convertFrame(getFrame(step)),
        target: getTarget(step) ? { tabId: getTarget(step)! } : undefined,
      };

    case 'waitForExpression':
      return {
        id,
        timestamp,
        action: 'wait',
        args: {
          condition: 'element', // Maps to custom expression wait
          timeout: step.timeout,
          customData: {
            type: 'waitForExpression',
            expression: step.expression,
          },
        },
      };

    default:
      // Unknown step type
      return {
        id,
        timestamp,
        action: 'custom',
        args: {
          customData: step,
        },
      };
  }
}

/**
 * Extract the starting URL from UserFlow steps.
 */
function extractStartUrl(steps: Step[]): string {
  const navigateStep = steps.find(s => s.type === 'navigate');
  if (navigateStep && navigateStep.type === 'navigate') {
    return navigateStep.url;
  }
  return 'about:blank';
}

/**
 * Extract viewport from UserFlow steps.
 */
function extractViewport(steps: Step[]): { width: number; height: number; deviceScaleFactor?: number } | undefined {
  const viewportStep = steps.find(s => s.type === 'setViewport');
  if (!viewportStep || viewportStep.type !== 'setViewport') {
    return undefined;
  }
  return {
    width: viewportStep.width,
    height: viewportStep.height,
    deviceScaleFactor: viewportStep.deviceScaleFactor,
  };
}

/**
 * Main converter class.
 */
export class UserFlowConverter {
  /**
   * Convert a UserFlow to ReplayTranscript.
   */
  convert(userFlow: UserFlow, options: ConverterOptions = {}): ReplayTranscript {
    const now = new Date();
    const startUrl = extractStartUrl(userFlow.steps);
    const viewport = extractViewport(userFlow.steps);

    // Convert steps, filtering out setViewport (captured in metadata)
    const steps: ReplayStep[] = userFlow.steps
      .filter(step => step.type !== 'setViewport')
      .map((step, index) => convertStep(step, index, now));

    return {
      version: '1.0',
      metadata: {
        recordedAt: now.toISOString(),
        source: 'user_demo',
        sessionId: options.sessionId,
        startUrl,
        title: options.title || userFlow.title,
        viewport,
        userAgent: options.userAgent,
        tags: options.tags,
      },
      steps,
    };
  }

  /**
   * Convert a UserFlow JSON string to ReplayTranscript.
   */
  convertFromJSON(json: string, options: ConverterOptions = {}): ReplayTranscript {
    const userFlow = JSON.parse(json) as UserFlow;
    return this.convert(userFlow, options);
  }
}

/**
 * Singleton instance for convenience.
 */
let converterInstance: UserFlowConverter | null = null;

export function getUserFlowConverter(): UserFlowConverter {
  if (!converterInstance) {
    converterInstance = new UserFlowConverter();
  }
  return converterInstance;
}
