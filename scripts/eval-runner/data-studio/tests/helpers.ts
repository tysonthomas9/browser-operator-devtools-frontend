// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Test helpers for Data Studio E2E tests using Puppeteer.
 */

import type {Page} from 'puppeteer-core';

// Types matching the Data Studio store
export interface DataTable {
  id: string;
  name: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
}

export interface Entity {
  id: string;
  name: string;
  context?: string;
}

export interface AgentGroup {
  id: string;
  agentName: string;
  queryTemplate: string;
  outputColumns: OutputColumn[];
}

export interface OutputColumn {
  id: string;
  key: string;
  label: string;
}

export interface CellResult {
  status: 'pending' | 'running' | 'completed' | 'error';
  values?: Record<string, string>;
  error?: string;
}

export interface DataStudioState {
  view: 'selector' | 'table';
  tables: Array<{id: string; name: string; entityType: string}>;
  currentTable: DataTable | null;
  availableAgents: Array<{name: string; description: string}>;
  isRunning: boolean;
}

/**
 * Wait for WebSocket to connect (status indicator turns green).
 */
export async function waitForConnected(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('#ws-status')?.classList.contains('connected'),
    {timeout},
  );
}

/**
 * Get the current Zustand store state.
 */
export async function getState(page: Page): Promise<DataStudioState | undefined> {
  return page.evaluate(() => {
    const store = (window as any).__DATA_STUDIO_STORE__;
    // Zustand store has getState() method
    if (store && typeof store.getState === 'function') {
      return store.getState();
    }
    return undefined;
  });
}

/**
 * Wait for selector view to be visible.
 */
export async function waitForSelectorView(page: Page, timeout = 10000): Promise<void> {
  // Wait for either "Start from Template" OR any template cards to appear
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        text.includes('Start from Template') ||
        text.includes('Competitor Analysis') ||
        text.includes('Product Research') ||
        text.includes('Create Custom Table')
      );
    },
    {timeout},
  );
}

/**
 * Wait for table view to be visible.
 */
export async function waitForTableView(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.includes('Back'));
    },
    {timeout},
  );
}

/**
 * Wait for text to appear on page.
 */
export async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    (searchText: string) => document.body.innerText.includes(searchText),
    {timeout},
    text,
  );
}

/**
 * Click a button by its visible text.
 */
export async function clickButton(page: Page, text: string): Promise<void> {
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

/**
 * Click a button by exact text match.
 */
export async function clickButtonExact(page: Page, text: string): Promise<void> {
  await page.evaluate((buttonText: string) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(b => b.textContent?.trim() === buttonText);
    if (button) {
      (button as HTMLButtonElement).click();
    } else {
      throw new Error(`Button with exact text "${buttonText}" not found`);
    }
  }, text);
}

/**
 * Type in an input by placeholder text.
 */
export async function typeInInput(page: Page, placeholder: string, value: string): Promise<void> {
  const selector = `input[placeholder*="${placeholder}"]`;
  await page.waitForSelector(selector, {timeout: 5000});
  const input = await page.$(selector);
  if (!input) {
    throw new Error(`Input with placeholder "${placeholder}" not found`);
  }
  await input.click({clickCount: 3}); // Select all existing text
  await input.type(value);
}

/**
 * Type in a textarea by placeholder text.
 */
export async function typeInTextarea(page: Page, placeholder: string, value: string): Promise<void> {
  const selector = `textarea[placeholder*="${placeholder}"]`;
  await page.waitForSelector(selector, {timeout: 5000});
  const textarea = await page.$(selector);
  if (!textarea) {
    throw new Error(`Textarea with placeholder "${placeholder}" not found`);
  }
  await textarea.click({clickCount: 3}); // Select all existing text
  await textarea.type(value);
}

/**
 * Select an option from a dropdown by text.
 */
export async function selectOption(page: Page, optionText: string): Promise<void> {
  await page.evaluate((text: string) => {
    const select = document.querySelector('select');
    if (select) {
      const options = Array.from(select.options);
      const option = options.find(o => o.text.includes(text) || o.value.includes(text));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', {bubbles: true}));
      } else {
        throw new Error(`Option with text "${text}" not found`);
      }
    } else {
      throw new Error('No select element found');
    }
  }, optionText);
}

