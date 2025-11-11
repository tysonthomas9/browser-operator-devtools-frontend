// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { StateGraph } from '../../src/orchestration/StateGraph';
import {
  END_NODE,
  GraphAbortedError,
  GraphMaxStepsError,
  NodeNotFoundError,
  RoutingError,
} from '../../src/orchestration/OrchestrationTypes';

interface TestState {
  value: number;
  visited: string[];
  shouldEnd?: boolean;
}

describe('StateGraph', () => {
  describe('constructor', () => {
    it('should create a graph with default entry point', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });
      expect(graph.getEntryPoint()).toBe('start');
    });

    it('should create a graph with custom entry point', () => {
      const graph = new StateGraph<TestState>({
        name: 'test-graph',
        entryPoint: 'custom',
      });
      expect(graph.getEntryPoint()).toBe('custom');
    });
  });

  describe('addNode', () => {
    it('should add a node successfully', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });
      const node = {
        invoke: async (state: TestState) => ({ ...state, value: state.value + 1 }),
      };

      graph.addNode('increment', node);
      expect(graph.hasNode('increment')).toBe(true);
    });

    it('should allow overwriting a node', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });
      const node1 = {
        invoke: async (state: TestState) => ({ ...state, value: state.value + 1 }),
      };
      const node2 = {
        invoke: async (state: TestState) => ({ ...state, value: state.value + 2 }),
      };

      graph.addNode('test', node1);
      graph.addNode('test', node2);
      expect(graph.hasNode('test')).toBe(true);
    });
  });

  describe('addConditionalEdges', () => {
    it('should add conditional edges successfully', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });
      const node = {
        invoke: async (state: TestState) => state,
      };

      graph.addNode('source', node);
      graph.addNode('target', node);

      graph.addConditionalEdges('source', () => 'next', { next: 'target' });
    });
  });

  describe('setEntryPoint', () => {
    it('should set entry point for existing node', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });
      const node = {
        invoke: async (state: TestState) => state,
      };

      graph.addNode('custom', node);
      graph.setEntryPoint('custom');
      expect(graph.getEntryPoint()).toBe('custom');
    });

    it('should throw error for non-existent node', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });
      expect(() => graph.setEntryPoint('non-existent')).toThrow(NodeNotFoundError);
    });
  });

  describe('invoke', () => {
    it('should execute a simple linear graph', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const incrementNode = {
        invoke: async (state: TestState) => ({
          ...state,
          value: state.value + 1,
          visited: [...state.visited, 'increment'],
        }),
      };

      const doubleNode = {
        invoke: async (state: TestState) => ({
          ...state,
          value: state.value * 2,
          visited: [...state.visited, 'double'],
        }),
      };

      graph.addNode('start', incrementNode);
      graph.addNode('double', doubleNode);

      graph.addConditionalEdges('start', () => 'next', { next: 'double' });
      graph.addConditionalEdges('double', () => END_NODE, { [END_NODE]: END_NODE });

      graph.setEntryPoint('start');

      const initialState: TestState = { value: 5, visited: [] };
      const finalState = await graph.run(initialState);

      expect(finalState.value).toBe(12); // (5 + 1) * 2
      expect(finalState.visited).toEqual(['increment', 'double']);
    });

    it('should execute conditional routing', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const checkNode = {
        invoke: async (state: TestState) => ({
          ...state,
          visited: [...state.visited, 'check'],
        }),
      };

      const processANode = {
        invoke: async (state: TestState) => ({
          ...state,
          value: state.value + 10,
          visited: [...state.visited, 'processA'],
        }),
      };

      const processBNode = {
        invoke: async (state: TestState) => ({
          ...state,
          value: state.value + 20,
          visited: [...state.visited, 'processB'],
        }),
      };

      graph.addNode('start', checkNode);
      graph.addNode('processA', processANode);
      graph.addNode('processB', processBNode);

      graph.addConditionalEdges(
        'start',
        (state) => (state.value > 5 ? 'processB' : 'processA'),
        {
          processA: 'processA',
          processB: 'processB',
        }
      );

      graph.addConditionalEdges('processA', () => END_NODE, { [END_NODE]: END_NODE });
      graph.addConditionalEdges('processB', () => END_NODE, { [END_NODE]: END_NODE });

      graph.setEntryPoint('start');

      // Test routing to processA
      const state1 = await graph.run({ value: 3, visited: [] });
      expect(state1.value).toBe(13);
      expect(state1.visited).toEqual(['check', 'processA']);

      // Test routing to processB
      const state2 = await graph.run({ value: 10, visited: [] });
      expect(state2.value).toBe(30);
      expect(state2.visited).toEqual(['check', 'processB']);
    });

    it('should yield intermediate states', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node1 = {
        invoke: async (state: TestState) => ({ ...state, value: state.value + 1 }),
      };
      const node2 = {
        invoke: async (state: TestState) => ({ ...state, value: state.value * 2 }),
      };

      graph.addNode('start', node1);
      graph.addNode('end', node2);
      graph.addConditionalEdges('start', () => 'next', { next: 'end' });
      graph.addConditionalEdges('end', () => END_NODE, { [END_NODE]: END_NODE });
      graph.setEntryPoint('start');

      const initialState: TestState = { value: 5, visited: [] };
      const states: TestState[] = [];

      for await (const state of graph.invoke(initialState)) {
        states.push(state);
      }

      expect(states).toHaveLength(2);
      expect(states[0].value).toBe(6); // After node1
      expect(states[1].value).toBe(12); // After node2
    });

    it('should handle abort signal', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const slowNode = {
        invoke: async (state: TestState, signal?: AbortSignal) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (signal?.aborted) {
            throw new GraphAbortedError();
          }
          return state;
        },
      };

      graph.addNode('start', slowNode);
      graph.addConditionalEdges('start', () => END_NODE, { [END_NODE]: END_NODE });
      graph.setEntryPoint('start');

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      await expect(
        graph.run({ value: 0, visited: [] }, { signal: controller.signal })
      ).rejects.toThrow(GraphAbortedError);
    });

    it('should enforce max steps', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      let counter = 0;
      const loopNode = {
        invoke: async (state: TestState) => {
          counter++;
          return { ...state, value: state.value + 1 };
        },
      };

      graph.addNode('start', loopNode);
      graph.addConditionalEdges('start', () => 'start', { start: 'start' });
      graph.setEntryPoint('start');

      await expect(graph.run({ value: 0, visited: [] }, { maxSteps: 5 })).rejects.toThrow(
        GraphMaxStepsError
      );
    });

    it('should call progress callback', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node = {
        invoke: async (state: TestState) => ({ ...state, value: state.value + 1 }),
      };

      graph.addNode('start', node);
      graph.addConditionalEdges('start', () => END_NODE, { [END_NODE]: END_NODE });
      graph.setEntryPoint('start');

      const events: any[] = [];
      const onProgress = jest.fn((event) => {
        events.push(event);
      });

      await graph.run({ value: 0, visited: [] }, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(events.some((e) => e.type === 'node_start')).toBe(true);
      expect(events.some((e) => e.type === 'node_complete')).toBe(true);
    });

    it('should throw NodeNotFoundError for missing node', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node = {
        invoke: async (state: TestState) => state,
      };

      graph.addNode('start', node);
      graph.addConditionalEdges('start', () => 'missing', { missing: 'non-existent' });
      graph.setEntryPoint('start');

      await expect(graph.run({ value: 0, visited: [] })).rejects.toThrow(NodeNotFoundError);
    });

    it('should throw RoutingError for unmapped routing key', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node = {
        invoke: async (state: TestState) => state,
      };

      graph.addNode('start', node);
      graph.addConditionalEdges('start', () => 'unmapped', { mapped: 'somewhere' });
      graph.setEntryPoint('start');

      await expect(graph.run({ value: 0, visited: [] })).rejects.toThrow(RoutingError);
    });

    it('should handle node that ends without conditional edge', async () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node = {
        invoke: async (state: TestState) => ({
          ...state,
          value: state.value + 1,
          visited: [...state.visited, 'node'],
        }),
      };

      graph.addNode('start', node);
      graph.setEntryPoint('start');

      const finalState = await graph.run({ value: 5, visited: [] });

      expect(finalState.value).toBe(6);
      expect(finalState.visited).toEqual(['node']);
    });
  });

  describe('getSummary', () => {
    it('should return graph summary', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node = {
        invoke: async (state: TestState) => state,
      };

      graph.addNode('start', node);
      graph.addNode('end', node);
      graph.addConditionalEdges('start', () => 'next', { next: 'end' });
      graph.setEntryPoint('start');

      const summary = graph.getSummary();

      expect(summary.name).toBe('test-graph');
      expect(summary.entryPoint).toBe('start');
      expect(summary.nodeCount).toBe(2);
      expect(summary.nodes).toEqual(['start', 'end']);
      expect(summary.edges).toHaveLength(1);
    });
  });

  describe('getNodeNames', () => {
    it('should return all node names', () => {
      const graph = new StateGraph<TestState>({ name: 'test-graph' });

      const node = {
        invoke: async (state: TestState) => state,
      };

      graph.addNode('node1', node);
      graph.addNode('node2', node);
      graph.addNode('node3', node);

      const names = graph.getNodeNames();
      expect(names).toEqual(['node1', 'node2', 'node3']);
    });
  });
});
