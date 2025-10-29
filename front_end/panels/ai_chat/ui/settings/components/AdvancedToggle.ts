// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ADVANCED_SETTINGS_ENABLED_KEY } from '../constants.js';
import { getStorageBoolean, setStorageBoolean } from '../utils/storage.js';

/**
 * Advanced toggle elements
 */
export interface AdvancedToggleElements {
  section: HTMLElement;
  checkbox: HTMLInputElement;
  label: HTMLLabelElement;
}

/**
 * Create the advanced settings toggle
 *
 * @param container - Parent element to append the toggle to
 * @param onChange - Callback function when toggle state changes
 * @returns Object containing toggle elements
 */
export function createAdvancedToggle(
  container: HTMLElement,
  onChange: (enabled: boolean) => void,
): AdvancedToggleElements {
  const advancedToggleSection = document.createElement('div');
  advancedToggleSection.className = 'advanced-settings-toggle-section';
  container.appendChild(advancedToggleSection);

  const advancedToggleContainer = document.createElement('div');
  advancedToggleContainer.className = 'advanced-settings-toggle-container';
  advancedToggleSection.appendChild(advancedToggleContainer);

  const advancedToggleCheckbox = document.createElement('input');
  advancedToggleCheckbox.type = 'checkbox';
  advancedToggleCheckbox.id = 'advanced-settings-toggle';
  advancedToggleCheckbox.className = 'advanced-settings-checkbox';
  advancedToggleCheckbox.checked = getStorageBoolean(ADVANCED_SETTINGS_ENABLED_KEY, false);
  advancedToggleContainer.appendChild(advancedToggleCheckbox);

  const advancedToggleLabel = document.createElement('label');
  advancedToggleLabel.htmlFor = 'advanced-settings-toggle';
  advancedToggleLabel.className = 'advanced-settings-label';
  advancedToggleLabel.textContent = '⚙️ Advanced Settings';
  advancedToggleContainer.appendChild(advancedToggleLabel);

  const advancedToggleHint = document.createElement('div');
  advancedToggleHint.className = 'settings-hint';
  advancedToggleHint.textContent =
    'Show advanced configuration options (Browsing History, Vector DB, Tracing, Evaluation)';
  advancedToggleSection.appendChild(advancedToggleHint);

  // Add event listener for toggle
  advancedToggleCheckbox.addEventListener('change', () => {
    const isEnabled = advancedToggleCheckbox.checked;
    setStorageBoolean(ADVANCED_SETTINGS_ENABLED_KEY, isEnabled);
    onChange(isEnabled);
  });

  return {
    section: advancedToggleSection,
    checkbox: advancedToggleCheckbox,
    label: advancedToggleLabel,
  };
}

/**
 * Toggle visibility of advanced sections
 *
 * @param sections - Array of sections to toggle
 * @param show - Whether to show or hide the sections
 */
export function toggleAdvancedSections(sections: HTMLElement[], show: boolean): void {
  const display = show ? 'block' : 'none';
  sections.forEach(section => {
    section.style.display = display;
  });
}
