// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  selectedValue: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

@customElement('ai-dropdown')
export class Dropdown extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-dropdown`;

  #options: DropdownOption[] = [];
  #selectedValue = '';
  #placeholder = 'Select...';
  #isOpen = false;
  #onChange?: (value: string) => void;
  #menuPosition = { top: 0, left: 0, width: 0 };
  #menuElement: HTMLDivElement | null = null;

  // Search functionality
  #searchQuery = '';
  #highlightedIndex = 0;
  #searchInput: HTMLInputElement | null = null;
  #optionElements: HTMLDivElement[] = [];

  set options(v: DropdownOption[]) { this.#options = v; this.#render(); }
  set selectedValue(v: string) { this.#selectedValue = v; this.#render(); }
  set placeholder(v: string) { this.#placeholder = v; this.#render(); }
  set onChange(fn: (value: string) => void) { this.#onChange = fn; }

  connectedCallback(): void {
    this.#render();
    // Close dropdown when clicking outside
    document.addEventListener('click', this.#handleOutsideClick);
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this.#handleOutsideClick);
    this.#removeMenu();
  }

  #handleOutsideClick = (e: Event): void => {
    if (!this.contains(e.target as Node) && !this.#menuElement?.contains(e.target as Node)) {
      this.#closeDropdown();
    }
  };

  #closeDropdown(): void {
    this.#isOpen = false;
    this.#searchQuery = '';
    this.#highlightedIndex = 0;
    this.#removeMenu();
    this.#render();
  }

  #removeMenu(): void {
    if (this.#menuElement) {
      this.#menuElement.remove();
      this.#menuElement = null;
      this.#searchInput = null;
      this.#optionElements = [];
    }
  }

  #toggleDropdown(): void {
    this.#isOpen = !this.#isOpen;
    if (this.#isOpen) {
      // Calculate position for fixed menu
      const row = this.querySelector('.dropdown-row') as HTMLElement;
      if (row) {
        const rect = row.getBoundingClientRect();
        this.#menuPosition = {
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        };
      }
      this.#searchQuery = '';
      this.#highlightedIndex = 0;
      this.#createMenu();
    } else {
      this.#closeDropdown();
    }
    this.#render();
  }

  get #isSearchable(): boolean {
    return this.#options.length > 10;
  }

  #filteredOptions(): DropdownOption[] {
    if (!this.#searchQuery) {
      return this.#options;
    }
    const q = this.#searchQuery.toLowerCase();
    return this.#options.filter(o =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }

  #createMenu(): void {
    this.#removeMenu();

    this.#menuElement = document.createElement('div');
    this.#menuElement.className = 'ai-dropdown-menu-portal';
    this.#menuElement.style.cssText = `
      position: fixed;
      top: ${this.#menuPosition.top}px;
      left: ${this.#menuPosition.left}px;
      width: ${this.#menuPosition.width}px;
      background: white;
      border: 1px solid var(--slate-200, #e2e8f0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 999999;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    // Add search input if searchable
    if (this.#isSearchable) {
      this.#searchInput = document.createElement('input');
      this.#searchInput.type = 'text';
      this.#searchInput.placeholder = 'Search...';
      this.#searchInput.style.cssText = `
        padding: 10px 12px;
        border: none;
        border-bottom: 1px solid var(--slate-200, #e2e8f0);
        font-size: 12px;
        outline: none;
        color: var(--slate-800, #1e293b);
        background: white;
      `;
      this.#searchInput.addEventListener('input', this.#handleSearchInput);
      this.#searchInput.addEventListener('keydown', this.#handleKeydown);
      this.#menuElement.appendChild(this.#searchInput);

      // Focus the search input after appending to DOM
      requestAnimationFrame(() => {
        this.#searchInput?.focus();
      });
    }

    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'ai-dropdown-options-container';
    optionsContainer.style.cssText = `
      max-height: 200px;
      overflow-y: auto;
    `;
    this.#renderOptions(optionsContainer);
    this.#menuElement.appendChild(optionsContainer);

    this.#menuElement.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(this.#menuElement);

    // Auto-scroll to selected option after DOM is ready
    requestAnimationFrame(() => {
      this.#scrollToSelected(optionsContainer);
    });
  }

  #scrollToSelected(container: HTMLDivElement): void {
    const selectedIndex = this.#options.findIndex(o => o.value === this.#selectedValue);
    if (selectedIndex >= 0 && this.#optionElements[selectedIndex]) {
      const selectedEl = this.#optionElements[selectedIndex];
      // Scroll so selected item is roughly centered in the container
      const containerHeight = container.clientHeight;
      const scrollTop = selectedEl.offsetTop - (containerHeight / 2) + (selectedEl.offsetHeight / 2);
      container.scrollTop = Math.max(0, scrollTop);
    }
  }

  #renderOptions(container: HTMLDivElement): void {
    container.innerHTML = '';
    this.#optionElements = [];

    const filtered = this.#filteredOptions();

    if (filtered.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'No results found';
      noResults.style.cssText = `
        padding: 10px 12px;
        font-size: 12px;
        color: var(--slate-500, #64748b);
        text-align: center;
      `;
      container.appendChild(noResults);
      return;
    }

    filtered.forEach((option, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'ai-dropdown-option';
      if (option.value === this.#selectedValue) {
        optionEl.className += ' selected';
      }
      if (index === this.#highlightedIndex) {
        optionEl.className += ' highlighted';
      }
      optionEl.textContent = option.label;
      this.#applyOptionStyles(optionEl, option.value === this.#selectedValue, index === this.#highlightedIndex);

      optionEl.addEventListener('mouseenter', () => {
        this.#highlightedIndex = index;
        this.#updateHighlight();
      });
      optionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#selectOption(option.value);
      });

      container.appendChild(optionEl);
      this.#optionElements.push(optionEl);
    });
  }

  #applyOptionStyles(el: HTMLDivElement, isSelected: boolean, isHighlighted: boolean): void {
    let styles = `
      padding: 10px 12px;
      font-size: 12px;
      color: var(--slate-800, #1e293b);
      cursor: pointer;
      transition: background-color 0.1s ease;
    `;
    if (isSelected) {
      styles += 'background: rgba(16, 147, 244, 0.08); color: var(--blue, #1093F4); font-weight: 500;';
    } else if (isHighlighted) {
      styles += 'background: #F7F9FC;';
    }
    el.style.cssText = styles;
  }

  #updateHighlight(): void {
    const filtered = this.#filteredOptions();
    this.#optionElements.forEach((el, index) => {
      const option = filtered[index];
      if (option) {
        this.#applyOptionStyles(el, option.value === this.#selectedValue, index === this.#highlightedIndex);
      }
    });

    // Scroll highlighted option into view
    const highlightedEl = this.#optionElements[this.#highlightedIndex];
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  #handleSearchInput = (e: Event): void => {
    this.#searchQuery = (e.target as HTMLInputElement).value;
    this.#highlightedIndex = 0;

    // Re-render options
    const optionsContainer = this.#menuElement?.querySelector('div:last-child') as HTMLDivElement;
    if (optionsContainer) {
      this.#renderOptions(optionsContainer);
    }
  };

  #handleKeydown = (e: KeyboardEvent): void => {
    const filtered = this.#filteredOptions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.#highlightedIndex = Math.min(this.#highlightedIndex + 1, filtered.length - 1);
        this.#updateHighlight();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.#highlightedIndex = Math.max(this.#highlightedIndex - 1, 0);
        this.#updateHighlight();
        break;
      case 'Enter':
        e.preventDefault();
        const option = filtered[this.#highlightedIndex];
        if (option) {
          this.#selectOption(option.value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.#closeDropdown();
        break;
    }
  };

  #selectOption(value: string): void {
    this.#selectedValue = value;
    this.#closeDropdown();
    if (this.#onChange) {
      this.#onChange(value);
    }
  }

  #getSelectedLabel(): string {
    const selected = this.#options.find(opt => opt.value === this.#selectedValue);
    return selected?.label || this.#placeholder;
  }

  #render(): void {
    Lit.render(html`
      <style>
        :host {
          display: block;
          position: relative;
        }

        .dropdown-container {
          display: block;
          position: relative;
        }

        .dropdown-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 200px;
          gap: 8px;
        }

        .dropdown-row:hover {
          border-color: var(--slate-300);
          background: #F7F9FC;
        }

        .dropdown-row.open {
          border-color: var(--blue);
        }

        .dropdown-text {
          font-size: 12px;
          color: var(--slate-800);
          flex: 1;
        }

        .dropdown-chevron {
          width: 12px;
          height: 12px;
          color: var(--slate-500);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }

        .dropdown-chevron.open {
          transform: rotate(180deg);
        }
      </style>

      <div class="dropdown-container">
        <div class="dropdown-row ${this.#isOpen ? 'open' : ''}" @click=${() => this.#toggleDropdown()}>
          <span class="dropdown-text">${this.#getSelectedLabel()}</span>
          <svg class="dropdown-chevron ${this.#isOpen ? 'open' : ''}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-dropdown': Dropdown; }
}
