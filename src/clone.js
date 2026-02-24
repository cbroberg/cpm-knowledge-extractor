import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';

const TMP_BASE = join(tmpdir(), 'cpm-knowledge-extractor');

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
 * Extract repo info from a local or cloned repo
 * @param {string} repoPath
 * @returns {{ owner: string, name: string, url: string }}
 */
export function getRepoInfo(repoPath) {
  try {
    const remote = execSync('git remote get-url origin', { cwd: repoPath, encoding: 'utf-8' }).trim();
    const match = remote.match(/github\.com[/:](.*?)\/(.*?)(\.git)?$/);
    if (match) {
      return { owner: match[1], name: match[2], url: `https://github.com/${match[1]}/${match[2]}` };
    }
    return { owner: 'unknown', name: basename(repoPath), url: remote };
  } catch {
    return { owner: 'local', name: basename(repoPath), url: '' };
  }
}

/**
 * Shallow clone a repo to tmp directory
 * @param {string} repoUrl
 * @returns {Promise<{ path: string, info: { owner: string, name: string, url: string } }>}
 */
export async function cloneRepo(repoUrl) {
  if (!existsSync(TMP_BASE)) {
    mkdirSync(TMP_BASE, { recursive: true });
  }

  // Parse repo name from URL
  const match = repoUrl.match(/github\.com[/:](.*?)\/(.*?)(\.git)?$/);
  if (!match) {
    throw new Error(`Cannot parse GitHub URL: ${repoUrl}`);
  }

  const owner = match[1];
  const name = match[2];
  const targetDir = join(TMP_BASE, `${owner}--${name}`);

  // Remove existing clone if present
  if (existsSync(targetDir)) {
    execSync(`rm -rf ${targetDir}`);
  }

  // Shallow clone — only latest commit, no blobs for non-essential files
  execSync(`git clone --depth 1 --single-branch ${repoUrl} ${targetDir}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  return {
    path: targetDir,
    info: { owner, name, url: `https://github.com/${owner}/${name}` },
  };
}
