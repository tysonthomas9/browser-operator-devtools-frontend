// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for ApplyPatchTool - Unified diff patch application
 */

import {VFSManager} from '../vfs/VFSManager.js';
import {SandboxController} from '../controller/SandboxController.js';
import {applyPatch} from '../tools/ApplyPatchTool.js';

describe('ai_chat: ApplyPatchTool', () => {
  let vfs: VFSManager;

  beforeEach(() => {
    SandboxController.reset();
    vfs = VFSManager.getInstance();
    vfs.reset();
  });

  afterEach(() => {
    SandboxController.reset();
  });

  // Helper to create an app with a test file using VFS directly
  // This avoids the async writeFile which triggers auto-build
  function setupTestApp(appId: string, path: string, content: string): void {
    vfs.createApp(appId);
    vfs.writeFile(appId, path, content);
    // Also need to create app in controller for getApp to work
    const controller = SandboxController.getInstance();
    (controller as any).apps.set(appId, {
      appId,
      name: 'Test App',
      vfs: vfs.getApp(appId),
      buildStatus: 'idle',
      lastBuild: null,
      iframeId: null,
      isRunning: false,
      appState: {},
    });
  }

  describe('basic patch application', () => {
    it('applies a simple addition patch', async () => {
      setupTestApp('test-app', '/src/test.ts', `line 1
line 2
line 3`);

      const patch = `@@ -1,3 +1,4 @@
 line 1
+new line
 line 2
 line 3`;

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch,
      });
      const data = result.data as {hunksApplied: number};

      assert.isTrue(result.success);
      assert.strictEqual(data?.hunksApplied, 1);

      const content = vfs.readFile('test-app', '/src/test.ts');
      assert.include(content, 'new line');
    });

    it('applies a simple removal patch', async () => {
      setupTestApp('test-app', '/src/test.ts', `line 1
line to remove
line 3`);

      const patch = `@@ -1,3 +1,2 @@
 line 1
-line to remove
 line 3`;

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch,
      });

      assert.isTrue(result.success);
      const content = vfs.readFile('test-app', '/src/test.ts');
      assert.notInclude(content, 'line to remove');
    });

    it('applies a replacement patch', async () => {
      setupTestApp('test-app', '/src/test.ts', `const x = 1;
const y = 2;
const z = 3;`);

      const patch = `@@ -1,3 +1,3 @@
 const x = 1;
-const y = 2;
+const y = 42;
 const z = 3;`;

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch,
      });

      assert.isTrue(result.success);
      const content = vfs.readFile('test-app', '/src/test.ts');
      assert.include(content, 'const y = 42;');
      assert.notInclude(content, 'const y = 2;');
    });
  });

  describe('multi-hunk patches', () => {
    it('applies patch with multiple hunks', async () => {
      setupTestApp('test-app', '/src/test.ts', `function a() {}

function b() {}

function c() {}`);

      const patch = `@@ -1,2 +1,2 @@
-function a() {}
+function alpha() {}

@@ -4,2 +4,2 @@

-function c() {}
+function charlie() {}`;

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch,
      });
      const data = result.data as {hunksApplied: number};

      assert.isTrue(result.success);
      assert.strictEqual(data?.hunksApplied, 2);

      const content = vfs.readFile('test-app', '/src/test.ts');
      assert.include(content, 'function alpha()');
      assert.include(content, 'function charlie()');
    });
  });

  describe('error handling', () => {
    it('returns error for non-existent app', async () => {
      const result = await applyPatch({
        appId: 'nonexistent',
        path: '/file.ts',
        patch: '@@ -1 +1 @@\n-old\n+new',
      });

      assert.isFalse(result.success);
      assert.include(result.error, 'not found');
    });

    it('returns error for non-existent file', async () => {
      setupTestApp('test-app', '/src/other.ts', 'content');

      const result = await applyPatch({
        appId: 'test-app',
        path: '/nonexistent.ts',
        patch: '@@ -1 +1 @@\n-old\n+new',
      });

      assert.isFalse(result.success);
      assert.include(result.error, 'not found');
    });

    it('returns error for invalid patch without hunks', async () => {
      setupTestApp('test-app', '/src/test.ts', 'content');

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch: 'this is not a valid patch',
      });

      assert.isFalse(result.success);
      assert.include(result.error, 'no hunks');
    });
  });

  describe('patch format variations', () => {
    it('handles patch with diff headers', async () => {
      setupTestApp('test-app', '/src/test.ts', 'old line');

      const patch = `diff --git a/src/test.ts b/src/test.ts
--- a/src/test.ts
+++ b/src/test.ts
@@ -1 +1 @@
-old line
+new line`;

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch,
      });

      assert.isTrue(result.success);
      const content = vfs.readFile('test-app', '/src/test.ts');
      assert.strictEqual(content, 'new line');
    });

    it('handles empty context lines', async () => {
      setupTestApp('test-app', '/src/test.ts', `first

third`);

      const patch = `@@ -1,3 +1,4 @@
 first

+inserted
 third`;

      const result = await applyPatch({
        appId: 'test-app',
        path: '/src/test.ts',
        patch,
      });

      assert.isTrue(result.success);
      const content = vfs.readFile('test-app', '/src/test.ts');
      assert.include(content, 'inserted');
    });
  });
});
