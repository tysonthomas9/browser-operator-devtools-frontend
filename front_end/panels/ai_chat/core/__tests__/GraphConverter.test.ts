// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { convertGraphConfigToXYFlow } from '../GraphConverter.js';
import type { GraphConfig } from '../ConfigurableGraph.js';
import { NodeType } from '../Types.js';

describe('GraphConverter', () => {
  describe('convertGraphConfigToXYFlow', () => {
    it('should convert simple 3-node linear graph', () => {
      const config: GraphConfig = {
        name: 'simple-graph',
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
          {
            source: 'toolExecutor',
            conditionType: 'alwaysAgent',
            targetMap: {
              agent: 'agent',
            },
          },
        ],
      };

      const result = convertGraphConfigToXYFlow(config);

      // Verify nodes
      assert.strictEqual(result.nodes.length, 3);
      assert.isTrue(result.nodes.some(n => n.id === 'agent'));
      assert.isTrue(result.nodes.some(n => n.id === 'toolExecutor'));
      assert.isTrue(result.nodes.some(n => n.id === 'final'));

      // Verify node structure
      const agentNode = result.nodes.find(n => n.id === 'agent');
      assert.isDefined(agentNode);
      assert.strictEqual(agentNode!.type, 'default');
      assert.isDefined(agentNode!.position);
      assert.isDefined(agentNode!.position.x);
      assert.isDefined(agentNode!.position.y);
      assert.isDefined(agentNode!.data);
      assert.strictEqual(agentNode!.data.nodeType, 'agent');

      // Verify edges - should flatten targetMap into multiple edges
      assert.isAtLeast(result.edges.length, 4); // 3 from first edge + 1 from second

      // Check agent -> toolExecutor edge exists
      const agentToToolEdge = result.edges.find(e =>
        e.source === 'agent' && e.target === 'toolExecutor'
      );
      assert.isDefined(agentToToolEdge);
      assert.strictEqual(agentToToolEdge!.label, 'toolExecutor');

      // Check toolExecutor -> agent edge exists
      const toolToAgentEdge = result.edges.find(e =>
        e.source === 'toolExecutor' && e.target === 'agent'
      );
      assert.isDefined(toolToAgentEdge);
    });

    it('should convert defaultAgentGraphConfig correctly', () => {
      const config: GraphConfig = {
        name: 'defaultAgentGraph',
        entryPoint: NodeType.AGENT.toString(),
        nodes: [
          { name: NodeType.AGENT.toString(), type: 'agent' },
          { name: NodeType.TOOL_EXECUTOR.toString(), type: 'toolExecutor' },
          { name: NodeType.FINAL.toString(), type: 'final' },
        ],
        edges: [
          {
            source: NodeType.AGENT.toString(),
            conditionType: 'routeOrPrepareToolExecutor',
            targetMap: {
              [NodeType.AGENT.toString()]: NodeType.AGENT.toString(),
              [NodeType.TOOL_EXECUTOR.toString()]: NodeType.TOOL_EXECUTOR.toString(),
              [NodeType.FINAL.toString()]: NodeType.FINAL.toString(),
              __end__: '__end__',
            },
          },
          {
            source: NodeType.TOOL_EXECUTOR.toString(),
            conditionType: 'alwaysAgent',
            targetMap: {
              [NodeType.AGENT.toString()]: NodeType.AGENT.toString(),
            },
          },
        ],
      };

      const result = convertGraphConfigToXYFlow(config);

      assert.strictEqual(result.nodes.length, 3);

      // Verify edges don't include __end__ target
      assert.isFalse(result.edges.some(e => e.target === '__end__'));

      // Should have 4 edges from first targetMap + 1 from second = 5 total
      // (excluding __end__)
      assert.strictEqual(result.edges.length, 4);
    });

    it('should handle empty graph', () => {
      const config: GraphConfig = {
        name: 'empty',
        entryPoint: 'start',
        nodes: [],
        edges: [],
      };

      const result = convertGraphConfigToXYFlow(config);

      assert.strictEqual(result.nodes.length, 0);
      assert.strictEqual(result.edges.length, 0);
    });

    it('should handle single node graph', () => {
      const config: GraphConfig = {
        name: 'single',
        entryPoint: 'lonely',
        nodes: [{ name: 'lonely', type: 'agent' }],
        edges: [],
      };

      const result = convertGraphConfigToXYFlow(config);

      assert.strictEqual(result.nodes.length, 1);
      assert.strictEqual(result.nodes[0].id, 'lonely');
      assert.strictEqual(result.edges.length, 0);
    });

    it('should assign hierarchical positions', () => {
      const config: GraphConfig = {
        name: 'hierarchy',
        entryPoint: 'root',
        nodes: [
          { name: 'root', type: 'agent' },
          { name: 'child1', type: 'toolExecutor' },
          { name: 'child2', type: 'final' },
        ],
        edges: [
          {
            source: 'root',
            conditionType: 'routeBasedOnLastMessage',
            targetMap: {
              child1: 'child1',
              child2: 'child2',
            },
          },
        ],
      };

      const result = convertGraphConfigToXYFlow(config);

      const rootNode = result.nodes.find(n => n.id === 'root');
      const child1Node = result.nodes.find(n => n.id === 'child1');
      const child2Node = result.nodes.find(n => n.id === 'child2');

      assert.isDefined(rootNode);
      assert.isDefined(child1Node);
      assert.isDefined(child2Node);

      // Root should be at higher level (lower y) than children
      assert.isBelow(rootNode!.position.y, child1Node!.position.y);
      assert.isBelow(rootNode!.position.y, child2Node!.position.y);

      // Children should be at same level
      assert.strictEqual(child1Node!.position.y, child2Node!.position.y);
    });

    it('should apply correct node styling based on type', () => {
      const config: GraphConfig = {
        name: 'styled',
        entryPoint: 'agent',
        nodes: [
          { name: 'agent', type: 'agent' },
          { name: 'tool', type: 'toolExecutor' },
          { name: 'end', type: 'final' },
        ],
        edges: [],
      };

      const result = convertGraphConfigToXYFlow(config);

      const agentNode = result.nodes.find(n => n.id === 'agent');
      const toolNode = result.nodes.find(n => n.id === 'tool');
      const finalNode = result.nodes.find(n => n.id === 'end');

      // Verify styling exists (exact colors tested elsewhere)
      assert.isDefined(agentNode!.style);
      assert.isDefined(toolNode!.style);
      assert.isDefined(finalNode!.style);

      // Different node types should have different styles
      assert.notDeepEqual(agentNode!.style, toolNode!.style);
      assert.notDeepEqual(agentNode!.style, finalNode!.style);
    });

    it('should format node labels correctly', () => {
      const config: GraphConfig = {
        name: 'labels',
        entryPoint: 'camelCaseNode',
        nodes: [
          { name: 'camelCaseNode', type: 'agent' },
          { name: 'snake_case_node', type: 'toolExecutor' },
          { name: 'UPPERCASE', type: 'final' },
        ],
        edges: [],
      };

      const result = convertGraphConfigToXYFlow(config);

      const camelNode = result.nodes.find(n => n.id === 'camelCaseNode');
      const snakeNode = result.nodes.find(n => n.id === 'snake_case_node');
      const upperNode = result.nodes.find(n => n.id === 'UPPERCASE');

      // Labels should be formatted (capitalized, spaces added, etc)
      assert.isDefined(camelNode!.data.label);
      assert.isDefined(snakeNode!.data.label);
      assert.isDefined(upperNode!.data.label);

      // Labels should not be empty
      assert.isAbove(camelNode!.data.label.length, 0);
      assert.isAbove(snakeNode!.data.label.length, 0);
      assert.isAbove(upperNode!.data.label.length, 0);
    });

    it('should handle conditional edges with proper labels', () => {
      const config: GraphConfig = {
        name: 'conditional',
        entryPoint: 'start',
        nodes: [
          { name: 'start', type: 'agent' },
          { name: 'path1', type: 'toolExecutor' },
          { name: 'path2', type: 'final' },
        ],
        edges: [
          {
            source: 'start',
            conditionType: 'routeBasedOnLastMessage',
            targetMap: {
              condition_a: 'path1',
              condition_b: 'path2',
            },
          },
        ],
      };

      const result = convertGraphConfigToXYFlow(config);

      // Find edges with labels
      const edgeWithLabel1 = result.edges.find(e => e.source === 'start' && e.target === 'path1');
      const edgeWithLabel2 = result.edges.find(e => e.source === 'start' && e.target === 'path2');

      assert.isDefined(edgeWithLabel1);
      assert.isDefined(edgeWithLabel2);

      // Conditional edges should have labels
      assert.strictEqual(edgeWithLabel1!.label, 'condition_a');
      assert.strictEqual(edgeWithLabel2!.label, 'condition_b');

      // Conditional edges should use smoothstep type
      assert.strictEqual(edgeWithLabel1!.type, 'smoothstep');
      assert.strictEqual(edgeWithLabel2!.type, 'smoothstep');
    });

    it('should handle alwaysAgent edge type correctly', () => {
      const config: GraphConfig = {
        name: 'always',
        entryPoint: 'tool',
        nodes: [
          { name: 'tool', type: 'toolExecutor' },
          { name: 'agent', type: 'agent' },
        ],
        edges: [
          {
            source: 'tool',
            conditionType: 'alwaysAgent',
            targetMap: {
              agent: 'agent',
            },
          },
        ],
      };

      const result = convertGraphConfigToXYFlow(config);

      const edge = result.edges.find(e => e.source === 'tool');

      assert.isDefined(edge);
      // alwaysAgent edges should use default type
      assert.strictEqual(edge!.type, 'default');
      assert.isFalse(edge!.animated);
    });

    it('should exclude __end__ targets from edges', () => {
      const config: GraphConfig = {
        name: 'with-end',
        entryPoint: 'start',
        nodes: [
          { name: 'start', type: 'agent' },
          { name: 'finish', type: 'final' },
        ],
        edges: [
          {
            source: 'start',
            conditionType: 'routeBasedOnLastMessage',
            targetMap: {
              continue: 'finish',
              __end__: '__end__',
            },
          },
        ],
      };

      const result = convertGraphConfigToXYFlow(config);

      // Should not have edge targeting __end__
      const endEdge = result.edges.find(e => e.target === '__end__');
      assert.isUndefined(endEdge);

      // Should have edge to 'finish'
      const finishEdge = result.edges.find(e => e.target === 'finish');
      assert.isDefined(finishEdge);
    });
  });
});
