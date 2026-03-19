// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Test Executor - Executes stored CDP commands without AI involvement
 *
 * This module provides deterministic test execution using pure CDP APIs.
 * It takes TestStep objects with CDPCommand data and executes them directly
 * against the browser, ensuring identical behavior on each run.
 *
 * KEY PRINCIPLE: NO AI at runtime - tests run as fast, reproducible CDP commands.
 */

import * as SDK from '../../../../../core/sdk/sdk.js';
import type * as Protocol from '../../../../../generated/protocol.js';
import { createLogger } from '../../../core/Logger.js';
import type {
  TestStep,
  CDPCommand,
  StepResult,
  StoredTestRun,
  StoredTestCase,
  TestRunStatus,
} from './types.js';
import { TestStorageManager } from '../../../core/TestStorageManager.js';

const logger = createLogger('TestExecutor');

/**
 * Callback for receiving step execution updates
 */
export type StepProgressCallback = (stepResult: StepResult, currentStep: number, totalSteps: number) => void;

/**
 * Test execution options
 */
export interface TestExecutionOptions {
  /** Callback for step progress updates */
  onStepComplete?: StepProgressCallback;
  /** Callback when test run status changes */
  onStatusChange?: (status: TestRunStatus) => void;
  /** Abort signal for cancelling execution */
  abortSignal?: AbortSignal;
  /** Default timeout for each step in ms (default: 30000) */
  defaultTimeout?: number;
}

/**
 * TestExecutor - Executes stored test steps using CDP APIs
 *
 * This class provides pure CDP-based test execution without any AI involvement.
 * It reuses the same browser interaction patterns from the existing tools.
 */
export class TestExecutor {
  private aborted = false;
  private currentFrameId: string | null = null;
  private defaultTimeout: number;
  private storageManager: TestStorageManager;

  constructor(options?: { defaultTimeout?: number }) {
    this.defaultTimeout = options?.defaultTimeout ?? 30000;
    this.storageManager = TestStorageManager.getInstance();
  }

