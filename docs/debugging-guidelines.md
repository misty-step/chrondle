# Debugging Guidelines for Chrondle

This guide provides best practices for debugging and development workflows in the Chrondle codebase. Following these guidelines ensures consistent, efficient debugging while maintaining clean production code.

## When to Use console.log vs Logger

### Use the Logger Module

The Chrondle codebase includes a custom logger module (`src/lib/logger.ts`) that provides environment-aware logging. **Always prefer the logger over direct console statements.**

```typescript
import { logger } from "@/lib/logger";

// ✅ Good - Use logger for debug output
logger.debug("Daily year calculation:", { year, hash, index });
logger.info("Game state initialized");
logger.warn("Puzzle data missing for year:", year);
logger.error("Failed to load puzzle:", error);

// ❌ Bad - Direct console usage
console.log("Debug output:", data);
```

### Logger Benefits

1. **Environment-aware**: Automatically suppresses debug logs in production and tests
2. **Consistent formatting**: All logs follow `[LEVEL] message` format
3. **ESLint compliant**: Won't trigger no-console rules
4. **Test-friendly**: Automatically mocked in test environment

### When Direct Console is Acceptable

Direct console usage is only acceptable in these specific cases:

1. **Logger module itself**: The logger implementation needs console access
2. **Build scripts**: Node.js scripts outside the main application
3. **Emergency debugging**: Temporary debugging that will be removed before commit

## How to Debug in Development vs Production

### Development Debugging

In development, you have access to full debugging capabilities:

```typescript
// Debug mode utilities (available via URL parameter ?debug=true)
// Access via window.chrondle in browser console
window.chrondle.debug(); // Dump current game state
window.chrondle.state(); // Show game state
window.chrondle.clearStorage(); // Clear all localStorage
window.chrondle.testYear(1969); // Test specific year

// Use logger for persistent debug output
logger.debug("Puzzle initialization", {
  targetYear,
  eventsCount: events.length,
  puzzleId,
});

// React DevTools for component debugging
// - Inspect component props and state
// - Profile re-renders
// - Track hook values
```

### Production Debugging

In production, debugging must be more careful:

1. **Use debug mode**: Add `?debug=true` to URL for enhanced debugging
2. **Browser DevTools**: Leverage Network, Console, and Application tabs
3. **Error boundaries**: Implement proper error catching and reporting
4. **Performance monitoring**: Use the Performance tab for bottleneck analysis

```typescript
// Production-safe debugging pattern
if (process.env.NODE_ENV === "development") {
  logger.debug("Detailed debug info:", complexObject);
} else {
  // In production, log only essential info
  logger.info("Operation completed", { id: operation.id });
}
```

## Best Practices for Removing Debug Code Before Commits

### 1. Use Git Hooks

The codebase includes pre-commit hooks that check for console.log statements. Never bypass these checks without good reason.

```bash
# If you see this error:
# ❌ Error: console.log statements found in staged files

# Fix by replacing with logger calls or removing debug code
```

### 2. Search Before Committing

Always search for debug artifacts before committing:

```bash
# Search for console statements
rg "console\.(log|debug)" src/

# Search for debug comments
rg "DEBUG:|FIXME:|TODO:" src/

# Search for temporary variables
rg "(temp|test|debug)" src/ --type ts
```

### 3. Use Feature Branches

Keep debug code isolated in feature branches:

```bash
# Create a debug branch for extensive debugging
git checkout -b debug/puzzle-selection

# When done, create a clean branch for the actual fix
git checkout main
git checkout -b fix/puzzle-selection
# Cherry-pick only the fix commits, not debug commits
```

### 4. Code Review Checklist

Before submitting PRs, ensure:

- [ ] No console.log statements (except in logger.ts)
- [ ] No commented-out debug code
- [ ] No temporary test data or hardcoded values
- [ ] All logger.debug calls are appropriate for long-term use
- [ ] No personal debugging utilities or test functions

## How to Use Browser DevTools Instead of console.log

### 1. Breakpoints Instead of Logs

```typescript
// ❌ Bad - Littering code with logs
function calculatePuzzleHash(date: string) {
  console.log("Input date:", date);
  const hash = computeHash(date);
  console.log("Computed hash:", hash);
  const index = hash % YEARS.length;
  console.log("Selected index:", index);
  return YEARS[index];
}

// ✅ Good - Use breakpoints
function calculatePuzzleHash(date: string) {
  const hash = computeHash(date); // Set breakpoint here
  const index = hash % YEARS.length; // Inspect variables in debugger
  return YEARS[index];
}
```

### 2. Conditional Breakpoints

For debugging specific scenarios:

