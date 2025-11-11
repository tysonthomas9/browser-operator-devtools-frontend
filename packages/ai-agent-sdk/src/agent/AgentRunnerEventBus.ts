// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Progress event types emitted during agent execution
 */
export interface AgentRunnerProgressEvent {
  type:
    | 'session_started'
    | 'tool_started'
    | 'tool_completed'
    | 'session_updated'
    | 'child_agent_started'
    | 'session_completed';
  sessionId: string;
  parentSessionId?: string;
  agentName: string;
  timestamp: Date;
  data: any;
}

/**
 * Callback function type for progress events
 */
export type ProgressCallback = (event: AgentRunnerProgressEvent) => void;

/**
 * Simple event bus for agent runner progress events
 * Platform-agnostic implementation without external dependencies
 */
export class AgentRunnerEventBus {
  private static instance: AgentRunnerEventBus;
  private listeners: ProgressCallback[] = [];

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): AgentRunnerEventBus {
    if (!this.instance) {
      this.instance = new AgentRunnerEventBus();
    }
    return this.instance;
  }

  /**
   * Emit a progress event to all listeners
   */
  emitProgress(event: AgentRunnerProgressEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in AgentRunnerEventBus listener:', error);
      }
    }
  }

  /**
   * Add a progress event listener
   */
  addListener(callback: ProgressCallback): void {
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove a progress event listener
   */
  removeListener(callback: ProgressCallback): void {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners = [];
  }

  /**
   * Get the number of active listeners
   */
  getListenerCount(): number {
    return this.listeners.length;
  }
}
