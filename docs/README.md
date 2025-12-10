# Chrondle Documentation

> Daily historical year-guessing game. Players guess when historical events occurred.

## Quick Links

### Architecture

- [State Management](./architecture/state-management.md) - Pure functional state derivation
- [State Migration Guide](./architecture/state-derivation-migration-guide.md)
- [Convex Pipeline](./architecture/convex-pipeline.md) - Event generation pipeline architecture
- [Module Requirements](./MODULE_REQUIREMENTS.md) - Module design principles

### Design System

- [Design Tokens](./design-tokens.md) - Three-layer token architecture, colors, typography
- [Animation Patterns](./ANIMATION_PATTERNS.md) - Motion design, reduced motion support

### Development

- [Deployment Guide](./deployment-guide.md) - Vercel + Convex deployment
- [Contributing](./guides/contributing.md) - How to contribute
- [Code Review](./development/code-review.md) - Review checklist and patterns
- [Button Migration](./development/button-migration.md) - Component patterns
- [CI Debugging](./development/ci-debugging.md) - GitHub Actions troubleshooting
- [DST Handling](./development/DST_HANDLING_RESEARCH.md) - Timezone edge cases

### Testing

- [TDD Review](./testing/tdd-review.md) - Test-driven development strategy
- [Test Design Review](./testing/test-design-review.md) - Test architecture analysis

### Game Specs

- [Matchmaker Game](./specs/matchmaker-game.md) - Alternative game mode specification

### Backend & Data

- [Event Generation Pipeline](./EVENT_GENERATION_PIPELINE.md) - Gemini 3 integration
- [Admin Dashboard](./admin-dashboard.md) - Event curation interface

### Security & Auth

- [Security](./SECURITY.md) - Security guidelines
- [Authentication](./AUTHENTICATION.md) - Clerk integration
- [Logger Audit](./security/LOGGER_AUDIT_2025-10-17.md) - Security audit

### Observability

- [Observability](./observability.md) - Monitoring setup
- [Performance Debugging](./performance-debugging.md) - Profiling guide
- [Debugging Guidelines](./debugging-guidelines.md) - General debugging

### Operations

- [Emergency Procedures](./operations/emergency.md) - Incident response
- [Troubleshooting](./operations/troubleshooting.md) - Common issues

### Reports & Audits

- [Baseline Metrics](./reports/baseline-metrics.md) - Performance baselines
- [Theme System Audit](./reports/theme-system-audit.md)
- [Service Worker Test](./reports/SERVICE_WORKER_TEST_REPORT.md)

### Accessibility

- [Order Mode Audit](./accessibility/order-audit.md) - A11y review

### Infrastructure

- [CI Security Audit](./ci-security-audit-proposal.md)
- [Dependency Overrides](./dependency-overrides.md)

---

## Root-Level Documentation

These files live at repository root:

| File           | Purpose                            |
| -------------- | ---------------------------------- |
| `README.md`    | Project overview, quick start      |
| `CLAUDE.md`    | AI assistant operations brief      |
| `AGENTS.md`    | Repository contribution guidelines |
| `GEMINI.md`    | Research assistant configuration   |
| `BACKLOG.md`   | Active task backlog                |
| `CHANGELOG.md` | Version history                    |

### Ephemeral (Temporary)

- `TASK.md` - Current task context
- `DESIGN.md` - Active design work
- `TODO.md` - Immediate todos

---

## Archive

Historical documentation: [docs/archive/](./archive/)
