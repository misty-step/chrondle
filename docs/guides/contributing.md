# Contributing to Chrondle

Thank you for your interest in contributing to Chrondle! This guide will help you get started with our development workflow and quality standards.

## 🚀 Quick Start

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/chrondle.git
   cd chrondle
   ```

2. **Install dependencies (Bun required):**

   ```bash
   bun install
   ```

3. **Start development server:**
   ```bash
   bun run dev
   ```

## 🏃‍♂️ Development Workflow

### Pre-commit Hooks

We use lightning-fast pre-commit hooks that complete in **<1 second**:

- ✅ ESLint (on changed files only)
- ✅ Prettier (on changed files only)
- ❌ Tests (run in CI to keep commits fast)
- ❌ Type checking (run in CI to keep commits fast)

**Emergency bypass:** If needed, use `git commit --no-verify`

### Testing Strategy

We separate tests for optimal developer experience:

#### Unit Tests (<10s)

```bash
bun run test:unit       # Run unit tests
bun run test:unit:watch # Watch mode for TDD
```

- Pure functions and simple logic
- Target: Complete in <10 seconds
- Examples: `*.unit.test.ts`

#### Integration Tests (<30s)

```bash
bun run test:integration       # Run integration tests
bun run test:integration:watch # Watch mode
```

- API routes, hooks, complex state
- Target: Complete in <30 seconds
- Examples: `*.integration.test.ts`

#### All Tests

```bash
bun run test       # Run all tests once and exit
bun run test:watch # Run all tests in watch mode
bun run test:ci    # Same as test (for CI compatibility)
```

### Code Quality Commands

```bash
bun run lint       # Check linting
bun run lint:fix   # Auto-fix linting issues
bun run type-check # TypeScript type checking
bun run format     # Format with Prettier
bun run size       # Check bundle size (<170KB limit)
```

## 🔧 CI/CD Setup Requirements

### Convex Code Generation

This project uses **Convex** as its backend database. The generated files in `convex/_generated/` are required for type checking and deployments, and they **must remain committed to Git**.

#### Why are Convex files committed?

- **Auto-generated**: Files in `convex/_generated/` are created from your schema
- **Deployment-critical**: Vercel builds depend on these files being present
- **Type-checking**: Local and CI verification fail without them
- **Guard rails**: The repo includes checks to prevent accidental deletion or drift

#### CI Pipeline Requirements

CI should verify these files before running type checks:

```yaml
- name: Verify committed Convex files
  run: bun run verify:convex
```

#### Local Development

For local development, Convex files are regenerated automatically when you run:

```bash
bunx convex dev  # Starts Convex in development mode and generates files
```

If you need code generation without the long-running dev process:

```bash
bunx convex codegen
```

#### Troubleshooting CI Failures

**Problem:** TypeScript errors about missing modules from `convex/_generated/`

**Symptoms:**

```
error TS2307: Cannot find module '../_generated/server'
error TS2307: Cannot find module '../_generated/api'
```

**Solution:** Ensure the Convex codegen step runs before type checking in CI

**Problem:** Vercel deployment fails with Convex import errors

**Solution:** Regenerate the files locally and confirm the build before deploying:

```bash
bunx convex codegen && bun run build
```

## ⚠️ Critical: Convex Generated Files

Unlike typical generated files, the files in `convex/_generated/` **MUST be committed to Git**.

### Why This Exception Exists

This is a **deliberate architectural decision**, not an oversight:

- **Vercel cannot generate**: The deployment environment lacks access to CONVEX_DEPLOYMENT
- **Production depends on them**: All deployments will fail without these files
- **Security benefit**: Keeps deployment credentials separate from build environment
- **Historical context**: Previously deleted in commit 08ee80b, breaking all deployments

### When to Update These Files

You must regenerate and commit these files when:

1. **Schema changes**: After modifying `convex/schema.ts`
2. **Function changes**: After adding/removing/modifying Convex functions
3. **Type changes**: After changing function arguments or return types

### How to Update

```bash
# Option 1: Use dev server (auto-generates on save)
bunx convex dev

# Option 2: Generate without dev server
bunx convex codegen

# Always commit the changes
git add convex/_generated/
git commit -m "chore: update Convex generated files"
```

### Common Mistakes to Avoid

❌ **DO NOT** delete these files as "cleanup"
❌ **DO NOT** add `convex/_generated/` to .gitignore
❌ **DO NOT** assume Vercel will generate them

### Verification Commands

```bash
# Check files are present and committed
bun run verify:convex

