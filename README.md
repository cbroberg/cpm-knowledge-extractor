# CPM Knowledge Extractor

> Extract best practices, conventions, and patterns from Git repositories into structured Knowledge Fragments for [CPM](https://codepromptmaker.com) Prompt Contracts.

## What This Does

Modern repos contain a wealth of embedded knowledge — in CLAUDE.md files, convention docs, config files, and code patterns. This tool extracts that knowledge into structured, searchable fragments that CPM uses to generate better Prompt Contracts.

### Sources It Reads

| File | Signal Quality | What It Contains |
|------|---------------|------------------|
| `CLAUDE.md` | ★★★★★ | Explicit AI coding instructions |
| `.cursorrules` | ★★★★☆ | AI-specific conventions |
| `AGENTS.md` | ★★★★☆ | Agent-specific instructions |
| `CONVENTIONS.md` | ★★★★☆ | Team coding conventions |
| `CONTRIBUTING.md` | ★★★☆☆ | Code style, PR process |
| `docs/` | ★★★☆☆ | Architecture decisions, patterns |
| Config files | ★★☆☆☆ | Machine-readable rules |
| Source code | ★★☆☆☆ | Implemented patterns |

### What It Produces

Structured **Knowledge Fragments** in JSON:

```json
{
  "stack": ["next.js@16", "tailwind@4"],
  "category": "auth-pattern",
  "type": "pattern",
  "title": "Use middleware for auth checks in App Router",
  "description": "Always validate auth in middleware.ts rather than in individual route handlers...",
  "source": { "repo": "vercel/next.js", "file": "CLAUDE.md" },
  "confidence": "high"
}
```

## Quick Start

```bash
# Clone this repo
git clone https://github.com/cbroberg/cpm-knowledge-extractor.git
cd cpm-knowledge-extractor
npm install

# Extract from a repo URL
node src/index.js https://github.com/shadcn-ui/ui

# Extract from a local repo
node src/index.js /path/to/local/repo

# Extract from multiple repos (batch)
node src/index.js --batch repos.txt

# Output to specific file
node src/index.js https://github.com/vercel/next.js --output next-knowledge.json
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

## Recommended Repos to Extract From

For a Next.js + Tailwind + Supabase + Drizzle stack:

```bash
# Core frameworks
node src/index.js https://github.com/vercel/next.js
node src/index.js https://github.com/tailwindlabs/tailwindcss
node src/index.js https://github.com/drizzle-team/drizzle-orm
node src/index.js https://github.com/supabase/supabase

# Reference implementations
node src/index.js https://github.com/shadcn-ui/ui
node src/index.js https://github.com/vercel/commerce
node src/index.js https://github.com/vercel/ai

# Good CLAUDE.md examples
node src/index.js https://github.com/anthropics/anthropic-cookbook
```

## How CPM Uses Knowledge Fragments

When CPM generates a Prompt Contract, it queries the Knowledge Bank based on:
1. **Project stack** (detected from package.json)
2. **Task type** (e.g., "create API route", "add auth")
3. **Category relevance** (error-handling for backend tasks, etc.)

Matching fragments are injected into the `CONSTRAINTS` section of the Prompt Contract, making every AI session stack-aware and convention-compliant.

## Part of the CPM Ecosystem

This is a standalone prototype that will be integrated into CPM as the `cpm knowledge extract` command. See the [CPM roadmap](https://codepromptmaker.com) for details.

## License

MIT
