// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { sanitizeMessagesForModel } from '../../src/llm/MessageSanitizer';
import type { LLMMessage } from '../../src/llm/LLMTypes';

describe('MessageSanitizer', () => {
  describe('sanitizeMessagesForModel', () => {
    describe('Vision-capable models', () => {
      it('should return cloned messages unchanged for vision-capable models', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.jpg' },
              },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: true });

        expect(result).toHaveLength(1);
        expect(result[0].content).toEqual(messages[0].content);
        expect(result).not.toBe(messages); // Should be a clone
      });
    });

    describe('Non-vision models', () => {
      it('should remove image parts from messages', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.jpg' },
              },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Describe this image');
      });

      it('should remove file parts from messages', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this file' },
              {
                type: 'file',
                file: { filename: 'doc.pdf', file_data: 'data:application/pdf;base64,...' },
              },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Read this file');
      });

      it('should keep text-only messages unchanged', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: 'Just text',
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Just text');
      });

      it('should handle messages with undefined content', () => {
        const messages: LLMMessage[] = [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: '123',
                type: 'function',
                function: { name: 'test', arguments: '{}' },
              },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBeUndefined();
        expect(result[0].tool_calls).toBeDefined();
      });

      it('should replace image-only messages with placeholder when enabled', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.jpg' },
              },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, {
          visionCapable: false,
          placeholderForImageOnly: true,
        });

        expect(result).toHaveLength(1);
        expect(result[0].content).toEqual([
          { type: 'text', text: 'Image omitted (model lacks vision).' },
        ]);
      });

      it('should replace image-only messages with empty string when placeholder disabled', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.jpg' },
              },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, {
          visionCapable: false,
          placeholderForImageOnly: false,
        });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('');
      });

      it('should collapse single text part to string', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Hello');
      });

      it('should keep multiple text parts as array', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' },
            ],
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(Array.isArray(result[0].content)).toBe(true);
        expect((result[0].content as any)).toHaveLength(2);
      });

      it('should preserve other message properties', () => {
        const messages: LLMMessage[] = [
          {
            role: 'tool',
            content: 'Tool result',
            tool_call_id: '123',
            name: 'test_tool',
          },
        ];

        const result = sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('tool');
        expect(result[0].tool_call_id).toBe('123');
        expect(result[0].name).toBe('test_tool');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty message array', () => {
        const messages: LLMMessage[] = [];
        const result = sanitizeMessagesForModel(messages, { visionCapable: false });
        expect(result).toEqual([]);
      });

      it('should not mutate original messages', () => {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.jpg' },
              },
            ],
          },
        ];

        const originalContent = JSON.stringify(messages[0].content);
        sanitizeMessagesForModel(messages, { visionCapable: false });

        expect(JSON.stringify(messages[0].content)).toBe(originalContent);
      });
    });
  });
});
