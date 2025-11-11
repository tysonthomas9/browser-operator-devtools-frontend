// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  ChatMessageEntity,
  createUserMessage,
  createModelMessage,
  createToolResultMessage,
} from '../../src/messaging/ChatMessage';

describe('ChatMessage', () => {
  describe('createUserMessage', () => {
    it('should create a user message with text', () => {
      const message = createUserMessage('Hello, world!');

      expect(message.entity).toBe(ChatMessageEntity.USER);
      expect(message.text).toBe('Hello, world!');
      expect(message.imageInput).toBeUndefined();
    });

    it('should create a user message with image input', () => {
      const imageInput = {
        url: 'https://example.com/image.jpg',
        bytesBase64: 'base64data',
      };
      const message = createUserMessage('Describe this image', imageInput);

      expect(message.entity).toBe(ChatMessageEntity.USER);
      expect(message.text).toBe('Describe this image');
      expect(message.imageInput).toEqual(imageInput);
    });
  });

  describe('createModelMessage', () => {
    it('should create a model message for tool call', () => {
      const message = createModelMessage('tool', {
        toolName: 'search',
        toolArgs: { query: 'test' },
        toolCallId: '123',
      });

      expect(message.entity).toBe(ChatMessageEntity.MODEL);
      expect(message.action).toBe('tool');
      expect(message.isFinalAnswer).toBe(false);
      expect(message.toolName).toBe('search');
      expect(message.toolArgs).toEqual({ query: 'test' });
      expect(message.toolCallId).toBe('123');
    });

    it('should create a model message for final answer', () => {
      const message = createModelMessage('final', {
        answer: 'The answer is 42',
        reasoning: ['step 1', 'step 2'],
      });

      expect(message.entity).toBe(ChatMessageEntity.MODEL);
      expect(message.action).toBe('final');
      expect(message.isFinalAnswer).toBe(true);
      expect(message.answer).toBe('The answer is 42');
      expect(message.reasoning).toEqual(['step 1', 'step 2']);
    });
  });

  describe('createToolResultMessage', () => {
    it('should create a successful tool result message', () => {
      const message = createToolResultMessage('search', 'Found 10 results');

      expect(message.entity).toBe(ChatMessageEntity.TOOL_RESULT);
      expect(message.toolName).toBe('search');
      expect(message.resultText).toBe('Found 10 results');
      expect(message.isError).toBe(false);
    });

    it('should create an error tool result message', () => {
      const message = createToolResultMessage('search', 'API error', true);

      expect(message.entity).toBe(ChatMessageEntity.TOOL_RESULT);
      expect(message.toolName).toBe('search');
      expect(message.resultText).toBe('API error');
      expect(message.isError).toBe(true);
    });

    it('should create a tool result with additional options', () => {
      const message = createToolResultMessage('search', 'Results', false, {
        resultData: { count: 10 },
        toolCallId: '456',
        isFromConfigurableAgent: true,
        summary: 'Found 10 results',
      });

      expect(message.entity).toBe(ChatMessageEntity.TOOL_RESULT);
      expect(message.toolName).toBe('search');
      expect(message.resultText).toBe('Results');
      expect(message.isError).toBe(false);
      expect(message.resultData).toEqual({ count: 10 });
      expect(message.toolCallId).toBe('456');
      expect(message.isFromConfigurableAgent).toBe(true);
      expect(message.summary).toBe('Found 10 results');
    });

    it('should include image data when provided', () => {
      const message = createToolResultMessage('screenshot', 'Screenshot taken', false, {
        imageData: 'base64image',
      });

      expect(message.imageData).toBe('base64image');
    });
  });

  describe('ChatMessageEntity enum', () => {
    it('should have correct values', () => {
      expect(ChatMessageEntity.USER).toBe('user');
      expect(ChatMessageEntity.MODEL).toBe('model');
      expect(ChatMessageEntity.TOOL_RESULT).toBe('tool_result');
      expect(ChatMessageEntity.AGENT_SESSION).toBe('agent_session');
    });
  });
});
