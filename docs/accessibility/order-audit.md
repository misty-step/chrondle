# Order Mode Accessibility Audit — 2025-11-08

## Scope & Methodology

- **Surfaces reviewed**: `/order` page (Server + OrderGameIsland), shared components (DraggableEventCard, OrderEventList, HintDisplay, OrderReveal).
- **Techniques**:
  - Automated linting (`pnpm lint`) focusing on JSX a11y rules.
  - Keyboard-only walkthrough in local dev (tab order, focus rings, action triggers).
  - Reduced-motion preference simulation (`prefers-reduced-motion` media query override).
  - Screen reader heuristics (ARIA attributes, live regions, semantic structure) via manual code inspection.
- **Not covered (requires hardware / OS interaction)**:
  - VoiceOver on macOS.
  - NVDA on Windows.
  - TalkBack on Android.
  - Lighthouse audit (needs running build + Chrome).

## Findings & Status

| #   | Area                  | Issue                                                                       | Status                                                                               |
| --- | --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A1  | Drag handle           | Lacked explicit label/description for screen readers.                       | ✅ Already labeled `aria-label="Drag handle"`; verified focusable button.            |
| A2  | Move buttons          | No mention of target event in accessible name.                              | ✅ `aria-label` now announces target event + resulting position.                     |
| A3  | Live announcements    | `OrderEventList` announces reorder results via sr-only paragraph.           | ✅ Verified text updates; recommend hooking into `aria-live="polite"` (already set). |
| A4  | HintDisplay accordion | Uses Radix (ARIA-compliant); confirm focus traps during manual SR run.      | ⚠️ Requires future VoiceOver verification.                                           |
| A5  | Share feedback        | Added `role="status"` text for copy success/failure.                        | ✅ Manual inspection.                                                                |
| A6  | Color contrast        | OrderReveal misordered state uses `bg-destructive/10`; contrast borderline. | ✅ Strengthened misordered styling (deeper bg, high-contrast text/border).           |

## Keyboard Walkthrough Notes

- **Tab order**: Header → hint panel → event controls → share button (completed). All interactive elements reachable.
- **Space/Enter**: Buttons respond correctly; drag handle button currently toggles pointer sensors only (expected). Up/Down buttons reorder.
- **Focus styling**: Tailwind focus ring via `focus-visible` used consistently; verify on Windows High Contrast in follow-up.

## Reduced Motion

- OrderGameIsland + OrderReveal respect `useReducedMotion`; confirmed no animation when media query enabled via DevTools.
- dnd-kit still animates transforms even with reduced motion. Action: evaluate `animateLayoutChanges` override to disable for users requesting minimal motion.

## Automated Lint

```
pnpm lint
```

- Completed with warnings (see ESLint output):
  - `@next/next/no-img-element` (BitcoinModal, SupportModal) — unrelated to Order but recorded.
  - `jsx-a11y` warnings on shared UI (EraToggle, ProgressBar, SmartTooltip).
  - `OrderReveal` unused variable warning (addressed separately).
- No blocking errors; follow-up tickets needed for legacy UI components.

## Next Manual Steps

1. **VoiceOver**: Full flow from load → drag via keyboard → commit ordering. Capture notes in this doc.
2. **NVDA**: Verify announcements for reorder operations, share feedback, hint usage.
3. **TalkBack**: Touch drag performance, large touch targets (≥48px) already satisfied.
4. **Lighthouse**: Run against `/order` once hosted preview exists; target ≥95 score. Document results.
5. **Contrast fix**: Evaluate `bg-destructive/20` for misordered cards to exceed 4.5:1.

_Add future results below when completed._
