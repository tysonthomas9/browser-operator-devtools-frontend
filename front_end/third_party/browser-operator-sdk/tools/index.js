import { z } from 'zod';

// src/tools/createTool.ts
function createTool(config) {
  return {
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: config.execute,
    metadata: config.metadata
  };
}
function createSimpleTool(config) {
  const anySchema = {
    parse: (val) => val,
    safeParse: (val) => ({ success: true, data: val })
  };
  return {
    id: config.id,
    description: config.description,
    inputSchema: anySchema,
    outputSchema: anySchema,
    execute: async (ctx) => {
      return config.execute(ctx.context);
    },
    metadata: config.metadata
  };
}
var RuntimeContext = class {
  data = /* @__PURE__ */ new Map();
  constructor(initialData) {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        this.data.set(key, value);
      });
    }
  }
  get(key) {
    return this.data.get(key);
  }
  set(key, value) {
    this.data.set(key, value);
  }
  has(key) {
    return this.data.has(key);
  }
  clear() {
    this.data.clear();
  }
  keys() {
    return Array.from(this.data.keys());
  }
};
function zodToOpenAISchema(schema) {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value;
      properties[key] = zodTypeToJsonSchema(zodType);
      if (!(zodType instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : void 0
    };
  }
  return {
    type: "object",
    properties: {}
  };
}
function zodTypeToJsonSchema(zodType) {
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  if (zodType instanceof z.ZodNullable) {
    return {
      ...zodTypeToJsonSchema(zodType.unwrap()),
      nullable: true
    };
  }
  if (zodType instanceof z.ZodString) {
    const schema = { type: "string" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodNumber) {
    const schema = { type: "number" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodBoolean) {
    const schema = { type: "boolean" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodTypeToJsonSchema(zodType.element)
    };
  }
  if (zodType instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: zodType.options
    };
  }
  if (zodType instanceof z.ZodObject) {
    return zodToOpenAISchema(zodType);
  }
  return { type: "string" };
}
function toolToOpenAIFunction(tool) {
  const parameters = zodToOpenAISchema(tool.inputSchema);
  return {
    name: tool.id,
    description: tool.description,
    parameters
  };
}
function toolsToOpenAIFunctions(tools) {
  return Object.values(tools).map(toolToOpenAIFunction);
}
async function executeTool(tool, input, options) {
  const parsedInput = tool.inputSchema.parse(input);
  const runtimeContext = new RuntimeContext(options?.runtimeContext);
  const controller = new AbortController();
  const abortSignal = options?.abortSignal || controller.signal;
  let timeoutId;
  if (options?.timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);
  }
  try {
    const output = await tool.execute({
      context: parsedInput,
      runtimeContext,
      abortSignal
    });
    if (options?.validateOutput !== false) {
      const parsedOutput = tool.outputSchema.parse(output);
      return parsedOutput;
    }
    return output;
  } finally {
    if (timeoutId !== void 0) {
      clearTimeout(timeoutId);
    }
  }
}
async function executeToolCall(tools, toolCallId, toolName, args, options) {
  try {
    const tool = tools[toolName];
    if (!tool) {
      return {
        toolCallId,
        result: `Error: Tool '${toolName}' not found`,
        success: false,
        error: `Tool '${toolName}' not found`
      };
    }
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(args);
    } catch (error) {
      return {
        toolCallId,
        result: `Error: Invalid JSON arguments: ${String(error)}`,
        success: false,
        error: `Invalid JSON arguments: ${String(error)}`
      };
    }
    const output = await executeTool(tool, parsedArgs, options);
    const resultString = typeof output === "string" ? output : JSON.stringify(output, null, 2);
    return {
      toolCallId,
      result: resultString,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      toolCallId,
      result: `Error: ${errorMessage}`,
      success: false,
      error: errorMessage
    };
  }
}
var readFileInputSchema = z.object({
  fileName: z.string().describe("Name of the file to read"),
  reasoning: z.string().describe("Explanation for why the file needs to be read")
});
var readFileOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    fileName: z.string(),
    content: z.string(),
    mimeType: z.string(),
    size: z.number(),
    createdAt: z.number(),
    updatedAt: z.number()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var readFile = createTool({
  id: "read_file",
  description: "Reads the full content and metadata for a file stored in the current session.",
  inputSchema: readFileInputSchema,
  outputSchema: readFileOutputSchema,
  metadata: {
    category: "file_operations",
    tags: ["file", "storage", "read"],
    requiresRuntime: ["fileStorageManager"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { fileName, reasoning } = context;
    const fileStorageManager = runtimeContext?.get("fileStorageManager");
    if (!fileStorageManager) {
      return {
        success: false,
        error: "FileStorageManager not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      const file = await fileStorageManager.readFile(fileName);
      if (!file) {
        return {
          success: false,
          error: `File "${fileName}" was not found in the current session.`
        };
      }
      return {
        success: true,
        fileName: file.fileName,
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to read file."
      };
    }
  }
});
var createFileInputSchema = z.object({
  fileName: z.string().describe("Unique name of the file to create (no path separators)"),
  content: z.string().describe("Content to write to the file"),
  mimeType: z.string().optional().describe("Optional MIME type describing the content (default: text/plain)"),
  reasoning: z.string().describe("Explanation for why this file is being created for the user")
});
var createFileOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    fileId: z.string(),
    fileName: z.string(),
    message: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var createFile = createTool({
  id: "create_file",
  description: "Creates a new file in the current session storage. Fails if the file already exists.",
  inputSchema: createFileInputSchema,
  outputSchema: createFileOutputSchema,
  metadata: {
    category: "file_operations",
    tags: ["file", "storage", "create", "write"],
    requiresRuntime: ["fileStorageManager"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { fileName, content, mimeType, reasoning } = context;
    const fileStorageManager = runtimeContext?.get("fileStorageManager");
    if (!fileStorageManager) {
      return {
        success: false,
        error: "FileStorageManager not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      const file = await fileStorageManager.createFile(fileName, content, mimeType);
      return {
        success: true,
        fileId: file.id,
        fileName: file.fileName,
        message: `Created file "${file.fileName}" (${file.size} bytes).`
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to create file."
      };
    }
  }
});
var updateFileInputSchema = z.object({
  fileName: z.string().describe("Name of the file to update"),
  content: z.string().describe("New content to write to the file"),
  append: z.boolean().optional().describe("Whether to append the content instead of replacing it (default: false)"),
  reasoning: z.string().describe("Explanation for why this update is needed")
});
var updateFileOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    fileId: z.string(),
    message: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var updateFile = createTool({
  id: "update_file",
  description: "Updates an existing file in the current session. Can either replace the content or append to it.",
  inputSchema: updateFileInputSchema,
  outputSchema: updateFileOutputSchema,
  metadata: {
    category: "file_operations",
    tags: ["file", "storage", "update", "write", "append"],
    requiresRuntime: ["fileStorageManager"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { fileName, content, append, reasoning } = context;
    const fileStorageManager = runtimeContext?.get("fileStorageManager");
    if (!fileStorageManager) {
      return {
        success: false,
        error: "FileStorageManager not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      const file = await fileStorageManager.updateFile(fileName, content, append === true);
      const action = append ? "Appended to" : "Updated";
      return {
        success: true,
        fileId: file.id,
        message: `${action} file "${file.fileName}" (${file.size} bytes).`
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to update file."
      };
    }
  }
});
var deleteFileInputSchema = z.object({
  fileName: z.string().describe("Name of the file to delete"),
  reasoning: z.string().describe("Explanation for why the file can be safely deleted")
});
var deleteFileOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    message: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var deleteFile = createTool({
  id: "delete_file",
  description: "Deletes a file from the current session storage.",
  inputSchema: deleteFileInputSchema,
  outputSchema: deleteFileOutputSchema,
  metadata: {
    category: "file_operations",
    tags: ["file", "storage", "delete"],
    requiresRuntime: ["fileStorageManager"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { fileName, reasoning } = context;
    const fileStorageManager = runtimeContext?.get("fileStorageManager");
    if (!fileStorageManager) {
      return {
        success: false,
        error: "FileStorageManager not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      await fileStorageManager.deleteFile(fileName);
      return {
        success: true,
        message: `Deleted file "${fileName}".`
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to delete file."
      };
    }
  }
});
var listFilesInputSchema = z.object({
  reasoning: z.string().describe("Explanation for why the file list is needed")
});
var fileSummarySchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.number(),
  updatedAt: z.number()
});
var listFilesOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    files: z.array(fileSummarySchema),
    count: z.number()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var listFiles = createTool({
  id: "list_files",
  description: "Lists all files created during the current session along with their metadata.",
  inputSchema: listFilesInputSchema,
  outputSchema: listFilesOutputSchema,
  metadata: {
    category: "file_operations",
    tags: ["file", "storage", "list"],
    requiresRuntime: ["fileStorageManager"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { reasoning } = context;
    const fileStorageManager = runtimeContext?.get("fileStorageManager");
    if (!fileStorageManager) {
      return {
        success: false,
        error: "FileStorageManager not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      const files = await fileStorageManager.listFiles();
      return {
        success: true,
        files,
        count: files.length
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to list files."
      };
    }
  }
});
var executeCodeInputSchema = z.object({
  code: z.string().describe("JavaScript code to execute in the page context. Must be a valid expression or IIFE that returns a value."),
  reasoning: z.string().describe("Explanation of what this code does and why you are executing it (shown to user)")
});
var executeCodeOutputSchema = z.unknown();
var executeCode = createTool({
  id: "execute_code",
  description: `Executes JavaScript code in the current page context and returns the raw result.

Use this tool when you need to:
- Extract all links from the page
- Get specific DOM elements with custom logic
- Extract table data
- Get computed styles
- Run custom JavaScript that doesn't fit schema-based extraction
- Check page state (document.readyState, window.location, etc.)
- Extract images
- Get metadata

The code executes in the page's JavaScript context with full DOM API access.
The raw JavaScript return value is returned directly without any parsing or wrapping.

Examples:
\u2022 Get all links: Array.from(document.links).map(a => ({text: a.textContent.trim(), href: a.href}))
\u2022 Extract product data: Array.from(document.querySelectorAll('.product')).map(p => ({name: p.querySelector('.name').textContent, price: p.querySelector('.price').textContent}))
\u2022 Get page metadata: ({title: document.title, url: location.href, images: document.images.length})
\u2022 Check element existence: !!document.querySelector('#login-button')`,
  inputSchema: executeCodeInputSchema,
  outputSchema: executeCodeOutputSchema,
  metadata: {
    category: "execution",
    tags: ["code", "javascript", "dom", "extraction"],
    requiresRuntime: ["codeExecutor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { code, reasoning } = context;
    if (typeof code !== "string" || code.trim().length === 0) {
      return { error: "Code must be a non-empty string" };
    }
    const codeExecutor = runtimeContext?.get("codeExecutor");
    if (!codeExecutor) {
      return {
        error: "CodeExecutor not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      const result = await codeExecutor.execute(code, {
        returnByValue: true,
        // Return the actual value, not a remote object reference
        awaitPromise: true,
        // Wait for promises to resolve
        timeout: 1e4
        // 10 second timeout
      });
      if (!result.success) {
        return {
          error: result.error || "Unknown error",
          exceptionDetails: result.exceptionDetails
        };
      }
      return result.value;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
});
var htmlToMarkdownInputSchema = z.object({
  instruction: z.string().optional().describe("Natural language instruction for the extraction agent"),
  reasoning: z.string().describe("Reasoning about the extraction process displayed to the user")
});
var htmlToMarkdownOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    markdownContent: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var htmlToMarkdown = createTool({
  id: "html_to_markdown",
  description: "Extracts the main article content from a webpage and converts it to well-formatted Markdown, removing ads, navigation, and other distracting elements.",
  inputSchema: htmlToMarkdownInputSchema,
  outputSchema: htmlToMarkdownOutputSchema,
  metadata: {
    category: "web",
    tags: ["html", "markdown", "extraction", "conversion"],
    requiresRuntime: ["htmlToMarkdownConverter", "pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { instruction, reasoning } = context;
    const converter = runtimeContext?.get("htmlToMarkdownConverter");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!converter || !pageAccessor) {
      return {
        success: false,
        error: "HTMLToMarkdownConverter or PageContentAccessor not available in runtime context"
      };
    }
    try {
      const html = await pageAccessor.getHTML();
      const url = await pageAccessor.getURL();
      const result = await converter.convert(html, {
        instruction,
        baseURL: url
      });
      if (!result.success || !result.markdown) {
        return {
          success: false,
          error: result.error || "Failed to convert HTML to markdown"
        };
      }
      return {
        success: true,
        markdownContent: result.markdown
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to extract content"
      };
    }
  }
});
var accessibilityTreeInputSchema = z.object({
  reasoning: z.string().describe("Reasoning for extracting accessibility tree")
});
var accessibilityTreeOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    simplified: z.string(),
    full: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var accessibilityTreeToMarkdown = createTool({
  id: "get_accessibility_tree",
  description: "Extracts the full page accessibility tree as structured markdown, capturing all interactive elements, semantic structure, and content hierarchy.",
  inputSchema: accessibilityTreeInputSchema,
  outputSchema: accessibilityTreeOutputSchema,
  metadata: {
    category: "web",
    tags: ["accessibility", "tree", "extraction", "markdown"],
    requiresRuntime: ["pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { reasoning } = context;
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!pageAccessor) {
      return {
        success: false,
        error: "PageContentAccessor not available in runtime context"
      };
    }
    try {
      const tree = await pageAccessor.getAccessibilityTree();
      return {
        success: true,
        simplified: tree,
        full: tree
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to extract accessibility tree"
      };
    }
  }
});
var fetchedContentSchema = z.object({
  url: z.string(),
  title: z.string(),
  markdownContent: z.string(),
  success: z.boolean(),
  error: z.string().optional()
});
var fetcherInputSchema = z.object({
  urls: z.array(z.string()).describe("List of URLs to fetch content from"),
  reasoning: z.string().describe("Reasoning for the action, displayed to the user")
});
var fetcherOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    sources: z.array(fetchedContentSchema)
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var fetcher = createTool({
  id: "fetcher_tool",
  description: "Navigates to URLs, extracts and cleans the main content, returning markdown for each source",
  inputSchema: fetcherInputSchema,
  outputSchema: fetcherOutputSchema,
  metadata: {
    category: "web",
    tags: ["fetch", "navigation", "extraction", "urls"],
    requiresRuntime: ["navigationManager", "htmlToMarkdownConverter", "pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext, abortSignal }) => {
    const { urls, reasoning } = context;
    const navManager = runtimeContext?.get("navigationManager");
    const converter = runtimeContext?.get("htmlToMarkdownConverter");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!navManager || !converter || !pageAccessor) {
      return {
        success: false,
        error: "Required runtime dependencies not available"
      };
    }
    if (!Array.isArray(urls) || urls.length === 0) {
      return {
        success: false,
        error: "No URLs provided"
      };
    }
    const results = [];
    for (const url of urls) {
      if (abortSignal?.aborted) {
        break;
      }
      try {
        const navResult = await navManager.navigateTo(url);
        if (!navResult.success) {
          results.push({
            url,
            title: "",
            markdownContent: "",
            success: false,
            error: navResult.error
          });
          continue;
        }
        await navManager.waitForPageLoad(5e3);
        const title = await pageAccessor.getTitle();
        const html = await pageAccessor.getHTML();
        const convResult = await converter.convert(html, { baseURL: url });
        if (!convResult.success || !convResult.markdown) {
          results.push({
            url,
            title,
            markdownContent: "",
            success: false,
            error: convResult.error
          });
          continue;
        }
        results.push({
          url,
          title,
          markdownContent: convResult.markdown,
          success: true
        });
      } catch (error) {
        results.push({
          url,
          title: "",
          markdownContent: "",
          success: false,
          error: error?.message || "Failed to fetch"
        });
      }
    }
    return {
      success: true,
      sources: results
    };
  }
});
var webAppDataInputSchema = z.object({
  appId: z.string().describe("Web app identifier"),
  reasoning: z.string()
});
var webAppDataOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.record(z.unknown()),
    appId: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var getWebAppData = createTool({
  id: "get_webapp_data",
  description: "Extracts data from a rendered web application.",
  inputSchema: webAppDataInputSchema,
  outputSchema: webAppDataOutputSchema,
  metadata: {
    category: "web",
    tags: ["webapp", "data", "extraction"],
    requiresRuntime: ["pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { appId, reasoning } = context;
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!pageAccessor) {
      return {
        success: false,
        error: "PageContentAccessor not available"
      };
    }
    try {
      const tree = await pageAccessor.getAccessibilityTree();
      const data = { tree: tree.substring(0, 500), appId };
      return {
        success: true,
        data,
        appId
      };
    } catch (error) {
      return { success: false, error: error?.message || "Failed to get web app data" };
    }
  }
});
var renderWebAppInputSchema = z.object({
  html: z.string().describe("HTML content to render"),
  appId: z.string().describe("Unique identifier for this web app instance"),
  reasoning: z.string()
});
var renderWebAppOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    appId: z.string(),
    message: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var renderWebApp = createTool({
  id: "render_webapp",
  description: "Renders HTML content as a web application in an isolated container.",
  inputSchema: renderWebAppInputSchema,
  outputSchema: renderWebAppOutputSchema,
  metadata: {
    category: "web",
    tags: ["webapp", "render", "iframe"]
  },
  execute: async ({ context }) => {
    const { html, appId, reasoning } = context;
    try {
      if (!html || html.trim().length === 0) {
        return {
          success: false,
          error: "HTML content cannot be empty"
        };
      }
      return {
        success: true,
        appId,
        message: `Rendered web app ${appId}`
      };
    } catch (error) {
      return { success: false, error: error?.message || "Failed to render web app" };
    }
  }
});
var removeWebAppInputSchema = z.object({
  appId: z.string().describe("Web app identifier to remove"),
  reasoning: z.string()
});
var removeWebAppOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    appId: z.string(),
    message: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var removeWebApp = createTool({
  id: "remove_webapp",
  description: "Removes a previously rendered web application and cleans up resources.",
  inputSchema: removeWebAppInputSchema,
  outputSchema: removeWebAppOutputSchema,
  metadata: {
    category: "web",
    tags: ["webapp", "remove", "cleanup"]
  },
  execute: async ({ context }) => {
    const { appId, reasoning } = context;
    try {
      return {
        success: true,
        appId,
        message: `Removed web app ${appId}`
      };
    } catch (error) {
      return { success: false, error: error?.message || "Failed to remove web app" };
    }
  }
});
var thinkingInputSchema = z.object({
  userRequest: z.string().describe("The original user request or goal to think about"),
  context: z.string().optional().describe("Optional additional context about the current situation")
});
var thinkingResultSchema = z.object({
  visualSummary: z.string(),
  thingsToDoList: z.array(z.string()),
  currentProgress: z.string().optional(),
  observations: z.string().optional()
});
var thinkingOutputSchema = z.union([
  thinkingResultSchema,
  z.object({ error: z.string() })
]);
var thinking = createTool({
  id: "thinking",
  description: "A flexible thinking tool that provides a high-level visual summary and creates an unstructured list of things to do. Useful for getting oriented, planning next steps, or reflecting on current state. Automatically adapts to use visual analysis for vision-capable models or accessibility tree analysis for text-only models.",
  inputSchema: thinkingInputSchema,
  outputSchema: thinkingOutputSchema,
  metadata: {
    category: "thinking",
    tags: ["thinking", "planning", "reasoning", "llm"],
    requiresRuntime: ["llmProvider", "pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { userRequest, context: contextStr } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!llmProvider || !pageAccessor) {
      return {
        error: "LLMProvider or PageContentAccessor not available in runtime context"
      };
    }
    try {
      const tree = await pageAccessor.getAccessibilityTree();
      const url = await pageAccessor.getURL();
      const title = await pageAccessor.getTitle();
      const systemPrompt = `You are a thinking tool that helps with high-level planning and analysis. Your job is to understand the current state and think through what needs to be done in a flexible, unstructured way.

APPROACH:
1. Analyze the page structure to understand what's available
2. Create a flexible list of things that might need to be done
3. Think about current progress and what to focus on next
4. Be conversational and adaptive

OUTPUT FORMAT (JSON):
{
  "visualSummary": "Brief description of the page and relevant elements",
  "thingsToDoList": ["Thing 1", "Thing 2", "Thing 3"],
  "currentProgress": "Optional - where things stand",
  "observations": "Optional - interesting observations"
}`;
      const contextSection = contextStr ? `
ADDITIONAL CONTEXT: ${contextStr}` : "";
      const userPrompt = `USER REQUEST: ${userRequest}${contextSection}

CURRENT PAGE: ${title}
URL: ${url}

ACCESSIBILITY TREE:
${tree.substring(0, 3e3)}

Think through what needs to be done to accomplish the user's request.`;
      const result = await llmProvider.generateText({
        model: "gpt-4",
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt,
        temperature: 0.3
      });
      try {
        const parsed = JSON.parse(result.text);
        return parsed;
      } catch {
        return {
          error: "Failed to parse thinking result"
        };
      }
    } catch (error) {
      return {
        error: error?.message || "Thinking failed"
      };
    }
  }
});
var critiqueInputSchema = z.object({
  content: z.string().describe("Content to critique and improve"),
  criteria: z.string().optional().describe("Specific criteria for the critique"),
  reasoning: z.string().describe("Reasoning for requesting the critique")
});
var critiqueOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    critique: z.string(),
    suggestions: z.array(z.string()),
    score: z.number().min(0).max(10)
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var critique = createTool({
  id: "critique",
  description: "Provides constructive critique and improvement suggestions for any content. Uses LLM to analyze quality, identify issues, and suggest concrete improvements.",
  inputSchema: critiqueInputSchema,
  outputSchema: critiqueOutputSchema,
  metadata: {
    category: "thinking",
    tags: ["critique", "review", "feedback", "llm"],
    requiresRuntime: ["llmProvider"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { content, criteria, reasoning } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    if (!llmProvider) {
      return {
        success: false,
        error: "LLMProvider not available in runtime context"
      };
    }
    try {
      const criteriaSection = criteria ? `
CRITERIA: ${criteria}` : "";
      const systemPrompt = `You are a constructive critic. Analyze content and provide actionable feedback.

OUTPUT FORMAT (JSON):
{
  "critique": "Overall assessment",
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "score": 7
}`;
      const userPrompt = `Critique this content:${criteriaSection}

CONTENT:
${content}

Provide constructive feedback with a score from 0-10.`;
      const result = await llmProvider.generateText({
        model: "gpt-4",
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt,
        temperature: 0.3
      });
      try {
        const parsed = JSON.parse(result.text);
        return {
          success: true,
          critique: parsed.critique,
          suggestions: parsed.suggestions,
          score: parsed.score
        };
      } catch {
        return {
          success: false,
          error: "Failed to parse critique result"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Critique failed"
      };
    }
  }
});
var sequentialThinkingInputSchema = z.object({
  problem: z.string().describe("Problem or question to think through"),
  steps: z.number().optional().describe("Number of thinking steps (default: 3)"),
  reasoning: z.string().describe("Reasoning for using sequential thinking")
});
var thinkingStepSchema = z.object({
  step: z.number(),
  thought: z.string(),
  conclusion: z.string().optional()
});
var sequentialThinkingOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    steps: z.array(thinkingStepSchema),
    finalAnswer: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var sequentialThinking = createTool({
  id: "sequential_thinking",
  description: "Breaks down complex problems into sequential thinking steps, reasoning through each step before reaching a conclusion. Useful for complex decision-making and problem-solving.",
  inputSchema: sequentialThinkingInputSchema,
  outputSchema: sequentialThinkingOutputSchema,
  metadata: {
    category: "thinking",
    tags: ["thinking", "reasoning", "sequential", "llm"],
    requiresRuntime: ["llmProvider"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { problem, steps = 3, reasoning } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    if (!llmProvider) {
      return {
        success: false,
        error: "LLMProvider not available in runtime context"
      };
    }
    try {
      const systemPrompt = `You are a systematic thinker. Break down problems into ${steps} sequential thinking steps.

OUTPUT FORMAT (JSON):
{
  "steps": [
    {"step": 1, "thought": "...", "conclusion": "..."},
    {"step": 2, "thought": "...", "conclusion": "..."}
  ],
  "finalAnswer": "Synthesized conclusion"
}`;
      const userPrompt = `Think through this problem in ${steps} sequential steps:

PROBLEM:
${problem}

Provide systematic reasoning for each step.`;
      const result = await llmProvider.generateText({
        model: "gpt-4",
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt,
        temperature: 0.3
      });
      try {
        const parsed = JSON.parse(result.text);
        return {
          success: true,
          steps: parsed.steps,
          finalAnswer: parsed.finalAnswer
        };
      } catch {
        return {
          success: false,
          error: "Failed to parse thinking result"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Sequential thinking failed"
      };
    }
  }
});
var schemaExtractorInputSchema = z.object({
  schema: z.record(z.unknown()).describe("JSON schema defining the structure to extract"),
  instruction: z.string().describe("Natural language instruction for extraction"),
  reasoning: z.string().describe("Reasoning for the extraction")
});
var schemaExtractorOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.unknown(),
    metadata: z.object({
      progress: z.string(),
      completed: z.boolean(),
      reasoning: z.string().optional(),
      pageContext: z.string().optional(),
      missingFields: z.string().optional()
    }).optional()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var schemaExtractor = createTool({
  id: "extract_data",
  description: `Extracts structured data from a web page's DOM using a user-provided JSON schema and natural language instruction. Uses the page's accessibility tree for robust extraction.`,
  inputSchema: schemaExtractorInputSchema,
  outputSchema: schemaExtractorOutputSchema,
  metadata: {
    category: "extraction",
    tags: ["extraction", "schema", "data", "llm"],
    requiresRuntime: ["llmProvider", "pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { schema, instruction, reasoning } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!llmProvider || !pageAccessor) {
      return {
        success: false,
        error: "Required runtime dependencies not available"
      };
    }
    try {
      const tree = await pageAccessor.getAccessibilityTree();
      const url = await pageAccessor.getURL();
      const systemPrompt = `You are a data extraction agent. Extract structured data from the accessibility tree according to the provided schema.

OUTPUT FORMAT: Return valid JSON matching the schema exactly.`;
      const userPrompt = `Extract data from this page:

URL: ${url}
INSTRUCTION: ${instruction}

SCHEMA:
${JSON.stringify(schema, null, 2)}

ACCESSIBILITY TREE:
${tree.substring(0, 4e3)}

Return JSON matching the schema.`;
      const result = await llmProvider.generateText({
        model: "gpt-4",
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt,
        temperature: 0
      });
      try {
        const data = JSON.parse(result.text);
        return {
          success: true,
          data,
          metadata: {
            progress: "complete",
            completed: true,
            reasoning: "Data extracted successfully"
          }
        };
      } catch {
        return {
          success: false,
          error: "Failed to parse extracted data"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Extraction failed"
      };
    }
  }
});
var streamlinedExtractorInputSchema = z.object({
  schema: z.record(z.unknown()).describe("Simplified JSON schema for extraction"),
  instruction: z.string().describe("Brief extraction instruction")
});
var streamlinedExtractorOutputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.unknown()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var streamlinedExtractor = createTool({
  id: "extract_data_simple",
  description: "Simplified data extraction tool for quick structured data extraction from web pages.",
  inputSchema: streamlinedExtractorInputSchema,
  outputSchema: streamlinedExtractorOutputSchema,
  metadata: {
    category: "extraction",
    tags: ["extraction", "simple", "data"],
    requiresRuntime: ["llmProvider", "pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { schema, instruction } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!llmProvider || !pageAccessor) {
      return {
        success: false,
        error: "Required runtime dependencies not available"
      };
    }
    try {
      const tree = await pageAccessor.getAccessibilityTree();
      const result = await llmProvider.generateText({
        model: "gpt-4",
        messages: [{
          role: "user",
          content: `Extract: ${instruction}

Schema: ${JSON.stringify(schema)}

Content: ${tree.substring(0, 3e3)}

Return JSON only.`
        }],
        temperature: 0
      });
      const data = JSON.parse(result.text);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error?.message || "Extraction failed" };
    }
  }
});
var combinedExtractionInputSchema = z.object({
  extractors: z.array(z.object({
    name: z.string(),
    schema: z.record(z.unknown()),
    instruction: z.string()
  })).describe("Multiple extractors to run"),
  reasoning: z.string()
});
var combinedExtractionOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    results: z.array(z.object({
      name: z.string(),
      data: z.unknown(),
      success: z.boolean(),
      error: z.string().optional()
    }))
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var combinedExtraction = createTool({
  id: "combined_extraction",
  description: "Runs multiple data extractions in a single operation, useful for extracting different types of data from the same page.",
  inputSchema: combinedExtractionInputSchema,
  outputSchema: combinedExtractionOutputSchema,
  metadata: {
    category: "extraction",
    tags: ["extraction", "combined", "batch"],
    requiresRuntime: ["llmProvider", "pageContentAccessor"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { extractors, reasoning } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    if (!llmProvider || !pageAccessor) {
      return {
        success: false,
        error: "Required runtime dependencies not available"
      };
    }
    try {
      const tree = await pageAccessor.getAccessibilityTree();
      const results = [];
      for (const extractor of extractors) {
        try {
          const result = await llmProvider.generateText({
            model: "gpt-4",
            messages: [{
              role: "user",
              content: `Extract: ${extractor.instruction}

Schema: ${JSON.stringify(extractor.schema)}

Content: ${tree.substring(0, 2e3)}

Return JSON.`
            }],
            temperature: 0
          });
          const data = JSON.parse(result.text);
          results.push({ name: extractor.name, data, success: true });
        } catch (error) {
          results.push({ name: extractor.name, data: null, success: false, error: error?.message });
        }
      }
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error?.message || "Combined extraction failed" };
    }
  }
});
var updateTodoInputSchema = z.object({
  todoList: z.string().describe('Complete markdown checklist of todos. Use "- [ ]" for incomplete items, "- [x]" for completed items. Send the ENTIRE list every time, even if only one item changed.'),
  reasoning: z.string().describe("Explanation for why the todo list is being updated")
});
var updateTodoOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    message: z.string(),
    todoCount: z.number()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var TODO_FILENAME = "todos.md";
var updateTodo = createTool({
  id: "update_todo",
  description: 'Updates the complete todo list for tracking long-term tasks. Agent sends the entire markdown checklist every time, marking completed items with [x]. Use "- [ ]" for incomplete tasks and "- [x]" for completed tasks.',
  inputSchema: updateTodoInputSchema,
  outputSchema: updateTodoOutputSchema,
  metadata: {
    category: "utilities",
    tags: ["todo", "tracking", "markdown"],
    requiresRuntime: ["fileStorageManager"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { todoList, reasoning } = context;
    const fileStorageManager = runtimeContext?.get("fileStorageManager");
    if (!fileStorageManager) {
      return {
        success: false,
        error: "FileStorageManager not available in runtime context. Please provide it when initializing the agent."
      };
    }
    try {
      const todoLines = todoList.trim().split("\n");
      const todoCount = todoLines.filter((line) => line.trim().match(/^-\s+\[[ x]\]/i)).length;
      if (todoCount === 0) {
        return {
          success: false,
          error: 'Todo list must contain at least one item in format "- [ ]" or "- [x]"'
        };
      }
      const existingFile = await fileStorageManager.readFile(TODO_FILENAME);
      if (existingFile) {
        await fileStorageManager.updateFile(TODO_FILENAME, todoList);
      } else {
        await fileStorageManager.createFile(TODO_FILENAME, todoList, "text/markdown");
      }
      return {
        success: true,
        message: `Updated todo list with ${todoCount} items.`,
        todoCount
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to update todo list."
      };
    }
  }
});
var documentSearchInputSchema = z.object({
  query: z.string().describe("Natural language search query to find relevant documents"),
  limit: z.number().min(1).max(50).optional().describe("Maximum number of results to return (default: 10, max: 50)"),
  tags: z.array(z.string()).optional().describe("Filter results by specific tags"),
  domain: z.string().optional().describe('Filter results by domain (e.g., "github.com")'),
  reasoning: z.string().describe("Reasoning for the search, displayed to the user")
});
var searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  content: z.string(),
  relevanceScore: z.number(),
  domain: z.string(),
  tags: z.array(z.string()),
  bookmarkedAt: z.string()
});
var documentSearchOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    results: z.array(searchResultSchema),
    totalResults: z.number(),
    query: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var documentSearch = createTool({
  id: "document_search",
  description: "Searches through previously bookmarked documents using semantic similarity. Finds relevant content based on natural language queries, not just keyword matching.",
  inputSchema: documentSearchInputSchema,
  outputSchema: documentSearchOutputSchema,
  metadata: {
    category: "utilities",
    tags: ["search", "vector", "semantic", "bookmarks"],
    requiresRuntime: ["vectorDBClient"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { query, limit = 10, tags, domain, reasoning } = context;
    const vectorDB = runtimeContext?.get("vectorDBClient");
    if (!vectorDB) {
      return {
        success: false,
        error: "VectorDBClient not available in runtime context"
      };
    }
    try {
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: "Search query cannot be empty"
        };
      }
      const filter = {};
      if (tags && tags.length > 0) {
        filter.tags = tags;
      }
      if (domain) {
        filter.domain = domain;
      }
      const result = await vectorDB.search(query, { limit, filter });
      if (!result.success || !result.results) {
        return {
          success: false,
          error: result.error || "Search failed"
        };
      }
      const formattedResults = result.results.map((r) => ({
        id: r.id,
        title: r.metadata.title || "",
        url: r.metadata.url || "",
        content: r.content,
        relevanceScore: r.score,
        domain: r.metadata.domain || new URL(r.metadata.url || "").hostname,
        tags: r.metadata.tags || [],
        bookmarkedAt: r.metadata.bookmarkedAt || (/* @__PURE__ */ new Date()).toISOString()
      }));
      return {
        success: true,
        results: formattedResults,
        totalResults: formattedResults.length,
        query
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to search documents"
      };
    }
  }
});
var bookmarkStoreInputSchema = z.object({
  title: z.string().optional().describe("Custom title for the bookmark (optional, will use page title if not provided)"),
  tags: z.array(z.string()).optional().describe("Tags to categorize the bookmark for easier discovery"),
  reasoning: z.string().describe("Reasoning for bookmarking this page, displayed to the user"),
  includeFullContent: z.boolean().optional().describe("Whether to include full page content or just a summary (default: true)")
});
var bookmarkStoreOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    id: z.string(),
    url: z.string(),
    title: z.string(),
    message: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var bookmarkStore = createTool({
  id: "bookmark_store",
  description: "Stores the current page content and metadata in a vector database for later retrieval. Extracts clean markdown content and makes it searchable.",
  inputSchema: bookmarkStoreInputSchema,
  outputSchema: bookmarkStoreOutputSchema,
  metadata: {
    category: "utilities",
    tags: ["bookmark", "store", "vector", "save"],
    requiresRuntime: ["vectorDBClient", "pageContentAccessor", "htmlToMarkdownConverter"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { title, tags = [], reasoning, includeFullContent = true } = context;
    const vectorDB = runtimeContext?.get("vectorDBClient");
    const pageAccessor = runtimeContext?.get("pageContentAccessor");
    const converter = runtimeContext?.get("htmlToMarkdownConverter");
    if (!vectorDB || !pageAccessor || !converter) {
      return {
        success: false,
        error: "Required runtime dependencies not available"
      };
    }
    try {
      const url = await pageAccessor.getURL();
      const pageTitle = title || await pageAccessor.getTitle();
      const html = await pageAccessor.getHTML();
      const conversionResult = await converter.convert(html, { baseURL: url });
      if (!conversionResult.success || !conversionResult.markdown) {
        return {
          success: false,
          error: "Failed to convert page content to markdown"
        };
      }
      const content = includeFullContent ? conversionResult.markdown : conversionResult.markdown.substring(0, 2e3);
      const domain = new URL(url).hostname;
      const result = await vectorDB.store({
        content,
        metadata: {
          title: pageTitle,
          url,
          domain,
          tags,
          bookmarkedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to store bookmark"
        };
      }
      return {
        success: true,
        id: result.id || "",
        url,
        title: pageTitle,
        message: `Bookmarked "${pageTitle}" with ${tags.length} tags`
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Failed to bookmark page"
      };
    }
  }
});
var finalizeWithCritiqueInputSchema = z.object({
  result: z.string().describe("The result to finalize and critique"),
  criteria: z.string().optional().describe("Criteria for validation"),
  reasoning: z.string().describe("Reasoning for finalization")
});
var finalizeWithCritiqueOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    isValid: z.boolean(),
    critique: z.string(),
    improvements: z.array(z.string()),
    finalResult: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);
var finalizeWithCritique = createTool({
  id: "finalize_with_critique",
  description: "Validates and critiques a result before finalization, ensuring quality and completeness.",
  inputSchema: finalizeWithCritiqueInputSchema,
  outputSchema: finalizeWithCritiqueOutputSchema,
  metadata: {
    category: "utilities",
    tags: ["finalize", "critique", "validation"],
    requiresRuntime: ["llmProvider"]
  },
  execute: async ({ context, runtimeContext }) => {
    const { result, criteria, reasoning } = context;
    const llmProvider = runtimeContext?.get("llmProvider");
    if (!llmProvider) {
      return {
        success: false,
        error: "LLMProvider not available"
      };
    }
    try {
      const criteriaSection = criteria ? `
CRITERIA: ${criteria}` : "";
      const systemPrompt = `Validate and critique results. OUTPUT FORMAT (JSON):
{
  "isValid": true,
  "critique": "Assessment",
  "improvements": ["Improvement 1"],
  "finalResult": "Polished result"
}`;
      const response = await llmProvider.generateText({
        model: "gpt-4",
        messages: [{
          role: "user",
          content: `Validate this result:${criteriaSection}

RESULT:
${result}

Provide critique and final version.`
        }],
        systemPrompt,
        temperature: 0.3
      });
      const parsed = JSON.parse(response.text);
      return {
        success: true,
        isValid: parsed.isValid,
        critique: parsed.critique,
        improvements: parsed.improvements,
        finalResult: parsed.finalResult
      };
    } catch (error) {
      return { success: false, error: error?.message || "Finalization failed" };
    }
  }
});

export { RuntimeContext, accessibilityTreeInputSchema, accessibilityTreeOutputSchema, accessibilityTreeToMarkdown, bookmarkStore, bookmarkStoreInputSchema, bookmarkStoreOutputSchema, combinedExtraction, combinedExtractionInputSchema, combinedExtractionOutputSchema, createFile, createFileInputSchema, createFileOutputSchema, createSimpleTool, createTool, critique, critiqueInputSchema, critiqueOutputSchema, deleteFile, deleteFileInputSchema, deleteFileOutputSchema, documentSearch, documentSearchInputSchema, documentSearchOutputSchema, executeCode, executeCodeInputSchema, executeCodeOutputSchema, executeTool, executeToolCall, fetcher, fetcherInputSchema, fetcherOutputSchema, fileSummarySchema, finalizeWithCritique, finalizeWithCritiqueInputSchema, finalizeWithCritiqueOutputSchema, getWebAppData, htmlToMarkdown, htmlToMarkdownInputSchema, htmlToMarkdownOutputSchema, listFiles, listFilesInputSchema, listFilesOutputSchema, readFile, readFileInputSchema, readFileOutputSchema, removeWebApp, removeWebAppInputSchema, removeWebAppOutputSchema, renderWebApp, renderWebAppInputSchema, renderWebAppOutputSchema, schemaExtractor, schemaExtractorInputSchema, schemaExtractorOutputSchema, sequentialThinking, sequentialThinkingInputSchema, sequentialThinkingOutputSchema, streamlinedExtractor, streamlinedExtractorInputSchema, streamlinedExtractorOutputSchema, thinking, thinkingInputSchema, thinkingOutputSchema, toolToOpenAIFunction, toolsToOpenAIFunctions, updateFile, updateFileInputSchema, updateFileOutputSchema, updateTodo, updateTodoInputSchema, updateTodoOutputSchema, webAppDataInputSchema, webAppDataOutputSchema, zodToOpenAISchema };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map