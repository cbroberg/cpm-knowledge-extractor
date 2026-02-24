import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';

const TMP_BASE = join(tmpdir(), 'cpm-knowledge-extractor');

/**
 * Check if gh CLI is available and authenticated
 * @returns {boolean}
 */
function hasGhCli() {
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if input is a local repo path
 * @param {string} input
 * @returns {boolean}
 */
export function isLocalRepo(input) {
  try {
    return existsSync(input) && statSync(input).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Parse owner/name from a GitHub URL or shorthand (e.g. "owner/repo")
 * @param {string} repoUrl
 * @returns {{ owner: string, name: string } | null}
 */
export function parseRepoIdentifier(repoUrl) {
  // Full URL: https://github.com/owner/repo or git@github.com:owner/repo
  const urlMatch = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (urlMatch) {
    return { owner: urlMatch[1], name: urlMatch[2] };
  }
  // Shorthand: owner/repo
  const shortMatch = repoUrl.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], name: shortMatch[2] };
  }
  return null;
}

/**
 * Extract repo info from a local or cloned repo
 * @param {string} repoPath
 * @returns {{ owner: string, name: string, url: string }}
 */
export function getRepoInfo(repoPath) {
  try {
    const remote = execSync('git remote get-url origin', { cwd: repoPath, encoding: 'utf-8' }).trim();
    const parsed = parseRepoIdentifier(remote);
    if (parsed) {
      return { ...parsed, url: `https://github.com/${parsed.owner}/${parsed.name}` };
    }
    return { owner: 'unknown', name: basename(repoPath), url: remote };
  } catch {
    return { owner: 'local', name: basename(repoPath), url: '' };
  }
}

/**
 * Shallow clone a repo to tmp directory.
 * Uses `gh repo clone` (inherits CLI auth for private repos) with fallback to plain git.
 * Also supports shorthand "owner/repo" format.
 *
 * @param {string} repoUrl - GitHub URL or "owner/repo" shorthand
 * @returns {Promise<{ path: string, info: { owner: string, name: string, url: string } }>}
 */
export async function cloneRepo(repoUrl) {
  if (!existsSync(TMP_BASE)) {
    mkdirSync(TMP_BASE, { recursive: true });
  }

  const parsed = parseRepoIdentifier(repoUrl);
  if (!parsed) {
    throw new Error(`Cannot parse GitHub repo: ${repoUrl}. Use a URL or owner/repo shorthand.`);
  }

  const { owner, name } = parsed;
  const targetDir = join(TMP_BASE, `${owner}--${name}`);

  // Remove existing clone if present
  if (existsSync(targetDir)) {
    execSync(`rm -rf ${targetDir}`);
  }

  const useGh = hasGhCli();

  if (useGh) {
    // gh repo clone inherits CLI auth — works for private repos
    console.log(`[INFO] Using gh CLI (authenticated) for clone`);
    execSync(`gh repo clone ${owner}/${name} ${targetDir} -- --depth 1 --single-branch`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } else {
    // Fallback: plain git clone (public repos only, or if GITHUB_TOKEN is in env)
    const url = `https://github.com/${owner}/${name}`;
    console.log(`[INFO] Using git clone (gh CLI not available — private repos may fail)`);
    execSync(`git clone --depth 1 --single-branch ${url} ${targetDir}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  }

  return {
    path: targetDir,
    info: { owner, name, url: `https://github.com/${owner}/${name}` },
  };
}
