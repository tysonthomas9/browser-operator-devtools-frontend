// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {DevToolsToSandboxMessage, SandboxToDevToolsMessage} from '../types/SandboxTypes.js';
import {getSandboxProtocol, type SandboxMessageHandler} from './SandboxProtocol.js';

/**
 * Request timeout in milliseconds
 */
const DEFAULT_REQUEST_TIMEOUT = 10000;

/**
 * Pending request tracking
 */
interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Message handler with priority
 */
interface PriorityHandler {
  handler: MessageHandler;
  priority: number;
}

/**
 * Message handler type
 */
export type MessageHandler = (appId: string, message: SandboxToDevToolsMessage) => void;

/**
 * Request message with correlation ID
 */
interface RequestMessage {
  type: string;
  payload?: unknown;
  __requestId: number;
}

/**
 * Response message with correlation ID
 */
interface ResponseMessage {
  type: string;
  payload?: unknown;
  __requestId?: number;
}

/**
 * MessageBus - Advanced message routing with request/response correlation
 *
 * Extends SandboxProtocol with:
 * - Request/response correlation (like BundlerWorker's pendingBuilds pattern)
 * - Message queuing for apps not yet ready
 * - Priority-based handler ordering
 *
 * @example
 * // Request/response pattern
 * const response = await messageBus.request<{count: number}>('app-1', 'get-count');
 * console.log(response.count);
 *
 * @example
 * // Queue messages until app is ready
 * messageBus.queue('app-1', {type: 'init', payload: {state: {}}});
 * messageBus.markReady('app-1'); // Flushes queued messages
 */
export class MessageBus {
  private static instance: MessageBus | null = null;

  private pendingRequests: Map<number, PendingRequest<unknown>> = new Map();
  private requestId = 1;
  private messageQueue: Map<string, DevToolsToSandboxMessage[]> = new Map();
  private readyApps: Set<string> = new Set();
  private handlers: Map<string, PriorityHandler[]> = new Map();
  private unsubscribeFns: Map<string, () => void> = new Map();

  private constructor() {
    // Subscribe to all messages to handle responses
    const protocol = getSandboxProtocol();
    const unsubscribe = protocol.subscribeAll(this.handleResponse.bind(this));
    this.unsubscribeFns.set('__global', unsubscribe);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    if (MessageBus.instance) {
      MessageBus.instance.destroy();
      MessageBus.instance = null;
    }
  }

  // ==========================================================================
  // Request/Response Correlation
  // ==========================================================================

