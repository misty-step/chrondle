import nextConfig from "eslint-config-next";

// nextConfig structure:
// [0] main config: react, react-hooks, import, jsx-a11y, @next/next plugins
// [1] typescript config: @typescript-eslint plugin (for TS/TSX files)
// [2] ignores block

// Extract the configs
const [mainConfig, tsConfig, ignoresConfig] = nextConfig;

const eslintConfig = [
  {
    ignores: ["**/*.css"]
  },
  // Main Next.js config
  mainConfig,
  // Extend TypeScript config with our rules
  {
    ...tsConfig,
    rules: {
      ...tsConfig.rules,
      // Allow underscore-prefixed unused variables (intentionally unused parameters)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_"
        }
      ]
    }
  },
  // Next.js ignores
  ignoresConfig,
  // Global rules (jsx-a11y as warnings, no-console, etc)
  {
    rules: {
      // jsx-a11y rules as warnings
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-has-content": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/aria-activedescendant-has-tabindex": "warn",
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-role": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/autocomplete-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/html-has-lang": "warn",
      "jsx-a11y/iframe-has-title": "warn",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/lang": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/mouse-events-have-key-events": "warn",
      "jsx-a11y/no-access-key": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-distracting-elements": "warn",
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "warn",
      "jsx-a11y/no-noninteractive-tabindex": "warn",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "jsx-a11y/scope": "warn",
      "jsx-a11y/tabindex-no-positive": "warn",
      // Disallow all console usage - use logger from src/lib/logger.ts instead
      "no-console": "error",
      // Ban primitive token usage - use semantic tokens instead
      "no-restricted-syntax": [
        "error",
        {
          "selector": "Literal[value=/\\b(text|bg|border)-(ink|parchment)-\\d+\\b/]",
          "message": "Do not use primitive tokens (text-ink-*, bg-parchment-*, etc). Use semantic tokens (text-primary, bg-surface-elevated, etc) from globals.css instead. See DESIGN_SYSTEM.md for token reference."
        }
      ],
      // New React Compiler rules in Next.js 16 - demote to warnings for incremental adoption
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn"
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
    // Allow console usage in scripts (JS/MJS/TS files)
    files: ["scripts/**/*.js", "scripts/**/*.mjs", "scripts/**/*.ts"],
    rules: {
      "no-console": "off"
    }
  },
  {
    // Convex files (Node.js context, not browser) - exclude test files
    ...tsConfig,
    files: ["convex/**/*.ts"],
    ignores: ["**/__tests__/**", "**/*.test.ts"],
    rules: {
      ...tsConfig.rules,
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_"
        }
      ]
    }
  },
  {
    // All test files - relax rules (must come after convex to override)
    ...tsConfig,
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      ...tsConfig.rules,
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  }
];

export default eslintConfig;
