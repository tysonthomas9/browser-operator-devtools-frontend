// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * JavaScript code to inject into the page that provides helper functions for skills.
 * These helpers are available as `helpers` object within skill code.
 */
export const CDP_HELPER_LIBRARY = `
(function() {
  'use strict';

  const DEFAULT_TIMEOUT = 10000;

  /**
   * Wait for an element to appear in the DOM
   */
  async function waitForElement(selector, timeout = DEFAULT_TIMEOUT) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(\`Element not found: \${selector} (timeout: \${timeout}ms)\`);
  }

  /**
   * Wait for an element to be visible (not just in DOM)
   */
  async function waitForVisible(selector, timeout = DEFAULT_TIMEOUT) {
    const element = await waitForElement(selector, timeout);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      if (rect.width > 0 && rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          parseFloat(style.opacity) > 0) {
        return element;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(\`Element not visible: \${selector} (timeout: \${timeout}ms)\`);
  }

  /**
   * Click on an element
   */
  async function click(selector, options = {}) {
    const element = await waitForVisible(selector, options.timeout);

    // Scroll into view if needed
    element.scrollIntoView({ behavior: 'instant', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate mouse events
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const mouseEvents = ['mousedown', 'mouseup', 'click'];
    for (const eventType of mouseEvents) {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      });
      element.dispatchEvent(event);
    }
  }

  /**
   * Type text into an input element
   */
  async function type(selector, text, options = {}) {
    const element = await waitForVisible(selector, options.timeout);

    // Focus the element
    element.focus();

    // Clear existing value if requested
    if (options.clear) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Type each character
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));

      if (options.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Select an option from a dropdown
   */
  async function select(selector, value, options = {}) {
    const element = await waitForVisible(selector, options.timeout);

    if (element.tagName !== 'SELECT') {
      throw new Error(\`Element is not a select: \${selector}\`);
    }

    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Get text content of an element
   */
  async function getText(selector, options = {}) {
    const element = await waitForElement(selector, options.timeout);
    return element.textContent?.trim() || '';
  }

  /**
   * Get attribute value of an element
   */
  async function getAttribute(selector, attr, options = {}) {
    const element = await waitForElement(selector, options.timeout);
    return element.getAttribute(attr);
  }

  /**
   * Query selector (immediate, no waiting)
   */
  function querySelector(selector) {
    return document.querySelector(selector);
  }

  /**
   * Query selector all (immediate, no waiting)
   */
  function querySelectorAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Evaluate XPath expression
   */
  function evaluateXPath(xpath) {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    const elements = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      elements.push(result.snapshotItem(i));
    }
    return elements;
  }

  /**
   * Get table data as array of objects
   */
  async function getTableData(selector, options = {}) {
    const table = await waitForElement(selector, options.timeout);
    const rows = table.querySelectorAll('tr');
    const data = [];

    // Get headers
    const headerRow = rows[0];
    const headers = Array.from(headerRow?.querySelectorAll('th, td') || [])
      .map(cell => cell.textContent?.trim() || '');

    // Get data rows
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      const row = {};

      cells.forEach((cell, index) => {
        const header = headers[index] || \`column_\${index}\`;
        row[header] = cell.textContent?.trim() || '';
      });

      data.push(row);
    }

    return data;
  }

  /**
   * Get form data as object
   */
  async function getFormData(selector, options = {}) {
    const form = await waitForElement(selector, options.timeout);
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    return data;
  }

  /**
   * Assert an element is visible
   */
  async function assertVisible(selector, options = {}) {
    await waitForVisible(selector, options.timeout);
  }

  /**
   * Assert element has expected text
   */
  async function assertText(selector, expected, options = {}) {
    const actual = await getText(selector, options);

    if (!actual.includes(expected)) {
      throw new Error(\`Text assertion failed: expected "\${expected}" but got "\${actual}"\`);
    }
  }

  /**
   * Wait for page to be idle (no pending network requests)
   */
  async function waitForNetworkIdle(timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      let timer;
      const startTime = Date.now();

      const checkIdle = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(\`Network not idle after \${timeout}ms\`));
        } else {
          timer = setTimeout(checkIdle, 100);
        }
      };

      // Simple heuristic - check if document is complete
      if (document.readyState === 'complete') {
        setTimeout(resolve, 500); // Small delay for any async operations
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 500), { once: true });
      }

      timer = setTimeout(checkIdle, 100);
    });
  }

  // Export helpers to window
  window.__skillHelpers = {
    waitForElement,
    waitForVisible,
    waitForNetworkIdle,
    click,
    type,
    select,
    getText,
    getAttribute,
    querySelector,
    querySelectorAll,
    evaluateXPath,
    getTableData,
    getFormData,
    assertVisible,
    assertText,
  };
})();
`;

/**
 * Check if helpers are already injected
 */
export const CHECK_HELPERS_INJECTED = `typeof window.__skillHelpers !== 'undefined'`;

/**
 * Get the helpers object for use in skill code
 */
export const GET_HELPERS = `window.__skillHelpers`;