/**
 * Create a new table via the Create Custom Table modal.
 */
export async function createTable(
  page: Page,
  name: string,
  entityType: string,
  entityLabel: string,
): Promise<void> {
  await clickButton(page, 'Create Custom');
  await page.waitForSelector('input', {timeout: 5000});

  // Fill in the three inputs in order
  const inputs = await page.$$('input');
  if (inputs.length >= 3) {
    await inputs[0].click({clickCount: 3});
    await inputs[0].type(name);
    await inputs[1].click({clickCount: 3});
    await inputs[1].type(entityType);
    await inputs[2].click({clickCount: 3});
    await inputs[2].type(entityLabel);
  }

  await clickButton(page, 'Create Table');
  await waitForTableView(page);
}

/**
 * Add an entity to the current table.
 */
export async function addEntity(page: Page, name: string, context?: string): Promise<void> {
  // Find and click the Add button (labeled with entityType)
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.textContent?.includes('Add ') && !b.textContent?.includes('Add Agent'));
    if (addBtn) {
      (addBtn as HTMLButtonElement).click();
    } else {
      throw new Error('Add entity button not found');
    }
  });

  await page.waitForSelector('input', {timeout: 5000});

  // Fill in entity name (first input)
  const nameInput = await page.$('input');
  if (nameInput) {
    await nameInput.click({clickCount: 3});
    await nameInput.type(name);
  }

  // Fill context if provided (it's a textarea, not input)
  if (context) {
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.click({clickCount: 3});
      await textarea.type(context);
    }
  }

  // Submit - button text is dynamic based on entityType
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const createBtn = buttons.find(b => b.textContent?.includes('Create ') && b.type === 'submit');
    if (createBtn) {
      (createBtn as HTMLButtonElement).click();
    }
  });

  // Wait for entity to appear
  await waitForText(page, name);
}

/**
 * Remove an entity from the current table.
 */
export async function removeEntity(page: Page, entityName: string): Promise<void> {
  await page.evaluate((name: string) => {
    // Find the row containing the entity name
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    const row = rows.find(r => {
      const firstCell = r.querySelector('td');
      return firstCell?.textContent?.includes(name);
    });
    if (row) {
      // Find all buttons in the first cell (entity cell)
      const firstCell = row.querySelector('td');
      const buttons = firstCell?.querySelectorAll('button');
      // The second button is the remove button (first is Run)
      if (buttons && buttons.length >= 2) {
        (buttons[1] as HTMLButtonElement).click();
      } else {
        throw new Error(`Remove button not found for entity "${name}"`);
      }
    } else {
      throw new Error(`Entity "${name}" not found`);
    }
  }, entityName);
}

/**
 * Add an agent group to the current table.
 */
export async function addAgentGroup(
  page: Page,
  agentName: string,
  queryTemplate: string,
  outputColumns: Array<{key: string; label: string}>,
): Promise<void> {
  await clickButton(page, 'Add Agent');
  await page.waitForSelector('select', {timeout: 5000});

  // Select agent from dropdown
  await selectOption(page, agentName);

  // Fill query template
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.click({clickCount: 3});
    await textarea.type(queryTemplate);
  }

  // Fill output columns
  const keyInputs = await page.$$('input[placeholder*="Key"]');
  const labelInputs = await page.$$('input[placeholder*="Label"]');

  for (let i = 0; i < outputColumns.length; i++) {
    if (i > 0) {
      await clickButton(page, 'Add Column');
      // Re-query after adding column
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const currentKeyInputs = await page.$$('input[placeholder*="Key"]');
    const currentLabelInputs = await page.$$('input[placeholder*="Label"]');

    if (currentKeyInputs[i]) {
      await currentKeyInputs[i].click({clickCount: 3});
      await currentKeyInputs[i].type(outputColumns[i].key);
    }
    if (currentLabelInputs[i]) {
      await currentLabelInputs[i].click({clickCount: 3});
      await currentLabelInputs[i].type(outputColumns[i].label);
    }
  }

  await clickButton(page, 'Add Agent Column');

  // Wait for agent column to appear
  await waitForText(page, agentName);
}

