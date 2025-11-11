// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AgentErrorHandler } from '../../src/agent/AgentErrorHandler';
import { ChatMessageEntity } from '../../src/messaging/ChatMessage';

describe('AgentErrorHandler', () => {
  describe('createErrorHandler', () => {
    it('should create an error handler with the given configuration', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: true,
        agentName: 'test_agent',
        availableTools: ['tool1', 'tool2'],
      });

      expect(handler).toBeInstanceOf(AgentErrorHandler);
    });
  });

  describe('handleUnknownTool', () => {
    it('should return error message when continueOnError is true', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: true,
        agentName: 'test_agent',
        availableTools: ['tool1', 'tool2'],
      });

      const result = handler.handleUnknownTool('unknown_tool', 'call-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage?.entity).toBe(ChatMessageEntity.TOOL_RESULT);
      expect(result.sessionMessage).toBeDefined();
    });

    it('should not continue when continueOnError is false', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: false,
        agentName: 'test_agent',
        availableTools: ['tool1', 'tool2'],
      });

      const result = handler.handleUnknownTool('unknown_tool', 'call-123');

      expect(result.shouldContinue).toBe(false);
      expect(result.errorMessage).toBeUndefined();
      expect(result.sessionMessage).toBeUndefined();
    });

    it('should include available tools in error message', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: true,
        agentName: 'test_agent',
        availableTools: ['tool1', 'tool2', 'tool3'],
      });

      const result = handler.handleUnknownTool('unknown_tool', 'call-123');

      expect(result.errorMessage).toBeDefined();
      const message = result.errorMessage as any;
      expect(message.resultText).toContain('tool1');
      expect(message.resultText).toContain('tool2');
      expect(message.resultText).toContain('tool3');
    });

    it('should handle empty available tools list', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: true,
        agentName: 'test_agent',
        availableTools: [],
      });

      const result = handler.handleUnknownTool('unknown_tool', 'call-123');

      expect(result.errorMessage).toBeDefined();
      const message = result.errorMessage as any;
      expect(message.resultText).toContain('No tools are currently available');
    });
  });

  describe('handleParsingError', () => {
    it('should return error message when continueOnError is true', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: true,
        agentName: 'test_agent',
      });

      const result = handler.handleParsingError('Invalid JSON');

      expect(result.shouldContinue).toBe(true);
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage?.entity).toBe(ChatMessageEntity.USER);
      expect(result.sessionMessage).toBeDefined();
    });

    it('should not continue when continueOnError is false', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: false,
        agentName: 'test_agent',
      });

      const result = handler.handleParsingError('Invalid JSON');

      expect(result.shouldContinue).toBe(false);
      expect(result.errorMessage).toBeUndefined();
      expect(result.sessionMessage).toBeUndefined();
    });

    it('should include error details in message', () => {
      const handler = AgentErrorHandler.createErrorHandler({
        continueOnError: true,
        agentName: 'test_agent',
      });

      const result = handler.handleParsingError('Invalid JSON format');

      expect(result.errorMessage).toBeDefined();
      const message = result.errorMessage as any;
      expect(message.text).toContain('Invalid JSON format');
      expect(message.text).toContain('could not be parsed');
    });
  });
});