1. Right-click on line number in Sources tab
2. Select "Add conditional breakpoint"
3. Enter condition: `year === 1969 || !events.length`

### 3. Watch Expressions

Add expressions to monitor while debugging:

1. In Sources tab, find "Watch" panel
2. Add expressions like:
   - `gameState.puzzle.year`
   - `localStorage.getItem('chrondle-progress-2024-01-15')`
   - `document.querySelector('.guess-input').value`

### 4. Console Utilities

Use DevTools console for exploration without modifying code:

```javascript
// Inspect React components
$r; // Currently selected React component in DevTools

// Query and test
document.querySelectorAll("[data-testid]");
localStorage.getItem("chrondle-settings");

// Performance profiling
performance.mark("puzzle-start");
// ... operation ...
performance.mark("puzzle-end");
performance.measure("puzzle-time", "puzzle-start", "puzzle-end");
```

### 5. Network Debugging

For API-related debugging:

1. **Network tab**: Monitor API calls and responses
2. **Throttling**: Test with slow connections
3. **Request blocking**: Test error scenarios
4. **Response overrides**: Test edge cases

### 6. React Developer Tools

Essential for React debugging:

1. **Components tab**: Inspect props, state, and hooks
2. **Profiler tab**: Identify performance issues
3. **Search**: Find components by name or prop values
4. **Hook inspection**: Debug custom hooks like `useChrondle`

## Debug Mode Features

Chrondle includes a built-in debug mode accessible via URL parameters:

```bash
# Enable debug mode
https://chrondle.com?debug=true

# Test specific year
https://chrondle.com?debug=true&year=1969

# Test specific scenario
https://chrondle.com?debug=true&scenario=error
```

### Debug Mode Utilities

When debug mode is active, these utilities are available:

```javascript
// Global debug object
window.chrondle = {
  // Dump current state
  debug: () => void,

  // Reset game
  reset: () => void,

  // Clear all storage
  clearStorage: () => string[],

  // Force specific year
  setYear: (year: number) => void,

  // Test year with page reload
  testYear: (year: number) => void,

  // Show current game state
  state: () => void
};
```

### Debug Keyboard Shortcuts

In debug mode, these shortcuts are available:

- `Ctrl+R` / `Cmd+R`: Reset game
- `Ctrl+C` / `Cmd+C`: Clear storage and reload
- `Ctrl+D` / `Cmd+D`: Dump current state

## Performance Debugging

### Using Performance Tests

The codebase includes performance benchmarks:

```bash
# Run performance tests
pnpm test src/lib/__tests__/performance.test.ts

# Check for performance regressions
pnpm test -- --reporter=verbose
```

### Browser Performance Tools

1. **Performance tab**: Record and analyze runtime performance
2. **Memory tab**: Check for memory leaks
3. **Coverage tab**: Find unused code
4. **Bundle Analysis**: Overall bundle size audit

### Performance Debugging Pattern

```typescript
// Measure specific operations
const measurePerformance = (operation: string, fn: () => void) => {
  if (process.env.NODE_ENV === "development") {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    logger.debug(`${operation} took ${duration.toFixed(2)}ms`);
  } else {
    fn();
  }
};

// Usage
measurePerformance("puzzle-initialization", () => {
  initializePuzzle(sortEventsByRecognizability);
});
```

## Common Debugging Scenarios

### 1. Puzzle Selection Issues

```typescript
// Debug daily puzzle selection
logger.debug("Daily puzzle debug", {
  date: new Date().toISOString(),
  hash: calculateHash(dateString),
  selectedYear: getDailyYear(),
  availableYears: SUPPORTED_YEARS,
});
```

### 2. State Management Issues

```typescript
// Debug React state updates
useEffect(() => {
  logger.debug("Game state updated", {
    guesses: gameState.guesses.length,
    isGameOver: gameState.isGameOver,
    currentHint: currentHintIndex,
  });
}, [gameState, currentHintIndex]);
```

### 3. localStorage Issues

```typescript
// Debug storage operations
const debugStorage = () => {
  const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("chrondle-"));

  logger.debug("Chrondle storage state", {
    keys: allKeys,
    totalSize: new Blob(Object.values(localStorage)).size,
  });
};
```

## Summary

1. **Always use the logger module** instead of console.log
2. **Leverage browser DevTools** for non-invasive debugging
3. **Remove all debug code** before committing
4. **Use debug mode** for production debugging
5. **Profile performance** regularly
6. **Follow the pre-commit hooks** - they're there to help

Remember: Good debugging practices lead to cleaner code and faster development cycles. When in doubt, use breakpoints and DevTools instead of littering the code with log statements.
