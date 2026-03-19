// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { ElementOption, ExecutionContext } from './types/SelfHealingTypes.js';

const logger = createLogger('SelfHealingMCQGenerator');

/**
 * Represents a parsed element from the accessibility tree.
 */
interface ParsedElement {
  nodeId: string;
  role: string;
  name?: string;
  description?: string;
  backendNodeId?: number;
  level?: number;
}

/**
 * Generates Multiple Choice Question (MCQ) options from the accessibility tree
 * to constrain LLM responses to real page elements.
 */
export class SelfHealingMCQGenerator {
  /**
   * Generate MCQ options from accessibility tree.
   * @param accessibilityTree The simplified accessibility tree string
   * @param errorContext The error context for relevance filtering
   * @param maxOptions Maximum number of options to return
   * @returns Array of element options
   */
  generateOptions(
    accessibilityTree: string,
    errorContext: ExecutionContext,
    maxOptions: number = 5
  ): ElementOption[] {
    logger.info('Generating MCQ options', {
      failingSelector: errorContext.failingSelector.substring(0, 50),
      maxOptions,
    });

    // Parse accessibility tree
    const elements = this.parseAccessibilityTree(accessibilityTree);

    if (elements.length === 0) {
      logger.warn('No elements parsed from accessibility tree');
      return [];
    }

    // Filter to interactive and relevant elements
    const relevantElements = this.filterRelevantElements(elements, errorContext);

    // Score and rank elements by similarity to failing selector
    const rankedElements = this.rankBySimilarity(relevantElements, errorContext);

    // Take top N elements
    const topElements = rankedElements.slice(0, maxOptions);

    // Convert to MCQ options
    const options = topElements.map((el, i) => this.createOption(el, i));

    logger.info(`Generated ${options.length} MCQ options`);
    return options;
  }

  /**
   * Parse the simplified accessibility tree into elements.
   */
  private parseAccessibilityTree(tree: string): ParsedElement[] {
    const elements: ParsedElement[] = [];
    const lines = tree.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Parse format: "[nodeId] role: name" or "[nodeId] role"
      // Indentation indicates level
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      const level = Math.floor(indent / 2);

      // Match [nodeId] role: name or [nodeId] role
      const match = line.match(/\[(\d+)\]\s*(\w+)(?::\s*(.+))?$/);
      if (match) {
        elements.push({
          nodeId: match[1],
          role: match[2],
          name: match[3]?.trim(),
          level,
        });
      }
    }

