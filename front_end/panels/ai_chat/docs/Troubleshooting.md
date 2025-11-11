# Troubleshooting Guide

> **Last updated**: 2025-01-11

Complete guide to fixing common issues with AI Chat.

## Table of Contents

1. [Quick Diagnosis](#quick-diagnosis)
2. [Setup and Configuration Issues](#setup-and-configuration-issues)
3. [API and Connection Issues](#api-and-connection-issues)
4. [Agent Behavior Issues](#agent-behavior-issues)
5. [Performance Issues](#performance-issues)
6. [Tool Execution Issues](#tool-execution-issues)
7. [Browser and DevTools Issues](#browser-and-devtools-issues)
8. [Error Messages](#error-messages)
9. [Debug Techniques](#debug-techniques)
10. [Getting Help](#getting-help)

---

## Quick Diagnosis

Start here to quickly identify your issue category:

**Symptoms → Category**

| Symptom | Likely Issue | Quick Fix |
|---------|--------------|-----------|
| Can't find AI Chat tab | [Setup](#browser-and-devtools-issues) | Check DevTools tabs, look for `>>` |
| "API key invalid" error | [API](#api-and-connection-issues) | Verify key in provider dashboard |
| Agent doesn't respond | [Connection](#api-and-connection-issues) | Check internet, console errors |
| Wrong actions performed | [Agent Behavior](#agent-behavior-issues) | Be more specific in request |
| Very slow performance | [Performance](#performance-issues) | Reduce complexity, check rate limits |
| "Tool not found" error | [Tool Execution](#tool-execution-issues) | Check tool name spelling |
| "Rate limit exceeded" | [API](#api-and-connection-issues) | Wait 1 minute or upgrade plan |

---

## Setup and Configuration Issues

### Issue: AI Chat tab not visible

**Symptoms**:
- Don't see "AI Chat" in DevTools tabs
- Tab bar doesn't show the panel

**Solutions**:

1. **Check for more tabs**:
   - Click the `>>` icon at the end of the tab bar
   - AI Chat might be in the overflow menu

2. **Verify build includes AI Chat**:
   ```bash
   # For development builds
   npm run build
   # Check build output for AI Chat panel
   ```

3. **Restart DevTools**:
   - Close and reopen DevTools (`F12`)
   - Or restart Chrome completely

4. **Check Chrome version**:
   - Requires Chromium-based browser
   - Update to latest version

### Issue: Settings not saving

**Symptoms**:
- API keys disappear after refresh
- Configuration resets

**Solutions**:

1. **Check browser permissions**:
   - LocalStorage must be enabled
   - Check Chrome Settings → Privacy → Site Settings

2. **Clear and re-enter**:
   ```
   1. Open Settings (⚙️)
   2. Clear all fields
   3. Close and reopen AI Chat
   4. Re-enter API keys
   5. Save
   ```

3. **Check for storage errors**:
   - Open Console (`F12` → Console)
   - Look for LocalStorage errors

### Issue: Can't select model

**Symptoms**:
- Model dropdown empty or disabled
- Selected model doesn't stick

**Solutions**:

1. **Configure API key first**:
   - Must set API key before selecting model
   - Each provider needs its own key

2. **Check provider compatibility**:
   - OpenAI: Requires OpenAI key
   - LiteLLM: Requires LiteLLM endpoint + key
   - Verify provider is correctly selected

3. **Refresh model list**:
   - Close and reopen Settings
   - If using LiteLLM, verify endpoint is reachable

---

## API and Connection Issues

### Issue: "API key invalid" error

**Symptoms**:
- Error message: "Invalid API key"
- Authentication failed

**Solutions**:

1. **Verify key format**:
   - OpenAI: Starts with `sk-...`
   - Anthropic: Starts with `sk-ant-...`
   - Check for extra spaces or newlines

2. **Check key status**:
   - Visit provider dashboard
   - Verify key hasn't been revoked
   - Check key has correct permissions

3. **Verify credits/billing**:
   - OpenAI: [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
   - Ensure you have available credits
   - Check payment method is valid

4. **Try regenerating key**:
   - Create new key in provider dashboard
   - Replace in AI Chat settings
   - Delete old key if it worked

### Issue: "Rate limit exceeded"

**Symptoms**:
- Error: "Rate limit exceeded"
- Requests failing after several messages

**Solutions**:

1. **Wait and retry**:
   - Most rate limits reset after 1 minute
   - Wait 60-90 seconds before retrying

2. **Check your rate limit tier**:
   - OpenAI: [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits)
   - Free tier: 3 requests/minute
   - Paid tier: 60+ requests/minute

3. **Upgrade your plan**:
   - Consider paid tier for higher limits
   - Or use alternative provider (Groq, OpenRouter)

4. **Reduce request frequency**:
   - Simplify tasks (fewer steps)
   - Lower max iterations in Settings
   - Avoid parallel requests

### Issue: No response from agent

**Symptoms**:
- Message sent but no reply
- Loading indicator stuck
- Agent appears frozen

**Solutions**:

1. **Check internet connection**:
   - Verify you're online
   - Test other websites

2. **Check browser console**:
   ```
   1. Press F12
   2. Go to Console tab
   3. Look for red errors
   4. Screenshot and report if found
   ```

3. **Verify API key configured**:
   - Settings (⚙️) → Check API key is entered
   - Try re-entering and saving

4. **Start new session**:
   - Click ⚡ icon (New Session)
   - Or refresh AI Chat panel

5. **Check provider status**:
   - OpenAI: [status.openai.com](https://status.openai.com)
   - Claude: [status.anthropic.com](https://status.anthropic.com)

### Issue: Timeout errors

**Symptoms**:
- "Request timeout" error
- Agent stops mid-task

**Solutions**:

1. **Break down complex tasks**:
   - Instead of: "Research 20 companies and create report"
   - Try: "Research company X and tell me about CEO"

2. **Increase timeout** (if available):
   - Check Settings for timeout configuration
   - Default is usually 30-60 seconds

3. **Check model speed**:
   - Groq: Fastest (LPU hardware)
   - OpenAI GPT-4-turbo: Fast
   - OpenAI GPT-4: Slower but more capable

---

## Agent Behavior Issues

### Issue: Agent performs wrong actions

**Symptoms**:
- Clicks wrong button
- Fills wrong form field
- Extracts incorrect data

**Solutions**:

1. **Be more specific**:
   - ❌ Bad: "Click the button"
   - ✅ Good: "Click the red 'Submit' button in the bottom-right"

2. **Add context**:
   - ❌ Bad: "Fill the form"
   - ✅ Good: "Fill the 'Contact Form' (not the newsletter signup) with..."

3. **Use step-by-step**:
   ```
   First, scroll to the bottom of the page.
   Then, find the contact form.
   Then, fill in email as test@example.com.
   Finally, click Submit.
   ```

4. **Describe elements uniquely**:
   - Use colors, positions, labels
   - "The blue button next to 'Cancel'"
   - "The email field in the header (not footer)"

### Issue: Incomplete data extraction

**Symptoms**:
- Missing fields in extracted data
- Partial results only

**Solutions**:

1. **Check data exists on page**:
   - Manually verify data is visible
   - Not all data may be in HTML (some in JavaScript)

2. **Wait for content to load**:
   ```
   Wait 3 seconds for the product details to load,
   then extract the price and description
   ```

3. **Be specific about format**:
   ```
   Extract as JSON with fields:
   - product_name
   - price
   - availability
   ```

4. **Try different extraction method**:
   - Schema-based extraction
   - Or ask for specific fields one by one

### Issue: Agent gives up too early

**Symptoms**:
- "Can't find..." after minimal effort
- Doesn't try alternative approaches

**Solutions**:

1. **Increase max iterations**:
   - Settings → Max Iterations
   - Increase from 10 to 15 or 20

2. **Provide hints**:
   ```
   Find the contact email. If it's not on this page,
   check the About page or footer.
   ```

3. **Break into subtasks**:
   - Do navigation separately
   - Then extraction separately

### Issue: Agent is too slow/verbose

**Symptoms**:
- Takes many iterations
- Overthinks simple tasks

**Solutions**:

1. **Use simpler model** for basic tasks:
   - gpt-4o-mini instead of gpt-4o
   - Faster and cheaper for simple operations

2. **Be direct**:
   - ❌ "Could you please help me extract..."
   - ✅ "Extract the price"

3. **Lower max iterations**:
   - Settings → Max Iterations → 5
   - Forces agent to be more direct

---

## Performance Issues

### Issue: Very slow responses

**Symptoms**:
- Tasks take 30+ seconds
- Long waits between actions

**Solutions**:

1. **Simplify tasks**:
   - Break complex tasks into steps
   - Do one thing at a time

2. **Use faster provider**:
   - **Fastest**: Groq (LPU hardware)
   - **Fast**: OpenAI GPT-4-turbo, Gemini
   - **Slower**: GPT-4, Claude Opus

3. **Reduce context**:
   - Start new session (⚡) regularly
   - Long conversation history slows down LLM

4. **Check network speed**:
   - Slow internet = slow responses
   - Test speed at [fast.com](https://fast.com)

### Issue: High API costs

**Symptoms**:
- Unexpected bills
- Rapid credit depletion

**Solutions**:

1. **Use cheaper models**:
   - gpt-4o-mini instead of gpt-4o (20x cheaper)
   - Groq (free tier available)

2. **Monitor usage**:
   - OpenAI: Check [usage dashboard](https://platform.openai.com/usage)
   - Set spending limits

3. **Optimize prompts**:
   - Be concise in requests
   - Avoid asking for unnecessary details

4. **Lower max iterations**:
   - Settings → Max Iterations → 5-10
   - Prevents runaway costs

### Issue: Memory/CPU high

**Symptoms**:
- Browser slows down
- High RAM usage
- Fan noise

**Solutions**:

1. **Clear message history**:
   - Click 🗑️ (Clear History)
   - Start new session regularly

2. **Close other tabs**:
   - DevTools uses significant resources
   - Close unnecessary tabs

3. **Restart browser**:
   - Chrome can accumulate memory over time
   - Full restart helps

---

## Tool Execution Issues

### Issue: "Tool not found" error

**Symptoms**:
- Error: "Tool 'xyz' not found"
- Tool execution fails

**Solutions**:

1. **Check tool name spelling**:
   - Tool names are lowercase with underscores
   - `navigate_url` not `navigateURL`

2. **Verify tool exists**:
   - See [Tools Reference](./Tools-Reference.md)
   - Check if tool name is correct

3. **Tool might be disabled**:
   - Some tools may not be available in all configurations
   - Check build configuration

### Issue: Tool execution fails

**Symptoms**:
- Tool runs but returns error
- "Failed to execute..." message

**Solutions**:

1. **Check prerequisites**:
   - Some tools require page to be loaded
   - Navigate to page first, then use tool

2. **Verify element exists**:
   - For click/fill tools, element must be visible
   - Check manually that element is on page

3. **Try different approach**:
   - If `perform_action` fails, try describing differently
   - "Click the button" vs "Click the element with text 'Submit'"

### Issue: Actions not taking effect

**Symptoms**:
- Tool executes but nothing happens
- Page doesn't change

**Solutions**:

1. **Add waits**:
   ```
   Click the button, then wait 2 seconds for the form to appear
   ```

2. **Check for JavaScript interference**:
   - Some sites prevent automation
   - Try manual action to verify it works

3. **Verify element is interactive**:
   - Element might be disabled or hidden
   - Check if it's clickable manually

---

## Browser and DevTools Issues

### Issue: DevTools crashes or freezes

**Symptoms**:
- DevTools becomes unresponsive
- Need to force-close

**Solutions**:

1. **Clear DevTools cache**:
   ```
   1. Open DevTools Settings (F1)
   2. Go to Preferences
   3. Click "Clear storage"
   4. Reload DevTools
   ```

2. **Disable extensions**:
   - Chrome extensions can conflict
   - Try Incognito mode

3. **Update Chrome**:
   - Ensure latest version
   - chrome://settings/help

### Issue: Page context not updating

**Symptoms**:
- Agent sees old page content
- Changes not reflected

**Solutions**:

1. **Refresh page**:
   - `F5` to reload page
   - Then retry agent request

2. **Wait for page load**:
   ```
   After navigating, wait 3 seconds for page to fully load
   ```

3. **Check for SPAs**:
   - Single Page Apps may not trigger updates
   - Be explicit: "After clicking, wait for new content"

---

## Error Messages

### Common Errors and Solutions

#### "Authentication failed"
**Solution**: Check API key, verify it's not expired, check billing status

#### "Model not available"
**Solution**: Check model name spelling, verify provider supports that model

#### "Context length exceeded"
**Solution**: Start new session (⚡), reduce message history, use model with larger context

#### "Invalid schema"
**Solution**: For extraction, simplify schema, use basic types (string, number, boolean)

#### "Element not found"
**Solution**: Verify element exists, be more descriptive, check page has loaded

#### "Network error"
**Solution**: Check internet connection, verify provider API is up

#### "Timeout"
**Solution**: Simplify task, increase timeout if available, try again

#### "Permission denied"
**Solution**: Check browser permissions, verify page is accessible

---

## Debug Techniques

### 1. Check Browser Console

```
1. Press F12
2. Click "Console" tab
3. Look for errors (red text)
4. Screenshot any errors
```

### 2. Enable Verbose Logging

Some builds support verbose logging:
```
localStorage.setItem('ai_chat_debug', 'true');
// Reload DevTools
```

### 3. Test with Simple Request

Verify basic functionality:
```
Extract the page title
```

If this works, your setup is fine.

### 4. Check Network Tab

```
1. Open DevTools → Network tab
2. Send AI Chat request
3. Look for API calls to OpenAI/Claude/etc.
4. Check response status codes
```

### 5. Try Different Model

Switch models to isolate issue:
- If GPT-4 fails, try GPT-4-turbo
- If OpenAI fails, try Groq

### 6. Bisect the Problem

Narrow down issue:
1. Does a simple request work? → If no: Setup issue
2. Does navigation work? → If no: Tool issue
3. Does extraction work? → If no: Agent/model issue

---

## Getting Help

### Before Reporting Issues

Collect this information:

1. **Error message** (exact text or screenshot)
2. **Console errors** (F12 → Console)
3. **What you tried** (the exact request you sent)
4. **Expected vs actual** behavior
5. **Configuration** (provider, model, settings)
6. **Chrome version** (chrome://version)

### Report Issues

**GitHub Issues**:
- [github.com/BrowserOperator/browser-operator-core/issues](https://github.com/BrowserOperator/browser-operator-core/issues)
- Use issue templates
- Include collected information above

### Community Resources

- [Development Guide](./Development-Guide.md) - Technical details
- [User Guide](./User-Guide.md) - Usage help
- [Tools Reference](./Tools-Reference.md) - Tool documentation
- [Glossary](./Glossary.md) - Term definitions

---

## Prevention Tips

### Avoid Common Mistakes

1. **Always configure API key first**
2. **Be specific in requests**
3. **Start simple, then get complex**
4. **Test on simple pages first**
5. **Keep message history manageable**
6. **Update Chrome regularly**
7. **Monitor API usage/costs**

### Best Practices

1. **Start new session** for new tasks
2. **Clear history** every 10-15 messages
3. **Use appropriate model** for task complexity
4. **Add waits** for dynamic content
5. **Verify manually** if agent fails repeatedly

---

*If your issue isn't listed here, please [open an issue](https://github.com/BrowserOperator/browser-operator-core/issues) with details.*
