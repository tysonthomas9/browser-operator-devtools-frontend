# Quick Start Guide

> **Reading time**: ~5 minutes | **Skill level**: Beginner | **Last updated**: 2025-01-11

Get AI Chat running and execute your first task in under 5 minutes.

## Prerequisites

- Chrome or Chromium (latest version)
- OpenAI API key (or other LLM provider) - [Get one here](https://platform.openai.com/api-keys)

That's it! No installation needed if you're using the pre-built version.

---

## Step 1: Open AI Chat Panel (30 seconds)

### For Built Versions

1. Launch Chrome/Chromium
2. Open DevTools (`F12` or `Cmd+Option+I` on Mac)
3. Look for the **"AI Chat"** tab in DevTools
4. Click it to open the AI Chat panel

### For Development

If you're building from source, see the [Development Guide](./Development-Guide.md#development-setup) instead.

---

## Step 2: Configure Your API Key (1 minute)

1. **Click the settings icon** (⚙️) in the top-right of the AI Chat panel

2. **Enter your API key**:
   - For OpenAI: Paste your API key in the "OpenAI API Key" field
   - For other providers: See [LLM Providers Guide](./LLM-Providers.md)

3. **Select your model** (optional):
   - Default: `gpt-4o` (recommended)
   - Or choose from the dropdown

4. **Click "Save"**

✅ **You're configured!**

---

## Step 3: Run Your First Task (2 minutes)

Let's automate a simple web task to verify everything works.

### Example 1: Navigate and Extract Information

1. **Navigate to a website in Chrome**:
   ```
   Open: https://example.com
   ```

2. **In the AI Chat input box, type**:
   ```
   Extract the main heading from this page
   ```

3. **Press Enter** or click Send

4. **Watch the AI Chat panel**:
   - You'll see the agent thinking
   - Tools being executed (like `get_page_content`)
   - The extracted result

**Expected output**:
```
The main heading is: "Example Domain"
```

### Example 2: Perform an Action

1. **Navigate to**:
   ```
   https://www.google.com
   ```

2. **Ask**:
   ```
   Search for "AI browser automation" and tell me the first result title
   ```

3. **Watch it work**:
   - Agent uses search tools
   - Performs the search
   - Extracts the result

**Expected output**:
```
The first result is: "[Title of first search result]"
```

### Example 3: Multi-Step Task

1. **Try a more complex task**:
   ```
   Go to github.com/trending and tell me the #1 trending repository today
   ```

2. **Watch the agent**:
   - Navigate to the URL
   - Analyze the page
   - Find the trending repo
   - Return the result

---

## Verify Success ✅

If you see output like above, **congratulations!** AI Chat is working. You've just:

✅ Opened AI Chat
✅ Configured your API key
✅ Ran your first agent task
✅ Saw tools execute automatically
✅ Got results back

---

## What Just Happened?

When you sent your request, AI Chat:

1. **Analyzed your request** using an LLM (GPT-4)
2. **Selected appropriate tools** (like `navigate_url`, `get_page_content`, `extract_data`)
3. **Executed the tools** on the current page
4. **Processed the results** and sent them back to you

Learn more: [Architecture Overview](./Architecture-Overview.md)

---

## Next Steps

### Learn More
- 📖 [User Guide](./User-Guide.md) - Complete guide for using AI Chat
- 🛠️ [Tools Reference](./Tools-Reference.md) - See all 47 available tools
- 🤖 [Specialized Agents](./Specialized-Agents.md) - Learn about different agent types

### Try More Examples

**Data Extraction**:
```
Go to news.ycombinator.com and extract the top 3 story titles
```

**Form Automation**:
```
Fill out the contact form with name "John Doe" and email "john@example.com"
```

**Research**:
```
Research the latest features of React 19 and summarize them
```

### Customize

- 🔌 [Switch LLM Providers](./LLM-Providers.md) - Use Claude, Gemini, or Groq
- ⚙️ [Configure Settings](./User-Guide.md#configuration) - Adjust temperature, max iterations
- 🔧 [Build Custom Agents](./Specialized-Agents.md#creating-custom-agents)

---

## Troubleshooting

### "I don't see the AI Chat tab"

**Solution**: Make sure you're using a version with AI Chat included. For development builds:

```bash
npm run build
npm run serve
# Launch Chrome with custom DevTools
```

See [Development Guide](./Development-Guide.md#development-setup)

### "API key invalid"

**Solutions**:
- Verify your key at [OpenAI Dashboard](https://platform.openai.com/api-keys)
- Make sure you have credits available
- Check you're using the correct field (OpenAI vs LiteLLM vs Groq)

### "No response from agent"

**Checklist**:
- ✅ API key is configured
- ✅ Model is selected
- ✅ You have internet connection
- ✅ Check browser console for errors (`F12` → Console tab)

More solutions: [Troubleshooting Guide](./Troubleshooting.md)

---

## Common Mistakes

❌ **Wrong**: Expecting immediate results on complex tasks
✅ **Right**: Complex tasks take 10-30 seconds

❌ **Wrong**: Using tools directly without understanding agents
✅ **Right**: Let agents select tools automatically

❌ **Wrong**: Not specifying which page to work on
✅ **Right**: Navigate to the page first, then ask AI Chat to work on it

---

## Quick Reference

### Keyboard Shortcuts
- `Enter` - Send message
- `Shift+Enter` - New line in input
- `Esc` - Clear input

### Common Commands
```
Navigate to [URL]
Extract [data] from this page
Click on [element description]
Fill out the form with [data]
Search for [query]
Scroll down
Take a screenshot
```

### Status Indicators
- 🤔 **Thinking** - Agent is planning
- ⚙️ **Tool Executing** - Running a tool
- ✅ **Complete** - Task finished
- ❌ **Error** - Something went wrong

---

## Performance Tips

⚡ **Fast tasks** (< 5 seconds):
- Extract visible text
- Click buttons
- Navigate URLs

⏱️ **Medium tasks** (5-15 seconds):
- Multi-step actions
- Form filling
- Data extraction with schemas

🐌 **Slow tasks** (15-60 seconds):
- Research across multiple pages
- Complex workflows
- LLM-based evaluations

---

## What to Read Next

**I want to learn the basics:**
→ [User Guide](./User-Guide.md)

**I want to understand how it works:**
→ [Architecture Overview](./Architecture-Overview.md)

**I want to see what's possible:**
→ [Tools Reference](./Tools-Reference.md) and [Specialized Agents](./Specialized-Agents.md)

**I want to build my own agents:**
→ [Development Guide](./Development-Guide.md)

**I'm having issues:**
→ [Troubleshooting Guide](./Troubleshooting.md)

---

## Success! 🎉

You've successfully:
- ✅ Set up AI Chat
- ✅ Configured your API key
- ✅ Ran your first automation task
- ✅ Understood the basics

**Time spent**: ~5 minutes
**What you can do now**: Automate any web task!

Ready to dive deeper? Start with the [User Guide](./User-Guide.md) or explore [all available tools](./Tools-Reference.md).

---

*Questions? Check the [Troubleshooting Guide](./Troubleshooting.md) or [open an issue](https://github.com/BrowserOperator/browser-operator-core/issues).*
