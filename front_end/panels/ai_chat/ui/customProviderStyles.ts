// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Get CSS styles for custom provider dialog
 */
export function getCustomProviderStyles(): string {
  return `
    .custom-provider-dialog {
      color: var(--color-text-primary);
      background-color: var(--color-background);
    }

    .custom-provider-dialog.full-screen {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
    }

    .custom-provider-container {
      min-width: 500px;
      max-width: 600px;
      padding: 20px;
    }

    .custom-provider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .custom-provider-title {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: var(--color-text-primary);
    }

    .custom-provider-add-button {
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      background-color: var(--color-primary);
      border: 1px solid var(--color-primary);
      color: white;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .custom-provider-add-button:hover {
      background-color: var(--color-primary-variant);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 164, 254, 0.2);
    }

    .provider-list-container {
      max-height: 400px;
      overflow-y: auto;
    }

    .provider-list-item {
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid var(--color-details-hairline);
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--color-background-elevation-1);
      transition: all 0.2s ease;
    }

    .provider-list-item:hover {
      background-color: var(--color-background-elevation-2);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      transform: translateX(2px);
    }

    .provider-info {
      flex: 1;
    }

    .provider-name {
      font-weight: 500;
      margin-bottom: 4px;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .provider-url {
      font-size: 12px;
      color: var(--color-text-secondary);
      font-family: monospace;
    }

    .provider-models-count {
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    }

    .provider-actions {
      display: flex;
      gap: 8px;
    }

    .provider-edit-button {
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      border: 1px solid var(--color-details-hairline);
      background-color: var(--color-background-elevation-1);
      color: var(--color-text-primary);
      transition: all 0.2s ease;
    }

    .provider-edit-button:hover {
      background-color: var(--color-background-elevation-2);
      border-color: var(--color-primary);
    }

    .provider-delete-button {
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      border: 1px solid var(--color-error);
      background-color: var(--color-background-elevation-1);
      color: var(--color-error);
      transition: all 0.2s ease;
    }

    .provider-delete-button:hover {
      background-color: var(--color-error);
      color: white;
    }

    .provider-empty-message {
      color: var(--color-text-secondary);
      text-align: center;
      padding: 32px;
      font-size: 14px;
    }

    /* Add/Edit Dialog Styles */
    .add-edit-container {
      width: 100%;
      max-width: 800px;
      padding: 40px;
      margin: 20px auto;
      box-sizing: border-box;
      overflow-y: auto;
      max-height: calc(100vh - 40px);
    }

    .add-edit-title {
      margin: 0 0 20px 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text-primary);
    }

    .add-edit-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-field-label {
      font-weight: 500;
      margin-bottom: 4px;
      display: block;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .form-field-input {
      padding: 8px 12px;
      border: 1px solid var(--color-details-hairline);
      border-radius: 4px;
      width: 100%;
      background-color: var(--color-background-elevation-2);
      color: var(--color-text-primary);
      font-size: 14px;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }

    .form-field-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px rgba(0, 164, 254, 0.3);
    }

    .form-field-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background-color: var(--color-background-elevation-0);
    }

    .form-field-hint {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-top: -8px;
    }

    .test-connection-section {
      padding: 12px;
      background: var(--color-background-elevation-1);
      border-radius: 6px;
      border: 1px solid var(--color-details-hairline);
    }

    .test-connection-button {
      padding: 8px 16px;
      cursor: pointer;
      width: 100%;
      border-radius: 4px;
      background-color: var(--color-primary);
      border: 1px solid var(--color-primary);
      color: white;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .test-connection-button:hover:not(:disabled) {
      background-color: var(--color-primary-variant);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 164, 254, 0.2);
    }

    .test-connection-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .status-message {
      margin-top: 12px;
      padding: 8px;
      border-radius: 4px;
      font-size: 13px;
      display: none;
      transition: all 0.3s ease;
    }

    .status-message.visible {
      display: block;
    }

    .status-success {
      background: var(--sys-color-green-container);
      color: var(--sys-color-on-green-container);
      border: 1px solid var(--sys-color-accent-green);
    }

    .status-error {
      background: var(--sys-color-error-container);
      color: var(--sys-color-on-error-container);
      border: 1px solid var(--sys-color-error);
    }

    .status-neutral {
      background: var(--sys-color-neutral-container);
      color: var(--color-text-primary);
      border: 1px solid var(--color-details-hairline);
    }

    .fetched-models-display {
      margin-top: 12px;
      display: none;
    }

    .fetched-models-display.visible {
      display: block;
    }

    .fetched-models-title {
      font-weight: 500;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .fetched-models-list {
      max-height: 150px;
      overflow-y: auto;
      padding: 8px;
      background: var(--color-background);
      border-radius: 4px;
      border: 1px solid var(--color-details-hairline);
    }

    .fetched-model-item {
      padding: 4px 0;
      font-size: 12px;
      font-family: monospace;
      color: var(--color-text-primary);
    }

    /* Models Management Section */
    .models-management-section {
      margin-top: 16px;
      padding: 12px;
      background: var(--color-background-elevation-1);
      border-radius: 6px;
      border: 1px solid var(--color-details-hairline);
    }

    .models-section-title {
      font-weight: 500;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .models-list-container {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 12px;
      padding: 8px;
      background: var(--color-background);
      border-radius: 4px;
      min-height: 40px;
      border: 1px solid var(--color-details-hairline);
    }

    .models-empty-message {
      color: var(--color-text-secondary);
      font-size: 12px;
      padding: 8px;
      text-align: center;
    }

    .model-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      margin-bottom: 4px;
      background: var(--color-background-elevation-1);
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .model-item:hover {
      background: var(--color-background-elevation-2);
    }

    .model-name {
      font-family: monospace;
      font-size: 12px;
      flex: 1;
      color: var(--color-text-primary);
    }

    .model-remove-button {
      padding: 2px 8px;
      cursor: pointer;
      color: var(--color-error);
      font-size: 16px;
      line-height: 1;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 3px;
      transition: all 0.2s ease;
    }

    .model-remove-button:hover {
      background: var(--color-error);
      color: white;
      border-color: var(--color-error);
    }

    .add-model-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .add-model-label {
      font-weight: 500;
      min-width: 80px;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .add-model-input {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid var(--color-details-hairline);
      border-radius: 4px;
      background-color: var(--color-background-elevation-2);
      color: var(--color-text-primary);
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .add-model-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px rgba(0, 164, 254, 0.3);
    }

    .add-model-button {
      padding: 6px 16px;
      cursor: pointer;
      border-radius: 4px;
      background-color: var(--color-background-elevation-1);
      border: 1px solid var(--color-details-hairline);
      color: var(--color-text-primary);
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .add-model-button:hover {
      background-color: var(--color-background-elevation-2);
      border-color: var(--color-primary);
    }

    .save-provider-button {
      padding: 10px 20px;
      cursor: pointer;
      margin-top: 20px;
      width: 100%;
      border-radius: 4px;
      background-color: var(--color-primary);
      border: 1px solid var(--color-primary);
      color: white;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .save-provider-button:hover:not(:disabled) {
      background-color: var(--color-primary-variant);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 164, 254, 0.2);
    }

    .save-provider-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    /* Scrollbar styling for better consistency */
    .provider-list-container::-webkit-scrollbar,
    .models-list-container::-webkit-scrollbar,
    .fetched-models-list::-webkit-scrollbar {
      width: 8px;
    }

    .provider-list-container::-webkit-scrollbar-track,
    .models-list-container::-webkit-scrollbar-track,
    .fetched-models-list::-webkit-scrollbar-track {
      background: var(--color-background);
      border-radius: 4px;
    }

    .provider-list-container::-webkit-scrollbar-thumb,
    .models-list-container::-webkit-scrollbar-thumb,
    .fetched-models-list::-webkit-scrollbar-thumb {
      background: var(--color-details-hairline);
      border-radius: 4px;
    }

    .provider-list-container::-webkit-scrollbar-thumb:hover,
    .models-list-container::-webkit-scrollbar-thumb:hover,
    .fetched-models-list::-webkit-scrollbar-thumb:hover {
      background: var(--color-text-secondary);
    }
  `;
}

/**
 * Apply custom provider dialog styles to a dialog element
 */
export function applyCustomProviderStyles(dialogElement: HTMLElement): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = getCustomProviderStyles();
  dialogElement.appendChild(styleElement);
}
