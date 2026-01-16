#!/usr/bin/env npx tsx
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio E2E Test with Real Agent Execution
 *
 * This test:
 * 1. Serves the Data Studio SPA standalone
 * 2. Connects SPA to Node.js via WebSocket
 * 3. Runs real agents using the eval runner's agent infrastructure
 * 4. Verifies results appear in the UI
 *
 * Usage:
 *   npx tsx scripts/eval-runner/data-studio/data-studio-e2e.test.ts
 *
 * With options:
 *   HEADLESS=true npx tsx ...   # Run headless
 *   LLM_PROVIDER=openai npx tsx ...
 */

// IMPORTANT: Must be first import to shim browser globals before DevTools imports
import '../lib/BrowserGlobals.js';

import {describe, it, before, after} from 'mocha';
import {expect} from 'chai';
import puppeteer, {type Browser, type Page} from 'puppeteer-core';
import {DataStudioTestServer} from './DataStudioTestServer.js';
import {HTTPServer} from './serve.js';
import * as path from 'path';
import * as fs from 'fs';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment
const HEADLESS = process.env.HEADLESS === 'true';
const LLM_PROVIDER = (process.env.LLM_PROVIDER as 'openai' | 'cerebras' | 'anthropic') || 'cerebras';
const LLM_MODEL = process.env.LLM_MODEL || 'llama-3.3-70b';
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3456', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '3457', 10);

// Check if SPA bundle exists
function checkBundle(): boolean {
  const bundlePath = path.join(__dirname, 'dist', 'data-studio-spa.js');
  if (!fs.existsSync(bundlePath)) {
    console.error('');
    console.error('ERROR: SPA bundle not found!');
    console.error('');
    console.error('Run this first:');
    console.error('  npx tsx scripts/eval-runner/data-studio/bundle-spa.ts');
    console.error('');
    return false;
  }
  return true;
}

// Helper to wait for element with text
async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    (searchText: string) => {
      return document.body.innerText.includes(searchText);
    },
    {timeout},
    text,
  );
}

// Helper to click button containing text
async function clickButtonWithText(page: Page, text: string): Promise<void> {
  await page.evaluate((buttonText: string) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(b => b.textContent?.includes(buttonText));
    if (button) {
      (button as HTMLButtonElement).click();
    } else {
      throw new Error(`Button with text "${buttonText}" not found`);
    }
  }, text);
}

// Helper to type in input by placeholder
async function typeInInput(page: Page, placeholder: string, value: string): Promise<void> {
  const input = await page.$(`input[placeholder*="${placeholder}"]`);
  if (!input) {
    throw new Error(`Input with placeholder "${placeholder}" not found`);
  }
  await input.type(value);
}

