import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Write Knowledge Fragments to output file
 * @param {Array} fragments
 * @param {{ path?: string, format?: string }} options
 * @returns {Promise<string>} Path of written file
 */
export async function writeOutput(fragments, options = {}) {
  const format = options.format || 'json';
  const outputDir = process.env.OUTPUT_DIR || './output';

  // Determine output path
  let outputPath;
  if (options.path) {
    outputPath = options.path;
  } else {
    // Default: output/<first-repo-name>.json
    const repoName = fragments[0]?.source?.repo?.replace('/', '--') || 'unknown';
    outputPath = join(outputDir, `${repoName}.${format}`);
  }

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Build output document
  const output = {
    metadata: {
      extractedAt: new Date().toISOString(),
      version: '0.1.0',
      totalFragments: fragments.length,
      sources: [...new Set(fragments.map(f => f.source.repo))],
      stackDetected: fragments[0]?.stack || [],
    },
    fragments: fragments.map(f => ({
      id: f.id,
      stack: f.stack,
      category: f.category,
      type: f.type,
      title: f.title,
      description: f.description,
      example: f.example,
      source: f.source,
      confidence: f.confidence,
      tags: f.tags,
    })),
  };

  if (format === 'json') {
    await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  } else {
    // Simple YAML-like output for readability
    const yaml = fragmentsToYaml(output);
    await writeFile(outputPath, yaml, 'utf-8');
  }

  // Also write a summary to console
  printSummary(output);

  return outputPath;
}

function printSummary(output) {
  const { metadata, fragments } = output;

  console.log('\n' + '═'.repeat(60));
  console.log('  EXTRACTION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Sources:    ${metadata.sources.join(', ')}`);
  console.log(`  Stack:      ${metadata.stackDetected.join(', ')}`);
  console.log(`  Fragments:  ${metadata.totalFragments}`);

  // Category breakdown
  const categories = {};
  for (const f of fragments) {
    categories[f.category] = (categories[f.category] || 0) + 1;
  }
  console.log('\n  By category:');
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  // Confidence breakdown
  const confidence = {};
  for (const f of fragments) {
    confidence[f.confidence] = (confidence[f.confidence] || 0) + 1;
  }
  console.log('\n  By confidence:');
  for (const [level, count] of Object.entries(confidence)) {
    console.log(`    ${level}: ${count}`);
  }

  console.log('═'.repeat(60) + '\n');
}

function fragmentsToYaml(output) {
  let yaml = '# CPM Knowledge Fragments\n';
  yaml += `# Extracted: ${output.metadata.extractedAt}\n`;
  yaml += `# Sources: ${output.metadata.sources.join(', ')}\n\n`;

  for (const f of output.fragments) {
    yaml += `---\n`;
    yaml += `id: ${f.id}\n`;
    yaml += `title: "${f.title}"\n`;
    yaml += `category: ${f.category}\n`;
    yaml += `type: ${f.type}\n`;
    yaml += `confidence: ${f.confidence}\n`;
    yaml += `stack: [${f.stack.join(', ')}]\n`;
    yaml += `tags: [${f.tags.join(', ')}]\n`;
    yaml += `source:\n`;
    yaml += `  repo: ${f.source.repo}\n`;
    yaml += `  file: ${f.source.file}\n`;
    yaml += `  line: ${f.source.line}\n`;
    yaml += `description: |\n`;
    yaml += f.description.split('\n').map(l => `  ${l}`).join('\n');
    yaml += '\n\n';
  }

  return yaml;
}
