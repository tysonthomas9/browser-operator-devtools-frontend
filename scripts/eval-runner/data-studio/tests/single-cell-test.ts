#!/usr/bin/env npx tsx
/**
 * Simple single-cell E2E test for Data Studio
 * Tests: Create table → Add entity → Add agent → Run one cell → Verify result
 */

import dotenv from 'dotenv';
dotenv.config();

import puppeteer, {type Browser, type Page} from 'puppeteer-core';
import {
  waitForConnected,
  waitForSelectorView,
  createTable,
  addEntity,
  addAgentGroup,
  clickCell,
  settle,
  getState,
} from './helpers.js';

const HTTP_PORT = 3456;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function runTest() {
  console.log('='.repeat(60));
  console.log('Single Cell E2E Test');
  console.log('='.repeat(60));

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
    console.log('\n[1/6] Launching browser...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false, // Show browser so we can see what happens
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({width: 1280, height: 800});

    // Navigate to app
    console.log('[2/6] Navigating to Data Studio...');
    await page.goto(`http://localhost:${HTTP_PORT}`, {waitUntil: 'networkidle0'});
    await waitForConnected(page);
    await waitForSelectorView(page);
    console.log('      ✓ Connected to server');

    // Create table
    console.log('[3/6] Creating table...');
    await createTable(page, 'Single Cell Test', 'Company', 'Company Name');
    console.log('      ✓ Table created');

    // Add entity
    console.log('[4/6] Adding entity...');
    await addEntity(page, 'OpenAI');
    console.log('      ✓ Entity added');

    // Add agent group
    console.log('[5/6] Adding agent group...');
    // Use a simpler query that completes faster
    await addAgentGroup(page, 'research_agent', 'What is {entity}? One sentence answer.', [{key: 'answer', label: 'Answer'}]);
    console.log('      ✓ Agent group added');

    // Click cell to run single agent
    console.log('[6/6] Running single cell (clicking pending cell)...');
    await clickCell(page, 'OpenAI', 1); // Click the result cell (column 1)

    // Wait for result (up to 60s)
    console.log('      Waiting for agent to complete (up to 60s)...');
    const startTime = Date.now();
    let completed = false;

    while (Date.now() - startTime < 900000) { // 15 minute timeout
      await settle(page, 1000);
      const state = await getState(page);
      const table = state?.currentTable;

      if (table?.results) {
        const entityId = table.entities[0]?.id;
        const agentId = table.agentGroups[0]?.id;
        const result = table.results[entityId]?.[agentId];

        if (result?.status === 'completed') {
          console.log('      ✓ Agent completed successfully!');
          console.log(`      Result: ${JSON.stringify(result.values)}`);
          completed = true;
          break;
        } else if (result?.status === 'error') {
          console.log('      ✗ Agent failed with error:');
          console.log(`        ${result.error}`);
          break;
        } else if (result?.status === 'running') {
          process.stdout.write('.');
        }
      }
    }

    if (!completed) {
      console.log('\n      ✗ Timed out waiting for result');
    }

    console.log('\n' + '='.repeat(60));
    console.log(completed ? 'TEST PASSED' : 'TEST FAILED');
    console.log('='.repeat(60));

    // Keep browser open for inspection
    console.log('\nBrowser staying open for inspection. Press Ctrl+C to exit.');
    await new Promise(() => {}); // Wait forever

  } catch (error) {
    console.error('\nTest error:', error);
    process.exit(1);
  }
}

runTest();
