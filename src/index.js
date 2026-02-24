#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cloneRepo, isLocalRepo, getRepoInfo, parseRepoIdentifier } from './clone.js';
import { detectStack } from './detect-stack.js';
import { discoverFiles } from './discover.js';
import { extractKnowledge } from './extract.js';
import { classifyFragments } from './classify.js';
import { writeOutput } from './output.js';

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help') || args.length === 0) {
  console.log(`
cpm-knowledge-extractor v0.1.0

Usage:
  node src/index.js <repo-url-or-owner/repo> [options]
  node src/index.js --batch repos.txt [options]

Options:
  -o, --output <file>    Output file path (default: output/<repo-name>.json)
  -b, --batch <file>     File with one repo URL/shorthand per line
  -f, --format <format>  Output format: json (default) or yaml
  -v, --verbose          Verbose logging
  -h, --help             Show this help

Auth:
  Uses \`gh\` CLI for cloning (inherits your GitHub auth for private repos).
  Falls back to plain git if gh is not available.

Examples:
  node src/index.js webhousecode/fysiodk-aalborg-sport     # Private repo via gh
  node src/index.js shadcn-ui/ui                           # Public repo shorthand
  node src/index.js https://github.com/shadcn-ui/ui       # Full URL
  node src/index.js /path/to/local/repo                    # Local repo
  node src/index.js --batch repos.txt --output combined.json
  `);
  process.exit(0);
}

const verbose = args.includes('-v') || args.includes('--verbose');
const batchIdx = args.indexOf('--batch') !== -1 ? args.indexOf('--batch') : args.indexOf('-b');
const outputIdx = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

function log(msg) {
  if (verbose) console.log(`[INFO] ${msg}`);
}

async function processRepo(repoInput) {
  try {
    // Step 1: Clone or locate repo
    let repoPath;
    let repoInfo;

    // Check if it's a GitHub shorthand (owner/repo) — not a local path
    const parsed = parseRepoIdentifier(repoInput);
    const isShorthand = parsed && !repoInput.includes('/') === false && !isLocalRepo(repoInput);

    if (!isShorthand && isLocalRepo(repoInput)) {
      repoPath = resolve(repoInput);
      repoInfo = getRepoInfo(repoPath);
      log(`Using local repo: ${repoPath}`);
    } else {
      log(`Cloning ${repoInput}...`);
      const result = await cloneRepo(repoInput);
      repoPath = result.path;
      repoInfo = result.info;
      log(`Cloned to: ${repoPath}`);
    }

    // Step 2: Detect stack
    log('Detecting stack...');
    const stack = await detectStack(repoPath);
    log(`Stack detected: ${stack.map(s => s.name).join(', ')}`);

    // Step 3: Discover knowledge files
    log('Discovering knowledge files...');
    const files = await discoverFiles(repoPath);
    log(`Found ${files.length} knowledge sources`);

    if (files.length === 0) {
      console.log(`[WARN] No knowledge files found in ${repoInput}`);
      return [];
    }

    // Step 4: Extract knowledge blocks
    log('Extracting knowledge...');
    const blocks = await extractKnowledge(files);
    log(`Extracted ${blocks.length} raw knowledge blocks`);

    // Step 5: Classify into Knowledge Fragments
    log('Classifying fragments...');
    const fragments = classifyFragments(blocks, stack, repoInfo);
    log(`Produced ${fragments.length} Knowledge Fragments`);

    return { fragments, stack, repoInfo };
  } catch (err) {
    console.error(`[ERROR] Failed to process ${repoInput}: ${err.message}`);
    return { fragments: [], stack: [], repoInfo: null };
  }
}

async function main() {
  console.log('[INFO] CPM Knowledge Extractor v0.1.0\n');

  let repos = [];

  if (batchIdx !== -1) {
    // Batch mode: read repos from file
    const batchFile = args[batchIdx + 1];
    const content = await readFile(batchFile, 'utf-8');
    repos = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
  } else {
    // Single repo mode
    repos = [args.find(a => !a.startsWith('-') && a !== args[outputIdx + 1])];
  }

  const allFragments = [];
  const allSources = [];
  const allStack = [];

  for (const repo of repos) {
    console.log(`\n[INFO] Processing: ${repo}`);
    console.log(`[INFO] ${'─'.repeat(60)}`);

    const result = await processRepo(repo);
    if (result.fragments?.length > 0) {
      allFragments.push(...result.fragments);
      allSources.push(`${result.repoInfo.owner}/${result.repoInfo.name}`);
      for (const s of result.stack) {
        if (!allStack.find(e => e.name === s.name)) allStack.push(s);
      }
    }
    console.log(`[INFO] ✓ ${result.fragments?.length || 0} fragments extracted`);
  }

  if (allFragments.length === 0) {
    console.log('\n[WARN] No Knowledge Fragments extracted from any repo');
    process.exit(0);
  }

  // Write output
  const outputPath = outputFile || `output/${allSources[0]?.replace('/', '--') || 'unknown'}.json`;
  await writeOutput(allFragments, allSources, allStack, outputPath);

  // Print summary
  const categories = {};
  const confidences = {};
  for (const f of allFragments) {
    categories[f.category] = (categories[f.category] || 0) + 1;
    confidences[f.confidence] = (confidences[f.confidence] || 0) + 1;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  EXTRACTION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Sources:    ${allSources.join(', ')}`);
  console.log(`  Stack:      ${allStack.map(s => s.version ? `${s.name}@${s.version}` : s.name).join(', ')}`);
  console.log(`  Fragments:  ${allFragments.length}`);
  console.log('');
  console.log('  By category:');
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log('');
  console.log('  By confidence:');
  for (const [conf, count] of Object.entries(confidences).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${conf}: ${count}`);
  }
  console.log('═'.repeat(60));
  console.log('');

  console.log(`\n[INFO] ✓ Total: ${allFragments.length} Knowledge Fragments`);
  console.log(`[INFO] ✓ Written to: ${outputPath}`);
}

main().catch(err => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
