// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { WorkflowVisualizer } from '../WorkflowVisualizer.js';
import type { GraphConfig } from '../../core/ConfigurableGraph.js';
import { RenderWebAppTool } from '../../tools/RenderWebAppTool.js';
import type { RenderWebAppResult } from '../../tools/RenderWebAppTool.js';

describe('WorkflowVisualizer', () => {
  let renderWebAppToolStub: sinon.SinonStub;
  let mockGraphConfig: GraphConfig;

  beforeEach(() => {
    // Create mock GraphConfig
    mockGraphConfig = {
      name: 'test-graph',
      entryPoint: 'agent',
      nodes: [
        { name: 'agent', type: 'agent' },
        { name: 'toolExecutor', type: 'toolExecutor' },
        { name: 'final', type: 'final' },
      ],
      edges: [
        {
          source: 'agent',
          conditionType: 'routeBasedOnLastMessage',
          targetMap: {
            agent: 'agent',
            toolExecutor: 'toolExecutor',
            final: 'final',
          },
        },
      ],
    };

    // Stub RenderWebAppTool.prototype.execute
    renderWebAppToolStub = sinon.stub(RenderWebAppTool.prototype, 'execute');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('show', () => {
    it('should call RenderWebAppTool with correct structure', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      assert.isTrue(renderWebAppToolStub.calledOnce);

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      assert.isDefined(callArgs.html);
      assert.isDefined(callArgs.css);
      assert.isDefined(callArgs.js);
      assert.isDefined(callArgs.reasoning);
    });

    it('should include CDN script tags for React and XYFlow in JS', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      // Should include CDN URLs
      assert.include(jsCode, 'unpkg.com/react@18.2.0');
      assert.include(jsCode, 'unpkg.com/react-dom@18.2.0');
      assert.include(jsCode, '@xyflow/react');

      // Should reference window.ReactFlow global
      assert.include(jsCode, 'window.ReactFlow');
    });

    it('should include XYFlow CSS in the CSS parameter', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const cssCode = callArgs.css;

      // Should include XYFlow CSS URL or import
      assert.include(cssCode, '@xyflow/react');
    });

    it('should return success result from RenderWebAppTool', async () => {
      const expectedResult: RenderWebAppResult = {
        success: true,
        webappId: 'test-webapp-456',
        message: 'Webapp rendered successfully',
      };

      renderWebAppToolStub.resolves(expectedResult);

      const result = await WorkflowVisualizer.show(mockGraphConfig);

      assert.isTrue(result.success);
      assert.strictEqual(result.webappId, 'test-webapp-456');
    });

    it('should handle RenderWebAppTool errors', async () => {
      renderWebAppToolStub.resolves({
        error: 'Failed to render webapp',
      });

      const result = await WorkflowVisualizer.show(mockGraphConfig);

      assert.isFalse(result.success);
      assert.isDefined(result.error);
    });

    it('should apply readonly option when specified', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig, { readonly: true });

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      // Should include readonly configuration in JS
      assert.include(jsCode, 'nodesDraggable');
      assert.include(jsCode, 'nodesConnectable');
      assert.include(jsCode, 'elementsSelectable');
    });

    it('should apply showMiniMap option when specified', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig, { showMiniMap: true });

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      // Should render MiniMap component
      assert.include(jsCode, 'MiniMap');
    });

    it('should apply showControls option when specified', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig, { showControls: true });

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      // Should render Controls component
      assert.include(jsCode, 'Controls');
    });

    it('should apply fitView option when specified', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig, { fitView: true });

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      // Should include fitView option
      assert.include(jsCode, 'fitView');
    });

    it('should apply all options together', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig, {
        readonly: true,
        showMiniMap: true,
        showControls: true,
        fitView: true,
      });

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      assert.include(jsCode, 'nodesDraggable');
      assert.include(jsCode, 'MiniMap');
      assert.include(jsCode, 'Controls');
      assert.include(jsCode, 'fitView');
    });

    it('should create root div for React rendering in HTML', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const htmlCode = callArgs.html;

      // Should have root div for React
      assert.include(htmlCode, 'id="root"');
    });

    it('should include reasoning in the call', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      const callArgs = renderWebAppToolStub.firstCall.args[0];

      assert.isDefined(callArgs.reasoning);
      assert.isString(callArgs.reasoning);
      assert.isAbove(callArgs.reasoning.length, 0);
    });

    it('should handle empty graph config', async () => {
      const emptyConfig: GraphConfig = {
        name: 'empty',
        entryPoint: 'none',
        nodes: [],
        edges: [],
      };

      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      const result = await WorkflowVisualizer.show(emptyConfig);

      assert.isTrue(result.success);
      assert.isTrue(renderWebAppToolStub.calledOnce);
    });

    it('should convert graph to XYFlow format before rendering', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const jsCode = callArgs.js;

      // Should include nodes and edges data in JS
      assert.include(jsCode, 'nodes');
      assert.include(jsCode, 'edges');

      // Should reference node names from config
      assert.include(jsCode, 'agent');
      assert.include(jsCode, 'toolExecutor');
      assert.include(jsCode, 'final');
    });

    it('should style nodes with primary color', async () => {
      renderWebAppToolStub.resolves({
        success: true,
        webappId: 'test-webapp-123',
        message: 'Webapp rendered successfully',
      } as RenderWebAppResult);

      await WorkflowVisualizer.show(mockGraphConfig);

      const callArgs = renderWebAppToolStub.firstCall.args[0];
      const cssCode = callArgs.css;

      // Should include primary color styling
      assert.include(cssCode, '#00a4fe');
    });

    it('should handle exceptions during visualization', async () => {
      renderWebAppToolStub.rejects(new Error('Network error'));

      try {
        await WorkflowVisualizer.show(mockGraphConfig);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.instanceOf(error, Error);
        assert.include((error as Error).message, 'Network error');
      }
    });
  });
});
