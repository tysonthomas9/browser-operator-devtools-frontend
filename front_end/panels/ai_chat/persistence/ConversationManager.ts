// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {createLogger} from '../core/Logger.js';
import type {AgentState} from '../core/State.js';
import type {AgentSession} from '../agent_framework/AgentSessionTypes.js';
import {ConversationStorageManager} from './ConversationStorageManager.js';
import {
  type ConversationMetadata,
  deserializeAgentSession,
  deserializeAgentState,
  extractMetadata,
  generatePreview,
  generateTitle,
  serializeAgentSession,
  serializeAgentState,
  type StoredConversation,
} from './ConversationTypes.js';

const logger = createLogger('ConversationManager');

/**
 * High-level manager for conversation lifecycle operations
 */
export class ConversationManager {
  private static instance: ConversationManager|null = null;
  private storageManager: ConversationStorageManager;

  // 30 minutes timeout for stale 'processing' status
  private static readonly PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

  private constructor() {
    this.storageManager = ConversationStorageManager.getInstance();
    logger.info('Initialized ConversationManager');
  }

  static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  /**
   * Creates a new conversation from the current agent state
   */
  async createConversation(state: AgentState, agentSessions: AgentSession[] = []): Promise<StoredConversation> {
    const now = Date.now();
    const id = this.storageManager.generateConversationId();

    const conversation: StoredConversation = {
      id,
      title: generateTitle(state.messages),
      createdAt: now,
      updatedAt: now,
      state: serializeAgentState(state),
      agentSessions: agentSessions.map(serializeAgentSession),
      preview: generatePreview(state.messages),
      messageCount: state.messages.length,
    };

    await this.storageManager.saveConversation(conversation);

    logger.info('Created new conversation', {conversationId: id, title: conversation.title});
    return conversation;
  }

