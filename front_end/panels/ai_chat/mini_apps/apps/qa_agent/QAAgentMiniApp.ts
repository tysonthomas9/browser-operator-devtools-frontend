// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../../core/Logger.js';
import { TestStorageManager } from '../../../core/TestStorageManager.js';
import { TestExecutor } from './TestExecutor.js';
import { LLMConfigurationManager } from '../../../core/LLMConfigurationManager.js';
import { ConfigurableAgentTool, ToolRegistry, type CallCtx } from '../../../agent_framework/ConfigurableAgentTool.js';
import { createQATestGeneratorAgentConfig } from '../../../agent_framework/implementation/agents/QATestGeneratorAgent.js';
import type {
  MiniApp,
  MiniAppSPA,
  MiniAppController,
  MiniAppBridge,
  MiniAppState,
  MiniAppActionSchema,
  MiniAppStateSchema,
  SPAToDevToolsAction,
} from '../../types/MiniAppTypes.js';
import { MiniAppEventBus } from '../../MiniAppEventBus.js';
import { QAAgentSPA } from '../../../ui/qa_agent/QAAgentSPA.js';
import type {
  StoredTestCase,
  StoredTestSuite,
  StoredTestRun,
  TestCaseInfo,
  TestSuiteInfo,
  TestCaseFormData,
  TestSuiteFormData,
  TestStep,
  QAAgentState,
} from './types.js';

const logger = createLogger('QAAgentMiniApp');

/**
 * QAAgentMiniApp - Mini app for creating and running E2E UI tests
 *
 * This mini app allows users to:
 * - Create test cases using natural language descriptions
 * - Generate executable CDP-based test steps from descriptions
 * - Run tests directly in the browser using DevTools APIs
 * - Organize tests into suites
 * - View test execution results
 */
export class QAAgentMiniApp implements MiniApp {
  id = 'qa_agent';
  name = 'QA Agent';
  description = 'Create and run E2E UI tests using natural language descriptions. Generate test steps from plain English, then execute them repeatedly using CDP APIs for consistent, deterministic results.';
  icon = '🧪';

  routes = [
    { name: 'list', pattern: '#qa-agent' },
    { name: 'test', pattern: '#qa-agent/test/:id' },
    { name: 'new', pattern: '#qa-agent/new' },
    { name: 'suite', pattern: '#qa-agent/suite/:id' },
    { name: 'new-suite', pattern: '#qa-agent/new-suite' },
    { name: 'run', pattern: '#qa-agent/run/:id' },
  ];

  getSPA(): MiniAppSPA {
    return {
      html: QAAgentSPA.html,
      css: QAAgentSPA.css,
      js: QAAgentSPA.js,
    };
  }

  getSupportedActions(): MiniAppActionSchema[] {
    return [
      {
        name: 'list-tests',
        description: 'Get a list of all test cases',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create-test',
        description: 'Create a new test case from natural language description',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Test case name' },
            description: { type: 'string', description: 'Natural language description of the test' },
            url: { type: 'string', description: 'Starting URL for the test' },
          },
          required: ['name', 'description', 'url'],
        },
      },
      {
        name: 'generate-steps',
        description: 'Generate executable test steps from a test case description',
        schema: {
          type: 'object',
          properties: {
            testId: { type: 'string', description: 'ID of the test case to generate steps for' },
          },
          required: ['testId'],
        },
      },
      {
        name: 'run-test',
        description: 'Execute a test case and return results',
        schema: {
          type: 'object',
          properties: {
            testId: { type: 'string', description: 'ID of the test case to run' },
          },
          required: ['testId'],
        },
      },
      {
        name: 'run-suite',
        description: 'Execute all tests in a suite',
        schema: {
          type: 'object',
          properties: {
            suiteId: { type: 'string', description: 'ID of the test suite to run' },
          },
          required: ['suiteId'],
        },
      },
      {
        name: 'get-results',
        description: 'Get results from a test run',
        schema: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'ID of the test run' },
          },
          required: ['runId'],
        },
      },
      {
        name: 'delete-test',
        description: 'Delete a test case',
        schema: {
          type: 'object',
          properties: {
            testId: { type: 'string', description: 'ID of the test case to delete' },
          },
          required: ['testId'],
        },
      },
      {
        name: 'list-suites',
        description: 'Get a list of all test suites',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create-suite',
        description: 'Create a new test suite',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Suite name' },
            description: { type: 'string', description: 'Suite description' },
            testCaseIds: { type: 'array', description: 'Array of test case IDs to include' },
          },
          required: ['name'],
        },
      },
    ];
  }

  getStateSchema(): MiniAppStateSchema {
    return {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          description: 'Current view: list, test, suite, or run',
        },
        activeTab: {
          type: 'string',
          description: 'Active tab: tests or suites',
        },
        testCases: {
          type: 'array',
          description: 'List of all test cases',
        },
        testSuites: {
          type: 'array',
          description: 'List of all test suites',
        },
        selectedTest: {
          type: 'object',
          description: 'Currently selected test case or null',
        },
        selectedSuite: {
          type: 'object',
          description: 'Currently selected test suite or null',
        },
        currentRun: {
          type: 'object',
          description: 'Current test run or null',
        },
        isGeneratingSteps: {
          type: 'boolean',
          description: 'Whether steps are being generated',
        },
        isRunningTest: {
          type: 'boolean',
          description: 'Whether a test is currently running',
        },
      },
    };
  }

  createController(): MiniAppController {
    return new QAAgentMiniAppController();
  }
}

