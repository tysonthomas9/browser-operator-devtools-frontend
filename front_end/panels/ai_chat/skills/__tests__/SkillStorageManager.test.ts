// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { assert } from 'chai';
import { SkillStorageManager } from '../SkillStorageManager.js';
import type { CreateSkillInput } from '../types/SkillTypes.js';

describe('SkillStorageManager', () => {
  let manager: SkillStorageManager;

  const validInput: CreateSkillInput = {
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart',
    source: `
      const button = await helpers.waitForElement('[data-action="add-to-cart"]');
      await helpers.click(button);
      return { success: true };
    `,
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID to add' },
      },
      required: ['productId'],
    },
    domain: 'amazon.com',
    tags: ['ecommerce', 'cart'],
  };

  beforeEach(() => {
    SkillStorageManager.resetInstance();
    manager = SkillStorageManager.getInstance();
  });

  describe('createSkill', () => {
    it('creates skill with valid input', async () => {
      const skill = await manager.createSkill(validInput);

      assert.exists(skill.id);
      assert.strictEqual(skill.name, validInput.name);
      assert.strictEqual(skill.description, validInput.description);
      assert.strictEqual(skill.domain, validInput.domain);
      assert.strictEqual(skill.version, 1);
    });

    it('generates UUID and timestamps', async () => {
      const skill = await manager.createSkill(validInput);

      assert.match(skill.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.exists(skill.createdAt);
      assert.exists(skill.updatedAt);
    });

    it('initializes verification as unverified', async () => {
      const skill = await manager.createSkill(validInput);

      assert.strictEqual(skill.verification.status, 'unverified');
      assert.strictEqual(skill.verification.testCount, 0);
      assert.strictEqual(skill.verification.successCount, 0);
      assert.strictEqual(skill.verification.consecutiveFailures, 0);
      assert.strictEqual(skill.verification.requiredSuccesses, 3);
    });

    it('rejects duplicate name+domain combination', async () => {
      await manager.createSkill(validInput);

      try {
        await manager.createSkill(validInput);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'already exists');
      }
    });

    it('validates name format (snake_case)', async () => {
      const invalidNames = ['AddToCart', 'add-to-cart', '123abc', 'add to cart'];

      for (const name of invalidNames) {
        try {
          await manager.createSkill({ ...validInput, name });
          assert.fail(`Should have rejected name: ${name}`);
        } catch (error) {
          assert.include((error as Error).message, 'lowercase');
        }
      }
    });

    it('validates schema structure', async () => {
      try {
        await manager.createSkill({
          ...validInput,
          schema: { type: 'array' } as any,
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'type "object"');
      }
    });
  });

  describe('getSkillsByDomain', () => {
    it('returns skills matching domain', async () => {
      await manager.createSkill(validInput);
      await manager.createSkill({
        ...validInput,
        name: 'checkout',
        domain: 'ebay.com',
      });

      const skills = await manager.getSkillsByDomain('amazon.com');

      assert.lengthOf(skills, 1);
      assert.strictEqual(skills[0].name, 'add_to_cart');
    });

    it('returns empty array for unknown domain', async () => {
      await manager.createSkill(validInput);

      const skills = await manager.getSkillsByDomain('unknown.com');

      assert.lengthOf(skills, 0);
    });

    it('matches subdomains to parent domain', async () => {
      await manager.createSkill(validInput);

      const skills = await manager.getSkillsByDomain('smile.amazon.com');

      assert.lengthOf(skills, 1);
      assert.strictEqual(skills[0].name, 'add_to_cart');
    });
  });

  describe('getVerifiedSkills', () => {
    it('returns only skills with status=verified', async () => {
      const skill = await manager.createSkill(validInput);

      // Record 3 successful tests
      for (let i = 0; i < 3; i++) {
        await manager.recordTest(skill.id, {
          skillId: skill.id,
          args: { productId: 'test' },
          result: {
            success: true,
            output: { success: true },
            executionTimeMs: 100,
            capturedAt: new Date().toISOString(),
          },
          pageUrl: 'https://amazon.com/product/123',
          timestamp: new Date().toISOString(),
        });
      }

      const verified = await manager.getVerifiedSkills();

      assert.lengthOf(verified, 1);
      assert.strictEqual(verified[0].verification.status, 'verified');
    });

    it('filters by domain when provided', async () => {
      // Create and verify skill for amazon
      const amazonSkill = await manager.createSkill(validInput);
      for (let i = 0; i < 3; i++) {
        await manager.recordTest(amazonSkill.id, {
          skillId: amazonSkill.id,
          args: {},
          result: { success: true, executionTimeMs: 100, capturedAt: new Date().toISOString() },
          pageUrl: 'https://amazon.com',
          timestamp: new Date().toISOString(),
        });
      }

      // Create and verify skill for ebay
      const ebaySkill = await manager.createSkill({ ...validInput, name: 'checkout', domain: 'ebay.com' });
      for (let i = 0; i < 3; i++) {
        await manager.recordTest(ebaySkill.id, {
          skillId: ebaySkill.id,
          args: {},
          result: { success: true, executionTimeMs: 100, capturedAt: new Date().toISOString() },
          pageUrl: 'https://ebay.com',
          timestamp: new Date().toISOString(),
        });
      }

      const amazonVerified = await manager.getVerifiedSkills('amazon.com');
      const ebayVerified = await manager.getVerifiedSkills('ebay.com');

      assert.lengthOf(amazonVerified, 1);
      assert.lengthOf(ebayVerified, 1);
    });
  });

  describe('recordTest', () => {
    it('increments testCount', async () => {
      const skill = await manager.createSkill(validInput);

      await manager.recordTest(skill.id, {
        skillId: skill.id,
        args: {},
        result: { success: true, executionTimeMs: 100, capturedAt: new Date().toISOString() },
        pageUrl: 'https://amazon.com',
        timestamp: new Date().toISOString(),
      });

      const updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.testCount, 1);
    });

    it('increments successCount on success', async () => {
      const skill = await manager.createSkill(validInput);

      await manager.recordTest(skill.id, {
        skillId: skill.id,
        args: {},
        result: { success: true, executionTimeMs: 100, capturedAt: new Date().toISOString() },
        pageUrl: 'https://amazon.com',
        timestamp: new Date().toISOString(),
      });

      const updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.successCount, 1);
    });

    it('resets consecutiveFailures on success', async () => {
      const skill = await manager.createSkill(validInput);

      // First fail
      await manager.recordTest(skill.id, {
        skillId: skill.id,
        args: {},
        result: { success: false, error: 'Test error', executionTimeMs: 100, capturedAt: new Date().toISOString() },
        pageUrl: 'https://amazon.com',
        timestamp: new Date().toISOString(),
      });

      let updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.consecutiveFailures, 1);

      // Then succeed
      await manager.recordTest(skill.id, {
        skillId: skill.id,
        args: {},
        result: { success: true, executionTimeMs: 100, capturedAt: new Date().toISOString() },
        pageUrl: 'https://amazon.com',
        timestamp: new Date().toISOString(),
      });

      updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.consecutiveFailures, 0);
    });

    it('increments consecutiveFailures on failure', async () => {
      const skill = await manager.createSkill(validInput);

      for (let i = 0; i < 2; i++) {
        await manager.recordTest(skill.id, {
          skillId: skill.id,
          args: {},
          result: { success: false, error: 'Test error', executionTimeMs: 100, capturedAt: new Date().toISOString() },
          pageUrl: 'https://amazon.com',
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.consecutiveFailures, 2);
    });

    it('marks as verified when successCount >= 3', async () => {
      const skill = await manager.createSkill(validInput);

      for (let i = 0; i < 3; i++) {
        await manager.recordTest(skill.id, {
          skillId: skill.id,
          args: {},
          result: { success: true, executionTimeMs: 100, capturedAt: new Date().toISOString() },
          pageUrl: 'https://amazon.com',
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.status, 'verified');
    });

    it('marks as failing when consecutiveFailures >= 3', async () => {
      const skill = await manager.createSkill(validInput);

      for (let i = 0; i < 3; i++) {
        await manager.recordTest(skill.id, {
          skillId: skill.id,
          args: {},
          result: { success: false, error: 'Test error', executionTimeMs: 100, capturedAt: new Date().toISOString() },
          pageUrl: 'https://amazon.com',
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await manager.getSkill(skill.id);
      assert.strictEqual(updated?.verification.status, 'failing');
    });
  });

  describe('domainMatches', () => {
    it('matches exact domain', () => {
      assert.isTrue(manager.domainMatches('amazon.com', 'amazon.com'));
    });

    it('matches subdomain to parent domain', () => {
      assert.isTrue(manager.domainMatches('amazon.com', 'smile.amazon.com'));
      assert.isTrue(manager.domainMatches('amazon.com', 'www.amazon.com'));
      assert.isTrue(manager.domainMatches('amazon.com', 'sub.deep.amazon.com'));
    });

    it('rejects mismatched domains', () => {
      assert.isFalse(manager.domainMatches('amazon.com', 'ebay.com'));
      assert.isFalse(manager.domainMatches('amazon.com', 'notamazon.com'));
    });
  });

  describe('importSkills/exportSkills', () => {
    it('exports all skills as JSON', async () => {
      await manager.createSkill(validInput);
      await manager.createSkill({ ...validInput, name: 'checkout' });

      const exported = await manager.exportSkills();

      assert.lengthOf(exported, 2);
    });

    it('imports skills with skip mode', async () => {
      await manager.createSkill(validInput);
      const exported = await manager.exportSkills();

      const result = await manager.importSkills(exported, 'skip');

      assert.strictEqual(result.imported, 0);
      assert.deepEqual(result.skipped, [validInput.name]);
    });
  });
});
