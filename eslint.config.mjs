import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ["**/*.css"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // Start with warnings to identify issues without blocking builds
      ...Object.keys(jsxA11y.configs.recommended.rules).reduce((acc, rule) => {
        acc[rule] = "warn";
        return acc;
      }, {}),
    },
  },
  {
    rules: {
      // Disallow all console usage - use logger from src/lib/logger.ts instead
      "no-console": "error",
      // Allow underscore-prefixed unused variables (intentionally unused parameters)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_"
        }
      ],
      // Ban primitive token usage - use semantic tokens instead
      "no-restricted-syntax": [
        "error",
        {
          "selector": "Literal[value=/\\b(text|bg|border)-(ink|parchment)-\\d+\\b/]",
          "message": "Do not use primitive tokens (text-ink-*, bg-parchment-*, etc). Use semantic tokens (text-primary, bg-surface-elevated, etc) from globals.css instead. See DESIGN_SYSTEM.md for token reference."
        }
      ]
    }
  },
  {
    // Allow console usage in logger.ts itself (where logger is implemented)
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off"
    }
  },
  {
    // Allow console usage in scripts and test files
    files: ["scripts/**/*.js", "scripts/**/*.mjs", "**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  },
  {
    // Allow console usage in Convex actions (Node.js context, not browser)
    files: ["convex/actions/**/*.ts", "convex/**/*.ts"],
    rules: {
      "no-console": "off"
    }
  }
];

export default eslintConfig;
