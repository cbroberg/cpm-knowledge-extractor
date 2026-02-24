# CLAUDE.md — cpm-knowledge-extractor

## Project Overview

Standalone CLI tool that extracts best practices, conventions, and patterns from Git repositories into structured **Knowledge Fragments** for use in CPM (CodePromptMaker) Prompt Contracts.

## Stack

- Node.js 20+ with ES modules (import/export)
- Zero heavy dependencies — uses Node built-ins (fs, path, child_process)
- Only external dep: dotenv for .env secrets
- Output format: JSON (primary), YAML (optional)

## Hard Rules

- ALWAYS use ES modules with import statements, never require()
- ALWAYS use async/await, never callbacks
- ALWAYS handle errors with try/catch, never silent failures
- Use node:fs/promises, node:path, node:child_process — with node: prefix
- No TypeScript — plain JavaScript with JSDoc comments for types
- Console output uses structured logging: [INFO], [WARN], [ERROR] prefixes
- All file paths use path.join() — never string concatenation
- Git operations use child_process.execSync — no git libraries
- Clone uses `gh repo clone` (inherits CLI auth for private repos) with fallback to plain git
- Classification must support both English and Danish signal words
- Monorepo workspace packages (apps/*, packages/*) must be scanned for stack detection

## File Structure

```
src/
  index.js          # CLI entry point
  discover.js       # Find knowledge-bearing files in a repo
  detect-stack.js   # Detect tech stack from config files
  extract.js        # Parse files into raw knowledge blocks
  classify.js       # Categorize and structure Knowledge Fragments
  output.js         # Format and write output
  patterns/         # Stack-specific pattern matchers
    nextjs.js
    tailwind.js
    drizzle.js
    supabase.js
output/             # Generated Knowledge Fragments land here
```

## Knowledge Fragment Schema

Every extracted piece of knowledge must conform to this structure:

```json
{
  "id": "unique-hash",
  "stack": ["next.js@16", "tailwind@4"],
  "category": "error-handling|auth-pattern|testing|file-structure|naming|security|performance|conventions",
  "type": "rule|pattern|anti-pattern|convention",
  "title": "Short descriptive title",
  "description": "The actual best practice or pattern",
  "example": "Optional code example",
  "source": {
    "repo": "owner/repo",
    "file": "CLAUDE.md",
    "line": 42,
    "url": "https://github.com/owner/repo/blob/main/CLAUDE.md#L42"
  },
  "confidence": "high|medium|low",
  "tags": ["app-router", "middleware", "auth"]
}
```

## Priority Sources (in extraction order)

1. CLAUDE.md — highest signal, explicit AI instructions
2. .cursorrules / .cursor/rules — cursor AI conventions
3. .clinerules — cline AI conventions
4. AGENTS.md — agent-specific instructions
5. CONVENTIONS.md — explicit team conventions
6. CONTRIBUTING.md — code style and contribution rules
7. README.md — setup patterns, architecture notes
8. docs/ directory — deeper documentation
9. Config files (.eslintrc, tsconfig.json, .prettierrc) — machine-readable rules
10. Source code — pattern detection from actual implementation

## Testing

Use Node.js built-in test runner (node:test). Test against known repos with predictable content.

## Current State

Prototype — focus on correctness over features. Get the extraction pipeline working end-to-end for a single repo before optimizing.
