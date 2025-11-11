// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../observability/Logger.js';
import {
  type Runnable,
  type ConditionalEdge,
  type GraphExecutionOptions,
  END_NODE,
  GraphAbortedError,
  GraphMaxStepsError,
  NodeNotFoundError,
  RoutingError,
} from './OrchestrationTypes.js';

const logger = createLogger('StateGraph');

/**
 * Configuration for StateGraph
 */
export interface StateGraphConfig {
  /**
   * Name of the graph (for logging and debugging)
   */
  name: string;

  /**
   * Entry point node name
   * @default 'start'
   */
  entryPoint?: string;
}

/**
 * StateGraph implements a state machine-based workflow orchestration system.
 *
 * The graph consists of nodes (units of work) and conditional edges (routing logic).
 * Execution flows through nodes based on conditional evaluation of the state.
 *
 * @template TState - The type of state passed between nodes
 *
 * @example
 * ```typescript
 * const graph = new StateGraph<MyState>({ name: 'my-workflow' });
 *
 * // Add nodes
 * graph.addNode('process', processNode);
 * graph.addNode('validate', validateNode);
 * graph.addNode('complete', completeNode);
 *
 * // Add conditional routing
 * graph.addConditionalEdges('process', (state) => {
 *   return state.isValid ? 'validate' : 'complete';
 * }, {
 *   validate: 'validate',
 *   complete: 'complete'
 * });
 *
 * // Set entry point
 * graph.setEntryPoint('process');
 *
 * // Execute
 * const finalState = await graph.invoke(initialState);
 * ```
 */
export class StateGraph<TState> {
  private nodes: Map<string, Runnable<TState, TState>>;
  private conditionalEdges: Map<string, ConditionalEdge<TState>>;
  private entryPoint: string;
  private name: string;

  constructor(config: StateGraphConfig) {
    this.nodes = new Map();
    this.conditionalEdges = new Map();
    this.entryPoint = config.entryPoint || 'start';
    this.name = config.name;
  }

  /**
   * Add a node to the graph
   * @param name - Unique name for the node
   * @param node - Runnable that implements the node logic
   */
  addNode(name: string, node: Runnable<TState, TState>): void {
    if (this.nodes.has(name)) {
      logger.warn(`Overwriting existing node: ${name}`);
    }
    this.nodes.set(name, node);
    logger.debug(`Added node: ${name}`);
  }

  /**
   * Add conditional edges from a source node
   * @param sourceName - Name of the source node
   * @param condition - Function that evaluates state and returns a routing key
   * @param targetMap - Map of routing keys to target node names
   */
  addConditionalEdges(
    sourceName: string,
    condition: (state: TState) => string,
    targetMap: Record<string, string>
  ): void {
    if (!this.nodes.has(sourceName)) {
      logger.warn(`Adding conditional edge from unknown node: ${sourceName}`);
    }

    const targetMapInternal = new Map<string, string>();
    for (const key in targetMap) {
      targetMapInternal.set(key, targetMap[key]);
    }

    this.conditionalEdges.set(sourceName, {
      condition,
      targetMap: targetMapInternal,
    });

    logger.debug(`Added conditional edges from: ${sourceName}`);
  }

  /**
   * Set the entry point for graph execution
   * @param name - Name of the entry point node
   */
  setEntryPoint(name: string): void {
    if (!this.nodes.has(name)) {
      throw new NodeNotFoundError(name);
    }
    this.entryPoint = name;
    logger.debug(`Set entry point: ${name}`);
  }

  /**
   * Get the current entry point
   */
  getEntryPoint(): string {
    return this.entryPoint;
  }

