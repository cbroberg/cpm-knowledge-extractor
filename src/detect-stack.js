import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {Object} StackItem
 * @property {string} name - Package/tool name
 * @property {string} version - Detected version
 * @property {string} category - framework|ui|orm|database|auth|testing|build
 */

/**
 * Stack detection rules: dependency name → stack metadata
 */
const STACK_RULES = {
  // Frameworks
  'next': { name: 'next.js', category: 'framework' },
  'nuxt': { name: 'nuxt', category: 'framework' },
  'react': { name: 'react', category: 'framework' },
  'vue': { name: 'vue', category: 'framework' },
  'svelte': { name: 'svelte', category: 'framework' },
  'astro': { name: 'astro', category: 'framework' },
  'remix': { name: 'remix', category: 'framework' },
  'express': { name: 'express', category: 'framework' },
  'fastify': { name: 'fastify', category: 'framework' },
  'hono': { name: 'hono', category: 'framework' },

  // UI
  'tailwindcss': { name: 'tailwind', category: 'ui' },
  '@tailwindcss/postcss': { name: 'tailwind', category: 'ui' },
  'shadcn-ui': { name: 'shadcn/ui', category: 'ui' },

  // ORM / Database
  'drizzle-orm': { name: 'drizzle', category: 'orm' },
  'prisma': { name: 'prisma', category: 'orm' },
  '@prisma/client': { name: 'prisma', category: 'orm' },
  'mongoose': { name: 'mongoose', category: 'orm' },
  'typeorm': { name: 'typeorm', category: 'orm' },

  // Auth
  '@supabase/supabase-js': { name: 'supabase', category: 'auth' },
  '@supabase/ssr': { name: 'supabase-ssr', category: 'auth' },
  'next-auth': { name: 'next-auth', category: 'auth' },
  '@clerk/nextjs': { name: 'clerk', category: 'auth' },
  '@auth/core': { name: 'auth.js', category: 'auth' },

  // Testing
  'vitest': { name: 'vitest', category: 'testing' },
  'jest': { name: 'jest', category: 'testing' },
  '@playwright/test': { name: 'playwright', category: 'testing' },
  'cypress': { name: 'cypress', category: 'testing' },

  // Build
  'turbo': { name: 'turbo', category: 'build' },
  'turborepo': { name: 'turbo', category: 'build' },
  'vite': { name: 'vite', category: 'build' },
  'webpack': { name: 'webpack', category: 'build' },
  'esbuild': { name: 'esbuild', category: 'build' },

  // Validation
  'zod': { name: 'zod', category: 'validation' },

  // State management
  'zustand': { name: 'zustand', category: 'state' },
  '@tanstack/react-query': { name: 'tanstack-query', category: 'state' },
  'jotai': { name: 'jotai', category: 'state' },
  'redux': { name: 'redux', category: 'state' },
  '@reduxjs/toolkit': { name: 'redux-toolkit', category: 'state' },

  // Mobile
  '@capacitor/core': { name: 'capacitor', category: 'mobile' },
  '@capacitor/cli': { name: 'capacitor', category: 'mobile' },
  'react-native': { name: 'react-native', category: 'mobile' },
  'expo': { name: 'expo', category: 'mobile' },

  // Forms
  'react-hook-form': { name: 'react-hook-form', category: 'forms' },
  '@hookform/resolvers': { name: 'react-hook-form', category: 'forms' },

  // UI components
  '@radix-ui/react-dialog': { name: 'radix-ui', category: 'ui' },
  '@radix-ui/react-dropdown-menu': { name: 'radix-ui', category: 'ui' },
  '@radix-ui/react-popover': { name: 'radix-ui', category: 'ui' },
  '@radix-ui/react-select': { name: 'radix-ui', category: 'ui' },
  '@radix-ui/react-tabs': { name: 'radix-ui', category: 'ui' },
  '@radix-ui/react-slot': { name: 'radix-ui', category: 'ui' },
  'lucide-react': { name: 'lucide', category: 'ui' },
  'class-variance-authority': { name: 'cva', category: 'ui' },
  '@dnd-kit/core': { name: 'dnd-kit', category: 'ui' },

  // Charts / Data viz
  'recharts': { name: 'recharts', category: 'ui' },
  'd3': { name: 'd3', category: 'ui' },
  'chart.js': { name: 'chart.js', category: 'ui' },

  // Email
  'nodemailer': { name: 'nodemailer', category: 'email' },
  'resend': { name: 'resend', category: 'email' },
  '@react-email/components': { name: 'react-email', category: 'email' },

  // Notifications / Firebase
  'firebase-admin': { name: 'firebase-admin', category: 'notifications' },

  // Theming
  'next-themes': { name: 'next-themes', category: 'ui' },

  // PWA
  '@serwist/next': { name: 'serwist', category: 'pwa' },
  'next-pwa': { name: 'next-pwa', category: 'pwa' },

  // Payments
  'stripe': { name: 'stripe', category: 'payments' },
};

/**
 * Detect tech stack from package.json and other config files
 * @param {string} repoPath
 * @returns {Promise<StackItem[]>}
 */
export async function detectStack(repoPath) {
  const stack = new Map(); // Use Map to deduplicate by name

  // Parse package.json
  try {
    const pkgJson = JSON.parse(
      await readFile(join(repoPath, 'package.json'), 'utf-8')
    );
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    };

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

    // Detect monorepo
    if (pkgJson.workspaces || await fileExists(join(repoPath, 'pnpm-workspace.yaml'))) {
      stack.set('monorepo', { name: 'monorepo', version: '', category: 'build' });
    }

    // Detect package manager
    if (pkgJson.packageManager) {
      const pm = pkgJson.packageManager.split('@')[0];
      stack.set(pm, { name: pm, version: pkgJson.packageManager.split('@')[1] || '', category: 'build' });
    }
  } catch {
    // No package.json — might be Python, Go, etc.
  }

  // Check for shadcn (components.json)
  try {
    await readFile(join(repoPath, 'components.json'), 'utf-8');
    if (!stack.has('shadcn/ui')) {
      stack.set('shadcn/ui', { name: 'shadcn/ui', version: '', category: 'ui' });
    }
  } catch {
    // No components.json
  }

  // Check for Python projects
  try {
    const pyproject = await readFile(join(repoPath, 'pyproject.toml'), 'utf-8');
    stack.set('python', { name: 'python', version: '', category: 'framework' });
    // Basic dependency detection from pyproject.toml
    if (pyproject.includes('fastapi')) stack.set('fastapi', { name: 'fastapi', version: '', category: 'framework' });
    if (pyproject.includes('django')) stack.set('django', { name: 'django', version: '', category: 'framework' });
    if (pyproject.includes('flask')) stack.set('flask', { name: 'flask', version: '', category: 'framework' });
  } catch {
    // No pyproject.toml
  }

  // Scan workspace packages for deeper stack detection (monorepos)
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
