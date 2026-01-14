#!/usr/bin/env node
/**
 * Data Studio DevTools Agent Test Harness
 *
 * Runs the FULL DevTools agent framework (ConfigurableAgentTool, AgentRunner,
 * CerebrasProvider, DataStudioExecutor) with server-side logging for debugging.
 *
 * Usage:
 *   node data-studio-harness.mjs                    # Run with defaults
 *   node data-studio-harness.mjs --headed           # Show browser window
 *   node data-studio-harness.mjs --verbose          # Show all console logs
 *   node data-studio-harness.mjs --filter=Agent     # Filter logs by pattern
 *   node data-studio-harness.mjs --timeout=120000   # Custom timeout
 *
 * Environment Variables:
 *   CEREBRAS_API_KEY    - API key for Cerebras provider (or set via DevTools)
 *   CHROME_PATH         - Path to Chrome/Chromium binary
 *
 * What this harness does:
 *   1. Launches Chrome with custom DevTools frontend
 *   2. Opens AI Chat panel and Data Studio
 *   3. Captures ALL console logs to terminal
 *   4. Runs agent execution scenario
 *   5. Outputs errors and debugging info
 */

import * as puppeteer from 'puppeteer-core';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import * as os from 'os';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Load .env file from the same directory as this script
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        // Only set if not already in environment
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    return true;
  }
  return false;
}

// Load .env at startup
loadEnvFile();

// =============================================================================
// Configuration
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    headed: args.includes('--headed'),
    verbose: args.includes('--verbose'),
    filter: getArgValue(args, '--filter'),
    timeout: parseInt(getArgValue(args, '--timeout') || '90000', 10),
    scenario: getArgValue(args, '--scenario') || 'basic',
    help: args.includes('--help') || args.includes('-h'),
  };
}

function getArgValue(args, flag) {
  for (const arg of args) {
    if (arg.startsWith(`${flag}=`)) {
      return arg.split('=')[1];
    }
    const idx = args.indexOf(flag);
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
      return args[idx + 1];
    }
  }
  return null;
}

// =============================================================================
// Logging
// =============================================================================

const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  BG_RED: '\x1b[41m',
  BG_YELLOW: '\x1b[43m',
};

let config = { verbose: false, filter: null };

function formatTimestamp() {
  return new Date().toISOString().substring(11, 23);
}

function log(level, source, message, data = null) {
  // Apply filter
  if (config.filter) {
    const filterRegex = new RegExp(config.filter, 'i');
    const fullMessage = `${source} ${message} ${JSON.stringify(data || {})}`;
    if (!filterRegex.test(fullMessage)) {
      return;
    }
  }

  // Skip verbose logs unless verbose mode
  if (level === 'DEBUG' && !config.verbose) {
    return;
  }

  const timestamp = formatTimestamp();
  let color = COLORS.WHITE;
  let levelStr = level;

  switch (level) {
    case 'ERROR':
      color = COLORS.RED;
      levelStr = `${COLORS.BG_RED}${COLORS.WHITE} ERR ${COLORS.RESET}`;
      break;
    case 'WARN':
      color = COLORS.YELLOW;
      levelStr = `${COLORS.BG_YELLOW}${COLORS.WHITE} WRN ${COLORS.RESET}`;
      break;
    case 'INFO':
      color = COLORS.GREEN;
      levelStr = `${COLORS.GREEN}INFO${COLORS.RESET}`;
      break;
    case 'DEBUG':
      color = COLORS.DIM;
      levelStr = `${COLORS.DIM}DEBG${COLORS.RESET}`;
      break;
  }

  const sourceStr = source ? `${COLORS.CYAN}[${source}]${COLORS.RESET}` : '';
  let line = `${COLORS.DIM}${timestamp}${COLORS.RESET} ${levelStr} ${sourceStr} ${message}`;

  if (data && Object.keys(data).length > 0) {
    line += ` ${COLORS.DIM}${JSON.stringify(data)}${COLORS.RESET}`;
  }

  console.log(line);
}

// =============================================================================
// Browser Launch
// =============================================================================

