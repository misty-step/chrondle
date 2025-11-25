const config = {
  // TypeScript and JavaScript files - lint and format only changed files
  // Exclude convex/_generated (auto-generated, should not be linted)
  "**/*.{ts,tsx,js,jsx}": (files) => {
    const filtered = files.filter((f) => !f.includes("convex/_generated"));
    if (filtered.length === 0) return [];
    return [`eslint --fix ${filtered.join(" ")}`, `prettier --write ${filtered.join(" ")}`];
  },

  // Other files - just format
  "**/*.{json,css,scss,md}": ["prettier --write"],

  // Note: type-check moved to CI for speed
  // Pre-commit now focuses only on immediate file issues (lint/format)
  // This keeps commits fast (<3s) while CI ensures type safety
};

export default config;
