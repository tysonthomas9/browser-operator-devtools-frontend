'use strict';

var zod = require('zod');

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
  if (schema instanceof zod.z.ZodObject) {
    const shape = schema.shape;
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value;
      properties[key] = zodTypeToJsonSchema(zodType);
      if (!(zodType instanceof zod.z.ZodOptional)) {
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
  if (zodType instanceof zod.z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  if (zodType instanceof zod.z.ZodNullable) {
    return {
      ...zodTypeToJsonSchema(zodType.unwrap()),
      nullable: true
    };
  }
  if (zodType instanceof zod.z.ZodString) {
    const schema = { type: "string" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof zod.z.ZodNumber) {
    const schema = { type: "number" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof zod.z.ZodBoolean) {
    const schema = { type: "boolean" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof zod.z.ZodArray) {
    return {
      type: "array",
      items: zodTypeToJsonSchema(zodType.element)
    };
  }
  if (zodType instanceof zod.z.ZodEnum) {
    return {
      type: "string",
      enum: zodType.options
    };
  }
  if (zodType instanceof zod.z.ZodObject) {
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
var readFileInputSchema = zod.z.object({
  fileName: zod.z.string().describe("Name of the file to read"),
  reasoning: zod.z.string().describe("Explanation for why the file needs to be read")
});
var readFileOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    fileName: zod.z.string(),
    content: zod.z.string(),
    mimeType: zod.z.string(),
    size: zod.z.number(),
    createdAt: zod.z.number(),
    updatedAt: zod.z.number()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var createFileInputSchema = zod.z.object({
  fileName: zod.z.string().describe("Unique name of the file to create (no path separators)"),
  content: zod.z.string().describe("Content to write to the file"),
  mimeType: zod.z.string().optional().describe("Optional MIME type describing the content (default: text/plain)"),
  reasoning: zod.z.string().describe("Explanation for why this file is being created for the user")
});
var createFileOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    fileId: zod.z.string(),
    fileName: zod.z.string(),
    message: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var updateFileInputSchema = zod.z.object({
  fileName: zod.z.string().describe("Name of the file to update"),
  content: zod.z.string().describe("New content to write to the file"),
  append: zod.z.boolean().optional().describe("Whether to append the content instead of replacing it (default: false)"),
  reasoning: zod.z.string().describe("Explanation for why this update is needed")
});
var updateFileOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    fileId: zod.z.string(),
    message: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var deleteFileInputSchema = zod.z.object({
  fileName: zod.z.string().describe("Name of the file to delete"),
  reasoning: zod.z.string().describe("Explanation for why the file can be safely deleted")
});
var deleteFileOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    message: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var listFilesInputSchema = zod.z.object({
  reasoning: zod.z.string().describe("Explanation for why the file list is needed")
});
var fileSummarySchema = zod.z.object({
  fileName: zod.z.string(),
  mimeType: zod.z.string(),
  size: zod.z.number(),
  createdAt: zod.z.number(),
  updatedAt: zod.z.number()
});
var listFilesOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    files: zod.z.array(fileSummarySchema),
    count: zod.z.number()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var executeCodeInputSchema = zod.z.object({
  code: zod.z.string().describe("JavaScript code to execute in the page context. Must be a valid expression or IIFE that returns a value."),
  reasoning: zod.z.string().describe("Explanation of what this code does and why you are executing it (shown to user)")
});
var executeCodeOutputSchema = zod.z.unknown();
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
var htmlToMarkdownInputSchema = zod.z.object({
  instruction: zod.z.string().optional().describe("Natural language instruction for the extraction agent"),
  reasoning: zod.z.string().describe("Reasoning about the extraction process displayed to the user")
});
var htmlToMarkdownOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    markdownContent: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var accessibilityTreeInputSchema = zod.z.object({
  reasoning: zod.z.string().describe("Reasoning for extracting accessibility tree")
});
var accessibilityTreeOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    simplified: zod.z.string(),
    full: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var fetchedContentSchema = zod.z.object({
  url: zod.z.string(),
  title: zod.z.string(),
  markdownContent: zod.z.string(),
  success: zod.z.boolean(),
  error: zod.z.string().optional()
});
var fetcherInputSchema = zod.z.object({
  urls: zod.z.array(zod.z.string()).describe("List of URLs to fetch content from"),
  reasoning: zod.z.string().describe("Reasoning for the action, displayed to the user")
});
var fetcherOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    sources: zod.z.array(fetchedContentSchema)
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var webAppDataInputSchema = zod.z.object({
  appId: zod.z.string().describe("Web app identifier"),
  reasoning: zod.z.string()
});
var webAppDataOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    data: zod.z.record(zod.z.unknown()),
    appId: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var renderWebAppInputSchema = zod.z.object({
  html: zod.z.string().describe("HTML content to render"),
  appId: zod.z.string().describe("Unique identifier for this web app instance"),
  reasoning: zod.z.string()
});
var renderWebAppOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    appId: zod.z.string(),
    message: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var removeWebAppInputSchema = zod.z.object({
  appId: zod.z.string().describe("Web app identifier to remove"),
  reasoning: zod.z.string()
});
var removeWebAppOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    appId: zod.z.string(),
    message: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var thinkingInputSchema = zod.z.object({
  userRequest: zod.z.string().describe("The original user request or goal to think about"),
  context: zod.z.string().optional().describe("Optional additional context about the current situation")
});
var thinkingResultSchema = zod.z.object({
  visualSummary: zod.z.string(),
  thingsToDoList: zod.z.array(zod.z.string()),
  currentProgress: zod.z.string().optional(),
  observations: zod.z.string().optional()
});
var thinkingOutputSchema = zod.z.union([
  thinkingResultSchema,
  zod.z.object({ error: zod.z.string() })
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
var critiqueInputSchema = zod.z.object({
  content: zod.z.string().describe("Content to critique and improve"),
  criteria: zod.z.string().optional().describe("Specific criteria for the critique"),
  reasoning: zod.z.string().describe("Reasoning for requesting the critique")
});
var critiqueOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    critique: zod.z.string(),
    suggestions: zod.z.array(zod.z.string()),
    score: zod.z.number().min(0).max(10)
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var sequentialThinkingInputSchema = zod.z.object({
  problem: zod.z.string().describe("Problem or question to think through"),
  steps: zod.z.number().optional().describe("Number of thinking steps (default: 3)"),
  reasoning: zod.z.string().describe("Reasoning for using sequential thinking")
});
var thinkingStepSchema = zod.z.object({
  step: zod.z.number(),
  thought: zod.z.string(),
  conclusion: zod.z.string().optional()
});
var sequentialThinkingOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    steps: zod.z.array(thinkingStepSchema),
    finalAnswer: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var schemaExtractorInputSchema = zod.z.object({
  schema: zod.z.record(zod.z.unknown()).describe("JSON schema defining the structure to extract"),
  instruction: zod.z.string().describe("Natural language instruction for extraction"),
  reasoning: zod.z.string().describe("Reasoning for the extraction")
});
var schemaExtractorOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    data: zod.z.unknown(),
    metadata: zod.z.object({
      progress: zod.z.string(),
      completed: zod.z.boolean(),
      reasoning: zod.z.string().optional(),
      pageContext: zod.z.string().optional(),
      missingFields: zod.z.string().optional()
    }).optional()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var streamlinedExtractorInputSchema = zod.z.object({
  schema: zod.z.record(zod.z.unknown()).describe("Simplified JSON schema for extraction"),
  instruction: zod.z.string().describe("Brief extraction instruction")
});
var streamlinedExtractorOutputSchema = zod.z.union([
  zod.z.object({
    success: zod.z.literal(true),
    data: zod.z.unknown()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var combinedExtractionInputSchema = zod.z.object({
  extractors: zod.z.array(zod.z.object({
    name: zod.z.string(),
    schema: zod.z.record(zod.z.unknown()),
    instruction: zod.z.string()
  })).describe("Multiple extractors to run"),
  reasoning: zod.z.string()
});
var combinedExtractionOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    results: zod.z.array(zod.z.object({
      name: zod.z.string(),
      data: zod.z.unknown(),
      success: zod.z.boolean(),
      error: zod.z.string().optional()
    }))
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var updateTodoInputSchema = zod.z.object({
  todoList: zod.z.string().describe('Complete markdown checklist of todos. Use "- [ ]" for incomplete items, "- [x]" for completed items. Send the ENTIRE list every time, even if only one item changed.'),
  reasoning: zod.z.string().describe("Explanation for why the todo list is being updated")
});
var updateTodoOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    message: zod.z.string(),
    todoCount: zod.z.number()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var documentSearchInputSchema = zod.z.object({
  query: zod.z.string().describe("Natural language search query to find relevant documents"),
  limit: zod.z.number().min(1).max(50).optional().describe("Maximum number of results to return (default: 10, max: 50)"),
  tags: zod.z.array(zod.z.string()).optional().describe("Filter results by specific tags"),
  domain: zod.z.string().optional().describe('Filter results by domain (e.g., "github.com")'),
  reasoning: zod.z.string().describe("Reasoning for the search, displayed to the user")
});
var searchResultSchema = zod.z.object({
  id: zod.z.string(),
  title: zod.z.string(),
  url: zod.z.string(),
  content: zod.z.string(),
  relevanceScore: zod.z.number(),
  domain: zod.z.string(),
  tags: zod.z.array(zod.z.string()),
  bookmarkedAt: zod.z.string()
});
var documentSearchOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    results: zod.z.array(searchResultSchema),
    totalResults: zod.z.number(),
    query: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var bookmarkStoreInputSchema = zod.z.object({
  title: zod.z.string().optional().describe("Custom title for the bookmark (optional, will use page title if not provided)"),
  tags: zod.z.array(zod.z.string()).optional().describe("Tags to categorize the bookmark for easier discovery"),
  reasoning: zod.z.string().describe("Reasoning for bookmarking this page, displayed to the user"),
  includeFullContent: zod.z.boolean().optional().describe("Whether to include full page content or just a summary (default: true)")
});
var bookmarkStoreOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    id: zod.z.string(),
    url: zod.z.string(),
    title: zod.z.string(),
    message: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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
var finalizeWithCritiqueInputSchema = zod.z.object({
  result: zod.z.string().describe("The result to finalize and critique"),
  criteria: zod.z.string().optional().describe("Criteria for validation"),
  reasoning: zod.z.string().describe("Reasoning for finalization")
});
var finalizeWithCritiqueOutputSchema = zod.z.discriminatedUnion("success", [
  zod.z.object({
    success: zod.z.literal(true),
    isValid: zod.z.boolean(),
    critique: zod.z.string(),
    improvements: zod.z.array(zod.z.string()),
    finalResult: zod.z.string()
  }),
  zod.z.object({
    success: zod.z.literal(false),
    error: zod.z.string()
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

exports.RuntimeContext = RuntimeContext;
exports.accessibilityTreeInputSchema = accessibilityTreeInputSchema;
exports.accessibilityTreeOutputSchema = accessibilityTreeOutputSchema;
exports.accessibilityTreeToMarkdown = accessibilityTreeToMarkdown;
exports.bookmarkStore = bookmarkStore;
exports.bookmarkStoreInputSchema = bookmarkStoreInputSchema;
exports.bookmarkStoreOutputSchema = bookmarkStoreOutputSchema;
exports.combinedExtraction = combinedExtraction;
exports.combinedExtractionInputSchema = combinedExtractionInputSchema;
exports.combinedExtractionOutputSchema = combinedExtractionOutputSchema;
exports.createFile = createFile;
exports.createFileInputSchema = createFileInputSchema;
exports.createFileOutputSchema = createFileOutputSchema;
exports.createSimpleTool = createSimpleTool;
exports.createTool = createTool;
exports.critique = critique;
exports.critiqueInputSchema = critiqueInputSchema;
exports.critiqueOutputSchema = critiqueOutputSchema;
exports.deleteFile = deleteFile;
exports.deleteFileInputSchema = deleteFileInputSchema;
exports.deleteFileOutputSchema = deleteFileOutputSchema;
exports.documentSearch = documentSearch;
exports.documentSearchInputSchema = documentSearchInputSchema;
exports.documentSearchOutputSchema = documentSearchOutputSchema;
exports.executeCode = executeCode;
exports.executeCodeInputSchema = executeCodeInputSchema;
exports.executeCodeOutputSchema = executeCodeOutputSchema;
exports.executeTool = executeTool;
exports.executeToolCall = executeToolCall;
exports.fetcher = fetcher;
exports.fetcherInputSchema = fetcherInputSchema;
exports.fetcherOutputSchema = fetcherOutputSchema;
exports.fileSummarySchema = fileSummarySchema;
exports.finalizeWithCritique = finalizeWithCritique;
exports.finalizeWithCritiqueInputSchema = finalizeWithCritiqueInputSchema;
exports.finalizeWithCritiqueOutputSchema = finalizeWithCritiqueOutputSchema;
exports.getWebAppData = getWebAppData;
exports.htmlToMarkdown = htmlToMarkdown;
exports.htmlToMarkdownInputSchema = htmlToMarkdownInputSchema;
exports.htmlToMarkdownOutputSchema = htmlToMarkdownOutputSchema;
exports.listFiles = listFiles;
exports.listFilesInputSchema = listFilesInputSchema;
exports.listFilesOutputSchema = listFilesOutputSchema;
exports.readFile = readFile;
exports.readFileInputSchema = readFileInputSchema;
exports.readFileOutputSchema = readFileOutputSchema;
exports.removeWebApp = removeWebApp;
exports.removeWebAppInputSchema = removeWebAppInputSchema;
exports.removeWebAppOutputSchema = removeWebAppOutputSchema;
exports.renderWebApp = renderWebApp;
exports.renderWebAppInputSchema = renderWebAppInputSchema;
exports.renderWebAppOutputSchema = renderWebAppOutputSchema;
exports.schemaExtractor = schemaExtractor;
exports.schemaExtractorInputSchema = schemaExtractorInputSchema;
exports.schemaExtractorOutputSchema = schemaExtractorOutputSchema;
exports.sequentialThinking = sequentialThinking;
exports.sequentialThinkingInputSchema = sequentialThinkingInputSchema;
exports.sequentialThinkingOutputSchema = sequentialThinkingOutputSchema;
exports.streamlinedExtractor = streamlinedExtractor;
exports.streamlinedExtractorInputSchema = streamlinedExtractorInputSchema;
exports.streamlinedExtractorOutputSchema = streamlinedExtractorOutputSchema;
exports.thinking = thinking;
exports.thinkingInputSchema = thinkingInputSchema;
exports.thinkingOutputSchema = thinkingOutputSchema;
exports.toolToOpenAIFunction = toolToOpenAIFunction;
exports.toolsToOpenAIFunctions = toolsToOpenAIFunctions;
exports.updateFile = updateFile;
exports.updateFileInputSchema = updateFileInputSchema;
exports.updateFileOutputSchema = updateFileOutputSchema;
exports.updateTodo = updateTodo;
exports.updateTodoInputSchema = updateTodoInputSchema;
exports.updateTodoOutputSchema = updateTodoOutputSchema;
exports.webAppDataInputSchema = webAppDataInputSchema;
exports.webAppDataOutputSchema = webAppDataOutputSchema;
exports.zodToOpenAISchema = zodToOpenAISchema;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map