function findChromePath() {
  // Check environment variable first
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  // Try to find built Chromium in expected locations
  const checkoutRoot = path.resolve(__dirname, '..', '..', '..');
  const platform = os.platform();

  const possiblePaths = [];

  if (platform === 'darwin') {
    possiblePaths.push(
      // Built Chromium in out/Default
      path.join(checkoutRoot, 'out', 'Default', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      // Built Chromium in out/Release
      path.join(checkoutRoot, 'out', 'Release', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      // Chrome Canary
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      // Regular Chrome
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    );
  } else if (platform === 'linux') {
    possiblePaths.push(
      path.join(checkoutRoot, 'out', 'Default', 'chrome'),
      path.join(checkoutRoot, 'out', 'Release', 'chrome'),
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    );
  } else if (platform === 'win32') {
    possiblePaths.push(
      path.join(checkoutRoot, 'out', 'Default', 'chrome.exe'),
      path.join(checkoutRoot, 'out', 'Release', 'chrome.exe'),
    );
  }

  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error(
    'Chrome/Chromium not found. Set CHROME_PATH environment variable or build Chromium.'
  );
}

function findDevToolsFrontend() {
  const checkoutRoot = path.resolve(__dirname, '..', '..', '..');

  // Check for built frontend in gen directory
  const possiblePaths = [
    // Standard build output
    path.join(checkoutRoot, 'out', 'Default', 'gen', 'front_end'),
    // Alternative location
    path.join(checkoutRoot, 'front_end'),
  ];

  for (const frontendPath of possiblePaths) {
    if (fs.existsSync(frontendPath)) {
      return url.pathToFileURL(frontendPath).toString();
    }
  }

  throw new Error(
    'DevTools frontend not found. Run `npm run build` first.'
  );
}

async function launchBrowser(opts) {
  const chromePath = findChromePath();
  const frontendUrl = findDevToolsFrontend();

  log('INFO', 'HARNESS', 'Found Chrome', { path: chromePath });
  log('INFO', 'HARNESS', 'Found DevTools frontend', { path: frontendUrl });

  const launchArgs = [
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    '--enable-experimental-web-platform-features',
    '--site-per-process',
    '--disable-gpu',
    `--custom-devtools-frontend=${frontendUrl}`,
    `--window-size=1400,900`,
    '--auto-open-devtools-for-tabs',
  ];

  log('INFO', 'HARNESS', 'Launching browser', { headless: !opts.headed });

  const browser = await puppeteer.launch({
    headless: !opts.headed,
    executablePath: chromePath,
    args: launchArgs,
    dumpio: opts.verbose,
    protocolTimeout: opts.timeout,
    pipe: true,
    defaultViewport: { width: 1280, height: 720 },
  });

  // Capture browser process output
  const browserProcess = browser.process();
  if (browserProcess) {
    if (browserProcess.stderr) {
      browserProcess.stderr.setEncoding('utf8');
      browserProcess.stderr.on('data', (data) => {
        if (opts.verbose) {
          const lines = data.trim().split('\n');
          for (const line of lines) {
            log('DEBUG', 'CHROME', line);
          }
        }
      });
    }
  }

  return browser;
}

// =============================================================================
// LLM Configuration
// =============================================================================

/**
 * Configure LLM settings in DevTools localStorage
 */
async function configureLLMSettings(devToolsPage, llmConfig) {
  log('INFO', 'HARNESS', 'Configuring LLM settings...');

  await devToolsPage.evaluate((cfg) => {
    // Set provider
    localStorage.setItem('ai_chat_provider', cfg.provider || 'openai');

    // Set API key
    if (cfg.apiKey) {
      localStorage.setItem('ai_chat_api_key', cfg.apiKey);
    }

    // Set models
    if (cfg.mainModel) {
      localStorage.setItem('ai_chat_model_selection', cfg.mainModel);
    }
    if (cfg.miniModel) {
      localStorage.setItem('ai_chat_mini_model', cfg.miniModel);
    }
    if (cfg.nanoModel) {
      localStorage.setItem('ai_chat_nano_model', cfg.nanoModel);
    }
  }, llmConfig);

  log('INFO', 'HARNESS', 'LLM settings configured', {
    provider: llmConfig.provider,
    mainModel: llmConfig.mainModel,
    hasApiKey: !!llmConfig.apiKey,
  });
}

// =============================================================================
// Console Log Capture
// =============================================================================

function installConsoleCapture(page, pageType = 'page') {
  // Map puppeteer console types to our log levels
  const typeMapping = {
    log: 'INFO',
    info: 'INFO',
    warning: 'WARN',
    error: 'ERROR',
    debug: 'DEBUG',
    trace: 'DEBUG',
    assert: 'ERROR',
  };

  page.on('console', async (msg) => {
    const type = msg.type();
    const level = typeMapping[type] || 'INFO';
    let text = msg.text();

    // Handle JSHandle@error
    if (text === 'JSHandle@error') {
      try {
        const errorHandle = msg.args()[0];
        if (errorHandle) {
          text = await errorHandle.evaluate((error) => {
            if (error && error.stack) {
              return error.stack;
            }
            if (error && error.message) {
              return error.message;
            }
            return String(error);
          });
          await errorHandle.dispose();
        }
      } catch {
        text = '[Error object - could not extract stack]';
      }
    }

    // Extract source location
    const location = msg.location();
    let source = pageType.toUpperCase();
    if (location && location.url) {
      const filename = location.url.replace(/^.*\//, '').split('?')[0];
      if (filename) {
        source = filename.replace('.js', '');
      }
    }

    // Log with special formatting for agent-related messages
    if (
      text.includes('Agent') ||
      text.includes('Cerebras') ||
      text.includes('DataStudio') ||
      text.includes('executor') ||
      text.includes('LLM')
    ) {
      log(level, `${COLORS.MAGENTA}${source}${COLORS.RESET}`, text);
    } else {
      log(level, source, text);
    }
  });

  page.on('pageerror', (error) => {
    log('ERROR', `${pageType.toUpperCase()}-ERR`, error.message, {
      stack: error.stack,
    });
  });

  page.on('error', (error) => {
    log('ERROR', `${pageType.toUpperCase()}-CRASH`, error.message);
  });
}

// =============================================================================
// DevTools Interaction
// =============================================================================

async function waitForDevTools(browser, timeout = 30000) {
  log('INFO', 'HARNESS', 'Waiting for DevTools target...');

  const start = Date.now();
  while (Date.now() - start < timeout) {
    const targets = await browser.targets();
    const devToolsTarget = targets.find(
      (t) =>
        t.url().includes('devtools://devtools') ||
        t.url().includes('devtools-frontend')
    );

    if (devToolsTarget) {
      log('INFO', 'HARNESS', 'Found DevTools target', { url: devToolsTarget.url() });
      const page = await devToolsTarget.page();
      if (page) {
        return page;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error('Timeout waiting for DevTools target');
}

async function openAIChatPanel(devToolsPage) {
  log('INFO', 'HARNESS', 'Opening AI Chat panel...');

  // The AI Chat panel is already initialized based on logs, just need to show it
  try {
    await devToolsPage.evaluate(async () => {
      // @ts-expect-error DevTools context
      const UI = globalThis.UI || (await import('./ui/legacy/legacy.js'));
      // Try multiple ways to show the panel
      try {
        await UI.ViewManager.ViewManager.instance().showView('ai-chat');
      } catch (e1) {
        try {
          await UI.ViewManager.ViewManager.instance().showView('ai_chat');
        } catch (e2) {
          // Panel may already be visible
          console.log('[HARNESS] AI Chat panel may already be visible');
        }
      }
    });
  } catch (error) {
    log('DEBUG', 'HARNESS', 'View manager approach failed', { error: error.message });
  }

  log('INFO', 'HARNESS', 'AI Chat panel should be open (initialized based on logs)');
}

async function launchDataStudio(devToolsPage, mainPage) {
  log('INFO', 'HARNESS', 'Launching Data Studio via UI automation...');

  // Step 1: Click the settings menu button (3-dot icon)
  log('INFO', 'HARNESS', 'Step 1: Clicking settings menu button...');
  const menuClicked = await devToolsPage.evaluate(() => {
    // Use the exact selector from codebase analysis
    const btn = document.querySelector('button[title="Settings Menu"]');
    if (btn) {
      btn.click();
      return { success: true, title: btn.getAttribute('title') };
    }

    // Fallback: find by jslog context
    const altBtn = document.querySelector('[jslog*="ai-chat.settings-menu"]');
    if (altBtn) {
      altBtn.click();
      return { success: true, selector: 'jslog' };
    }

    // Debug: list all toolbar buttons
    const buttons = Array.from(document.querySelectorAll('button.toolbar-button, .toolbar-button'));
    return {
      success: false,
      error: 'Settings button not found',
      buttons: buttons.map(b => ({ title: b.getAttribute('title'), class: b.className })),
    };
  });

  if (!menuClicked.success) {
    log('ERROR', 'HARNESS', 'Failed to click settings menu', menuClicked);
    throw new Error(`Settings menu button not found: ${JSON.stringify(menuClicked)}`);
  }
  log('INFO', 'HARNESS', 'Clicked settings menu', menuClicked);
  await new Promise(r => setTimeout(r, 500));

  // Step 2: Wait for and click "Sandbox Apps" in the soft context menu
  log('INFO', 'HARNESS', 'Step 2: Waiting for soft context menu...');

  // Wait and search for the menu - it might be in shadow DOM or main document
  const sandboxClicked = await devToolsPage.evaluate(async () => {
    // Helper to recursively search through shadow DOMs
    function findInShadowDom(root, selector) {
      // Check direct children first
      const direct = root.querySelector(selector);
      if (direct) return direct;

      // Check shadow roots
      const allElements = root.querySelectorAll('*');
      for (const el of allElements) {
        if (el.shadowRoot) {
          const found = findInShadowDom(el.shadowRoot, selector);
          if (found) return found;
        }
      }
      return null;
    }

    // Helper to find element by text content
    function findByText(root, text) {
      const walk = (node) => {
        // Check text content
        if (node.textContent?.trim() === text && node.childElementCount === 0) {
          return node;
        }
        // Check children
        for (const child of node.children || []) {
          const found = walk(child);
          if (found) return found;
        }
        // Check shadow root
        if (node.shadowRoot) {
          const found = walk(node.shadowRoot);
          if (found) return found;
        }
        return null;
      };
      return walk(root);
    }

    // Poll for menu appearance
    for (let i = 0; i < 30; i++) {
      // Try direct query
      let menu = document.querySelector('.soft-context-menu');

      // Try shadow DOM search
      if (!menu) {
        menu = findInShadowDom(document, '.soft-context-menu');
      }

      if (menu) {
        // Found menu! Look for Sandbox Apps item
        const items = menu.querySelectorAll('.soft-context-menu-item');
        for (const item of items) {
          if (item.textContent?.includes('Sandbox Apps')) {
            // SoftContextMenu listens for 'mouseup', not 'click'
            const mouseupEvent = new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window,
            });
            item.dispatchEvent(mouseupEvent);
            return { success: true, text: item.textContent, method: 'menu-item-mouseup' };
          }
        }
      }

      // Also try finding "Sandbox Apps" text anywhere in DOM
      const sandboxElement = findByText(document, 'Sandbox Apps');
      if (sandboxElement) {
        // Find the clickable parent
        let clickTarget = sandboxElement;
        while (clickTarget.parentElement && !clickTarget.classList.contains('soft-context-menu-item')) {
          clickTarget = clickTarget.parentElement;
        }
        // SoftContextMenu listens for 'mouseup', not 'click'
        const mouseupEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        clickTarget.dispatchEvent(mouseupEvent);
        return { success: true, text: 'Sandbox Apps', method: 'text-search-mouseup' };
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // Debug info
    const allMenus = document.querySelectorAll('[class*="menu"]');
    return {
      success: false,
      error: 'Could not find Sandbox Apps menu item',
      foundMenus: Array.from(allMenus).map(m => ({ tag: m.tagName, class: m.className })).slice(0, 10),
    };
  });

  if (!sandboxClicked.success) {
    log('ERROR', 'HARNESS', 'Failed to click Sandbox Apps', sandboxClicked);
    throw new Error(`Sandbox Apps menu item not found: ${JSON.stringify(sandboxClicked)}`);
  }
  log('INFO', 'HARNESS', 'Clicked Sandbox Apps menu item', sandboxClicked);
  await new Promise(r => setTimeout(r, 2000)); // Wait for launcher to open

  // Step 3: Click Data Studio card in the launcher iframe
  // The launcher is rendered in the INSPECTED PAGE (mainPage), not in DevTools
  log('INFO', 'HARNESS', 'Step 3: Clicking Data Studio card in launcher (inspected page)...');
  const dataStudioClicked = await mainPage.evaluate(() => {
    const iframes = document.querySelectorAll('iframe');
    const iframeInfo = [];

    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          iframeInfo.push({ id: iframe.id, accessible: false });
          continue;
        }

        // Use exact selector: data-app-id="data-studio-v2"
        const card = doc.querySelector('[data-app-id="data-studio-v2"]');
        if (card) {
          card.click();
          return { success: true, iframeId: iframe.id };
        }

        // Fallback: find by text
        const cards = doc.querySelectorAll('.app-card');
        for (const c of cards) {
          if (c.textContent?.includes('Data Studio')) {
            c.click();
            return { success: true, iframeId: iframe.id, method: 'text-match' };
          }
        }

        iframeInfo.push({
          id: iframe.id,
          accessible: true,
          cards: cards.length,
          bodyPreview: doc.body?.textContent?.substring(0, 200),
        });
      } catch (e) {
        iframeInfo.push({ id: iframe.id, error: e.message });
      }
    }

    return { success: false, iframes: iframeInfo };
  });

  if (!dataStudioClicked.success) {
    log('ERROR', 'HARNESS', 'Failed to click Data Studio card', dataStudioClicked);
    throw new Error(`Data Studio card not found in launcher. Iframes: ${JSON.stringify(dataStudioClicked.iframes)}`);
  }
  log('INFO', 'HARNESS', 'Clicked Data Studio card', dataStudioClicked);
  await new Promise(r => setTimeout(r, 3000)); // Wait for Data Studio to fully launch

  log('INFO', 'HARNESS', 'Data Studio launched successfully');
  return 'data-studio-v2';
}

// =============================================================================
// Test Scenarios
// =============================================================================

const scenarios = {
  /**
   * Observe mode: Just watch and capture all logs for debugging
   * This is useful when manually interacting with DevTools
   */
  observe: {
    description: 'Observe and capture all logs (no automated actions)',
    async run(devToolsPage, mainPage) {
      log('INFO', 'SCENARIO', 'Running observe scenario - capturing all logs...');
      log('INFO', 'SCENARIO', 'Manually interact with DevTools or wait for timeout');

      // Just wait and observe logs
      const duration = 120000; // 2 minutes
      log('INFO', 'SCENARIO', `Observing for ${duration / 1000} seconds...`);

      await new Promise((r) => setTimeout(r, duration));

      log('INFO', 'SCENARIO', 'Observation complete');
      return { status: 'observed' };
    },
  },

  /**
   * Basic scenario: Create table, add entity, run agent
   * Uses UI-based interactions to avoid module re-registration issues
   */
  basic: {
    description: 'Create table, add entity, run single agent',
    async run(devToolsPage, mainPage) {
      log('INFO', 'SCENARIO', 'Running basic scenario...');

      // The Data Studio should already be launched by launchDataStudio()
      // Now we need to interact with it through the iframe in the inspected page (mainPage)

      // Find the Data Studio iframe in the inspected page
      log('INFO', 'SCENARIO', 'Looking for Data Studio iframe in inspected page...');

      const iframeInfo = await mainPage.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        const info = [];
        for (const iframe of iframes) {
          info.push({
            id: iframe.id,
            src: iframe.src,
            className: iframe.className,
          });
        }
        return info;
      });

      log('DEBUG', 'SCENARIO', 'Found iframes', { iframes: iframeInfo });

      // Try to interact with the Data Studio SPA through the iframe
      // The SPA uses a specific structure we can target

      log('INFO', 'SCENARIO', 'Attempting to create table via UI...');

      // Wait for the SPA to be fully loaded
      await new Promise((r) => setTimeout(r, 2000));

      // Create table by calling window.__sandbox.sendAction() directly
      // This is how the SPA communicates with DevTools - same as clicking UI
      log('INFO', 'SCENARIO', 'Creating table via sandbox action API...');
      const createTableResult = await mainPage.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            const iframeWin = iframe.contentWindow;
            if (!iframeWin?.__sandbox?.sendAction) continue;

            // Send create-table action
            iframeWin.__sandbox.sendAction({
              type: 'create-table',
              tableName: 'Test Table',
              entityType: 'Company',
              entityNameLabel: 'Company Name',
            });

            return { success: true, method: 'sandbox-action' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        return { success: false, reason: 'no sandbox sendAction found' };
      });

      log('INFO', 'SCENARIO', 'Create table attempt', createTableResult);

      if (createTableResult.success) {
        // Wait for table to be created
        await new Promise((r) => setTimeout(r, 1000));

        // Add an entity
        log('INFO', 'SCENARIO', 'Adding entity via sandbox action API...');
        const addEntityResult = await mainPage.evaluate(() => {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              const iframeWin = iframe.contentWindow;
              if (!iframeWin?.__sandbox?.sendAction) continue;

              iframeWin.__sandbox.sendAction({
                type: 'add-entity',
                name: 'Acme Corporation',
                context: 'A leading technology company',
              });

              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }
          return { success: false, reason: 'no sandbox sendAction found' };
        });
        log('INFO', 'SCENARIO', 'Add entity result', addEntityResult);

        // Wait for entity to be added
        await new Promise((r) => setTimeout(r, 1000));

        // Add an agent group
        log('INFO', 'SCENARIO', 'Adding agent group via sandbox action API...');
        const addAgentResult = await mainPage.evaluate(() => {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              const iframeWin = iframe.contentWindow;
              if (!iframeWin?.__sandbox?.sendAction) continue;

              iframeWin.__sandbox.sendAction({
                type: 'add-agent-group',
                agentName: 'search_agent',
                queryTemplate: 'Research {entity} and provide key information',
                outputColumns: [
                  { key: 'summary', label: 'Summary' },
                  { key: 'industry', label: 'Industry' },
                ],
              });

              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }
          return { success: false, reason: 'no sandbox sendAction found' };
        });
        log('INFO', 'SCENARIO', 'Add agent group result', addAgentResult);

        // Wait for agent group to be added
        await new Promise((r) => setTimeout(r, 1000));

        // Run agent for the entity
        log('INFO', 'SCENARIO', 'Running agent via sandbox action API...');
        const runAgentResult = await mainPage.evaluate(() => {
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              const iframeWin = iframe.contentWindow;
              if (!iframeWin?.__sandbox?.sendAction) continue;

              // Run-all will run agents for all entities
              iframeWin.__sandbox.sendAction({
                type: 'run-all',
              });

              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }
          return { success: false, reason: 'no sandbox sendAction found' };
        });
        log('INFO', 'SCENARIO', 'Run agent result', runAgentResult);
      }

      // Wait for agent execution to complete and Data Studio to re-render
      // Poll until we see a table in the iframe or timeout after 60 seconds
      log('INFO', 'SCENARIO', 'Waiting for agent execution and re-render (max 60 seconds)...');
      const maxWaitMs = 60000;
      const pollIntervalMs = 2000;
      const startTime = Date.now();

      let finalState = [];
      let foundTable = false;

      while (Date.now() - startTime < maxWaitMs && !foundTable) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));

        try {
          finalState = await mainPage.evaluate(() => {
            const iframes = document.querySelectorAll('iframe');
            const states = [];
            for (const iframe of iframes) {
              try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc) continue;

                // Check for any visible tables or data
                const tables = doc.querySelectorAll('table, .table, [role="grid"]');
                const rows = doc.querySelectorAll('tr, .row, [role="row"]');

                states.push({
                  iframeId: iframe.id,
                  tables: tables.length,
                  rows: rows.length,
                  bodyText: doc.body?.textContent?.substring(0, 500),
                });
              } catch {
                // Cross-origin
              }
            }
            return states;
          });

          // Check if we found a table with rows
          foundTable = finalState.some((s) => s.tables > 0 || s.rows > 0);
          if (!foundTable) {
            log('INFO', 'SCENARIO', `Still waiting... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
          }
        } catch (evalError) {
          // Page may have navigated during agent execution - continue waiting
          log('INFO', 'SCENARIO', `Page navigating, continuing to wait... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
        }
      }

      if (!foundTable) {
        log('INFO', 'SCENARIO', 'Timeout - no table found, capturing final state anyway');
      }

      log('INFO', 'SCENARIO', 'Final state', { states: finalState, foundTable });

      log('INFO', 'SCENARIO', 'Basic scenario complete (UI-based)');
      return { status: 'completed', finalState };
    },
  },
};

