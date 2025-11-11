# AI Chat User Guide

> **Reading time**: ~20 minutes | **Skill level**: Beginner | **Last updated**: 2025-01-11

Complete guide to using AI Chat in Chromium DevTools for browser automation.

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Configuration](#configuration)
4. [Basic Operations](#basic-operations)
5. [Common Tasks](#common-tasks)
6. [Understanding Agent Responses](#understanding-agent-responses)
7. [Advanced Features](#advanced-features)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

### What is AI Chat?

AI Chat is an AI-powered assistant built into Chromium DevTools that helps you automate web tasks, extract data, and interact with web pages using natural language.

### What Can It Do?

- **Automate tasks**: Fill forms, click buttons, navigate pages
- **Extract data**: Get information from any website
- **Research**: Gather and synthesize information across multiple pages
- **Test**: Validate web application functionality
- **Monitor**: Track changes on websites

### Who Is It For?

- QA testers automating test scenarios
- Developers testing web applications
- Data analysts extracting web data
- Researchers gathering information
- Anyone who wants to automate repetitive web tasks

---

## Getting Started

### Opening AI Chat

1. **Open DevTools** in Chrome/Chromium:
   - Windows/Linux: `F12` or `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`
   - Or right-click → "Inspect"

2. **Find the AI Chat tab**:
   - Look for **"AI Chat"** in the DevTools tab bar
   - If you don't see it, click the `>>` icon to show more tabs

3. **Click "AI Chat"** to open the panel

### Panel Overview

```
┌────────────────────────────────────────┐
│  AI Chat                        ⚙️ ⚡   │  ← Header with settings
├────────────────────────────────────────┤
│                                        │
│  [Agent messages and responses]        │  ← Message history
│                                        │
│                                        │
├────────────────────────────────────────┤
│  Type your message here...       [Send]│  ← Input area
└────────────────────────────────────────┘
```

**Icons**:
- ⚙️ **Settings** - Configure API keys and preferences
- ⚡ **New Session** - Start fresh conversation
- 🗑️ **Clear History** - Delete message history

---

## Configuration

### First-Time Setup

**Required**: You need an API key from an LLM provider.

#### Step 1: Get an API Key

**OpenAI** (recommended for beginners):
1. Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

**Other providers**: See [LLM Providers Guide](./LLM-Providers.md)

#### Step 2: Configure AI Chat

1. Click the **settings icon** (⚙️) in AI Chat
2. Select your **provider**:
   - OpenAI
   - LiteLLM (for Claude, Gemini, Mistral)
   - Groq
   - OpenRouter
   - BrowserOperator

3. **Paste your API key** in the appropriate field
4. **Select a model**:
   - OpenAI: `gpt-4o` (recommended) or `gpt-4-turbo`
   - LiteLLM: `claude-sonnet-4` or `gemini-2.0-flash`
   - Groq: `llama-3-70b-groq`

5. **Click "Save"**

✅ **You're ready!**

### Advanced Configuration

**Temperature** (0.0 - 2.0):
- `0.0` - Deterministic, consistent responses
- `0.7` - Balanced (default)
- `1.5+` - Creative, varied responses

**Max Iterations** (1-50):
- How many steps an agent can take
- Default: `10`
- Increase for complex tasks

**Custom Prompts**:
- Create task-specific system prompts
- Access via Settings → Custom Prompts

---

## Basic Operations

### Sending a Message

1. **Click in the input box** at the bottom
2. **Type your request** (examples below)
3. **Press Enter** or click **Send**

**Tips**:
- Be specific about what you want
- Mention which page if working across tabs
- Use `Shift+Enter` for multi-line messages

### Example Requests

**Navigation**:
```
Go to https://github.com/trending
```

**Data Extraction**:
```
Extract the title and price from this product page
```

**Actions**:
```
Click the "Sign Up" button
```

**Research**:
```
Find the contact email for this company
```

### Understanding Progress

Watch the **message panel** for real-time updates:

```
🤔 Agent thinking...
⚙️ Using tool: navigate_url
⚙️ Using tool: get_page_content
⚙️ Using tool: extract_data
✅ Task complete!
```

**Status icons**:
- 🤔 **Thinking** - Agent is planning next steps
- ⚙️ **Tool** - Executing an action
- ✅ **Complete** - Task finished successfully
- ❌ **Error** - Something went wrong
- 🔄 **Handoff** - Transferring to specialized agent

---

## Common Tasks

### Task 1: Extract Data

**Goal**: Get specific information from a webpage

**Example**:
```
Extract the following from this page:
- Product name
- Price
- Availability
- Customer rating
```

**What happens**:
1. Agent analyzes the page structure
2. Finds the requested data
3. Returns it in structured format

**Result**:
```json
{
  "product_name": "Wireless Mouse",
  "price": "$29.99",
  "availability": "In Stock",
  "customer_rating": "4.5/5"
}
```

### Task 2: Fill Out Forms

**Goal**: Automate form filling

**Example**:
```
Fill out the contact form with:
- Name: John Doe
- Email: john@example.com
- Message: I'm interested in your services
Then click Submit
```

**What happens**:
1. Agent finds the form fields
2. Enters the data
3. Submits the form

### Task 3: Navigate and Research

**Goal**: Gather information across multiple pages

**Example**:
```
Go to the company's About page and tell me:
- When they were founded
- Who the CEO is
- How many employees they have
```

**What happens**:
1. Agent navigates to About page
2. Extracts requested information
3. Returns structured answer

### Task 4: Monitor Changes

**Goal**: Check if something changed on a page

**Example**:
```
Check if the price of this product has changed since yesterday
```

**Note**: This requires integration with storage/history features.

### Task 5: Test Workflows

**Goal**: Verify functionality

**Example**:
```
Test the login flow:
1. Go to /login
2. Enter invalid credentials
3. Verify error message appears
4. Enter valid credentials
5. Verify redirect to dashboard
```

---

## Understanding Agent Responses

### Response Types

#### 1. Direct Answers
```
You: What's the main heading on this page?
Agent: The main heading is "Welcome to Example.com"
```

#### 2. Structured Data
```
You: Extract the author and date
Agent:
Author: Jane Smith
Date: 2025-01-11
Source: article metadata
```

#### 3. Confirmation Messages
```
You: Click the Subscribe button
Agent: ✓ Successfully clicked the "Subscribe" button
Page changed: Newsletter signup modal appeared
```

#### 4. Error Messages
```
You: Click the XYZ button
Agent: ✗ Could not find element matching "XYZ button"
Available buttons: [Home, About, Contact]
Suggestion: Try one of the available buttons
```

### Tool Execution Logs

You'll see which tools the agent uses:

```
⚙️ navigate_url → Navigating to https://example.com
⚙️ get_page_content → Retrieved accessibility tree (245 nodes)
⚙️ extract_data → Extracted data using schema
⚙️ finalize_with_critique → Generated final answer
```

**Common tools**:
- `navigate_url` - Go to a URL
- `get_page_content` - Get page structure
- `perform_action` - Click, type, etc.
- `extract_data` - Get specific data
- `scroll_page` - Scroll up/down
- `take_screenshot` - Capture page

See all tools: [Tools Reference](./Tools-Reference.md)

### Agent Handoffs

Sometimes tasks get delegated to specialized agents:

```
🔄 Handing off to: research_agent
   Reason: This requires multi-page research

[research_agent working...]
⚙️ Gathering information from multiple sources
⚙️ Synthesizing findings
✅ Research complete

🔄 Returning control to main orchestrator
```

**Specialized agents**:
- `research_agent` - Deep research tasks
- `search_agent` - Precision fact-finding
- `action_agent` - Browser automation
- `content_writer_agent` - Content generation

Learn more: [Specialized Agents](./Specialized-Agents.md)

---

## Advanced Features

### Custom System Prompts

Create task-specific agents:

1. Open Settings (⚙️)
2. Go to **Custom Prompts**
3. Click **New Prompt**
4. Enter:
   - **Name**: "Price Tracker"
   - **Prompt**: "You are a price tracking specialist..."
   - **Tools**: Select relevant tools
5. Save

Now you can use: `@price-tracker Check product prices`

### Working with Multiple Pages

**Specify which page**:
```
On the page in Tab 2, extract the product title
```

**Navigate between pages**:
```
Go to the homepage, find the Products link, click it,
then extract all product names
```

### Using File System

AI Chat has an in-memory file system:

**Save data**:
```
Extract all product data and save it to products.json
```

**Read data**:
```
Read products.json and summarize the findings
```

**List files**:
```
Show me all files
```

### Evaluation Mode

Test agent reliability:

1. Open **Evaluation Dialog** (⚙️ → Evaluations)
2. Create **test cases**
3. Run **batch evaluations**
4. View **success rates**

See: [Evaluation Guide](./Evaluation-Guide.md)

---

## Best Practices

### Writing Good Requests

✅ **Do**:
- Be specific: "Click the blue 'Submit' button in the footer"
- Provide context: "On the checkout page, enter shipping address"
- Break down complex tasks: "First navigate to..., then..."

❌ **Don't**:
- Be vague: "Do something with the form"
- Assume context: "Click it" (click what?)
- Overload: "Do 20 different things in one request"

### Performance Tips

**Fast requests** (< 5 seconds):
```
Extract the page title
Click the Next button
Scroll down
```

**Medium requests** (5-15 seconds):
```
Fill out this form with [data]
Extract all products with prices
Navigate to About page and get contact info
```

**Slow requests** (15-60 seconds):
```
Research competitors and create comparison table
Test entire checkout flow
Summarize information from multiple pages
```

### Dealing with Complex Pages

**SPAs (Single Page Apps)**:
- Add pauses: "Wait 2 seconds for content to load"
- Be explicit: "After clicking, wait for the modal to appear"

**Dynamic content**:
- Mention loading: "Wait for the table to finish loading"
- Verify success: "Confirm the data appears before extracting"

**Multiple forms**:
- Be specific: "Fill out the 'Shipping Address' form, not billing"

---

## Troubleshooting

### Agent Not Responding

**Symptoms**: Message sent but no response

**Solutions**:
1. Check API key is valid (Settings → verify)
2. Check internet connection
3. Check browser console for errors (`F12` → Console)
4. Try refreshing DevTools
5. Start new session (⚡ icon)

### Wrong Actions Performed

**Symptoms**: Agent clicks wrong button or enters wrong field

**Solutions**:
- Be more specific in your request
- Describe the element: "the red button in the top-right"
- Include context: "in the navigation menu, click About"
- Check the page structure hasn't changed

### Data Extraction Incomplete

**Symptoms**: Missing fields or partial data

**Solutions**:
- Verify the data exists on the page
- Check if content is lazy-loaded: "Wait for all items to load"
- Be specific about format: "Extract as JSON"
- Try multiple attempts with different descriptions

### Slow Performance

**Symptoms**: Tasks take too long

**Solutions**:
- Break into smaller tasks
- Use simpler models for basic tasks (gpt-4o-mini)
- Reduce max iterations in settings
- Clear message history regularly

### API Rate Limits

**Symptoms**: "Rate limit exceeded" errors

**Solutions**:
- Wait a few minutes
- Upgrade your API plan
- Switch to a different provider
- Reduce task complexity

More solutions: [Troubleshooting Guide](./Troubleshooting.md)

---

## FAQ

### General Questions

**Q: Do I need to pay for AI Chat?**
A: AI Chat itself is free, but you need an API key from an LLM provider (OpenAI, Anthropic, etc.) which has usage costs.

**Q: Is my data sent to external servers?**
A: Your requests and page data are sent to your chosen LLM provider (OpenAI, Claude, etc.) for processing. API keys are stored locally in your browser.

**Q: Can I use it offline?**
A: No, AI Chat requires internet connection to communicate with LLM providers.

**Q: Which browser works?**
A: Chrome and Chromium-based browsers (Edge, Brave, etc.)

### Usage Questions

**Q: Can AI Chat work on any website?**
A: Yes, it works on any accessible webpage. Some sites with heavy anti-automation may be challenging.

**Q: How accurate is data extraction?**
A: Accuracy depends on page structure and your request clarity. Well-structured pages with clear requests typically achieve 95%+ accuracy.

**Q: Can it handle login-protected pages?**
A: Yes, but you need to be logged in first. AI Chat works on whatever the browser can access.

**Q: Does it work with iframes?**
A: Yes, AI Chat can access iframe content on the same domain.

### Technical Questions

**Q: How many requests can I make?**
A: Limited by your LLM provider's rate limits. Typically 3-60 per minute depending on your plan.

**Q: Can I switch models mid-conversation?**
A: Yes, change the model in Settings. The new model takes effect for the next message.

**Q: Can I see the actual tool calls?**
A: Yes, tool executions are shown in the message panel with ⚙️ icons.

**Q: Can I export conversation history?**
A: Currently not built-in, but you can copy-paste from the panel.

---

## Quick Reference Card

### Common Commands

| Task | Example Command |
|------|----------------|
| Navigate | `Go to https://example.com` |
| Extract | `Extract the title and price` |
| Click | `Click the Submit button` |
| Fill form | `Fill the email field with test@example.com` |
| Scroll | `Scroll down to the footer` |
| Screenshot | `Take a screenshot` |
| Search | `Search for "best laptops"` |
| Wait | `Wait 3 seconds` |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Esc` | Clear input |
| `Ctrl/Cmd + K` | Focus input |

### Status Icons

| Icon | Meaning |
|------|---------|
| 🤔 | Thinking/Planning |
| ⚙️ | Tool executing |
| ✅ | Success |
| ❌ | Error |
| 🔄 | Agent handoff |
| 💬 | Message |

---

## What's Next?

### Learn More
- 🛠️ [Tools Reference](./Tools-Reference.md) - See all available tools
- 🤖 [Specialized Agents](./Specialized-Agents.md) - Learn about agent types
- 🏗️ [Architecture Overview](./Architecture-Overview.md) - Understand how it works

### Get Help
- 🐛 [Troubleshooting Guide](./Troubleshooting.md) - Fix common issues
- 📝 [Glossary](./Glossary.md) - Look up terms
- 💬 [GitHub Issues](https://github.com/BrowserOperator/browser-operator-core/issues) - Report bugs

### Advanced Usage
- 🔌 [LLM Providers](./LLM-Providers.md) - Switch to Claude, Gemini, Groq
- ✅ [Evaluation Guide](./Evaluation-Guide.md) - Test agent reliability
- 🔧 [Development Guide](./Development-Guide.md) - Build custom features

---

*Happy automating! If you have questions, check the [Troubleshooting Guide](./Troubleshooting.md) or [open an issue](https://github.com/BrowserOperator/browser-operator-core/issues).*
