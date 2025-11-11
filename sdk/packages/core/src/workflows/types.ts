// Copyright 2025 The Browser Operator Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Workflow types following Mastra pattern
 * Browser-compatible workflow orchestration
 */

import type { z } from 'zod';
import type { RuntimeContext } from '../tools/utils.js';

/**
 * Context passed to step execute function
 */
export interface StepExecutionContext<TInput, TState = unknown> {
  /**
   * Input data (validated against inputSchema)
   */
  inputData: TInput;

  /**
   * Shared workflow state
   */
  state: TState;

  /**
   * Update shared state
   */
  setState: <K extends keyof TState>(key: K, value: TState[K]) => void;

  /**
   * Runtime context for request-specific values
   */
  runtimeContext?: RuntimeContext;

  /**
   * Abort signal for cancellation
   */
  abortSignal?: AbortSignal;

  /**
   * Get result of previous step by ID
   */
  getStepResult: <T = unknown>(stepId: string) => T | undefined;

  /**
   * Get initial workflow input data
   */
  getInitData: <T = unknown>() => T;
}

/**
 * Workflow step configuration
 */
export interface StepConfig<
  TInput = unknown,
  TOutput = unknown,
  TState = unknown,
  TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>,
  TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>,
  TStateSchema extends z.ZodType<TState> = z.ZodType<TState>,
> {
  /**
   * Unique step identifier
   */
  id: string;

  /**
   * Input schema for validation
   */
  inputSchema: TInputSchema;

  /**
   * Output schema for validation
   */
  outputSchema: TOutputSchema;

  /**
   * Optional state schema for shared state
   */
  stateSchema?: TStateSchema;

  /**
   * Execute function
   */
  execute: (context: StepExecutionContext<TInput, TState>) => Promise<TOutput>;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow step interface
 */
export interface WorkflowStep<TInput = unknown, TOutput = unknown, TState = unknown> {
  id: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  stateSchema?: z.ZodType<TState>;
  execute: (context: StepExecutionContext<TInput, TState>) => Promise<TOutput>;
  metadata?: Record<string, unknown>;
}

/**
 * Step execution result
 */
export interface StepResult<TOutput = unknown> {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  output?: TOutput;
  error?: Error;
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig<TInput = unknown, TOutput = unknown, TState = unknown> {
  /**
   * Unique workflow identifier
   */
  id: string;

  /**
   * Input schema for the entire workflow
   */
  inputSchema: z.ZodType<TInput>;

  /**
   * Output schema for the entire workflow
   */
  outputSchema: z.ZodType<TOutput>;

  /**
   * Optional shared state schema
   */
  stateSchema?: z.ZodType<TState>;

  /**
   * Optional metadata
   */
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    [key: string]: unknown;
  };
}

/**
 * Condition function for branching
 */
export type Condition = (context: StepExecutionContext<any, any>) => Promise<boolean> | boolean;

/**
 * Map function for data transformation
 */
export type MapFunction = (context: StepExecutionContext<any, any>) => Promise<any> | any;

/**
 * Options for foreach iteration
 */
export interface ForeachOptions {
  /**
   * Maximum concurrent executions
   */
  concurrency?: number;

  /**
   * Maximum number of iterations
   */
  iterationCount?: number;
}

/**
 * Workflow execution node (internal representation)
 */
export type WorkflowNode =
  | { type: 'step'; step: WorkflowStep<any, any, any> }
  | { type: 'parallel'; steps: WorkflowStep<any, any, any>[] }
  | { type: 'branch'; branches: Array<[Condition, WorkflowStep<any, any, any>]> }
  | { type: 'map'; mapper: MapFunction }
  | { type: 'foreach'; step: WorkflowStep<any, any, any>; options?: ForeachOptions }
  | { type: 'dowhile'; condition: Condition; step: WorkflowStep<any, any, any>; maxIterations?: number }
  | { type: 'dountil'; condition: Condition; step: WorkflowStep<any, any, any>; maxIterations?: number };

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'pending' | 'running' | 'suspended' | 'success' | 'failed';

/**
 * Workflow execution result
 */
export interface WorkflowResult<TOutput = unknown> {
  workflowId: string;
  status: WorkflowStatus;
  output?: TOutput;
  error?: Error;
  steps: StepResult[];
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /**
   * Initial state values
   */
  initialState?: Record<string, unknown>;

  /**
   * Runtime context for request-specific values
   */
  runtimeContext?: RuntimeContext;

  /**
   * Abort signal for cancellation
   */
  abortSignal?: AbortSignal;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Workflow event types for streaming
 */
export type WorkflowEvent =
  | { type: 'workflow:start'; workflowId: string; timestamp: number }
  | { type: 'workflow:complete'; workflowId: string; output: unknown; timestamp: number }
  | { type: 'workflow:error'; workflowId: string; error: Error; timestamp: number }
  | { type: 'step:start'; stepId: string; timestamp: number }
  | { type: 'step:complete'; stepId: string; output: unknown; duration: number; timestamp: number }
  | { type: 'step:error'; stepId: string; error: Error; duration: number; timestamp: number }
  | { type: 'step:skip'; stepId: string; reason: string; timestamp: number };
