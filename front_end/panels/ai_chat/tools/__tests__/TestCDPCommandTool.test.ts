// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {TestCDPCommandTool} from '../TestCDPCommandTool.js';

describe('ai_chat: TestCDPCommandTool', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('inferStepType', () => {
    let tool: TestCDPCommandTool;

    beforeEach(() => {
      tool = new TestCDPCommandTool();
    });

    it('returns navigate for navigate commands', () => {
      const result = (tool as any).inferStepType({navigate: {url: 'https://example.com'}});
      assert.strictEqual(result, 'navigate');
    });

    it('returns click for click commands', () => {
      const result = (tool as any).inferStepType({click: {xpath: '//button'}});
      assert.strictEqual(result, 'click');
    });

    it('returns fill for fill commands', () => {
      const result = (tool as any).inferStepType({fill: {xpath: '//input', value: 'test'}});
      assert.strictEqual(result, 'fill');
    });

    it('returns type for type commands', () => {
      const result = (tool as any).inferStepType({type: {xpath: '//input', value: 'test'}});
      assert.strictEqual(result, 'type');
    });

    it('returns press for press commands', () => {
      const result = (tool as any).inferStepType({press: {key: 'Enter'}});
      assert.strictEqual(result, 'press');
    });

    it('returns hover for hover commands', () => {
      const result = (tool as any).inferStepType({hover: {xpath: '//button'}});
      assert.strictEqual(result, 'hover');
    });

    it('returns scroll for scroll commands', () => {
      const result = (tool as any).inferStepType({scroll: {direction: 'down'}});
      assert.strictEqual(result, 'scroll');
    });

    it('returns scroll for scrollIntoView commands', () => {
      const result = (tool as any).inferStepType({scrollIntoView: {xpath: '//div'}});
      assert.strictEqual(result, 'scroll');
    });

    it('returns wait for wait commands', () => {
      const result = (tool as any).inferStepType({wait: {type: 'load'}});
      assert.strictEqual(result, 'wait');
    });

    it('returns assert for assert commands', () => {
      const result = (tool as any).inferStepType({assert: {type: 'visible', selector: '#btn'}});
      assert.strictEqual(result, 'assert');
    });

    it('returns screenshot for screenshot commands', () => {
      const result = (tool as any).inferStepType({screenshot: {fullPage: true}});
      assert.strictEqual(result, 'screenshot');
    });

    it('returns clear for clear commands', () => {
      const result = (tool as any).inferStepType({clear: {xpath: '//input'}});
      assert.strictEqual(result, 'clear');
    });

    it('returns check for check commands', () => {
      const result = (tool as any).inferStepType({check: {xpath: '//input[@type="checkbox"]'}});
      assert.strictEqual(result, 'check');
    });

    it('returns check for uncheck commands', () => {
      const result = (tool as any).inferStepType({uncheck: {xpath: '//input[@type="checkbox"]'}});
      assert.strictEqual(result, 'check');
    });

    it('returns check for setChecked commands', () => {
      const result = (tool as any).inferStepType({setChecked: {xpath: '//input', checked: true}});
      assert.strictEqual(result, 'check');
    });

    it('returns selectOption for selectOption commands', () => {
      const result = (tool as any).inferStepType({selectOption: {xpath: '//select', value: 'opt1'}});
      assert.strictEqual(result, 'selectOption');
    });

    it('returns switchFrame for switchToFrame commands', () => {
      const result = (tool as any).inferStepType({switchToFrame: {selector: 'iframe'}});
      assert.strictEqual(result, 'switchFrame');
    });

    it('returns switchFrame for switchToMainFrame commands', () => {
      const result = (tool as any).inferStepType({switchToMainFrame: {}});
      assert.strictEqual(result, 'switchFrame');
    });

    it('returns fileUpload for setInputFiles commands', () => {
      const result = (tool as any).inferStepType({setInputFiles: {xpath: '//input', files: []}});
      assert.strictEqual(result, 'fileUpload');
    });

    it('returns dialog for handleDialog commands', () => {
      const result = (tool as any).inferStepType({handleDialog: {action: 'accept'}});
      assert.strictEqual(result, 'dialog');
    });

    it('returns evaluate for unknown commands', () => {
      const result = (tool as any).inferStepType({evaluate: {code: 'return 1'}});
      assert.strictEqual(result, 'evaluate');
    });

    it('returns evaluate for empty commands', () => {
      const result = (tool as any).inferStepType({});
      assert.strictEqual(result, 'evaluate');
    });
  });

  describe('getSuggestion', () => {
    let tool: TestCDPCommandTool;

    beforeEach(() => {
      tool = new TestCDPCommandTool();
    });

    it('suggests selector fixes for element not found errors', () => {
      const suggestion = (tool as any).getSuggestion('Element not found: //button', {click: {}});
      assert.include(suggestion, 'Element not found');
      assert.include(suggestion, 'selector');
    });

    it('suggests selector fixes for no element errors', () => {
      const suggestion = (tool as any).getSuggestion('No element matching selector', {click: {}});
      assert.include(suggestion, 'Element not found');
    });

    it('suggests selector fixes for no such element errors', () => {
      const suggestion = (tool as any).getSuggestion('no such element', {click: {}});
      assert.include(suggestion, 'Element not found');
    });

    it('suggests wait/timeout fixes for timeout errors', () => {
      const suggestion = (tool as any).getSuggestion('Operation timed out', {click: {}});
      assert.include(suggestion, 'timed out');
      assert.include(suggestion, 'wait');
    });

    it('suggests visibility fixes for not visible errors', () => {
      const suggestion = (tool as any).getSuggestion('Element is not visible', {click: {}});
      assert.include(suggestion, 'not visible');
      assert.include(suggestion, 'Scroll');
    });

    it('suggests visibility fixes for hidden errors', () => {
      const suggestion = (tool as any).getSuggestion('Element is hidden', {click: {}});
      assert.include(suggestion, 'not visible');
    });

    it('suggests interactability fixes for not interactable errors', () => {
      const suggestion = (tool as any).getSuggestion('Element is not interactable', {click: {}});
      assert.include(suggestion, 'not interactable');
      assert.include(suggestion, 'animation');
    });

    it('suggests interactability fixes for cannot click errors', () => {
      const suggestion = (tool as any).getSuggestion('Cannot click element', {click: {}});
      assert.include(suggestion, 'not interactable');
    });

    it('suggests navigation fixes for navigation errors', () => {
      const suggestion = (tool as any).getSuggestion('Navigation failed', {navigate: {}});
      assert.include(suggestion, 'Navigation failed');
      assert.include(suggestion, 'URL');
    });

    it('suggests assertion fixes for assertion errors', () => {
      const suggestion = (tool as any).getSuggestion('Assertion failed: expected true', {assert: {}});
      assert.include(suggestion, 'Assertion failed');
    });

    it('suggests frame fixes for frame errors', () => {
      const suggestion = (tool as any).getSuggestion('Frame not found', {switchToFrame: {}});
      assert.include(suggestion, 'Frame error');
    });

    it('suggests frame fixes for iframe errors', () => {
      const suggestion = (tool as any).getSuggestion('Cannot find iframe', {switchToFrame: {}});
      assert.include(suggestion, 'Frame error');
    });

    it('returns generic suggestion for unknown errors', () => {
      const suggestion = (tool as any).getSuggestion('Some unknown error', {click: {}});
      assert.include(suggestion, 'Command failed');
    });
  });

  describe('execute', () => {
    it('returns success when step passes', async () => {
      const fakeExecutor = {
        executeStep: sinon.stub().resolves({
          stepId: 'test-1',
          status: 'passed',
          duration: 100,
        }),
      };

      const tool = new TestCDPCommandTool();
      (tool as any).executor = fakeExecutor;

      const result = await tool.execute({
        cdpCommand: {click: {xpath: '//button'}},
        description: 'Click button',
      });

      assert.isTrue(result.success);
      assert.strictEqual(result.status, 'passed');
      assert.strictEqual(result.duration, 100);
      assert.isUndefined(result.error);
      assert.isUndefined(result.suggestion);
    });

    it('returns failure with suggestion when step fails', async () => {
      const fakeExecutor = {
        executeStep: sinon.stub().resolves({
          stepId: 'test-1',
          status: 'failed',
          duration: 50,
          error: 'Element not found: //button',
          screenshot: 'base64screenshot',
        }),
      };

      const tool = new TestCDPCommandTool();
      (tool as any).executor = fakeExecutor;

      const result = await tool.execute({
        cdpCommand: {click: {xpath: '//button'}},
        description: 'Click button',
      });

      assert.isFalse(result.success);
      assert.strictEqual(result.status, 'failed');
      assert.strictEqual(result.error, 'Element not found: //button');
      assert.strictEqual(result.screenshot, 'base64screenshot');
      assert.isString(result.suggestion);
      assert.include(result.suggestion, 'Element not found');
    });

    it('handles exceptions during execution', async () => {
      const fakeExecutor = {
        executeStep: sinon.stub().rejects(new Error('Unexpected crash')),
      };

      const tool = new TestCDPCommandTool();
      (tool as any).executor = fakeExecutor;

      const result = await tool.execute({
        cdpCommand: {click: {xpath: '//button'}},
        description: 'Click button',
      });

      assert.isFalse(result.success);
      assert.strictEqual(result.status, 'failed');
      assert.strictEqual(result.error, 'Unexpected crash');
      assert.strictEqual(result.duration, 0);
      assert.isString(result.suggestion);
      assert.include(result.suggestion, 'unexpected error');
    });

    it('uses default timeout when not specified', async () => {
      const fakeExecutor = {
        executeStep: sinon.stub().resolves({
          stepId: 'test-1',
          status: 'passed',
          duration: 100,
        }),
      };

      const tool = new TestCDPCommandTool();
      (tool as any).executor = fakeExecutor;

      await tool.execute({
        cdpCommand: {click: {xpath: '//button'}},
        description: 'Click button',
      });

      const callArgs = fakeExecutor.executeStep.firstCall.args;
      assert.strictEqual(callArgs[0].timeout, 30000);
    });

    it('uses custom timeout when specified', async () => {
      const fakeExecutor = {
        executeStep: sinon.stub().resolves({
          stepId: 'test-1',
          status: 'passed',
          duration: 100,
        }),
      };

      const tool = new TestCDPCommandTool();
      (tool as any).executor = fakeExecutor;

      await tool.execute({
        cdpCommand: {click: {xpath: '//button'}},
        description: 'Click button',
        timeout: 5000,
      });

      const callArgs = fakeExecutor.executeStep.firstCall.args;
      assert.strictEqual(callArgs[0].timeout, 5000);
    });

    it('creates test step with correct type inference', async () => {
      const fakeExecutor = {
        executeStep: sinon.stub().resolves({
          stepId: 'test-1',
          status: 'passed',
          duration: 100,
        }),
      };

      const tool = new TestCDPCommandTool();
      (tool as any).executor = fakeExecutor;

      await tool.execute({
        cdpCommand: {navigate: {url: 'https://example.com'}},
        description: 'Navigate to example',
      });

      const callArgs = fakeExecutor.executeStep.firstCall.args;
      assert.strictEqual(callArgs[0].type, 'navigate');
      assert.strictEqual(callArgs[0].description, 'Navigate to example');
      assert.deepEqual(callArgs[0].cdpCommand, {navigate: {url: 'https://example.com'}});
    });
  });

  describe('schema', () => {
    it('has correct schema definition', () => {
      const tool = new TestCDPCommandTool();

      assert.strictEqual(tool.schema.type, 'object');
      assert.isObject(tool.schema.properties);
      assert.include(tool.schema.required, 'cdpCommand');
      assert.include(tool.schema.required, 'description');
      assert.notInclude(tool.schema.required, 'timeout');
    });
  });

  describe('metadata', () => {
    it('has correct name and description', () => {
      const tool = new TestCDPCommandTool();

      assert.strictEqual(tool.name, 'test_cdp_command');
      assert.isString(tool.description);
      assert.include(tool.description, 'CDP command');
    });
  });
});
