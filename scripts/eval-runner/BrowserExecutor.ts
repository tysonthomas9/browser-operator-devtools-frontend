/**
 * Browser Executor - Puppeteer/CDP Browser Automation
 *
 * Handles browser lifecycle, page navigation, and CDP session management.
 * Provides a clean abstraction for test execution.
 *
 * Uses DirectCDPAdapter to provide compatibility with shared DevTools utilities.
 */

import puppeteer, { type Browser, type Page, type CDPSession } from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DirectCDPAdapter, type CDPClient } from '../../front_end/panels/ai_chat/cdp/DirectCDPAdapter.ts';
import type { CDPSessionAdapter } from '../../front_end/panels/ai_chat/cdp/CDPSessionAdapter.ts';

// Import shadow piercer runtime from shared module (single source of truth)
import { SHADOW_PIERCER_RUNTIME } from '../../front_end/panels/ai_chat/dom/shadow-piercer-runtime.ts';

export interface BrowserConfig {
  chromePath?: string;
  headless: boolean;
  timeout: number;
  screenshotDir: string;
  /** Connect to existing browser on this port instead of launching */
  remoteDebuggingPort?: number;
}

export interface ExecutionContext {
  browser: Browser;
  page: Page;
  cdp: CDPSession;
  /** CDP adapter compatible with shared DevTools utilities */
  adapter: CDPSessionAdapter;
  screenshotDir: string;
  /** Captured console errors from the page */
  consoleErrors: string[];
}

/**
 * Detect Chrome/Chromium installation path
 */
function detectChromePath(): string {
  const platform = os.platform();

  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    );
  } else if (platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
  } else if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find Chrome. Please set CHROME_PATH environment variable or install Chrome.\n` +
    `Searched: ${candidates.join(', ')}`
  );
}

/**
 * BrowserExecutor manages browser lifecycle and provides execution contexts
 */
export class BrowserExecutor {
  private config: BrowserConfig;
  private browser: Browser | null = null;
  private isConnected: boolean = false; // True if connected to existing browser

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = {
      chromePath: config.chromePath || process.env.CHROME_PATH,
      headless: config.headless ?? true,
      timeout: config.timeout || 60000,
      screenshotDir: config.screenshotDir || './eval-screenshots',
      remoteDebuggingPort: config.remoteDebuggingPort,
    };
  }

  /**
   * Launch the browser or connect to existing instance
   */
  async launch(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    // Ensure screenshot directory exists
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }

    // Connect to existing browser if port specified
    if (this.config.remoteDebuggingPort) {
      const browserURL = `http://127.0.0.1:${this.config.remoteDebuggingPort}`;
      console.log(`🔗 Connecting to existing browser: ${browserURL}`);

      this.browser = await puppeteer.connect({
        browserURL,
        defaultViewport: null, // Use browser's viewport
      });

      this.isConnected = true;
      console.log(`   ✅ Connected to browser`);
      return this.browser;
    }

    // Launch new browser
    const chromePath = this.config.chromePath || detectChromePath();
    console.log(`🌐 Launching browser: ${chromePath}`);
    console.log(`   Headless: ${this.config.headless}`);

    this.browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

    return this.browser;
  }

  /**
   * Create an execution context for a test
   */
  async createContext(): Promise<ExecutionContext> {
    const browser = await this.launch();
    const page = await browser.newPage();

    // Set default timeout
    page.setDefaultTimeout(this.config.timeout);
    page.setDefaultNavigationTimeout(this.config.timeout);

    // Create CDP session
    const cdp = await page.createCDPSession();

    // Enable required CDP domains
    await cdp.send('DOM.enable');
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Accessibility.enable');
    // Note: Input domain doesn't need enabling

    // Inject shadow piercer runtime for shadow DOM traversal support
    // This patches Element.attachShadow to capture closed shadow roots
    // and provides __browserOperator__.resolveSimpleXPath for composed tree XPath
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: SHADOW_PIERCER_RUNTIME,
    });

    // Create adapter for shared DevTools utilities
    // Puppeteer CDPSession implements the CDPClient interface (has send method)
    const adapter = new DirectCDPAdapter(cdp as unknown as CDPClient, page.url());

    // Capture console errors for debugging
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.error] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(`[pageerror] ${err.message}`);
    });

    return {
      browser,
      page,
      cdp,
      adapter,
      screenshotDir: this.config.screenshotDir,
      consoleErrors,
    };
  }

  /**
   * Navigate to a URL and wait for it to load
   */
  async navigateTo(page: Page, url: string): Promise<void> {
    console.log(`   📍 Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: this.config.timeout,
    });

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Navigate to a URL and return an updated adapter
   */
  async navigateToWithAdapter(context: ExecutionContext, url: string): Promise<CDPSessionAdapter> {
    await this.navigateTo(context.page, url);
    // Return a new adapter with the updated URL
    return new DirectCDPAdapter(context.cdp as unknown as CDPClient, url);
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(
    page: Page,
    testId: string,
    suffix: string = ''
  ): Promise<string> {
    const filename = `${testId}${suffix ? `-${suffix}` : ''}-${Date.now()}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);

    await page.screenshot({
      path: filepath,
      fullPage: false,
    });

    return filepath;
  }

  /**
   * Get accessibility tree from page
   */
  async getAccessibilityTree(cdp: CDPSession): Promise<any> {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes;
  }

  /**
   * Get DOM document
   */
  async getDocument(cdp: CDPSession): Promise<any> {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    return root;
  }

  /**
   * Get a complete DOM snapshot including accessibility tree
   * Useful for debugging failed tests
   */
  async getDOMSnapshot(cdp: CDPSession, page: Page): Promise<{
    url: string;
    dom: any;
    accessibility: any;
  }> {
    const [dom, accessibility] = await Promise.all([
      cdp.send('DOM.getDocument', { depth: -1 }),
      cdp.send('Accessibility.getFullAXTree'),
    ]);

    return {
      url: page.url(),
      dom: dom.root,
      accessibility: accessibility.nodes,
    };
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate<T>(page: Page, fn: () => T): Promise<T> {
    return page.evaluate(fn);
  }

  /**
   * Perform a click action at coordinates
   */
  async click(cdp: CDPSession, x: number, y: number): Promise<void> {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  }

  /**
   * Perform a drag action
   */
  async drag(
    cdp: CDPSession,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps: number = 10
  ): Promise<void> {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y: startY,
      button: 'left',
      clickCount: 1,
    });

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: startX + (endX - startX) * progress,
        y: startY + (endY - startY) * progress,
        button: 'left',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: endX,
      y: endY,
      button: 'left',
      clickCount: 1,
    });
  }

  /**
   * Type text
   */
  async type(cdp: CDPSession, text: string): Promise<void> {
    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
      });
    }
  }

  /**
   * Close a page context
   */
  async closeContext(context: ExecutionContext): Promise<void> {
    try {
      await context.cdp.detach();
      await context.page.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Close the browser (or disconnect if connected to existing)
   */
  async close(): Promise<void> {
    if (this.browser) {
      if (this.isConnected) {
        // Just disconnect, don't close the external browser
        await this.browser.disconnect();
        console.log('   🔌 Disconnected from browser');
      } else {
        await this.browser.close();
      }
      this.browser = null;
    }
  }
}
