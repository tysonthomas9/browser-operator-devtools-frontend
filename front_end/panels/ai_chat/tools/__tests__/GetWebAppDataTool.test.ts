// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {GetWebAppDataTool, type GetWebAppDataResult} from '../GetWebAppDataTool.js';
import type {ErrorResult} from '../Tools.js';
import * as SDK from '../../../../core/sdk/sdk.js';

describe('GetWebAppDataTool', () => {
  let targetManager: SDK.TargetManager.TargetManager;
  let mockTarget: any;
  let mockRuntimeAgent: any;

  beforeEach(() => {
    targetManager = SDK.TargetManager.TargetManager.instance();

    // Create mock runtime agent
    mockRuntimeAgent = {
      invoke_evaluate: sinon.stub(),
    };

    // Create mock target
    mockTarget = {
      runtimeAgent: () => mockRuntimeAgent,
    };

    // Stub target manager to return our mock target
    sinon.stub(targetManager, 'primaryPageTarget').returns(mockTarget);
  });

  afterEach(() => {
    sinon.restore();
  });

  function assertSuccess(result: GetWebAppDataResult | ErrorResult): asserts result is GetWebAppDataResult {
    assert.strictEqual('success' in result, true);
    if ('success' in result) {
      assert.strictEqual(result.success, true);
    }
  }

  function assertError(result: GetWebAppDataResult | ErrorResult): asserts result is ErrorResult {
    assert.strictEqual('error' in result, true);
  }

  describe('checkbox aggregation', () => {
    it('should return empty array for unchecked checkbox group', async () => {
      // Simulate multiple unchecked checkboxes with same name
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              colors: [],  // No checkboxes checked
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing unchecked checkboxes',
      });

      assertSuccess(result);
      assert.deepEqual(result.formData.colors, []);
    });

    it('should return array with only checked values for checkbox group', async () => {
      // Simulate multiple checkboxes with some checked
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              colors: ['blue', 'green'],  // Only checked values
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing mixed checkboxes',
      });

      assertSuccess(result);
      assert.isArray(result.formData.colors);
      assert.deepEqual(result.formData.colors, ['blue', 'green']);
      // Should NOT contain false values
      assert.notInclude(result.formData.colors, false);
    });

    it('should return single value for single checked checkbox', async () => {
      // Single checkbox checked
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              subscribe: true,
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing single checkbox',
      });

      assertSuccess(result);
      assert.strictEqual(result.formData.subscribe, true);
    });

    it('should return empty array for single unchecked checkbox', async () => {
      // Single checkbox unchecked
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              subscribe: [],
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing single unchecked checkbox',
      });

      assertSuccess(result);
      assert.deepEqual(result.formData.subscribe, []);
    });

    it('should handle checkbox with custom values', async () => {
      // Checkboxes with value attributes
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              options: ['option1', 'option3'],
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing checkbox values',
      });

      assertSuccess(result);
      assert.deepEqual(result.formData.options, ['option1', 'option3']);
    });
  });

  describe('other form elements', () => {
    it('should extract text input values', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              name: 'John Doe',
              email: 'john@example.com',
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing text inputs',
      });

      assertSuccess(result);
      assert.strictEqual(result.formData.name, 'John Doe');
      assert.strictEqual(result.formData.email, 'john@example.com');
    });

    it('should extract radio button values', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              gender: 'male',
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing radio buttons',
      });

      assertSuccess(result);
      assert.strictEqual(result.formData.gender, 'male');
    });

    it('should extract select values', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              country: 'USA',
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing select',
      });

      assertSuccess(result);
      assert.strictEqual(result.formData.country, 'USA');
    });

    it('should extract multiple select values as array', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              languages: ['en', 'es', 'fr'],
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing multiple select',
      });

      assertSuccess(result);
      assert.isArray(result.formData.languages);
      assert.deepEqual(result.formData.languages, ['en', 'es', 'fr']);
    });

    it('should extract textarea values', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: true,
            formData: {
              comments: 'This is a comment',
            },
            message: 'Webapp data retrieved successfully',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing textarea',
      });

      assertSuccess(result);
      assert.strictEqual(result.formData.comments, 'This is a comment');
    });
  });

  describe('error handling', () => {
    it('should return error when no target available', async () => {
      sinon.restore();
      sinon.stub(targetManager, 'primaryPageTarget').returns(null);

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing no target',
      });

      assertError(result);
      assert.include(result.error, 'No page target available');
    });

    it('should return error when webappId is missing', async () => {
      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: '',
        reasoning: 'Testing',
      } as any);

      assertError(result);
      assert.include(result.error, 'webappId is required');
    });

    it('should return error when reasoning is missing', async () => {
      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: '',
      } as any);

      assertError(result);
      assert.include(result.error, 'Reasoning is required');
    });

    it('should return error when webapp iframe not found', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {
            success: false,
            error: 'Webapp iframe not found with ID: test-webapp',
          },
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing missing iframe',
      });

      assertError(result);
      assert.include(result.error, 'Webapp iframe not found');
    });

    it('should return error on evaluation exception', async () => {
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {value: null},
        exceptionDetails: {
          text: 'Script execution error',
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing exception',
      });

      assertError(result);
      assert.include(result.error, 'Script execution error');
    });
  });

  describe('waitForSubmit', () => {
    it('should wait for form submission when waitForSubmit is true', async () => {
      // First call - not submitted
      // Second call - submitted
      mockRuntimeAgent.invoke_evaluate
        .onFirstCall().resolves({
          result: {
            value: {found: true, submitted: false},
          },
        })
        .onSecondCall().resolves({
          result: {
            value: {found: true, submitted: true},
          },
        })
        .onThirdCall().resolves({
          result: {
            value: {
              success: true,
              formData: {name: 'Test'},
              message: 'Webapp data retrieved successfully',
            },
          },
        });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing wait for submit',
        waitForSubmit: true,
        timeout: 2000,
      });

      assertSuccess(result);
      assert.strictEqual(result.formData.name, 'Test');
    });

    it('should timeout when form not submitted within timeout', async () => {
      // Always return not submitted
      mockRuntimeAgent.invoke_evaluate.resolves({
        result: {
          value: {found: true, submitted: false},
        },
      });

      const tool = new GetWebAppDataTool();
      const result = await tool.execute({
        webappId: 'test-webapp',
        reasoning: 'Testing timeout',
        waitForSubmit: true,
        timeout: 1000,
      });

      assertError(result);
      assert.include(result.error, 'Timeout waiting for webapp form submission');
    });
  });
});
