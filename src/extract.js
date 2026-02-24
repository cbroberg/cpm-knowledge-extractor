import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

/**
 * Extract knowledge blocks from discovered files
 * @param {Array<{ path: string, priority: number }>} files
 * @returns {Promise<Array<{ file: string, section: string, content: string, line: number }>>}
 */
export async function extractKnowledge(files) {
  const blocks = [];

  for (const { path: filePath } of files) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const fileName = basename(filePath);

      if (fileName.endsWith('.md')) {
        blocks.push(...extractMarkdownSections(content, fileName));
      } else if (fileName.endsWith('.json')) {
        blocks.push(...extractJsonConfig(content, fileName));
      } else {
        // Config files (.eslintrc, .prettierrc, etc.)
        blocks.push(...extractConfigFile(content, fileName));
      }
    } catch (err) {
      console.error(`[WARN] Failed to read ${filePath}: ${err.message}`);
    }
  }

  return blocks;
}

/**
 * Split markdown into sections by ## headings
 * Each section becomes a potential Knowledge Fragment
 */
function extractMarkdownSections(content, fileName) {
  const blocks = [];
  const lines = content.split('\n');
  let currentSection = 'preamble';
  let sectionContent = '';
  let sectionStartLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headings (## or ###)
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      // Save previous section
      if (sectionContent && hasKnowledgeSignal(sectionContent, currentSection)) {
        blocks.push({
          file: fileName,
          section: currentSection,
          content: sectionContent.trim(),
          line: sectionStartLine,
        });
      }

      currentSection = headingMatch[1].trim();
      sectionContent = line + '\n';
      sectionStartLine = i + 1;
    } else {
      sectionContent += line + '\n';
    }
  }

  // Don't forget the last section
  if (lastContent && hasKnowledgeSignal(lastContent, currentSection)) {
    blocks.push({
      file: fileName,
      section: currentSection,
      content: sectionContent.trim(),
      line: sectionStartLine,
    });
  }

  return blocks;
}

/**
 * Extract rules from JSON config files (eslint, tsconfig, etc.)
 */
function extractJsonConfig(content, fileName) {
  try {
    const config = JSON.parse(content);
    const configStr = JSON.stringify(config, null, 2);

    if (configStr.length < 50) return [];

    return [{
      file: fileName,
      section: fileName.replace(/\.[^.]+$/, ''),
      content: configStr.slice(0, 2000),
      line: 1,
    }];
  } catch {
    return [];
  }
}

/**
 * Extract from plain config files
 */
function extractConfigFile(content, fileName) {
  if (content.length < 30) return [];

  return [{
    file: fileName,
    section: fileName,
    content: content.slice(0, 2000),
    line: 1,
  }];
}

/**
 * Heuristic: does this content block contain useful knowledge?
 * Filters out boilerplate, license text, preambles, etc.
 * @param {string} content
 * @param {string} section - Section heading
 * @returns {boolean}
 */
function hasKnowledgeSignal(content, section = 'preamble') {
  // Too short to be useful
  if (content.length < 50) return false;

  // Skip preamble sections that are just warnings/intros (no actionable knowledge)
  if (section === 'preamble') {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    // Preamble with < 3 substantive lines is likely just a header/warning
    if (lines.length < 3) return false;
  }

  // Skip license/legal boilerplate
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('mit license') || lowerContent.includes('apache license')) return false;
  if (lowerContent.startsWith('copyright')) return false;

  // Skip session logs / changelogs (high noise, low reusable knowledge)
  if (section && /^(session|seneste session|changelog|v\d)/i.test(section)) return false;

  // Look for positive signals (English + Danish)
  const signals = [
    /must|should|always|never|don't|avoid|prefer|require/i,
    /skal|altid|aldrig|undgå|brug ikke|foretrækker|påkrævet|obligatorisk/i,
    /pattern|convention|rule|standard|best practice/i,
    /mønster|konvention|regel|vigtigt/i,
    /import|export|async|await|function|class|const|let/i,
    /error|test|lint|format|style|security|auth/i,
    /```/,  // Code blocks are almost always useful
    /\*\*.*\*\*/, // Bold text often marks important rules
    /- \[[ x]\]/, // Checklists
    /^\s*[-*]\s/m, // Bullet lists
    /[❌✅⚠️]/,  // Emoji signals used in rule docs
  ];

  return signals.some(signal => signal.test(content));
}
