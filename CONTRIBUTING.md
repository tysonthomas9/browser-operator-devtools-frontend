# Contributing to Browser Operator

Thank you for your interest in contributing to Browser Operator! We welcome contributions from the community, whether it's bug reports, feature requests, documentation improvements, or code contributions.

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git
- macOS 10.15+ or Windows 10 (64-bit)+
- 8GB RAM (16GB recommended)

### Setup

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/browser-operator-core.git
   cd browser-operator-core
   ```
3. **Set up your development environment:**
   See our [build instructions](https://docs.browseroperator.io) for detailed setup steps

## 💻 Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run linters
npm run lint

# Run tests
npm run test

# Run web tests
npm run webtest

# Build the project
npm run build
```

### 4. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git commit -m "Add feature: description of what you added"
# or
git commit -m "Fix: description of what you fixed"
```

**Add license header to new files:**
```typescript
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
```

## 📬 Submitting Your Changes

### 1. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 2. Open a Pull Request

1. Go to the [Browser Operator repository](https://github.com/BrowserOperator/browser-operator-core)
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template with:
   - Clear description of changes
   - Reference to related issues (if any)
   - Screenshots/videos for UI changes
   - Testing steps

### 3. Review Process

- A maintainer will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged

## 🎯 Contribution Areas

### Bug Reports

Found a bug? [Open an issue](https://github.com/BrowserOperator/browser-operator-core/issues) with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser version and OS

### Feature Requests

Have an idea? [Open an issue](https://github.com/BrowserOperator/browser-operator-core/issues) with:
- Clear description of the feature
- Use case and benefits
- Any relevant examples or mockups

### Documentation

Help improve our docs:
- Fix typos or unclear explanations
- Add examples or tutorials
- Translate documentation
- Update outdated information

### Code Contributions

Areas where you can contribute code:
- **New Tools**: Add new tools for the agent framework
- **New Agents**: Create specialized agents for specific tasks
- **UI Improvements**: Enhance the user interface
- **Bug Fixes**: Fix reported issues
- **Performance**: Optimize existing code
- **Tests**: Add or improve test coverage

### Agent Framework Development

Contributing new agents or tools? See:
- [Agent Framework Documentation](front_end/panels/ai_chat/agent_framework/Readme.md)
- [Creating Custom Agents](front_end/panels/ai_chat/core/Readme.md)
- Browse existing tools in [front_end/panels/ai_chat/tools/](front_end/panels/ai_chat/tools/)

## 📝 Code Style

- **TypeScript**: Follow existing patterns and conventions
- **Linting**: Code must pass `npm run lint`
- **Testing**: Add tests for new features
- **Comments**: Document complex logic
- **Types**: Use proper TypeScript types

## 🤝 Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Provide constructive feedback
- Treat everyone with respect

### Communication Channels

- **Discord**: [Join our community](https://discord.gg/fp7ryHYBSY)
- **GitHub Issues**: For bugs and features
- **GitHub Discussions**: For questions and ideas

## 📄 License

By contributing to Browser Operator, you agree that your contributions will be licensed under the [BSD-3-Clause License](LICENSE).

---

**Questions?** Join our [Discord community](https://discord.gg/fp7ryHYBSY) or open a [GitHub Discussion](https://github.com/BrowserOperator/browser-operator-core/discussions).

Thank you for contributing to Browser Operator! 🎉
