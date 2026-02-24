import { readdir, stat } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

/**
 * Priority-ordered list of knowledge-bearing files to look for.
 * Higher priority = more signal for AI best practices.
 */
const KNOWLEDGE_FILES = [
  // Priority 1: AI-specific instruction files (★★★★★)
  { pattern: 'CLAUDE.md', priority: 1, category: 'ai-instructions' },
  { pattern: '.cursorrules', priority: 1, category: 'ai-instructions' },
  { pattern: '.cursor/rules', priority: 1, category: 'ai-instructions' },
  { pattern: '.clinerules', priority: 1, category: 'ai-instructions' },
  { pattern: 'AGENTS.md', priority: 1, category: 'ai-instructions' },
  { pattern: 'copilot-instructions.md', priority: 1, category: 'ai-instructions' },
  { pattern: '.github/copilot-instructions.md', priority: 1, category: 'ai-instructions' },

  // Priority 2: Explicit convention docs (★★★★☆)
  { pattern: 'CONVENTIONS.md', priority: 2, category: 'conventions' },
  { pattern: 'CODING_STANDARDS.md', priority: 2, category: 'conventions' },
  { pattern: 'STYLE_GUIDE.md', priority: 2, category: 'conventions' },
  { pattern: 'ARCHITECTURE.md', priority: 2, category: 'architecture' },
  { pattern: 'DESIGN.md', priority: 2, category: 'architecture' },

  // Priority 3: Standard project docs (★★★☆☆)
  { pattern: 'CONTRIBUTING.md', priority: 3, category: 'contributing' },
  { pattern: 'README.md', priority: 3, category: 'readme' },
  { pattern: 'SECURITY.md', priority: 3, category: 'security' },

  // Priority 4: Config files with implicit rules (★★☆☆☆)
  { pattern: '.eslintrc.json', priority: 4, category: 'linting' },
  { pattern: '.eslintrc.js', priority: 4, category: 'linting' },
  { pattern: '.eslintrc.cjs', priority: 4, category: 'linting' },
  { pattern: 'eslint.config.js', priority: 4, category: 'linting' },
  { pattern: 'eslint.config.mjs', priority: 4, category: 'linting' },
  { pattern: 'tsconfig.json', priority: 4, category: 'typescript' },
  { pattern: '.prettierrc', priority: 4, category: 'formatting' },
  { pattern: '.prettierrc.json', priority: 4, category: 'formatting' },
  { pattern: 'biome.json', priority: 4, category: 'linting' },
];

/**
 * Discover knowledge-bearing files in a repo
 * @param {string} repoPath - Root path of the repo
 * @returns {Promise<Array<{ path: string, relativePath: string, priority: number, category: string }>>}
 */
export async function discoverFiles(repoPath) {
  const found = [];

  // Check for known files
  for (const knownFile of KNOWLEDGE_FILES) {
    const fullPath = join(repoPath, knownFile.pattern);
    try {
      const s = await stat(fullPath);
      if (s.isFile()) {
        found.push({
          path: fullPath,
          relativePath: knownFile.pattern,
          priority: knownFile.priority,
          category: knownFile.category,
        });
      }
    } catch {
      // File doesn't exist — skip
    }
  }

  // Scan docs/ directory if it exists
  const docsDir = join(repoPath, 'docs');
  try {
    const docsStat = await stat(docsDir);
    if (docsStat.isDirectory()) {
      const docFiles = await scanDocsDir(docsDir, repoPath);
      found.push(...docFiles);
    }
  } catch {
    // No docs/ directory
  }

  // Sort by priority (lowest number = highest priority)
  found.sort((a, b) => a.priority - b.priority);

  return found;
}

/**
 * Recursively scan docs/ directory for markdown files
 * @param {string} dirPath
 * @param {string} repoRoot
 * @param {number} depth
 * @returns {Promise<Array>}
 */
async function scanDocsDir(dirPath, repoRoot, depth = 0) {
  const maxDepth = parseInt(process.env.MAX_DOCS_DEPTH || '3', 10);
  if (depth > maxDepth) return [];

  const results = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const nested = await scanDocsDir(fullPath, repoRoot, depth + 1);
      results.push(...nested);
    } else if (entry.isFile() && /\.(md|mdx|txt)$/i.test(entry.name)) {
      results.push({
        path: fullPath,
        relativePath: relative(repoRoot, fullPath),
        priority: 3,
        category: 'documentation',
      });
    }
  }

  return results;
}
