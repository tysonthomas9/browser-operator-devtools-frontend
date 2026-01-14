// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for all sandbox app tools
 *
 * Each tool is tested for:
 * - Success cases
 * - Validation errors
 * - Edge cases
 * - Schema correctness
 */

import {VFSManager} from '../vfs/VFSManager.js';
import {SandboxController} from '../controller/SandboxController.js';
import {
  resetAllSingletons,
  createMockAppState,
  createMockBuildResult,
  injectMockApp,
} from './test-utils.js';

// Import all tools
import {createApp, CREATE_APP_SCHEMA} from '../tools/CreateAppTool.js';
import {writeFile, WRITE_FILE_SCHEMA} from '../tools/WriteFileTool.js';
import {deleteFile, DELETE_FILE_SCHEMA} from '../tools/DeleteFileTool.js';
import {buildApp, BUILD_APP_SCHEMA} from '../tools/BuildAppTool.js';
import {runApp, RUN_APP_SCHEMA} from '../tools/RunAppTool.js';
import {stopApp, STOP_APP_SCHEMA} from '../tools/StopAppTool.js';
import {sendData, SEND_DATA_SCHEMA} from '../tools/SendDataTool.js';
import {getState, GET_STATE_SCHEMA} from '../tools/GetStateTool.js';

