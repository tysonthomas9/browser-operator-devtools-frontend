// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { findClosestModel, findClosestModelWithInfo } from '../FuzzyModelMatcher.js';

describe('ai_chat: FuzzyModelMatcher', () => {
  describe('findClosestModel', () => {
    describe('exact match', () => {
      it('returns exact match when available', () => {
        const available = ['gpt-4.1-2025-04-14', 'gpt-4.1-mini-2025-04-14'];
        assert.strictEqual(findClosestModel('gpt-4.1-2025-04-14', available), 'gpt-4.1-2025-04-14');
      });

      it('returns null for empty target', () => {
        const available = ['gpt-4.1-2025-04-14'];
        assert.isNull(findClosestModel('', available));
      });

      it('returns null for empty available list', () => {
        assert.isNull(findClosestModel('gpt-4.1', []));
      });
    });

    describe('prefix match', () => {
      it('matches when target is prefix of available model', () => {
        const available = ['claude-sonnet-4-5-20250514', 'claude-haiku-4-5-20250514'];
        assert.strictEqual(findClosestModel('claude-sonnet-4-5', available), 'claude-sonnet-4-5-20250514');
      });

      it('matches gpt model prefix with date suffix', () => {
        const available = ['gpt-4.1-2025-04-14', 'gpt-4.1-mini-2025-04-14'];
        assert.strictEqual(findClosestModel('gpt-4.1', available), 'gpt-4.1-2025-04-14');
      });

      it('returns shortest prefix match when multiple matches exist', () => {
        const available = ['claude-sonnet-4', 'claude-sonnet-4-5', 'claude-sonnet-4-5-20250514'];
        assert.strictEqual(findClosestModel('claude-sonnet', available), 'claude-sonnet-4');
      });

      it('handles dot vs dash variations in prefix', () => {
        const available = ['claude-sonnet-4-5-20250514'];
        assert.strictEqual(findClosestModel('claude-sonnet-4.5', available), 'claude-sonnet-4-5-20250514');
      });
    });

    describe('normalized match', () => {
      it('matches models ignoring date suffix', () => {
        const available = ['gemini-2.5-pro-20250514'];
        // After normalization, 'gemini25pro' should match
        assert.strictEqual(findClosestModel('gemini-2.5-pro', available), 'gemini-2.5-pro-20250514');
      });

      it('matches models ignoring separators', () => {
        const available = ['claude-sonnet-4-5-20250514'];
        // 'claude_sonnet_4_5' normalized becomes 'claudesonnet45'
        assert.strictEqual(findClosestModel('claude_sonnet_4_5', available), 'claude-sonnet-4-5-20250514');
      });
    });

    describe('similarity match', () => {
      it('matches similar model names above threshold', () => {
        const available = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gpt-4.1'];
        // 'gemini-pro' should fuzzy match to 'gemini-2.5-pro'
        const result = findClosestModel('gemini-pro', available);
        assert.strictEqual(result, 'gemini-2.5-pro');
      });

      it('returns null for dissimilar models below threshold', () => {
        const available = ['gpt-4.1-2025-04-14', 'claude-sonnet-4-5-20250514'];
        assert.isNull(findClosestModel('completely-different-model', available));
      });

      it('respects custom threshold', () => {
        const available = ['gpt-4.1-2025-04-14'];
        // With very high threshold, even similar names won't match
        assert.isNull(findClosestModel('gpt-4', available, 0.99));
      });
    });

    describe('real-world model names', () => {
      const anthropicModels = [
        'claude-sonnet-4-5-20250514',
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-haiku-4-20250514',
        'claude-3-5-sonnet-20241022',
      ];

      const googleModels = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-pro',
      ];

      const openaiModels = [
        'gpt-4.1-2025-04-14',
        'gpt-4.1-mini-2025-04-14',
        'gpt-4.1-nano-2025-04-14',
        'o4-mini-2025-04-16',
      ];

      it('matches Anthropic short names to full names', () => {
        assert.strictEqual(findClosestModel('claude-sonnet-4-5', anthropicModels), 'claude-sonnet-4-5-20250514');
        assert.strictEqual(findClosestModel('claude-haiku-4', anthropicModels), 'claude-haiku-4-20250514');
        assert.strictEqual(findClosestModel('claude-opus-4', anthropicModels), 'claude-opus-4-20250514');
      });

      it('matches Google AI model variations', () => {
        assert.strictEqual(findClosestModel('gemini-2.5-pro', googleModels), 'gemini-2.5-pro');
        assert.strictEqual(findClosestModel('gemini-flash', googleModels), 'gemini-2.5-flash');
      });

      it('matches OpenAI model variations', () => {
        assert.strictEqual(findClosestModel('gpt-4.1', openaiModels), 'gpt-4.1-2025-04-14');
        assert.strictEqual(findClosestModel('gpt-4.1-mini', openaiModels), 'gpt-4.1-mini-2025-04-14');
      });
    });
  });

  describe('findClosestModelWithInfo', () => {
    it('returns exact match type', () => {
      const available = ['gpt-4.1-2025-04-14'];
      const result = findClosestModelWithInfo('gpt-4.1-2025-04-14', available);
      assert.strictEqual(result.match, 'gpt-4.1-2025-04-14');
      assert.strictEqual(result.matchType, 'exact');
      assert.strictEqual(result.score, 1);
    });

    it('returns prefix match type', () => {
      const available = ['claude-sonnet-4-5-20250514'];
      const result = findClosestModelWithInfo('claude-sonnet-4-5', available);
      assert.strictEqual(result.match, 'claude-sonnet-4-5-20250514');
      assert.strictEqual(result.matchType, 'prefix');
      assert.isAbove(result.score, 0);
    });

    it('returns normalized match type', () => {
      const available = ['claude-sonnet-4-5-20250514'];
      const result = findClosestModelWithInfo('claude_sonnet_4_5', available);
      assert.strictEqual(result.match, 'claude-sonnet-4-5-20250514');
      assert.strictEqual(result.matchType, 'normalized');
    });

    it('returns similarity match type', () => {
      const available = ['gemini-2.5-pro'];
      const result = findClosestModelWithInfo('gemini-pro', available);
      assert.strictEqual(result.match, 'gemini-2.5-pro');
      assert.strictEqual(result.matchType, 'similarity');
      assert.isAbove(result.score, 0.5);
    });

    it('returns none match type when no match found', () => {
      const available = ['gpt-4.1-2025-04-14'];
      const result = findClosestModelWithInfo('completely-unrelated', available);
      assert.isNull(result.match);
      assert.strictEqual(result.matchType, 'none');
      assert.strictEqual(result.score, 0);
    });
  });
});
