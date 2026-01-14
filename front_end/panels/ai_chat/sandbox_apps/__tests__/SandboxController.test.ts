// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for SandboxController - App lifecycle management
 *
 * Note: These tests focus on the non-browser-dependent functionality.
 * Full integration tests require a browser environment with Web Workers
 * and iframe support.
 */

// Sinon is provided globally by the test environment
declare const sinon: typeof import('sinon');

import {VFSManager} from '../vfs/VFSManager.js';
import {SandboxController} from '../controller/SandboxController.js';
import type {SandboxEvent} from '../types/SandboxTypes.js';

describe('ai_chat: SandboxController', () => {
  let controller: SandboxController;

  beforeEach(() => {
    SandboxController.reset();
    controller = SandboxController.getInstance();
  });

  afterEach(() => {
    SandboxController.reset();
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = SandboxController.getInstance();
      const instance2 = SandboxController.getInstance();
      assert.strictEqual(instance1, instance2);
    });
  });

  describe('createApp', () => {
    it('creates app with given ID and name', async () => {
      const result = await controller.createApp('my-app-id', 'My App');

      assert.strictEqual(result.appId, 'my-app-id');
      assert.strictEqual(result.name, 'My App');
    });

    it('creates app with VFS containing default files', async () => {
      const result = await controller.createApp('test-app', 'Test App');

      const files = controller.listFiles(result.appId);
      const paths = files.map(f => f.path);

      assert.include(paths, '/src/index.tsx');
      assert.include(paths, '/src/App.tsx');
    });

    it('app starts in idle build status', async () => {
      const result = await controller.createApp('test-app', 'Test App');
      const app = controller.getApp(result.appId);

      assert.strictEqual(app?.buildStatus, 'idle');
      assert.isFalse(app?.isRunning);
    });

    it('throws error when app ID already exists', async () => {
      await controller.createApp('same-id', 'First');

      try {
        await controller.createApp('same-id', 'Second');
        assert.fail('Expected error to be thrown');
      } catch (error) {
        assert.include((error as Error).message, 'already exists');
      }
    });

    it('creates app with blank template', async () => {
      const result = await controller.createApp('blank-app', 'Blank App', 'blank');

      const files = controller.listFiles(result.appId);
      assert.strictEqual(files.length, 0);
    });
  });

  describe('getApp', () => {
    it('returns app by ID', async () => {
      const created = await controller.createApp('test-id', 'Test App');
      const app = controller.getApp(created.appId);

      assert.isOk(app);
      assert.strictEqual(app?.name, 'Test App');
    });

    it('returns null for non-existent app', () => {
      const app = controller.getApp('nonexistent');
      assert.isNull(app);
    });
  });

  describe('listApps', () => {
    it('returns empty array when no apps', () => {
      const apps = controller.listApps();
      assert.isArray(apps);
      assert.strictEqual(apps.length, 0);
    });

    it('returns all created apps', async () => {
      await controller.createApp('app-1', 'App 1');
      await controller.createApp('app-2', 'App 2');
      await controller.createApp('app-3', 'App 3');

      const apps = controller.listApps();
      assert.strictEqual(apps.length, 3);

      const names = apps.map(a => a.name);
      assert.include(names, 'App 1');
      assert.include(names, 'App 2');
      assert.include(names, 'App 3');
    });
  });

  describe('deleteApp', () => {
    it('deletes existing app', async () => {
      await controller.createApp('to-delete', 'To Delete');
      const deleted = await controller.deleteApp('to-delete');

      assert.isTrue(deleted);
      assert.isNull(controller.getApp('to-delete'));
    });

    it('returns false for non-existent app', async () => {
      const deleted = await controller.deleteApp('nonexistent');
      assert.isFalse(deleted);
    });

    it('removes app from listApps', async () => {
      await controller.createApp('to-remove', 'To Remove');
      await controller.deleteApp('to-remove');

      const apps = controller.listApps();
      const ids = apps.map(a => a.appId);
      assert.notInclude(ids, 'to-remove');
    });
  });

  describe('file operations', () => {
    let appId: string;

    beforeEach(async () => {
      const result = await controller.createApp('file-test', 'File Test');
      appId = result.appId;
    });

    describe('readFile', () => {
      it('reads file from app VFS', () => {
        const content = controller.readFile(appId, '/src/App.tsx');
        assert.isOk(content);
        assert.include(content!, 'preact');
      });

      it('returns null for non-existent file', () => {
        const content = controller.readFile(appId, '/nonexistent.txt');
        assert.isNull(content);
      });

      it('returns null for non-existent app', () => {
        const content = controller.readFile('nonexistent', '/file.txt');
        assert.isNull(content);
      });
    });

    describe('listFiles', () => {
      it('lists files in app VFS', () => {
        const files = controller.listFiles(appId);

        assert.isArray(files);
        // Default template includes multiple files (App.tsx, index.tsx, styles.css, shadcn components, etc.)
        assert.isTrue(files.length >= 3, `Expected at least 3 files, got ${files.length}`);
      });

      it('returns empty array for non-existent app', () => {
        const files = controller.listFiles('nonexistent');
        assert.isArray(files);
        assert.strictEqual(files.length, 0);
      });
    });
  });

  describe('event system', () => {
    it('emits app_created event', async () => {
      const events: SandboxEvent[] = [];
      controller.on('app_created', (event: SandboxEvent) => {
        events.push(event);
      });

      await controller.createApp('event-test', 'Event Test');

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].appId, 'event-test');
      assert.strictEqual(events[0].type, 'app_created');
    });

    it('emits app_deleted event', async () => {
      const events: SandboxEvent[] = [];
      controller.on('app_deleted', (event: SandboxEvent) => {
        events.push(event);
      });

      await controller.createApp('to-delete', 'To Delete');
      await controller.deleteApp('to-delete');

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].appId, 'to-delete');
      assert.strictEqual(events[0].type, 'app_deleted');
    });

    it('unsubscribes when calling returned function', async () => {
      let callCount = 0;
      const unsubscribe = controller.on('app_created', () => {
        callCount++;
      });

      await controller.createApp('first', 'First');
      unsubscribe();
      await controller.createApp('second', 'Second');

      assert.strictEqual(callCount, 1);
    });

    it('wildcard listener receives all events', async () => {
      const receivedTypes: string[] = [];
      controller.on('*', (event) => {
        receivedTypes.push(event.type);
      });

      await controller.createApp('test', 'Test');
      await controller.deleteApp('test');

      assert.include(receivedTypes, 'app_created');
      assert.include(receivedTypes, 'app_deleted');
    });
  });

  describe('getAppState', () => {
    it('returns empty object for new app', async () => {
      await controller.createApp('state-test', 'State Test');
      const state = controller.getAppState('state-test');

      assert.deepStrictEqual(state, {});
    });

    it('returns empty object for non-existent app', () => {
      const state = controller.getAppState('nonexistent');
      assert.deepStrictEqual(state, {});
    });
  });

  // ==========================================================================
  // Async File Operations Tests
  // ==========================================================================

  describe('writeFile', () => {
    let appId: string;

    beforeEach(async () => {
      const result = await controller.createApp('write-test', 'Write Test');
      appId = result.appId;
    });

    it('writes file to VFS', async () => {
      await controller.writeFile(appId, '/src/new.ts', 'export const x = 1;');

      const content = controller.readFile(appId, '/src/new.ts');
      assert.strictEqual(content, 'export const x = 1;');
    });

    it('throws error for non-existent app', async () => {
      try {
        await controller.writeFile('nonexistent', '/test.ts', 'content');
        assert.fail('Expected error');
      } catch (error) {
        assert.include((error as Error).message, 'not found');
      }
    });

    it('emits file_changed event', async () => {
      const events: SandboxEvent[] = [];
      controller.on('file_changed', (event: SandboxEvent) => {
        events.push(event);
      });

      await controller.writeFile(appId, '/src/changed.ts', 'new content');

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].appId, appId);
      assert.strictEqual((events[0].data as {path: string})?.path, '/src/changed.ts');
    });

    it('updates app VFS reference', async () => {
      await controller.writeFile(appId, '/src/updated.ts', 'content');

      const app = controller.getApp(appId);
      assert.isOk(app?.vfs.files['/src/updated.ts']);
    });
  });

  describe('deleteFile', () => {
    let appId: string;

    beforeEach(async () => {
      const result = await controller.createApp('delete-test', 'Delete Test');
      appId = result.appId;
    });

    it('deletes file from VFS', async () => {
      const deleted = await controller.deleteFile(appId, '/src/styles.css');

      assert.isTrue(deleted);
      assert.isNull(controller.readFile(appId, '/src/styles.css'));
    });

    it('returns false for non-existent file', async () => {
      const deleted = await controller.deleteFile(appId, '/nonexistent.ts');
      assert.isFalse(deleted);
    });

    it('throws error for non-existent app', async () => {
      try {
        await controller.deleteFile('nonexistent', '/test.ts');
        assert.fail('Expected error');
      } catch (error) {
        assert.include((error as Error).message, 'not found');
      }
    });

    it('emits file_changed event with deleted flag', async () => {
      const events: SandboxEvent[] = [];
      controller.on('file_changed', (event: SandboxEvent) => {
        events.push(event);
      });

      await controller.deleteFile(appId, '/src/styles.css');

      assert.strictEqual(events.length, 1);
      assert.isTrue((events[0].data as {deleted: boolean})?.deleted);
    });
  });

  // ==========================================================================
  // Build Scheduling Tests
  // ==========================================================================

  describe('scheduleBuild / cancelBuild', () => {
    let appId: string;
    let clock: sinon.SinonFakeTimers;

    beforeEach(async () => {
      clock = sinon.useFakeTimers();
      const result = await controller.createApp('build-schedule-test', 'Build Test');
      appId = result.appId;
    });

    afterEach(() => {
      clock.restore();
    });

    it('schedules build with debounce', async () => {
      const buildEvents: SandboxEvent[] = [];
      controller.on('build_started', (event) => buildEvents.push(event));

      controller.scheduleBuild(appId);

      // Build should not start immediately
      assert.strictEqual(buildEvents.length, 0);
    });

    it('cancelBuild prevents scheduled build', async () => {
      const buildEvents: SandboxEvent[] = [];
      controller.on('build_started', (event) => buildEvents.push(event));

      controller.scheduleBuild(appId);
      controller.cancelBuild(appId);

      // Advance past debounce time
      clock.tick(200);

      assert.strictEqual(buildEvents.length, 0);
    });

    it('multiple writes only trigger one build', async () => {
      controller.scheduleBuild(appId);
      controller.scheduleBuild(appId);
      controller.scheduleBuild(appId);

      // Should only have one pending timer
      const timers = (controller as any).buildTimers;
      assert.strictEqual(timers.size, 1);
    });
  });

  // ==========================================================================
  // Build Event Tests
  // ==========================================================================

  describe('build events', () => {
    let appId: string;

    beforeEach(async () => {
      const result = await controller.createApp('build-event-test', 'Build Event Test');
      appId = result.appId;
    });

    it('buildApp throws error when app is not running', async () => {
      // buildApp now requires the app to be running (iframe bundler architecture)
      let errorThrown = false;
      try {
        await controller.buildApp(appId);
      } catch (error) {
        errorThrown = true;
        assert.include((error as Error).message, 'must be running');
      }

      assert.isTrue(errorThrown, 'Expected buildApp to throw when app is not running');
    });

    // Note: Build events (build_started, buildStatus updates) are now emitted
    // only when the app is running and buildApp is called successfully.
    // Testing these requires mocking the iframe bundler protocol.
  });

  // ==========================================================================
  // App Running State Tests
  // ==========================================================================

  describe('app running state', () => {
    let appId: string;

    beforeEach(async () => {
      const result = await controller.createApp('run-test', 'Run Test');
      appId = result.appId;
    });

    it('sendDataUpdate returns false for non-running app', async () => {
      const sent = await controller.sendDataUpdate(appId, '/count', 42);
      assert.isFalse(sent);
    });

    it('sendDataUpdate returns false for non-existent app', async () => {
      const sent = await controller.sendDataUpdate('nonexistent', '/count', 42);
      assert.isFalse(sent);
    });
  });

  // ==========================================================================
  // setAtPath Internal Function Tests
  // ==========================================================================

  describe('setAtPath (internal)', () => {
    it('sets value at simple path', async () => {
      await controller.createApp('path-test', 'Path Test');

      const setAtPath = (controller as any).setAtPath.bind(controller);
      const obj: Record<string, unknown> = {};
      setAtPath(obj, '/name', 'test');

      assert.strictEqual(obj.name, 'test');
    });

    it('sets value at nested path', async () => {
      await controller.createApp('path-test', 'Path Test');

      const setAtPath = (controller as any).setAtPath.bind(controller);
      const obj: Record<string, unknown> = {};
      setAtPath(obj, '/user/profile/name', 'Alice');

      assert.strictEqual((obj.user as any).profile.name, 'Alice');
    });

    it('handles empty path', async () => {
      await controller.createApp('path-test', 'Path Test');

      const setAtPath = (controller as any).setAtPath.bind(controller);
      const obj: Record<string, unknown> = {};
      const result = setAtPath(obj, '', 'value');

      assert.deepStrictEqual(result, {});
    });
  });
});