/**
 * Remove an agent group from the table.
 */
export async function removeAgentGroup(page: Page, agentName: string): Promise<void> {
  await page.evaluate((name: string) => {
    // Find the header cell with the agent name
    const headers = Array.from(document.querySelectorAll('th'));
    const header = headers.find(h => h.textContent?.includes(name));
    if (header) {
      // The remove button is the second button (with title="Remove agent")
      const removeBtn = header.querySelector('button[title="Remove agent"]');
      if (removeBtn) {
        (removeBtn as HTMLButtonElement).click();
      } else {
        // Fallback: get all buttons and use the second one
        const buttons = header.querySelectorAll('button');
        if (buttons.length >= 2) {
          (buttons[1] as HTMLButtonElement).click();
        } else {
          throw new Error(`Remove button not found for agent "${name}"`);
        }
      }
    } else {
      throw new Error(`Agent group "${name}" not found`);
    }
  }, agentName);
}

/**
 * Click on a cell to run it or view details.
 */
export async function clickCell(page: Page, entityName: string, columnIndex = 1): Promise<void> {
  await page.evaluate(
    ({name, colIdx}) => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const row = rows.find(r => r.textContent?.includes(name));
      if (row) {
        const cells = row.querySelectorAll('td');
        if (cells[colIdx]) {
          (cells[colIdx] as HTMLElement).click();
        }
      }
    },
    {name: entityName, colIdx: columnIndex},
  );
}

/**
 * Run all cells in the table.
 */
export async function runAll(page: Page): Promise<void> {
  await clickButton(page, 'Run All');
}

/**
 * Navigate back to selector view.
 */
export async function goBack(page: Page): Promise<void> {
  await clickButton(page, 'Back');
  await waitForSelectorView(page);
}

/**
 * Wait for any pending operations to complete (debounce).
 */
export async function settle(_page: Page, ms = 500): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load a saved table from the selector view.
 */
export async function loadTable(page: Page, tableName: string): Promise<void> {
  await page.evaluate((name: string) => {
    const cards = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));
    const card = cards.find(c => c.textContent?.includes(name));
    if (card) {
      const openBtn = card.querySelector('button');
      if (openBtn && openBtn.textContent?.includes('Open')) {
        openBtn.click();
      } else {
        // Click the card itself if no Open button
        (card as HTMLElement).click();
      }
    } else {
      throw new Error(`Table "${name}" not found`);
    }
  }, tableName);
  await waitForTableView(page);
}

/**
 * Delete a saved table from the selector view.
 */
export async function deleteTable(page: Page, tableName: string): Promise<void> {
  await page.evaluate((name: string) => {
    const cards = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));
    const card = cards.find(c => c.textContent?.includes(name));
    if (card) {
      const deleteBtn = Array.from(card.querySelectorAll('button')).find(
        b => b.textContent?.toLowerCase().includes('delete') || b.querySelector('svg'),
      );
      if (deleteBtn) {
        (deleteBtn as HTMLButtonElement).click();
      }
    }
  }, tableName);
}

/**
 * Use a template to create a table.
 */
export async function useTemplate(page: Page, templateName: string): Promise<void> {
  // Wait for "Start from Template" section to appear
  await page.waitForFunction(
    () => document.body.innerText.includes('Start from Template'),
    {timeout: 10000},
  );

  // Extra wait to ensure React has hydrated click handlers
  await new Promise(resolve => setTimeout(resolve, 500));

  // Click the template card - MUST be in the templates section, not saved tables
  const clicked = await page.evaluate((name: string) => {
    // Find the "Start from Template" section heading
    const headings = Array.from(document.querySelectorAll('h2'));
    const templateHeading = headings.find(h => h.textContent?.includes('Start from Template'));

    if (templateHeading) {
      // Get the parent section and find cards within it
      const section = templateHeading.closest('section');
      if (section) {
        const cards = Array.from(section.querySelectorAll('[class*="cursor-pointer"]'));
        const card = cards.find(c => c.textContent?.includes(name));
        if (card) {
          (card as HTMLElement).click();
          return true;
        }
      }
    }

    // Fallback: find by exact template name match (without date suffix)
    const allCards = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));
    const exactCard = allCards.find(c => {
      const text = c.textContent || '';
      // Template cards have exact name, saved tables have "Name - date"
      return text.includes(name) && !text.includes(' - ');
    });
    if (exactCard) {
      (exactCard as HTMLElement).click();
      return true;
    }

    return false;
  }, templateName);

  if (!clicked) {
    throw new Error(`Template "${templateName}" not found`);
  }

  // Wait for table view with longer timeout
  await waitForTableView(page, 15000);
}

