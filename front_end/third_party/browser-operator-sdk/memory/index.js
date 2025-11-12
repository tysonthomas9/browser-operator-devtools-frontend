// src/memory/InMemoryStorage.ts
var InMemoryStorage = class {
  messages = [];
  /**
   * Add a message to storage
   */
  async add(message) {
    this.messages.push({ ...message });
  }
  /**
   * Get all messages
   */
  async getAll() {
    return [...this.messages];
  }
  /**
   * Get messages with filtering
   */
  async get(options) {
    let filtered = [...this.messages];
    if (options?.role) {
      filtered = filtered.filter((msg) => msg.role === options.role);
    }
    if (options?.since) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? 0) >= options.since);
    }
    if (options?.until) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? Infinity) <= options.until);
    }
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }
  /**
   * Search messages by content
   */
  async search(query, options) {
    const normalizedQuery = options?.caseSensitive ? query : query.toLowerCase();
    let filtered = this.messages.filter((msg) => {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      const normalizedContent = options?.caseSensitive ? content : content.toLowerCase();
      if (normalizedContent.includes(normalizedQuery)) {
        return true;
      }
      if (options?.searchMetadata && msg.metadata) {
        const metadata = JSON.stringify(msg.metadata);
        const normalizedMetadata = options?.caseSensitive ? metadata : metadata.toLowerCase();
        if (normalizedMetadata.includes(normalizedQuery)) {
          return true;
        }
      }
      return false;
    });
    if (options?.role) {
      filtered = filtered.filter((msg) => msg.role === options.role);
    }
    if (options?.since) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? 0) >= options.since);
    }
    if (options?.until) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? Infinity) <= options.until);
    }
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }
  /**
   * Clear all messages
   */
  async clear() {
    this.messages = [];
  }
  /**
   * Get number of messages
   */
  async count() {
    return this.messages.length;
  }
  /**
   * Get messages (for testing/debugging)
   */
  getMessagesSync() {
    return [...this.messages];
  }
};