// =============================================================================
// Main
// =============================================================================

async function main() {
  const opts = parseArgs();
  config = opts;

  if (opts.help) {
    console.log(`
Data Studio DevTools Agent Test Harness

Usage:
  node data-studio-harness.mjs [options]

Options:
  --headed           Show browser window
  --verbose          Show all console logs (including debug)
  --filter=PATTERN   Filter logs by regex pattern
  --timeout=MS       Timeout in milliseconds (default: 90000)
  --scenario=NAME    Scenario to run (default: basic)
  --help, -h         Show this help

Available Scenarios:
  observe            Just observe and capture logs (for manual testing)
  basic              Create table, add entity, run single agent (UI-based)

Environment Variables:
  CHROME_PATH        Path to Chrome/Chromium binary
  CEREBRAS_API_KEY   API key for Cerebras provider (set in DevTools settings)
`);
    process.exit(0);
  }

  console.log(`
${COLORS.BRIGHT}╔════════════════════════════════════════════════════════════════╗
║          Data Studio DevTools Agent Test Harness               ║
╚════════════════════════════════════════════════════════════════╝${COLORS.RESET}
`);

  log('INFO', 'HARNESS', 'Starting harness', {
    headed: opts.headed,
    verbose: opts.verbose,
    filter: opts.filter,
    scenario: opts.scenario,
    timeout: opts.timeout,
  });

  const scenario = scenarios[opts.scenario];
  if (!scenario) {
    log('ERROR', 'HARNESS', `Unknown scenario: ${opts.scenario}`);
    log('INFO', 'HARNESS', `Available: ${Object.keys(scenarios).join(', ')}`);
    process.exit(1);
  }

  let browser;
  try {
    browser = await launchBrowser(opts);

    // Get the initial page (about:blank)
    const pages = await browser.pages();
    const mainPage = pages[0] || (await browser.newPage());
    installConsoleCapture(mainPage, 'page');

    // Navigate to test page
    log('INFO', 'HARNESS', 'Navigating to test page...');
    await mainPage.goto('about:blank');

    // Wait for DevTools to open
    const devToolsPage = await waitForDevTools(browser, opts.timeout);
    installConsoleCapture(devToolsPage, 'devtools');

    // Wait for DevTools to load
    await new Promise((r) => setTimeout(r, 3000));

    // Configure LLM settings from environment variables (loaded from .env)
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const llmConfig = {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      mainModel: model,
      miniModel: model,
      nanoModel: model,
    };

    if (llmConfig.apiKey) {
      await configureLLMSettings(devToolsPage, llmConfig);

      // Reload DevTools to pick up new credentials
      log('INFO', 'HARNESS', 'Reloading DevTools to apply credentials...');
      await devToolsPage.reload({ waitUntil: 'domcontentloaded' });
      await new Promise((r) => setTimeout(r, 3000));
    } else {
      log('WARN', 'HARNESS', 'No OPENAI_API_KEY environment variable set - agent execution may fail');
    }

    // Open AI Chat panel
    try {
      await openAIChatPanel(devToolsPage);
    } catch (error) {
      log('WARN', 'HARNESS', 'Could not open AI Chat panel via ViewManager', {
        error: error.message,
      });
    }

    // Launch Data Studio (pass both DevTools and inspected page)
    await launchDataStudio(devToolsPage, mainPage);

    // Wait for Data Studio to initialize
    await new Promise((r) => setTimeout(r, 2000));

    // Run scenario
    log('INFO', 'HARNESS', `Running scenario: ${opts.scenario}`, {
      description: scenario.description,
    });

    const scenarioStart = Date.now();
    try {
      const result = await scenario.run(devToolsPage, mainPage);
      const duration = Date.now() - scenarioStart;
      log('INFO', 'HARNESS', `Scenario "${opts.scenario}" completed`, {
        durationMs: duration,
        result,
      });
    } catch (error) {
      const duration = Date.now() - scenarioStart;
      log('ERROR', 'HARNESS', `Scenario "${opts.scenario}" failed`, {
        durationMs: duration,
        error: error.message,
        stack: error.stack,
      });

      // Take screenshot
      try {
        const screenshotPath = path.join(
          __dirname,
          `failure-${opts.scenario}-${Date.now()}.png`
        );
        await devToolsPage.screenshot({ path: screenshotPath, fullPage: true });
        log('INFO', 'HARNESS', `Screenshot saved: ${screenshotPath}`);
      } catch {
        // Ignore
      }

      if (!opts.headed) {
        process.exit(1);
      }
    }

    // Keep browser open in headed mode
    if (opts.headed) {
      log('INFO', 'HARNESS', 'Browser left open for inspection. Press Ctrl+C to exit.');
      await new Promise(() => {}); // Wait forever
    }
  } catch (error) {
    log('ERROR', 'HARNESS', 'Fatal error', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
    if (browser && !opts.headed) {
      await browser.close();
    }
  }

  log('INFO', 'HARNESS', 'Harness complete');
  process.exit(0);
}

main();
