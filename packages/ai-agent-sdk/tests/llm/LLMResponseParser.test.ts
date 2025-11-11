// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMResponseParser } from '../../src/llm/LLMResponseParser';
import type { UnifiedLLMResponse } from '../../src/llm/LLMTypes';

describe('LLMResponseParser', () => {
  describe('parseStrictJSON', () => {
    it('should parse valid JSON', () => {
      const json = '{"key": "value"}';
      const result = LLMResponseParser.parseStrictJSON(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle JSON with markdown code blocks', () => {
      const json = '```json\n{"key": "value"}\n```';
      const result = LLMResponseParser.parseStrictJSON(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle JSON with plain code blocks', () => {
      const json = '```\n{"key": "value"}\n```';
      const result = LLMResponseParser.parseStrictJSON(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from text', () => {
      const json = 'Some text before {"key": "value"} some text after';
      const result = LLMResponseParser.parseStrictJSON(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw on invalid JSON', () => {
      const json = 'not json at all';
      expect(() => LLMResponseParser.parseStrictJSON(json)).toThrow();
    });
  });

  describe('parseResponse', () => {
    it('should parse function call response', () => {
      const response: UnifiedLLMResponse = {
        functionCall: {
          name: 'test_function',
          arguments: { arg1: 'value1' },
        },
        rawResponse: {},
      };
      const result = LLMResponseParser.parseResponse(response);
      expect(result).toEqual({
        type: 'tool_call',
        name: 'test_function',
        args: { arg1: 'value1' },
      });
    });

    it('should parse text response as final answer', () => {
      const response: UnifiedLLMResponse = {
        text: 'This is the final answer',
        rawResponse: {},
      };
      const result = LLMResponseParser.parseResponse(response);
      expect(result).toEqual({
        type: 'final_answer',
        answer: 'This is the final answer',
      });
    });

    it('should parse JSON tool call from text', () => {
      const response: UnifiedLLMResponse = {
        text: '{"action":"tool","toolName":"search","toolArgs":{"query":"test"}}',
        rawResponse: {},
      };
      const result = LLMResponseParser.parseResponse(response);
      expect(result).toEqual({
        type: 'tool_call',
        name: 'search',
        args: { query: 'test' },
      });
    });

    it('should return error for empty response', () => {
      const response: UnifiedLLMResponse = {
        rawResponse: {},
      };
      const result = LLMResponseParser.parseResponse(response);
      expect(result).toEqual({
        type: 'error',
        error: 'No valid response from LLM',
      });
    });
  });

  describe('parseJSONWithFallbacks', () => {
    it('should parse valid JSON', () => {
      const json = '{"key": "value"}';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle whitespace', () => {
      const json = '  \n  {"key": "value"}  \n  ';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle markdown code blocks', () => {
      const json = '```json\n{"key": "value"}\n```';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from mixed text', () => {
      const json = 'Here is the result: {"key": "value"} end';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw on completely invalid JSON', () => {
      const json = 'not json at all';
      expect(() => LLMResponseParser.parseJSONWithFallbacks(json)).toThrow();
    });
  });

  describe('validateStrictJSON', () => {
    it('should validate correct JSON', () => {
      const result = LLMResponseParser.validateStrictJSON('{"key": "value"}');
      expect(result.isValid).toBe(true);
      expect(result.cleaned).toBe('{"key": "value"}');
    });

    it('should validate and clean JSON with whitespace', () => {
      const result = LLMResponseParser.validateStrictJSON('  {"key": "value"}  ');
      expect(result.isValid).toBe(true);
      expect(result.cleaned).toBeDefined();
    });

    it('should return error for invalid JSON', () => {
      const result = LLMResponseParser.validateStrictJSON('not json');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('extractStructuredData', () => {
    it('should parse JSON and return data', () => {
      const text = '{"name": "John", "age": 30}';
      const result = LLMResponseParser.extractStructuredData(text, ['name', 'age']);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should extract fields from text', () => {
      const text = 'name: "John" and age: 30';
      const result = LLMResponseParser.extractStructuredData(text, ['name', 'age']);
      expect(result.name).toBe('John');
      // Note: age extraction might be string "30"
    });

    it('should handle missing fields', () => {
      const text = '{"name": "John"}';
      const result = LLMResponseParser.extractStructuredData(text, ['name', 'age']);
      expect(result.name).toBe('John');
      expect(result.age).toBeUndefined();
    });
  });

  describe('isValidJSON', () => {
    it('should return true for valid JSON', () => {
      expect(LLMResponseParser.isValidJSON('{"key": "value"}')).toBe(true);
      expect(LLMResponseParser.isValidJSON('[]')).toBe(true);
      expect(LLMResponseParser.isValidJSON('null')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(LLMResponseParser.isValidJSON('not json')).toBe(false);
      expect(LLMResponseParser.isValidJSON('{key: value}')).toBe(false);
    });
  });

  describe('getJSONParsingSuggestions', () => {
    it('should suggest starting with bracket', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('not json');
      expect(suggestions).toContain('Response should start with { or [');
    });

    it('should suggest ending with bracket', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('{incomplete');
      expect(suggestions).toContain('Response should end with } or ]');
    });

    it('should suggest double quotes', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions("{'key': 'value'}");
      expect(suggestions).toContain('Use double quotes (") instead of single quotes (\')');
    });

    it('should suggest removing trailing commas', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('{"key": "value",}');
      expect(suggestions).toContain('Remove trailing commas before } or ]');
    });
  });
});