/**
 * Check if we're on the selector view.
 */
export async function isOnSelectorView(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.innerText.includes('Start from Template'));
}

/**
 * Check if we're on the table view.
 */
export async function isOnTableView(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent?.includes('Back'));
  });
}

/**
 * Check if modal is open.
 */
export async function isModalOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.querySelector('[class*="fixed"][class*="inset-0"]') !== null;
  });
}

/**
 * Close any open modal by clicking outside or pressing escape.
 */
export async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * Check for validation error message.
 */
export async function hasValidationError(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const errorEl = document.querySelector('[data-testid*="error"], [class*="text-red"]');
    return errorEl !== null && errorEl.textContent !== '';
  });
}

/**
 * Get validation error message text.
 */
export async function getValidationError(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const errorEl = document.querySelector('[data-testid*="error"], [class*="text-red"]');
    return errorEl?.textContent || null;
  });
}

/**
 * Add an inline agent group to the current table.
 */
export async function addInlineAgentGroup(
  page: Page,
  config: {
    name: string;
    displayName: string;
    systemPrompt: string;
    tools?: string[];
    provider?: string;
    model?: string;
  },
  queryTemplate: string,
  outputColumns: Array<{key: string; label: string}>,
): Promise<void> {
  // Click "Add Agent" button to open modal
  await clickButton(page, 'Add Agent');
  // Wait for modal to appear (it shows a select element by default)
  await page.waitForSelector('select', {timeout: 5000});
  await settle(page, 200);

  // Click "Create Inline Agent" tab button
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const inlineTab = Array.from(buttons).find(b =>
      b.textContent?.trim() === 'Create Inline Agent',
    );
    if (inlineTab) {
      (inlineTab as HTMLElement).click();
    } else {
      throw new Error('Create Inline Agent tab not found');
    }
  });
  await settle(page, 300);

  // Fill in Name field (first input with placeholder like "e.g., summary_agent")
  const nameInput = await page.$('input[placeholder*="summary_agent"], input[placeholder*="e.g.,"]');
  if (nameInput) {
    await nameInput.click({clickCount: 3});
    await nameInput.type(config.name);
  } else {
    // Fallback: use first input in the form
    const inputs = await page.$$('input');
    if (inputs[0]) {
      await inputs[0].click({clickCount: 3});
      await inputs[0].type(config.name);
    }
  }

  // Fill in Display Name field (second input with placeholder like "Quick Summary")
  const displayNameInput = await page.$('input[placeholder*="Quick Summary"], input[placeholder*="Display"]');
  if (displayNameInput) {
    await displayNameInput.click({clickCount: 3});
    await displayNameInput.type(config.displayName);
  } else {
    // Fallback: use second input in the form
    const inputs = await page.$$('input');
    if (inputs[1]) {
      await inputs[1].click({clickCount: 3});
      await inputs[1].type(config.displayName);
    }
  }

  // Fill in System Prompt textarea (first textarea with placeholder about "helpful assistant")
  const systemPromptTextarea = await page.$('textarea[placeholder*="helpful assistant"], textarea[placeholder*="You are"]');
  if (systemPromptTextarea) {
    await systemPromptTextarea.click({clickCount: 3});
    await systemPromptTextarea.type(config.systemPrompt);
  } else {
    // Fallback: first textarea
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.click({clickCount: 3});
      await textarea.type(config.systemPrompt);
    }
  }

  // Select provider if specified
  // The provider select is the one that has OpenAI, Cerebras, Anthropic, Groq options
  if (config.provider) {
    // Wait for provider select to be visible (it appears after switching to inline tab)
    await page.waitForFunction(
      () => {
        const selects = document.querySelectorAll('select');
        return Array.from(selects).some(s =>
          Array.from(s.options).some(o => o.value === 'openai'),
        );
      },
      {timeout: 5000},
    );

    const providerSet = await page.evaluate(provider => {
      const selects = document.querySelectorAll('select');
      // Find the provider select (has openai, cerebras, anthropic, groq as values)
      for (const select of selects) {
        const options = Array.from(select.options).map(o => o.value);
        const isProviderSelect =
          options.includes('openai') &&
          options.includes('cerebras') &&
          options.includes('anthropic');
        if (isProviderSelect) {
          const option = Array.from(select.options).find(
            o => o.value.toLowerCase() === provider.toLowerCase(),
          );
          if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', {bubbles: true}));
            return true;
          }
        }
      }
      return false;
    }, config.provider);

    if (!providerSet) {
      throw new Error(`Failed to select provider: ${config.provider}`);
    }
    await settle(page, 300); // Extra wait for model dropdown to update
  }

  // Select model if specified (second select, which shows models for the chosen provider)
  if (config.model) {
    await page.evaluate(model => {
      const selects = document.querySelectorAll('select');
      // Model select is the one after provider - find by looking for model values
      for (const select of selects) {
        const option = Array.from(select.options).find(
          o => o.value === model,
        );
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', {bubbles: true}));
          break;
        }
      }
    }, config.model);
    await settle(page, 200);
  }

  // Scroll down to ensure Query Template and Output Columns are visible
  await page.evaluate(() => {
    const card = document.querySelector('[class*="max-h-"][class*="overflow"]');
    if (card) {
      card.scrollTop = card.scrollHeight;
    }
  });
  await settle(page, 200);

  // Fill Query Template (textarea with placeholder about "Analyze")
  const queryTextarea = await page.$('textarea[placeholder*="Analyze"], textarea[placeholder*="entity"]');
  if (queryTextarea) {
    await queryTextarea.click({clickCount: 3});
    await queryTextarea.type(queryTemplate);
  } else {
    // Fallback: find by looking for multiple textareas and use the second one
    const textareas = await page.$$('textarea');
    if (textareas.length >= 2) {
      await textareas[1].click({clickCount: 3});
      await textareas[1].type(queryTemplate);
    }
  }

  // Fill output columns
  for (let i = 0; i < outputColumns.length; i++) {
    if (i > 0) {
      await clickButton(page, 'Add Column');
      await settle(page, 100);
    }
    const keyInputs = await page.$$('input[placeholder*="Key"]');
    const labelInputs = await page.$$('input[placeholder*="Label"]');

    if (keyInputs[i]) {
      await keyInputs[i].click({clickCount: 3});
      await keyInputs[i].type(outputColumns[i].key);
    }
    if (labelInputs[i]) {
      await labelInputs[i].click({clickCount: 3});
      await labelInputs[i].type(outputColumns[i].label);
    }
  }

  // Submit the form - click the submit button specifically (not the tab button)
  await page.evaluate(() => {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      (submitBtn as HTMLButtonElement).click();
    } else {
      throw new Error('Submit button not found');
    }
  });
  await settle(page, 500);

  // Check for validation errors
  const validationError = await page.evaluate(() => {
    const errorEl = document.querySelector('[data-testid="add-agent-error"], [class*="text-red"]');
    return errorEl?.textContent || null;
  });
  if (validationError) {
    throw new Error(`Inline agent validation failed: ${validationError}`);
  }

  // Wait for the agent column to appear in the table
  await waitForText(page, config.displayName);
}

/**
 * Get inline agent configuration from state.
 */
export async function getInlineAgentConfig(
  page: Page,
  agentGroupIndex = 0,
): Promise<{
  name?: string;
  displayName?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  tools?: string[];
} | null> {
  return page.evaluate(idx => {
    const store = (window as any).__DATA_STUDIO_STORE__;
    const state = store?.getState();
    const agentGroup = state?.currentTable?.agentGroups[idx];
    return agentGroup?.inlineAgent || null;
  }, agentGroupIndex);
}
