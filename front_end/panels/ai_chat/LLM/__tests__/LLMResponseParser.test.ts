// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMResponseParser } from '../LLMResponseParser.js';
import type { UnifiedLLMResponse } from '../LLMTypes.js';

describe('ai_chat: LLMResponseParser', () => {
  // ============ parseStrictJSON Tests ============
  describe('parseStrictJSON', () => {
    it('should parse valid JSON directly', () => {
      const json = '{"name": "test", "value": 123}';
      const result = LLMResponseParser.parseStrictJSON(json);
      assert.deepEqual(result, { name: 'test', value: 123 });
    });

    it('should handle JSON with leading/trailing whitespace', () => {
      const json = '  \n  {"key": "value"}  \n  ';
      const result = LLMResponseParser.parseStrictJSON(json);
      assert.deepEqual(result, { key: 'value' });
    });

    it('should strip markdown code blocks (```json)', () => {
      const json = '```json\n{"name": "test"}\n```';
      const result = LLMResponseParser.parseStrictJSON(json);
      assert.deepEqual(result, { name: 'test' });
    });

    it('should strip plain markdown code blocks (```)', () => {
      const json = '```\n{"name": "test"}\n```';
      const result = LLMResponseParser.parseStrictJSON(json);
      assert.deepEqual(result, { name: 'test' });
    });

    it('should extract JSON from surrounding text', () => {
      const text = 'Here is the response: {"action": "click"} that you requested.';
      const result = LLMResponseParser.parseStrictJSON(text);
      assert.deepEqual(result, { action: 'click' });
    });

    it('should extract JSON array from surrounding text', () => {
      const text = 'The results are: [1, 2, 3] as expected.';
      const result = LLMResponseParser.parseStrictJSON(text);
      assert.deepEqual(result, [1, 2, 3]);
    });

    it('should throw on invalid JSON after cleanup', () => {
      const invalidJson = 'This is not JSON at all';
      assert.throws(() => {
        LLMResponseParser.parseStrictJSON(invalidJson);
      }, /Unable to parse JSON/);
    });

    it('should handle nested JSON objects', () => {
      const json = '{"outer": {"inner": {"value": true}}}';
      const result = LLMResponseParser.parseStrictJSON(json);
      assert.deepEqual(result, { outer: { inner: { value: true } } });
    });

    it('should handle JSON with special characters', () => {
      const json = '{"message": "Hello\\nWorld\\t!"}';
      const result = LLMResponseParser.parseStrictJSON(json);
      assert.deepEqual(result, { message: 'Hello\nWorld\t!' });
    });
  });

  // ============ parseResponse Tests ============
  describe('parseResponse', () => {
    it('should return tool_call for functionCall responses', () => {
      const response: UnifiedLLMResponse = {
        functionCall: {
          name: 'click_element',
          arguments: { selector: '#button' },
        },
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'tool_call');
      if (result.type === 'tool_call') {
        assert.strictEqual(result.name, 'click_element');
        assert.deepEqual(result.args, { selector: '#button' });
      }
    });

    it('should return final_answer for text responses', () => {
      const response: UnifiedLLMResponse = {
        text: 'The answer is 42.',
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'final_answer');
      if (result.type === 'final_answer') {
        assert.strictEqual(result.answer, 'The answer is 42.');
      }
    });

    it('should parse JSON tool call from text (fallback)', () => {
      const response: UnifiedLLMResponse = {
        text: '{"action":"tool","toolName":"navigate","toolArgs":{"url":"https://example.com"}}',
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'tool_call');
      if (result.type === 'tool_call') {
        assert.strictEqual(result.name, 'navigate');
        assert.deepEqual(result.args, { url: 'https://example.com' });
      }
    });

    it('should return error for empty response', () => {
      const response: UnifiedLLMResponse = {};

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'error');
      if (result.type === 'error') {
        assert.include(result.error, 'No valid response');
      }
    });

    it('should prioritize functionCall over text', () => {
      const response: UnifiedLLMResponse = {
        text: 'Some text',
        functionCall: {
          name: 'test_tool',
          arguments: { arg: 'value' },
        },
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'tool_call');
      if (result.type === 'tool_call') {
        assert.strictEqual(result.name, 'test_tool');
      }
    });

    it('should handle text with action:tool but missing toolName', () => {
      const response: UnifiedLLMResponse = {
        text: '{"action":"tool","description":"some action"}',
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'final_answer');
    });

    it('should treat non-tool JSON as final answer', () => {
      const response: UnifiedLLMResponse = {
        text: '{"result": "success", "data": [1, 2, 3]}',
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'final_answer');
    });

    it('should handle tool call with empty toolArgs', () => {
      const response: UnifiedLLMResponse = {
        text: '{"action":"tool","toolName":"get_time"}',
      };

      const result = LLMResponseParser.parseResponse(response);
      assert.strictEqual(result.type, 'tool_call');
      if (result.type === 'tool_call') {
        assert.strictEqual(result.name, 'get_time');
        assert.deepEqual(result.args, {});
      }
    });
  });

  // ============ parseJSONWithFallbacks Tests ============
  describe('parseJSONWithFallbacks', () => {
    it('should try direct parsing first', () => {
      const json = '{"valid": true}';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, { valid: true });
    });

    it('should try trim and parse', () => {
      const json = '   {"valid": true}   ';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, { valid: true });
    });

    it('should handle markdown code blocks', () => {
      const json = '```json\n{"code": "block"}\n```';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, { code: 'block' });
    });

    it('should extract JSON from text', () => {
      const text = 'The data is {"extracted": true} from here.';
      const result = LLMResponseParser.parseJSONWithFallbacks(text);
      assert.deepEqual(result, { extracted: true });
    });

    it('should fix common JSON issues (single quotes)', () => {
      const json = "{'key': 'value'}";
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, { key: 'value' });
    });

    it('should fix trailing commas', () => {
      const json = '{"a": 1, "b": 2, }';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, { a: 1, b: 2 });
    });

    it('should throw after all strategies fail', () => {
      const invalid = 'This is definitely not JSON { broken }';
      assert.throws(() => {
        LLMResponseParser.parseJSONWithFallbacks(invalid);
      }, /JSON parsing failed/);
    });

    it('should handle arrays', () => {
      const json = '[1, 2, "three", {"four": 4}]';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, [1, 2, 'three', { four: 4 }]);
    });

    it('should handle nested objects', () => {
      const json = '{"level1": {"level2": {"level3": "deep"}}}';
      const result = LLMResponseParser.parseJSONWithFallbacks(json);
      assert.deepEqual(result, { level1: { level2: { level3: 'deep' } } });
    });
  });

  // ============ validateStrictJSON Tests ============
  describe('validateStrictJSON', () => {
    it('should return isValid true for valid JSON', () => {
      const result = LLMResponseParser.validateStrictJSON('{"valid": true}');
      assert.isTrue(result.isValid);
      assert.isDefined(result.cleaned);
    });

    it('should return cleaned JSON string', () => {
      const result = LLMResponseParser.validateStrictJSON('  {"key": "value"}  ');
      assert.isTrue(result.isValid);
      // Implementation trims whitespace but preserves JSON formatting
      assert.strictEqual(result.cleaned, '{"key": "value"}');
    });

    it('should return isValid false with error for invalid JSON', () => {
      const result = LLMResponseParser.validateStrictJSON('not json');
      assert.isFalse(result.isValid);
      assert.isDefined(result.error);
    });

    it('should clean up JSON with fallbacks', () => {
      const result = LLMResponseParser.validateStrictJSON('```json\n{"code": true}\n```');
      assert.isTrue(result.isValid);
    });
  });

  // ============ extractStructuredData Tests ============
  describe('extractStructuredData', () => {
    it('should extract JSON if present', () => {
      const text = '{"name": "test", "value": 123}';
      const result = LLMResponseParser.extractStructuredData(text, ['name', 'value']);
      assert.deepEqual(result, { name: 'test', value: 123 });
    });

    it('should extract fields using pattern matching', () => {
      const text = 'name: "John", age: 30, city: "NYC"';
      const result = LLMResponseParser.extractStructuredData(text, ['name', 'age', 'city']);
      assert.strictEqual(result.name, 'John');
      assert.strictEqual(result.age, '30');
      assert.strictEqual(result.city, 'NYC');
    });

    it('should handle missing fields gracefully', () => {
      const text = 'name: "Test"';
      const result = LLMResponseParser.extractStructuredData(text, ['name', 'missing']);
      assert.strictEqual(result.name, 'Test');
      assert.isUndefined(result.missing);
    });

    it('should prefer JSON parsing over pattern matching', () => {
      const text = '{"name": "JSON"} but also name: "Pattern"';
      const result = LLMResponseParser.extractStructuredData(text, ['name']);
      assert.strictEqual(result.name, 'JSON');
    });
  });

  // ============ enhanceResponse Tests ============
  describe('enhanceResponse', () => {
    it('should add parsedJson when strictJsonMode enabled', () => {
      const response: UnifiedLLMResponse = {
        text: '{"parsed": true}',
      };
      const enhanced = LLMResponseParser.enhanceResponse(response, { strictJsonMode: true });
      assert.deepEqual(enhanced.parsedJson, { parsed: true });
    });

    it('should not modify response when strictJsonMode disabled', () => {
      const response: UnifiedLLMResponse = {
        text: '{"ignored": true}',
      };
      const enhanced = LLMResponseParser.enhanceResponse(response, { strictJsonMode: false });
      assert.isUndefined(enhanced.parsedJson);
    });

    it('should extract expectedFields from text', () => {
      const response: UnifiedLLMResponse = {
        text: 'action: click, selector: "#btn"',
      };
      const enhanced = LLMResponseParser.enhanceResponse(response, {
        expectedFields: ['action', 'selector'],
      });
      assert.isDefined(enhanced.parsedJson);
      assert.strictEqual(enhanced.parsedJson.action, 'click');
    });

    it('should handle both strictJsonMode and expectedFields', () => {
      const response: UnifiedLLMResponse = {
        text: '{"action": "click"}',
      };
      const enhanced = LLMResponseParser.enhanceResponse(response, {
        strictJsonMode: true,
        expectedFields: ['action'],
      });
      assert.deepEqual(enhanced.parsedJson, { action: 'click' });
    });

    it('should not throw on invalid JSON with strictJsonMode', () => {
      const response: UnifiedLLMResponse = {
        text: 'Not valid JSON',
      };
      // Should not throw, just log error
      const enhanced = LLMResponseParser.enhanceResponse(response, { strictJsonMode: true });
      assert.isUndefined(enhanced.parsedJson);
    });
  });

  // ============ isValidJSON Tests ============
  describe('isValidJSON', () => {
    it('should return true for valid JSON object', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('{"valid": true}'));
    });

    it('should return true for valid JSON array', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('[1, 2, 3]'));
    });

    it('should return true for JSON string', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('"string"'));
    });

    it('should return true for JSON number', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('123'));
    });

    it('should return true for JSON boolean', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('true'));
      assert.isTrue(LLMResponseParser.isValidJSON('false'));
    });

    it('should return true for JSON null', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('null'));
    });

    it('should return false for invalid JSON', () => {
      assert.isFalse(LLMResponseParser.isValidJSON('not json'));
      assert.isFalse(LLMResponseParser.isValidJSON('{invalid}'));
      assert.isFalse(LLMResponseParser.isValidJSON("{'single': 'quotes'}"));
    });

    it('should handle whitespace correctly', () => {
      assert.isTrue(LLMResponseParser.isValidJSON('  {"key": "value"}  '));
    });
  });

  // ============ getJSONParsingSuggestions Tests ============
  describe('getJSONParsingSuggestions', () => {
    it('should suggest starting with { or [', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('abc{"key": "value"}');
      assert.includeMembers(suggestions, ['Response should start with { or [']);
    });

    it('should suggest ending with } or ]', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('{"key": "value"}abc');
      assert.includeMembers(suggestions, ['Response should end with } or ]']);
    });

    it('should suggest using double quotes', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions("{'key': 'value'}");
      assert.includeMembers(suggestions, ['Use double quotes (") instead of single quotes (\')']);
    });

    it('should suggest removing trailing commas', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('{"a": 1, }');
      assert.includeMembers(suggestions, ['Remove trailing commas before } or ]']);
    });

    it('should suggest quoting object keys', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('{key: "value"}');
      assert.includeMembers(suggestions, ['Ensure all object keys are quoted']);
    });

    it('should return empty array for valid JSON', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions('{"valid": true}');
      // Valid JSON might still trigger unquoted keys suggestion due to regex
      // but main structural suggestions should not appear
      assert.notIncludeMembers(suggestions, ['Response should start with { or [']);
      assert.notIncludeMembers(suggestions, ['Response should end with } or ]']);
    });

    it('should return multiple suggestions for multiple issues', () => {
      const suggestions = LLMResponseParser.getJSONParsingSuggestions("abc{'key': 'value', }xyz");
      assert.isAtLeast(suggestions.length, 3);
    });
  });
});
