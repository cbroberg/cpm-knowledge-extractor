import { readFile } from 'node:fs/promises';

/**
 * @typedef {Object} RawKnowledgeBlock
 * @property {string} content - The raw text content
 * @property {string} file - Source file relative path
 * @property {string} category - File category from discovery
 * @property {number} priority - Source priority
 * @property {number} lineStart - Starting line number
 * @property {number} lineEnd - Ending line number
 * @property {string} section - Section heading if applicable
 */

/**
 * Extract knowledge blocks from discovered files
 * @param {Array} files - Discovered files from discover.js
 * @param {string} repoPath
 * @returns {Promise<RawKnowledgeBlock[]>}
 */
export async function extractKnowledge(files, repoPath) {
  const blocks = [];

  for (const file of files) {
    try {
      const content = await readFile(file.path, 'utf-8');

      if (file.category === 'linting' || file.category === 'typescript' || file.category === 'formatting') {
        // Config files: extract as a single block
        blocks.push({
          content,
          file: file.relativePath,
          category: file.category,
          priority: file.priority,
          lineStart: 1,
          lineEnd: content.split('\n').length,
          section: file.relativePath,
        });
      } else {
        // Markdown/text files: split by sections
        const sectionBlocks = splitBySections(content, file);
        blocks.push(...sectionBlocks);
      }
    } catch (error) {
      console.warn(`[WARN] Could not read ${file.relativePath}: ${error.message}`);
    }
  }

  return blocks;
}

/**
 * Split markdown content into section-based blocks
 * @param {string} content
 * @param {Object} file
 * @returns {RawKnowledgeBlock[]}
 */
function splitBySections(content, file) {
  const lines = content.split('\n');
  const blocks = [];
  let currentSection = 'preamble';
  let currentLines = [];
  let sectionStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headingMatch && currentLines.length > 0) {
      // Save previous section
      const sectionContent = currentLines.join('\n').trim();
      if (sectionContent && hasKnowledgeSignal(sectionContent, currentSection)) {
        blocks.push({
          content: sectionContent,
          file: file.relativePath,
          category: file.category,
          priority: file.priority,
          lineStart: sectionStart,
          lineEnd: i,
          section: currentSection,
        });
      }
      currentSection = headingMatch[2].trim();
      currentLines = [line];
      sectionStart = i + 1;
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget the last section
  const lastContent = currentLines.join('\n').trim();
  if (lastContent && hasKnowledgeSignal(lastContent, currentSection)) {
    blocks.push({
      content: lastContent,
      file: file.relativePath,
      category: file.category,
      priority: file.priority,
      lineStart: sectionStart,
      lineEnd: lines.length,
      section: currentSection,
    });
  }

  return blocks;
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
  // Matches: "Session (date)", "Seneste Session (date)", "Tidligere Sessions", "Changelog", etc.
  if (section && /^(seneste\s+)?session|^tidligere\s+session|^changelog|^version\s+histor|^v\d+\.\d+/i.test(section)) return false;

  // Look for positive signals (English + Danish)
  const signals = [
    /must|should|always|never|don't|avoid|prefer|require/i,
    /skal|altid|aldrig|undg\u00e5|brug ikke|foretr\u00e6kker|p\u00e5kr\u00e6vet|obligatorisk/i,
    /pattern|convention|rule|standard|best practice/i,
    /m\u00f8nster|konvention|regel|vigtigt/i,
    /import|export|async|await|function|class|const|let/i,
    /error|test|lint|format|style|security|auth/i,
    /```/,  // Code blocks are almost always useful
    /\*\*.*\*\*/, // Bold text often marks important rules
    /- \[[ x]\]/, // Checklists
    /^\s*[-*]\s/m, // Bullet lists
    /[\u274c\u2705\u26a0\ufe0f]/,  // Emoji signals used in rule docs
  ];

  return signals.some(signal => signal.test(content));
}
