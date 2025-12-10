# Chrondle-Specific Patterns

> Patterns discovered during Chrondle development. Generic patterns belong in global CLAUDE.md.

## Game Logic

### Era Conversion Boundary Logic

Year 0 handling in `convertFromInternalYear`:

```typescript
// ✅ Correct - year 0 is AD
return internalYear >= 0
  ? { year: internalYear, era: "AD" }
  : { year: Math.abs(internalYear), era: "BC" };
```

**Prevention**: Test boundary conditions explicitly (year 0, year 1, year -1).

### BC/AD Format Enforcement

Post-processing to replace BCE/CE with BC/AD:

```typescript
// In convex/actions/historicalContext.ts
const enforceADBC = (text: string): string =>
  text.replace(/\bBCE\b/g, "BC").replace(/\bCE\b/g, "AD");
```

### Year Boundary Assumptions

Tests often fail on year boundaries due to timezone/date assumptions. Always:

- Use explicit date mocking
- Test around midnight UTC
- Account for DST transitions

## Convex Patterns

### Function Invocation

```typescript
// CLI: npx convex run dir/file:functionName
npx convex run puzzles:getPuzzleByDate '{"dateString":"2025-01-15"}'

// NOT: npx convex run puzzles/queries:getPuzzleByDate
```

### Migration Scripts

- **Batch Processing**: 5 items/batch, 2s delays
- **Error Handling**: Continue on individual failures
- **Dry-run Mode**: Count without processing
- **Progress Tracking**: Log percentage, ETA

### Async Work Timing

```typescript
// Migration API returns in ~12s, but async work continues ~60s
// Must verify completion, not assume immediate success
await delay(5000);
const verified = await ctx.runQuery(api.puzzles.verifyMigration);
```

### Database Backup

```bash
# Always backup before major operations
npx convex export --path ./backups/$(date +%Y%m%d_%H%M%S).zip
```

## Event Generation

### Historical Context Generation

- Uses OpenRouter API with GPT-5
- Rate limit handling with exponential backoff
- Fallback to GPT-5-mini
- BC/AD enforcement via `enforceADBC()` post-processing
- Token estimation for cost tracking

### Quality Standards

Events must have:

- 4-6 hints per year
- Progressive reveal (vague → specific)
- No year mentioned in hint text
- Verified historical accuracy

## LocalStorage

### Anonymous Game State Migration

Pattern matching must be precise to avoid data loss:

```typescript
// ✅ Target only date-specific keys
const progressPattern = /^chrondle-game-\d/;

// ❌ Too broad - matches main game state
const badPattern = /^chrondle-game-/;
```

### Key Structure

- `chrondle-game-state` - Current game state
- `chrondle-game-YYYY-MM-DD` - Daily progress
- `chrondle-anonymous-streak` - Anonymous streak data

## CI/CD

### Performance Test Thresholds

```typescript
// Local: 16ms (60fps frame budget)
// CI: 25ms (shared resource variance)
expect(duration).toBeLessThan(isCI ? 25 : 16);
```

### Environment Variables

Early validation in `providers.tsx`:

```typescript
const required = ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
const missing = required.filter((v) => !process.env[v]);
if (missing.length) {
  return <EnvErrorUI missing={missing} />;
}
```

---

_Full pattern archive: `docs/archive/context_archive_2025-12.md`_
_Last updated: 2025-12-10_