describe('ai_chat: Sandbox Tools', () => {
  beforeEach(() => {
    resetAllSingletons();
  });

  afterEach(() => {
    resetAllSingletons();
  });

  // ==========================================================================
  // CreateAppTool Tests
  // ==========================================================================

  describe('CreateAppTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(CREATE_APP_SCHEMA.name, 'sandbox_create_app');
      });

      it('requires appId and name', () => {
        assert.deepStrictEqual(CREATE_APP_SCHEMA.inputSchema.required, ['appId', 'name']);
      });

      it('has template property with enum', () => {
        const template = CREATE_APP_SCHEMA.inputSchema.properties.template;
        assert.isOk(template);
        assert.deepStrictEqual(template.enum, ['default', 'blank']);
      });
    });

    describe('validation', () => {
      it('rejects appId starting with number', async () => {
        const result = await createApp({appId: '123app', name: 'Test'});

        assert.isFalse(result.success);
        assert.include(result.error, 'must start with a letter');
      });

      it('rejects appId with spaces', async () => {
        const result = await createApp({appId: 'my app', name: 'Test'});

        assert.isFalse(result.success);
        assert.include(result.error, 'alphanumeric');
      });

      it('rejects appId with special characters', async () => {
        const result = await createApp({appId: 'my@app', name: 'Test'});

        assert.isFalse(result.success);
        assert.include(result.error, 'alphanumeric');
      });

      it('accepts valid appId with hyphens', async () => {
        const result = await createApp({appId: 'my-app', name: 'Test'});

        assert.isTrue(result.success);
      });

      it('accepts valid appId with underscores', async () => {
        const result = await createApp({appId: 'my_app', name: 'Test'});

        assert.isTrue(result.success);
      });

      it('rejects duplicate appId', async () => {
        await createApp({appId: 'existing', name: 'First'});
        const result = await createApp({appId: 'existing', name: 'Second'});

        assert.isFalse(result.success);
        assert.include(result.error, 'already exists');
      });
    });

    describe('success', () => {
      it('creates app with default template', async () => {
        const result = await createApp({appId: 'test-app', name: 'Test App'});
        const data = result.data as {appId: string; name: string; files: string[]; entry: string};

        assert.isTrue(result.success);
        assert.strictEqual(data?.appId, 'test-app');
        assert.strictEqual(data?.name, 'Test App');
        assert.isArray(data?.files);
        assert.include(data?.files, '/src/index.tsx');
      });

      it('creates app with blank template', async () => {
        const result = await createApp({appId: 'blank-app', name: 'Blank', template: 'blank'});
        const data = result.data as {files: string[]};

        assert.isTrue(result.success);
        assert.isArray(data?.files);
        assert.strictEqual(data?.files.length, 0);
      });

      it('returns entry point', async () => {
        const result = await createApp({appId: 'test-app', name: 'Test'});
        const data = result.data as {entry: string};

        assert.isTrue(result.success);
        assert.strictEqual(data?.entry, '/src/index.tsx');
      });
    });
  });

  // ==========================================================================
  // WriteFileTool Tests
  // ==========================================================================

  describe('WriteFileTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(WRITE_FILE_SCHEMA.name, 'sandbox_write_file');
      });

      it('requires appId, path, and content', () => {
        assert.deepStrictEqual(WRITE_FILE_SCHEMA.inputSchema.required, ['appId', 'path', 'content']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await writeFile({
          appId: 'nonexistent',
          path: '/test.ts',
          content: 'test',
        });

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });

      it('rejects path not starting with /', async () => {
        await createApp({appId: 'test', name: 'Test'});

        const result = await writeFile({
          appId: 'test',
          path: 'src/file.ts',
          content: 'test',
        });

        assert.isFalse(result.success);
        assert.include(result.error, 'must start with /');
      });
    });

    describe('success', () => {
      it('writes new file', async () => {
        await createApp({appId: 'test', name: 'Test'});

        const result = await writeFile({
          appId: 'test',
          path: '/src/new.ts',
          content: 'export const x = 1;',
        });
        const data = result.data as {path: string; size: number};

        assert.isTrue(result.success);
        assert.strictEqual(data?.path, '/src/new.ts');
        assert.strictEqual(data?.size, 19);
      });

      it('overwrites existing file', async () => {
        await createApp({appId: 'test', name: 'Test'});

        const result = await writeFile({
          appId: 'test',
          path: '/src/App.tsx',
          content: 'new content',
        });

        assert.isTrue(result.success);

        const vfs = VFSManager.getInstance();
        const content = vfs.readFile('test', '/src/App.tsx');
        assert.strictEqual(content, 'new content');
      });
    });
  });

  // ==========================================================================
  // DeleteFileTool Tests
  // ==========================================================================

  describe('DeleteFileTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(DELETE_FILE_SCHEMA.name, 'sandbox_delete_file');
      });

      it('requires appId and path', () => {
        assert.deepStrictEqual(DELETE_FILE_SCHEMA.inputSchema.required, ['appId', 'path']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await deleteFile({
          appId: 'nonexistent',
          path: '/test.ts',
        });

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });

      it('returns error for non-existent file', async () => {
        await createApp({appId: 'test', name: 'Test'});

        const result = await deleteFile({
          appId: 'test',
          path: '/nonexistent.ts',
        });

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });
    });

    describe('success', () => {
      it('deletes existing file', async () => {
        await createApp({appId: 'test', name: 'Test'});

        const result = await deleteFile({
          appId: 'test',
          path: '/src/styles.css',
        });
        const data = result.data as {deleted: boolean};

        assert.isTrue(result.success);
        assert.isTrue(data?.deleted);

        const vfs = VFSManager.getInstance();
        assert.isNull(vfs.readFile('test', '/src/styles.css'));
      });
    });
  });

  // ==========================================================================
  // BuildAppTool Tests
  // ==========================================================================

  describe('BuildAppTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(BUILD_APP_SCHEMA.name, 'sandbox_build_app');
      });

      it('requires appId', () => {
        assert.deepStrictEqual(BUILD_APP_SCHEMA.inputSchema.required, ['appId']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await buildApp({appId: 'nonexistent'});

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });
    });

    // Note: Full build tests require mocking the iframe bundler protocol
    // These are basic validation tests
  });

  // ==========================================================================
  // RunAppTool Tests
  // ==========================================================================

  describe('RunAppTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(RUN_APP_SCHEMA.name, 'sandbox_run_app');
      });

      it('requires appId', () => {
        assert.deepStrictEqual(RUN_APP_SCHEMA.inputSchema.required, ['appId']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await runApp({appId: 'nonexistent'});

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });
    });

    // Note: Full run tests require mocking IframeRenderer
  });

  // ==========================================================================
  // StopAppTool Tests
  // ==========================================================================

  describe('StopAppTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(STOP_APP_SCHEMA.name, 'sandbox_stop_app');
      });

      it('requires appId', () => {
        assert.deepStrictEqual(STOP_APP_SCHEMA.inputSchema.required, ['appId']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await stopApp({appId: 'nonexistent'});

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });
    });

    describe('success', () => {
      it('stops running app', async () => {
        // Setup mock running app
        const mockApp = createMockAppState({
          appId: 'running-app',
          isRunning: true,
          iframeId: 'iframe-123',
        });
        injectMockApp(mockApp);

        const result = await stopApp({appId: 'running-app'});
        const data = result.data as {stopped: boolean};

        assert.isTrue(result.success);
        assert.isTrue(data?.stopped);
      });
    });
  });

  // ==========================================================================
  // SendDataTool Tests
  // ==========================================================================

  describe('SendDataTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(SEND_DATA_SCHEMA.name, 'sandbox_send_data');
      });

      it('requires appId, path, and value', () => {
        assert.deepStrictEqual(SEND_DATA_SCHEMA.inputSchema.required, ['appId', 'path', 'value']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await sendData({
          appId: 'nonexistent',
          path: '/count',
          value: 42,
        });

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });

      it('rejects app that is not running', async () => {
        // Setup non-running app
        const mockApp = createMockAppState({
          appId: 'stopped-app',
          isRunning: false,
        });
        injectMockApp(mockApp);

        const result = await sendData({
          appId: 'stopped-app',
          path: '/count',
          value: 42,
        });

        assert.isFalse(result.success);
        assert.include(result.error, 'not running');
      });
    });

    // Note: Full sendData tests require mocking SandboxProtocol
  });

  // ==========================================================================
  // GetStateTool Tests
  // ==========================================================================

  describe('GetStateTool', () => {
    describe('schema', () => {
      it('has correct name', () => {
        assert.strictEqual(GET_STATE_SCHEMA.name, 'sandbox_get_state');
      });

      it('requires appId', () => {
        assert.deepStrictEqual(GET_STATE_SCHEMA.inputSchema.required, ['appId']);
      });
    });

    describe('validation', () => {
      it('rejects non-existent app', async () => {
        const result = await getState({appId: 'nonexistent'});

        assert.isFalse(result.success);
        assert.include(result.error, 'not found');
      });
    });

    describe('success', () => {
      it('returns app state', async () => {
        await createApp({appId: 'state-test', name: 'State Test'});

        const result = await getState({appId: 'state-test'});
        const data = result.data as {appId: string; name: string; buildStatus: string; isRunning: boolean};

        assert.isTrue(result.success);
        assert.strictEqual(data?.appId, 'state-test');
        assert.strictEqual(data?.name, 'State Test');
        assert.strictEqual(data?.buildStatus, 'idle');
        assert.isFalse(data?.isRunning);
      });

      it('returns file list', async () => {
        await createApp({appId: 'files-test', name: 'Files Test'});

        const result = await getState({appId: 'files-test'});
        const data = result.data as {files: string[]};

        assert.isTrue(result.success);
        assert.isArray(data?.files);
        assert.isTrue(data?.files.length > 0);
      });

      it('returns last build errors', async () => {
        // Setup app with failed build
        const mockApp = createMockAppState({
          appId: 'build-test',
          buildStatus: 'failed',
          lastBuild: {
            success: false,
            js: '',
            css: '',
            errors: [{message: 'Syntax error', severity: 'error'}],
            warnings: [],
            durationMs: 100,
          },
        });
        injectMockApp(mockApp);

        const result = await getState({appId: 'build-test'});
        const data = result.data as {lastBuildSuccess: boolean; lastBuildErrors: string};

        assert.isTrue(result.success);
        assert.isFalse(data?.lastBuildSuccess);
        assert.include(data?.lastBuildErrors, 'Syntax error');
      });
    });
  });

  // ==========================================================================
  // Schema Consistency Tests
  // ==========================================================================

  describe('Schema Consistency', () => {
    const schemas = [
      CREATE_APP_SCHEMA,
      WRITE_FILE_SCHEMA,
      DELETE_FILE_SCHEMA,
      BUILD_APP_SCHEMA,
      RUN_APP_SCHEMA,
      STOP_APP_SCHEMA,
      SEND_DATA_SCHEMA,
      GET_STATE_SCHEMA,
    ];

    it('all schemas have name property', () => {
      for (const schema of schemas) {
        assert.isOk(schema.name, `Schema missing name`);
        assert.isTrue(schema.name.startsWith('sandbox_'), `Schema name should start with sandbox_: ${schema.name}`);
      }
    });

    it('all schemas have description', () => {
      for (const schema of schemas) {
        assert.isOk(schema.description, `${schema.name} missing description`);
        assert.isTrue(schema.description.length > 10, `${schema.name} description too short`);
      }
    });

    it('all schemas have inputSchema with required array', () => {
      for (const schema of schemas) {
        assert.isOk(schema.inputSchema, `${schema.name} missing inputSchema`);
        assert.isArray(schema.inputSchema.required, `${schema.name} missing required array`);
      }
    });

    it('all schemas have type object', () => {
      for (const schema of schemas) {
        assert.strictEqual(schema.inputSchema.type, 'object', `${schema.name} should have type object`);
      }
    });
  });
});
