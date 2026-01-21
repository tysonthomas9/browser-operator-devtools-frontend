/**
 * LLM Judge - Evaluates test results using LLM
 *
 * Uses an LLM to judge whether agent actions succeeded
 * based on defined criteria and visual evidence.
 */

import {
  getProviderConfig,
  type TestCase,
  type CriteriaResult,
  type LLMProvider,
  type RubricConfig,
  type RubricScore,
  type DimensionalEvaluationResult,
  type FailureCategory,
  type ExecutionData,
} from './types.ts';
import fs from 'fs';
import path from 'path';

interface JudgeConfig {
  provider: 'openai' | 'anthropic' | 'litellm' | 'cerebras';
  model: string;
  apiKey?: string;
}

interface EvaluationResult {
  passed: boolean;
  score: number;
  explanation: string;
  criteria: CriteriaResult[];
}

/**
 * LLMJudge evaluates test outcomes using LLM
 */
export class LLMJudge {
  private config: JudgeConfig;
  private client: any = null;

  constructor(config: JudgeConfig) {
    this.config = config;
  }

  /**
   * Initialize the LLM client
   */
  async init(): Promise<void> {
    const { apiKey, baseURL } = getProviderConfig(
      this.config.provider as LLMProvider,
      this.config.apiKey
    );

    if (!apiKey) {
      throw new Error(`No API key for ${this.config.provider}. Set environment variable or use --api-key`);
    }

    if (this.config.provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      this.client = new Anthropic({ apiKey });
    } else {
      // OpenAI, Cerebras, LiteLLM all use OpenAI-compatible API
      const OpenAI = (await import('openai')).default;
      // Note: dangerouslyAllowBrowser is needed because BrowserGlobals shims make Node.js look like browser
      this.client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
    }
  }

  /**
   * Evaluate a test result
   */
  async evaluate(
    testCase: TestCase,
    agentResult: unknown,
    screenshots: { beforeScreenshot?: string; afterScreenshot?: string }
  ): Promise<EvaluationResult> {
    // Check if client is initialized
    if (!this.client) {
      throw new Error(`LLM Judge not initialized. Set ${this.config.provider === 'openai' ? 'OPENAI_API_KEY' : this.config.provider.toUpperCase() + '_API_KEY'} environment variable.`);
    }

    const criteria = testCase.validation.llmJudge?.criteria || [];

    if (criteria.length === 0) {
      // No criteria defined, check for errors
      const hasError = agentResult && typeof agentResult === 'object' && 'error' in agentResult;
      return {
        passed: !hasError,
        score: hasError ? 0 : 1,
        explanation: hasError ? 'Agent returned an error' : 'Agent completed without errors',
        criteria: [],
      };
    }

    // Build evaluation prompt
    const prompt = this.buildEvaluationPrompt(testCase, agentResult, criteria);

    // Include screenshots if available
    const messages = await this.buildMessages(prompt, screenshots);

    // Call LLM for evaluation
    const response = await this.callLLM(messages);

    // Parse response
    return this.parseResponse(response, criteria);
  }

  /**
   * Build the evaluation prompt
   */
  private buildEvaluationPrompt(
    testCase: TestCase,
    agentResult: unknown,
    criteria: string[]
  ): string {
    return `You are an evaluation judge for web automation agents. Your task is to evaluate whether the agent successfully completed its objective.

## Test Information
- **Test Name**: ${testCase.name}
- **Description**: ${testCase.description}
- **URL**: ${testCase.url}
- **Objective**: ${JSON.stringify(testCase.input)}

## Agent Result
\`\`\`json
${JSON.stringify(agentResult, null, 2)}
\`\`\`

## Evaluation Criteria
Evaluate each of the following criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Instructions
1. Analyze the agent's result and any visual evidence (screenshots if provided)
2. For each criterion, determine if it was met (true/false) and provide a brief explanation
3. Calculate an overall score (0-1) based on how many criteria were met (passed criteria / total criteria)
4. IMPORTANT: Set passed=true ONLY if ALL criteria passed. If ANY criterion failed, set passed=false.
   The score and passed fields must be consistent: score=1.0 means passed=true, score<1.0 means passed=false.

Respond in JSON format:
{
  "passed": true|false,
  "score": 0.0-1.0,
  "explanation": "Brief overall assessment",
  "criteria": [
    {
      "criterion": "criterion text",
      "passed": true|false,
      "explanation": "why this criterion passed or failed"
    }
  ]
}`;
  }

