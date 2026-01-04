/**
 * LLM Judge - Evaluates test results using LLM
 *
 * Uses an LLM to judge whether agent actions succeeded
 * based on defined criteria and visual evidence.
 */

import type { TestCase, CriteriaResult } from './types.ts';
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
    let apiKey: string | undefined;
    let baseURL: string | undefined;

    switch (this.config.provider) {
      case 'cerebras':
        apiKey = this.config.apiKey || process.env.CEREBRAS_API_KEY;
        baseURL = 'https://api.cerebras.ai/v1';
        break;
      case 'anthropic':
        apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
        break;
      case 'litellm':
        apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
        baseURL = process.env.LITELLM_BASE_URL;
        break;
      case 'openai':
      default:
        apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
        break;
    }

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
3. Calculate an overall score (0-1) based on how many criteria were met
4. Provide a final determination: PASSED or FAILED

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
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${imageData}` },
      });
    }

    if (screenshots.afterScreenshot && fs.existsSync(screenshots.afterScreenshot)) {
      const imageData = fs.readFileSync(screenshots.afterScreenshot).toString('base64');
      content.push({
        type: 'text',
        text: '\n\n## After Screenshot (state after action):',
      });
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${imageData}` },
      });
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
}
