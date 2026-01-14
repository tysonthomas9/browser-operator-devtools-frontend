// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../../core/sdk/sdk.js';
import {RenderWebAppTool} from '../RenderWebAppTool.js';

describe('RenderWebAppTool', () => {
  afterEach(() => {
    sinon.restore();
  });

  /**
   * Create a mock target with pageAgent and runtimeAgent
   */
  function createMockTarget() {
    return {
      pageAgent: () => ({
        invoke_navigate: sinon.stub().resolves({getError: () => null}),
      }),
      runtimeAgent: () => ({
        invoke_evaluate: sinon.stub().resolves({
          result: {
            value: {
              success: true,
              webappId: 'test-webapp-123',
              message: 'Webapp rendered successfully',
            },
          },
        }),
      }),
    };
  }

  describe('target availability', () => {
    it('succeeds immediately when target is available', async () => {
      const mockTarget = createMockTarget();
      sinon.stub(SDK.TargetManager.TargetManager, 'instance').returns({
        primaryPageTarget: () => mockTarget,
      } as unknown as SDK.TargetManager.TargetManager);

      const startTime = Date.now();
      const tool = new RenderWebAppTool();
      const result = await tool.execute({html: '<div>test</div>', reasoning: 'test'});
      const elapsed = Date.now() - startTime;

      assert.strictEqual((result as {success: boolean}).success, true);
      // Should complete quickly without any retry delays
      assert.isBelow(elapsed, 500, 'Should complete without retry delays when target available');
    });

    it('returns error when target never becomes available', async function() {
      // Increase timeout since retry logic waits 5s total
      this.timeout(10000);

      sinon.stub(SDK.TargetManager.TargetManager, 'instance').returns({
        primaryPageTarget: () => null,
      } as unknown as SDK.TargetManager.TargetManager);

      const tool = new RenderWebAppTool();
      const result = await tool.execute({html: '<div>test</div>', reasoning: 'test'});

      assert.strictEqual((result as {error: string}).error,
        'No page target available. DevTools may not be fully connected to the inspected page.');
    });
  });

  describe('retry logic', () => {
    it('completes quickly when target becomes available on first retry', async () => {
      // Verifies check-before-wait logic: first check at ~0ms, second check immediately
      // after first loop iteration (before waiting), so total should be <100ms

      const mockTarget = createMockTarget();
      const primaryPageTargetStub = sinon.stub();
      primaryPageTargetStub.onCall(0).returns(null);       // First call: no target
      primaryPageTargetStub.onCall(1).returns(mockTarget); // Second call: target available

      sinon.stub(SDK.TargetManager.TargetManager, 'instance').returns({
        primaryPageTarget: primaryPageTargetStub,
      } as unknown as SDK.TargetManager.TargetManager);

      const startTime = Date.now();
      const tool = new RenderWebAppTool();
      const result = await tool.execute({html: '<div>test</div>', reasoning: 'test'});
      const elapsed = Date.now() - startTime;

      assert.strictEqual((result as {success: boolean}).success, true);

      // Should complete quickly because we check BEFORE waiting
      // First check fails, loop starts, immediate second check succeeds (0ms wait)
      // The rest of execute() (navigation, evaluation) adds ~300ms overhead
      // Old buggy code would wait 500ms+ just for the retry, so < 400ms proves fix works
      assert.isBelow(elapsed, 400, 'Should complete quickly with check-before-wait logic');
    });
  });
});
