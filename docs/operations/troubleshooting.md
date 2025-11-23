# 🔧 Troubleshooting Guide

Common issues and their solutions. Use Ctrl+F (Cmd+F on Mac) to search for your specific problem.

## Table of Contents

- [Development Environment](#development-environment)
- [Build & Compilation](#build--compilation)
- [Testing Issues](#testing-issues)
- [Git & Version Control](#git--version-control)
- [Performance Problems](#performance-problems)
- [Runtime Errors](#runtime-errors)
- [Deployment Issues](#deployment-issues)

## Development Environment

### Problem: "Cannot find module 'pnpm'"

**Solution:**

```bash
npm install -g pnpm@9.1.0
```

### Problem: "EACCES permission denied" when installing

**Solution:**

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
# Or use a Node version manager like nvm
```

### Problem: VS Code TypeScript errors everywhere

**Solutions:**

1. Restart TS Server: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. Select correct TypeScript version: `Cmd+Shift+P` → "TypeScript: Select TypeScript Version" → Use Workspace Version
3. Clear cache:
   ```bash
   rm -rf node_modules/.cache
   rm tsconfig.tsbuildinfo
   ```

### Problem: Hot reload not working

**Solutions:**

1. Check if you're using Turbopack:
   ```bash
   pnpm dev  # Should show "▲ Next.js 15.x.x (turbo)"
   ```
2. Clear Next.js cache:
   ```bash
   rm -rf .next
   pnpm dev
   ```
3. Check for file permission issues:
   ```bash
   ls -la src/  # Should show your username as owner
   ```

## Build & Compilation

### Problem: "Module not found" errors

**Solutions:**

1. Verify dependencies installed:
   ```bash
   pnpm install --frozen-lockfile
   ```
2. Check import paths (should use `@/` for src/):
   ```typescript
   // ✅ Correct
   import { Button } from "@/components/ui/button";
   // ❌ Wrong
   import { Button } from "../components/ui/button";
   ```
3. Clear module resolution cache:
   ```bash
   rm -rf node_modules .next
   pnpm install
   ```

### Problem: "Cannot use import statement outside a module"

**Solution:**
Ensure file extensions are correct:

- `.ts` for TypeScript files
- `.tsx` for TypeScript with JSX
- `.mjs` for ES modules

### Problem: Build fails with "out of memory"

**Solutions:**

1. Increase Node memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm build
   ```
2. Clear caches before building:
   ```bash
   rm -rf .next node_modules/.cache
   ```

### Problem: TypeScript errors that don't make sense

**Solutions:**

1. Check `tsconfig.json` hasn't been modified
2. Ensure strict mode is enabled:
   ```json
   {
     "compilerOptions": {
       "strict": true
     }
   }
   ```
3. Delete and regenerate types:
   ```bash
   rm -rf node_modules/@types
   pnpm install
   ```

## Testing Issues

### Problem: Tests hanging forever

**Solutions:**

1. Kill zombie processes:
   ```bash
   pkill -f node
   pkill -f vitest
   ```
2. Check for unhandled timers:
   ```typescript
   // In your test
   afterEach(() => {
     vi.clearAllTimers();
   });
   ```
3. Run specific test to isolate:
   ```bash
   pnpm test:unit -- specific.test.ts
   ```

### Problem: "Cannot find module" in tests

**Solutions:**

1. Check test setup imports `@/test/setup.ts`
2. Verify aliases in `vitest.config.ts`:
   ```typescript
   resolve: {
     alias: {
       '@': path.resolve(__dirname, './src'),
     },
   }
   ```

### Problem: localStorage/sessionStorage not defined

**Solution:**
Tests run in jsdom environment. Check setup:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
```

### Problem: Async test timeout

**Solutions:**

1. Increase timeout for specific test:
   ```typescript
   test("slow test", async () => {
     // test code
   }, 10000); // 10 second timeout
   ```
2. Ensure async operations complete:
   ```typescript
   await waitFor(() => {
     expect(screen.getByText("Loaded")).toBeInTheDocument();
   });
   ```

## Git & Version Control

### Problem: Pre-commit hooks hanging

**Solutions:**

1. Emergency bypass:
   ```bash
   git commit --no-verify -m "Emergency commit"
   ```
2. Fix the actual issue:
   ```bash
   pnpm lint:fix
   pnpm format
   ```

### Problem: Can't push - "rejected"

**Solutions:**

1. Pull latest changes:
   ```bash
   git pull --rebase origin main
   ```
2. Force push to your branch (careful!):
   ```bash
   git push --force-with-lease origin your-branch
   ```

### Problem: Merge conflicts in pnpm-lock.yaml

**Solution:**

```bash
# Delete and regenerate
rm pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git commit -m "Regenerate lockfile"
```

### Problem: Accidentally committed .env file

**Solution:**

```bash
# Remove from history
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove .env from tracking"
```

## Performance Problems

### Problem: Bundle size exceeds 170KB limit

**Solutions:**

1. Analyze bundle:
   ```bash
   pnpm build && pnpm size
   ```
2. Find large dependencies:
   ```bash
   # Check package sizes
   npm list --depth=0 | grep -E "[0-9]+\.[0-9]+MB"
   ```
3. Use dynamic imports:
   ```typescript
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <Spinner />,
   });
   ```

### Problem: Dev server very slow

**Solutions:**

1. Ensure Turbopack is enabled:
   ```bash
   pnpm dev --turbo
   ```
2. Exclude large directories from watchers:
   ```javascript
   // next.config.js
   module.exports = {
     watchOptions: {
       ignored: ["**/node_modules", "**/.next"],
     },
   };
   ```

### Problem: Tests running slowly

**Solutions:**

1. Run unit tests only:
   ```bash
   pnpm test:unit  # Should complete in <10s
   ```
2. Check for expensive operations in tests:
   - Avoid real API calls
   - Mock heavy computations
   - Use test data factories

## Runtime Errors

### Problem: "Hydration failed"

**Solutions:**

1. Check for browser-only code:
   ```typescript
   // Wrap browser-only code
   if (typeof window !== "undefined") {
     // Browser-only code
   }
   ```
2. Use proper mounting checks:
   ```typescript
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!mounted) return null;
   ```

### Problem: "Cannot read property of undefined"

**Solutions:**

1. Add null checks:
   ```typescript
   // Use optional chaining
   const value = data?.nested?.property;
   // Or provide defaults
   const { items = [] } = data || {};
   ```
2. Check data loading states:
   ```typescript
   if (isLoading) return <Spinner />;
   if (error) return <Error />;
   ```

### Problem: Share feature not working

**Diagnostic steps:**

1. Check HTTPS:
   ```javascript
   console.log(window.location.protocol); // Should be "https:"
   ```
2. Check API availability:
   ```javascript
   console.log("Share API:", navigator.share ? "Available" : "Not available");
   console.log("Clipboard API:", navigator.clipboard ? "Available" : "Not available");
   ```

### Problem: Puzzle not loading

**Solutions:**

1. Validate puzzle data:
   ```bash
   pnpm validate-puzzles
   ```
2. Check localStorage:
   ```javascript
   // In browser console
   localStorage.clear();
   location.reload();
   ```

## Deployment Issues

### Problem: Vercel build failing

**Checklist:**

1. Environment variables set in Vercel dashboard
2. Build command: `pnpm build`
3. Output directory: `.next`
4. Node version matches local:
   ```bash
   node --version  # Should be 18.x
   ```

### Problem: 404 errors in production

**Solutions:**

1. Check dynamic routes:
   ```typescript
   // app/[slug]/page.tsx should exist
   export async function generateStaticParams() {
     // Return all possible slugs
   }
   ```
2. Verify build output:
   ```bash
   pnpm build
   # Check .next/server/app for your routes
   ```

### Problem: Bundle sizes increasing

**Solutions:**

1. Run locally first:
   ```bash
   npm install -g @lhci/cli
   pnpm build && pnpm start
   lhci autorun
   ```
2. Common fixes:
   - Add `loading="lazy"` to images
   - Preconnect to external domains
   - Minimize third-party scripts

## Quick Command Reference

```bash
# Nuclear reset
rm -rf node_modules .next pnpm-lock.yaml
pnpm install

# Clear all caches
rm -rf .next node_modules/.cache tsconfig.tsbuildinfo
pkill -f node

# Debug mode
pnpm dev --turbo -- --inspect

# Test specific file
pnpm test:unit -- path/to/test.ts --watch

# Check everything
pnpm lint && pnpm type-check && pnpm test:unit && pnpm build && pnpm size
```

## Still Stuck?

1. **Search existing issues:**

   ```bash
   # Search codebase for error message
   rg "error message" --type ts
   ```

2. **Check recent changes:**

   ```bash
   git log --oneline -20
   git diff HEAD~5
   ```

3. **Ask for help:**
   - Include full error message
   - Steps to reproduce
   - What you've already tried
   - Environment details: `npx envinfo`

Remember: **It's better to ask for help than to waste hours debugging alone!**
