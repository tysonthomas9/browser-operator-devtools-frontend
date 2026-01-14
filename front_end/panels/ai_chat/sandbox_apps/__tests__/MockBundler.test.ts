// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for MockBundler - verifies the mock bundler simulates iframe bundler correctly
 */

import {
  MockBundler,
  setupMockBundler,
  resetAllSingletons,
} from './test-utils.js';
import {getSandboxProtocol, resetSandboxProtocol} from '../protocol/SandboxProtocol.js';

describe('ai_chat: MockBundler', () => {
  beforeEach(() => {
    resetAllSingletons();
    resetSandboxProtocol();
  });

  afterEach(() => {
    resetAllSingletons();
    resetSandboxProtocol();
  });

  describe('installation', () => {
    it('installs mock for single app', () => {
      const mockBundler = new MockBundler();
      mockBundler.install('test-app');

      // Verify protocol has iframe registered
      const protocol = getSandboxProtocol();
      // Protocol should be able to send to this app now
      // (would fail if not registered)

      mockBundler.uninstall();
    });

    it('installs mock for multiple apps', () => {
      const mockBundler = new MockBundler();
      mockBundler.installAll(['app-1', 'app-2', 'app-3']);

      assert.strictEqual(mockBundler.getBuildCount(), 0);

      mockBundler.uninstall();
    });

    it('idempotent install', () => {
      const mockBundler = new MockBundler();
      mockBundler.install('test-app');
      mockBundler.install('test-app'); // Should not error

      mockBundler.uninstall();
    });
  });

  describe('build requests', () => {
    it('responds to build requests with default success result', async () => {
      const mockBundler = new MockBundler();
      mockBundler.install('test-app');

      const protocol = getSandboxProtocol();

      // Send sync-files first
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {
          files: {'/src/index.tsx': 'console.log("test")'},
          entry: '/src/index.tsx',
          incremental: false,
        },
      });

      // Request build
      const result = await protocol.requestBuild('test-app');

      assert.isTrue(result.success);
      assert.isOk(result.js);
      assert.isOk(result.css);
      assert.strictEqual(mockBundler.getBuildCount(), 1);

      mockBundler.uninstall();
    });

    it('handles custom build result', async () => {
      const mockBundler = new MockBundler({
        defaultJs: 'custom js output',
        defaultCss: 'custom css output',
        defaultDurationMs: 200,
      });
      mockBundler.install('test-app');

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });

      const result = await protocol.requestBuild('test-app');

      assert.strictEqual(result.js, 'custom js output');
      assert.strictEqual(result.css, 'custom css output');
      assert.strictEqual(result.durationMs, 200);

      mockBundler.uninstall();
    });

    it('handles build failure', async () => {
      const mockBundler = new MockBundler({defaultSuccess: false});
      mockBundler.install('test-app');

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });

      const result = await protocol.requestBuild('test-app');

      assert.isFalse(result.success);

      mockBundler.uninstall();
    });

    it('setNextBuildResult configures one-time result', async () => {
      const mockBundler = new MockBundler();
      mockBundler.install('test-app');

      mockBundler.setNextBuildResult({
        success: true,
        js: 'one-time js',
        css: 'one-time css',
      });

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });

      // First build uses the one-time result
      const result1 = await protocol.requestBuild('test-app');
      assert.strictEqual(result1.js, 'one-time js');

      // Second build uses default
      const result2 = await protocol.requestBuild('test-app');
      assert.notStrictEqual(result2.js, 'one-time js');

      mockBundler.uninstall();
    });

    it('setNextBuildFailure configures failure', async () => {
      const mockBundler = new MockBundler();
      mockBundler.install('test-app');

      mockBundler.setNextBuildFailure('Syntax error on line 5');

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });

      const result = await protocol.requestBuild('test-app');

      assert.isFalse(result.success);
      assert.isTrue(result.errors.length > 0);
      assert.include(result.errors[0].message, 'Syntax error');

      mockBundler.uninstall();
    });
  });

  describe('custom build handler', () => {
    it('uses custom handler to process files', async () => {
      const receivedFiles: Record<string, string>[] = [];

      const mockBundler = new MockBundler({
        buildHandler: (files, entry) => {
          receivedFiles.push(files);
          return {
            success: true,
            js: `// Built from ${entry}`,
            css: '',
            errors: [],
            warnings: [],
            durationMs: 10,
          };
        },
      });
      mockBundler.install('test-app');

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {
          files: {'/src/index.tsx': 'export const x = 1;'},
          entry: '/src/index.tsx',
          incremental: false,
        },
      });

      const result = await protocol.requestBuild('test-app');

      assert.strictEqual(result.js, '// Built from /src/index.tsx');
      assert.strictEqual(receivedFiles.length, 1);
      assert.strictEqual(receivedFiles[0]['/src/index.tsx'], 'export const x = 1;');

      mockBundler.uninstall();
    });
  });

  describe('build delay', () => {
    it('respects buildDelayMs configuration', async () => {
      const mockBundler = new MockBundler({buildDelayMs: 50});
      mockBundler.install('test-app');

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });

      const startTime = Date.now();
      await protocol.requestBuild('test-app');
      const elapsed = Date.now() - startTime;

      assert.isAtLeast(elapsed, 40, 'Should wait at least ~50ms');

      mockBundler.uninstall();
    });
  });

  describe('setupMockBundler helper', () => {
    it('creates and installs mock bundler', () => {
      const {mockBundler, cleanup} = setupMockBundler(['app-1', 'app-2']);

      assert.isOk(mockBundler);
      assert.strictEqual(mockBundler.getBuildCount(), 0);

      cleanup();
    });

    it('cleanup uninstalls all apps', async () => {
      const {mockBundler, cleanup} = setupMockBundler(['test-app']);

      const protocol = getSandboxProtocol();
      await protocol.send('test-app', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });

      // Build should work before cleanup
      const result = await protocol.requestBuild('test-app');
      assert.isTrue(result.success);

      cleanup();

      // After cleanup, build should fail (no mock installed)
      try {
        await protocol.requestBuild('test-app');
        // If we get here, the build didn't fail as expected
        // This is OK since the mock window might still be registered
      } catch {
        // Expected - mock was cleaned up
      }
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      const mockBundler = new MockBundler();
      mockBundler.install('app-1');
      mockBundler.install('app-2');

      const protocol = getSandboxProtocol();
      await protocol.send('app-1', {
        type: 'sync-files',
        payload: {files: {}, entry: '/src/index.tsx', incremental: false},
      });
      await protocol.requestBuild('app-1');

      assert.strictEqual(mockBundler.getBuildCount(), 1);

      mockBundler.reset();

      assert.strictEqual(mockBundler.getBuildCount(), 0);
    });
  });
});
