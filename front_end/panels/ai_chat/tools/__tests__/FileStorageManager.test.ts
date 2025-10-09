// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {FileStorageManager, type StoredFile, type FileSummary} from '../FileStorageManager.js';

describe('FileStorageManager', () => {
  beforeEach(() => {
    // Reset singleton to avoid session bleed between tests
    (FileStorageManager as unknown as {instance: FileStorageManager|null}).instance = null;
  });

  it('creates, reads, lists and deletes files end-to-end', async () => {
    const mgr = FileStorageManager.getInstance();

    const f1 = await mgr.createFile('f1.txt', 'Hello', 'text/plain');
    assert.strictEqual(f1.fileName, 'f1.txt');
    assert.strictEqual(f1.content, 'Hello');
    assert.strictEqual(f1.mimeType, 'text/plain');

    const f2 = await mgr.createFile('f2.txt', 'World');
    assert.strictEqual(f2.fileName, 'f2.txt');

    const read = await mgr.readFile('f1.txt');
    assert.isNotNull(read);
    assert.strictEqual(read?.content, 'Hello');

    const files: FileSummary[] = await mgr.listFiles();
    const names = new Set(files.map(f => f.fileName));
    assert.isTrue(names.has('f1.txt'));
    assert.isTrue(names.has('f2.txt'));
    if (files.length >= 2) {
      assert.isAtLeast(files[0].createdAt, files[1].createdAt);
    }

    await mgr.deleteFile('f1.txt');
    const afterDelete = await mgr.readFile('f1.txt');
    assert.isNull(afterDelete);
  });

  it('prevents duplicate filenames within the same session', async () => {
    const mgr = FileStorageManager.getInstance();
    await mgr.createFile('dup.txt', 'a');
    try {
      await mgr.createFile('dup.txt', 'b');
      assert.fail('Expected duplicate create to throw');
    } catch (e: any) {
      assert.match(String(e?.message || e), /already exists/i);
    }
  });

  it('validates file name rules', async () => {
    const mgr = FileStorageManager.getInstance();

    async function expectRejected(p: Promise<unknown>, re: RegExp) {
      try {
        await p;
        assert.fail('Expected promise to reject');
      } catch (e: any) {
        assert.match(String(e?.message || e), re);
      }
    }

    await expectRejected(mgr.createFile('', 'x'), /cannot be empty/i);
    await expectRejected(mgr.createFile('a/b', 'x'), /path separators/i);
    const tooLong = 'a'.repeat(256);
    await expectRejected(mgr.createFile(tooLong, 'x'), /255 characters or fewer/i);
  });

  it('updateFile supports append and replace semantics', async () => {
    const mgr = FileStorageManager.getInstance();
    await mgr.createFile('note.txt', 'A');

    const appended: StoredFile = await mgr.updateFile('note.txt', 'B', true);
    assert.strictEqual(appended.content, 'AB');
    assert.isAtLeast(appended.size, 2);

    const replaced: StoredFile = await mgr.updateFile('note.txt', 'C', false);
    assert.strictEqual(replaced.content, 'C');
    assert.strictEqual(replaced.size, new TextEncoder().encode('C').length);
  });

  it('readFile returns null when missing', async () => {
    const mgr = FileStorageManager.getInstance();
    const missing = await mgr.readFile('does-not-exist.txt');
    assert.isNull(missing);
  });
});