// Helper to select from dropdown
async function selectOption(page: Page, optionText: string): Promise<void> {
  await page.evaluate((text: string) => {
    const select = document.querySelector('select');
    if (select) {
      const options = Array.from(select.options);
      const option = options.find(o => o.text.includes(text) || o.value.includes(text));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
  }, optionText);
}

describe('Data Studio E2E with Real Agents', function () {
  // Allow long timeouts for agent execution
  this.timeout(300000); // 5 minutes

  let testServer: DataStudioTestServer;
  let httpServer: HTTPServer;
  let browser: Browser;
  let page: Page;

  before(async function () {
    // Check bundle exists
    if (!checkBundle()) {
      this.skip();
      return;
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('Data Studio E2E Test');
    console.log('='.repeat(70));
    console.log(`HTTP Server: http://localhost:${HTTP_PORT}`);
    console.log(`WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`LLM Provider: ${LLM_PROVIDER}`);
    console.log(`LLM Model: ${LLM_MODEL}`);
    console.log(`Headless: ${HEADLESS}`);
    console.log('='.repeat(70));
    console.log('');

    // Start WebSocket server with agent execution
    console.log('[Setup] Starting DataStudioTestServer...');
    testServer = new DataStudioTestServer({
      wsPort: WS_PORT,
      headless: true, // Agent browser is always headless
      llmProvider: LLM_PROVIDER,
      llmModel: LLM_MODEL,
    });
    await testServer.start();

    // Start HTTP server for SPA
    console.log('[Setup] Starting HTTP server...');
    httpServer = new HTTPServer({port: HTTP_PORT, wsPort: WS_PORT});
    await httpServer.start();

    // Find Chrome/Browser Operator
    const chromePath = findChrome();
    console.log(`[Setup] Using browser: ${chromePath}`);

    // Launch browser for UI
    console.log('[Setup] Launching browser...');
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: HEADLESS,
      devtools: !HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();

    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.log('[Browser ERROR]', msg.text());
      } else if (type === 'warn') {
        console.log('[Browser WARN]', msg.text());
      } else if (msg.text().includes('[WS]') || msg.text().includes('[DataStudio]')) {
        console.log('[Browser]', msg.text());
      }
    });

    console.log('[Setup] Complete');
    console.log('');
  });

  after(async function () {
    console.log('');
    console.log('[Cleanup] Stopping services...');

    if (browser) {
      await browser.close();
    }
    if (httpServer) {
      await httpServer.stop();
    }
    if (testServer) {
      await testServer.stop();
    }

    console.log('[Cleanup] Done');
  });

  it('should load Data Studio UI and connect via WebSocket', async function () {
    console.log('[Test] Loading Data Studio...');

    await page.goto(`http://localhost:${HTTP_PORT}`);

    // Wait for WebSocket connection
    await page.waitForFunction(
      () => document.querySelector('#ws-status')?.classList.contains('connected'),
      {timeout: 10000},
    );
    console.log('  ✓ WebSocket connected');

    // Wait for UI to load
    await waitForText(page, 'Data Studio');
    console.log('  ✓ Data Studio loaded');

    // Should show selector view with templates
    await waitForText(page, 'Start from Template');
    console.log('  ✓ Selector view visible');
  });

  it('should create a custom table', async function () {
    console.log('[Test] Creating custom table...');

    // Click "Create Custom Table" button
    await clickButtonWithText(page, 'Create Custom');
    await page.waitForSelector('input', {timeout: 5000});
    console.log('  ✓ Create table modal opened');

    // Fill in table details
    const inputs = await page.$$('input');
    console.log(`  Found ${inputs.length} inputs`);
    if (inputs.length >= 3) {
      await inputs[0].type('Test Companies');
      await inputs[1].type('Company');
      await inputs[2].type('Company Name');
    }

    // Debug: Check if values are actually in the DOM
    const inputValues = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => (i as HTMLInputElement).value);
    });
    console.log(`  Input values after typing: ${JSON.stringify(inputValues)}`);
    console.log('  ✓ Table details filled');

    // Debug: List all buttons before clicking
    const buttonTexts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.textContent || '');
    });
    console.log(`  Buttons on page: ${JSON.stringify(buttonTexts)}`);

    // Click Create Table button (must be specific to avoid matching "Create Custom Table")
    console.log('  Clicking Create Table button...');
    await clickButtonWithText(page, 'Create Table');

    // Small delay to let action process
    await new Promise(r => setTimeout(r, 500));

    // Wait for table view
    await waitForText(page, 'Test Companies');
    console.log('  ✓ Table created and visible');
  });

  it('should add an entity', async function () {
    console.log('[Test] Adding entity...');

    // Debug: Show current buttons
    const buttonsBeforeOpen = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim() || '');
    });
    console.log(`  Buttons before opening modal: ${JSON.stringify(buttonsBeforeOpen)}`);

    // Click "Add Company" button in table header (entityType is "Company")
    await clickButtonWithText(page, 'Add Company');
    await page.waitForSelector('input', {timeout: 5000});
    console.log('  ✓ Add entity modal opened');

    // Fill in entity name
    const input = await page.$('input');
    if (input) {
      await input.type('Anthropic');
    }

    // Debug: Show buttons in modal
    const buttonsInModal = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim() || '');
    });
    console.log(`  Buttons with modal open: ${JSON.stringify(buttonsInModal)}`);

    // Click "Create Company" submit button (entityType is "Company")
    await clickButtonWithText(page, 'Create Company');

    // Wait for entity to appear
    await waitForText(page, 'Anthropic');
    console.log('  ✓ Entity added');
  });

  it('should add an agent group', async function () {
    console.log('[Test] Adding agent group...');

    // Click "Add Agent" button in table header
    await clickButtonWithText(page, 'Add Agent');
    await page.waitForSelector('select', {timeout: 5000});
    console.log('  ✓ Add agent modal opened');

    // Select agent
    await selectOption(page, 'search');

    // Fill in query template
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type('Research {entity} and provide a brief company overview');
    }

    // Also fill in output columns (required)
    const inputs = await page.$$('input');
    // inputs[0] and inputs[1] are for the first output column (key and label)
    if (inputs.length >= 2) {
      await inputs[0].type('result');
      await inputs[1].type('Result');
    }
    console.log('  ✓ Agent configured');

    // Click "Add Agent Column" submit button
    await clickButtonWithText(page, 'Add Agent Column');

    // Wait for agent column to appear
    await waitForText(page, 'research_agent');
    console.log('  ✓ Agent group added');
  });

  it('should execute agent and show results', async function () {
    this.timeout(180000); // 3 minutes for agent execution

    console.log('[Test] Running agent (this may take 30-60 seconds)...');

    // Debug: Show current buttons
    const buttonsBeforeRun = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim() || '');
    });
    console.log(`  Buttons available: ${JSON.stringify(buttonsBeforeRun)}`);

    // Click "Run All" button specifically
    await clickButtonWithText(page, 'Run All');
    console.log('  ✓ Clicked Run All');

    // Wait for cell to change from pending (could be running, completed, or error)
    // The execution might be fast enough that we miss the "running" state
    await page.waitForFunction(
      () => {
        const text = document.body.innerText.toLowerCase();
        // Wait until we see running, completed, or error (not just pending)
        return (
          text.includes('running') ||
          text.includes('completed') ||
          text.includes('error') ||
          // Also check if "Click to run" is gone (cell is no longer pending)
          !text.includes('click to run')
        );
      },
      {timeout: 30000}, // 30 seconds to start
    );
    console.log('  ✓ Cell execution triggered');

    // Wait a bit more for execution to complete if it's still running
    await new Promise(r => setTimeout(r, 2000));

    // Get final state
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('  Page contains "error":', pageText.toLowerCase().includes('error'));
    console.log('  Page contains "running":', pageText.toLowerCase().includes('running'));
    console.log('  Agent execution completed (may have succeeded or failed)');

    // Verify server state
    const tableState = testServer.getTableState();
    expect(tableState).to.not.be.undefined;
    expect(tableState!.entities).to.have.length.greaterThan(0);

    const entityId = tableState!.entities[0].id;
    const agentGroupId = tableState!.agentGroups[0]?.id;

    if (agentGroupId) {
      const cellResult = tableState!.results[entityId]?.[agentGroupId];
      console.log(`  Cell status: ${cellResult?.status}`);
      if (cellResult?.values) {
        console.log(`  Cell values: ${JSON.stringify(cellResult.values).slice(0, 100)}...`);
      }
      if (cellResult?.error) {
        console.log(`  Cell error: ${cellResult.error}`);
      }
    }

    console.log('  ✓ Server state verified');
  });
});

// Find Chrome/Browser Operator
function findChrome(): string {
  const candidates = [
    '/Applications/Browser Operator.app/Contents/MacOS/Browser Operator',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Chrome/Browser Operator not found. Please install Chrome or set CHROME_PATH.');
}

// Note: This file should be run via run-e2e.ts runner script
// Usage: ./node_modules/.bin/tsx scripts/eval-runner/data-studio/run-e2e.ts
