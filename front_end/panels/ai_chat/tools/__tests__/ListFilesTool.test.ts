// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ListFilesTool} from '../ListFilesTool.js';
import {FileStorageManager, type FileSummary} from '../FileStorageManager.js';

describe('ListFilesTool', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('lists files successfully and returns count', async () => {
    const now = Date.now();
    const files: FileSummary[] = [
      {fileName: 'b.txt', size: 2, mimeType: 'text/plain', createdAt: now - 2, updatedAt: now - 1},
      {fileName: 'a.txt', size: 1, mimeType: 'text/plain', createdAt: now - 3, updatedAt: now - 2},
    ];
    const fakeManager = {listFiles: sinon.stub().resolves(files)} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new ListFilesTool();
    const result = await tool.execute({reasoning: 'enumerate'});

    assert.strictEqual(result.success, true);
    assert.deepEqual(result.files, files);
    assert.strictEqual(result.count, files.length);
    sinon.assert.calledOnce((fakeManager as any).listFiles);
  });

  it('returns an error when listing fails', async () => {
    const fakeManager = {listFiles: sinon.stub().rejects(new Error('no db'))} as unknown as FileStorageManager;
    sinon.stub(FileStorageManager, 'getInstance').returns(fakeManager);

    const tool = new ListFilesTool();
    const result = await tool.execute({reasoning: 'enumerate'});

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'no db');
  });
});

