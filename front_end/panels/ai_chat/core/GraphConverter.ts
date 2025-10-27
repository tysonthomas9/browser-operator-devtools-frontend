// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { GraphConfig, GraphNodeConfig, GraphEdgeConfig } from './ConfigurableGraph.js';

export interface XYFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: string;
    description?: string;
  };
  style?: Record<string, string>;
}

export interface XYFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, string>;
}

export interface XYFlowGraphData {
  nodes: XYFlowNode[];
  edges: XYFlowEdge[];
}

/**
 * Converts GraphConfig to XYFlow format with auto-layout
 */
export function convertGraphConfigToXYFlow(config: GraphConfig): XYFlowGraphData {
  // Build node map for efficient lookup
  const nodeMap = new Map<string, GraphNodeConfig>();
  config.nodes.forEach(node => nodeMap.set(node.name, node));

  // Calculate positions using simple hierarchical layout
  const positions = calculateNodePositions(config);

  // Convert nodes
  const nodes: XYFlowNode[] = config.nodes.map((node, index) => ({
    id: node.name,
    type: getXYFlowNodeType(node.type),
    position: positions.get(node.name) || { x: 0, y: index * 100 },
    data: {
      label: formatNodeLabel(node.name),
      nodeType: node.type,
      description: getNodeDescription(node)
    },
    style: getNodeStyle(node.type)
  }));

  // Convert edges - flatten targetMap into multiple edges
  const edges: XYFlowEdge[] = [];
  config.edges.forEach((edge, edgeIndex) => {
    // Create one XYFlow edge for each target in targetMap
    Object.entries(edge.targetMap).forEach(([condition, target], targetIndex) => {
      edges.push({
        id: `edge-${edgeIndex}-${targetIndex}`,
        source: edge.source,
        target: target,
        label: condition !== 'default' ? condition : '',
        type: edge.conditionType !== 'alwaysAgent' ? 'smoothstep' : 'default',
        animated: false,
        style: getEdgeStyle(edge, condition)
      });
    });
  });

  return { nodes, edges };
}

/**
 * Calculate node positions using hierarchical layout algorithm
 */
function calculateNodePositions(config: GraphConfig): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Build adjacency list from targetMap
  const adjacencyList = new Map<string, string[]>();
  config.edges.forEach(edge => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    // Add all targets from the targetMap
    Object.values(edge.targetMap).forEach(target => {
      if (target !== '__end__') {
        adjacencyList.get(edge.source)!.push(target);
      }
    });
  });

  // Topological sort to determine levels
  const levels = assignNodesToLevels(config.entryPoint, adjacencyList, config.nodes);

  // Position nodes based on levels
  const HORIZONTAL_SPACING = 250;
  const VERTICAL_SPACING = 150;

  levels.forEach((nodesAtLevel, level) => {
    const totalWidth = (nodesAtLevel.length - 1) * HORIZONTAL_SPACING;
    const startX = -totalWidth / 2;

    nodesAtLevel.forEach((nodeName, index) => {
      positions.set(nodeName, {
        x: startX + index * HORIZONTAL_SPACING,
        y: level * VERTICAL_SPACING
      });
    });
  });

  return positions;
}

/**
 * Assign nodes to hierarchical levels using BFS
 */
function assignNodesToLevels(
  entryPoint: string,
  adjacencyList: Map<string, string[]>,
  allNodes: GraphNodeConfig[]
): Map<number, string[]> {
  const levels = new Map<number, string[]>();
  const visited = new Set<string>();
  const queue: Array<{ node: string; level: number }> = [{ node: entryPoint, level: 0 }];

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;

    if (visited.has(node)) {
      continue;
    }
    visited.add(node);

    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(node);

    const neighbors = adjacencyList.get(node) || [];
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        queue.push({ node: neighbor, level: level + 1 });
      }
    });
  }

  return levels;
}

/**
 * Map internal node types to XYFlow custom node types
 */
function getXYFlowNodeType(type: string): string {
  switch (type) {
    case 'agent':
      return 'agentNode';
    case 'toolExecutor':
      return 'toolNode';
    case 'final':
      return 'finalNode';
    default:
      return 'default';
  }
}

/**
 * Format node name for display
 */
function formatNodeLabel(name: string): string {
  // Convert snake_case or camelCase to Title Case
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

/**
 * Get node description based on type
 */
function getNodeDescription(node: GraphNodeConfig): string {
  switch (node.type) {
    case 'agent':
      return 'AI Agent Node';
    case 'toolExecutor':
      return 'Tool Executor Node';
    case 'final':
      return 'Final Output Node';
    default:
      return '';
  }
}

/**
 * Get custom styling for node based on type
 */
function getNodeStyle(type: string): Record<string, string> {
  const baseStyle = {
    borderRadius: '8px',
    padding: '12px',
    border: '2px solid',
    fontSize: '13px',
    fontWeight: '500'
  };

  switch (type) {
    case 'agent':
      return {
        ...baseStyle,
        background: '#e0f2fe',
        borderColor: '#0284c7',
        color: '#0c4a6e'
      };
    case 'toolExecutor':
      return {
        ...baseStyle,
        background: '#fef3c7',
        borderColor: '#f59e0b',
        color: '#78350f'
      };
    case 'final':
      return {
        ...baseStyle,
        background: '#dcfce7',
        borderColor: '#16a34a',
        color: '#14532d'
      };
    default:
      return baseStyle;
  }
}

/**
 * Get edge styling based on type and condition
 */
function getEdgeStyle(edge: GraphEdgeConfig, condition: string): Record<string, string> {
  // Conditional edges (non-default conditions) get dashed styling
  if (condition !== 'default' && edge.conditionType !== 'alwaysAgent') {
    return {
      stroke: '#9ca3af',
      strokeWidth: '2',
      strokeDasharray: '5,5'
    };
  }
  return {
    stroke: '#6b7280',
    strokeWidth: '2'
  };
}
