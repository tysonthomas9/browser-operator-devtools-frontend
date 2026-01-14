// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for VFSManager - Virtual File System Manager
 */

import {VFSManager} from '../vfs/VFSManager.js';

describe('ai_chat: VFSManager', () => {
  let vfs: VFSManager;

  beforeEach(() => {
    vfs = VFSManager.getInstance();
    vfs.reset();
  });

  afterEach(() => {
    vfs.reset();
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = VFSManager.getInstance();
      const instance2 = VFSManager.getInstance();
      assert.strictEqual(instance1, instance2);
    });
  });

  describe('createApp', () => {
    it('creates a new VFS with default files', () => {
      const result = vfs.createApp('test-app');

      assert.isOk(result);
      assert.strictEqual(result.entry, '/src/index.tsx');
      assert.isOk(result.files['/src/index.tsx']);
      assert.isOk(result.files['/src/App.tsx']);
      assert.isOk(result.files['/src/styles.css']);
    });

    it('creates blank VFS when template is blank', () => {
      const result = vfs.createApp('test-app', 'blank');

      assert.strictEqual(result.entry, '/src/index.tsx');
      assert.deepStrictEqual(result.files, {});
    });

    it('includes Preact imports in default files', () => {
      const result = vfs.createApp('test-app');
      const indexContent = result.files['/src/index.tsx'];

      assert.include(indexContent, 'preact');
    });

    it('throws error when app already exists', () => {
      vfs.createApp('test-app');

      assert.throws(() => {
        vfs.createApp('test-app');
      }, /already exists/);
    });
  });

  describe('file operations', () => {
    beforeEach(() => {
      vfs.createApp('app-1');
    });

    describe('writeFile', () => {
      it('writes a new file', () => {
        const metadata = vfs.writeFile('app-1', '/src/NewFile.tsx', 'export const New = () => <div>New</div>;');

        assert.strictEqual(metadata.path, '/src/NewFile.tsx');
        assert.strictEqual(metadata.size, 40);
        const content = vfs.readFile('app-1', '/src/NewFile.tsx');
        assert.strictEqual(content, 'export const New = () => <div>New</div>;');
      });

      it('overwrites existing file', () => {
        vfs.writeFile('app-1', '/src/App.tsx', 'old content');
        vfs.writeFile('app-1', '/src/App.tsx', 'new content');

        const content = vfs.readFile('app-1', '/src/App.tsx');
        assert.strictEqual(content, 'new content');
      });

      it('throws error for non-existent app', () => {
        assert.throws(() => {
          vfs.writeFile('nonexistent', '/file.ts', 'content');
        }, /not found/);
      });

      it('normalizes paths without leading slash', () => {
        vfs.writeFile('app-1', 'src/Test.tsx', 'content');

        const content = vfs.readFile('app-1', '/src/Test.tsx');
        assert.strictEqual(content, 'content');
      });
    });

    describe('readFile', () => {
      it('reads existing file', () => {
        vfs.writeFile('app-1', '/test.txt', 'hello world');

        const content = vfs.readFile('app-1', '/test.txt');
        assert.strictEqual(content, 'hello world');
      });

      it('returns null for non-existent file', () => {
        const content = vfs.readFile('app-1', '/nonexistent.txt');
        assert.isNull(content);
      });

      it('returns null for non-existent app', () => {
        const content = vfs.readFile('nonexistent', '/file.txt');
        assert.isNull(content);
      });
    });

    describe('deleteFile', () => {
      it('deletes existing file', () => {
        vfs.writeFile('app-1', '/to-delete.txt', 'content');
        const deleted = vfs.deleteFile('app-1', '/to-delete.txt');

        assert.isTrue(deleted);
        assert.isNull(vfs.readFile('app-1', '/to-delete.txt'));
      });

      it('returns false for non-existent file', () => {
        const deleted = vfs.deleteFile('app-1', '/nonexistent.txt');
        assert.isFalse(deleted);
      });

      it('returns false for non-existent app', () => {
        const deleted = vfs.deleteFile('nonexistent', '/file.txt');
        assert.isFalse(deleted);
      });
    });

    describe('listFiles', () => {
      it('lists all files in VFS', () => {
        const files = vfs.listFiles('app-1');

        assert.isArray(files);
        assert.strictEqual(files.length, 3); // Default files

        const paths = files.map(f => f.path);
        assert.include(paths, '/src/index.tsx');
        assert.include(paths, '/src/App.tsx');
        assert.include(paths, '/src/styles.css');
      });

      it('includes file sizes', () => {
        const files = vfs.listFiles('app-1');

        for (const file of files) {
          assert.isNumber(file.size);
          assert.isTrue(file.size > 0);
        }
      });

      it('returns empty array for non-existent app', () => {
        const files = vfs.listFiles('nonexistent');
        assert.isArray(files);
        assert.strictEqual(files.length, 0);
      });

      it('reflects added files', () => {
        vfs.writeFile('app-1', '/custom/file.ts', 'export default 42;');

        const files = vfs.listFiles('app-1');
        const paths = files.map(f => f.path);

        assert.include(paths, '/custom/file.ts');
      });

      it('reflects deleted files', () => {
        vfs.deleteFile('app-1', '/src/styles.css');

        const files = vfs.listFiles('app-1');
        const paths = files.map(f => f.path);

        assert.notInclude(paths, '/src/styles.css');
      });
    });

    describe('fileExists', () => {
      it('returns true for existing file', () => {
        assert.isTrue(vfs.fileExists('app-1', '/src/App.tsx'));
      });

      it('returns false for non-existent file', () => {
        assert.isFalse(vfs.fileExists('app-1', '/nope.txt'));
      });

      it('returns false for non-existent app', () => {
        assert.isFalse(vfs.fileExists('nonexistent', '/file.txt'));
      });
    });
  });

  describe('getApp', () => {
    it('returns VFS state for existing app', () => {
      vfs.createApp('app-1');

      const state = vfs.getApp('app-1');
      assert.isOk(state);
      assert.isOk(state?.files);
      assert.isOk(state?.entry);
    });

    it('returns null for non-existent app', () => {
      const state = vfs.getApp('nonexistent');
      assert.isNull(state);
    });
  });

  describe('deleteApp', () => {
    it('deletes existing VFS', () => {
      vfs.createApp('app-1');
      const deleted = vfs.deleteApp('app-1');

      assert.isTrue(deleted);
      assert.isNull(vfs.getApp('app-1'));
    });

    it('returns false for non-existent VFS', () => {
      const deleted = vfs.deleteApp('nonexistent');
      assert.isFalse(deleted);
    });
  });

  describe('getFiles', () => {
    it('returns file map for bundling', () => {
      vfs.createApp('app-1');
      const files = vfs.getFiles('app-1');

      assert.isOk(files);
      assert.isOk(files?.['/src/index.tsx']);
    });

    it('returns null for non-existent app', () => {
      const files = vfs.getFiles('nonexistent');
      assert.isNull(files);
    });
  });

  describe('entry point', () => {
    it('getEntry returns entry point', () => {
      vfs.createApp('app-1');
      const entry = vfs.getEntry('app-1');

      assert.strictEqual(entry, '/src/index.tsx');
    });

    it('setEntry updates entry point', () => {
      vfs.createApp('app-1');
      vfs.setEntry('app-1', '/main.tsx');

      const entry = vfs.getEntry('app-1');
      assert.strictEqual(entry, '/main.tsx');
    });

    it('getEntry returns null for non-existent app', () => {
      const entry = vfs.getEntry('nonexistent');
      assert.isNull(entry);
    });
  });

  describe('path normalization', () => {
    beforeEach(() => {
      vfs.createApp('app-1');
    });

    it('adds leading slash to paths', () => {
      vfs.writeFile('app-1', 'src/file.ts', 'content');
      const content = vfs.readFile('app-1', '/src/file.ts');
      assert.strictEqual(content, 'content');
    });

    it('removes double slashes', () => {
      vfs.writeFile('app-1', '/src//file.ts', 'content');
      const content = vfs.readFile('app-1', '/src/file.ts');
      assert.strictEqual(content, 'content');
    });

    it('prevents directory traversal', () => {
      assert.throws(() => {
        vfs.writeFile('app-1', '/src/../../../etc/passwd', 'evil');
      }, /Directory traversal not allowed/);
    });
  });

  describe('importFiles', () => {
    it('imports multiple files at once', () => {
      vfs.createApp('app-1', 'blank');

      vfs.importFiles('app-1', {
        '/a.ts': 'file a',
        '/b.ts': 'file b',
        '/c.ts': 'file c',
      });

      assert.strictEqual(vfs.readFile('app-1', '/a.ts'), 'file a');
      assert.strictEqual(vfs.readFile('app-1', '/b.ts'), 'file b');
      assert.strictEqual(vfs.readFile('app-1', '/c.ts'), 'file c');
    });
  });
});