// src/memory/ConversationBufferMemory.ts
var ConversationBufferMemory = class {
  storage;
  maxMessages;
  maxAge;
  autoTimestamp;
  constructor(config) {
    this.storage = config?.storage ?? new InMemoryStorage();
    this.maxMessages = config?.maxMessages;
    this.maxAge = config?.maxAge;
    this.autoTimestamp = config?.autoTimestamp ?? true;
  }
  /**
   * Add a message to memory
   *
   * @example
   * ```typescript
   * await memory.addMessage('user', 'What is 2+2?');
   * await memory.addMessage('assistant', 'The answer is 4.');
   * ```
   */
  async addMessage(role, content, options) {
    const message = {
      role,
      content,
      name: options?.name,
      tool_call_id: options?.tool_call_id,
      metadata: options?.metadata,
      timestamp: this.autoTimestamp ? Date.now() : void 0
    };
    await this.storage.add(message);
    await this.cleanup();
  }
  /**
   * Add a raw message object
   *
   * @example
   * ```typescript
   * await memory.add({
   *   role: 'user',
   *   content: 'Hello',
   *   metadata: { source: 'web' }
   * });
   * ```
   */
  async add(message) {
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp ?? (this.autoTimestamp ? Date.now() : void 0)
    };
    await this.storage.add(messageWithTimestamp);
    await this.cleanup();
  }
  /**
   * Get all messages
   */
  async getAll() {
    return this.storage.getAll();
  }
  /**
   * Get messages with filtering
   *
   * @example
   * ```typescript
   * // Get last 10 messages
   * const recent = await memory.get({ limit: 10 });
   *
   * // Get only user messages
   * const userMessages = await memory.get({ role: 'user' });
   *
   * // Get messages from last hour
   * const lastHour = await memory.get({
   *   since: Date.now() - 60 * 60 * 1000
   * });
   * ```
   */
  async get(options) {
    return this.storage.get(options);
  }
  /**
   * Search messages by content
   *
   * @example
   * ```typescript
   * const results = await memory.search('error', {
   *   role: 'assistant',
   *   limit: 5
   * });
   * ```
   */
  async search(query, options) {
    if (!this.storage.search) {
      throw new Error("Storage adapter does not support search");
    }
    return this.storage.search(query, options);
  }
  /**
   * Get memory context for LLM
   *
   * Returns messages formatted for agent/LLM use with optional limits.
   *
   * @example
   * ```typescript
   * const context = await memory.getContext({ limit: 50 });
   * const messages = context.messages;
   *
   * // Use with agent
   * const response = await agent.generateText({
   *   messages: context.messages,
   *   prompt: 'Continue the conversation'
   * });
   * ```
   */
  async getContext(options) {
    let messages = await this.getAll();
    if (options?.includeSystem === false) {
      messages = messages.filter((msg) => msg.role !== "system");
    }
    if (options?.limit) {
      messages = messages.slice(-options.limit);
    }
    return {
      messages,
      tokenCount: this.estimateTokenCount(messages)
    };
  }
  /**
   * Get formatted messages for OpenAI-style API
   *
   * Converts memory messages to the format expected by OpenAI and compatible APIs.
   *
   * @example
   * ```typescript
   * const messages = await memory.getMessages();
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-4',
   *   messages: messages
   * });
   * ```
   */
  async getMessages(options) {
    const context = await this.getContext(options);
    return context.messages;
  }
  /**
   * Clear all messages
   */
  async clear() {
    await this.storage.clear();
  }
  /**
   * Get number of messages in memory
   */
  async count() {
    return this.storage.count();
  }
  /**
   * Clean up old messages based on limits
   */
  async cleanup() {
    const messages = await this.getAll();
    const needsCleanup = this.maxMessages && messages.length > this.maxMessages || this.maxAge && messages.some((msg) => msg.timestamp && Date.now() - msg.timestamp > this.maxAge);
    if (!needsCleanup) {
      return;
    }
    let filtered = messages;
    if (this.maxAge) {
      const cutoff = Date.now() - this.maxAge;
      filtered = filtered.filter((msg) => !msg.timestamp || msg.timestamp >= cutoff);
    }
    if (this.maxMessages && filtered.length > this.maxMessages) {
      filtered = filtered.slice(-this.maxMessages);
    }
    if (filtered.length < messages.length) {
      await this.storage.clear();
      for (const msg of filtered) {
        await this.storage.add(msg);
      }
    }
  }
  /**
   * Estimate token count for messages (rough approximation)
   */
  estimateTokenCount(messages) {
    let count = 0;
    for (const msg of messages) {
      count += 4;
      if (typeof msg.content === "string") {
        count += Math.ceil(msg.content.length / 4);
      } else {
        for (const part of msg.content) {
          if (part.text) {
            count += Math.ceil(part.text.length / 4);
          }
          if (part.image_url) {
            count += 85;
          }
        }
      }
    }
    return count;
  }
  /**
   * Create a summary of the conversation
   *
   * Useful for creating compressed context when memory is full.
   *
   * @example
   * ```typescript
   * const summary = await memory.summarize();
   * console.log(summary);
   * // "Conversation started with greeting. User asked about..."
   * ```
   */
  async summarize() {
    const messages = await this.getAll();
    if (messages.length === 0) {
      return "No messages in conversation.";
    }
    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter((m) => m.role === "assistant").length;
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    return `Conversation with ${messageCount} messages (${userMessages} from user, ${assistantMessages} from assistant). Started with: "${typeof firstMessage.content === "string" ? firstMessage.content.slice(0, 50) : "[multimodal]"}...". Latest: "${typeof lastMessage.content === "string" ? lastMessage.content.slice(0, 50) : "[multimodal]"}..."`;
  }
  /**
   * Get storage adapter
   */
  getStorage() {
    return this.storage;
  }
  /**
   * Get configuration
   */
  getConfig() {
    return {
      maxMessages: this.maxMessages,
      maxAge: this.maxAge,
      autoTimestamp: this.autoTimestamp
    };
  }
};

