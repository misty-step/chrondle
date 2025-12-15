/**
 * Generator Prompt Assertions
 *
 * Validates generator output for:
 * - JSON structure and candidate count
 * - Year leakage detection
 * - Word count limits
 * - Proper noun presence (best-effort)
 */

// Leakage patterns from production validators
const LEAKAGE_PATTERNS = {
  // Numbers ≥10
  largeNumbers: /\b([1-9]\d+)\b/g,
  // Century/decade/millennium terms
  centuryTerms: /\b(century|centuries|decade|decades|millennium|millennia)\b/gi,
  // BCE/CE/AD/BC era markers
  eraMarkers: /\b(BCE|CE|AD|BC|B\.C\.|A\.D\.)\b/gi,
  // Spelled-out large numbers
  spelledNumbers: /\b(hundred|thousand|million|billion)\b/gi,
};

/**
 * Check if text contains year leakage.
 */
function hasLeakage(text) {
  for (const [name, pattern] of Object.entries(LEAKAGE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      // Allow small numbers (1-9) for "World War I" etc.
      if (name === "largeNumbers") {
        const largeMatches = matches.filter((m) => parseInt(m, 10) >= 10);
        if (largeMatches.length > 0) {
          return { leaked: true, reason: name, matches: largeMatches };
        }
      } else {
        return { leaked: true, reason: name, matches };
      }
    }
  }
  return { leaked: false };
}

/**
 * Count words in text.
 */
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Check for proper noun (capitalized word not at start).
 */
function hasProperNoun(text) {
  const words = text.split(/\s+/);
  // Skip first word (always capitalized)
  for (let i = 1; i < words.length; i++) {
    const word = words[i].replace(/[^a-zA-Z]/g, "");
    if (word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Main assertion function.
 * @param {string} output - Raw LLM output
 * @param {object} context - Test context with vars
 * @returns {object} - { pass: boolean, score: number, reason: string }
 */
module.exports = function (output, context) {
  const issues = [];
  let score = 1.0;

  // Parse JSON
  let data;
  try {
    data = JSON.parse(output);
  } catch (e) {
    return {
      pass: false,
      score: 0,
      reason: `JSON parse failed: ${e.message}`,
    };
  }

  // Check structure
  if (!data.candidates || !Array.isArray(data.candidates)) {
    return {
      pass: false,
      score: 0,
      reason: "Missing or invalid candidates array",
    };
  }

  const candidates = data.candidates;

  // Candidate count check (12-18)
  if (candidates.length < 12) {
    issues.push(`Too few candidates: ${candidates.length} (min 12)`);
    score -= 0.3;
  } else if (candidates.length > 18) {
    issues.push(`Too many candidates: ${candidates.length} (max 18)`);
    score -= 0.1;
  }

  // Per-candidate checks
  let leakageCount = 0;
  let wordCountViolations = 0;
  let missingProperNouns = 0;

  for (const candidate of candidates) {
    const text = candidate.event_text || "";

    // Leakage check
    const leak = hasLeakage(text);
    if (leak.leaked) {
      leakageCount++;
      issues.push(
        `Leakage in "${text.slice(0, 50)}...": ${leak.reason} (${leak.matches.join(", ")})`,
      );
    }

    // Word count check (≤20)
    const wc = wordCount(text);
    if (wc > 20) {
      wordCountViolations++;
      issues.push(`Word count ${wc} > 20: "${text.slice(0, 50)}..."`);
    }

    // Proper noun check (best-effort, not strict)
    if (!hasProperNoun(text)) {
      missingProperNouns++;
    }
  }

  // Score adjustments
  if (leakageCount > 0) {
    score -= Math.min(0.5, leakageCount * 0.1);
  }
  if (wordCountViolations > 0) {
    score -= Math.min(0.2, wordCountViolations * 0.05);
  }
  if (missingProperNouns > candidates.length * 0.5) {
    issues.push(`Many candidates missing proper nouns: ${missingProperNouns}/${candidates.length}`);
    score -= 0.1;
  }

  // Final result
  const pass = score >= 0.6 && leakageCount === 0;

  return {
    pass,
    score: Math.max(0, score),
    reason: issues.length > 0 ? issues.join("; ") : "All checks passed",
  };
};
