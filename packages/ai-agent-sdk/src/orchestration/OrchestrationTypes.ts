// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Core types for graph orchestration
 */

/**
 * Interface for a runnable unit of work (node in the graph)
 */
export interface Runnable<TInput, TOutput> {
  /**
   * Execute the runnable with the given input
   * @param input - The input state
   * @param signal - Optional abort signal for cancellation
   * @returns Promise resolving to the output state
   */
  invoke(input: TInput, signal?: AbortSignal): Promise<TOutput>;
}

/**
 * Condition function that determines the next node to execute
 */
export type ConditionFunction<TState> = (state: TState) => string;

/**
 * Map of condition outcomes to target node names
 */
export type TargetMap = Record<string, string>;

/**
 * Configuration for a conditional edge
 */
export interface ConditionalEdge<TState> {
  /**
   * Function that evaluates the current state and returns a routing key
   */
  condition: ConditionFunction<TState>;

  /**
   * Map of routing keys to target node names
   */
  targetMap: Map<string, string>;
}

/**
 * Progress event emitted during graph execution
 */
export interface GraphProgressEvent<TState> {
  /**
   * Type of progress event
   */
  type: 'node_start' | 'node_complete' | 'node_error' | 'routing';

  /**
   * Name of the current node
   */
  nodeName: string;

  /**
   * Current step number
   */
  step: number;

  /**
   * Current state (optional, for security/privacy)
   */
  state?: TState;

  /**
   * Additional event data
   */
  data?: any;
}

/**
 * Callback for graph progress events
 */
export type GraphProgressCallback<TState> = (event: GraphProgressEvent<TState>) => void;

/**
 * Options for graph execution
 */
export interface GraphExecutionOptions {
  /**
   * Maximum number of steps before auto-termination
   * @default 50
   */
  maxSteps?: number;

  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;

  /**
   * Progress callback for monitoring execution
   */
  onProgress?: GraphProgressCallback<any>;
}

/**
 * Marker for graph termination
 */
export const END_NODE = '__end__';

/**
 * Error thrown when graph execution is aborted
 */
export class GraphAbortedError extends Error {
  constructor(message: string = 'Graph execution was aborted') {
    super(message);
    this.name = 'GraphAbortedError';
  }
}

/**
 * Error thrown when graph execution exceeds maximum steps
 */
export class GraphMaxStepsError extends Error {
  constructor(maxSteps: number) {
    super(`Graph execution exceeded maximum steps: ${maxSteps}`);
    this.name = 'GraphMaxStepsError';
  }
}

/**
 * Error thrown when a node is not found
 */
export class NodeNotFoundError extends Error {
  constructor(nodeName: string) {
    super(`Node not found: ${nodeName}`);
    this.name = 'NodeNotFoundError';
  }
}

/**
 * Error thrown when routing fails
 */
export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingError';
  }
}
