// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';
import { EvaluationRunner } from '../evaluation/runner/EvaluationRunner.js';
import { VisionAgentEvaluationRunner } from '../evaluation/runner/VisionAgentEvaluationRunner.js';
import { schemaExtractorTests } from '../evaluation/test-cases/schema-extractor-tests.js';
import { streamlinedSchemaExtractorTests } from '../evaluation/test-cases/streamlined-schema-extractor-tests.js';
import { htmlToMarkdownTests } from '../evaluation/test-cases/html-to-markdown-tests.js';
import { researchAgentTests } from '../evaluation/test-cases/research-agent-tests.js';
import { actionAgentTests } from '../evaluation/test-cases/action-agent-tests.js';
import { webTaskAgentTests } from '../evaluation/test-cases/web-task-agent-tests.js';
import type { TestResult } from '../evaluation/framework/types.js';
import { createLogger } from '../core/Logger.js';
import { AIChatPanel } from './AIChatPanel.js';

const logger = createLogger('EvaluationsView');

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

const JUDGE_MODEL_STORAGE_KEY = 'ai_chat_judge_model';

const TOOL_TEST_MAPPING: Record<string, { tests: any[], displayName: string }> = {
  'extract_schema': { tests: schemaExtractorTests, displayName: 'Original Schema Extractor' },
  'extract_schema_streamlined': { tests: streamlinedSchemaExtractorTests, displayName: 'Streamlined Schema Extractor' },
  'html_to_markdown': { tests: htmlToMarkdownTests, displayName: 'HTML to Markdown' },
};

const AGENT_TEST_MAPPING: Record<string, { tests: any[], displayName: string }> = {
  'research_agent': { tests: researchAgentTests, displayName: 'Research Agent' },
  'action_agent': { tests: actionAgentTests, displayName: 'Action Agent' },
  'web_task_agent': { tests: webTaskAgentTests, displayName: 'Web Task Agent' },
};

interface EvaluationsViewState {
  isRunning: boolean;
  testResults: Map<string, TestResult>;
  currentRunningTest?: string;
  totalTests: number;
  completedTests: number;
  startTime?: number;
  activeTab: 'tool-tests' | 'agents';
  agentType: string;
  visionEnabled?: boolean;
  selectedTests: Set<string>;
  bottomPanelView: 'summary' | 'logs';
  testLogs: string[];
  toolType: string;
  judgeModel: string;
}

/**
 * Inline view for evaluation tests
 * Design matches ConnectorsView patterns
 */
