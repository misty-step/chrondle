# 🚨 Emergency Procedures

Quick reference for when things go wrong. Time is critical - find your scenario and follow the steps.

## 🆘 Quick Emergency Checklist

**If everything is broken, try these in order:**

```bash
# 1. Kill hanging processes
pkill -f node && pkill -f vitest

# 2. Clear all caches
rm -rf node_modules/.cache .next coverage

# 3. Fresh install
pnpm install --force

# 4. Verify environment
node --version  # Should be v20+
pnpm --version  # Should be 9.1.0

# 5. Run minimal test
pnpm build && pnpm test:unit

# 6. If still broken, check recent changes
git log --oneline -10
```

## Table of Contents

1. [🔥 Critical Issues (Fix Immediately)](#-critical-issues-fix-immediately)
2. [⚡ Performance Emergencies](#-performance-emergencies)
3. [🐛 Debugging Nightmares](#-debugging-nightmares)
4. [🚀 CI/CD Failures](#-cicd-failures)
5. [🔧 Environment Issues](#-environment-issues)
6. [🌐 Deployment Issues](#-deployment-issues)
7. [📱 Mobile-Specific Issues](#-mobile-specific-issues)
8. [🔐 Security Emergencies](#-security-emergencies)
9. [💊 Recovery Procedures](#-recovery-procedures)
10. [📞 Escalation & Communication](#-escalation--communication)

## 🔥 Critical Issues (Fix Immediately)

### Production is Down

1. **Check deployment status:**

   ```bash
   # Check recent deployments
   git log --oneline -5 origin/main
   ```

2. **Quick rollback:**

   ```bash
   # Revert to last known good commit
   git revert HEAD --no-edit
   git push origin main
   ```

3. **Verify fix:**
   - Check production site
   - Monitor error logs
   - Confirm with team

### Build Completely Broken

1. **Immediate diagnosis:**

   ```bash
   # Check what's failing
   pnpm build 2>&1 | head -20

   # Common Next.js 15 build issues:
   # - Dynamic imports without proper loading states
   # - Server/client component mismatches
   # - Missing environment variables
   ```

2. **Quick fixes by error type:**

   ```bash
   # Module not found errors
   pnpm install --frozen-lockfile

   # Type errors blocking build
   echo "// @ts-nocheck" > problem-file.tsx  # TEMPORARY!

   # Memory issues
   NODE_OPTIONS='--max-old-space-size=8192' pnpm build
   ```

3. **Find last working build:**

   ```bash
   # Automated bisect
   git bisect start
   git bisect bad HEAD
   git bisect good main
   git bisect run sh -c "pnpm install && pnpm build"
   ```

4. **Emergency bypass:**
   ```bash
   # Skip all checks (document why!)
   git commit --no-verify -m "EMERGENCY: [describe issue]"
   git push --force-with-lease
   ```

### Tests Hanging Forever

1. **Immediate diagnosis:**

   ```bash
   # See which test is hanging
   pnpm vitest run --reporter=verbose

   # Common culprits in this project:
   # - Notification service timers (24-hour loops)
   # - Unclosed database connections
   # - Infinite loops in game state
   ```

2. **Kill all processes:**

   ```bash
   # Kill Node and test runners
   pkill -f node
   pkill -f vitest
   ps aux | grep -E "node|vitest" | awk '{print $2}' | xargs kill -9
   ```

3. **Check for timer issues:**

   ```bash
   # Search for setTimeout/setInterval without cleanup
   grep -r "setTimeout\|setInterval" src/ --include="*.ts" --include="*.tsx" | grep -v "clearTimeout\|clearInterval"

   # Ensure test environment guards exist
   grep -r "process.env.NODE_ENV === 'test'" src/lib/
   ```

4. **Clear all caches and restart:**

   ```bash
   # Nuclear cache clear
   rm -rf node_modules/.cache
   rm -rf .next
   rm -rf coverage
   pnpm store prune

   # Fresh install
   pnpm install --force
   ```

5. **Run tests individually:**
   ```bash
   # Test files one by one to find the hanging test
   for test in src/**/*.test.ts; do
     echo "Testing: $test"
     timeout 10s pnpm vitest run "$test" || echo "HUNG: $test"
   done
   ```

## ⚡ Performance Emergencies

### Bundle Size Exploded (>170KB)

1. **Quick analysis:**

   ```bash
   pnpm build && pnpm size
   ```

2. **Find the culprit:**

   ```bash
   # Check what changed
   git diff HEAD~1 package.json
   git diff HEAD~1 --stat | grep -E '\.(ts|tsx|js)$'
   ```

3. **Emergency fixes:**
   - Remove recently added dependencies
   - Add dynamic imports for large components
   - Check for accidental dev dependencies in prod bundle

### Site Loading Too Slowly

1. **Check bundle sizes:**
   - Look at latest merge commit comments
   - Check performance-data branch

2. **Quick wins:**

   ```bash
   # Ensure production build
   NODE_ENV=production pnpm build

   # Check for large assets
   find public -type f -size +100k
   ```

## 🐛 Debugging Nightmares

### Can't Reproduce User's Issue

1. **Gather data:**

   ```bash
   # Check for browser-specific issues
   # Test in: Chrome, Firefox, Safari, Edge

   # Clear all local storage
   localStorage.clear()
   sessionStorage.clear()
   ```

2. **Debug mode:**
   ```
   # Add to URL: ?debug=true
   # Check console for additional logs
   ```

### Puzzle Data Corrupted

1. **Validate immediately:**

   ```bash
   # Run validation script
   pnpm validate-puzzles

   # Check specific year
   jq '.["1969"].events' src/data/puzzles.json
   ```

2. **Common puzzle issues:**

   ```bash
   # Missing events for a year
   jq 'to_entries | map(select(.value.events | length < 6))' src/data/puzzles.json

   # Duplicate events
   jq '.[] | .events | group_by(.) | map(select(length > 1))' src/data/puzzles.json

   # Invalid year format
   jq 'keys | map(select(test("^-?[0-9]+$") | not))' src/data/puzzles.json
   ```

3. **Restore from backup:**

   ```bash
   # Find last valid version
   git log --oneline -- src/data/puzzles.json

   # Restore specific version
   git checkout <commit-hash> -- src/data/puzzles.json
   pnpm validate-puzzles
   ```

4. **Update metadata after fix:**
   ```bash
   pnpm update-metadata
   git add src/data/puzzles.json
   git commit -m "fix: restore valid puzzle data"
   ```

### Daily Puzzle Not Updating

1. **Check date calculation:**

   ```javascript
   // In browser console
   const today = new Date().toISOString().slice(0, 10);
   console.log("Today:", today);
   console.log("LocalStorage:", localStorage.getItem("chrondle-state"));
   ```

2. **Force puzzle refresh:**

   ```javascript
   // Clear game state
   localStorage.removeItem("chrondle-state");
   localStorage.removeItem("chrondle-streak");
   location.reload();
   ```

3. **Debug puzzle selection:**
   ```javascript
   // Check which year is selected
   const years = JSON.parse(localStorage.getItem("chrondle-state")).puzzle.year;
   console.log("Selected year:", years);
   ```

### Share Feature Broken

1. **Platform-specific debugging:**

   ```javascript
   // Check platform detection
   console.log("User Agent:", navigator.userAgent);
   console.log("Is Mobile:", /Android|iPhone|iPad/i.test(navigator.userAgent));
   console.log("Share API:", "share" in navigator);
   console.log("Clipboard API:", "clipboard" in navigator);
   ```

2. **Test share functionality:**

   ```javascript
   // Test clipboard
   navigator.clipboard.writeText("test").then(
     () => console.log("Clipboard works"),
     (err) => console.error("Clipboard failed:", err),
   );

   // Test Web Share (mobile)
   if (navigator.share) {
     navigator.share({
       title: "Test",
       text: "Test message",
       url: window.location.href,
     });
   }
   ```

## 🚀 CI/CD Failures

### GitHub Actions Failing

1. **Common fixes:**

   ```bash
   # Clear workflow cache (in GitHub UI)
   # Actions → Management → Caches → Delete

   # Restart failed jobs
   # Click "Re-run failed jobs" in PR
   ```

2. **Debug locally:**
   ```bash
   # Run exact CI commands
   pnpm lint
   pnpm type-check
   pnpm test:ci
   pnpm build
   pnpm size
   ```

### Pre-commit Hooks Blocking Everything

```bash
# Emergency bypass (document why!)
git commit --no-verify -m "EMERGENCY: [describe issue]"

# Fix properly later
pnpm lint:fix
pnpm format
```

## 🔧 Environment Issues

### ESM/CommonJS Module Conflicts

1. **Symptoms:**

   ```
   Error: require() of ES Module not supported
   SyntaxError: Cannot use import statement outside a module
   ERR_REQUIRE_ESM
   ```

2. **Quick diagnosis:**

   ```bash
   # Check module system configuration
   pnpm test-module-system

   # Verify package.json has type: module
   grep '"type"' package.json

   # Check Node.js version (must be 20+)
   node --version
   ```

3. **Common fixes:**

   ```bash
   # Ensure all config files use .mjs
   ls -la *.config.js  # Should be empty
   ls -la *.config.mjs # Should show configs

   # Fix import paths (add .js extension)
   # BAD:  import { foo } from './lib/utils'
   # GOOD: import { foo } from './lib/utils.js'

   # Update tsconfig.json
   # "module": "ESNext"
   # "moduleResolution": "bundler"
   ```

4. **Emergency workaround:**
   ```bash
   # Temporarily disable ESM (NOT RECOMMENDED)
   mv package.json package.json.bak
   jq 'del(.type)' package.json.bak > package.json
   # Fix properly later!
   ```

### pnpm Not Working

```bash
# Reinstall pnpm
npm install -g pnpm@9.1.0

# Clear pnpm store
pnpm store prune

# Nuclear option
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors Everywhere

```bash
# Restart TS server (in VS Code)
Cmd+Shift+P → "TypeScript: Restart TS Server"

# Clear TS cache
rm -rf node_modules/.cache/typescript
rm tsconfig.tsbuildinfo

# Reinstall types
pnpm install -D @types/react @types/node
```

## 🌐 Deployment Issues

### App Platform Deploy Failed

1. **Check build logs:**
   - DigitalOcean console → App → Runtime Logs, or `doctl apps logs <app-id>`

2. **Common fixes:**
   - Check environment variables are set
   - Ensure build command is correct
   - Verify the Bun/Node versions match the app build environment

### Bundle Size Check Failing

1. **Skip temporarily:**

   ```yaml
   # In .github/workflows/ci.yml
   # Add continue-on-error: true to the step
   ```

2. **Debug scores:**
   ```bash
   # Run locally
   npm install -g @lhci/cli
   lhci autorun
   ```

## 📱 Mobile-Specific Issues

### Share Feature Not Working

1. **Test conditions:**
   - HTTPS required for Web Share API
   - Mobile browser required
   - Check navigator.share availability

2. **Fallback test:**
   ```javascript
   // In console
   navigator.clipboard.writeText("test");
   ```

## 🔐 Security Emergencies

### Exposed Secrets

1. **Immediate action:**
   - Rotate all affected keys
   - Check git history: `git log -p | grep -i api`
   - Use `git filter-branch` if needed

2. **Prevention:**
   ```bash
   # Add to .env.local (never commit)
   OPENROUTER_API_KEY=sk-...
   ```

## 💊 Recovery Procedures

### Complete Reset

```bash
# Nuclear option - start fresh
cd ..
mv chrondle chrondle-backup
git clone https://github.com/your-fork/chrondle.git
cd chrondle
pnpm install
```

### Restore Working State

```bash
# Save current work
git stash push -m "emergency stash"

# Return to known good state
git checkout main
git pull origin main
git checkout -b recovery

# Apply fixes carefully
git stash pop
```

## 📞 Escalation & Communication

### When to Escalate

1. **Escalate immediately if:**
   - Production is down for >15 minutes
   - User data is at risk
   - Security vulnerability discovered
   - Multiple systems failing

2. **Escalate within 1 hour if:**
   - CI/CD completely blocked
   - Can't find root cause
   - Need architectural decision

### Escalation Path

1. Check #chrondle-dev Slack channel
2. Review recent PRs for similar issues
3. Create GitHub issue with:
   - Steps to reproduce
   - Error messages
   - Environment details
   - What you've tried

### Chrondle-Specific Emergency Commands

```bash
# Game-specific fixes
pnpm validate-puzzles               # Check puzzle data integrity
pnpm update-metadata                # Fix puzzle metadata
pnpm test-module-system             # Verify ESM configuration

# Quick health checks
pnpm build && pnpm size            # Build + bundle size check
pnpm test:unit                     # Fast tests only (< 2s)
pnpm lint:fix && pnpm format       # Auto-fix code issues

# Performance debugging
NODE_OPTIONS='--inspect' pnpm dev  # Debug with Chrome DevTools
pnpm build && pnpm size      # Run bundle size audit

# Common emergency commands
git commit --no-verify             # Skip pre-commit hooks
pkill -f node                      # Kill hanging processes
rm -rf node_modules && pnpm i      # Fresh dependency install

# CI simulation
pnpm lint && pnpm type-check && pnpm test:ci && pnpm build
```

### Project-Specific Gotchas

1. **Always use pnpm** - npm/yarn will fail with preinstall script
2. **Node.js 20+ required** - ESM modules won't work on older versions
3. **Puzzle data is sacred** - Always validate after any changes
4. **Tests must exit cleanly** - Check for timers in notification service
5. **Bundle limit: 170KB** - Size-limit will fail CI if exceeded

## 🎯 Prevention

### Before Each PR

- [ ] Run `pnpm build` locally
- [ ] Check `pnpm size` output
- [ ] Test in multiple browsers
- [ ] Verify no console errors

### Daily Habits

- Pull latest main before starting work
- Run tests before pushing
- Check CI status on GitHub
- Monitor bundle size trends

---

**Remember:** It's better to ask for help than to make things worse. Document what happened so we can prevent it next time.
