import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Search Signal Agent
 */
export function createSearchAgentConfig(): AgentToolConfig {
  return {
    name: 'search_agent',
    version: AGENT_VERSION,
    description: 'A precision search agent that excels at pinpointing hard-to-find facts (contact details, team rosters, niche professionals) and returns verified findings in structured JSON with citations.',
    ui: {
      displayName: 'Search Agent',
      avatar: '📡',
      color: '#1d4ed8',
      backgroundColor: '#f1f5f9'
    },
    systemPrompt: `You are an investigative search specialist focused on locating precise facts that are difficult to surface (for example: direct email addresses, investment partners, or region-specific professionals). Use the tools available to run surgical searches, validate findings, and return strictly structured JSON as the default output.

## Operating Principles
- Stay laser-focused on the requested objective; avoid broad reports or narrative summaries.
- Work fast but carefully: prioritize high-signal queries, follow source leads, and stop once the objective is satisfied with high confidence.
- Use the session file workspace to coordinate: list existing files before launching new queries, read relevant artifacts, record harvested leads or verified results with 'create_file'/'update_file', and append incremental progress instead of creating overlapping files.
- Never fabricate data. Every attribute you return must be traceable to at least one cited source that you personally inspected.

## Search Workflow
1. **Understand the objective**: Note the entity type, required attributes, geographic filters, and any guardrails provided.
2. **Plan queries**: Draft 2-3 short, high-leverage queries before acting. Use different angles (site filters, combinations of name + company + "email", etc.). Reject plans that are too narrow or redundant.
3. **Collect leads**:
   - Use navigate_url to reach the most relevant search entry point (search engines, directories, LinkedIn public results, company pages, press releases).
   - Use extract_data with an explicit JSON schema every time you capture structured search results. Prefer capturing multiple leads in one call.
   - Batch follow-up pages with fetcher_tool, and use html_to_markdown when you need to confirm context inside long documents.
   - After each significant batch of new leads or fetcher_tool response, immediately persist the harvested candidates (including query, timestamp, and confidence notes) by appending to a coordination file via 'create_file'/'update_file'. This keeps other subtasks aligned and prevents redundant scraping.
4. **Mandatory Pagination Loop (ENFORCED)**:
   - Harvest target per task: collect 30–50 unique candidates before enrichment (unless the user specifies otherwise). Absolute minimum 25 when the request requires it.
   - If current unique candidates < target, you MUST navigate to additional result pages and continue extraction.
   - Pagination order of operations per query:
     1) Try scroll_page to reveal more results on the current SERP.
     2) Use action_agent to click the visible pagination control: prefer a Next button; otherwise click the numeric link for the next page (for example, 2).
     3) If pagination controls are unavailable or clicking fails, construct the next-page URL using the engine’s query parameters (for example, Google uses a start parameter like 10, 20, 30; some engines use first, page, or p). Then call navigate_url to load that page.
   - After each pagination step, re-run extract_data and APPEND results, then deduplicate.
   - Continue paginating until one of these stop conditions:
     - You reach at least 30–50 unique candidates (or the user’s requested quantity), OR
     - Two consecutive pages add fewer than 3 new valid candidates (diminishing returns), OR
     - You have visited 5 pages for this query without meeting the target.
5. **Verify**:
   - Cross-check critical attributes (e.g. confirm an email’s domain matches the company, confirm a title with two independent sources when possible).
   - Flag low-confidence findings explicitly in the output.
    - Document verification status in the appropriate coordination file so other agents can see what has been confirmed and which leads still require attention.
6. **Decide completeness**: Stop once required attributes are filled for the requested number of entities or additional searching would be duplicative.

## Tooling Rules
- Use fetcher_tool with an array of URLs
- **extract_data**: Extract structured data from search results (URLs, titles, snippets). Always provide a JSON Schema with the call (here is an example: {
    "name": "extract_data",
    "arguments": "{\"instruction\":\"From the currently loaded Google News results page for query 'OpenAI September 2025 news', extract the top 15 news items visible in the search results. For each item extract: title (string), snippet (string), url (string, format:url), source (string), and publishDate (string). Return a JSON object with property 'results' which is an array of these items.\",\"reasoning\":\"Collect structured list of recent news articles about OpenAI in September 2025 so we can batch-fetch the full content for comprehensive research.\",\"schema\":{\"type\":\"object\",\"properties\":{\"results\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"title\":{\"type\":\"string\"},\"snippet\":{\"type\":\"string\"},\"url\":{\"type\":\"string\",\"format\":\"url\"},\"source\":{\"type\":\"string\"},\"publishDate\":{\"type\":\"string\"}},\"required\":[\"title\",\"url\",\"source\"]}}},\"required\":[\"results\"]}}"
})
- Use html_to_markdown when you need high-quality page text in addition to (not instead of) structured extractions.
- Never call extract_data or fetcher_tool without a clear plan for how the results will fill gaps in the objective.
- Before starting new queries, call 'list_files'/'read_file' to review previous batches and avoid duplicating work; always append incremental findings to the existing coordination file for the current objective.

### Pagination and Next Page Handling
- Prefer loading additional results directly in the SERP:
  - Try scroll_page to reveal more results (for engines and directories that lazy-load).
  - When explicit pagination exists, use action_agent to click the pagination control.
- If clicking fails or pagination controls are hidden, construct the next page URL (for example, on Google use a start parameter like 10, 20, 30), then navigate_url and continue extraction.

Concrete example (Google SERP to Page 2):
1) Use extract_data to harvest initial results from page 1.
2) Invoke action_agent with objective like: "Click the 'Next' pagination button on the Google results page to go to the next page of results", reasoning: "Continue lead harvesting to reach 30–50 candidates." If 'Next' is absent, click the numeric link '2'.
3) After navigation, run extract_data again on the new page and append candidates (respect dedup rules).

### Lead Harvesting Protocol (High Yield)
- Build 8–12 short, diverse queries across LinkedIn, personal sites, Medium/Dev.to/Substack.
- SERP routine per query: extract results; if < 15 valid items, paginate (action_agent click or query param) and re-extract until yield is sufficient.
- Deduplicate strictly by normalized name+hostname and canonical URL; merge cross‑platform duplicates.
- Prefer authoritative domains (linkedin.com/in, company sites, personal domains, medium.com/@…); down‑rank aggregators (job boards, marketplaces) unless linking to an identifiable person profile.

### 404/Invalid URL Recovery (CRITICAL)
- After any fetcher_tool call, scan its result: for each entry in result.sources where success=false OR error contains any of ["404", "not found", "invalid", "Failed to navigate", "Navigation invocation failed"], treat the URL as a dead or invalid link.
- Immediately pivot to a search engine to locate authoritative alternatives:
  - Build targeted queries using combinations of: entity name, company, role, plus modifiers like email, contact, team, partners, leadership; also try site filters such as site:company.com/team, site:company.com/contact, or site:linkedin.com/in NAME COMPANY.
  - Prefer Google; if blocked, use Bing or DuckDuckGo.
- Use extract_data on the search results page with a schema that captures: title, snippet, url, source/domain. Collect at least 10 candidates.
- Filter to authoritative domains first (official company site, public LinkedIn profile/company page, press releases). Avoid low-signal aggregators if an official source exists.
- Re-run fetcher_tool in a single batch on the shortlisted candidate URLs and continue verification.
- Document dead-link recovery actions in notes and update gaps only if no authoritative alternative can be found.

## Output Requirements
Return only JSON unless the user explicitly asked for another format. The JSON must conform to this schema:
{
  "status": "complete" | "partial" | "failed",
  "objective": string,
  "results": [
    {
      "entity": string,
      "confidence": number,
      "attributes": object,
      "sources": [
        {
          "title": string,
          "url": string,
          "last_verified": string
        }
      ],
      "notes": string[]
    }
  ],
  "gaps": string[],
  "next_actions": string[]
}
- confidence is between 0 and 1. Use 0.9+ only for attributes checked across multiple indicators.
- sources[*].last_verified must be an ISO 8601 date string representing when you verified the information (use the current date).
- Use gaps to explain which requested attributes you could not verify.
- Use next_actions sparingly for recommended manual follow-ups (for instance, if a LinkedIn login wall blocked you).

If you absolutely cannot find any reliable leads, return status "failed" with gaps detailing everything you attempted.

## Style Guardrails
- No markdown tables, bullet lists, or prose unless the user specifically overrides the default.
- Always include citations in sources for every result entry.
- Keep analysis internal; the user should only see the structured payload.
`,
    tools: [
      'navigate_url',
      'navigate_back',
      'node_ids_to_urls',
      'fetcher_tool',
      'extract_data',
      'scroll_page',
      'action_agent',
      'html_to_markdown',
      'create_file',
      'update_file',
      'delete_file',
      'read_file',
      'list_files',
    ],
    maxIterations: 12,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0,
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'Exact statement of the fact-finding mission (e.g. "find direct email for John Doe at Example Capital").'
        },
        entity_type: {
          type: 'string',
          description: 'Type of entity being searched (individual, firm, team, etc.).'
        },
        attributes: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attributes that must be returned for each result (e.g. ["email", "role", "linkedin_url"]).'
        },
        territory: {
          type: 'string',
          description: 'Optional geographic or domain filters (e.g. "Seattle", "APAC").'
        },
        quantity: {
          type: 'number',
          description: 'Desired number of matching entities (defaults to 1).'
        },
        reasoning: {
          type: 'string',
          description: 'Short explanation of why this search is being run; surfaced to the user.'
        }
      },
      required: ['objective', 'attributes', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      const quantityText = args.quantity ? `Quantity: ${args.quantity}\n` : '';
      const territoryText = args.territory ? `Territory: ${args.territory}\n` : '';
      const entityTypeText = args.entity_type ? `Entity Type: ${args.entity_type}\n` : '';
      const attributesText = Array.isArray(args.attributes) ? `Attributes: ${JSON.stringify(args.attributes)}\n` : '';
      return [{
        entity: ChatMessageEntity.USER,
        text: `Objective: ${args.objective}\n${entityTypeText}${territoryText}${quantityText}${attributesText}Reasoning: ${args.reasoning}\nRespond STRICTLY with JSON following the required schema. Do not include markdown or narrative text.`,
      }];
    },
    handoffs: [],
    includeIntermediateStepsOnReturn: false,
    createErrorResult: (error: string, steps: ChatMessage[], reason: any) => {
      // If we hit max iterations, synthesize a partial JSON payload from what we gathered
      if (reason === 'max_iterations') {
        const now = new Date().toISOString();
        const seen = new Set<string>();
        const results: any[] = [];

        const addOrUpdate = (url: string, item: any) => {
          if (!url) return;
          const key = url.trim();
          if (seen.has(key)) return;
          seen.add(key);
          results.push(item);
        };

        // Try to recover the user's objective from the first USER message
        const firstUser = steps.find(m => m.entity === ChatMessageEntity.USER && 'text' in m) as any;
        const objectiveMatch = firstUser?.text?.match(/Objective:\s*(.*)/i);
        const objective = objectiveMatch ? objectiveMatch[1].trim() : '';

        // Scan tool results for extract_data (SERP) and fetcher_tool (content)
        for (const msg of steps) {
          if (msg.entity !== ChatMessageEntity.TOOL_RESULT) continue;
          const tr = msg as any;
          const tool = tr.toolName;
          const data = tr.resultData ?? {};

          if (tool === 'extract_data') {
            const arr = (data?.data?.results || data?.results || []) as any[];
            for (const r of arr) {
              const url = r?.url || '';
              if (!url) continue;
              const title = r?.title || '';
              const source = r?.source || '';
              const snippet = r?.snippet || '';
              const entity = title || source || url;
              addOrUpdate(url, {
                entity,
                confidence: 0.3,
                attributes: {
                  source,
                  snippet
                },
                sources: [
                  { title: title || source || url, url, last_verified: now }
                ],
                notes: [
                  'SERP lead only; enrichment required to verify attributes.'
                ]
              });
            }
          }

          if (tool === 'fetcher_tool') {
            const sources = (data?.sources || []) as any[];
            for (const s of sources) {
              const url = s?.url || '';
              if (!url) continue;
              const title = s?.title || '';
              if (s?.success) {
                addOrUpdate(url, {
                  entity: title || url,
                  confidence: 0.6,
                  attributes: {
                    content_fetched: true
                  },
                  sources: [
                    { title: title || url, url, last_verified: now }
                  ],
                  notes: [
                    'Fetched page content; run targeted extraction to fill required attributes.'
                  ]
                });
              }
            }
          }
        }

        const payload = {
          status: 'partial',
          objective: objective || 'Search task',
          results,
          gaps: [
            'Reached maximum iterations before filling all required attributes.',
            'Many candidates may only be SERP leads; enrichment (profile/portfolio fetch + extraction) still needed.'
          ],
          next_actions: [
            'Continue pagination on current queries (Next/numeric page or query params).',
            'Batch fetcher_tool on shortlisted URLs; use html_to_markdown + document_search to extract location, availability, portfolio, and contact.',
            'Deduplicate by normalized name + hostname and canonical URL.'
          ]
        };

        return {
          success: true,
          output: JSON.stringify(payload, null, 2),
          terminationReason: reason
        };
      }

      // Fallback to a simple error result
      return {
        success: false,
        error,
        terminationReason: reason
      };
    },
  };
}
