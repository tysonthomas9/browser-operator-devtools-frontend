// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { RenderWebAppTool } from '../tools/RenderWebAppTool.js';
import { convertGraphConfigToXYFlow } from '../core/GraphConverter.js';
import type { GraphConfig } from '../core/ConfigurableGraph.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('WorkflowVisualizer');

export interface WorkflowVisualizerOptions {
  readonly?: boolean;
  showMiniMap?: boolean;
  showControls?: boolean;
  fitView?: boolean;
}

/**
 * WorkflowVisualizer - Renders interactive workflow graphs using XYFlow
 *
 * Uses RenderWebAppTool to create an isolated iframe with React + XYFlow
 * loaded from CDN for zero build system dependencies.
 */
export class WorkflowVisualizer {
  /**
   * Display workflow graph in full-screen visualization
   */
  static async show(
    graphConfig: GraphConfig,
    options: WorkflowVisualizerOptions = {}
  ): Promise<{ success: boolean; webappId?: string; error?: string }> {
    try {
      logger.info('Rendering workflow visualization', {
        nodeCount: graphConfig.nodes.length,
        edgeCount: graphConfig.edges.length,
        options
      });

      // Convert graph config to XYFlow format
      const xyflowData = convertGraphConfigToXYFlow(graphConfig);

      // Build visualization HTML/CSS/JS
      const html = this.buildHTML(options);
      const css = this.buildCSS();
      const js = this.buildJS(xyflowData, options);

      // Render using existing tool
      const tool = new RenderWebAppTool();
      const result = await tool.execute({
        html,
        css,
        js,
        reasoning: `Visualize workflow graph: ${graphConfig.name || 'Unnamed Graph'}`
      });

      if ('error' in result) {
        logger.error('Failed to render workflow visualization', result.error);
        return { success: false, error: result.error };
      }

      logger.info('Successfully rendered workflow visualization', {
        webappId: result.webappId
      });

      return {
        success: true,
        webappId: result.webappId
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error rendering workflow visualization', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Build HTML structure for visualization
   */
  private static buildHTML(_options: WorkflowVisualizerOptions): string {
    return `
<!-- Header -->
<div class="visualizer-header">
  <div class="header-content">
    <div class="header-title">
      <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
      <h1>Workflow Graph</h1>
    </div>
    <div class="header-actions">
      <button id="reset-view-btn" class="action-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        Reset View
      </button>
      <button id="close-btn" class="action-btn close-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Close
      </button>
    </div>
  </div>
</div>

<!-- React Flow Container -->
<div id="react-flow-wrapper" style="width: 100vw; height: calc(100vh - 60px);"></div>

<!-- Loading Indicator -->
<div id="loading-indicator" class="loading-indicator">
  <div class="spinner"></div>
  <p>Loading visualization...</p>
</div>

<!-- Node Details Panel (appears on node click) -->
<div id="node-details-panel" class="node-details-panel hidden">
  <div class="panel-header">
    <h3>Node Details</h3>
    <button id="close-panel-btn" class="close-panel-btn">×</button>
  </div>
  <div class="panel-content">
    <div class="detail-row">
      <span class="detail-label">Name:</span>
      <span id="node-name" class="detail-value"></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Type:</span>
      <span id="node-type" class="detail-value"></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Description:</span>
      <span id="node-description" class="detail-value"></span>
    </div>
  </div>
</div>`;
  }

  /**
   * Build CSS styles for visualization
   */
  private static buildCSS(): string {
    return `
/* ========================================
   WORKFLOW VISUALIZER STYLES
   ======================================== */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif;
  background: #f9fafb;
  color: #111827;
  overflow: hidden;
}

/* Header */
.visualizer-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 24px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 24px;
  height: 24px;
  color: #00a4fe;
}

.header-title h1 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.close-btn {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.close-btn:hover {
  background: #dc2626;
  border-color: #dc2626;
}

/* Loading Indicator */
.loading-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 2000;
}

.loading-indicator.hidden {
  display: none;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #00a4fe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-indicator p {
  font-size: 14px;
  color: #6b7280;
}

/* Node Details Panel */
.node-details-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 320px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1001;
  transition: transform 0.3s ease;
}

.node-details-panel.hidden {
  transform: translateX(400px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 8px 8px 0 0;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.close-panel-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-panel-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.panel-content {
  padding: 16px;
}

.detail-row {
  margin-bottom: 12px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.detail-value {
  display: block;
  font-size: 14px;
  color: #111827;
}

/* React Flow Overrides */
.react-flow {
  background: #fafafa;
}

.react-flow__node {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.react-flow__edge-path {
  stroke-width: 2px;
}

.react-flow__handle {
  width: 8px;
  height: 8px;
  background: #6b7280;
  border: 2px solid white;
}

/* Custom Node Styles */
.react-flow__node-agentNode {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border: 2px solid #0284c7;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);
}

.react-flow__node-toolNode {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.react-flow__node-finalNode {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border: 2px solid #16a34a;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }

  .header-title h1 {
    font-size: 16px;
  }

  .action-btn {
    padding: 6px 12px;
    font-size: 13px;
  }

  .node-details-panel {
    width: calc(100vw - 40px);
    right: 20px;
  }
}`;
  }

  /**
   * Build JavaScript for XYFlow initialization and interaction
   */
  private static buildJS(
    xyflowData: { nodes: any[]; edges: any[] },
    options: WorkflowVisualizerOptions
  ): string {
    const defaultOptions = {
      readonly: true,
      showMiniMap: true,
      showControls: true,
      fitView: true,
      ...options
    };

    return `
(function() {
  'use strict';

  console.log('[WorkflowVisualizer] Initializing...');

  // Configuration
  const GRAPH_DATA = ${JSON.stringify(xyflowData)};
  const OPTIONS = ${JSON.stringify(defaultOptions)};

  // CDN URLs
  const CDN_URLS = {
    react: 'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
    reactDOM: 'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
    xyflow: 'https://cdn.jsdelivr.net/npm/@xyflow/react@12.8.6/dist/umd/index.js',
    xyflowCSS: 'https://cdn.jsdelivr.net/npm/@xyflow/react@12.8.6/dist/style.css'
  };

  /**
   * Load script from CDN
   */
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        console.log('[WorkflowVisualizer] Loaded:', url);
        resolve();
      };
      script.onerror = () => {
        console.error('[WorkflowVisualizer] Failed to load:', url);
        reject(new Error('Failed to load script: ' + url));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load CSS from CDN
   */
  function loadCSS(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.crossOrigin = 'anonymous';
      link.onload = () => {
        console.log('[WorkflowVisualizer] Loaded CSS:', url);
        resolve();
      };
      link.onerror = () => {
        console.error('[WorkflowVisualizer] Failed to load CSS:', url);
        reject(new Error('Failed to load CSS: ' + url));
      };
      document.head.appendChild(link);
    });
  }

  /**
   * Initialize React Flow after dependencies loaded
   */
  function initializeReactFlow() {
    console.log('[WorkflowVisualizer] Initializing React Flow...');

    const { createElement: h, useState, useCallback } = window.React;
    const { createRoot } = window.ReactDOM;
    const { ReactFlow, Background, Controls, MiniMap } = window.ReactFlow;

    // React Flow Component
    function WorkflowGraph() {
      const [nodes, setNodes] = useState(GRAPH_DATA.nodes);
      const [edges, setEdges] = useState(GRAPH_DATA.edges);
      const [selectedNode, setSelectedNode] = useState(null);

      // Handle node click
      const onNodeClick = useCallback((event, node) => {
        console.log('[WorkflowVisualizer] Node clicked:', node.id);
        setSelectedNode(node);
        showNodeDetails(node);
      }, []);

      // Handle pane click (deselect)
      const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        hideNodeDetails();
      }, []);

      return h(ReactFlow, {
        nodes: nodes,
        edges: edges,
        onNodeClick: onNodeClick,
        onPaneClick: onPaneClick,
        fitView: OPTIONS.fitView,
        attributionPosition: 'bottom-left',
        defaultViewport: { x: 0, y: 0, zoom: 1 },
        minZoom: 0.1,
        maxZoom: 2,
        nodesDraggable: !OPTIONS.readonly,
        nodesConnectable: !OPTIONS.readonly,
        elementsSelectable: true
      },
        OPTIONS.showControls ? h(Controls) : null,
        OPTIONS.showMiniMap ? h(MiniMap, {
          nodeColor: (node) => {
            switch (node.type) {
              case 'agentNode': return '#0284c7';
              case 'toolNode': return '#f59e0b';
              case 'finalNode': return '#16a34a';
              default: return '#6b7280';
            }
          },
          maskColor: 'rgba(0, 0, 0, 0.1)'
        }) : null,
        h(Background, { color: '#e5e7eb', gap: 16 })
      );
    }

    // Render
    const root = createRoot(document.getElementById('react-flow-wrapper'));
    root.render(h(WorkflowGraph));

    // Hide loading indicator
    document.getElementById('loading-indicator').classList.add('hidden');

    console.log('[WorkflowVisualizer] React Flow initialized successfully');
  }

  /**
   * Show node details panel
   */
  function showNodeDetails(node) {
    const panel = document.getElementById('node-details-panel');
    const nodeName = document.getElementById('node-name');
    const nodeType = document.getElementById('node-type');
    const nodeDescription = document.getElementById('node-description');

    nodeName.textContent = node.data.label || node.id;
    nodeType.textContent = node.data.nodeType || 'Unknown';
    nodeDescription.textContent = node.data.description || 'No description available';

    panel.classList.remove('hidden');

    // Store selected node for external access
    document.body.setAttribute('data-selected-node-id', node.id);
    document.body.setAttribute('data-selected-node-data', JSON.stringify(node.data));
  }

  /**
   * Hide node details panel
   */
  function hideNodeDetails() {
    const panel = document.getElementById('node-details-panel');
    panel.classList.add('hidden');

    document.body.removeAttribute('data-selected-node-id');
    document.body.removeAttribute('data-selected-node-data');
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Close button
    document.getElementById('close-btn').addEventListener('click', () => {
      console.log('[WorkflowVisualizer] Closing visualization');
      const iframe = window.frameElement;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    });

    // Reset view button
    document.getElementById('reset-view-btn').addEventListener('click', () => {
      console.log('[WorkflowVisualizer] Resetting view');
      window.location.reload();
    });

    // Close panel button
    document.getElementById('close-panel-btn').addEventListener('click', () => {
      hideNodeDetails();
    });
  }

  /**
   * Main initialization
   */
  async function initialize() {
    try {
      console.log('[WorkflowVisualizer] Loading dependencies from CDN...');

      // Load dependencies in sequence
      await loadCSS(CDN_URLS.xyflowCSS);
      await loadScript(CDN_URLS.react);
      await loadScript(CDN_URLS.reactDOM);
      await loadScript(CDN_URLS.xyflow);

      // Check if libraries loaded
      if (!window.React || !window.ReactDOM || !window.ReactFlow) {
        throw new Error('Required libraries not loaded. Check: ' +
          JSON.stringify({
            React: !!window.React,
            ReactDOM: !!window.ReactDOM,
            ReactFlow: !!window.ReactFlow
          })
        );
      }

      console.log('[WorkflowVisualizer] All dependencies loaded successfully');

      // Setup UI
      setupEventListeners();

      // Initialize React Flow
      initializeReactFlow();

    } catch (error) {
      console.error('[WorkflowVisualizer] Initialization failed:', error);

      // Show error to user
      const loadingIndicator = document.getElementById('loading-indicator');
      loadingIndicator.innerHTML =
        '<p style="color: #ef4444; font-weight: 600;">Failed to load visualization</p>' +
        '<p style="color: #6b7280; font-size: 12px; margin-top: 8px;">' + error.message + '</p>' +
        '<button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #00a4fe; color: white; border: none; border-radius: 6px; cursor: pointer;">Retry</button>';
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();`;
  }
}
