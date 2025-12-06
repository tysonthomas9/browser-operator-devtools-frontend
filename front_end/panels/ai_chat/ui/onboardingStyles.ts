// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * CSS styles for the onboarding wizard dialog
 * Modern design matching the AI Chat panel design system
 */
export function getOnboardingStyles(): string {
  return `
    /* Keyframe Animations */
    @keyframes fadeInScale {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideInFromLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes celebrationBounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-20px); }
      60% { transform: translateY(-10px); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }

    @keyframes progressShrink {
      from { width: 100%; }
      to { width: 0%; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

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
      max-width: 620px;
      width: 90%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      background: var(--color-background-elevation-1);
      border-radius: 24px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.15),
        0 0 0 1px rgba(0, 164, 254, 0.1);
      overflow: hidden;
      backdrop-filter: blur(10px);
      animation: fadeInScale 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Step Indicators */
    .step-indicators {
      display: flex;
      justify-content: center;
      gap: 16px;
      padding: 24px;
      background: var(--color-background-elevation-2);
      border-bottom: 1px solid rgba(0, 164, 254, 0.1);
    }

    .step-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--color-details-hairline);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .step-indicator.active {
      background: #00a4fe;
      transform: scale(1.3);
      box-shadow: 0 0 12px rgba(0, 164, 254, 0.5);
    }

    .step-indicator.active::after {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid rgba(0, 164, 254, 0.3);
      animation: pulse 2s ease-in-out infinite;
    }

    .step-indicator.completed {
      background: var(--sys-color-accent-green, #4caf50);
      transform: scale(1.1);
    }

    /* Content Area */
    .onboarding-content {
      flex: 1;
      padding: 32px 40px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .onboarding-content::-webkit-scrollbar {
      width: 6px;
    }

    .onboarding-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .onboarding-content::-webkit-scrollbar-thumb {
      background-color: rgba(0, 164, 254, 0.3);
      border-radius: 3px;
    }

    .onboarding-content::-webkit-scrollbar-thumb:hover {
      background-color: rgba(0, 164, 254, 0.5);
    }

    .step-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 12px 0;
      text-align: center;
      color: var(--color-text-primary);
      animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .step-description {
      font-size: 14px;
      color: var(--color-text-secondary);
      text-align: center;
      margin: 0 0 28px 0;
      max-width: 450px;
      line-height: 1.6;
      animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.05s both;
    }

    /* Welcome Step */
    .welcome-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: fadeInScale 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .welcome-icon img {
      width: 80px;
      height: 80px;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0, 164, 254, 0.25);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .welcome-icon img:hover {
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 12px 32px rgba(0, 164, 254, 0.35);
    }

    .video-placeholder {
      width: 100%;
      max-width: 420px;
      aspect-ratio: 16/9;
      background: transparent;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 20px;
      overflow: hidden;
      animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
    }

    .video-placeholder img {
      width: 100%;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .video-placeholder-text {
      color: var(--color-text-secondary);
      font-size: 14px;
    }

    /* Clickable demo gif */
    .demo-gif-link {
      display: block;
      width: 100%;
      max-width: 400px;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
    }

    .demo-gif {
      width: 100%;
      display: block;
      border-radius: 12px;
    }

    /* Getting started link */
    .getting-started-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      color: #00a4fe;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      padding: 10px 20px;
      border-radius: 100px;
      background: rgba(0, 164, 254, 0.08);
    }

    /* Provider Grid */
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      width: 100%;
      max-width: 520px;
      animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
    }

    .provider-card {
      padding: 20px;
      border: 1.5px solid rgba(0, 164, 254, 0.15);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: var(--color-background);
      backdrop-filter: blur(10px);
      text-align: left;
      position: relative;
      overflow: hidden;
    }

    .provider-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0, 164, 254, 0.08), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .provider-card:hover {
      border-color: #00a4fe;
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 164, 254, 0.2);
    }

    .provider-card:hover::before {
      opacity: 1;
    }

    .provider-card.selected {
      border-color: #00a4fe;
      background: #def1fb;
      box-shadow:
        0 0 0 2px #00a4fe,
        0 8px 24px rgba(0, 164, 254, 0.25);
    }

    .provider-card.selected::before {
      opacity: 1;
    }

    .provider-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      position: relative;
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
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.5;
      position: relative;
    }

    /* API Key Form */
    .api-key-form {
      width: 100%;
      max-width: 450px;
      animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 10px;
      color: var(--color-text-primary);
    }

    .form-input {
      width: 100%;
      padding: 14px 20px;
      border: 1.5px solid var(--color-details-hairline);
      border-radius: 28px;
      font-size: 14px;
      background: var(--color-background);
      color: var(--color-text-primary);
      box-sizing: border-box;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .form-input::placeholder {
      color: var(--color-text-secondary);
    }

    .form-input:focus {
      outline: none;
      border-color: #00a4fe;
      box-shadow:
        0 0 0 3px rgba(0, 164, 254, 0.15),
        0 4px 15px rgba(0, 164, 254, 0.1);
      transform: translateY(-2px);
    }

    .form-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      font-size: 13px;
      color: var(--color-text-secondary);
    }

    .form-hint a {
      color: #00a4fe;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .form-hint a:hover {
      text-decoration: underline;
    }

    .test-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: var(--color-background-elevation-2);
      border: 1.5px solid var(--color-details-hairline);
      border-radius: 100px;
      color: var(--color-text-primary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .test-button:hover {
      background: var(--color-background-elevation-0);
      border-color: #00a4fe;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 164, 254, 0.15);
    }

    .test-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .test-status {
      margin-top: 16px;
      padding: 14px 20px;
      border-radius: 16px;
      font-size: 14px;
      display: none;
    }

    .test-status.visible {
      display: block;
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .test-status.success {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(76, 175, 80, 0.06));
      color: var(--sys-color-on-green-container, #2e7d32);
      border: 1px solid var(--sys-color-accent-green, #4caf50);
    }

    .test-status.error {
      background: linear-gradient(135deg, rgba(244, 67, 54, 0.12), rgba(244, 67, 54, 0.06));
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
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 18px 20px;
      background: var(--color-background);
      backdrop-filter: blur(8px);
      border-radius: 16px;
      border: 1px solid rgba(0, 164, 254, 0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideInFromLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    }

    .feature-item:nth-child(1) { animation-delay: 0.05s; }
    .feature-item:nth-child(2) { animation-delay: 0.1s; }
    .feature-item:nth-child(3) { animation-delay: 0.15s; }
    .feature-item:nth-child(4) { animation-delay: 0.2s; }
    .feature-item:nth-child(5) { animation-delay: 0.25s; }

    .feature-item:hover {
      transform: translateX(4px);
      border-color: rgba(0, 164, 254, 0.25);
      box-shadow: 0 4px 12px rgba(0, 164, 254, 0.1);
    }

    .feature-icon {
      font-size: 28px;
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(0, 164, 254, 0.15), rgba(0, 164, 254, 0.05));
      border-radius: 12px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .feature-item:hover .feature-icon {
      transform: scale(1.1);
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
      line-height: 1.5;
    }

    /* Ready Step */
    .ready-icon {
      font-size: 80px;
      margin-bottom: 20px;
      animation: celebrationBounce 1s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .tips-list {
      width: 100%;
      max-width: 420px;
      margin-top: 24px;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tip-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: var(--color-background);
      backdrop-filter: blur(8px);
      border-radius: 14px;
      border: 1px solid rgba(0, 164, 254, 0.1);
      font-size: 14px;
      color: var(--color-text-primary);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideInFromLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    }

    .tip-item:nth-child(1) { animation-delay: 0.1s; }
    .tip-item:nth-child(2) { animation-delay: 0.15s; }
    .tip-item:nth-child(3) { animation-delay: 0.2s; }
    .tip-item:nth-child(4) { animation-delay: 0.25s; }

    .tip-item:hover {
      transform: translateX(4px);
      border-color: rgba(0, 164, 254, 0.2);
    }

    .tip-icon {
      font-size: 20px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 164, 254, 0.1);
      border-radius: 10px;
      flex-shrink: 0;
    }

    /* Auto-close progress indicator */
    .auto-close-progress {
      width: 200px;
      height: 4px;
      background: rgba(0, 164, 254, 0.2);
      border-radius: 2px;
      overflow: hidden;
      margin: 16px auto 8px auto;
    }

    .auto-close-progress-bar {
      height: 100%;
      background: #00a4fe;
      border-radius: 2px;
      animation: progressShrink 5s linear forwards;
    }

    .auto-close-text {
      font-size: 13px;
      color: var(--color-text-secondary);
      text-align: center;
    }

    /* Footer */
    .onboarding-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: var(--color-background-elevation-2);
      border-top: 1px solid rgba(0, 164, 254, 0.1);
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
      padding: 12px 28px;
      border-radius: 100px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .btn:hover::before {
      opacity: 1;
    }

    .btn-secondary {
      background: var(--color-background);
      border: 1.5px solid var(--color-details-hairline);
      color: var(--color-text-primary);
    }

    .btn-secondary:hover {
      background: var(--color-background-elevation-0);
      border-color: #00a4fe;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .btn-primary {
      background: linear-gradient(135deg, #00a4fe, #0093e0);
      color: white;
      box-shadow: 0 4px 12px rgba(0, 164, 254, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 164, 254, 0.4);
    }

    .btn-primary:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0, 164, 254, 0.3);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-openrouter {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      width: 100%;
      max-width: 300px;
      margin-top: 16px;
    }

    .btn-openrouter:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }

    .btn-openrouter:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-text {
      background: none;
      border: none;
      color: var(--color-text-secondary);
      padding: 12px 20px;
      border-radius: 100px;
    }

    .btn-text:hover {
      color: var(--color-text-primary);
      background: rgba(0, 0, 0, 0.05);
    }

    /* Setup Required Banner (for main UI) */
    .setup-required-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.12), rgba(255, 193, 7, 0.06));
      border: 1px solid var(--sys-color-accent-yellow, #ffc107);
      border-radius: 16px;
      margin: 12px;
    }

    .setup-banner-text {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: var(--color-text-primary);
    }

    .setup-banner-button {
      padding: 8px 20px;
      background: linear-gradient(135deg, #00a4fe, #0093e0);
      color: white;
      border: none;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .setup-banner-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 164, 254, 0.3);
    }

    /* Loading spinner */
    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(0, 164, 254, 0.2);
      border-top-color: #00a4fe;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
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