  /**
   * Send a request and wait for a response with matching correlation ID.
   *
   * @param appId - Target app ID
   * @param type - Message type to send
   * @param payload - Optional message payload
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Promise that resolves with the response payload
   */
  request<T>(
    appId: string,
    type: string,
    payload?: unknown,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;

      // Setup timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} to ${appId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      // Send message with correlation ID
      // We need to cast through unknown because RequestMessage has __requestId
      // which isn't part of the union type
      const message = {
        type,
        payload,
        __requestId: id,
      } as unknown as DevToolsToSandboxMessage;

      this.send(appId, message).then(sent => {
        if (!sent) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(new Error(`Failed to send request to ${appId}: app not registered`));
        }
      });
    });
  }

  /**
   * Handle incoming responses and resolve pending requests
   */
  private handleResponse(message: SandboxToDevToolsMessage): void {
    const responseMsg = message as ResponseMessage;
    const requestId = responseMsg.__requestId;

    if (requestId === undefined) {
      // Not a response to a request, dispatch to handlers
      this.dispatchToHandlers(message);
      return;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      // Response for unknown request (may have timed out)
      return;
    }

    // Clear timeout and resolve
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.resolve(responseMsg.payload);
  }

  // ==========================================================================
  // Message Queuing
  // ==========================================================================

  /**
   * Queue a message to be sent when the app is ready.
   * If the app is already ready, the message is sent immediately.
   *
   * @param appId - Target app ID
   * @param message - Message to queue
   */
  queue(appId: string, message: DevToolsToSandboxMessage): void {
    if (this.readyApps.has(appId)) {
      // App is ready, send immediately
      this.send(appId, message);
      return;
    }

    // Queue the message
    if (!this.messageQueue.has(appId)) {
      this.messageQueue.set(appId, []);
    }
    this.messageQueue.get(appId)!.push(message);
  }

  /**
   * Mark an app as ready and flush any queued messages.
   *
   * @param appId - App ID to mark as ready
   */
  markReady(appId: string): void {
    this.readyApps.add(appId);
    this.flush(appId);
  }

  /**
   * Mark an app as not ready.
   *
   * @param appId - App ID to mark as not ready
   */
  markNotReady(appId: string): void {
    this.readyApps.delete(appId);
  }

  /**
   * Check if an app is marked as ready.
   *
   * @param appId - App ID to check
   * @returns true if app is ready
   */
  isReady(appId: string): boolean {
    return this.readyApps.has(appId);
  }

  /**
   * Flush all queued messages for an app.
   *
   * @param appId - App ID to flush messages for
   */
  flush(appId: string): void {
    const queue = this.messageQueue.get(appId);
    if (!queue || queue.length === 0) {
      return;
    }

    // Send all queued messages
    for (const message of queue) {
      this.send(appId, message);
    }

    // Clear queue
    this.messageQueue.delete(appId);
  }

  /**
   * Get the number of queued messages for an app.
   *
   * @param appId - App ID to check
   * @returns Number of queued messages
   */
  getQueueSize(appId: string): number {
    return this.messageQueue.get(appId)?.length || 0;
  }

  /**
   * Clear all queued messages for an app.
   *
   * @param appId - App ID to clear queue for
   */
  clearQueue(appId: string): void {
    this.messageQueue.delete(appId);
  }

  // ==========================================================================
  // Priority Handlers
  // ==========================================================================

  /**
   * Subscribe to messages of a specific type with optional priority.
   * Higher priority handlers are called first.
   *
   * @param messageType - Message type to listen for (or '*' for all)
   * @param handler - Handler function
   * @param priority - Handler priority (higher = called first, default 0)
   * @returns Unsubscribe function
   */
  on(messageType: string, handler: MessageHandler, priority = 0): () => void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }

    const handlers = this.handlers.get(messageType)!;
    handlers.push({handler, priority});

    // Sort by priority (descending)
    handlers.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => {
      const idx = handlers.findIndex(h => h.handler === handler);
      if (idx >= 0) {
        handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Subscribe to all message types.
   *
   * @param handler - Handler function
   * @param priority - Handler priority
   * @returns Unsubscribe function
   */
  onAll(handler: MessageHandler, priority = 0): () => void {
    return this.on('*', handler, priority);
  }

  /**
   * Dispatch a message to registered handlers.
   */
  private dispatchToHandlers(message: SandboxToDevToolsMessage): void {
    // Find source app ID from protocol
    const protocol = getSandboxProtocol();
    let sourceAppId = 'unknown';

    // Use the protocol's registered apps to find the source
    // For now, we'll pass 'unknown' as handlers can be registered per-app via subscribe

    // Dispatch to type-specific handlers
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      for (const {handler} of typeHandlers) {
        try {
          handler(sourceAppId, message);
        } catch (error) {
          console.error(`[MessageBus] Handler error for type ${message.type}:`, error);
        }
      }
    }

    // Dispatch to wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const {handler} of wildcardHandlers) {
        try {
          handler(sourceAppId, message);
        } catch (error) {
          console.error('[MessageBus] Wildcard handler error:', error);
        }
      }
    }
  }

  // ==========================================================================
  // Send Methods (delegate to SandboxProtocol)
  // ==========================================================================

  /**
   * Send a message to an app.
   * If the app is not ready and message has queue flag, it will be queued.
   *
   * @param appId - Target app ID
   * @param message - Message to send
   * @returns true if message was sent or queued successfully
   */
  send(appId: string, message: DevToolsToSandboxMessage): Promise<boolean> {
    return getSandboxProtocol().send(appId, message);
  }

  /**
   * Send a data update to an app.
   */
  sendDataUpdate(appId: string, path: string, value: unknown): Promise<boolean> {
    return getSandboxProtocol().sendDataUpdate(appId, path, value);
  }

  /**
   * Send an execute command to an app.
   */
  sendExecute(appId: string, action: string, args: Record<string, unknown> = {}): Promise<boolean> {
    return getSandboxProtocol().sendExecute(appId, action, args);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up resources for an app.
   *
   * @param appId - App ID to clean up
   */
  cleanupApp(appId: string): void {
    this.readyApps.delete(appId);
    this.messageQueue.delete(appId);

    // Cancel any pending requests for this app (we can't easily track which are for which app)
    // So this is a no-op for pending requests
  }

  /**
   * Destroy the message bus.
   */
  destroy(): void {
    // Clear all pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MessageBus destroyed'));
    }
    this.pendingRequests.clear();

    // Clear queues
    this.messageQueue.clear();
    this.readyApps.clear();
    this.handlers.clear();

    // Unsubscribe from protocol
    for (const unsubscribe of this.unsubscribeFns.values()) {
      unsubscribe();
    }
    this.unsubscribeFns.clear();
  }

  /**
   * Get count of pending requests (for testing).
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Get singleton instance.
 */
export function getMessageBus(): MessageBus {
  return MessageBus.getInstance();
}

/**
 * Reset singleton (for testing).
 */
export function resetMessageBus(): void {
  MessageBus.reset();
}
