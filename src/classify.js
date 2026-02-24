import { createHash } from 'node:crypto';

/**
 * Categories for Knowledge Fragments
 */
const CATEGORY_KEYWORDS = {
  'error-handling': ['error', 'catch', 'throw', 'exception', 'try', 'failure', 'retry', 'fallback'],
  'auth-pattern': ['auth', 'authentication', 'authorization', 'login', 'session', 'jwt', 'token', 'middleware', 'clerk', 'supabase auth'],
  'testing': ['test', 'spec', 'assert', 'expect', 'mock', 'stub', 'fixture', 'vitest', 'jest', 'playwright', 'coverage'],
  'file-structure': ['directory', 'folder', 'structure', 'layout', 'organize', 'colocation', 'barrel', 'index'],
  'naming': ['naming', 'convention', 'camelcase', 'kebab', 'pascal', 'prefix', 'suffix', 'nomenclature'],
  'security': ['security', 'xss', 'csrf', 'injection', 'sanitize', 'escape', 'cors', 'csp', 'owasp', 'vulnerability'],
  'performance': ['performance', 'cache', 'lazy', 'optimize', 'bundle', 'chunk', 'prefetch', 'preload', 'memo'],
  'conventions': ['convention', 'standard', 'rule', 'guideline', 'style', 'format', 'lint', 'prettier'],
  'architecture': ['architecture', 'pattern', 'design', 'layer', 'module', 'separation', 'concern', 'dependency'],
  'api-design': ['api', 'endpoint', 'route', 'handler', 'request', 'response', 'rest', 'graphql', 'trpc'],
  'database': ['database', 'migration', 'schema', 'query', 'index', 'relation', 'foreign key', 'drizzle', 'prisma'],
  'deployment': ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'vercel', 'fly', 'github actions', 'pipeline'],
  'imports': ['import', 'export', 'module', 'require', 'barrel', 'path alias', 'absolute import'],
};

/**
 * Determine if a block describes a rule, pattern, anti-pattern, or convention
 */
const TYPE_SIGNALS = {
  'anti-pattern': ['never', 'don\'t', 'avoid', 'do not', 'bad', 'wrong', 'anti-pattern', 'deprecated', 'instead of'],
  'rule': ['must', 'always', 'required', 'shall', 'enforce', 'mandatory'],
  'pattern': ['pattern', 'approach', 'technique', 'strategy', 'example', 'how to', 'implementation'],
  'convention': ['convention', 'standard', 'style', 'format', 'naming', 'prefer', 'recommendation'],
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
    const category = detectCategory(block.content);
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

function detectCategory(content) {
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
