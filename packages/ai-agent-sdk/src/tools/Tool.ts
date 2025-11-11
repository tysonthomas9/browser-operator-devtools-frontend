// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMProvider } from '../llm/LLMTypes.js';

/**
 * Base interface for all tools
 */
export interface Tool<TArgs = Record<string, unknown>, TResult = unknown> {
  /** Unique tool name */
  name: string;

  /** Description for LLM understanding */
  description: string;

  /** Execute the tool */
  execute: (args: TArgs, ctx?: ToolContext) => Promise<TResult>;

  /** JSON schema for tool arguments */
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Context passed into tools for LLM-related operations and configuration.
 */
export interface ToolContext {
  /** API key for LLM calls */
  apiKey?: string;

  /** LLM provider to use */
  provider: LLMProvider;

  /** Model name to use */
  model: string;

  /** Check if model has vision capability */
  getVisionCapability?: (model: string) => Promise<boolean> | boolean;

  /** Mini model for smaller/faster operations */
  miniModel?: string;

  /** Nano model for smallest/fastest operations */
  nanoModel?: string;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Additional custom context */
  [key: string]: any;
}

/**
 * Result wrapper for tool execution
 */
export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  duration?: number;
}

/**
 * Tool factory function type
 */
export type ToolFactory<T extends Tool = Tool> = () => T;

/**
 * Helper to create a tool execution result
 */
export function createToolResult<T>(
  success: boolean,
  result?: T,
  error?: string,
  duration?: number
): ToolExecutionResult<T> {
  return {
    success,
    result,
    error,
    duration,
  };
}

/**
 * Helper to create a successful tool result
 */
export function successResult<T>(result: T, duration?: number): ToolExecutionResult<T> {
  return createToolResult(true, result, undefined, duration);
}

/**
 * Helper to create an error tool result
 */
export function errorResult<T = undefined>(error: string, duration?: number): ToolExecutionResult<T> {
  return createToolResult(false, undefined, error, duration) as ToolExecutionResult<T>;
}
