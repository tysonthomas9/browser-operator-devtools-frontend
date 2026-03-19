// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { FileManagerMiniApp } from '../FileManagerMiniApp.js';
import { MiniAppStorageManager } from '../../../MiniAppStorageManager.js';
import type { MiniAppBridge } from '../../../types/MiniAppTypes.js';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockBridge(): MiniAppBridge {
  return {
    install: sinon.stub().resolves(),
    uninstall: sinon.stub().resolves(),
    sendToSPA: sinon.stub().resolves(),
    getState: sinon.stub().resolves({}),
    onAction: sinon.stub(),
    get installed(): boolean {
      return true;
    },
    get webappId(): string | null {
      return 'test-webapp-id';
    },
  };
}

// In-memory storage mock
function createMockStorage(): Map<string, unknown> {
  return new Map();
}

// ============================================================================
// FileManagerMiniApp Tests
// ============================================================================

describe('FileManagerMiniApp', () => {
  let app: FileManagerMiniApp;

  beforeEach(() => {
    app = new FileManagerMiniApp();
  });

  describe('metadata', () => {
    it('has correct id', () => {
      assert.strictEqual(app.id, 'file_manager');
    });

    it('has correct name', () => {
      assert.strictEqual(app.name, 'File Manager');
    });

    it('has icon', () => {
      assert.strictEqual(app.icon, '📁');
    });
  });

  describe('getSPA', () => {
    it('returns SPA with html, css, and js', () => {
      const spa = app.getSPA();

      assert.isString(spa.html);
      assert.isString(spa.css);
      assert.isString(spa.js);
      assert.isTrue(spa.html.length > 0);
      assert.isTrue(spa.css.length > 0);
      assert.isTrue(spa.js.length > 0);
    });
  });

  describe('getSupportedActions', () => {
    it('includes create-document action', () => {
      const actions = app.getSupportedActions();
      const createAction = actions.find(a => a.name === 'create-document');

      assert.isDefined(createAction);
      assert.strictEqual(createAction?.description, 'Create a new document');
    });

    it('includes read-document action', () => {
      const actions = app.getSupportedActions();
      const readAction = actions.find(a => a.name === 'read-document');

      assert.isDefined(readAction);
    });
  });

  describe('createController', () => {
    it('returns a controller instance', () => {
      const controller = app.createController();

      assert.isDefined(controller);
      assert.isFunction(controller.initialize);
      assert.isFunction(controller.getState);
      assert.isFunction(controller.executeAction);
      assert.isFunction(controller.cleanup);
    });
  });
});

// ============================================================================
// FileManagerController Tests
// ============================================================================

