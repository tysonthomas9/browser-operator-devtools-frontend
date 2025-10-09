// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {CreateFileTool} from '../CreateFileTool.js';
import {FileStorageManager, type StoredFile} from '../FileStorageManager.js';

describe('CreateFileTool', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates a file successfully', async () => {
    const stored: StoredFile = {
      id: 'id-123',
      sessionId: 'sess-1',
      fileName: 'note.txt',
      content: 'hello',
      mimeType: 'text/plain',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: 5,
    };

    const fakeManager = {createFile: sinon.stub().resolves(stored)} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new CreateFileTool();
    const result = await tool.execute({fileName: 'note.txt', content: 'hello', reasoning: 'store note'});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.fileName, 'note.txt');
    assert.strictEqual(result.fileId, 'id-123');
    assert.isString(result.message);
    assert.match(result.message!, /Created file "note\.txt" \(\d+ bytes\)\./);

    sinon.assert.calledOnce((fakeManager as any).createFile);
    sinon.assert.calledWithExactly((fakeManager as any).createFile, 'note.txt', 'hello', undefined);
  });

  it('returns an error when creation fails', async () => {
    const fakeManager = {createFile: sinon.stub().rejects(new Error('boom'))} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new CreateFileTool();
    const result = await tool.execute({fileName: 'note.txt', content: 'hello', reasoning: 'store note'});

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'boom');
  });
});