# Full deployment readiness check
bun run deployment:check

# Diagnose Vercel failures
bun scripts/diagnose-vercel-failure.mjs
```

### CI Protection

Our CI pipeline includes multiple safeguards:

- Pre-push hooks verify files aren't deleted
- CI checks confirm files are committed
- Deployment readiness scripts catch issues early

See `scripts/verify-convex-files.mjs` for the enforcement details.

## 📊 Quality Gates

### Performance Metrics

| Metric            | Target | Measured By                |
| ----------------- | ------ | -------------------------- |
| Pre-commit hooks  | <1s    | Automated                  |
| Unit tests        | <10s   | `bun run test:unit`        |
| Integration tests | <30s   | `bun run test:integration` |
| Bundle size       | <170KB | `bun run size`             |
| CI pipeline       | <30s   | GitHub Actions             |

### Bundle Size Monitoring

We use `size-limit` to ensure optimal performance:

```bash
bun run build # Build the application
bun run size  # Check bundle sizes
```

Current limits:

- First Load JS: <170KB
- Framework: <55KB
- Main App: <35KB

### Performance Monitoring

We track bundle sizes automatically to ensure performance:

- Best Practices: ≥95%
- SEO: ≥95%

## 🔧 Development Guidelines

### Code Style

- TypeScript strict mode is enforced
- Follow existing patterns in the codebase
- Use functional components with hooks
- Prefer composition over inheritance

### Component Structure

```typescript
// ✅ Good: Clear, typed, and testable
interface ComponentProps {
  title: string;
  optional?: number;
}

export function Component({ title, optional = 0 }: ComponentProps) {
  // Hooks first
  const [state, setState] = useState(initial);

  // Event handlers
  const handleClick = useCallback(() => {
    // ...
  }, [deps]);

  // Render
  return <div>{/* ... */}</div>;
}
```

### File Organization

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   └── ui/          # Reusable UI components
├── hooks/           # Custom React hooks
├── lib/             # Business logic and utilities
└── test/            # Test setup and utilities
```

## 🚨 Troubleshooting

For comprehensive troubleshooting, see [the troubleshooting guide](../operations/troubleshooting.md).

For CI/CD pipeline issues, see [the CI debugging guide](../development/ci-debugging.md).

### Quick Fixes

- **Tests hanging?** → `pkill -f node` and check for timers
- **Hooks slow?** → `git commit --no-verify` (emergency only)
- **Bundle too big?** → `bun run size` to analyze
- **Build failing?** → Clear caches with `rm -rf .next node_modules/.cache`

For detailed solutions to these and many more issues, refer to [the troubleshooting guide](../operations/troubleshooting.md).

## 📝 Commit Guidelines

Write clear, concise commit messages:

```
feat: add streak tracking to game stats
fix: resolve timer cleanup in tests
docs: update contributing guide
chore: upgrade dependencies
```

## 🆘 Emergency Procedures

For comprehensive emergency procedures, see [the emergency guide](../operations/emergency.md).

### Quick Reference

- **Production down:** `git revert HEAD --no-edit && git push`
- **Build broken:** `git bisect` to find the issue
- **Tests hanging:** `pkill -f node` and clear caches
- **Bundle too large:** Check recent dependencies with `git diff`

For detailed procedures, recovery steps, and prevention tips, refer to [the emergency guide](../operations/emergency.md).

## 🤝 Pull Request Process

1. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and test:**

   ```bash
   bun run test:unit        # Quick feedback
   bun run test:integration # Thorough testing
   bun run build            # Ensure it builds
   bun run size             # Check bundle size
   ```

3. **Submit your PR:**
   - Write a clear description
   - Reference any related issues
   - Ensure all CI checks pass

4. **After merge:**
   - Bundle sizes tracked for regression detection
   - Changes deployed to production automatically

## 📚 Additional Resources

- [Project README](../../README.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

## 💡 Tips for Fast Development

1. **Use watch mode for TDD:**

   ```bash
   bun run test:unit:watch
   ```

2. **Run only affected tests:**

   ```bash
   bun run test:unit -- path/to/specific.test.ts
   ```

3. **Skip pre-commit for WIP commits:**

   ```bash
   git commit --no-verify -m "WIP: experimenting"
   ```

4. **Leverage parallel testing:**
   - Tests run in parallel by default
   - Unit and integration tests can run simultaneously

Remember: **If it slows you down, let us know!** We prioritize developer experience and fast feedback loops.