  /**
   * Format image content based on provider
   * Anthropic uses a different format than OpenAI-compatible APIs
   */
  private formatImageContent(base64Data: string): object {
    if (this.config.provider === 'anthropic') {
      return {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: base64Data },
      };
    }
    // OpenAI/Cerebras/LiteLLM format
    return {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${base64Data}` },
    };
  }

  /**
   * Build messages with optional image content
   */
  private async buildMessages(
    prompt: string,
    screenshots: { beforeScreenshot?: string; afterScreenshot?: string }
  ): Promise<any[]> {
    const content: any[] = [{ type: 'text', text: prompt }];

    // Add screenshots if visual verification is enabled
    if (screenshots.beforeScreenshot && fs.existsSync(screenshots.beforeScreenshot)) {
      const imageData = fs.readFileSync(screenshots.beforeScreenshot).toString('base64');
      content.push({
        type: 'text',
        text: '\n\n## Before Screenshot (state before action):',
      });
      content.push(this.formatImageContent(imageData));
    }

    if (screenshots.afterScreenshot && fs.existsSync(screenshots.afterScreenshot)) {
      const imageData = fs.readFileSync(screenshots.afterScreenshot).toString('base64');
      content.push({
        type: 'text',
        text: '\n\n## After Screenshot (state after action):',
      });
      content.push(this.formatImageContent(imageData));
    }

    return [{ role: 'user', content }];
  }

  /**
   * Call the LLM for evaluation
   */
  private async callLLM(messages: any[]): Promise<string> {
    if (this.config.provider === 'anthropic') {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 2000,
        messages,
      });
      return response.content[0].text;
    } else {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      });
      return response.choices[0].message.content || '';
    }
  }

  /**
   * Parse LLM response
   */
  private parseResponse(response: string, criteria: string[]): EvaluationResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      return {
        passed: parsed.passed ?? false,
        score: parsed.score ?? 0,
        explanation: parsed.explanation ?? 'No explanation provided',
        criteria: parsed.criteria ?? criteria.map(c => ({
          criterion: c,
          passed: false,
          explanation: 'Could not evaluate',
        })),
      };
    } catch (error) {
      console.warn('Failed to parse LLM response:', error);
      return {
        passed: false,
        score: 0,
        explanation: `Failed to parse evaluation response: ${error}`,
        criteria: criteria.map(c => ({
          criterion: c,
          passed: false,
          explanation: 'Parse error',
        })),
      };
    }
  }

  // ============================================================================
  // Dimensional Rubric Evaluation
  // ============================================================================

  /**
   * Evaluate a test result using dimensional rubric scoring.
   * Returns per-rubric scores (0-1) for Python processing.
   * Python orchestrator handles pass/fail decision and score aggregation.
   */
  async evaluateWithRubrics(
    testCase: TestCase,
    agentResult: unknown,
    screenshots: { beforeScreenshot?: string; afterScreenshot?: string },
    rubrics: RubricConfig[],
    executionData: ExecutionData,
  ): Promise<DimensionalEvaluationResult> {
    // Check if client is initialized
    if (!this.client) {
      throw new Error(`LLM Judge not initialized. Set ${this.config.provider === 'openai' ? 'OPENAI_API_KEY' : this.config.provider.toUpperCase() + '_API_KEY'} environment variable.`);
    }

    // If no rubrics provided, convert test case criteria to rubrics
    if (rubrics.length === 0) {
      rubrics = this.convertCriteriaToRubrics(testCase);
    }

    // Build dimensional evaluation prompt
    const prompt = this.buildDimensionalPrompt(testCase, agentResult, rubrics);

    // Include screenshots if available
    const messages = await this.buildMessages(prompt, screenshots);

    // Call LLM for evaluation
    const response = await this.callLLM(messages);

    // Parse response to dimensional result
    return this.parseDimensionalResponse(
      response,
      rubrics,
      testCase,
      executionData,
    );
  }

  /**
   * Convert test case criteria to rubrics (for backward compatibility)
   */
  private convertCriteriaToRubrics(testCase: TestCase): RubricConfig[] {
    const criteria = testCase.validation.llmJudge?.criteria || [];
    return criteria.map((criterion, i) => ({
      id: `${testCase.id}_p${i}`,
      description: criterion,
      weight: 1.0,  // All persistent rubrics are positive
      type: 'persistent' as const,
    }));
  }

  /**
   * Build dimensional evaluation prompt for rubric scoring
   */
  private buildDimensionalPrompt(
    testCase: TestCase,
    agentResult: unknown,
    rubrics: RubricConfig[]
  ): string {
    // Separate positive and negative rubrics for clearer evaluation
    const positiveRubrics = rubrics.filter(r => r.weight > 0);
    const negativeRubrics = rubrics.filter(r => r.weight < 0);

    let rubricList = '';

    if (positiveRubrics.length > 0) {
      rubricList += '### Positive Rubrics (Excellence Indicators)\n';
      rubricList += 'Score 1.0 = agent fully exhibited this quality, 0.0 = completely absent\n';
      rubricList += positiveRubrics.map((r, i) =>
        `${i + 1}. [${r.id}] ${r.description}`
      ).join('\n');
    }

    if (negativeRubrics.length > 0) {
      rubricList += '\n\n### Negative Rubrics (Failure Patterns)\n';
      rubricList += 'Score 0.0 = agent avoided this problem, 1.0 = agent exhibited this bad behavior\n';
      rubricList += negativeRubrics.map((r, i) =>
        `${positiveRubrics.length + i + 1}. [${r.id}] ${r.description}`
      ).join('\n');
    }

    return `You are an evaluation judge for web automation agents. Your task is to score the agent's performance on specific rubric dimensions.

## Test Information
- **Test Name**: ${testCase.name}
- **Description**: ${testCase.description}
- **URL**: ${testCase.url}
- **Objective**: ${JSON.stringify(testCase.input)}

## Agent Result
\`\`\`json
${JSON.stringify(agentResult, null, 2)}
\`\`\`

## Rubrics to Score
${rubricList}

## Instructions
1. Analyze the agent's result and any visual evidence (screenshots if provided)
2. Score each rubric on a continuous scale from 0.0 to 1.0:
   - For POSITIVE rubrics: 1.0 = perfect, 0.5 = partial, 0.0 = absent
   - For NEGATIVE rubrics: 0.0 = didn't exhibit problem, 1.0 = exhibited bad behavior
3. Provide a brief explanation for each score
4. Identify the failure category if the agent failed (or null if successful)

## Failure Categories
- auth_wall: Blocked by login/authentication requirement
- timeout: Agent ran out of time/iterations
- no_actions: Agent didn't take any meaningful actions
- partial: Partial completion of task
- wrong_target: Clicked/interacted with wrong element
- wrong_action: Right target but wrong action type
- page_error: Page JavaScript error or crash
- network_error: Network/loading failures
- not_found: Element not found on page
- unknown: Uncategorized failure

Respond in JSON format:
{
  "rubricScores": [
    {"rubricId": "id", "score": 0.0-1.0, "explanation": "why this score"}
  ],
  "failureCategory": "auth_wall|timeout|no_actions|partial|wrong_target|wrong_action|page_error|network_error|not_found|unknown|null",
  "failureReason": "description of failure or null if successful"
}`;
  }