describe('FileManagerController', () => {
  let app: FileManagerMiniApp;
  let controller: ReturnType<FileManagerMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let mockStorageData: Map<string, unknown>;
  let storageStub: sinon.SinonStub;

  beforeEach(() => {
    app = new FileManagerMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();
    mockStorageData = createMockStorage();

    // Mock MiniAppStorageManager
    const mockStorageInstance = {
      get: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        return mockStorageData.get(fullKey);
      }),
      set: sinon.stub().callsFake(async (prefix: string, key: string, value: unknown) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.set(fullKey, value);
      }),
      delete: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.delete(fullKey);
      }),
      list: sinon.stub().resolves([]),
    };

    storageStub = sinon.stub(MiniAppStorageManager, 'getInstance').returns(mockStorageInstance as unknown as MiniAppStorageManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('initialize', () => {
    it('sets up the bridge', async () => {
      await controller.initialize(mockBridge);

      assert.isTrue((mockBridge.onAction as sinon.SinonStub).calledOnce);
    });
  });

  describe('executeAction - create-document', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('creates a document with given title', async () => {
      const result = await controller.executeAction('create-document', {
        title: 'Test Document',
      });

      assert.isDefined(result);
      const doc = result as { id: string; title: string };
      assert.strictEqual(doc.title, 'Test Document');
      assert.isTrue(doc.id.startsWith('doc_'));
    });

    it('creates a document with title and content', async () => {
      const result = await controller.executeAction('create-document', {
        title: 'Test Document',
        content: '# Hello World',
      });

      const doc = result as { id: string; title: string; content: string };
      assert.strictEqual(doc.title, 'Test Document');
      assert.strictEqual(doc.content, '# Hello World');
    });

    it('stores the document in storage', async () => {
      const result = await controller.executeAction('create-document', {
        title: 'Test Document',
        content: 'Test content',
      });

      const doc = result as { id: string };
      const storedDoc = mockStorageData.get(`file_manager:${doc.id}`);
      assert.isDefined(storedDoc);
    });
  });

  describe('handleAction flow (via bridge)', () => {
    let actionHandler: (action: unknown) => Promise<void>;

    beforeEach(async () => {
      // Capture the action handler registered with the bridge
      (mockBridge.onAction as sinon.SinonStub).callsFake((handler: (action: unknown) => Promise<void>) => {
        actionHandler = handler;
      });

      await controller.initialize(mockBridge);
    });

    it('handles create-document action from SPA', async () => {
      // Simulate the action coming from SPA via bridge
      await actionHandler({
        type: 'create-document',
        title: 'New Document from SPA',
        content: 'Content from SPA',
      });

      // Check that bridge.sendToSPA was called (to push state back to SPA)
      // Note: This tests the full flow from SPA action to state push
      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
    });

    it('handles ready action by pushing state to SPA', async () => {
      await actionHandler({ type: 'ready' });

      // Should call sendToSPA to push initial state
      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);
    });
  });

  describe('getState', () => {
    beforeEach(async () => {
      await controller.initialize(mockBridge);
    });

    it('returns state with documents array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.documents);
      assert.isArray(state.documents);
    });

    it('returns state with folders array', async () => {
      const state = await controller.getState();

      assert.isDefined(state.folders);
      assert.isArray(state.folders);
    });

    it('returns state with currentView', async () => {
      const state = await controller.getState();

      assert.isDefined(state.currentView);
      assert.strictEqual(state.currentView, 'browser');
    });
  });
});

// ============================================================================
// Integration Tests - Full Create Document Flow
// ============================================================================

describe('FileManager Integration', () => {
  let app: FileManagerMiniApp;
  let controller: ReturnType<FileManagerMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let mockStorageData: Map<string, unknown>;
  let actionHandler: (action: unknown) => Promise<void>;

  beforeEach(async () => {
    app = new FileManagerMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();
    mockStorageData = createMockStorage();

    // Mock storage
    const mockStorageInstance = {
      get: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        return mockStorageData.get(fullKey);
      }),
      set: sinon.stub().callsFake(async (prefix: string, key: string, value: unknown) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.set(fullKey, value);
      }),
      delete: sinon.stub().resolves(),
      list: sinon.stub().resolves([]),
    };

    sinon.stub(MiniAppStorageManager, 'getInstance').returns(mockStorageInstance as unknown as MiniAppStorageManager);

    // Capture action handler
    (mockBridge.onAction as sinon.SinonStub).callsFake((handler: (action: unknown) => Promise<void>) => {
      actionHandler = handler;
    });

    await controller.initialize(mockBridge);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('full create document flow', () => {
    it('creates document and pushes updated state to SPA', async () => {
      // 1. SPA sends create-document action
      await actionHandler({
        type: 'create-document',
        title: 'Integration Test Doc',
        content: '# Test Content',
      });

      // 2. Verify state was pushed back to SPA
      assert.isTrue((mockBridge.sendToSPA as sinon.SinonStub).called);

      // 3. Get the state that would be visible to SPA
      const state = await controller.getState();

      // 4. Verify the document appears in the state
      // Note: The doc is opened after creation, so currentDocument should be set
      assert.isDefined(state.currentDocument);
    });
  });
});

// ============================================================================
// Folder Item Count Tests
// ============================================================================

