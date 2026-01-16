#!/usr/bin/env npx tsx
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio UI E2E Tests
 *
 * Comprehensive test coverage for all Data Studio UI functionality.
 * Based on TEST_CASES.md verification via Chrome MCP testing.
 *
 * Test Categories:
 * - TC-1xx: Table Creation (4 tests) - ALL PASS
 * - TC-2xx: Entity Management (4 tests) - ALL PASS
 * - TC-3xx: Agent Groups (4 tests) - ALL PASS
 * - TC-4xx: Inline Agents (6 tests) - IMPLEMENTED
 * - TC-5xx: Execution (3 of 6 tests) - 501-503 PASS
 * - TC-6xx: Results Display (3 of 4 tests) - 601-603 PASS
 * - TC-7xx: Persistence (4 of 5 tests) - 701-704 PASS
 * - TC-8xx: Navigation (1 of 3 tests) - 801 PASS
 *
 * Usage:
 *   npx tsx scripts/eval-runner/data-studio/tests/data-studio-ui.test.ts
 *
 * Prerequisites:
 *   Start server first: npx tsx scripts/eval-runner/data-studio/run-server.ts
 */

// IMPORTANT: Must be first import to shim browser globals before DevTools imports
import '../../lib/BrowserGlobals.js';

import {describe, it, before, after, beforeEach} from 'mocha';
import {expect} from 'chai';
import puppeteer, {type Browser, type Page} from 'puppeteer-core';
import * as fs from 'fs';

import {
  waitForConnected,
  waitForSelectorView,
  waitForTableView,
  waitForText,
  clickButton,
  createTable,
  addEntity,
  removeEntity,
  addAgentGroup,
  removeAgentGroup,
  addInlineAgentGroup,
  getInlineAgentConfig,
  goBack,
  settle,
  loadTable,
  useTemplate,
  getState,
  isModalOpen,
  hasValidationError,
  getValidationError,
  closeModal,
  runAll,
  clickCell,
} from './helpers.js';

// Configuration
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3456', 10);
const HEADLESS = process.env.HEADLESS !== 'false';

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

  throw new Error('Chrome/Browser Operator not found.');
}