@customElement('ai-evaluations-view')
export class EvaluationsView extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-evaluations-view`;

  #state: EvaluationsViewState = {
    isRunning: false,
    testResults: new Map(),
    totalTests: 0,
    completedTests: 0,
    activeTab: 'tool-tests',
    agentType: 'research_agent',
    visionEnabled: false,
    selectedTests: new Set(),
    bottomPanelView: 'summary',
    testLogs: [],
    toolType: 'extract_schema',
    judgeModel: 'gpt-4.1-mini',
  };

  #evaluationRunner?: EvaluationRunner;
  #agentEvaluationRunner?: VisionAgentEvaluationRunner;

  connectedCallback(): void {
    this.#initializeJudgeModel();
    this.#initializeRunners();
    this.#render();
  }

  #initializeJudgeModel(): void {
    try {
      const currentProvider = AIChatPanel.getCurrentProvider();
      const providerModels = AIChatPanel.getModelOptions(currentProvider);

      const savedJudgeModel = localStorage.getItem(JUDGE_MODEL_STORAGE_KEY);
      if (savedJudgeModel && providerModels.find(m => m.value === savedJudgeModel)) {
        this.#state.judgeModel = savedJudgeModel;
        return;
      }

      const modelPatterns = [
        { pattern: /^(.*\/)?gpt-4\.1-mini(-.*)?$/i },
        { pattern: /^(.*\/)?gpt-4\.1(-.*)?$/i },
        { pattern: /^(.*\/)?gpt-4(-.*)?$/i }
      ];

      for (const { pattern } of modelPatterns) {
        const foundModel = providerModels.find(model => pattern.test(model.value));
        if (foundModel) {
          this.#state.judgeModel = foundModel.value;
          localStorage.setItem(JUDGE_MODEL_STORAGE_KEY, this.#state.judgeModel);
          return;
        }
      }

      if (providerModels.length > 0) {
        this.#state.judgeModel = providerModels[0].value;
        localStorage.setItem(JUDGE_MODEL_STORAGE_KEY, this.#state.judgeModel);
      }
    } catch (error) {
      logger.error('Failed to initialize judge model:', error);
    }
  }

  #initializeRunners(): void {
    try {
      this.#evaluationRunner = new EvaluationRunner({
        judgeModel: this.#state.judgeModel,
        mainModel: AIChatPanel.instance().getSelectedModel(),
        miniModel: AIChatPanel.getMiniModel(),
        nanoModel: AIChatPanel.getNanoModel(),
      });
    } catch (error) {
      logger.error('Failed to initialize evaluation runner:', error);
    }

    try {
      this.#agentEvaluationRunner = new VisionAgentEvaluationRunner({
        visionEnabled: this.#state.visionEnabled,
        judgeModel: this.#state.judgeModel,
        mainModel: AIChatPanel.instance().getSelectedModel(),
        miniModel: AIChatPanel.getMiniModel(),
        nanoModel: AIChatPanel.getNanoModel(),
      });
    } catch (error) {
      logger.error('Failed to initialize agent evaluation runner:', error);
    }
  }

  #addLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    this.#state.testLogs.push(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    this.#render();
  }

  #getTests(): any[] {
    if (this.#state.activeTab === 'tool-tests') {
      const toolMapping = TOOL_TEST_MAPPING[this.#state.toolType];
      return toolMapping ? toolMapping.tests : [];
    } else {
      const agentMapping = AGENT_TEST_MAPPING[this.#state.agentType];
      return agentMapping ? agentMapping.tests : [];
    }
  }

  async #runSelectedTests(): Promise<void> {
    if (this.#state.selectedTests.size === 0) return;
    const testCases = this.#getTests();
    const selectedTestCases = testCases.filter((tc: any) => this.#state.selectedTests.has(tc.id));
    await this.#runTests(selectedTestCases);
  }

  async #runAllTests(): Promise<void> {
    const testCases = this.#getTests();
    await this.#runTests(testCases);
  }

  async #runTests(testCases: any[]): Promise<void> {
    if (this.#state.isRunning) return;

    this.#state.isRunning = true;
    this.#state.testResults.clear();
    this.#state.totalTests = testCases.length;
    this.#state.completedTests = 0;
    this.#state.startTime = Date.now();
    this.#state.testLogs = [];
    this.#render();

    this.#addLog(`Starting ${testCases.length} tests...`);

    for (const testCase of testCases) {
      this.#state.currentRunningTest = testCase.id;
      this.#render();

      this.#addLog(`Running: ${testCase.name}`);

      try {
        let result: TestResult;
        if (this.#state.activeTab === 'agents' && this.#agentEvaluationRunner) {
          result = await this.#agentEvaluationRunner.runSingleTest(testCase);
        } else if (this.#evaluationRunner) {
          result = await this.#evaluationRunner.runSingleTest(testCase);
        } else {
          throw new Error('No evaluation runner available');
        }

        this.#state.testResults.set(testCase.id, result);
        this.#addLog(
          `${testCase.name}: ${result.status.toUpperCase()}`,
          result.status === 'passed' ? 'success' : result.status === 'failed' ? 'warning' : 'error'
        );
      } catch (error) {
        const errorResult: TestResult = {
          testId: testCase.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
          timestamp: Date.now(),
        };
        this.#state.testResults.set(testCase.id, errorResult);
        this.#addLog(`${testCase.name}: ERROR - ${errorResult.error}`, 'error');
      }

      this.#state.completedTests++;
      this.#render();
    }

    this.#state.isRunning = false;
    this.#state.currentRunningTest = undefined;

    const results = Array.from(this.#state.testResults.values());
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const errors = results.filter(r => r.status === 'error').length;

    this.#addLog(`Tests completed: ${passed} passed, ${failed} failed, ${errors} errors`, 'info');
    this.#render();
  }

  #clearResults(): void {
    this.#state.testResults.clear();
    this.#state.testLogs = [];
    this.#state.completedTests = 0;
    this.#state.totalTests = 0;
    this.#render();
  }

  #toggleTestSelection(testId: string): void {
    if (this.#state.selectedTests.has(testId)) {
      this.#state.selectedTests.delete(testId);
    } else {
      this.#state.selectedTests.add(testId);
    }
    this.#render();
  }

  #render(): void {
    const testCases = this.#getTests();
    const results = Array.from(this.#state.testResults.values());
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const errors = results.filter(r => r.status === 'error').length;

    const progress = this.#state.totalTests > 0
      ? (this.#state.completedTests / this.#state.totalTests) * 100
      : 0;

    Lit.render(html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: white;
          overflow: hidden;
          align-self: stretch;
          box-sizing: border-box;
        }

        .eval-container {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          max-width: 100%;
          padding: 20px 16px;
          gap: 16px;
          overflow: hidden;
          font-size: 13px;
          box-sizing: border-box;
          flex: 1;
        }

        .header {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }

        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .title {
          font-size: 16px;
          font-weight: 600;
          color: var(--slate-800);
          text-align: left;
          margin: 0;
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: var(--slate-500);
        }

        .status-passed { color: #34a853; }
        .status-failed { color: #fbbc05; }
        .status-error { color: #ea4335; }

        .progress-bar {
          width: 100px;
          height: 4px;
          background: var(--slate-200);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--blue);
          transition: width 0.3s ease;
        }

        .tabs {
          display: flex;
          border-bottom: 1px solid var(--slate-200);
        }

        .tab {
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--slate-500);
          cursor: pointer;
          font-size: 13px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .tab:hover {
          color: var(--slate-700);
          background: #F7F9FC;
        }

        .tab.active {
          color: var(--blue);
          border-bottom-color: var(--blue);
          font-weight: 500;
        }

        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .selector {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .selector label {
          font-size: 12px;
          color: var(--slate-500);
        }

        .selector select {
          padding: 6px 10px;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          font-size: 12px;
          color: var(--slate-800);
          background: white;
          cursor: pointer;
          min-width: 200px;
          height: 32px;
        }

        .selector select:hover {
          border-color: var(--slate-300);
        }

        .selection-info {
          font-size: 12px;
          color: var(--slate-500);
        }

        .test-list {
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        .test-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--slate-100);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .test-item:last-child {
          border-bottom: none;
        }

        .test-item:hover {
          background: #F7F9FC;
        }

        .test-item.selected {
          background: rgba(16, 147, 244, 0.08);
          border-left: 3px solid var(--blue);
          padding-left: 13px;
        }

        .test-item.running {
          background: rgba(251, 188, 5, 0.08);
        }

        .test-item.passed {
          background: rgba(52, 168, 83, 0.08);
        }

        .test-item.failed {
          background: rgba(251, 188, 5, 0.08);
        }

        .test-item.error {
          background: rgba(234, 67, 53, 0.08);
        }

        .test-info {
          flex: 1;
          min-width: 0;
        }

        .test-name {
          font-weight: 500;
          font-size: 13px;
          color: var(--slate-800);
          margin-bottom: 2px;
        }

        .test-desc {
          font-size: 11px;
          color: var(--slate-500);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .test-status {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .test-status.running { background: #fbbc05; color: white; }
        .test-status.passed { background: #34a853; color: white; }
        .test-status.failed { background: #fbbc05; color: white; }
        .test-status.error { background: #ea4335; color: white; }

        .bottom-panel {
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          height: 140px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .bottom-tabs {
          display: flex;
          border-bottom: 1px solid var(--slate-200);
          background: var(--slate-50, #f8fafc);
        }

        .bottom-tab {
          padding: 6px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 11px;
          color: var(--slate-500);
          border-bottom: 2px solid transparent;
        }

        .bottom-tab:hover {
          color: var(--slate-700);
        }

        .bottom-tab.active {
          color: var(--blue);
          border-bottom-color: var(--blue);
          font-weight: 500;
        }

        .bottom-content {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          font-family: var(--monospace-font-family, monospace);
          font-size: 11px;
          color: var(--slate-600);
          white-space: pre-wrap;
        }

        .actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 8px;
        }

        .button {
          padding: 8px 16px;
          border: 1px solid var(--slate-200);
          border-radius: 6px;
          background: white;
          color: var(--slate-700);
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .button:hover:not(:disabled) {
          background: #F7F9FC;
          border-color: var(--slate-300);
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .button.primary {
          background: var(--blue);
          color: white;
          border-color: var(--blue);
        }

        .button.primary:hover:not(:disabled) {
          background: #0E82D9;
        }
      </style>

      <div class="eval-container">
        <div class="header">
          <div class="header-row">
            <h1 class="title">Evaluation Tests</h1>
            <div class="status-row">
              ${this.#state.isRunning ? html`
                <span>${this.#state.completedTests}/${this.#state.totalTests} tests</span>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
              ` : results.length > 0 ? html`
                <span class="status-passed">✓ ${passed}</span>
                <span class="status-failed">⚠ ${failed}</span>
                <span class="status-error">✗ ${errors}</span>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab ${this.#state.activeTab === 'tool-tests' ? 'active' : ''}"
            @click=${() => { this.#state.activeTab = 'tool-tests'; this.#state.testResults.clear(); this.#state.selectedTests.clear(); this.#render(); }}>
            Tool Tests
          </button>
          <button class="tab ${this.#state.activeTab === 'agents' ? 'active' : ''}"
            @click=${() => { this.#state.activeTab = 'agents'; this.#state.testResults.clear(); this.#state.selectedTests.clear(); this.#render(); }}>
            Agent Tests
          </button>
        </div>

        <div class="controls-row">
          <div class="selector">
            ${this.#state.activeTab === 'tool-tests' ? html`
              <label>Tool:</label>
              <select @change=${(e: Event) => { this.#state.toolType = (e.target as HTMLSelectElement).value; this.#state.testResults.clear(); this.#state.selectedTests.clear(); this.#render(); }}>
                ${Object.entries(TOOL_TEST_MAPPING).map(([key, val]) => html`
                  <option value=${key} ?selected=${this.#state.toolType === key}>${val.displayName}</option>
                `)}
              </select>
            ` : html`
              <label>Agent:</label>
              <select @change=${(e: Event) => { this.#state.agentType = (e.target as HTMLSelectElement).value; this.#state.testResults.clear(); this.#state.selectedTests.clear(); this.#render(); }}>
                ${Object.entries(AGENT_TEST_MAPPING).map(([key, val]) => html`
                  <option value=${key} ?selected=${this.#state.agentType === key}>${val.displayName}</option>
                `)}
              </select>
            `}
          </div>
          <span class="selection-info">
            ${this.#state.selectedTests.size > 0
              ? `${this.#state.selectedTests.size} tests selected`
              : 'Click tests to select'}
          </span>
        </div>

        <div class="test-list">
          ${testCases.map((tc: any) => {
            const result = this.#state.testResults.get(tc.id);
            const isRunning = this.#state.currentRunningTest === tc.id;
            const isSelected = this.#state.selectedTests.has(tc.id);
            let statusClass = '';
            if (isRunning) statusClass = 'running';
            else if (result?.status === 'passed') statusClass = 'passed';
            else if (result?.status === 'failed') statusClass = 'failed';
            else if (result?.status === 'error') statusClass = 'error';

            return html`
              <div class="test-item ${statusClass} ${isSelected ? 'selected' : ''}"
                @click=${() => this.#toggleTestSelection(tc.id)}>
                <div class="test-info">
                  <div class="test-name">${tc.name}</div>
                  <div class="test-desc">${tc.description}</div>
                </div>
                ${result || isRunning ? html`
                  <span class="test-status ${isRunning ? 'running' : result?.status}">
                    ${isRunning ? 'Running' : result?.status}
                  </span>
                ` : ''}
              </div>
            `;
          })}
        </div>

        <div class="bottom-panel">
          <div class="bottom-tabs">
            <button class="bottom-tab ${this.#state.bottomPanelView === 'summary' ? 'active' : ''}"
              @click=${() => { this.#state.bottomPanelView = 'summary'; this.#render(); }}>
              Summary
            </button>
            <button class="bottom-tab ${this.#state.bottomPanelView === 'logs' ? 'active' : ''}"
              @click=${() => { this.#state.bottomPanelView = 'logs'; this.#render(); }}>
              Logs
            </button>
          </div>
          <div class="bottom-content">
            ${this.#state.bottomPanelView === 'summary' ? html`
              <div>Total: ${testCases.length} | Passed: ${passed} | Failed: ${failed} | Errors: ${errors}</div>
              ${results.length > 0 ? html`
                <div>Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%</div>
              ` : ''}
            ` : html`
              ${this.#state.testLogs.length === 0
                ? 'No logs yet. Run tests to see logs.'
                : this.#state.testLogs.join('\n')}
            `}
          </div>
        </div>

        <div class="actions-row">
          <button class="button" @click=${() => this.#clearResults()} ?disabled=${this.#state.isRunning}>
            Clear Results
          </button>
          ${this.#state.selectedTests.size > 0 ? html`
            <button class="button" @click=${() => { this.#state.selectedTests.clear(); this.#render(); }} ?disabled=${this.#state.isRunning}>
              Clear Selection
            </button>
            <button class="button primary" @click=${() => this.#runSelectedTests()} ?disabled=${this.#state.isRunning}>
              Run Selected (${this.#state.selectedTests.size})
            </button>
          ` : html`
            <button class="button primary" @click=${() => this.#runAllTests()} ?disabled=${this.#state.isRunning}>
              Run All Tests
            </button>
          `}
        </div>
      </div>
    `, this, {host: this});
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-evaluations-view': EvaluationsView; }
}
