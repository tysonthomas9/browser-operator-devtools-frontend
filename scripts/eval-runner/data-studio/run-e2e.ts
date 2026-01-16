#!/usr/bin/env node
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Runner for Data Studio E2E tests.
 * Sets up Mocha properly before importing the test file.
 */

// Must be first - shim browser globals
import '../lib/BrowserGlobals.js';

import Mocha from 'mocha';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const mocha = new Mocha({
    timeout: 300000, // 5 minutes
    color: true,
    bail: false,
  });

  // Add the test file
  mocha.addFile(path.join(__dirname, 'data-studio-e2e.test.ts'));

  // Run tests
  return new Promise<void>((resolve, reject) => {
    mocha.run(failures => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed`));
      } else {
        resolve();
      }
    });
  });
}

run()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Tests failed:', err.message);
    process.exit(1);
  });
