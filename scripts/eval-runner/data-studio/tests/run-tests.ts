#!/usr/bin/env npx tsx
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio UI Test Runner
 *
 * Runs the Data Studio UI tests with proper server startup.
 *
 * Usage:
 *   npx tsx scripts/eval-runner/data-studio/tests/run-tests.ts
 *
 * Options:
 *   --headed    Run with visible browser (default: headless)
 *   --skip-build  Skip SPA rebuild (faster if no changes)
 */

import {spawn, type ChildProcess} from 'child_process';
import {createRequire} from 'module';
import * as path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse arguments
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const SKIP_BUILD = args.includes('--skip-build');

let serverProcess: ChildProcess | null = null;

async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[Runner] Starting Data Studio server...');

    const env = {
      ...process.env,
      HEADLESS: 'true', // Agent browser always headless
      SKIP_BUILD: SKIP_BUILD ? 'true' : 'false',
    };

    serverProcess = spawn('npx', ['tsx', path.join(__dirname, '../run-server.ts')], {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../../../..'),
    });

    let output = '';

    serverProcess.stdout?.on('data', data => {
      output += data.toString();
      process.stdout.write(data);

      // Server is ready when we see this message
      if (output.includes('Data Studio Full Server Ready!')) {
        setTimeout(resolve, 1000); // Give it a moment to fully initialize
      }
    });

    serverProcess.stderr?.on('data', data => {
      process.stderr.write(data);
    });

    serverProcess.on('error', err => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });

    serverProcess.on('exit', code => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      reject(new Error('Server startup timed out'));
    }, 60000);
  });
}

async function runTests(): Promise<number> {
  return new Promise(resolve => {
    console.log('\n[Runner] Starting tests...\n');

    const env = {
      ...process.env,
      HEADLESS: HEADED ? 'false' : 'true',
    };

    const testProcess = spawn(
      'npx',
      [
        'mocha',
        '--require',
        'tsx',
        '--timeout',
        '120000',
        path.join(__dirname, 'data-studio-ui.test.ts'),
      ],
      {
        env,
        stdio: 'inherit',
        cwd: path.join(__dirname, '../../../..'),
      },
    );

    testProcess.on('exit', code => {
      resolve(code || 0);
    });
  });
}

async function cleanup(): Promise<void> {
  if (serverProcess) {
    console.log('\n[Runner] Stopping server...');
    serverProcess.kill('SIGINT');

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Data Studio UI Test Runner');
  console.log('='.repeat(60));
  console.log(`Headed: ${HEADED}`);
  console.log(`Skip Build: ${SKIP_BUILD}`);
  console.log('='.repeat(60) + '\n');

  let exitCode = 1;

  try {
    await startServer();
    exitCode = await runTests();
  } catch (err) {
    console.error('[Runner] Error:', err);
    exitCode = 1;
  } finally {
    await cleanup();
  }

  process.exit(exitCode);
}

// Handle interrupts
process.on('SIGINT', async () => {
  console.log('\n[Runner] Interrupted, cleaning up...');
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n[Runner] Terminated, cleaning up...');
  await cleanup();
  process.exit(1);
});

main();