    return elements;
  }

  /**
   * Filter elements to those that are relevant for interaction.
   */
  private filterRelevantElements(
    elements: ParsedElement[],
    context: ExecutionContext
  ): ParsedElement[] {
    // Roles that are typically interactive
    const interactiveRoles = new Set([
      'button',
      'link',
      'textbox',
      'checkbox',
      'radio',
      'combobox',
      'listbox',
      'menuitem',
      'tab',
      'searchbox',
      'slider',
      'spinbutton',
      'switch',
      'menuitemcheckbox',
      'menuitemradio',
      'option',
      'treeitem',
      'row',
      'cell',
      'gridcell',
    ]);

    // Roles that might be relevant based on action type
    const contextRoles = this.getRolesForAction(context.actionType);

    return elements.filter(el => {
      // Include interactive roles
      if (interactiveRoles.has(el.role.toLowerCase())) {
        return true;
      }

      // Include context-specific roles
      if (contextRoles.has(el.role.toLowerCase())) {
        return true;
      }

      // Include elements with names that might match the failing selector
      if (el.name && context.failingSelector) {
        const selectorLower = context.failingSelector.toLowerCase();
        const nameLower = el.name.toLowerCase();

        // Check for name similarity
        if (nameLower.includes(selectorLower) || selectorLower.includes(nameLower)) {
          return true;
        }

        // Check for keyword overlap
        const selectorWords = selectorLower.split(/[\s\-_.,]+/);
        const nameWords = nameLower.split(/[\s\-_.,]+/);
        const overlap = selectorWords.filter(w => nameWords.includes(w) && w.length > 2);
        if (overlap.length > 0) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Get relevant roles based on the action type.
   */
  private getRolesForAction(actionType?: string): Set<string> {
    const roles = new Set<string>();

    switch (actionType) {
      case 'click':
        roles.add('button');
        roles.add('link');
        roles.add('menuitem');
        roles.add('tab');
        roles.add('option');
        roles.add('img'); // Clickable images
        roles.add('heading'); // Sometimes headings are clickable
        break;

      case 'type':
      case 'fill':
        roles.add('textbox');
        roles.add('searchbox');
        roles.add('combobox');
        roles.add('spinbutton');
        roles.add('textarea');
        break;

      case 'select':
        roles.add('combobox');
        roles.add('listbox');
        roles.add('option');
        roles.add('menuitem');
        break;

      case 'check':
        roles.add('checkbox');
        roles.add('radio');
        roles.add('switch');
        roles.add('menuitemcheckbox');
        roles.add('menuitemradio');
        break;

      case 'hover':
        roles.add('button');
        roles.add('link');
        roles.add('menuitem');
        roles.add('tooltip');
        break;
    }

    return roles;
  }

  /**
   * Rank elements by similarity to the failing selector.
   */
  private rankBySimilarity(
    elements: ParsedElement[],
    context: ExecutionContext
  ): ParsedElement[] {
    const failingSelector = context.failingSelector.toLowerCase();

    // Extract keywords from selector
    const selectorKeywords = this.extractKeywords(failingSelector);

    // Score each element
    const scored = elements.map(el => ({
      element: el,
      score: this.calculateScore(el, selectorKeywords, context),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.element);
  }

  /**
   * Extract keywords from a selector string.
   */
  private extractKeywords(selector: string): string[] {
    // Remove CSS selector syntax and extract meaningful words
    const cleaned = selector
      .replace(/[#.\[\]='"]/g, ' ')
      .replace(/[^a-z0-9\s-_]/gi, ' ')
      .toLowerCase();

    return cleaned
      .split(/[\s\-_]+/)
      .filter(word => word.length > 2)
      .filter((word, index, self) => self.indexOf(word) === index); // Unique
  }

  /**
   * Calculate relevance score for an element.
   */
  private calculateScore(
    element: ParsedElement,
    selectorKeywords: string[],
    context: ExecutionContext
  ): number {
    let score = 0;
    const name = (element.name || '').toLowerCase();
    const role = element.role.toLowerCase();

    // Keyword matching
    for (const keyword of selectorKeywords) {
      if (name.includes(keyword)) {
        score += 3; // Strong match in name
      }
      if (role.includes(keyword)) {
        score += 2; // Match in role
      }
    }

    // Role relevance for action type
    const actionRoles = this.getRolesForAction(context.actionType);
    if (actionRoles.has(role)) {
      score += 2;
    }

    // Bonus for interactive elements
    const highValueRoles = ['button', 'link', 'textbox', 'checkbox', 'radio'];
    if (highValueRoles.includes(role)) {
      score += 1;
    }

    // Penalty for generic roles
    if (role === 'generic' || role === 'group' || role === 'none') {
      score -= 1;
    }

    // Bonus for elements with descriptive names
    if (name.length > 3) {
      score += 0.5;
    }

    return score;
  }

  /**
   * Create an MCQ option from an element.
   */
  private createOption(element: ParsedElement, index: number): ElementOption {
    // Generate option ID (A, B, C, etc.)
    const id = String.fromCharCode(65 + index);

    // Generate selector based on element properties
    const selector = this.generateSelector(element);

    // Build description
    const description = this.buildDescription(element);

    return {
      id,
      selector,
      description,
      role: element.role,
      name: element.name,
      backendNodeId: element.backendNodeId,
    };
  }

  /**
   * Generate a selector string for an element.
   */
  private generateSelector(element: ParsedElement): string {
    const role = element.role.toLowerCase();
    const name = element.name;

    // For elements with names, prefer role-based or text-based selectors
    if (name) {
      // Use role-based selector pattern
      switch (role) {
        case 'button':
          return `button:has-text("${this.escapeQuotes(name)}")`;
        case 'link':
          return `a:has-text("${this.escapeQuotes(name)}")`;
        case 'textbox':
        case 'searchbox':
          return `input[placeholder*="${this.escapeQuotes(name)}"], input[aria-label*="${this.escapeQuotes(name)}"]`;
        case 'checkbox':
          return `input[type="checkbox"][aria-label*="${this.escapeQuotes(name)}"]`;
        case 'radio':
          return `input[type="radio"][aria-label*="${this.escapeQuotes(name)}"]`;
        default:
          // Generic role-based selector
          return `[role="${role}"]:has-text("${this.escapeQuotes(name)}")`;
      }
    }

    // Fallback to role-only selector
    return `[role="${role}"]`;
  }

  /**
   * Build a human-readable description for an option.
   */
  private buildDescription(element: ParsedElement): string {
    const parts: string[] = [];

    parts.push(`${element.role}`);

    if (element.name) {
      // Truncate long names
      const name = element.name.length > 50
        ? element.name.substring(0, 50) + '...'
        : element.name;
      parts.push(`"${name}"`);
    }

    if (element.nodeId) {
      parts.push(`(ID: ${element.nodeId})`);
    }

    return parts.join(' ');
  }

  /**
   * Escape quotes in a string for use in selectors.
   */
  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * Format options as a numbered list for LLM prompt.
   */
  formatOptionsForPrompt(options: ElementOption[]): string {
    if (options.length === 0) {
      return 'No suitable elements found on the page.';
    }

    const lines = options.map(opt =>
      `${opt.id}) ${opt.description}\n   Selector: ${opt.selector}`
    );

    return lines.join('\n\n');
  }
}
