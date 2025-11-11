// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  GraphBuilder,
  createNode,
  createSyncNode,
  createPassthroughNode,
} from '../../src/orchestration/GraphBuilder';
import { END_NODE } from '../../src/orchestration/OrchestrationTypes';

interface TestState {
  value: number;
  log: string[];
}

describe('GraphBuilder', () => {
  describe('fluent API', () => {
    it('should build a simple graph', async () => {
      const graph = new GraphBuilder<TestState>('test-graph')
        .addNode('start', {
          invoke: async (state) => ({ ...state, value: state.value + 1, log: [...state.log, 'start'] }),
        })
        .addNode('end', {
          invoke: async (state) => ({ ...state, value: state.value * 2, log: [...state.log, 'end'] }),
        })
        .addEdge('start', () => 'next', { next: 'end' })
        .addEdge('end', () => END_NODE, { [END_NODE]: END_NODE })
        .setEntryPoint('start')
        .build();

      const result = await graph.run({ value: 5, log: [] });
      expect(result.value).toBe(12); // (5 + 1) * 2
      expect(result.log).toEqual(['start', 'end']);
    });

    it('should build a graph with conditional routing', async () => {
      const graph = new GraphBuilder<TestState>('conditional-graph')
        .addNode('check', {
          invoke: async (state) => ({ ...state, log: [...state.log, 'check'] }),
        })
        .addNode('pathA', {
          invoke: async (state) => ({ ...state, value: state.value + 10, log: [...state.log, 'pathA'] }),
        })
        .addNode('pathB', {
          invoke: async (state) => ({ ...state, value: state.value + 20, log: [...state.log, 'pathB'] }),
        })
        .addEdge('check', (state) => (state.value > 5 ? 'B' : 'A'), {
          A: 'pathA',
          B: 'pathB',
        })
        .addEdge('pathA', () => END_NODE, { [END_NODE]: END_NODE })
        .addEdge('pathB', () => END_NODE, { [END_NODE]: END_NODE })
        .setEntryPoint('check')
        .build();

      const result1 = await graph.run({ value: 3, log: [] });
      expect(result1.value).toBe(13);
      expect(result1.log).toEqual(['check', 'pathA']);

      const result2 = await graph.run({ value: 10, log: [] });
      expect(result2.value).toBe(30);
      expect(result2.log).toEqual(['check', 'pathB']);
    });

    it('should support simple edges', async () => {
      const graph = new GraphBuilder<TestState>('simple-edges')
        .addNode('first', {
          invoke: async (state) => ({ ...state, log: [...state.log, 'first'] }),
        })
        .addNode('second', {
          invoke: async (state) => ({ ...state, log: [...state.log, 'second'] }),
        })
        .addNode('third', {
          invoke: async (state) => ({ ...state, log: [...state.log, 'third'] }),
        })
        .addSimpleEdge('first', 'second')
        .addSimpleEdge('second', 'third')
        .addSimpleEdge('third', END_NODE)
        .setEntryPoint('first')
        .build();

      const result = await graph.run({ value: 0, log: [] });
      expect(result.log).toEqual(['first', 'second', 'third']);
    });

    it('should allow method chaining', () => {
      const builder = new GraphBuilder<TestState>('chain-test')
        .addNode('a', { invoke: async (state) => state })
        .addNode('b', { invoke: async (state) => state })
        .addEdge('a', () => 'next', { next: 'b' })
        .setEntryPoint('a');

      expect(builder).toBeInstanceOf(GraphBuilder);
      const graph = builder.build();
      expect(graph.getEntryPoint()).toBe('a');
    });
  });
});

describe('createNode', () => {
  it('should create an async node', async () => {
    const node = createNode<TestState>(async (state) => ({
      ...state,
      value: state.value + 1,
    }));

    const result = await node.invoke({ value: 5, log: [] });
    expect(result.value).toBe(6);
  });

  it('should pass abort signal to node function', async () => {
    const controller = new AbortController();
    let signalPassed: AbortSignal | undefined;

    const node = createNode<TestState>(async (state, signal) => {
      signalPassed = signal;
      return state;
    });

    await node.invoke({ value: 0, log: [] }, controller.signal);
    expect(signalPassed).toBe(controller.signal);
  });
});

