// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { StateGraph, type StateGraphConfig } from './StateGraph.js';
import type { Runnable } from './OrchestrationTypes.js';

/**
 * Fluent builder for constructing StateGraphs
 *
 * @example
 * ```typescript
 * const graph = new GraphBuilder<MyState>('my-workflow')
 *   .addNode('start', startNode)
 *   .addNode('process', processNode)
 *   .addNode('end', endNode)
 *   .addEdge('start', (state) => state.shouldProcess ? 'process' : 'end', {
 *     process: 'process',
 *     end: '__end__'
 *   })
 *   .addEdge('process', () => 'end', { end: '__end__' })
 *   .setEntryPoint('start')
 *   .build();
 * ```
 */
export class GraphBuilder<TState> {
  private graph: StateGraph<TState>;

  constructor(name: string, config?: Omit<StateGraphConfig, 'name'>) {
    this.graph = new StateGraph<TState>({ name, ...config });
  }

  /**
   * Add a node to the graph
   * @param name - Node name
   * @param node - Node implementation
   * @returns This builder for chaining
   */
  addNode(name: string, node: Runnable<TState, TState>): this {
    this.graph.addNode(name, node);
    return this;
  }

  /**
   * Add conditional edges from a node
   * @param sourceName - Source node name
   * @param condition - Condition function
   * @param targetMap - Target map
   * @returns This builder for chaining
   */
  addEdge(
    sourceName: string,
    condition: (state: TState) => string,
    targetMap: Record<string, string>
  ): this {
    this.graph.addConditionalEdges(sourceName, condition, targetMap);
    return this;
  }

  /**
   * Add a simple edge that always goes to the same target
   * @param sourceName - Source node name
   * @param targetName - Target node name
   * @returns This builder for chaining
   */
  addSimpleEdge(sourceName: string, targetName: string): this {
    this.graph.addConditionalEdges(sourceName, () => 'next', { next: targetName });
    return this;
  }

  /**
   * Set the entry point
   * @param name - Entry point node name
   * @returns This builder for chaining
   */
  setEntryPoint(name: string): this {
    this.graph.setEntryPoint(name);
    return this;
  }

  /**
   * Build the final graph
   * @returns The constructed StateGraph
   */
  build(): StateGraph<TState> {
    return this.graph;
  }
}

/**
 * Create a simple node from an async function
 * @param fn - Async function that transforms state
 * @returns Runnable node
 */
export function createNode<TState>(
  fn: (state: TState, signal?: AbortSignal) => Promise<TState>
): Runnable<TState, TState> {
  return {
    invoke: fn,
  };
}

/**
 * Create a node that applies a synchronous transformation
 * @param fn - Synchronous function that transforms state
 * @returns Runnable node
 */
export function createSyncNode<TState>(fn: (state: TState) => TState): Runnable<TState, TState> {
  return {
    invoke: async (state: TState) => fn(state),
  };
}

/**
 * Create a passthrough node (useful for debugging)
 * @returns Runnable node that returns state unchanged
 */
export function createPassthroughNode<TState>(): Runnable<TState, TState> {
  return {
    invoke: async (state: TState) => state,
  };
}
