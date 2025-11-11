# AI Chat Panel Documentation

> **Multi-agent browser automation framework for Chromium DevTools**

Welcome to the AI Chat Panel documentation! This guide will help you understand, use, and extend the AI Chat framework.

## 🚀 Quick Start

**New to AI Chat?** Start here:
1. [Quick Start Guide](./Quick-Start.md) - Get running in 5 minutes
2. [User Guide](./User-Guide.md) - Learn to use AI Chat in DevTools
3. [Architecture Overview](./Architecture-Overview.md) - Understand the system

**Time to first success:** ~5 minutes

---

## 📚 Documentation Map

### For End Users

**Start here if you're using AI Chat in DevTools:**

- 📖 [**User Guide**](./User-Guide.md) - Complete guide for DevTools users
  - Opening the AI Chat panel
  - Configuring API keys and providers
  - Running your first task
  - Understanding agent responses
  - Troubleshooting common issues

- ⚡ [**Quick Start**](./Quick-Start.md) - 5-minute tutorial
  - Minimal setup
  - First agent example
  - Verify it works

### For Developers

**Start here if you're building on AI Chat:**

- 🏗️ [**Architecture Overview**](./Architecture-Overview.md) - High-level system design
  - 7-layer architecture
  - Multi-agent system
  - Key components

- 🔧 [**Development Guide**](./Development-Guide.md) - Complete developer onboarding
  - Setup and installation
  - Project structure
  - Development workflow
  - Testing and debugging

- 🏛️ [**Architecture Deep Dive**](./Architecture-Deep-Dive.md) - Detailed technical architecture
  - Layer-by-layer breakdown
  - Implementation details
  - Data flows and patterns

### Reference Documentation

**Comprehensive references for all components:**

- 🛠️ [**Tools Reference**](./Tools-Reference.md) - Complete catalog of 47 tools
  - Browser/Page tools (16)
  - Data collection tools (6)
  - File management tools (5)
  - Quality assurance tools (2)
  - Development tools (1)
  - Utility tools (2)
  - MCP tools (2)
  - Agent tools (13)

- 🤖 [**Specialized Agents**](./Specialized-Agents.md) - All 13+ agent types
  - Action agents (5)
  - Research agents (2)
  - Orchestration agents (2)
  - Content agents (1)
  - E-commerce agents (1)
  - Creating custom agents

- 🔌 [**LLM Providers**](./LLM-Providers.md) - Provider comparison and setup
  - OpenAI
  - LiteLLM (Claude, Gemini, Mistral)
  - Groq
  - OpenRouter
  - BrowserOperator

### Testing & Quality

- ✅ [**Evaluation Guide**](./Evaluation-Guide.md) - Testing framework
  - Test case structure
  - Assertion types
  - Rule-based and LLM-based evaluation
  - Metrics and reporting

- 🔍 [**Tracing Guide**](../tracing/README.md) - Observability with Langfuse
  - Setup and configuration
  - Trace anatomy
  - Monitoring and debugging

### Additional Resources

- 📝 [**Glossary**](./Glossary.md) - Key terms and concepts
- 🐛 [**Troubleshooting**](./Troubleshooting.md) - Common issues and solutions
- 🗺️ [**Roadmap**](./FutureGraphExtensions.md) - Future plans and extensions

---

## 🎯 Common Use Cases

