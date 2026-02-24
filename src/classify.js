import { createHash } from 'node:crypto';

/**
 * Determine if a block describes a rule, pattern, anti-pattern, or convention
 * Supports both English and Danish signal words
 */
const TYPE_SIGNALS = {
  'anti-pattern': [
    'never', 'don\'t', 'avoid', 'do not', 'bad', 'wrong', 'anti-pattern', 'deprecated', 'instead of',
    'aldrig', 'undgå', 'brug ikke', 'forkert', '❌',
  ],
  'rule': [
    'must', 'always', 'required', 'shall', 'enforce', 'mandatory',
    'skal', 'altid', 'påkrævet', 'obligatorisk', 'vigtigt', 'VIGTIGT', 'non-negotiable', 'hårde regler',
  ],
  'pattern': [
    'pattern', 'approach', 'technique', 'strategy', 'example', 'how to', 'implementation',
    'mønster', 'tilgang', 'eksempel', 'sådan', '✅',
  ],
  'convention': [
    'convention', 'standard', 'style', 'format', 'naming', 'prefer', 'recommendation',
    'konvention', 'foretrækker', 'anbefaling',
  ],
};

/**
 * Categories for Knowledge Fragments
 * Each keyword has an optional weight multiplier (default 1)
 */
const CATEGORY_KEYWORDS = {
  'error-handling': ['error', 'catch', 'throw', 'exception', 'try', 'failure', 'retry', 'fallback', 'fejlhåndtering'],
  'auth-pattern': ['auth', 'authentication', 'authorization', 'login', 'session', 'jwt', 'token', 'middleware', 'clerk', 'supabase auth', 'biometric', 'face id'],
  'testing': ['test', 'spec', 'assert', 'expect', 'mock', 'stub', 'fixture', 'vitest', 'jest', 'playwright', 'coverage', 'e2e'],
  'file-structure': ['directory', 'folder', 'structure', 'layout', 'organize', 'colocation', 'barrel', 'index', 'monorepo'],
  'naming': ['naming', 'convention', 'camelcase', 'kebab', 'pascal', 'prefix', 'suffix', 'nomenclature'],
  'security': ['security', 'xss', 'csrf', 'injection', 'sanitize', 'escape', 'cors', 'csp', 'owasp', 'vulnerability', 'rls', 'row-level'],
  'performance': ['performance', 'cache', 'lazy', 'optimize', 'bundle', 'chunk', 'prefetch', 'preload', 'memo'],
  'conventions': ['convention', 'standard', 'rule', 'guideline', 'style', 'format', 'lint', 'prettier', 'regler', 'vigtigt', 'workflow', 'aldrig', 'altid'],
  'architecture': ['architecture', 'pattern', 'design', 'layer', 'module', 'separation', 'concern', 'dependency', 'arkitektur'],
  'api-design': ['api', 'endpoint', 'route', 'handler', 'request', 'response', 'rest', 'graphql', 'trpc'],
  'database': ['database', 'migration', 'schema', 'query', 'index', 'relation', 'foreign key', 'drizzle', 'prisma', 'supabase'],
  'deployment': ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'vercel', 'fly', 'github actions', 'pipeline', 'hosting', 'pm2'],
  'imports': ['import', 'export', 'module', 'require', 'barrel', 'path alias', 'absolute import'],
  'ui-patterns': ['component', 'button', 'input', 'form', 'modal', 'dialog', 'toast', 'badge', 'ui pattern', 'søgefelt', 'clear'],
  'git-workflow': ['git', 'commit', 'branch', 'merge', 'pull', 'push', 'rebase', 'workflow'],
};

/**
 * Section titles that strongly indicate a specific category (overrides keyword scoring)
 */
const TITLE_CATEGORY_OVERRIDES = {
  'conventions': [/regler/i, /rules/i, /conventions/i, /standards/i, /vigtigt/i, /important/i, /hård/i, /hard/i],
  'ui-patterns': [/ui pattern/i, /component/i, /knap/i, /button/i, /søge/i, /search/i],
  'git-workflow': [/git/i, /commit/i, /workflow/i],
  'deployment': [/deploy/i, /hosting/i, /env/i, /sync/i],
  'testing': [/test/i, /e2e/i, /spec/i],
  'auth-pattern': [/auth/i, /login/i, /role/i, /rbac/i, /rolle/i],
};

