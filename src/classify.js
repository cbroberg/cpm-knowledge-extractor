import { createHash } from 'node:crypto';

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
 * Classify raw knowledge blocks into structured Knowledge Fragments
 * @param {Array} rawBlocks - From extract.js
 * @param {Array} stack - Detected stack from detect-stack.js
 * @param {{ owner: string, name: string, url: string }} repoInfo
 * @returns {Array} Classified Knowledge Fragments
 */
export function classifyFragments(rawBlocks, stack, repoInfo) {
  const fragments = [];

  for (const block of rawBlocks) {
    const category = detectCategory(block.content, block.section);
    const type = detectType(block.content);
    const tags = extractTags(block.content, stack);
    const confidence = calculateConfidence(block);

    // Generate deterministic ID from content + source
    const id = createHash('sha256')
      .update(`${repoInfo.url}:${block.file}:${block.lineStart}`)
      .digest('hex')
      .substring(0, 12);

    fragments.push({
      id,
      stack: stack.map(s => s.version ? `${s.name}@${s.version}` : s.name),
      category,
      type,
      title: generateTitle(block),
      description: block.content.substring(0, 500),
      fullContent: block.content,
      example: extractCodeExample(block.content),
      source: {
        repo: `${repoInfo.owner}/${repoInfo.name}`,
        file: block.file,
        line: block.lineStart,
        url: repoInfo.url
          ? `${repoInfo.url}/blob/main/${block.file}#L${block.lineStart}`
          : '',
      },
      confidence,
      tags,
    });
  }

  return fragments;
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
  const lower = content.toLowerCase();

  for (const [type, signals] of Object.entries(TYPE_SIGNALS)) {
    if (signals.some(signal => lower.includes(signal))) {
      return type;
    }
  }

  return 'convention';
}

function extractTags(content, stack) {
  const tags = new Set();

  // Add stack names as tags
  for (const item of stack) {
    tags.add(item.name);
  }

  // Extract technology mentions from content
  const techTerms = [
    'app-router', 'pages-router', 'server-component', 'client-component',
    'middleware', 'api-route', 'server-action', 'ssr', 'ssg', 'isr',
    'monorepo', 'workspace', 'turbo', 'pnpm',
    'migration', 'schema', 'seed',
    'dark-mode', 'responsive', 'a11y', 'accessibility',
  ];

  const lower = content.toLowerCase();
  for (const term of techTerms) {
    if (lower.includes(term.replace('-', ' ')) || lower.includes(term)) {
      tags.add(term);
    }
  }

  return Array.from(tags);
}

function calculateConfidence(block) {
  // AI instruction files = highest confidence
  if (block.category === 'ai-instructions') return 'high';
  // Explicit conventions = high
  if (block.category === 'conventions' || block.category === 'architecture') return 'high';
  // Documentation = medium
  if (block.priority <= 3) return 'medium';
  // Config files = medium (machine-readable but less context)
  return 'low';
}

function generateTitle(block) {
  // Use section heading if available
  if (block.section && block.section !== 'preamble') {
    return block.section.replace(/^#+\s*/, '').substring(0, 100);
  }

  // Use first non-empty line
  const firstLine = block.content.split('\n').find(l => l.trim().length > 0);
  if (firstLine) {
    return firstLine.replace(/^[#*\-\s]+/, '').substring(0, 100);
  }

  return `${block.file} — ${block.category}`;
}

function extractCodeExample(content) {
  const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : null;
}
