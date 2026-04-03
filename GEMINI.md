# Chrondle Context Guide

## Project Overview

**Chrondle** is a daily historical puzzle game where users guess the year of a historical event.

- **Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript.
- **Backend:** Convex (Real-time database, cron jobs, backend functions).
- **Authentication:** Clerk (Magic links, Google sign-in).
- **Deployment:** Vercel (Frontend), Convex (Backend).

## Development Workflow

### Setup

1.  **Node Environment:** `nvm use` (requires Node 20+).
2.  **Package Manager:** `bun` (strictly enforced).
3.  **Dependencies:** `bun install`.
4.  **Environment:** Copy `.env.example` to `.env.local` and configure keys.

### Running the App

- **Full Stack (Recommended):** `bun run dev` (Runs Next.js and Convex together).
- **Frontend Only:** `bun run dev:next` (Next.js with Turbopack).
- **Backend Only:** `bunx convex dev`.

### Testing

- **All Tests:** `bun run test` (Vitest).
- **Unit Tests:** `bun run test:unit`.
- **Integration Tests:** `bun run test:integration`.
- **E2E Tests:** `bun run test:e2e` (Playwright).
- **Coverage:** `bun run test:coverage`.

### Code Quality & Verification

- **Linting:** `bun run lint` (ESLint).
- **Type Check:** `bun run type-check` (TypeScript).
- **Formatting:** `bun run format` (Prettier).
- **Size Analysis:** `bun run size`.
- **Convex Verification:** `bun run verify:convex`.
- **Auth Verification:** `bun run verify:auth` or `bun run verify:auth:prod`.

## Architecture & Conventions

### Directory Structure

- `src/app`: Next.js App Router (routes, layouts).
- `src/components`: UI components (PascalCase).
  - `ui/`: Shared UI primitives.
  - `feature/`: Feature-specific components.
- `src/lib`: Domain logic and utilities.
- `src/hooks`: Custom React hooks (camelCase).
- `convex/`: Backend API (schema, mutations, queries, crons).
- `scripts/`: Maintenance and verification scripts.

### Design System

Follows a **Three-Layer Token Architecture**:

1.  **Primitives:** Raw OKLCH values (Internal use only).
2.  **Materials:** Theme-aware tokens (e.g., `--background`).
3.  **Semantic:** Intent-based tokens (e.g., `--text-primary`, `--surface-elevated`).
    - **Rule:** ALWAYS use Semantic tokens. NEVER use Primitives directly.
    - **Dark Mode:** Handled automatically via semantic tokens.

### Module Design Philosophy

- **Deep Modules:** Simple interfaces, rich implementations.
- **Colocation:** Keep related logic, types, and tests together.
- **Explicit Intention:** Hide implementation details; expose only what is necessary.

### Contribution Guidelines

- **Commits:** Follow Conventional Commits (`feat:`, `fix:`, `refactor:`).
- **Pull Requests:** Must pass linting, type-checking, and relevant tests.
- **Documentation:** Update docs when changing architecture or dependencies.

## Key Files

- `package.json`: Scripts and dependencies.
- `convex/schema.ts`: Database schema definition.
- `src/app/globals.css`: Global styles and design tokens.
- `DESIGN_SYSTEM.md`: Comprehensive design system documentation.
- `AGENTS.md`: Agent-specific protocols and guidelines.
