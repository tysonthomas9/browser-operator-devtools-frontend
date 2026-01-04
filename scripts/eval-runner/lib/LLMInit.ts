/**
 * LLM Initialization for Eval Runner
 *
 * Initializes the LLMClient singleton with provider configuration.
 * Bypasses browser-specific features like localStorage.
 */

import { LLMClient } from '../../../front_end/panels/ai_chat/LLM/LLMClient.ts';
import type { LLMProvider } from '../../../front_end/panels/ai_chat/LLM/LLMTypes.ts';

export interface EvalLLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  providerURL?: string;
}

/**
 * Initialize LLMClient for eval runner context.
 * This bypasses localStorage-based configuration used in DevTools.
 */
export async function initializeLLMForEval(config: EvalLLMConfig): Promise<LLMClient> {
  const client = LLMClient.getInstance();

  await client.initialize({
    providers: [{
      provider: config.provider as LLMProvider,
      apiKey: config.apiKey,
      providerURL: config.providerURL,
    }],
  });

  console.log(`[LLMInit] Initialized LLM client with ${config.provider} provider`);
  return client;
}
