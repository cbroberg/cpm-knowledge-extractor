import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Stack detection rules — maps package names to stack identifiers
 */
const STACK_RULES = {
  // Frameworks
  'next': { name: 'next.js', category: 'framework' },
  'nuxt': { name: 'nuxt', category: 'framework' },
  'remix': { name: 'remix', category: 'framework' },
  'astro': { name: 'astro', category: 'framework' },
  'svelte': { name: 'svelte', category: 'framework' },
  'vue': { name: 'vue', category: 'framework' },
  'react': { name: 'react', category: 'ui' },
  'solid-js': { name: 'solid', category: 'ui' },
  'preact': { name: 'preact', category: 'ui' },

  // Styling
  'tailwindcss': { name: 'tailwind', category: 'styling' },
  '@tailwindcss/postcss': { name: 'tailwind', category: 'styling' },
  'styled-components': { name: 'styled-components', category: 'styling' },
  '@emotion/react': { name: 'emotion', category: 'styling' },

  // Database / ORM
  'drizzle-orm': { name: 'drizzle', category: 'database' },
  'prisma': { name: 'prisma', category: 'database' },
  '@prisma/client': { name: 'prisma', category: 'database' },
  '@supabase/supabase-js': { name: 'supabase', category: 'database' },
  '@supabase/ssr': { name: 'supabase-ssr', category: 'database' },
  'mongoose': { name: 'mongoose', category: 'database' },
  'typeorm': { name: 'typeorm', category: 'database' },

  // Auth
  '@clerk/nextjs': { name: 'clerk', category: 'auth' },
  'next-auth': { name: 'next-auth', category: 'auth' },
  '@auth/core': { name: 'authjs', category: 'auth' },
  'lucia': { name: 'lucia', category: 'auth' },

  // Testing
  'vitest': { name: 'vitest', category: 'testing' },
  'jest': { name: 'jest', category: 'testing' },
  '@playwright/test': { name: 'playwright', category: 'testing' },
  'cypress': { name: 'cypress', category: 'testing' },

  // Build / Monorepo
  'turbo': { name: 'turbo', category: 'build' },
  'nx': { name: 'nx', category: 'build' },
  'lerna': { name: 'lerna', category: 'build' },

  // Validation
  'zod': { name: 'zod', category: 'validation' },
  'yup': { name: 'yup', category: 'validation' },
  'valibot': { name: 'valibot', category: 'validation' },

  // State management
  'zustand': { name: 'zustand', category: 'state' },
  'jotai': { name: 'jotai', category: 'state' },
  '@tanstack/react-query': { name: 'tanstack-query', category: 'state' },
  'swr': { name: 'swr', category: 'state' },
  'redux': { name: 'redux', category: 'state' },
  '@reduxjs/toolkit': { name: 'redux-toolkit', category: 'state' },

  // Mobile
  '@capacitor/core': { name: 'capacitor', category: 'mobile' },
  'react-native': { name: 'react-native', category: 'mobile' },
  'expo': { name: 'expo', category: 'mobile' },

  // API
  '@trpc/server': { name: 'trpc', category: 'api' },
  'hono': { name: 'hono', category: 'api' },
  'express': { name: 'express', category: 'api' },
  'fastify': { name: 'fastify', category: 'api' },

  // AI
  'ai': { name: 'vercel-ai', category: 'ai' },
  '@anthropic-ai/sdk': { name: 'anthropic', category: 'ai' },
  'openai': { name: 'openai', category: 'ai' },
  'langchain': { name: 'langchain', category: 'ai' },
};

/**
 * Detect the tech stack from a repository
 * @param {string} repoPath
 * @returns {Promise<Array<{ name: string, version: string, category: string }>>}
 */
export async function detectStack(repoPath) {
  const stack = new Map();

  // 1. Check package.json (Node.js / JavaScript)
  try {
    const pkgJson = JSON.parse(await readFile(join(repoPath, 'package.json'), 'utf-8'));
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    for (const [dep, version] of Object.entries(allDeps)) {
      const rule = STACK_RULES[dep];
      if (rule) {
        stack.set(rule.name, {
          name: rule.name,
          version: cleanVersion(version),
          category: rule.category,
        });
      }
    }

    // Detect monorepo from workspaces
    if (pkgJson.workspaces || await fileExists(join(repoPath, 'pnpm-workspace.yaml'))) {
      stack.set('monorepo', { name: 'monorepo', version: '', category: 'build' });
    }

    // Detect package manager
    if (pkgJson.packageManager) {
      const [pm, ver] = pkgJson.packageManager.split('@');
      stack.set(pm, { name: pm, version: ver || '', category: 'build' });
    }
  } catch {
    // No package.json
  }

  // 2. Check pyproject.toml (Python)
  try {
    const pyproject = await readFile(join(repoPath, 'pyproject.toml'), 'utf-8');
    if (pyproject.includes('fastapi')) stack.set('fastapi', { name: 'fastapi', version: '', category: 'framework' });
    if (pyproject.includes('django')) stack.set('django', { name: 'django', version: '', category: 'framework' });
    if (pyproject.includes('flask')) stack.set('flask', { name: 'flask', version: '', category: 'framework' });
    if (pyproject.includes('langchain')) stack.set('langchain', { name: 'langchain', version: '', category: 'ai' });
  } catch {
    // No pyproject.toml
  }

  // 3. Check for UI component systems
  try {
    const components = JSON.parse(await readFile(join(repoPath, 'components.json'), 'utf-8'));
    if (components.style || components.$schema?.includes('shadcn')) {
      stack.set('shadcn', { name: 'shadcn', version: '', category: 'ui' });
    }
  } catch {
    // No components.json
  }

  // 4. Scan workspace packages for deeper stack detection (monorepos)
  if (stack.has('monorepo')) {
    const workspacePackages = await findWorkspacePackages(repoPath);
    for (const pkgPath of workspacePackages) {
      try {
        const pkgJson = JSON.parse(await readFile(pkgPath, 'utf-8'));
        const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
        for (const [dep, version] of Object.entries(allDeps)) {
          const rule = STACK_RULES[dep];
          if (rule && !stack.has(rule.name)) {
            stack.set(rule.name, {
              name: rule.name,
              version: cleanVersion(version),
              category: rule.category,
            });
          }
        }
      } catch {
        // Skip unreadable package.json
      }
    }
  }

  return Array.from(stack.values());
}

/**
 * Find all package.json files in workspace packages
 * @param {string} repoPath
 * @returns {Promise<string[]>}
 */
async function findWorkspacePackages(repoPath) {
  const results = [];

  // Common monorepo patterns
  const searchDirs = ['apps', 'packages', 'libs', 'services', 'tools'];

  for (const dir of searchDirs) {
    const dirPath = join(repoPath, dir);
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgPath = join(dirPath, entry.name, 'package.json');
          try {
            await stat(pkgPath);
            results.push(pkgPath);
          } catch {
            // No package.json in this dir
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return results;
}

function cleanVersion(version) {
  return version.replace(/^[^~\d]*/, '');
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
