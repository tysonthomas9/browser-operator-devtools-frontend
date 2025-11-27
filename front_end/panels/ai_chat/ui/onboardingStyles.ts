// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * CSS styles for the onboarding wizard dialog
 */
export function getOnboardingStyles(): string {
  return `
    .onboarding-dialog {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-background);
      color: var(--color-text-primary);
    }

    .onboarding-container {
      max-width: 600px;
      width: 90%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      background: var(--color-background-elevation-1);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    /* Step Indicators */
    .step-indicators {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 20px;
      background: var(--color-background-elevation-2);
      border-bottom: 1px solid var(--color-details-hairline);
    }

    .step-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-details-hairline);
      transition: all 0.3s ease;
    }

    .step-indicator.active {
      background: var(--color-primary);
      transform: scale(1.2);
    }

    .step-indicator.completed {
      background: var(--sys-color-accent-green, #4caf50);
    }

    /* Content Area */
    .onboarding-content {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .step-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 12px 0;
      text-align: center;
      color: var(--color-text-primary);
    }

    .step-description {
      font-size: 14px;
      color: var(--color-text-secondary);
      text-align: center;
      margin: 0 0 24px 0;
      max-width: 450px;
      line-height: 1.5;
    }

    /* Welcome Step */
    .welcome-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .video-placeholder {
      width: 100%;
      max-width: 400px;
      aspect-ratio: 16/9;
      background: var(--color-background-elevation-0);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 16px;
      border: 2px dashed var(--color-details-hairline);
    }

    .video-placeholder-text {
      color: var(--color-text-secondary);
      font-size: 14px;
    }

    /* Provider Grid */
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      width: 100%;
      max-width: 500px;
    }

    .provider-card {
      padding: 16px;
      border: 2px solid var(--color-details-hairline);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--color-background);
      text-align: left;
    }

    .provider-card:hover {
      border-color: var(--color-primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 164, 254, 0.15);
    }

    .provider-card.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-container, rgba(0, 164, 254, 0.1));
    }

    .provider-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .provider-icon {
      font-size: 24px;
    }

    .provider-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .provider-description {
      font-size: 12px;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }

    /* API Key Form */
    .api-key-form {
      width: 100%;
      max-width: 450px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--color-text-primary);
    }

    .form-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--color-details-hairline);
      border-radius: 6px;
      font-size: 14px;
      background: var(--color-background);
      color: var(--color-text-primary);
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(0, 164, 254, 0.2);
    }

    .form-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .form-hint a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .form-hint a:hover {
      text-decoration: underline;
    }

    .test-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--color-background-elevation-2);
      border: 1px solid var(--color-details-hairline);
      border-radius: 6px;
      color: var(--color-text-primary);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .test-button:hover {
      background: var(--color-background-elevation-0);
    }

    .test-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .test-status {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      display: none;
    }

    .test-status.visible {
      display: block;
    }

    .test-status.success {
      background: var(--sys-color-green-container, rgba(76, 175, 80, 0.1));
      color: var(--sys-color-on-green-container, #2e7d32);
      border: 1px solid var(--sys-color-accent-green, #4caf50);
    }

    .test-status.error {
      background: var(--sys-color-error-container, rgba(244, 67, 54, 0.1));
      color: var(--sys-color-on-error-container, #c62828);
      border: 1px solid var(--sys-color-error, #f44336);
    }

    .skip-link {
      margin-top: 24px;
      color: var(--color-text-secondary);
      font-size: 13px;
      cursor: pointer;
      text-decoration: underline;
      background: none;
      border: none;
    }

    .skip-link:hover {
      color: var(--color-text-primary);
    }

    /* Features List */
    .feature-list {
      width: 100%;
      max-width: 450px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      background: var(--color-background);
      border-radius: 8px;
      border: 1px solid var(--color-details-hairline);
    }

    .feature-icon {
      font-size: 28px;
      flex-shrink: 0;
    }

    .feature-content {
      flex: 1;
    }

    .feature-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--color-text-primary);
    }

    .feature-description {
      font-size: 13px;
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.4;
    }

    /* Ready Step */
    .ready-icon {
      font-size: 72px;
      margin-bottom: 16px;
    }

    .tips-list {
      width: 100%;
      max-width: 400px;
      margin-top: 24px;
      text-align: left;
    }

    .tip-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-details-hairline);
      font-size: 14px;
      color: var(--color-text-secondary);
    }

    .tip-item:last-child {
      border-bottom: none;
    }

    .tip-icon {
      font-size: 18px;
    }

    /* Footer */
    .onboarding-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background: var(--color-background-elevation-2);
      border-top: 1px solid var(--color-details-hairline);
    }

    .footer-left {
      display: flex;
      gap: 12px;
    }

    .footer-right {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-secondary {
      background: var(--color-background);
      border: 1px solid var(--color-details-hairline);
      color: var(--color-text-primary);
    }

    .btn-secondary:hover {
      background: var(--color-background-elevation-0);
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--color-primary-variant, #0093e0);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 164, 254, 0.3);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-text {
      background: none;
      border: none;
      color: var(--color-text-secondary);
      padding: 10px 16px;
    }

    .btn-text:hover {
      color: var(--color-text-primary);
    }

    /* Setup Required Banner (for main UI) */
    .setup-required-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--sys-color-yellow-container, rgba(255, 193, 7, 0.1));
      border: 1px solid var(--sys-color-accent-yellow, #ffc107);
      border-radius: 8px;
      margin: 12px;
    }

    .setup-banner-text {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .setup-banner-button {
      padding: 6px 16px;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }

    .setup-banner-button:hover {
      background: var(--color-primary-variant, #0093e0);
    }

    /* Loading spinner */
    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--color-details-hairline);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}

/**
 * Apply onboarding styles to a dialog element
 */
export function applyOnboardingStyles(dialogElement: HTMLElement): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = getOnboardingStyles();
  dialogElement.appendChild(styleElement);
}