### "I want to automate web tasks"
1. Read the [User Guide](./User-Guide.md)
2. Learn about [Action Agents](./Specialized-Agents.md#action-agents)
3. Check [Tools Reference](./Tools-Reference.md) for available capabilities

### "I want to build a custom agent"
1. Read [Architecture Overview](./Architecture-Overview.md)
2. Study [Creating Custom Agents](./Specialized-Agents.md#creating-custom-agents)
3. Review [Development Guide](./Development-Guide.md)

### "I want to extract data from websites"
1. Check [SchemaBasedExtractorTool](./Tools-Reference.md#5-schemabasedextractortool)
2. Learn about [Research Agents](./Specialized-Agents.md#research-agents)
3. See [Data Collection Tools](./Tools-Reference.md#data-collection-tools)

### "I'm getting an error"
1. Check [Troubleshooting Guide](./Troubleshooting.md)
2. Review [Development Guide - Debugging](./Development-Guide.md#debugging)
3. Check [Glossary](./Glossary.md) for unfamiliar terms

### "I want to understand how it works"
1. Read [Architecture Overview](./Architecture-Overview.md) (15 min)
2. Watch the demo.gif in this directory
3. Deep dive into [Architecture Deep Dive](./Architecture-Deep-Dive.md)

---

## 🏗️ System Overview

**AI Chat Panel** is a sophisticated multi-agent browser automation framework integrated into Chromium DevTools.

### Key Capabilities

- **Multi-Provider LLM Support**: OpenAI, LiteLLM (Claude, Gemini, Mistral, etc.), Groq, OpenRouter
- **Multi-Agent Orchestration**: 13+ specialized agents with handoff capabilities
- **Rich Tool Ecosystem**: 47 tools for browser automation and data extraction
- **Real-Time Updates**: Event-driven architecture with streaming
- **Comprehensive Tracing**: Langfuse integration for observability
- **Evaluation Framework**: Built-in testing and validation

### Architecture at a Glance

```
┌─────────────────────────────────────────┐
│  UI Layer (Lit Components)              │
├─────────────────────────────────────────┤
│  Service/Orchestration (AgentService)   │
├─────────────────────────────────────────┤
│  Graph Execution (StateGraph)           │
├─────────────────────────────────────────┤
│  Agent Framework (Multi-Agent System)   │
├─────────────────────────────────────────┤
│  LLM Integration (5 Providers)          │
├─────────────────────────────────────────┤
│  Tools (47 Tools)                       │
├─────────────────────────────────────────┤
│  Supporting Systems (Tracing, MCP)      │
└─────────────────────────────────────────┘
```

Learn more: [Architecture Overview](./Architecture-Overview.md)

---

## 🎓 Learning Path

### Beginner Path (2 hours)
1. ⚡ [Quick Start](./Quick-Start.md) - 5 min
2. 📖 [User Guide](./User-Guide.md) - 20 min
3. 🏗️ [Architecture Overview](./Architecture-Overview.md) - 15 min
4. 🛠️ [Tools Reference](./Tools-Reference.md) - Browse available tools
5. Try it: Run your first automation task

### Intermediate Path (1 day)
1. Complete Beginner Path
2. 🔧 [Development Guide](./Development-Guide.md) - 1 hour
3. 🤖 [Specialized Agents](./Specialized-Agents.md) - 30 min
4. 🔌 [LLM Providers](./LLM-Providers.md) - 20 min
5. Try it: Create a simple custom agent

### Advanced Path (1 week)
1. Complete Intermediate Path
2. 🏛️ [Architecture Deep Dive](./Architecture-Deep-Dive.md) - 2 hours
3. ✅ [Evaluation Guide](./Evaluation-Guide.md) - 1 hour
4. 🔍 [Tracing Guide](../tracing/README.md) - 30 min
5. Try it: Build a production-ready agent with tests

---

## 💡 Key Concepts

Understanding these concepts will help you work effectively with AI Chat:

- **Agent**: An AI assistant with specific capabilities and tools (see [Glossary](./Glossary.md#agent))
- **Tool**: A function that agents can call to perform actions (see [Tools Reference](./Tools-Reference.md))
- **Handoff**: Transfer of control between agents (see [Agent Handoffs](./Specialized-Agents.md#agent-handoffs))
- **StateGraph**: State machine executor for graph-based workflows (see [Glossary](./Glossary.md#stategraph))
- **Node ID**: Identifier for elements in the accessibility tree (see [Glossary](./Glossary.md#node-id))

Full definitions: [Glossary](./Glossary.md)

---

## 🤝 Contributing

We welcome contributions! To get started:

1. Read the [Development Guide](./Development-Guide.md)
2. Check the [Roadmap](./FutureGraphExtensions.md) for planned features
3. See [Contributing Guidelines](./Development-Guide.md#contributing)

---

## 📞 Getting Help

**Need assistance?**

1. 🐛 [Troubleshooting Guide](./Troubleshooting.md) - Common issues and solutions
2. 📝 [Glossary](./Glossary.md) - Look up unfamiliar terms
3. 💬 [GitHub Issues](https://github.com/BrowserOperator/browser-operator-core/issues) - Report bugs or request features
4. 📖 [Development Guide - Debugging](./Development-Guide.md#debugging) - Debug techniques

---

## 📊 Documentation Statistics

- **Total Documentation**: ~7,500 lines
- **Number of Guides**: 10
- **Tools Documented**: 47
- **Agents Documented**: 13+
- **LLM Providers**: 5
- **Last Updated**: 2025-01-11

---

## 🗂️ Complete File Index

```
docs/
├── README.md (this file)           # Start here
├── Quick-Start.md                  # 5-minute tutorial
├── User-Guide.md                   # End-user guide
├── Architecture-Overview.md        # High-level architecture
├── Architecture-Deep-Dive.md       # Detailed architecture
├── Development-Guide.md            # Developer onboarding
├── Tools-Reference.md              # Complete tool catalog
├── Specialized-Agents.md           # All agent types
├── LLM-Providers.md               # Provider comparison
├── Evaluation-Guide.md            # Testing framework
├── Glossary.md                    # Key terms
├── Troubleshooting.md             # Common issues
├── FutureGraphExtensions.md       # Roadmap
├── MCP_OAuth_Implementation_Plan.md
└── ../tracing/README.md           # Tracing guide
```

---

## ⭐ Quick Links

| Link | Description |
|------|-------------|
| [🚀 Quick Start](./Quick-Start.md) | Get started in 5 minutes |
| [📖 User Guide](./User-Guide.md) | Complete user documentation |
| [🔧 Dev Guide](./Development-Guide.md) | Developer setup and workflow |
| [🛠️ Tools](./Tools-Reference.md) | All 47 tools |
| [🤖 Agents](./Specialized-Agents.md) | All 13+ agents |
| [🐛 Troubleshooting](./Troubleshooting.md) | Fix common issues |

---

*Happy automating! 🎉*