  /**
   * Saves the current conversation state
   */
  async saveConversation(
      conversationId: string, state: AgentState, agentSessions: AgentSession[] = []): Promise<void> {
    // Check if conversation exists
    const existingConversation = await this.storageManager.loadConversation(conversationId);

    if (!existingConversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Update the conversation with current state
    const updatedConversation: StoredConversation = {
      ...existingConversation,
      state: serializeAgentState(state),
      agentSessions: agentSessions.map(serializeAgentSession),
      preview: generatePreview(state.messages),
      messageCount: state.messages.length,
      // Keep the existing title unless it's still the default
      title: existingConversation.title === 'New Chat' ? generateTitle(state.messages) : existingConversation.title,
    };

    await this.storageManager.saveConversation(updatedConversation);

    logger.info('Saved conversation', {conversationId, messageCount: state.messages.length});
  }

  /**
   * Loads a conversation and returns its state and sessions
   */
  async loadConversation(conversationId: string):
      Promise<{state: AgentState, agentSessions: AgentSession[], conversation: StoredConversation}|null> {
    const conversation = await this.storageManager.loadConversation(conversationId);

    if (!conversation) {
      logger.warn('Conversation not found', {conversationId});
      return null;
    }

    const state = deserializeAgentState(conversation.state);
    const agentSessions = conversation.agentSessions.map(deserializeAgentSession);

    logger.info('Loaded conversation', {conversationId, messageCount: state.messages.length});

    return {
      state,
      agentSessions,
      conversation,
    };
  }

  /**
   * Lists all conversations
   */
  async listConversations(): Promise<ConversationMetadata[]> {
    return await this.storageManager.listConversations();
  }

  /**
   * Deletes a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.storageManager.deleteConversation(conversationId);
    logger.info('Deleted conversation', {conversationId});
  }

  /**
   * Updates a conversation title
   */
  async updateConversationTitle(conversationId: string, newTitle: string): Promise<void> {
    await this.storageManager.updateConversationTitle(conversationId, newTitle);
    logger.info('Updated conversation title', {conversationId, newTitle});
  }

  /**
   * Checks if a conversation exists
   */
  async conversationExists(conversationId: string): Promise<boolean> {
    return await this.storageManager.conversationExists(conversationId);
  }

  /**
   * Auto-saves a conversation, creating it if it doesn't exist
   * Returns the conversation ID
   */
  async autoSaveConversation(
      currentConversationId: string|null, state: AgentState, agentSessions: AgentSession[] = []): Promise<string> {
    // Don't save if there are no messages
    if (state.messages.length === 0) {
      logger.debug('Skipping auto-save: no messages');
      return currentConversationId || '';
    }

    try {
      if (!currentConversationId) {
        // Create new conversation
        const conversation = await this.createConversation(state, agentSessions);
        return conversation.id;
      } else {
        // Update existing conversation
        await this.saveConversation(currentConversationId, state, agentSessions);
        return currentConversationId;
      }
    } catch (error) {
      logger.error('Failed to auto-save conversation', {error, currentConversationId});
      // Return the current ID even if save failed
      return currentConversationId || '';
    }
  }

  /**
   * Clears all conversations (for testing or reset)
   */
  async clearAllConversations(): Promise<void> {
    await this.storageManager.clearAllConversations();
    logger.info('Cleared all conversations');
  }

  // ==================== Memory Processing Methods ====================

  /**
   * Attempts to claim a conversation for memory processing.
   * Returns true if claimed successfully, false if already processing.
   * Uses 'processing' status as a lock to prevent concurrent processing.
   *
   * Will re-claim if:
   * - Status is 'failed' (retry)
   * - Status is 'processing' but started > 30 min ago (stale/crashed)
   */
  async tryClaimForMemoryProcessing(conversationId: string): Promise<boolean> {
    const conversation = await this.storageManager.loadConversation(conversationId);
    if (!conversation) {
      return false;
    }

    // Already completed - don't reprocess
    if (conversation.memoryStatus === 'completed') {
      return false;
    }

    // Currently processing - check if stale (> 30 min)
    if (conversation.memoryStatus === 'processing') {
      const startedAt = conversation.memoryProcessingStartedAt || 0;
      const elapsed = Date.now() - startedAt;
      if (elapsed < ConversationManager.PROCESSING_TIMEOUT_MS) {
        // Still within timeout, don't re-claim
        return false;
      }
      // Stale processing - allow re-claim
      logger.warn('Re-claiming stale processing conversation', {
        conversationId,
        elapsedMs: elapsed,
      });
    }

    // Claim it by setting to 'processing' with timestamp
    conversation.memoryStatus = 'processing';
    conversation.memoryProcessingStartedAt = Date.now();
    await this.storageManager.saveConversation(conversation);
    logger.info('Claimed conversation for memory processing', {conversationId});
    return true;
  }

  /**
   * Marks memory processing as completed.
   */
  async markMemoryCompleted(conversationId: string): Promise<void> {
    const conversation = await this.storageManager.loadConversation(conversationId);
    if (conversation) {
      conversation.memoryStatus = 'completed';
      conversation.memoryProcessedAt = Date.now();
      await this.storageManager.saveConversation(conversation);
      logger.info('Marked memory as completed', {conversationId});
    }
  }

  /**
   * Marks memory processing as failed (can be retried later).
   */
  async markMemoryFailed(conversationId: string): Promise<void> {
    const conversation = await this.storageManager.loadConversation(conversationId);
    if (conversation) {
      conversation.memoryStatus = 'failed';
      await this.storageManager.saveConversation(conversation);
      logger.warn('Marked memory as failed', {conversationId});
    }
  }

  /**
   * Returns conversations that need memory processing.
   * Includes:
   * - pending, failed, or undefined status (old conversations)
   * - 'processing' that started > 30 min ago (stale/crashed)
   */
  async getConversationsNeedingMemoryProcessing(): Promise<ConversationMetadata[]> {
    const all = await this.listConversations();
    const now = Date.now();

    return all.filter(c => {
      // Not started, pending, or failed - needs processing
      if (!c.memoryStatus ||
          c.memoryStatus === 'pending' ||
          c.memoryStatus === 'failed') {
        return true;
      }

      // Stale processing (> 30 min) - needs retry
      if (c.memoryStatus === 'processing') {
        const startedAt = c.memoryProcessingStartedAt || 0;
        const elapsed = now - startedAt;
        return elapsed >= ConversationManager.PROCESSING_TIMEOUT_MS;
      }

      return false;
    });
  }
}