/**
 * Classify extracted blocks into Knowledge Fragments
 * @param {Array} blocks - Raw extracted blocks
 * @param {Array} stack - Detected stack
 * @param {{ owner: string, name: string, url: string }} repoInfo
 * @returns {Array} Knowledge Fragments
 */
export function classifyFragments(blocks, stack, repoInfo) {
  const stackStrings = stack.map(s => s.version ? `${s.name}@${s.version}` : s.name);

  return blocks.map(block => {
    const category = detectCategory(block.content, block.section);
    const type = detectType(block.content);
    const tags = extractTags(block.content, stack);

    // Generate deterministic ID
    const id = createHash('sha256')
      .update(`${repoInfo.owner}/${repoInfo.name}:${block.file}:${block.line}`)
      .digest('hex')
      .slice(0, 12);

    return {
      id,
      stack: stackStrings,
      category,
      type,
      title: block.section || block.file,
      description: block.content.slice(0, 500),
      example: extractCodeExample(block.content),
      source: {
        repo: `${repoInfo.owner}/${repoInfo.name}`,
        file: block.file,
        line: block.line,
        url: `${repoInfo.url}/blob/main/${block.file}#L${block.line}`,
      },
      confidence: detectConfidence(block),
      tags,
    };
  });
}

function detectCategory(content, sectionTitle = '') {
  // Check title overrides first — section headings are strongest signal
  if (sectionTitle) {
    for (const [category, patterns] of Object.entries(TITLE_CATEGORY_OVERRIDES)) {
      if (patterns.some(p => p.test(sectionTitle))) {
        return category;
      }
    }
  }

  const lower = content.toLowerCase();
  let bestCategory = 'conventions';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((sum, kw) => {
      const regex = new RegExp(kw, 'gi');
      const matches = lower.match(regex);
      return sum + (matches ? matches.length : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function detectType(content) {
  const scores = {};
  for (const [type, signals] of Object.entries(TYPE_SIGNALS)) {
    scores[type] = signals.reduce((sum, signal) => {
      const regex = new RegExp(signal, 'gi');
      const matches = content.match(regex);
      return sum + (matches ? matches.length : 0);
    }, 0);
  }

  // Find highest scoring type
  let bestType = 'convention';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

function detectConfidence(block) {
  // CLAUDE.md and similar files are highest signal
  const highSignalFiles = ['CLAUDE.md', '.cursorrules', '.clinerules', 'AGENTS.md', 'CONVENTIONS.md'];
  if (highSignalFiles.includes(block.file)) return 'high';

  // Config files with explicit rules
  if (block.file.includes('eslint') || block.file.includes('prettier')) return 'high';

  // CONTRIBUTING.md and docs are good
  if (block.file === 'CONTRIBUTING.md' || block.file.startsWith('docs/')) return 'medium';

  // README is lower signal
  if (block.file === 'README.md') return 'medium';

  return 'medium';
}

function extractCodeExample(content) {
  const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : null;
}

function extractTags(content, stack) {
  const tags = stack.map(s => s.name);

  // Extract technology mentions from content
  const techPatterns = [
    { pattern: /app.?router/i, tag: 'app-router' },
    { pattern: /pages.?router/i, tag: 'pages-router' },
    { pattern: /server.?component/i, tag: 'server-component' },
    { pattern: /client.?component|'use client'/i, tag: 'client-component' },
    { pattern: /middleware/i, tag: 'middleware' },
    { pattern: /api.?route/i, tag: 'api-route' },
    { pattern: /migration/i, tag: 'migration' },
    { pattern: /schema/i, tag: 'schema' },
    { pattern: /docker/i, tag: 'docker' },
    { pattern: /github.?action/i, tag: 'github-actions' },
    { pattern: /rls|row.level.security/i, tag: 'rls' },
    { pattern: /capacitor/i, tag: 'capacitor' },
    { pattern: /pwa|service.worker|serwist/i, tag: 'pwa' },
  ];

  for (const { pattern, tag } of techPatterns) {
    if (pattern.test(content) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}
