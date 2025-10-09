// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ReadFileTool} from '../ReadFileTool.js';
import {FileStorageManager, type StoredFile} from '../FileStorageManager.js';

describe('ReadFileTool', () => {
  afterEach(() => {
    sinon.restore();
  });

  function makeStored(overrides: Partial<StoredFile> = {}): StoredFile {
    const now = Date.now();
    return {
      id: 'id-1',
      sessionId: 'sess-1',
      fileName: 'note.txt',
      content: 'hello',
      mimeType: 'text/plain',
      createdAt: now - 100,
      updatedAt: now,
      size: 5,
      ...overrides,
    };
  }

  it('reads an existing file and returns metadata', async () => {
    const stored = makeStored();
    const fakeManager = {readFile: sinon.stub().resolves(stored)} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new ReadFileTool();
    const result = await tool.execute({fileName: 'note.txt', reasoning: 'inspect'});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.fileName, 'note.txt');
    assert.strictEqual(result.content, 'hello');
    assert.strictEqual(result.mimeType, 'text/plain');
    assert.strictEqual(result.size, 5);
    assert.isNumber(result.createdAt);
    assert.isNumber(result.updatedAt);
  });

  it('returns a not found error when manager returns null', async () => {
    const fakeManager = {readFile: sinon.stub().resolves(null)} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new ReadFileTool();
    const result = await tool.execute({fileName: 'missing.txt', reasoning: 'inspect'});

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'File "missing.txt" was not found in the current session.');
  });

  it('returns an error when read fails', async () => {
    const fakeManager = {readFile: sinon.stub().rejects(new Error('disk error'))} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new ReadFileTool();
    const result = await tool.execute({fileName: 'note.txt', reasoning: 'inspect'});

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'disk error');
  });
});