  /**
   * Get all node names
   */
  getNodeNames(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Check if a node exists
   */
  hasNode(name: string): boolean {
    return this.nodes.has(name);
  }

  /**
   * Execute the graph with the given initial state
   *
   * This is a generator function that yields the state after each node execution,
   * allowing for real-time monitoring of graph progress.
   *
   * @param state - Initial state
   * @param options - Execution options
   * @returns AsyncGenerator that yields intermediate states and returns final state
   */
  async *invoke(
    state: TState,
    options: GraphExecutionOptions = {}
  ): AsyncGenerator<TState, TState, void> {
    const { maxSteps = 50, signal, onProgress } = options;

    logger.info(`Starting graph execution: ${this.name} from entry point: ${this.entryPoint}`);

    let currentState = state;
    let currentNodeName = this.entryPoint;
    let step = 0;

    // Emit start event
    if (onProgress) {
      onProgress({
        type: 'node_start',
        nodeName: this.entryPoint,
        step: 0,
        state: currentState,
      });
    }

    while (currentNodeName !== END_NODE) {
      // Check for abort
      if (signal?.aborted) {
        logger.info(`Graph execution aborted at step ${step}, node: ${currentNodeName}`);
        throw new GraphAbortedError();
      }

      // Check max steps
      if (step >= maxSteps) {
        logger.error(`Graph execution exceeded max steps: ${maxSteps}`);
        throw new GraphMaxStepsError(maxSteps);
      }

      logger.debug(`Step ${step}: Executing node: ${currentNodeName}`);

      // Get the node
      const node = this.nodes.get(currentNodeName);
      if (!node) {
        logger.error(`Node not found: ${currentNodeName}`);
        throw new NodeNotFoundError(currentNodeName);
      }

      // Emit node start progress
      if (onProgress) {
        onProgress({
          type: 'node_start',
          nodeName: currentNodeName,
          step,
          state: currentState,
        });
      }

      try {
        // Execute the node
        const startTime = Date.now();
        currentState = await node.invoke(currentState, signal);
        const duration = Date.now() - startTime;

        logger.debug(`Step ${step}: Node ${currentNodeName} completed in ${duration}ms`);

        // Emit node complete progress
        if (onProgress) {
          onProgress({
            type: 'node_complete',
            nodeName: currentNodeName,
            step,
            state: currentState,
            data: { duration },
          });
        }

        // Yield intermediate state
        yield currentState;
      } catch (error) {
        logger.error(`Error executing node ${currentNodeName}:`, error);

        // Emit node error progress
        if (onProgress) {
          onProgress({
            type: 'node_error',
            nodeName: currentNodeName,
            step,
            state: currentState,
            data: { error },
          });
        }

        // Re-throw the error
        throw error;
      }

      // Determine next node
      const edgeConfig = this.conditionalEdges.get(currentNodeName);

      if (!edgeConfig) {
        logger.debug(`No conditional edge from node: ${currentNodeName}. Ending graph.`);
        currentNodeName = END_NODE;
      } else {
        try {
          const routingKey = edgeConfig.condition(currentState);
          logger.debug(`Routing key from condition: ${routingKey}`);

          // Emit routing progress
          if (onProgress) {
            onProgress({
              type: 'routing',
              nodeName: currentNodeName,
              step,
              data: { routingKey },
            });
          }

          const nextNodeName = edgeConfig.targetMap.get(routingKey);

          if (!nextNodeName) {
            throw new RoutingError(
              `No target node found for routing key "${routingKey}" from node "${currentNodeName}"`
            );
          }

          if (nextNodeName !== END_NODE && !this.nodes.has(nextNodeName)) {
            throw new NodeNotFoundError(nextNodeName);
          }

          currentNodeName = nextNodeName;
          logger.debug(`Next node: ${currentNodeName}`);
        } catch (error) {
          logger.error(`Routing error from node ${currentNodeName}:`, error);
          throw error;
        }
      }

      step++;
    }

    logger.info(`Graph execution completed after ${step} steps`);
    return currentState;
  }

  /**
   * Execute the graph and return only the final state (convenience method)
   * @param state - Initial state
   * @param options - Execution options
   * @returns Promise resolving to final state
   */
  async run(state: TState, options: GraphExecutionOptions = {}): Promise<TState> {
    let finalState = state;
    for await (const intermediateState of this.invoke(state, options)) {
      finalState = intermediateState;
    }
    return finalState;
  }

  /**
   * Get a summary of the graph structure (for debugging)
   */
  getSummary(): {
    name: string;
    entryPoint: string;
    nodeCount: number;
    nodes: string[];
    edges: Array<{ from: string; to: string[] }>;
  } {
    const edges = Array.from(this.conditionalEdges.entries()).map(([from, edge]) => ({
      from,
      to: Array.from(edge.targetMap.values()),
    }));

    return {
      name: this.name,
      entryPoint: this.entryPoint,
      nodeCount: this.nodes.size,
      nodes: Array.from(this.nodes.keys()),
      edges,
    };
  }
}
