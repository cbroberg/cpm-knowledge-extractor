#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { cloneRepo, isLocalRepo, getRepoInfo } from './clone.js';
import { discoverFiles } from './discover.js';
import { detectStack } from './detect-stack.js';
import { extractKnowledge } from './extract.js';
import { classifyFragments } from './classify.js';
import { writeOutput } from './output.js';
import { readFileSync } from 'node:fs';

config();

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: 'string', short: 'o', default: '' },
    batch: { type: 'string', short: 'b', default: '' },
    format: { type: 'string', short: 'f', default: 'json' },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || (positionals.length === 0 && !values.batch)) {
  console.log(`
cpm-knowledge-extractor v0.1.0

Usage:
  node src/index.js <repo-url-or-path> [options]
  node src/index.js --batch repos.txt [options]

Options:
  -o, --output <file>    Output file path (default: output/<repo-name>.json)
  -b, --batch <file>     File with one repo URL per line
  -f, --format <format>  Output format: json (default) or yaml
  -v, --verbose          Verbose logging
  -h, --help             Show this help

Examples:
  node src/index.js https://github.com/shadcn-ui/ui
  node src/index.js /path/to/local/repo
  node src/index.js --batch repos.txt --output combined.json
  `);
  process.exit(0);
}

async function processRepo(repoInput) {
  const log = (msg) => values.verbose && console.log(`[INFO] ${msg}`);
  const warn = (msg) => console.warn(`[WARN] ${msg}`);

  try {
    // Step 1: Clone or locate repo
    let repoPath;
    let repoInfo;

    if (isLocalRepo(repoInput)) {
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

    // Step 2: Detect tech stack
    log('Detecting stack...');
    const stack = await detectStack(repoPath);
    log(`Stack detected: ${stack.map(s => s.name).join(', ') || 'unknown'}`);

    // Step 3: Discover knowledge-bearing files
    log('Discovering knowledge files...');
    const files = await discoverFiles(repoPath);
    log(`Found ${files.length} knowledge sources`);

    if (files.length === 0) {
      warn('No knowledge-bearing files found in this repo');
      return [];
    }

    // Step 4: Extract raw knowledge blocks
    log('Extracting knowledge...');
    const rawBlocks = await extractKnowledge(files, repoPath);
    log(`Extracted ${rawBlocks.length} raw knowledge blocks`);

    // Step 5: Classify and structure into Knowledge Fragments
    log('Classifying fragments...');
    const fragments = classifyFragments(rawBlocks, stack, repoInfo);
    log(`Produced ${fragments.length} Knowledge Fragments`);

    return fragments;
  } catch (error) {
    console.error(`[ERROR] Failed to process ${repoInput}: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('[INFO] CPM Knowledge Extractor v0.1.0\n');

  let repos = [];

  if (values.batch) {
    const batchContent = readFileSync(values.batch, 'utf-8');
    repos = batchContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    console.log(`[INFO] Batch mode: ${repos.length} repos to process`);
  } else {
    repos = positionals;
  }

  let allFragments = [];

  for (const repo of repos) {
    console.log(`\n[INFO] Processing: ${repo}`);
    console.log('[INFO] ' + '─'.repeat(60));
    const fragments = await processRepo(repo);
    allFragments = allFragments.concat(fragments);
    console.log(`[INFO] ✓ ${fragments.length} fragments extracted`);
  }

  // Write output
  if (allFragments.length > 0) {
    const outputPath = values.output || undefined;
    const written = await writeOutput(allFragments, { path: outputPath, format: values.format });
    console.log(`\n[INFO] ✓ Total: ${allFragments.length} Knowledge Fragments`);
    console.log(`[INFO] ✓ Written to: ${written}`);
  } else {
    console.log('\n[WARN] No Knowledge Fragments extracted from any repo');
  }
}

main().catch(err => {
  console.error(`[ERROR] ${err.message}`);
  process.exit(1);
});
