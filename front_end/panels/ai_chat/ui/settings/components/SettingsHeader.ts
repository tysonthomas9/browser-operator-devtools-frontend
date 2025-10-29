// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { i18nString } from '../i18n-strings.js';

/**
 * Create the settings dialog header
 *
 * @param container - Parent element to append the header to
 * @param onClose - Callback function when close button is clicked
 * @returns The created header element
 */
export function createSettingsHeader(
  container: HTMLElement,
  onClose: () => void,
): HTMLElement {
  const headerDiv = document.createElement('div');
  headerDiv.className = 'settings-header';
  container.appendChild(headerDiv);

  const title = document.createElement('h2');
  title.className = 'settings-title';
  title.textContent = i18nString({ settings: 'Settings' }.settings);
  headerDiv.appendChild(title);

  const closeButton = document.createElement('button');
  closeButton.className = 'settings-close-button';
  closeButton.setAttribute('aria-label', 'Close settings');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', onClose);
  headerDiv.appendChild(closeButton);

  return headerDiv;
}
