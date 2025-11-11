# Browser Basic Example

This example demonstrates how to use the Browser Operator SDK directly in a web browser with vanilla JavaScript.

## Features

- ✅ **Pure Browser JavaScript** - No Node.js, no build tools
- ✅ **Vanilla HTML/CSS/JS** - No frameworks required
- ✅ **Works Offline** - After first load
- ✅ **OpenAI Integration** - Uses fetch() API
- ✅ **Streaming Support** - Real-time response streaming
- ✅ **Event System** - Track agent execution progress

## Running the Example

### Option 1: Direct File Access

1. Build the SDK first:
   ```bash
   cd ../../packages/core
   npm install
   npm run build
   ```

2. Open `index.html` in your browser:
   ```bash
   open index.html
   # or
   python -m http.server 8000
   # then visit http://localhost:8000
   ```

### Option 2: Using a Dev Server

```bash
# From the example directory
npx serve
```

Then visit http://localhost:3000

## Usage

1. **Enter your OpenAI API key** (stays in your browser, never sent to our servers)
2. **Select a model** (default: gpt-3.5-turbo)
3. **Enter your message**
4. **Click "Run Agent"** for standard response or **"Stream Agent"** for streaming

## How It Works

The SDK is loaded as an ES module:

```javascript
import {
    Agent,
    OpenAIProvider,
    AgentEvent
} from '../../packages/core/dist/index.mjs';

// Create provider
const provider = new OpenAIProvider(apiKey);

// Create agent
const agent = new Agent({
    name: 'browser-agent',
    model: 'gpt-3.5-turbo',
    instructions: 'You are a helpful assistant.',
}, provider);

// Run agent
const result = await agent.generateText('Hello!');
console.log(result.text);
```

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 15+
- ✅ Edge 90+

Requires:
- ES Modules support
- Fetch API
- Async/Await
- ReadableStream (for streaming)

## Security Note

⚠️ **Never commit your API key to version control!**

The API key is stored only in your browser's memory for the duration of the session. For production use, always use a backend proxy to handle API keys securely.

## CDN Usage (Future)

Once published to npm, you can use a CDN:

```html
<script type="module">
  import { Agent, OpenAIProvider } from 'https://cdn.jsdelivr.net/npm/@browser-operator/core/+esm';

  // Your code here
</script>
```

## Next Steps

- See [advanced-browser](../advanced-browser) for more features
- See [browser-automation](../browser-automation) for browser control
- Check the [API docs](../../docs/api-reference.md)
