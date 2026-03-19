# File Viewer System

The file viewer system enables agents to create, store, and display files during chat sessions. Users can view file contents, copy to clipboard, and download files.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ChatView.ts                               │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐  │
│  │  FileListDisplay │  │         Message Area                 │  │
│  │  (file chips)    │  │                                      │  │
│  └────────┬─────────┘  └──────────────────────────────────────┘  │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ click file
            ▼
    ┌───────────────────┐
    │ Agent Running?    │
    └───────┬───────────┘
            │
     ┌──────┴──────┐
     │             │
    YES           NO
     │             │
     ▼             ▼
┌─────────┐  ┌──────────────────┐
│ Inline  │  │ FileContentViewer │
│ Modal   │  │ (full-screen)     │
└─────────┘  └────────┬──────────┘
                      │
                      ▼
              ┌───────────────┐
              │RenderWebAppTool│
              │ (iframe)       │
              └───────────────┘
```

## Components

### FileListDisplay (`ui/FileListDisplay.ts`)

Custom web component that displays session files as clickable chips.

**Element:** `<ai-file-list-display>`

**Features:**
- Horizontal scrollable list of file chips
- File icon and name display
- Collapsible container (state persisted to localStorage)
- Auto-refresh every 2 seconds
- Two viewing modes based on agent state

**Key Methods:**
- `refresh()` - Reloads file list from storage
- `#handleViewFile(file)` - Opens file in viewer (modal or full-screen)
- `#handleDownload(file)` - Downloads file to user's computer

**Usage in ChatView:**
```html
<ai-file-list-display></ai-file-list-display>
```

### FileContentViewer (`ui/FileContentViewer.ts`)

Static utility class that renders files in a full-screen iframe viewer.

**Features:**
- Type-aware rendering (code, JSON, markdown, HTML, CSS, text)
- Markdown rendering via Marked.js library
- Copy to clipboard functionality
- Download button
- Dark mode support
- XSS protection via HTML escaping and sanitization

**Usage:**
```typescript
import { FileContentViewer } from './FileContentViewer.js';

await FileContentViewer.show(fileName, content, mimeType);
```

**File Type Detection:**
| Extension | Type | Rendering |
|-----------|------|-----------|
| `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.go`, `.rs` | Code | Escaped in `<pre><code>` |
| `.json` | JSON | Prettified with 2-space indentation |
| `.md`, `.markdown` | Markdown | Rendered as HTML via Marked.js |
| `.html`, `.htm` | HTML | Escaped and displayed |
| `.css`, `.scss`, `.sass`, `.less` | CSS | Escaped in `<pre><code>` |
| Other | Text | Plain text display |

### WebAppCodeViewer (`ui/WebAppCodeViewer.ts`)

Static utility class for displaying generated web app source code (HTML/CSS/JS).

**Features:**
- Three-section layout for HTML, CSS, JavaScript
- Color-coded language badges
- Individual copy/download per section
- "Download All" button
- Shadcn-inspired design

**Usage:**
```typescript
import { WebAppCodeViewer } from './WebAppCodeViewer.js';

await WebAppCodeViewer.show(htmlCode, cssCode, jsCode);
```

### FileStorageManager (`tools/FileStorageManager.ts`)

Singleton class managing file persistence via IndexedDB.

**Database:** `ai_chat_agent_files` (version 1)

**Schema:**
```typescript
interface StoredFile {
  id?: number;           // Auto-incremented primary key
  sessionId: string;     // Links file to conversation session
  fileName: string;      // File name with extension
  content: string;       // File content
  mimeType: string;      // MIME type (e.g., 'text/plain')
  size: number;          // Content length in bytes
  createdAt: number;     // Unix timestamp
  updatedAt: number;     // Unix timestamp
}
```

**Indexes:**
- `sessionId` - Query files by session
- `fileName` - Lookup by filename
- `createdAt` - Sort by creation time
- `sessionId_fileName` - Composite for unique per-session files

**Key Methods:**
```typescript
const manager = FileStorageManager.getInstance();

// Set current session (called when conversation loads)
manager.setSessionId(sessionId);

// CRUD operations
await manager.createFile(fileName, content, mimeType);
await manager.updateFile(fileName, newContent, append?);
await manager.readFile(fileName);      // Returns StoredFile | null
await manager.deleteFile(fileName);
await manager.listFiles();             // Returns FileSummary[]

// Clear all files for current session
await manager.clearSession();
```

## Features

### Copy to Clipboard

Two-tier implementation for browser compatibility:

```typescript
// Primary: Modern Clipboard API
await navigator.clipboard.writeText(content);

// Fallback: execCommand (for iframes/older browsers)
const textarea = document.createElement('textarea');
textarea.value = content;
document.body.appendChild(textarea);
textarea.select();
document.execCommand('copy');
```

Visual feedback: Button shows green checkmark with "Copied!" text for 2 seconds.

### Download

Files are downloaded using Blob URLs:

```typescript
const blob = new Blob([content], { type: mimeType });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = fileName;
a.click();
URL.revokeObjectURL(url);
```

### XSS Protection

**HTML Escaping** (for code display):
```typescript
content
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
```

**HTML Sanitization** (for markdown rendering):
- Removes dangerous tags: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`
- Strips event handlers: `onclick`, `onerror`, `onload`, etc.
- Blocks dangerous URLs: `javascript:`, `data:`

### Dark Mode

Both components include CSS media queries for dark mode:

```css
@media (prefers-color-scheme: dark) {
  .container {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #e8eaed;
  }
  /* ... */
}
```

## Integration

### ChatView Integration

FileListDisplay is included in the ChatView template:

```typescript
// ChatView.ts
render() {
  return html`
    <ai-todo-list></ai-todo-list>
    <ai-file-list-display></ai-file-list-display>
    ${this.#renderInputBar(false)}
  `;
}

// Refresh method for external triggers
async refreshFileList(): Promise<void> {
  const fileListDisplay = this.shadowRoot.querySelector('ai-file-list-display');
  await fileListDisplay?.refresh();
}
```

### AIChatPanel Session Management

The panel sets the session ID when conversations are loaded:

```typescript
// AIChatPanel.ts
async #loadConversation(conversationId: string) {
  FileStorageManager.getInstance().setSessionId(conversationId);
  // ...
}
```

## File Locations

| Component | Path |
|-----------|------|
| FileListDisplay | `front_end/panels/ai_chat/ui/FileListDisplay.ts` |
| FileContentViewer | `front_end/panels/ai_chat/ui/FileContentViewer.ts` |
| WebAppCodeViewer | `front_end/panels/ai_chat/ui/WebAppCodeViewer.ts` |
| FileStorageManager | `front_end/panels/ai_chat/tools/FileStorageManager.ts` |
| RenderWebAppTool | `front_end/panels/ai_chat/tools/RenderWebAppTool.ts` |
| ChatView | `front_end/panels/ai_chat/ui/ChatView.ts` |
| AIChatPanel | `front_end/panels/ai_chat/AIChatPanel.ts` |