describe('createSyncNode', () => {
  it('should create a synchronous node', async () => {
    const node = createSyncNode<TestState>((state) => ({
      ...state,
      value: state.value * 2,
    }));

    const result = await node.invoke({ value: 5, log: [] });
    expect(result.value).toBe(10);
  });

  it('should work with synchronous transformations', async () => {
    const node = createSyncNode<TestState>((state) => ({
      ...state,
      log: [...state.log, 'sync-node'],
    }));

    const result = await node.invoke({ value: 0, log: ['start'] });
    expect(result.log).toEqual(['start', 'sync-node']);
  });
});

describe('createPassthroughNode', () => {
  it('should return state unchanged', async () => {
    const node = createPassthroughNode<TestState>();

    const initialState = { value: 42, log: ['test'] };
    const result = await node.invoke(initialState);

    expect(result).toEqual(initialState);
    expect(result).toBe(initialState); // Should be the same object reference
  });

  it('should work in a graph', async () => {
    const graph = new GraphBuilder<TestState>('passthrough-test')
      .addNode('start', createPassthroughNode())
      .addNode('modify', {
        invoke: async (state) => ({ ...state, value: state.value + 1 }),
      })
      .addSimpleEdge('start', 'modify')
      .addSimpleEdge('modify', END_NODE)
      .setEntryPoint('start')
      .build();

    const result = await graph.run({ value: 5, log: [] });
    expect(result.value).toBe(6);
  });
});

describe('integration', () => {
  it('should build a complex multi-path graph', async () => {
    const graph = new GraphBuilder<TestState>('complex-graph')
      .addNode('entry', createSyncNode((state) => ({ ...state, log: [...state.log, 'entry'] })))
      .addNode(
        'decision',
        createNode(async (state) => ({ ...state, log: [...state.log, 'decision'] }))
      )
      .addNode(
        'processLow',
        createSyncNode((state) => ({ ...state, value: state.value + 5, log: [...state.log, 'low'] }))
      )
      .addNode(
        'processMid',
        createSyncNode((state) => ({ ...state, value: state.value + 10, log: [...state.log, 'mid'] }))
      )
      .addNode(
        'processHigh',
        createSyncNode((state) => ({ ...state, value: state.value + 20, log: [...state.log, 'high'] }))
      )
      .addNode(
        'finalize',
        createNode(async (state) => ({ ...state, log: [...state.log, 'finalize'] }))
      )
      .addSimpleEdge('entry', 'decision')
      .addEdge(
        'decision',
        (state) => {
          if (state.value < 5) return 'low';
          if (state.value < 10) return 'mid';
          return 'high';
        },
        {
          low: 'processLow',
          mid: 'processMid',
          high: 'processHigh',
        }
      )
      .addSimpleEdge('processLow', 'finalize')
      .addSimpleEdge('processMid', 'finalize')
      .addSimpleEdge('processHigh', 'finalize')
      .addSimpleEdge('finalize', END_NODE)
      .setEntryPoint('entry')
      .build();

    // Test low path
    const result1 = await graph.run({ value: 2, log: [] });
    expect(result1.value).toBe(7);
    expect(result1.log).toEqual(['entry', 'decision', 'low', 'finalize']);

    // Test mid path
    const result2 = await graph.run({ value: 7, log: [] });
    expect(result2.value).toBe(17);
    expect(result2.log).toEqual(['entry', 'decision', 'mid', 'finalize']);

    // Test high path
    const result3 = await graph.run({ value: 15, log: [] });
    expect(result3.value).toBe(35);
    expect(result3.log).toEqual(['entry', 'decision', 'high', 'finalize']);
  });
});
