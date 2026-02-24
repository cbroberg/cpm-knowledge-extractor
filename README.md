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

# Extract from a public repo (URL or shorthand)
node src/index.js https://github.com/shadcn-ui/ui
node src/index.js shadcn-ui/ui

# Extract from your own private repos (uses gh CLI auth)
node src/index.js webhousecode/fysiodk-aalborg-sport
node src/index.js webhousecode/my-saas-project

# Extract from a local repo
node src/index.js /path/to/local/repo

# Extract from multiple repos (batch)
node src/index.js --batch repos.txt

# Output to specific file
node src/index.js webhousecode/my-project --output my-knowledge.json

# Verbose mode (see what's happening)
node src/index.js webhousecode/my-project -v
```

### Private Repo Access

The extractor uses **`gh` CLI** for cloning, which inherits your GitHub authentication. This means:

- ✅ All your private repos work out of the box (if you're logged in via `gh auth login`)
- ✅ Shorthand `owner/repo` format works (no need for full URLs)
- ✅ Falls back to plain `git clone` if `gh` is not installed (public repos only)

```bash
# Check your gh auth status
gh auth status

# If not logged in
gh auth login
```

### Monorepo Support

The extractor automatically detects monorepos (pnpm workspaces, yarn workspaces) and scans **all workspace packages** for dependencies — not just the root `package.json`. This correctly detects stacks like Next.js, Supabase, Tailwind etc. that typically live in `apps/web/package.json`.

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

## Recommended Repos to Extract From

### Your own projects first (most relevant knowledge)

```bash
# Your own repos have the most relevant, battle-tested patterns
node src/index.js your-org/your-main-project
node src/index.js your-org/your-saas-app
```

### Then reference repos for your stack

For a **Next.js + Tailwind + Supabase + Drizzle** stack:

```bash
# UI framework reference
node src/index.js shadcn-ui/ui
node src/index.js vercel/ai

# Good CLAUDE.md / convention examples
node src/index.js anthropics/anthropic-cookbook
node src/index.js t3-oss/create-t3-app
node src/index.js steven-tey/dub
node src/index.js calcom/cal.com
```

> **Tip:** Large framework repos (vercel/next.js, tailwindlabs/tailwindcss) contain useful docs but also massive codebases. Start with smaller, well-documented repos that match your actual patterns.

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
