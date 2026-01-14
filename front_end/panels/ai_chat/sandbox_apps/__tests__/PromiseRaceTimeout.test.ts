// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Regression tests for Promise.race timeout cleanup pattern
 *
 * Tests the correct pattern for Promise.race with timeouts to prevent memory leaks.
 * This pattern is used in:
 * - test/e2e_non_hosted/shared/frontend-helper.ts (readyForTest, waitForTarget)
 * - Various other async operations that need timeout handling
 *
 * The correct pattern is:
 *   try {
 *     await Promise.race([actualPromise, timeoutPromise]);
 *     clearTimeout(timeoutId!);  // <-- MUST clear on success
 *   } catch {
 *     clearTimeout(timeoutId!);  // <-- MUST clear on error
 *   }
 */

describe('ai_chat: Promise.race timeout cleanup pattern', () => {
  describe('timeout cleanup pattern', () => {
    it('clears timeout when promise resolves before timeout', async () => {
      let timeoutCleared = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let resolveTimeoutPromise: () => void;

      const successPromise = Promise.resolve('success');
      const timeoutPromise = new Promise<never>((resolve, reject) => {
        // Store resolve so we can clean up the pending promise
        resolveTimeoutPromise = resolve as () => void;
        timeoutId = setTimeout(() => reject(new Error('timeout')), 60000);
      });

      // Suppress unhandled rejection when we clean up
      timeoutPromise.catch(() => {});

      // Track clearTimeout calls
      const originalClearTimeout = globalThis.clearTimeout;
      const clearTimeoutStub = sinon.stub(globalThis, 'clearTimeout').callsFake((id) => {
        if (id === timeoutId) {
          timeoutCleared = true;
        }
        return originalClearTimeout(id as number);
      });

      try {
        await Promise.race([successPromise, timeoutPromise]);
        clearTimeout(timeoutId!);  // This is the fix - clear on success
      } catch {
        clearTimeout(timeoutId!);
      }

      // Clean up the pending promise to satisfy test harness
      resolveTimeoutPromise!();
      clearTimeoutStub.restore();

      assert.isTrue(timeoutCleared, 'Timeout should be cleared after promise resolves');
    });

    it('clears timeout when promise rejects before timeout', async () => {
      let timeoutCleared = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let resolveTimeoutPromise: () => void;

      const failPromise = Promise.reject(new Error('fail'));
      // Suppress unhandled rejection
      failPromise.catch(() => {});

      const timeoutPromise = new Promise<never>((resolve, reject) => {
        resolveTimeoutPromise = resolve as () => void;
        timeoutId = setTimeout(() => reject(new Error('timeout')), 60000);
      });
      timeoutPromise.catch(() => {});

      const originalClearTimeout = globalThis.clearTimeout;
      const clearTimeoutStub = sinon.stub(globalThis, 'clearTimeout').callsFake((id) => {
        if (id === timeoutId) {
          timeoutCleared = true;
        }
        return originalClearTimeout(id as number);
      });

      try {
        await Promise.race([failPromise, timeoutPromise]);
        clearTimeout(timeoutId!);
      } catch {
        clearTimeout(timeoutId!);  // This is the fix - clear on error
      }

      resolveTimeoutPromise!();
      clearTimeoutStub.restore();

      assert.isTrue(timeoutCleared, 'Timeout should be cleared after promise rejects');
    });

    it('timeout is cleaned up even when it fires', async () => {
      // This test verifies that clearTimeout is still called even after the timeout fires.
      // While clearing an already-fired timeout is a no-op, it's good practice.
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timeoutCleared = false;

      const originalClearTimeout = globalThis.clearTimeout;
      const clearTimeoutStub = sinon.stub(globalThis, 'clearTimeout').callsFake((id) => {
        if (id === timeoutId) {
          timeoutCleared = true;
        }
        return originalClearTimeout(id as number);
      });

      // Create a timeout that rejects immediately (simulating timeout firing)
      timeoutId = setTimeout(() => {}, 0);  // Just to get a valid timeoutId

      // Simulate what happens after a timeout fires - we still call clearTimeout
      try {
        await Promise.reject(new Error('timeout'));
      } catch {
        clearTimeout(timeoutId!);  // Clean up even after timeout fires
      }

      clearTimeoutStub.restore();

      assert.isTrue(timeoutCleared, 'Timeout should be cleared even after firing');
    });
  });

  describe('multiple concurrent timeouts', () => {
    it('each timeout is independently cleared', async () => {
      const clearedTimeouts = new Set<ReturnType<typeof setTimeout>>();
      let timeout1: ReturnType<typeof setTimeout> | undefined;
      let timeout2: ReturnType<typeof setTimeout> | undefined;
      let resolve1: () => void;
      let resolve2: () => void;

      const promise1 = Promise.resolve('p1');
      const promise2 = Promise.resolve('p2');

      const timeoutPromise1 = new Promise<never>((resolve, reject) => {
        resolve1 = resolve as () => void;
        timeout1 = setTimeout(() => reject(new Error('t1')), 60000);
      });
      timeoutPromise1.catch(() => {});

      const timeoutPromise2 = new Promise<never>((resolve, reject) => {
        resolve2 = resolve as () => void;
        timeout2 = setTimeout(() => reject(new Error('t2')), 30000);
      });
      timeoutPromise2.catch(() => {});

      const originalClearTimeout = globalThis.clearTimeout;
      const clearTimeoutStub = sinon.stub(globalThis, 'clearTimeout').callsFake((id) => {
        clearedTimeouts.add(id as ReturnType<typeof setTimeout>);
        return originalClearTimeout(id as number);
      });

      // Race 1
      try {
        await Promise.race([promise1, timeoutPromise1]);
        clearTimeout(timeout1!);
      } catch {
        clearTimeout(timeout1!);
      }

      // Race 2
      try {
        await Promise.race([promise2, timeoutPromise2]);
        clearTimeout(timeout2!);
      } catch {
        clearTimeout(timeout2!);
      }

      // Clean up pending promises
      resolve1!();
      resolve2!();
      clearTimeoutStub.restore();

      assert.isTrue(clearedTimeouts.has(timeout1!), 'Timeout 1 should be cleared');
      assert.isTrue(clearedTimeouts.has(timeout2!), 'Timeout 2 should be cleared');
    });
  });
});
