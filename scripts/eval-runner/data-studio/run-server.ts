#!/usr/bin/env npx tsx
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Run the full Data Studio server (HTTP + WebSocket + Agent backend)
 *
 * Usage:
 *   npx tsx scripts/eval-runner/data-studio/run-server.ts
 *
 * Options (via env):
 *   HEADLESS=true   Run agent browser headless (default: false)
 *   HTTP_PORT=3456  HTTP port (default: 3456)
 *   WS_PORT=3457    WebSocket port (default: 3457)
 *   SKIP_BUILD=true Skip rebuilding SPA (default: false)
 */

// Load environment variables from .env before any other imports
import dotenv from 'dotenv';
dotenv.config();

// IMPORTANT: Must be first import to shim browser globals before DevTools imports
import '../lib/BrowserGlobals.js';

import {execSync} from 'child_process';
import * as path from 'path';
import {fileURLToPath} from 'url';

import {DataStudioTestServer} from './DataStudioTestServer.js';
import {HTTPServer} from './serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3456', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '3457', 10);
const HEADLESS = process.env.HEADLESS !== 'false';
const SKIP_BUILD = process.env.SKIP_BUILD === 'true';
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'cerebras' | 'anthropic' | 'groq';
const LLM_MODEL = process.env.LLM_MODEL || (LLM_PROVIDER === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b');

async function rebuildSPA() {
  const dataStudioDir = path.resolve(__dirname, '../../../front_end/panels/ai_chat/sandbox_apps/apps/data-studio');
  const projectRoot = path.resolve(__dirname, '../../..');

  console.log('[Build] Regenerating sources.ts from src/...');
  execSync('npx tsx build-sources.ts', {cwd: dataStudioDir, stdio: 'inherit'});

  console.log('[Build] Bundling SPA...');
  execSync('npx tsx scripts/eval-runner/data-studio/bundle-spa.ts', {cwd: projectRoot, stdio: 'inherit'});

  console.log('[Build] SPA rebuild complete!\n');
}

async function main() {
  console.log('Starting Data Studio Full Server...\n');

  // Auto-rebuild SPA unless skipped
  if (!SKIP_BUILD) {
    await rebuildSPA();
  } else {
    console.log('[Build] Skipping SPA rebuild (SKIP_BUILD=true)\n');
  }

  // Start HTTP server (serves SPA)
  const httpServer = new HTTPServer({port: HTTP_PORT, wsPort: WS_PORT});
  await httpServer.start();

  // Start WebSocket server with agent backend
  const wsServer = new DataStudioTestServer({
    wsPort: WS_PORT,
    headless: HEADLESS,
    llmProvider: LLM_PROVIDER,
    llmModel: LLM_MODEL,
  });
  await wsServer.start();

  console.log('\n========================================');
  console.log('Data Studio Full Server Ready!');
  console.log('========================================');
  console.log(`  SPA:       http://localhost:${HTTP_PORT}`);
  console.log(`  WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`  Headless:  ${HEADLESS}`);
  console.log(`  LLM:       ${LLM_PROVIDER}/${LLM_MODEL}`);
  console.log('========================================\n');
  console.log('Press Ctrl+C to stop.\n');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await wsServer.stop();
    await httpServer.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
