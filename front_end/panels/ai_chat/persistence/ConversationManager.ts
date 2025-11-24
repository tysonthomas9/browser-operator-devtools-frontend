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
}