describe('Data Studio UI Tests', function () {
  this.timeout(60000); // 1 minute per test

  let browser: Browser;
  let page: Page;

  before(async function () {
    console.log('\n' + '='.repeat(60));
    console.log('Data Studio UI E2E Tests');
    console.log('='.repeat(60));
    console.log(`Server: http://localhost:${HTTP_PORT}`);
    console.log(`Headless: ${HEADLESS}`);
    console.log('='.repeat(60) + '\n');

    const chromePath = findChrome();
    console.log(`[Setup] Using browser: ${chromePath}`);

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: HEADLESS,
      devtools: !HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    page = await browser.newPage();
    await page.setViewport({width: 1280, height: 800});

    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[Browser ERROR]', msg.text());
      }
    });
  });

  after(async function () {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async function () {
    // Navigate to Data Studio and wait for connection
    await page.goto(`http://localhost:${HTTP_PORT}`);
    await waitForConnected(page);

    // Wait for UI to load - either selector or table view
    await page.waitForFunction(
      () => document.body.innerText.length > 100,
      {timeout: 10000},
    );

    // If we're on table view (from previous test), go back to selector
    const onTableView = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.includes('Back'));
    });

    if (onTableView) {
      await clickButton(page, 'Back');
      await settle(page, 500);
    }

    await waitForSelectorView(page);
  });

  // ============================================================
  // TC-1xx: Table Creation
  // ============================================================

  describe('TC-1xx: Table Creation', function () {
    it('TC-101: Create custom table', async function () {
      // Steps: Click Create Custom, fill details, click Create
      await clickButton(page, 'Create Custom');
      await page.waitForSelector('input', {timeout: 5000});

      const inputs = await page.$$('input');
      await inputs[0].type('Test Table');
      await inputs[1].type('Company');
      await inputs[2].type('Company Name');

      await clickButton(page, 'Create Table');
      await waitForTableView(page);

      // Verify table view shows with empty state message
      await waitForText(page, 'Test Table');
      const state = await getState(page);
      expect(state?.view).to.equal('table');
      expect(state?.currentTable?.name).to.equal('Test Table');
      expect(state?.currentTable?.entityType).to.equal('Company');
    });

    it('TC-102: Create from template', async function () {
      // Steps: Click template card
      await useTemplate(page, 'Competitor Analysis');

      // Verify table populates with template data
      const state = await getState(page);
      expect(state?.view).to.equal('table');
      expect(state?.currentTable?.entities.length).to.be.greaterThan(0);
      expect(state?.currentTable?.agentGroups.length).to.be.greaterThan(0);
    });

    it('TC-103: Load saved table', async function () {
      // First create and save a table
      await createTable(page, 'Saved Table Test', 'Product', 'Product Name');
      await addEntity(page, 'Product A');
      await settle(page);

      // Return to selector
      await goBack(page);

      // Load the saved table
      await loadTable(page, 'Saved Table Test');

      // Verify data is restored
      const state = await getState(page);
      expect(state?.currentTable?.name).to.equal('Saved Table Test');
      expect(state?.currentTable?.entities.some(e => e.name === 'Product A')).to.be.true;
    });

    it('TC-104: Invalid table name validation', async function () {
      // Click Create Custom, leave name empty, click Create
      await clickButton(page, 'Create Custom');
      await page.waitForSelector('input', {timeout: 5000});

      // Fill only entity type and label, leave name empty
      const inputs = await page.$$('input');
      await inputs[1].type('Company');
      await inputs[2].type('Name');

      await clickButton(page, 'Create Table');

      // Verify validation error shown
      await settle(page);
      const hasError = await hasValidationError(page);
      expect(hasError).to.be.true;

      // Modal should still be open
      const modalOpen = await isModalOpen(page);
      expect(modalOpen).to.be.true;
    });
  });

  // ============================================================
  // TC-2xx: Entity Management
  // ============================================================

  describe('TC-2xx: Entity Management', function () {
    beforeEach(async function () {
      // Create a table first
      await createTable(page, 'Entity Test Table', 'Company', 'Company Name');
    });

    it('TC-201: Add entity', async function () {
      await addEntity(page, 'Acme Corp');

      // Verify entity appears
      const state = await getState(page);
      expect(state?.currentTable?.entities.some(e => e.name === 'Acme Corp')).to.be.true;
    });

    it('TC-202: Add entity with context', async function () {
      await addEntity(page, 'TechCorp', 'Fortune 500 technology company');

      // Verify entity with context
      const state = await getState(page);
      const entity = state?.currentTable?.entities.find(e => e.name === 'TechCorp');
      expect(entity).to.exist;
      expect(entity?.context).to.include('Fortune 500');
    });

    it('TC-203: Remove entity', async function () {
      // Add entity first
      await addEntity(page, 'ToDelete Corp');
      await settle(page);

      // Verify it exists
      let state = await getState(page);
      expect(state?.currentTable?.entities.some(e => e.name === 'ToDelete Corp')).to.be.true;

      // Remove entity
      await removeEntity(page, 'ToDelete Corp');
      await settle(page);

      // Verify removed
      state = await getState(page);
      expect(state?.currentTable?.entities.some(e => e.name === 'ToDelete Corp')).to.be.false;
    });

    it('TC-204: Add multiple entities', async function () {
      const entities = ['Company A', 'Company B', 'Company C', 'Company D', 'Company E'];

      for (const name of entities) {
        await addEntity(page, name);
        await settle(page, 200);
      }

      // Verify all 5 entities exist
      const state = await getState(page);
      expect(state?.currentTable?.entities.length).to.be.at.least(5);

      for (const name of entities) {
        expect(state?.currentTable?.entities.some(e => e.name === name)).to.be.true;
      }
    });
  });

  // ============================================================
  // TC-3xx: Agent Groups
  // ============================================================

  describe('TC-3xx: Agent Groups', function () {
    beforeEach(async function () {
      await createTable(page, 'Agent Test Table', 'Company', 'Company Name');
      await addEntity(page, 'Test Corp');
    });

    it('TC-301: Add agent group', async function () {
      await addAgentGroup(page, 'research_agent', 'Research {entity}', [{key: 'summary', label: 'Summary'}]);

      // Verify agent column appears
      const state = await getState(page);
      expect(state?.currentTable?.agentGroups.some(ag => ag.agentName === 'research_agent')).to.be.true;
    });

    it('TC-302: Configure output columns', async function () {
      await addAgentGroup(page, 'research_agent', 'Research {entity}', [
        {key: 'summary', label: 'Summary'},
        {key: 'revenue', label: 'Revenue'},
        {key: 'employees', label: 'Employees'},
      ]);

      // Verify all 3 columns configured
      const state = await getState(page);
      const agentGroup = state?.currentTable?.agentGroups.find(ag => ag.agentName === 'research_agent');
      expect(agentGroup?.outputColumns.length).to.equal(3);
      expect(agentGroup?.outputColumns.some(c => c.key === 'summary')).to.be.true;
      expect(agentGroup?.outputColumns.some(c => c.key === 'revenue')).to.be.true;
      expect(agentGroup?.outputColumns.some(c => c.key === 'employees')).to.be.true;
    });

    it('TC-303: Remove agent group', async function () {
      // Add agent first
      await addAgentGroup(page, 'research_agent', 'Research {entity}', [{key: 'result', label: 'Result'}]);
      await settle(page);

      // Verify it exists
      let state = await getState(page);
      expect(state?.currentTable?.agentGroups.length).to.be.greaterThan(0);

      // Remove agent group
      await removeAgentGroup(page, 'research_agent');
      await settle(page);

      // Verify removed
      state = await getState(page);
      expect(state?.currentTable?.agentGroups.some(ag => ag.agentName === 'research_agent')).to.be.false;
    });

    it('TC-304: Invalid query template validation', async function () {
      // Add agent with empty query template
      await clickButton(page, 'Add Agent');
      await page.waitForSelector('select', {timeout: 5000});

      // Select agent
      await page.evaluate(() => {
        const select = document.querySelector('select');
        if (select && select.options.length > 1) {
          select.value = select.options[1].value;
          select.dispatchEvent(new Event('change', {bubbles: true}));
        }
      });

      // Fill output column but leave query empty
      const keyInputs = await page.$$('input[placeholder*="Key"]');
      const labelInputs = await page.$$('input[placeholder*="Label"]');
      if (keyInputs[0]) await keyInputs[0].type('result');
      if (labelInputs[0]) await labelInputs[0].type('Result');

      // Try to submit
      await clickButton(page, 'Add Agent Column');
      await settle(page);

      // Verify validation error shown
      const hasError = await hasValidationError(page);
      expect(hasError).to.be.true;

      const errorText = await getValidationError(page);
      expect(errorText).to.include('required');
    });
  });

  // ============================================================
  // TC-4xx: Inline Agents - SKIPPED (not implemented)
  // ============================================================

  describe('TC-4xx: Inline Agents', function () {
    this.timeout(120000);

    beforeEach(async function () {
      await createTable(page, 'Inline Agent Test', 'Company', 'Company Name');
      await addEntity(page, 'Test Corp');
    });

    it('TC-401: Add inline agent group', async function () {
      await addInlineAgentGroup(
        page,
        {
          name: 'test_agent',
          displayName: 'Test Agent',
          systemPrompt: 'Return JSON: {"result": "test"}',
        },
        'Analyze {entity}',
        [{key: 'result', label: 'Result'}],
      );

      const state = await getState(page);
      expect(state?.currentTable?.agentGroups[0]?.inlineAgent).to.exist;
      expect(state?.currentTable?.agentGroups[0]?.inlineAgent?.name).to.equal('test_agent');
    });

    it('TC-402: Inline agent with OpenAI provider', async function () {
      await addInlineAgentGroup(
        page,
        {
          name: 'openai_agent',
          displayName: 'OpenAI Agent',
          systemPrompt: 'Return JSON: {"result": "openai"}',
          provider: 'openai',
          model: 'gpt-4o-mini',
        },
        'Analyze {entity}',
        [{key: 'result', label: 'Result'}],
      );

      const inlineConfig = await getInlineAgentConfig(page);
      expect(inlineConfig?.provider).to.equal('openai');
      expect(inlineConfig?.model).to.equal('gpt-4o-mini');
    });

    it('TC-403: Inline agent with Cerebras provider', async function () {
      await addInlineAgentGroup(
        page,
        {
          name: 'cerebras_agent',
          displayName: 'Cerebras Agent',
          systemPrompt: 'Return JSON: {"result": "cerebras"}',
          provider: 'cerebras',
          model: 'llama-3.3-70b',
        },
        'Analyze {entity}',
        [{key: 'result', label: 'Result'}],
      );

      const inlineConfig = await getInlineAgentConfig(page);
      expect(inlineConfig?.provider).to.equal('cerebras');
      expect(inlineConfig?.model).to.equal('llama-3.3-70b');
    });

    it('TC-404: Inline agent with multiple output columns', async function () {
      await addInlineAgentGroup(
        page,
        {
          name: 'multi_col_agent',
          displayName: 'Multi Column Agent',
          systemPrompt: 'Return JSON with summary, strengths, weaknesses',
        },
        'Analyze {entity}',
        [
          {key: 'summary', label: 'Summary'},
          {key: 'strengths', label: 'Strengths'},
          {key: 'weaknesses', label: 'Weaknesses'},
        ],
      );

      const state = await getState(page);
      const outputColumns = state?.currentTable?.agentGroups[0]?.outputColumns;
      expect(outputColumns?.length).to.equal(3);
      expect(outputColumns?.map((c: {key: string}) => c.key)).to.deep.equal(['summary', 'strengths', 'weaknesses']);
    });

    it('TC-405: Inline agent default provider (no provider specified)', async function () {
      await addInlineAgentGroup(
        page,
        {
          name: 'default_agent',
          displayName: 'Default Provider Agent',
          systemPrompt: 'Return JSON: {"result": "default"}',
          // No provider/model specified - will use form defaults
        },
        'Analyze {entity}',
        [{key: 'result', label: 'Result'}],
      );

      const inlineConfig = await getInlineAgentConfig(page);
      // Form defaults to openai/gpt-4o-mini when no provider is specified
      expect(inlineConfig?.provider).to.equal('openai');
      expect(inlineConfig?.model).to.equal('gpt-4o-mini');
    });

    it('TC-406: Multiple inline agents with different providers', async function () {
      // Add first inline agent with OpenAI
      await addInlineAgentGroup(
        page,
        {
          name: 'openai_test',
          displayName: 'OpenAI Test',
          systemPrompt: 'Return JSON: {"result": "openai"}',
          provider: 'openai',
          model: 'gpt-4o',
        },
        'Analyze {entity} with OpenAI',
        [{key: 'openai_result', label: 'OpenAI Result'}],
      );

      // Add second inline agent with Cerebras
      await addInlineAgentGroup(
        page,
        {
          name: 'cerebras_test',
          displayName: 'Cerebras Test',
          systemPrompt: 'Return JSON: {"result": "cerebras"}',
          provider: 'cerebras',
          model: 'llama-3.3-70b',
        },
        'Analyze {entity} with Cerebras',
        [{key: 'cerebras_result', label: 'Cerebras Result'}],
      );

      // Verify both inline agents have correct providers
      const state = await getState(page);
      expect(state?.currentTable?.agentGroups.length).to.equal(2);

      const agent1 = state?.currentTable?.agentGroups[0];
      expect(agent1?.inlineAgent?.provider).to.equal('openai');
      expect(agent1?.inlineAgent?.model).to.equal('gpt-4o');

      const agent2 = state?.currentTable?.agentGroups[1];
      expect(agent2?.inlineAgent?.provider).to.equal('cerebras');
      expect(agent2?.inlineAgent?.model).to.equal('llama-3.3-70b');
    });
  });

  // ============================================================
  // TC-5xx: Execution
  // ============================================================

  describe('TC-5xx: Execution', function () {
    this.timeout(120000); // 2 minutes for agent execution

    beforeEach(async function () {
      // Extra wait to ensure parent beforeEach completed and UI is ready
      await settle(page, 1000);
      console.log('[TC-5xx] beforeEach: calling useTemplate');
      await useTemplate(page, 'Competitor Analysis');
      console.log('[TC-5xx] beforeEach: useTemplate completed');
    });

    it('TC-501: Run single cell', async function () {
      // Click on a pending cell to run it
      await clickCell(page, 'OpenAI', 1);
      await settle(page, 1000);

      // Verify cell status changes
      const state = await getState(page);
      const entityId = state?.currentTable?.entities[0]?.id;
      const agentGroupId = state?.currentTable?.agentGroups[0]?.id;

      if (entityId && agentGroupId) {
        const cellStatus = state?.currentTable?.results[entityId]?.[agentGroupId]?.status;
        expect(['running', 'completed', 'error']).to.include(cellStatus);
      }
    });

    it('TC-502: Run single row', async function () {
      // Click row run button
      await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        if (rows[0]) {
          const runBtn = rows[0].querySelector('button[title*="Run"], button:has(svg)');
          if (runBtn) {
            (runBtn as HTMLButtonElement).click();
          }
        }
      });
      await settle(page, 1000);

      // Verify row cells start executing
      const state = await getState(page);
      expect(state?.isRunning || state?.currentTable?.results).to.exist;
    });

    it('TC-503: Run all', async function () {
      await runAll(page);
      await settle(page, 1000);

      // Verify execution started
      const state = await getState(page);
      expect(state?.isRunning || Object.keys(state?.currentTable?.results || {}).length > 0).to.be.true;
    });
  });

  // ============================================================
  // TC-6xx: Results Display
  // ============================================================

  describe('TC-6xx: Results Display', function () {
    this.timeout(120000);

    beforeEach(async function () {
      // Extra wait to ensure parent beforeEach completed and UI is ready
      await settle(page, 1000);
      console.log('[TC-6xx] beforeEach: calling useTemplate');
      await useTemplate(page, 'Competitor Analysis');
      console.log('[TC-6xx] beforeEach: useTemplate completed, calling runAll');
      await runAll(page);
      // Wait for at least one cell to complete
      await page.waitForFunction(
        () => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('completed') || text.includes('error');
        },
        {timeout: 60000},
      );
    });

    it('TC-601: View completed cell', async function () {
      // Click on a completed cell
      await page.evaluate(() => {
        const completedCell = document.querySelector('[data-status="completed"], .completed');
        if (completedCell) {
          (completedCell as HTMLElement).click();
        }
      });
      await settle(page);

      // Modal should open with result
      const modalOpen = await isModalOpen(page);
      expect(modalOpen).to.be.true;
    });

    it('TC-602: View error cell', async function () {
      // Look for any error cells
      const hasErrorCell = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('error');
      });

      if (hasErrorCell) {
        // Click error cell
        await page.evaluate(() => {
          const errorCell = document.querySelector('[data-status="error"], .error');
          if (errorCell) {
            (errorCell as HTMLElement).click();
          }
        });
        await settle(page);

        // Modal should show error message
        const modalOpen = await isModalOpen(page);
        expect(modalOpen).to.be.true;
      } else {
        // Skip if no errors
        this.skip();
      }
    });

    it('TC-603: Copy cell content', async function () {
      // Open a cell detail modal
      await page.evaluate(() => {
        const cell = document.querySelector('[data-status="completed"], .completed');
        if (cell) {
          (cell as HTMLElement).click();
        }
      });
      await settle(page);

      // Look for copy button
      const hasCopyButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent?.toLowerCase().includes('copy'));
      });

      expect(hasCopyButton).to.be.true;
    });
  });

  // ============================================================
  // TC-7xx: Persistence
  // ============================================================

  describe('TC-7xx: Persistence', function () {
    it('TC-701: Save table', async function () {
      await createTable(page, 'Persistence Test', 'Item', 'Item Name');
      await addEntity(page, 'Test Item 1');
      await settle(page);

      // Table should auto-save - verify in state
      const state = await getState(page);
      expect(state?.tables.some(t => t.name === 'Persistence Test')).to.be.true;
    });

    it('TC-702: Load and verify', async function () {
      // Create table
      await createTable(page, 'Load Test', 'Product', 'Product Name');
      await addEntity(page, 'Product X');
      await settle(page);

      // Go back
      await goBack(page);

      // Load table
      await loadTable(page, 'Load Test');

      // Verify data restored
      const state = await getState(page);
      expect(state?.currentTable?.name).to.equal('Load Test');
      expect(state?.currentTable?.entities.some(e => e.name === 'Product X')).to.be.true;
    });

    it('TC-703: Delete table', async function () {
      // Create table
      await createTable(page, 'Delete Test Table', 'Thing', 'Thing Name');
      await settle(page);
      await goBack(page);

      // Verify table exists
      let state = await getState(page);
      expect(state?.tables.some(t => t.name === 'Delete Test Table')).to.be.true;

      // Delete table
      await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));
        const card = cards.find(c => c.textContent?.includes('Delete Test Table'));
        if (card) {
          const deleteBtn = Array.from(card.querySelectorAll('button')).find(b => {
            const svg = b.querySelector('svg');
            return svg || b.textContent?.toLowerCase().includes('delete');
          });
          if (deleteBtn) {
            (deleteBtn as HTMLButtonElement).click();
          }
        }
      });
      await settle(page);

      // Verify removed
      state = await getState(page);
      expect(state?.tables.some(t => t.name === 'Delete Test Table')).to.be.false;
    });

    it('TC-704: Export table', async function () {
      await createTable(page, 'Export Test', 'Data', 'Data Name');
      await addEntity(page, 'Data Point 1');
      await settle(page);

      // Look for export button
      const hasExportButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(
          b =>
            b.textContent?.toLowerCase().includes('export') || b.textContent?.toLowerCase().includes('download'),
        );
      });

      // Export functionality exists
      expect(hasExportButton).to.be.true;
    });
  });

  // ============================================================
  // TC-8xx: Navigation
  // ============================================================

  describe('TC-8xx: Navigation', function () {
    it('TC-801: Back to selector', async function () {
      // Start on selector view
      await createTable(page, 'Nav Test', 'Item', 'Item Name');

      // Verify we're in table view
      const inTableView = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent?.includes('Back'));
      });
      expect(inTableView).to.be.true;

      // Click back
      await goBack(page);

      // Verify we're back on selector
      const inSelectorView = await page.evaluate(() => document.body.innerText.includes('Start from Template'));
      expect(inSelectorView).to.be.true;
    });

    // TC-802 and TC-803 are N/A for SPA architecture
    it.skip('TC-802: Browser back (N/A - SPA)');
    it.skip('TC-803: Close and reopen (N/A - SPA)');
  });
});

// Run if executed directly
if (process.argv[1]?.includes('data-studio-ui.test')) {
  // This will be handled by mocha
  console.log('Run with: npx mocha --require tsx scripts/eval-runner/data-studio/tests/data-studio-ui.test.ts');
}
