// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export interface AgentRunnerProgressEvent {
  type: 'session_started' | 'tool_started' | 'tool_completed' | 'session_updated' | 'child_agent_started' | 'session_completed';
  sessionId: string;
  parentSessionId?: string;
  agentName: string;
  timestamp: Date;
  data: any;
}

/**
 * Custom event class for agent progress events
 */
export class AgentProgressCustomEvent extends CustomEvent<AgentRunnerProgressEvent> {
  constructor(detail: AgentRunnerProgressEvent) {
    super('agent-progress', { detail });
  }
}

/**
 * Event bus for agent runner progress events.
 * Uses standard EventTarget for portability across browser and Node.js environments.
 */
export class AgentRunnerEventBus extends EventTarget {
  private static instance: AgentRunnerEventBus;

  static getInstance(): AgentRunnerEventBus {
    if (!this.instance) {
      this.instance = new AgentRunnerEventBus();
    }
    return this.instance;
  }

  emitProgress(event: AgentRunnerProgressEvent, isBackground?: boolean): void {
    if (isBackground) {
      return;
    }
    this.dispatchEvent(new AgentProgressCustomEvent(event));
  }

  /**
   * Add a listener for agent progress events
   */
  addProgressListener(callback: (event: AgentRunnerProgressEvent) => void): void {
    this.addEventListener('agent-progress', ((e: Event) => {
      const customEvent = e as AgentProgressCustomEvent;
      callback(customEvent.detail);
    }) as EventListener);
  }

  /**
   * Remove a listener for agent progress events
   */
  removeProgressListener(callback: (event: AgentRunnerProgressEvent) => void): void {
    // Note: To properly remove the listener, the caller should store the wrapper function
    // This is a convenience method for simple use cases
    this.removeEventListener('agent-progress', callback as unknown as EventListener);
  }
}

// Alternative: Callback-based approach for static context
export type ProgressCallback = (event: AgentRunnerProgressEvent) => void;