  /**
   * Execute a complete test case
   */
  async executeTestCase(
    testCase: StoredTestCase,
    options?: TestExecutionOptions
  ): Promise<StoredTestRun> {
    this.aborted = false;

    // Create test run record
    const testRun: StoredTestRun = {
      id: crypto.randomUUID(),
      testCaseId: testCase.id,
      status: 'running',
      startTime: new Date().toISOString(),
      results: [],
      environment: await this.captureEnvironment(),
    };

    // Save initial run state
    await this.storageManager.recordTestRun(testRun);
    options?.onStatusChange?.('running');

    // Set up abort handler
    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        this.aborted = true;
      });
    }

    const totalSteps = testCase.steps.length;
    let stepIndex = 0;
    let hasFailure = false;

    for (const step of testCase.steps) {
      if (this.aborted) {
        testRun.status = 'aborted';
        break;
      }

      stepIndex++;
      logger.info(`Executing step ${stepIndex}/${totalSteps}: ${step.description}`);

      const stepResult = await this.executeStep(step, options?.defaultTimeout ?? this.defaultTimeout);
      testRun.results.push(stepResult);

      // Notify progress
      options?.onStepComplete?.(stepResult, stepIndex, totalSteps);

      if (stepResult.status === 'failed') {
        hasFailure = true;
        logger.error(`Step ${stepIndex} failed: ${stepResult.error}`);
        break; // Stop on first failure
      }
    }

    // Determine final status
    if (!this.aborted) {
      testRun.status = hasFailure ? 'failed' : 'passed';
    }

    testRun.endTime = new Date().toISOString();

    // Update run in storage
    await this.storageManager.updateTestRun(testRun.id, {
      status: testRun.status,
      endTime: testRun.endTime,
      results: testRun.results,
    });
    options?.onStatusChange?.(testRun.status);

    return testRun;
  }

  /**
   * Execute a single test step
   */
  async executeStep(step: TestStep, timeout?: number): Promise<StepResult> {
    const startTime = Date.now();
    const stepTimeout = step.timeout ?? timeout ?? this.defaultTimeout;

    try {
      // Wrap execution in timeout
      await this.withTimeout(
        () => this.executeCDPCommand(step.cdpCommand),
        stepTimeout
      );

      return {
        stepId: step.id,
        status: 'passed',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Step ${step.id} failed:`, error);

      // Capture screenshot on failure
      let screenshot: string | undefined;
      try {
        screenshot = await this.captureScreenshot(false);
      } catch {
        // Ignore screenshot errors
      }

      return {
        stepId: step.id,
        status: 'failed',
        duration: Date.now() - startTime,
        error: errorMessage,
        screenshot,
      };
    }
  }

  /**
   * Execute a CDP command
   */
  private async executeCDPCommand(cmd: CDPCommand): Promise<unknown> {
    const target = this.getTarget();

    // =============== NAVIGATION ===============
    if (cmd.navigate) {
      return this.executeNavigate(target, cmd.navigate);
    }

    // =============== MOUSE ACTIONS ===============
    if (cmd.click) {
      const xpath = cmd.click.xpath ?? this.selectorToXPath(cmd.click.selector, cmd.click.text);
      return this.executeClick(target, xpath, cmd.click);
    }

    if (cmd.hover) {
      const xpath = cmd.hover.xpath ?? this.selectorToXPath(cmd.hover.selector, cmd.hover.text);
      return this.executeHover(target, xpath);
    }

    // =============== KEYBOARD/INPUT ===============
    if (cmd.fill) {
      const xpath = cmd.fill.xpath ?? this.selectorToXPath(cmd.fill.selector, cmd.fill.text);
      return this.executeFill(target, xpath, cmd.fill.value);
    }

    if (cmd.type) {
      const xpath = cmd.type.xpath ?? this.selectorToXPath(cmd.type.selector, cmd.type.text);
      return this.executeType(target, xpath, cmd.type.value, cmd.type.delay);
    }

    if (cmd.press) {
      const xpath = cmd.press.xpath ?? this.selectorToXPath(cmd.press.selector);
      return this.executePress(target, xpath, cmd.press.key, cmd.press.modifiers);
    }

    if (cmd.clear) {
      const xpath = cmd.clear.xpath ?? this.selectorToXPath(cmd.clear.selector, cmd.clear.text);
      return this.executeClear(target, xpath);
    }

    // =============== FORM CONTROLS ===============
    if (cmd.check) {
      const xpath = cmd.check.xpath ?? this.selectorToXPath(cmd.check.selector, cmd.check.text);
      return this.executeCheck(target, xpath, true);
    }

    if (cmd.uncheck) {
      const xpath = cmd.uncheck.xpath ?? this.selectorToXPath(cmd.uncheck.selector, cmd.uncheck.text);
      return this.executeCheck(target, xpath, false);
    }

    if (cmd.setChecked) {
      const xpath = cmd.setChecked.xpath ?? this.selectorToXPath(cmd.setChecked.selector, cmd.setChecked.text);
      return this.executeCheck(target, xpath, cmd.setChecked.checked);
    }

    if (cmd.selectOption) {
      const xpath = cmd.selectOption.xpath ?? this.selectorToXPath(cmd.selectOption.selector);
      return this.executeSelectOption(target, xpath, cmd.selectOption);
    }

    // =============== SCROLL ===============
    if (cmd.scroll) {
      if (cmd.scroll.xpath || cmd.scroll.selector || cmd.scroll.text) {
        const xpath = cmd.scroll.xpath ?? this.selectorToXPath(cmd.scroll.selector, cmd.scroll.text);
        return this.executeScrollIntoView(target, xpath);
      }
      return this.executeScrollPage(target, cmd.scroll);
    }

    if (cmd.scrollIntoView) {
      const xpath = cmd.scrollIntoView.xpath ?? this.selectorToXPath(cmd.scrollIntoView.selector, cmd.scrollIntoView.text);
      return this.executeScrollIntoView(target, xpath, cmd.scrollIntoView.block);
    }

    // =============== WAITS ===============
    if (cmd.wait) {
      return this.executeWait(target, cmd.wait);
    }

    // =============== ASSERTIONS ===============
    if (cmd.assert) {
      return this.executeAssert(target, cmd.assert);
    }

    // =============== SCREENSHOT ===============
    if (cmd.screenshot) {
      const screenshot = await this.captureScreenshot(cmd.screenshot.fullPage);
      return { screenshot };
    }

    // =============== IFRAME ===============
    if (cmd.switchToFrame) {
      return this.executeSwitchToFrame(target, cmd.switchToFrame);
    }

    if (cmd.switchToMainFrame !== undefined) {
      this.currentFrameId = null;
      return;
    }

    // =============== FILE UPLOAD ===============
    if (cmd.setInputFiles) {
      const xpath = cmd.setInputFiles.xpath ?? this.selectorToXPath(cmd.setInputFiles.selector);
      return this.executeSetInputFiles(target, xpath, cmd.setInputFiles.files);
    }

    // =============== DIALOG HANDLING ===============
    if (cmd.handleDialog) {
      return this.executeHandleDialog(target, cmd.handleDialog);
    }

    // =============== JS EXECUTION ===============
    if (cmd.evaluate) {
      return this.executeEvaluate(target, cmd.evaluate.code);
    }

    throw new Error('Unknown CDP command type');
  }

  // =============== COMMAND IMPLEMENTATIONS ===============

  private async executeNavigate(
    target: SDK.Target.Target,
    opts: NonNullable<CDPCommand['navigate']>
  ): Promise<void> {
    const pageAgent = target.pageAgent();

    await pageAgent.invoke_navigate({ url: opts.url });

    // Wait for the appropriate load event
    const waitUntil = opts.waitUntil ?? 'load';
    await this.waitForPageLoad(target, waitUntil);
  }

  private async executeClick(
    target: SDK.Target.Target,
    xpath: string,
    opts: NonNullable<CDPCommand['click']>
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const objectId = await this.resolveElement(target, xpath);

    // Scroll into view and click
    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function() {
          this.scrollIntoView({ behavior: 'instant', block: 'center' });
          return new Promise(resolve => {
            setTimeout(() => {
              this.click();
              resolve(true);
            }, 100);
          });
        }
      `,
      returnByValue: true,
      awaitPromise: true,
    });
  }

  private async executeHover(target: SDK.Target.Target, xpath: string): Promise<void> {
    const objectId = await this.resolveElement(target, xpath);
    const { x, y } = await this.getElementCenter(target, objectId);

    const inputAgent = target.inputAgent();
    await inputAgent.invoke_dispatchMouseEvent({
      type: 'mouseMoved' as Protocol.Input.DispatchMouseEventRequestType,
      x,
      y,
    });
  }

  private async executeFill(
    target: SDK.Target.Target,
    xpath: string,
    value: string
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const inputAgent = target.inputAgent();
    const objectId = await this.resolveElement(target, xpath);

    // Focus and clear
    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function() {
          this.focus();
          this.value = '';
          return true;
        }
      `,
      returnByValue: true,
    });

    // Type characters
    for (const char of value) {
      await inputAgent.invoke_dispatchKeyEvent({
        type: 'keyDown' as Protocol.Input.DispatchKeyEventRequestType,
        text: char,
      });
      await inputAgent.invoke_dispatchKeyEvent({
        type: 'keyUp' as Protocol.Input.DispatchKeyEventRequestType,
      });
    }

    // Set value and dispatch events
    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function(val) {
          this.value = val;
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      `,
      arguments: [{ value }],
      returnByValue: true,
    });
  }

  private async executeType(
    target: SDK.Target.Target,
    xpath: string,
    value: string,
    delay?: number
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const inputAgent = target.inputAgent();
    const objectId = await this.resolveElement(target, xpath);

    // Focus
    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `function() { this.focus(); return true; }`,
      returnByValue: true,
    });

    // Type with delay
    const charDelay = delay ?? 50;
    for (const char of value) {
      await inputAgent.invoke_dispatchKeyEvent({
        type: 'keyDown' as Protocol.Input.DispatchKeyEventRequestType,
        text: char,
      });
      await inputAgent.invoke_dispatchKeyEvent({
        type: 'keyUp' as Protocol.Input.DispatchKeyEventRequestType,
      });
      if (charDelay > 0) {
        await this.sleep(charDelay);
      }
    }
  }

  private async executePress(
    target: SDK.Target.Target,
    xpath: string | undefined,
    key: string,
    modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>
  ): Promise<void> {
    const inputAgent = target.inputAgent();

    // Focus element if xpath provided
    if (xpath) {
      const runtimeAgent = target.runtimeAgent();
      const objectId = await this.resolveElement(target, xpath);
      await runtimeAgent.invoke_callFunctionOn({
        objectId,
        functionDeclaration: `function() { this.focus(); return true; }`,
        returnByValue: true,
      });
    }

    // Calculate modifier flags
    let modifierFlags = 0;
    if (modifiers?.includes('Alt')) {
      modifierFlags |= 1;
    }
    if (modifiers?.includes('Control')) {
      modifierFlags |= 2;
    }
    if (modifiers?.includes('Meta')) {
      modifierFlags |= 4;
    }
    if (modifiers?.includes('Shift')) {
      modifierFlags |= 8;
    }

    await inputAgent.invoke_dispatchKeyEvent({
      type: 'keyDown' as Protocol.Input.DispatchKeyEventRequestType,
      key,
      modifiers: modifierFlags,
    });
    await inputAgent.invoke_dispatchKeyEvent({
      type: 'keyUp' as Protocol.Input.DispatchKeyEventRequestType,
      key,
      modifiers: modifierFlags,
    });
  }

  private async executeClear(target: SDK.Target.Target, xpath: string): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const objectId = await this.resolveElement(target, xpath);

    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function() {
          this.value = '';
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      `,
      returnByValue: true,
    });
  }

  private async executeCheck(
    target: SDK.Target.Target,
    xpath: string,
    checked: boolean
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const objectId = await this.resolveElement(target, xpath);

    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function(checked) {
          if (this.type === 'checkbox' || this.type === 'radio') {
            if (this.checked !== checked) {
              this.checked = checked;
              this.dispatchEvent(new Event('change', { bubbles: true }));
              this.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return true;
          }
          return false;
        }
      `,
      arguments: [{ value: checked }],
      returnByValue: true,
    });
  }

  private async executeSelectOption(
    target: SDK.Target.Target,
    xpath: string,
    opts: NonNullable<CDPCommand['selectOption']>
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const objectId = await this.resolveElement(target, xpath);

    const searchValue = opts.value ?? opts.label ?? String(opts.index ?? '');

    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function(value, byIndex) {
          if (this.tagName.toLowerCase() !== 'select') return false;

          if (byIndex !== null && byIndex !== undefined) {
            this.selectedIndex = byIndex;
          } else {
            for (let i = 0; i < this.options.length; i++) {
              const opt = this.options[i];
              if (opt.value === value || opt.text === value || opt.textContent === value) {
                this.selectedIndex = i;
                break;
              }
            }
          }

          this.dispatchEvent(new Event('change', { bubbles: true }));
          this.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      `,
      arguments: [
        { value: searchValue },
        { value: opts.index ?? null },
      ],
      returnByValue: true,
    });
  }

  private async executeScrollPage(
    target: SDK.Target.Target,
    opts: NonNullable<CDPCommand['scroll']>
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const amount = opts.amount ?? 300;

    let code: string;
    if (opts.pages) {
      code = `window.scrollBy(0, ${opts.pages} * window.innerHeight)`;
    } else {
      switch (opts.direction) {
        case 'up':
          code = `window.scrollBy(0, -${amount})`;
          break;
        case 'down':
          code = `window.scrollBy(0, ${amount})`;
          break;
        case 'left':
          code = `window.scrollBy(-${amount}, 0)`;
          break;
        case 'right':
          code = `window.scrollBy(${amount}, 0)`;
          break;
        case 'top':
          code = `window.scrollTo(0, 0)`;
          break;
        case 'bottom':
          code = `window.scrollTo(0, document.body.scrollHeight)`;
          break;
        default:
          code = `window.scrollBy(0, ${amount})`;
      }
    }

    await runtimeAgent.invoke_evaluate({
      expression: code,
      returnByValue: true,
    });
  }

  private async executeScrollIntoView(
    target: SDK.Target.Target,
    xpath: string,
    block?: 'start' | 'center' | 'end' | 'nearest'
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const objectId = await this.resolveElement(target, xpath);

    await runtimeAgent.invoke_callFunctionOn({
      objectId,
      functionDeclaration: `
        function(block) {
          this.scrollIntoView({ behavior: 'smooth', block: block || 'center' });
          return true;
        }
      `,
      arguments: [{ value: block ?? 'center' }],
      returnByValue: true,
    });
  }

  private async executeWait(
    target: SDK.Target.Target,
    opts: NonNullable<CDPCommand['wait']>
  ): Promise<void> {
    const timeout = opts.timeout ?? this.defaultTimeout;

    switch (opts.type) {
      case 'load':
        await this.waitForPageLoad(target, 'load');
        break;
      case 'networkidle':
        await this.waitForPageLoad(target, 'networkidle');
        break;
      case 'selector':
        if (opts.selector) {
          await this.waitForSelector(target, opts.selector, timeout);
        }
        break;
      case 'hidden':
        if (opts.selector) {
          await this.waitForHidden(target, opts.selector, timeout);
        }
        break;
      case 'timeout':
        await this.sleep(timeout);
        break;
      case 'function':
        if (opts.predicate) {
          await this.waitForFunction(target, opts.predicate, timeout);
        }
        break;
    }
  }

  private async executeAssert(
    target: SDK.Target.Target,
    opts: NonNullable<CDPCommand['assert']>
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const sel = opts.xpath ?? (opts.selector ? this.selectorToXPath(opts.selector) : null);

    let code: string;
    switch (opts.type) {
      case 'visible':
        code = `!!document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.offsetParent`;
        break;
      case 'hidden':
        code = `!document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.offsetParent`;
        break;
      case 'exists':
        code = `!!document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
        break;
      case 'notExists':
        code = `!document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
        break;
      case 'textContains':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.textContent?.includes("${this.escapeString(String(opts.expected))}")`;
        break;
      case 'textEquals':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.textContent?.trim() === "${this.escapeString(String(opts.expected))}"`;
        break;
      case 'valueEquals':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.value === "${this.escapeString(String(opts.expected))}"`;
        break;
      case 'attributeEquals':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.getAttribute("${opts.attribute}") === "${this.escapeString(String(opts.expected))}"`;
        break;
      case 'urlContains':
        code = `window.location.href.includes("${this.escapeString(String(opts.expected))}")`;
        break;
      case 'urlEquals':
        code = `window.location.href === "${this.escapeString(String(opts.expected))}"`;
        break;
      case 'titleContains':
        code = `document.title.includes("${this.escapeString(String(opts.expected))}")`;
        break;
      case 'titleEquals':
        code = `document.title === "${this.escapeString(String(opts.expected))}"`;
        break;
      case 'checked':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.checked === true`;
        break;
      case 'unchecked':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.checked === false`;
        break;
      case 'enabled':
        code = `!document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.disabled`;
        break;
      case 'disabled':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.disabled === true`;
        break;
      case 'focused':
        code = `document.evaluate("${sel}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue === document.activeElement`;
        break;
      case 'count':
        code = `document.querySelectorAll("${opts.selector}").length === ${opts.expected}`;
        break;
      case 'custom':
        code = opts.customCode ?? 'true';
        break;
      default:
        throw new Error(`Unknown assertion type: ${opts.type}`);
    }

    const result = await runtimeAgent.invoke_evaluate({
      expression: code,
      returnByValue: true,
    });

    if (result.result?.value !== true) {
      throw new Error(`Assertion failed: ${opts.type}${opts.expected ? ` (expected: ${opts.expected})` : ''}`);
    }
  }

  private async executeSwitchToFrame(
    target: SDK.Target.Target,
    opts: NonNullable<CDPCommand['switchToFrame']>
  ): Promise<void> {
    const pageAgent = target.pageAgent();
    const frameTreeResult = await pageAgent.invoke_getFrameTree();

    // Find the frame
    const findFrame = (
      frame: Protocol.Page.FrameTree,
      index: number
    ): Protocol.Page.Frame | null => {
      if (opts.index !== undefined && index === opts.index) {
        return frame.frame;
      }
      // TODO: Add selector/xpath matching for frames
      for (const child of frame.childFrames ?? []) {
        const found = findFrame(child, index + 1);
        if (found) {
          return found;
        }
      }
      return null;
    };

    const frame = findFrame(frameTreeResult.frameTree, 0);
    if (frame) {
      this.currentFrameId = frame.id;
    } else {
      throw new Error('Frame not found');
    }
  }

  private async executeSetInputFiles(
    target: SDK.Target.Target,
    xpath: string,
    files: string[]
  ): Promise<void> {
    const domAgent = target.domAgent();
    const objectId = await this.resolveElement(target, xpath);

    // Get backend node ID
    const nodeResponse = await domAgent.invoke_describeNode({ objectId });
    if (!nodeResponse.node?.backendNodeId) {
      throw new Error('Could not get backend node ID for file input');
    }

    await domAgent.invoke_setFileInputFiles({
      files,
      backendNodeId: nodeResponse.node.backendNodeId as Protocol.DOM.BackendNodeId,
    });
  }

  private async executeHandleDialog(
    target: SDK.Target.Target,
    opts: NonNullable<CDPCommand['handleDialog']>
  ): Promise<void> {
    const pageAgent = target.pageAgent();
    await pageAgent.invoke_handleJavaScriptDialog({
      accept: opts.action === 'accept',
      promptText: opts.promptText,
    });
  }

  private async executeEvaluate(
    target: SDK.Target.Target,
    code: string
  ): Promise<unknown> {
    const runtimeAgent = target.runtimeAgent();
    const result = await runtimeAgent.invoke_evaluate({
      expression: code,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  // =============== HELPER METHODS ===============

  private getTarget(): SDK.Target.Target {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      throw new Error('No primary page target available');
    }
    return target;
  }

  private async resolveElement(
    target: SDK.Target.Target,
    xpath: string
  ): Promise<Protocol.Runtime.RemoteObjectId> {
    const runtimeAgent = target.runtimeAgent();

    const result = await runtimeAgent.invoke_evaluate({
      expression: `
        (function() {
          const result = document.evaluate("${this.escapeString(xpath)}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return result.singleNodeValue;
        })()
      `,
      returnByValue: false,
    });

    if (!result.result?.objectId) {
      throw new Error(`Element not found: ${xpath}`);
    }

    return result.result.objectId as Protocol.Runtime.RemoteObjectId;
  }

  private async getElementCenter(
    target: SDK.Target.Target,
    objectId: Protocol.Runtime.RemoteObjectId
  ): Promise<{ x: number; y: number }> {
    const domAgent = target.domAgent();

    const nodeResponse = await domAgent.invoke_describeNode({ objectId });
    if (!nodeResponse.node?.backendNodeId) {
      throw new Error('Could not get backend node ID');
    }

    const boxModel = await domAgent.invoke_getBoxModel({
      backendNodeId: nodeResponse.node.backendNodeId as Protocol.DOM.BackendNodeId,
    });

    if (!boxModel.model) {
      throw new Error('Could not get box model');
    }

    const quad = boxModel.model.content;
    return {
      x: (quad[0] + quad[2] + quad[4] + quad[6]) / 4,
      y: (quad[1] + quad[3] + quad[5] + quad[7]) / 4,
    };
  }

  private selectorToXPath(selector?: string, text?: string): string {
    if (selector) {
      if (selector.startsWith('#')) {
        return `//*[@id="${selector.slice(1)}"]`;
      }
      if (selector.startsWith('.')) {
        return `//*[contains(@class, "${selector.slice(1)}")]`;
      }
      if (selector.includes('[')) {
        // Basic attribute selector conversion
        return `//${selector.replace(/\[([^\]]+)]/g, '[@$1]')}`;
      }
      return `//${selector}`;
    }
    if (text) {
      return `//*[contains(text(), "${this.escapeString(text)}")]`;
    }
    throw new Error('No selector or text provided');
  }

  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private async waitForPageLoad(
    target: SDK.Target.Target,
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle'
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();

    if (waitUntil === 'networkidle') {
      // Wait for network to be idle (no requests for 500ms)
      await this.sleep(500);
      // Simple implementation - could be enhanced with network monitoring
    } else {
      await runtimeAgent.invoke_evaluate({
        expression: `
          new Promise(resolve => {
            if (document.readyState === '${waitUntil === 'load' ? 'complete' : 'interactive'}') {
              resolve(true);
            } else {
              window.addEventListener('${waitUntil}', () => resolve(true), { once: true });
            }
          })
        `,
        awaitPromise: true,
        returnByValue: true,
      });
    }
  }

  private async waitForSelector(
    target: SDK.Target.Target,
    selector: string,
    timeout: number
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const xpath = this.selectorToXPath(selector);
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
      const result = await runtimeAgent.invoke_evaluate({
        expression: `!!document.evaluate("${this.escapeString(xpath)}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`,
        returnByValue: true,
      });
      if (result.result?.value === true) {
        return;
      }
      await this.sleep(100);
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  private async waitForHidden(
    target: SDK.Target.Target,
    selector: string,
    timeout: number
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const xpath = this.selectorToXPath(selector);
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
      const result = await runtimeAgent.invoke_evaluate({
        expression: `!document.evaluate("${this.escapeString(xpath)}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.offsetParent`,
        returnByValue: true,
      });
      if (result.result?.value === true) {
        return;
      }
      await this.sleep(100);
    }
    throw new Error(`Timeout waiting for element to be hidden: ${selector}`);
  }

  private async waitForFunction(
    target: SDK.Target.Target,
    predicate: string,
    timeout: number
  ): Promise<void> {
    const runtimeAgent = target.runtimeAgent();
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
      const result = await runtimeAgent.invoke_evaluate({
        expression: predicate,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.result?.value) {
        return;
      }
      await this.sleep(100);
    }
    throw new Error(`Timeout waiting for function: ${predicate}`);
  }

  private async captureScreenshot(fullPage?: boolean): Promise<string> {
    const target = this.getTarget();
    const pageAgent = target.pageAgent();

    const result = await pageAgent.invoke_captureScreenshot({
      format: 'png' as Protocol.Page.CaptureScreenshotRequestFormat,
      captureBeyondViewport: fullPage ?? false,
    });

    return `data:image/png;base64,${result.data}`;
  }

  private async captureEnvironment(): Promise<StoredTestRun['environment']> {
    try {
      const target = this.getTarget();
      const runtimeAgent = target.runtimeAgent();

      const result = await runtimeAgent.invoke_evaluate({
        expression: `({
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        })`,
        returnByValue: true,
      });

      return result.result?.value as StoredTestRun['environment'];
    } catch {
      return undefined;
    }
  }

  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Abort the current test execution
   */
  abort(): void {
    this.aborted = true;
  }
}
