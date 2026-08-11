#!/usr/bin/env node
// Separate script file instead of an inline `node -e "..."` string in
// package.json: the previous inline version had backticks inside a
// double-quoted shell string, which `sh -c` interprets as command
// substitution (running `npm install -g .` etc. for real) instead of the
// literal markdown-style code formatting they were meant to be — broke
// every CI install with "SyntaxError: Invalid or unexpected token". A real
// .js file has normal JS string literals with no shell-quoting layer to
// get wrong.
console.log(`
📦 Toonify MCP installed!

If you are installing from a local clone, finish with 'npm install -g .' first.
Then run 'toonify-mcp setup' for plugin mode, or 'toonify-mcp setup mcp' for MCP mode.
Then verify with 'toonify-mcp doctor'.
`);