// src/memory/IndexedDBStorage.ts
var IndexedDBStorage = class {
  dbName;
  storeName = "messages";
  version = 1;
  dbPromise = null;
  constructor(dbName = "browser-operator-memory") {
    this.dbName = dbName;
  }
  /**
   * Initialize IndexedDB connection
   */
  async getDB() {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: "id",
            autoIncrement: true
          });
          objectStore.createIndex("role", "role", { unique: false });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
    return this.dbPromise;
  }
  /**
   * Add a message to storage
   */
  async add(message) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp ?? Date.now()
      };
      const request = objectStore.add(messageWithTimestamp);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add message: ${request.error?.message}`));
    });
  }
  /**
   * Get all messages
   */
  async getAll() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();
      request.onsuccess = () => {
        const messages = request.result.map(({ id, ...msg }) => msg);
        resolve(messages);
      };
      request.onerror = () => reject(new Error(`Failed to get messages: ${request.error?.message}`));
    });
  }
  /**
   * Get messages with filtering
   */
  async get(options) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      let request;
      if (options?.role) {
        const index = objectStore.index("role");
        request = index.getAll(options.role);
      } else if (options?.since || options?.until) {
        const index = objectStore.index("timestamp");
        const range = IDBKeyRange.bound(
          options.since ?? 0,
          options.until ?? Date.now() + 1e6,
          false,
          false
        );
        request = index.getAll(range);
      } else {
        request = objectStore.getAll();
      }
      request.onsuccess = () => {
        let messages = request.result.map(({ id, ...msg }) => msg);
        if (options?.since) {
          messages = messages.filter((msg) => (msg.timestamp ?? 0) >= options.since);
        }
        if (options?.until) {
          messages = messages.filter(
            (msg) => (msg.timestamp ?? Infinity) <= options.until
          );
        }
        if (options?.offset) {
          messages = messages.slice(options.offset);
        }
        if (options?.limit) {
          messages = messages.slice(0, options.limit);
        }
        resolve(messages);
      };
      request.onerror = () => reject(new Error(`Failed to get messages: ${request.error?.message}`));
    });
  }
  /**
   * Search messages by content
   */
  async search(query, options) {
    const allMessages = await this.getAll();
    const normalizedQuery = options?.caseSensitive ? query : query.toLowerCase();
    let filtered = allMessages.filter((msg) => {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      const normalizedContent = options?.caseSensitive ? content : content.toLowerCase();
      if (normalizedContent.includes(normalizedQuery)) {
        return true;
      }
      if (options?.searchMetadata && msg.metadata) {
        const metadata = JSON.stringify(msg.metadata);
        const normalizedMetadata = options?.caseSensitive ? metadata : metadata.toLowerCase();
        if (normalizedMetadata.includes(normalizedQuery)) {
          return true;
        }
      }
      return false;
    });
    if (options?.role) {
      filtered = filtered.filter((msg) => msg.role === options.role);
    }
    if (options?.since) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? 0) >= options.since);
    }
    if (options?.until) {
      filtered = filtered.filter((msg) => (msg.timestamp ?? Infinity) <= options.until);
    }
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }
  /**
   * Clear all messages
   */
  async clear() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear messages: ${request.error?.message}`));
    });
  }
  /**
   * Get number of messages
   */
  async count() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count messages: ${request.error?.message}`));
    });
  }
  /**
   * Close database connection
   */
  close() {
    if (this.dbPromise) {
      this.dbPromise.then((db) => db.close());
      this.dbPromise = null;
    }
  }
};

export { ConversationBufferMemory, InMemoryStorage, IndexedDBStorage };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map