  /**
   * Parse LLM response for dimensional evaluation
   */
  private parseDimensionalResponse(
    response: string,
    rubrics: RubricConfig[],
    testCase: TestCase,
    executionData: ExecutionData,
  ): DimensionalEvaluationResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // Map rubric scores with weights from config
      const rubricScores: RubricScore[] = (parsed.rubricScores || []).map((rs: any) => {
        const rubricConfig = rubrics.find(r => r.id === rs.rubricId);
        // Clamp score to 0-1 range (LLM may return invalid values)
        const rawScore = typeof rs.score === 'number' ? rs.score : 0;
        const clampedScore = Math.max(0, Math.min(1, rawScore));
        return {
          rubricId: rs.rubricId,
          description: rubricConfig?.description || rs.rubricId,
          score: clampedScore,
          explanation: rs.explanation || 'No explanation',
          weight: rubricConfig?.weight || 1.0,
        };
      });

      // Add any missing rubrics with score 0
      for (const rubric of rubrics) {
        if (!rubricScores.find(rs => rs.rubricId === rubric.id)) {
          rubricScores.push({
            rubricId: rubric.id,
            description: rubric.description,
            score: 0,
            explanation: 'Rubric not scored by judge',
            weight: rubric.weight,
          });
        }
      }

      // Validate failure category
      const validCategories: FailureCategory[] = [
        'auth_wall', 'timeout', 'no_actions', 'partial',
        'wrong_target', 'wrong_action', 'page_error',
        'network_error', 'not_found', 'unknown'
      ];
      const failureCategory = parsed.failureCategory &&
        validCategories.includes(parsed.failureCategory)
          ? parsed.failureCategory as FailureCategory
          : undefined;

      return {
        testId: testCase.id,
        testName: testCase.name,
        status: 'evaluated',
        rubricScores,
        failureCategory,
        failureReason: parsed.failureReason || undefined,
        // null - Python computes these from rubric scores
        aggregateScore: null,
        passed: null,
        executionData,
        duration: 0, // Set by caller
      };
    } catch (error) {
      console.warn('Failed to parse dimensional LLM response:', error);

      // Return error result with all rubrics scored 0
      return {
        testId: testCase.id,
        testName: testCase.name,
        status: 'evaluated',
        rubricScores: rubrics.map(r => ({
          rubricId: r.id,
          description: r.description,
          score: 0,
          explanation: `Parse error: ${error}`,
          weight: r.weight,
        })),
        failureCategory: 'unknown',
        failureReason: `Failed to parse evaluation response: ${error}`,
        aggregateScore: null,
        passed: null,
        executionData,
        duration: 0,
      };
    }
  }
}
