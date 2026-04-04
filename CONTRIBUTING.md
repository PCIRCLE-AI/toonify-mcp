# Contributing

Thank you for considering a contribution to `toonify-mcp`.

This project is a practical developer tool for Claude Code and MCP workflows. Contributions are welcome, especially when they improve correctness, usability, performance transparency, and public documentation quality.

## Good contribution areas

- bug fixes with clear reproduction steps
- compression safety improvements
- token-counting accuracy and format detection
- tests for edge cases and regressions
- documentation improvements that match actual shipped behavior

## Before you open a pull request

1. Install dependencies

```bash
npm install
```

2. Run tests

```bash
npm test
```

3. Build the project

```bash
npm run build
```

## Contribution guidelines

- Keep changes scoped. Small, focused pull requests are preferred.
- Do not claim savings, performance, or compatibility improvements without evidence.
- Do not commit local tooling artifacts such as `.codex/`, `.playwright-mcp/`, local plans, or personal notes.
- If you change public behavior or installation guidance, update the relevant README or docs in the same pull request.
- If you add or rename MCP tools, plugin behavior, or hooks, document the change clearly.

## Documentation expectations

- Keep README examples accurate and runnable.
- Prefer concise public docs over internal planning notes.
- If you update the English README in a substantial way, consider whether the Traditional Chinese README should also be updated.

## Security-sensitive changes

If your change affects:

- hook execution
- path handling
- caching persistence
- file writes
- content detection or parsing boundaries

please explain the risk tradeoff clearly in the pull request description.

## Need help?

- Usage questions and general support: open a GitHub issue
- Security issues: see [SECURITY.md](SECURITY.md)
- Commercial or partnership questions: see [SUPPORT.md](SUPPORT.md)
