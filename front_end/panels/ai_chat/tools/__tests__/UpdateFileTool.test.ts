// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {UpdateFileTool} from '../UpdateFileTool.js';
import {FileStorageManager, type StoredFile} from '../FileStorageManager.js';

describe('UpdateFileTool', () => {
  afterEach(() => {
    sinon.restore();
  });

  function makeStored(overrides: Partial<StoredFile> = {}): StoredFile {
    const now = Date.now();
    return {
      id: 'id-xyz',
      sessionId: 'sess-1',
      fileName: 'note.txt',
      content: 'updated',
      mimeType: 'text/plain',
      createdAt: now - 10,
      updatedAt: now,
      size: 7,
      ...overrides,
    };
  }

  it('replaces content successfully', async () => {
    const stored = makeStored();
    const fakeManager = {updateFile: sinon.stub().resolves(stored)} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new UpdateFileTool();
    const result = await tool.execute({fileName: 'note.txt', content: 'updated', reasoning: 'fix'});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.fileId, 'id-xyz');
    assert.isString(result.message);
    assert.match(result.message!, /Updated file "note\.txt" \(\d+ bytes\)\./);

    sinon.assert.calledOnce((fakeManager as any).updateFile);
    sinon.assert.calledWithExactly((fakeManager as any).updateFile, 'note.txt', 'updated', false);
  });

  it('appends content successfully', async () => {
    const stored = makeStored({size: 12});
    const fakeManager = {updateFile: sinon.stub().resolves(stored)} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new UpdateFileTool();
    const result = await tool.execute({fileName: 'note.txt', content: ' more', append: true, reasoning: 'add'});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.fileId, 'id-xyz');
    assert.match(result.message!, /Appended to file "note\.txt" \(\d+ bytes\)\./);

    sinon.assert.calledOnce((fakeManager as any).updateFile);
    sinon.assert.calledWithExactly((fakeManager as any).updateFile, 'note.txt', ' more', true);
  });

  it('returns an error when update fails', async () => {
    const fakeManager = {updateFile: sinon.stub().rejects(new Error('failed'))} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new UpdateFileTool();
    const result = await tool.execute({fileName: 'note.txt', content: 'oops', reasoning: 'fix'});

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'failed');
  });
});

