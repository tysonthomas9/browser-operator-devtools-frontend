// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Settings footer elements
 */
export interface SettingsFooterElements {
  container: HTMLElement;
  statusMessage: HTMLElement;
  cancelButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
}

/**
 * Create the settings dialog footer with save/cancel buttons
 *
 * @param container - Parent element to append the footer to
 * @param onCancel - Callback function when cancel button is clicked
 * @param onSave - Callback function when save button is clicked
 * @returns Object containing footer elements
 */
export function createSettingsFooter(
  container: HTMLElement,
  onCancel: () => void,
  onSave: () => void,
): SettingsFooterElements {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'settings-footer';
  container.appendChild(buttonContainer);

  // Status message for save operation
  const saveStatusMessage = document.createElement('div');
  saveStatusMessage.className = 'settings-status save-status';
  saveStatusMessage.style.display = 'none';
  saveStatusMessage.style.marginRight = 'auto'; // Push to left
  buttonContainer.appendChild(saveStatusMessage);

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'settings-button cancel-button';
  cancelButton.setAttribute('type', 'button');
  cancelButton.addEventListener('click', onCancel);
  buttonContainer.appendChild(cancelButton);

  // Save button
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.className = 'settings-button save-button';
  saveButton.setAttribute('type', 'button');
  saveButton.addEventListener('click', onSave);
  buttonContainer.appendChild(saveButton);

  return {
    container: buttonContainer,
    statusMessage: saveStatusMessage,
    cancelButton,
    saveButton,
  };
}

/**
 * Show footer status message
 *
 * @param statusElement - The status message element
 * @param message - Message to display
 * @param type - Type of message (info, success, error)
 * @param duration - How long to show the message (ms), 0 = don't auto-hide
 */
export function showFooterStatus(
  statusElement: HTMLElement,
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  duration: number = 3000,
): void {
  statusElement.textContent = message;
  statusElement.style.display = 'block';

  // Set colors based on type
  switch (type) {
    case 'success':
      statusElement.style.backgroundColor = 'var(--color-accent-green-background)';
      statusElement.style.color = 'var(--color-accent-green)';
      break;
    case 'error':
      statusElement.style.backgroundColor = 'var(--color-accent-red-background)';
      statusElement.style.color = 'var(--color-accent-red)';
      break;
    default:
      statusElement.style.backgroundColor = 'var(--color-accent-blue-background)';
      statusElement.style.color = 'var(--color-accent-blue)';
  }

  if (duration > 0) {
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, duration);
  }
}