describe('FileManager Folder Item Counts', () => {
  let app: FileManagerMiniApp;
  let controller: ReturnType<FileManagerMiniApp['createController']>;
  let mockBridge: MiniAppBridge;
  let mockStorageData: Map<string, unknown>;
  let actionHandler: (action: unknown) => Promise<void>;

  beforeEach(async () => {
    app = new FileManagerMiniApp();
    controller = app.createController();
    mockBridge = createMockBridge();
    mockStorageData = createMockStorage();

    // Mock storage with test data
    const mockStorageInstance = {
      get: sinon.stub().callsFake(async (prefix: string, key: string) => {
        const fullKey = `${prefix}:${key}`;
        return mockStorageData.get(fullKey);
      }),
      set: sinon.stub().callsFake(async (prefix: string, key: string, value: unknown) => {
        const fullKey = `${prefix}:${key}`;
        mockStorageData.set(fullKey, value);
      }),
      delete: sinon.stub().resolves(),
      list: sinon.stub().resolves([]),
    };

    sinon.stub(MiniAppStorageManager, 'getInstance').returns(mockStorageInstance as unknown as MiniAppStorageManager);

    // Capture action handler
    (mockBridge.onAction as sinon.SinonStub).callsFake((handler: (action: unknown) => Promise<void>) => {
      actionHandler = handler;
    });

    await controller.initialize(mockBridge);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('folder itemCount property', () => {
    // Type for folder with itemCount
    interface FolderWithCount {
      id: string;
      name: string;
      parentId: string | null;
      itemCount?: number;
    }

    it('folders in state have itemCount property', async () => {
      // Create a folder first
      await actionHandler({
        type: 'create-folder',
        name: 'Test Folder',
      });

      const state = await controller.getState();
      const folders = state.folders as FolderWithCount[] | undefined;

      assert.isArray(folders);
      if (folders && folders.length > 0) {
        const folder = folders[0];
        assert.isDefined(folder.itemCount, 'Folder should have itemCount property');
        assert.isNumber(folder.itemCount, 'itemCount should be a number');
      }
    });

    it('empty folder has itemCount of 0', async () => {
      // Create an empty folder
      await actionHandler({
        type: 'create-folder',
        name: 'Empty Folder',
      });

      const state = await controller.getState();
      const folders = state.folders as FolderWithCount[] | undefined;

      assert.isArray(folders);
      if (folders && folders.length > 0) {
        const folder = folders[0];
        assert.strictEqual(folder.itemCount, 0, 'Empty folder should have itemCount of 0');
      }
    });

    it('folder with documents has correct itemCount', async () => {
      // Create a folder
      await actionHandler({
        type: 'create-folder',
        name: 'Folder With Docs',
      });

      // Get the folder ID from state
      let state = await controller.getState();
      let folders = state.folders as FolderWithCount[] | undefined;
      const folderId = folders?.[0]?.id;

      assert.isDefined(folderId, 'Folder should have been created');

      // Create documents in the folder
      await actionHandler({
        type: 'create-document',
        title: 'Doc 1',
        content: 'Content 1',
        folderId: folderId,
      });

      await actionHandler({
        type: 'create-document',
        title: 'Doc 2',
        content: 'Content 2',
        folderId: folderId,
      });

      // Navigate back to root to see the folder's itemCount
      await actionHandler({
        type: 'navigate',
        folderId: null,
      });

      state = await controller.getState();
      folders = state.folders as FolderWithCount[] | undefined;

      assert.isArray(folders);
      if (folders && folders.length > 0) {
        const folder = folders.find(f => f.id === folderId);
        assert.isDefined(folder, 'Folder should be in state');
        assert.strictEqual(folder?.itemCount, 2, 'Folder should have itemCount of 2');
      }
    });

    it('folder with subfolders counts them in itemCount', async () => {
      // Create a parent folder
      await actionHandler({
        type: 'create-folder',
        name: 'Parent Folder',
      });

      // Get the parent folder ID
      let state = await controller.getState();
      let folders = state.folders as FolderWithCount[] | undefined;
      const parentId = folders?.[0]?.id;

      assert.isDefined(parentId, 'Parent folder should have been created');

      // Create a subfolder with explicit parentId
      await actionHandler({
        type: 'create-folder',
        name: 'Child Folder',
        parentId: parentId,
      });

      state = await controller.getState();
      folders = state.folders as FolderWithCount[] | undefined;

      assert.isArray(folders);
      if (folders && folders.length > 0) {
        const parentFolder = folders.find(f => f.id === parentId);
        assert.isDefined(parentFolder, 'Parent folder should be in state');
        assert.strictEqual(parentFolder?.itemCount, 1, 'Parent folder should have itemCount of 1 (the subfolder)');
      }
    });
  });
});
