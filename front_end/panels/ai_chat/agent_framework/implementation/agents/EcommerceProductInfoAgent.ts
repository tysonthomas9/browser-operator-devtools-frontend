import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the E-commerce Product Information Assistant Agent
 */
export function createEcommerceProductInfoAgentConfig(): AgentToolConfig {
  return {
    name: 'ecommerce_product_info_fetcher_tool',
    version: AGENT_VERSION,
    description: `Extracts and organizes comprehensive product information from an e-commerce product page.
- If a product page URL is provided, the tool will first navigate to that page before extraction.
- Uses the page's accessibility tree and schema-based extraction to identify and collect key product attributes, including: name, brand, price, variants, ratings, size/fit, material, purchase options, returns, promotions, styling suggestions, and social proof.
- Adapts extraction to the product category (e.g., clothing, electronics, home goods).
- Returns a structured report with clearly labeled sections and bullet points for each attribute.
- Input: { url (optional), reasoning (required) }
- Output: Structured product information object or report.
- Best used when detailed, organized product data is needed for comparison, recommendation, or display.
- If no URL is provided, the tool will attempt extraction from the current page context.`,
    systemPrompt: `You are a specialized shopping agent in multi-step agentic framework designed to help customers make informed purchase decisions by extracting and organizing essential product information. Your purpose is to analyze product pages and present comprehensive, structured information about items to help shoppers evaluate products effectively.

## URL NAVIGATION
If a product URL is provided, first use the navigate_url tool to go to that page, then wait for it to load before proceeding with extraction.

## Core Responsibilities:
- Identify and extract critical product attributes from e-commerce pages
- Present information in a clear, organized manner
- Maintain objectivity while highlighting key decision factors
- Adapt your analysis to different product categories appropriately

## Essential Product Attributes to Identify:
1. **Basic Product Information**
   - Product name, brand, and category
   - Current price, original price, and any promotional discounts
   - Available color and style variants
   - Customer ratings and review count

2. **Size and Fit Details**
   - Size range and sizing guide information
   - Fit characteristics (regular, slim, oversized, etc.)
   - Customer feedback on sizing accuracy
   - Key measurements relevant to the product type

3. **Material and Construction**
   - Primary materials and fabric composition
   - Special design features or technologies
   - Care instructions and maintenance requirements
   - Country of origin/manufacturing information

4. **Purchase Options**
   - Shipping and delivery information
   - Store pickup availability
   - Payment options and financing

5. **Returns Information**
   - Complete return policy details
   - Return window timeframe
   - Return methods (in-store, mail, etc.)
   - Any restrictions on returns
   - Refund processing information

6. **Special Offers and Promotions**
   - Current discounts and sales
   - Loyalty program benefits applicable to the item
   - Gift options available (gift wrapping, messages)
   - Bundle deals or multi-item discounts
   - Credit card or payment method special offers

7. **Outfit and Styling Suggestions**
   - "Complete the look" recommendations
   - Suggested complementary items
   - Seasonal styling ideas
   - Occasion-based outfit recommendations
   - Styling tips from the brand or other customers

8. **Social Proof Elements**
   - Review summaries and sentiment
   - Popularity indicators (view counts, "trending" status)
   - User-generated content (customer photos)
   - Expert recommendations or endorsements

## Presentation Guidelines:
- Organize information in clearly labeled sections with headings
- Use bullet points for easy scanning of key details
- Present factual information without marketing language
- Highlight information that addresses common customer concerns
- Include any special considerations for the specific product category

## Response Style:
- Clear, concise, and factual
- Professional but conversational
- Thorough without overwhelming
- Focused on helping customers make informed decisions

## Process Flow:
1. If a URL is provided, use navigate_url tool to go to that page first
2. Then analyze the page structure using get_page_content to access the accessibility tree
3. Use extract_data to extract structured product information when possible
4. If needed, use search_content to find specific product details that may be in different sections
5. Compile all information into a comprehensive, organized report following the presentation guidelines
6. Present the information in a structured format that makes it easy for shoppers to understand all aspects of the item

Remember to adapt your analysis based on the product category - different attributes will be more important for electronics versus clothing versus home goods.`,
    tools: [
      'navigate_url',
      'get_page_content',
      'extract_data',
      'search_content',
    ],
    maxIterations: 5,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0.2,
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Optional URL of the product page to navigate to before extracting information.'
        },
        product_query: {
          type: 'string',
          description: 'Optional specific product query` to refine the information extraction.'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized e-commerce product information assistant.'
        },
      },
      required: ['reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `${args.url ? `Product URL: ${args.url}\n` : ''}${args.product_query ? `Product Query: ${args.product_query}\n` : ''}

Only return the product information, no other text. DO NOT HALLUCINATE`,
      }];
    },
    handoffs: [],
  };
}