/**
 * Controller for QA Agent mini app
 */
class QAAgentMiniAppController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private closeCallback: (() => void | Promise<void>) | null = null;
  private storageManager: TestStorageManager;

  // State
  private selectedTestId: string | null = null;
  private selectedSuiteId: string | null = null;
  private activeTab: 'tests' | 'suites' = 'tests';
  private isGeneratingSteps = false;
  private isRunningTest = false;
  private currentRun: StoredTestRun | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    this.storageManager = TestStorageManager.getInstance();
  }

  async initialize(bridge: MiniAppBridge): Promise<void> {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
    logger.info('QAAgentMiniAppController initialized');
  }

  async cleanup(): Promise<void> {
    // Abort any running test
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.bridge = null;
    this.selectedTestId = null;
    this.selectedSuiteId = null;
    this.activeTab = 'tests';
    this.isGeneratingSteps = false;
    this.isRunningTest = false;
    this.currentRun = null;
    logger.info('QAAgentMiniAppController cleaned up');
  }

  onClose(callback: () => void | Promise<void>): void {
    this.closeCallback = callback;
  }

  async getState(): Promise<MiniAppState> {
    const { testCases, testSuites } = await this.loadAllData();

    let selectedTest: StoredTestCase | null = null;
    if (this.selectedTestId) {
      selectedTest = await this.storageManager.getTestCase(this.selectedTestId);
    }

    let selectedSuite: StoredTestSuite | null = null;
    if (this.selectedSuiteId) {
      selectedSuite = await this.storageManager.getTestSuite(this.selectedSuiteId);
    }

    return {
      view: this.selectedTestId ? 'test' : this.selectedSuiteId ? 'suite' : 'list',
      activeTab: this.activeTab,
      testCases,
      testSuites,
      selectedTest,
      selectedSuite,
      currentRun: this.currentRun,
      isGeneratingSteps: this.isGeneratingSteps,
      isRunningTest: this.isRunningTest,
    } as QAAgentState;
  }

  async setState(state: MiniAppState): Promise<void> {
    if (state.activeTab) {
      this.activeTab = state.activeTab as 'tests' | 'suites';
    }
    if (state.selectedTestId !== undefined) {
      this.selectedTestId = state.selectedTestId as string | null;
    }
    if (state.selectedSuiteId !== undefined) {
      this.selectedSuiteId = state.selectedSuiteId as string | null;
    }
  }

  async updateState(updates: Partial<MiniAppState>): Promise<void> {
    await this.setState(updates);
  }

  async executeAction(actionName: string, args: unknown): Promise<unknown> {
    const argsObj = args as Record<string, unknown>;

    switch (actionName) {
      case 'list-tests':
        return this.handleListTestsAction();

      case 'create-test':
        return this.handleCreateTestAction(argsObj as { name: string; description: string; url: string });

      case 'generate-steps':
        return this.handleGenerateStepsAction(argsObj.testId as string);

      case 'run-test':
        return this.handleRunTestAction(argsObj.testId as string);

      case 'run-suite':
        return this.handleRunSuiteAction(argsObj.suiteId as string);

      case 'get-results':
        return this.handleGetResultsAction(argsObj.runId as string);

      case 'delete-test':
        return this.handleDeleteTestAction(argsObj.testId as string);

      case 'list-suites':
        return this.handleListSuitesAction();

      case 'create-suite':
        return this.handleCreateSuiteAction(argsObj as { name: string; description?: string; testCaseIds?: string[] });

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  // ============================================================================
  // SPA Action Handlers (from the SPA via bridge)
  // ============================================================================

  async handleAction(action: SPAToDevToolsAction): Promise<void> {
    logger.info('Handling SPA action:', action.type);

    switch (action.type) {
      case 'ready':
        await this.pushInitialState();
        break;

      case 'select-tab': {
        const tabAction = action as SPAToDevToolsAction & { tab: 'tests' | 'suites' };
        this.activeTab = tabAction.tab;
        break;
      }

      case 'select-test': {
        const selectAction = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectTest(selectAction.id);
        break;
      }

      case 'select-test-by-id': {
        const selectAction = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectTest(selectAction.id);
        break;
      }

      case 'new-test':
        await this.handleNewTest();
        break;

      case 'save-test': {
        const saveAction = action as SPAToDevToolsAction & { data: TestCaseFormData };
        await this.handleSaveTest(saveAction.data);
        break;
      }

      case 'delete-test':
        await this.handleDeleteTest();
        break;

      case 'generate-steps': {
        const genAction = action as SPAToDevToolsAction & { data?: TestCaseFormData };
        await this.handleGenerateSteps(genAction.data);
        break;
      }

      case 'run-test':
        await this.handleRunTest();
        break;

      case 'abort-test':
        await this.handleAbortTest();
        break;

      case 'select-suite': {
        const selectAction = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectSuite(selectAction.id);
        break;
      }

      case 'select-suite-by-id': {
        const selectAction = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectSuite(selectAction.id);
        break;
      }

      case 'new-suite':
        await this.handleNewSuite();
        break;

      case 'save-suite': {
        const saveAction = action as SPAToDevToolsAction & { data: TestSuiteFormData };
        await this.handleSaveSuite(saveAction.data);
        break;
      }

      case 'delete-suite':
        await this.handleDeleteSuite();
        break;

      case 'run-suite':
        await this.handleRunSuite();
        break;

      case 'add-to-suite': {
        const addAction = action as SPAToDevToolsAction & { testId: string; suiteId: string };
        await this.handleAddToSuite(addAction.testId, addAction.suiteId);
        break;
      }

      case 'remove-from-suite': {
        const removeAction = action as SPAToDevToolsAction & { testId: string; suiteId: string };
        await this.handleRemoveFromSuite(removeAction.testId, removeAction.suiteId);
        break;
      }

      case 'close':
        if (this.closeCallback) {
          await this.closeCallback();
        }
        break;

      case 'state-changed':
        MiniAppEventBus.getInstance().emitStateChanged('qa_agent', action.payload);
        break;

      default:
        logger.warn('Unknown SPA action type:', action.type);
    }
  }

  // ============================================================================
  // Action Implementations (for executeAction)
  // ============================================================================

  private async handleListTestsAction(): Promise<{ testCases: TestCaseInfo[] }> {
    const { testCases } = await this.loadAllData();
    return { testCases };
  }

  private async handleCreateTestAction(
    input: { name: string; description: string; url: string }
  ): Promise<{ success: boolean; testCase?: StoredTestCase; error?: string }> {
    try {
      const testCase = await this.storageManager.createTestCase({
        name: input.name,
        description: input.description,
        url: input.url,
        steps: [],
      });
      return { success: true, testCase };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleGenerateStepsAction(
    testId: string
  ): Promise<{ success: boolean; steps?: TestStep[]; error?: string }> {
    // TODO: Implement step generation using QATestGeneratorAgent
    // For now, return a placeholder
    return {
      success: false,
      error: 'Step generation not yet implemented. Please add steps manually.',
    };
  }

  private async handleRunTestAction(
    testId: string
  ): Promise<{ success: boolean; run?: StoredTestRun; error?: string }> {
    // TODO: Implement test execution using TestExecutor
    // For now, return a placeholder
    return {
      success: false,
      error: 'Test execution not yet implemented.',
    };
  }

  private async handleRunSuiteAction(
    suiteId: string
  ): Promise<{ success: boolean; runs?: StoredTestRun[]; error?: string }> {
    // TODO: Implement suite execution
    return {
      success: false,
      error: 'Suite execution not yet implemented.',
    };
  }

  private async handleGetResultsAction(
    runId: string
  ): Promise<{ success: boolean; run?: StoredTestRun; error?: string }> {
    try {
      const run = await this.storageManager.getTestRun(runId);
      if (!run) {
        return { success: false, error: `Test run with ID "${runId}" not found.` };
      }
      return { success: true, run };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleDeleteTestAction(
    testId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.storageManager.deleteTestCase(testId);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleListSuitesAction(): Promise<{ testSuites: TestSuiteInfo[] }> {
    const { testSuites } = await this.loadAllData();
    return { testSuites };
  }

  private async handleCreateSuiteAction(
    input: { name: string; description?: string; testCaseIds?: string[] }
  ): Promise<{ success: boolean; testSuite?: StoredTestSuite; error?: string }> {
    try {
      const testSuite = await this.storageManager.createTestSuite({
        name: input.name,
        description: input.description || '',
        testCaseIds: input.testCaseIds,
      });
      return { success: true, testSuite };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  // ============================================================================
  // SPA-Triggered Handlers
  // ============================================================================

  private async pushInitialState(): Promise<void> {
    const { testCases, testSuites } = await this.loadAllData();

    await this.bridge?.sendToSPA({
      action: 'init',
      payload: {
        testCases,
        testSuites,
        selectedTest: null,
        selectedSuite: null,
        activeTab: this.activeTab,
      },
    });

    logger.info('Initial state pushed to SPA');
  }

  private async handleSelectTest(id: string): Promise<void> {
    this.selectedTestId = id;
    this.selectedSuiteId = null;

    const testCase = await this.storageManager.getTestCase(id);
    if (testCase) {
      // Get recent runs for this test
      const runs = await this.storageManager.getTestRunsForTestCase(id, 5);

      await this.bridge?.sendToSPA({
        action: 'test-selected',
        payload: { testCase, runs },
      });
    } else {
      logger.warn(`Test case not found: ${id}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test case not found', type: 'error' },
      });
      this.selectedTestId = null;
    }
  }

  private async handleNewTest(): Promise<void> {
    this.selectedTestId = null;
    this.selectedSuiteId = null;

    await this.bridge?.sendToSPA({
      action: 'test-selected',
      payload: { testCase: this.createEmptyTest(), runs: [], isNew: true },
    });
  }

  private async handleSaveTest(data: TestCaseFormData): Promise<void> {
    try {
      let testCase: StoredTestCase;

      if (this.selectedTestId) {
        // Update existing test
        testCase = await this.storageManager.updateTestCase(this.selectedTestId, {
          name: data.name,
          description: data.description,
          url: data.url,
          steps: data.steps,
        });
      } else {
        // Create new test
        testCase = await this.storageManager.createTestCase({
          name: data.name,
          description: data.description,
          url: data.url,
          steps: data.steps,
        });
        this.selectedTestId = testCase.id;
      }

      // Refresh the list
      const { testCases } = await this.loadAllData();

      await this.bridge?.sendToSPA({
        action: 'test-saved',
        payload: { testCase, testCases },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test case saved successfully!', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    }
  }

  private async handleDeleteTest(): Promise<void> {
    if (!this.selectedTestId) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'No test case selected', type: 'error' },
      });
      return;
    }

    try {
      await this.storageManager.deleteTestCase(this.selectedTestId);
      this.selectedTestId = null;

      const { testCases } = await this.loadAllData();

      await this.bridge?.sendToSPA({
        action: 'tests-updated',
        payload: { testCases },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test case deleted successfully!', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    }
  }

  private async handleGenerateSteps(formData?: TestCaseFormData): Promise<void> {
    // If no test selected but we have form data, auto-save first
    if (!this.selectedTestId && formData && formData.name && formData.url) {
      try {
        const testCase = await this.storageManager.createTestCase({
          name: formData.name,
          description: formData.description,
          url: formData.url,
          steps: [],
        });
        this.selectedTestId = testCase.id;

        // Notify SPA that test was auto-saved
        const { testCases } = await this.loadAllData();
        await this.bridge?.sendToSPA({
          action: 'test-saved',
          payload: { testCase, testCases },
        });

        logger.info(`Auto-saved new test case: ${testCase.id}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await this.bridge?.sendToSPA({
          action: 'notification',
          payload: { message: `Failed to save test: ${errorMsg}`, type: 'error' },
        });
        return;
      }
    }

    if (!this.selectedTestId) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Please enter test name and URL first', type: 'error' },
      });
      return;
    }

    this.isGeneratingSteps = true;
    await this.bridge?.sendToSPA({
      action: 'generating-steps',
      payload: { isGenerating: true },
    });

    try {
      // Get the test case to generate steps for
      const testCase = await this.storageManager.getTestCase(this.selectedTestId);
      if (!testCase) {
        throw new Error('Test case not found');
      }

      // Get LLM configuration
      const llmConfig = LLMConfigurationManager.getInstance().getConfiguration();
      if (!llmConfig.apiKey) {
        throw new Error('No API key configured. Please configure your LLM settings first.');
      }

      // Create the agent
      const agentConfig = createQATestGeneratorAgentConfig();
      const agent = new ConfigurableAgentTool(agentConfig);

      // Build execution context
      const callCtx: CallCtx = {
        apiKey: llmConfig.apiKey,
        provider: llmConfig.provider,
        mainModel: llmConfig.mainModel,
        miniModel: llmConfig.miniModel,
      };

      logger.info('Starting step generation for test case:', testCase.name);

      // Send progress update
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Analyzing page and generating test steps...', type: 'info' },
      });

      // Execute the agent to generate steps
      // Note: ConfigurableAgentArgs requires query and reasoning, plus custom properties
      const result = await agent.execute(
        {
          query: testCase.description,
          reasoning: `Generate test steps for: ${testCase.name}`,
          testDescription: testCase.description,
          startingUrl: testCase.url,
          additionalContext: `Test name: ${testCase.name}`,
        },
        callCtx
      );

      if (!result.success) {
        throw new Error(result.error || 'Step generation failed');
      }

      // Parse the generated steps from the output
      const steps = this.parseGeneratedSteps(result.output || '');

      if (steps.length === 0) {
        throw new Error('No valid steps were generated. Please try again with a more detailed description.');
      }

      // Update the test case with the generated steps
      const updatedTestCase = await this.storageManager.updateTestCase(testCase.id, {
        steps,
        updatedAt: new Date().toISOString(),
      });

      logger.info(`Generated ${steps.length} steps for test case: ${testCase.name}`);

      // Refresh test case list
      const { testCases } = await this.loadAllData();

      // Send the generated steps to the SPA
      await this.bridge?.sendToSPA({
        action: 'steps-generated',
        payload: {
          testCase: updatedTestCase,
          testCases,
          steps,
        },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: `Successfully generated ${steps.length} test steps!`, type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Step generation failed:', error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: `Step generation failed: ${errorMsg}`, type: 'error' },
      });
    } finally {
      this.isGeneratingSteps = false;
      await this.bridge?.sendToSPA({
        action: 'generating-steps',
        payload: { isGenerating: false },
      });
    }
  }

  /**
   * Parse generated steps from the agent output
   *
   * The agent outputs a JSON array of test steps.
   * This function extracts and validates the steps.
   */
  private parseGeneratedSteps(output: string): TestStep[] {
    try {
      // Try to find JSON array in the output
      let jsonStr = output;

      // Look for JSON array in markdown code block
      const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // Try to find raw JSON array
        const jsonMatch = output.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      // Parse the JSON
      const parsed = JSON.parse(jsonStr);

      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        logger.error('Generated output is not an array:', typeof parsed);
        return [];
      }

      // Validate and clean up each step
      const validSteps: TestStep[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const step = parsed[i];

        // Validate required fields
        if (!step.type || !step.description || !step.cdpCommand) {
          logger.warn(`Skipping invalid step ${i + 1}: missing required fields`);
          continue;
        }

        // Ensure step has an id
        const validStep: TestStep = {
          id: step.id || `step-${i + 1}`,
          type: step.type,
          description: step.description,
          cdpCommand: step.cdpCommand,
          timeout: step.timeout,
        };

        validSteps.push(validStep);
      }

      return validSteps;
    } catch (error) {
      logger.error('Failed to parse generated steps:', error);
      logger.debug('Raw output:', output);
      return [];
    }
  }

  private async handleRunTest(): Promise<void> {
    if (!this.selectedTestId) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'No test case selected', type: 'error' },
      });
      return;
    }

    const testCase = await this.storageManager.getTestCase(this.selectedTestId);
    if (!testCase) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test case not found', type: 'error' },
      });
      return;
    }

    if (testCase.steps.length === 0) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test case has no steps. Generate steps first.', type: 'warning' },
      });
      return;
    }

    this.isRunningTest = true;
    this.abortController = new AbortController();

    // Create a new run
    let run: StoredTestRun = {
      id: crypto.randomUUID(),
      testCaseId: testCase.id,
      status: 'running',
      startTime: new Date().toISOString(),
      results: [],
    };

    this.currentRun = run;
    await this.storageManager.recordTestRun(run);

    await this.bridge?.sendToSPA({
      action: 'test-running',
      payload: { run, testCase },
    });

    try {
      // Create the test executor
      const executor = new TestExecutor();

      // Execute the test with progress callbacks
      const updatedRun = await executor.executeTestCase(testCase, {
        abortSignal: this.abortController?.signal,
        onStepComplete: async (stepResult, currentStep, totalSteps) => {
          // Accumulate results in run object
          run.results.push(stepResult);

          // Send progress update to SPA with data it expects
          await this.bridge?.sendToSPA({
            action: 'test-progress',
            payload: {
              results: run.results,
              testCase,
              stepResult,
              currentStep,
              totalSteps,
            },
          });
        },
        onStatusChange: async (status) => {
          run.status = status;
          await this.storageManager.updateTestRun(run.id, run);
        },
      });

      // Update run with results from executor
      run = updatedRun;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      run.status = 'failed';
      run.endTime = new Date().toISOString();
      await this.storageManager.updateTestRun(run.id, run);

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    } finally {
      this.isRunningTest = false;
      this.abortController = null;
      this.currentRun = null;

      await this.bridge?.sendToSPA({
        action: 'test-completed',
        payload: { run },
      });
    }
  }

  private async handleAbortTest(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();

      if (this.currentRun) {
        this.currentRun.status = 'aborted';
        this.currentRun.endTime = new Date().toISOString();
        await this.storageManager.updateTestRun(this.currentRun.id, this.currentRun);

        await this.bridge?.sendToSPA({
          action: 'test-completed',
          payload: { run: this.currentRun },
        });
      }

      this.isRunningTest = false;
      this.abortController = null;
      this.currentRun = null;

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test aborted', type: 'warning' },
      });
    }
  }

  private async handleSelectSuite(id: string): Promise<void> {
    this.selectedSuiteId = id;
    this.selectedTestId = null;

    const testSuite = await this.storageManager.getTestSuite(id);
    if (testSuite) {
      // Get the test cases in the suite
      const testCases: StoredTestCase[] = [];
      for (const testCaseId of testSuite.testCaseIds) {
        const testCase = await this.storageManager.getTestCase(testCaseId);
        if (testCase) {
          testCases.push(testCase);
        }
      }

      // Get recent runs for this suite
      const runs = await this.storageManager.getTestRunsForSuite(id, 5);

      await this.bridge?.sendToSPA({
        action: 'suite-selected',
        payload: { testSuite, testCases, runs },
      });
    } else {
      logger.warn(`Test suite not found: ${id}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test suite not found', type: 'error' },
      });
      this.selectedSuiteId = null;
    }
  }

  private async handleNewSuite(): Promise<void> {
    this.selectedSuiteId = null;
    this.selectedTestId = null;

    await this.bridge?.sendToSPA({
      action: 'suite-selected',
      payload: { testSuite: this.createEmptySuite(), testCases: [], runs: [], isNew: true },
    });
  }

  private async handleSaveSuite(data: TestSuiteFormData): Promise<void> {
    try {
      let testSuite: StoredTestSuite;

      if (this.selectedSuiteId) {
        // Update existing suite
        testSuite = await this.storageManager.updateTestSuite(this.selectedSuiteId, {
          name: data.name,
          description: data.description,
          testCaseIds: data.testCaseIds,
        });
      } else {
        // Create new suite
        testSuite = await this.storageManager.createTestSuite({
          name: data.name,
          description: data.description,
          testCaseIds: data.testCaseIds,
        });
        this.selectedSuiteId = testSuite.id;
      }

      // Refresh the list
      const { testSuites } = await this.loadAllData();

      await this.bridge?.sendToSPA({
        action: 'suite-saved',
        payload: { testSuite, testSuites },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test suite saved successfully!', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    }
  }

  private async handleDeleteSuite(): Promise<void> {
    if (!this.selectedSuiteId) {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'No test suite selected', type: 'error' },
      });
      return;
    }

    try {
      await this.storageManager.deleteTestSuite(this.selectedSuiteId);
      this.selectedSuiteId = null;

      const { testSuites } = await this.loadAllData();

      await this.bridge?.sendToSPA({
        action: 'suites-updated',
        payload: { testSuites },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test suite deleted successfully!', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    }
  }

  private async handleRunSuite(): Promise<void> {
    // TODO: Implement suite execution
    await this.bridge?.sendToSPA({
      action: 'notification',
      payload: { message: 'Suite execution will be implemented soon!', type: 'info' },
    });
  }

  private async handleAddToSuite(testId: string, suiteId: string): Promise<void> {
    try {
      const testSuite = await this.storageManager.addTestCaseToSuite(suiteId, testId);
      const { testSuites } = await this.loadAllData();

      await this.bridge?.sendToSPA({
        action: 'suites-updated',
        payload: { testSuites },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test added to suite', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    }
  }

  private async handleRemoveFromSuite(testId: string, suiteId: string): Promise<void> {
    try {
      const testSuite = await this.storageManager.removeTestCaseFromSuite(suiteId, testId);
      const { testSuites } = await this.loadAllData();

      await this.bridge?.sendToSPA({
        action: 'suites-updated',
        payload: { testSuites },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Test removed from suite', type: 'success' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: errorMsg, type: 'error' },
      });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async loadAllData(): Promise<{
    testCases: TestCaseInfo[];
    testSuites: TestSuiteInfo[];
  }> {
    const allTestCases = await this.storageManager.getAllTestCases();
    const allTestSuites = await this.storageManager.getAllTestSuites();

    // Get last run status for each test case
    const testCases: TestCaseInfo[] = await Promise.all(
      allTestCases.map(async tc => {
        const runs = await this.storageManager.getTestRunsForTestCase(tc.id, 1);
        const lastRun = runs[0];
        return {
          id: tc.id,
          name: tc.name,
          description: tc.description,
          url: tc.url,
          stepCount: tc.steps.length,
          lastRunStatus: lastRun?.status,
          lastRunTime: lastRun?.startTime,
          createdAt: tc.createdAt,
          updatedAt: tc.updatedAt,
        };
      })
    );

    // Get last run status for each test suite
    const testSuites: TestSuiteInfo[] = await Promise.all(
      allTestSuites.map(async ts => {
        const runs = await this.storageManager.getTestRunsForSuite(ts.id, 1);
        const lastRun = runs[0];
        return {
          id: ts.id,
          name: ts.name,
          description: ts.description,
          testCount: ts.testCaseIds.length,
          lastRunStatus: lastRun?.status,
          lastRunTime: lastRun?.startTime,
          createdAt: ts.createdAt,
          updatedAt: ts.updatedAt,
        };
      })
    );

    return { testCases, testSuites };
  }

  private createEmptyTest(): Partial<StoredTestCase> {
    return {
      name: '',
      description: '',
      url: '',
      steps: [],
    };
  }

  private createEmptySuite(): Partial<StoredTestSuite> {
    return {
      name: '',
      description: '',
      testCaseIds: [],
    };
  }
}
