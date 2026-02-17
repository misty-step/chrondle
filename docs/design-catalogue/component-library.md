# Chrondle Component Library Specification

> **Design Philosophy:** Clean, editorial aesthetics inspired by NYT Games. Archival warmth for Classic mode, timeline amber for Order mode. Functional minimalism with tactile feedback.

---

## Token Reference

### CSS Custom Properties (globals.css)

```css
:root {
  /* Core tokens */
  --bg: #ffffff;
  --text: #1a1a1b;
  --muted: #787c7e;
  --border: #d3d6da;
  --success: #4a9b7f;
  --warning: #d4a84b;
  --neutral: #787c7e;

  /* Mode: Classic - Archival green/teal */
  --mode-classic-bg: #f0f7f4;
  --mode-classic-text: #1a1a1b;
  --mode-classic-accent: #2d6a4f;

  /* Mode: Order - Warm amber timeline */
  --mode-order-bg: #fef7ed;
  --mode-order-text: #1a1a1b;
  --mode-order-accent: #b45309;

  /* Typography */
  --font-display: "Outfit", sans-serif;
  --font-body: "Karla", sans-serif;
  --font-mono: ui-monospace, "SF Mono", monospace;

  /* Radii */
  --radius: 4px;
  --radius-sm: 3px;

  /* Shadows */
  --shadow-focus: 0 4px 10px rgba(26, 26, 27, 0.12);
  --shadow-hover: 0 2px 0 rgba(26, 26, 27, 0.15);
}

html.dark {
  --bg: #121213;
  --text: #e4e5f1;
  --muted: #9ca3af;
  --border: #3a3a3c;
  --success: #5fb899;
  --warning: #fbbf24;

  --mode-classic-bg: #1a2f25;
  --mode-classic-text: #e4e5f1;
  --mode-classic-accent: #6ee7b7;

  --mode-order-bg: #2a2015;
  --mode-order-text: #e4e5f1;
  --mode-order-accent: #fbbf24;
}
```

### Theme Tokens (@theme)

```css
--color-background: var(--bg);
--color-foreground: var(--text);
--color-primary: var(--text);
--color-primary-foreground: var(--bg);
--color-secondary: var(--border);
--color-muted: var(--border);
--color-muted-foreground: var(--muted);
--color-destructive: #b42318;
--color-border: var(--border);

--color-feedback-success: var(--success);
--color-feedback-warning: var(--warning);
--color-feedback-error: #b42318;
--color-feedback-info: #2563eb;

--color-mode-classic-bg: var(--mode-classic-bg);
--color-mode-classic-accent: var(--mode-classic-accent);
--color-mode-order-bg: var(--mode-order-bg);
--color-mode-order-accent: var(--mode-order-accent);
```

---

## 1. Button

Primary interactive element. Used for form submission, actions, and CTAs.

### Variants

| Variant       | Usage                          | Visual Treatment                  |
| ------------- | ------------------------------ | --------------------------------- |
| `primary`     | Main CTAs (Submit Guess)       | Solid green (#4a9b7f), white text |
| `secondary`   | Alternative actions            | Border with subtle fill           |
| `ghost`       | Icon buttons, tertiary actions | Transparent, hover fill           |
| `destructive` | Dangerous actions (Reset)      | Red background                    |
| `hint`        | Take Hint action               | Amber gradient, icon-left         |

### Sizes

| Size | Height      | Padding        | Use Case                   |
| ---- | ----------- | -------------- | -------------------------- |
| `sm` | 32px (h-8)  | px-4 text-xs   | Compact UIs, icon buttons  |
| `md` | 44px (h-11) | px-6 text-sm   | Default form actions       |
| `lg` | 48px (h-12) | px-8 text-base | Primary CTAs, mobile-first |

### States

| State           | Visual Treatment                             |
| --------------- | -------------------------------------------- |
| `default`       | Base variant style                           |
| `hover`         | translate-y-[-1px], shadow-hover, 10% darker |
| `active`        | translate-y-[1px], inset shadow              |
| `focus-visible` | ring-2 ring-ring ring-offset-2               |
| `disabled`      | opacity-50, cursor-not-allowed, no hover     |
| `loading`       | Spinner replaces text, maintain width        |

### Implementation

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded " +
    "text-sm font-bold tracking-[0.04em] uppercase transition-all duration-150 ease " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "disabled:pointer-events-none disabled:cursor-not-allowed " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[#4a9b7f] text-white border-0 " + "hover:bg-[#3d8a6e] hover:translate-y-[-1px]",
        secondary:
          "border-2 border-secondary bg-secondary text-secondary-foreground " +
          "hover:bg-secondary/80 shadow-sm",
        ghost:
          "border-2 border-transparent text-body-primary " +
          "hover:bg-primary/10 disabled:text-muted-foreground",
        destructive:
          "bg-destructive text-white border-2 border-destructive " +
          "hover:bg-destructive/90 shadow-sm",
        hint:
          "border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-amber-500/10 " +
          "text-base font-semibold normal-case tracking-normal " +
          "hover:scale-[1.02] hover:border-amber-500/70 hover:bg-amber-500/15 hover:shadow-md " +
          "dark:border-amber-400/50 dark:from-amber-400/10 dark:to-amber-400/20 " +
          "dark:hover:border-amber-400/70 dark:text-amber-100",
      },
      size: {
        sm: "h-8 rounded px-4 text-xs",
        md: "h-11 rounded px-6 text-sm",
        lg: "h-12 rounded px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner className="size-4 animate-spin" />
          <span className="sr-only">Loading</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

### Accessibility Requirements

- Minimum touch target: 44×44px (WCAG 2.5.5)
- Focus ring: 2px offset, high contrast
- Disabled state: visible but non-interactive
- Loading state: `aria-busy="true"`, `aria-label` preserved
- Icon-only: `aria-label` required

### Special: Take Hint Button

```tsx
// Dark mode fixed variant with proper contrast
<button
  className={cn(
    "flex items-center gap-2 rounded border-2 px-4 py-2",
    "border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-amber-500/10",
    "text-sm font-semibold transition-all",
    "hover:border-amber-500/70 hover:bg-amber-500/15 hover:shadow-md",
    // Dark mode overrides for visibility
    "dark:border-amber-400/60 dark:from-amber-400/15 dark:to-amber-400/25",
    "dark:text-amber-50 dark:hover:border-amber-400/80 dark:hover:from-amber-400/20 dark:hover:to-amber-400/30",
  )}
>
  <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" />
  Take Hint
</button>
```

---

## 2. Card

Surface container for content grouping. Used for clues, guesses, archive items.

### Variants

| Variant       | Usage               | Visual Treatment              |
| ------------- | ------------------- | ----------------------------- |
| `default`     | Standard content    | White bg, subtle border       |
| `elevated`    | Modals, overlays    | Shadow + higher z-index       |
| `interactive` | Clickable cards     | Hover state, cursor-pointer   |
| `classic`     | Classic mode themed | Green-tinted bg, green accent |
| `order`       | Order mode themed   | Amber-tinted bg, amber accent |
| `success`     | Correct feedback    | Green border, green bg tint   |
| `muted`       | Secondary content   | Gray bg, subtle border        |

### Padding Options

| Option     | Mobile | Desktop |
| ---------- | ------ | ------- |
| `compact`  | p-3    | p-4     |
| `default`  | p-4    | p-6     |
| `spacious` | p-6    | p-8     |

### Implementation

```tsx
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "classic" | "order" | "success" | "muted";
  padding?: "compact" | "default" | "spacious";
  as?: "div" | "section" | "article";
}

const cardVariants = {
  default: [
    "bg-card text-card-foreground",
    "border border-border",
    "dark:border-[#52525b] dark:bg-[#27272a]",
  ],
  elevated: [
    "bg-card text-card-foreground",
    "border border-border shadow-lg",
    "dark:border-[#52525b] dark:bg-[#27272a] dark:shadow-black/20",
  ],
  interactive: [
    "bg-card text-card-foreground",
    "border border-border",
    "hover:border-primary/30 hover:shadow-md",
    "cursor-pointer transition-all duration-150",
    "dark:border-[#52525b] dark:hover:border-primary/50",
  ],
  classic: [
    "bg-[var(--mode-classic-bg)]",
    "border border-[var(--mode-classic-accent)]/20",
    "dark:bg-[var(--mode-classic-bg)]",
  ],
  order: [
    "bg-[var(--mode-order-bg)]",
    "border border-[var(--mode-order-accent)]/20",
    "dark:bg-[var(--mode-order-bg)]",
  ],
  success: ["bg-feedback-success/5", "border border-feedback-success/20"],
  muted: ["bg-muted/30", "border border-border"],
};

const paddingVariants = {
  compact: "p-3 md:p-4",
  default: "p-4 md:p-6",
  spacious: "p-6 md:p-8",
};

function Card({
  className,
  variant = "default",
  padding = "default",
  as: Component = "div",
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={cn(
        "flex flex-col rounded",
        cardVariants[variant],
        paddingVariants[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

// Sub-components for composition
function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-lg leading-none font-semibold tracking-tight",
        "text-body-primary",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center pt-4", className)} {...props} />;
}
```

### Use Cases

```tsx
// Clue card (Classic mode)
<Card variant="classic" padding="default">
  <CardHeader>
    <CardTitle>Clue 1 of 6</CardTitle>
  </CardHeader>
  <CardContent>
    <p>This event occurred during the Renaissance period...</p>
  </CardContent>
</Card>

// Archive list item
<Card variant="interactive" padding="compact">
  <div className="flex items-center justify-between">
    <span>Puzzle #142</span>
    <Badge variant="success">Completed</Badge>
  </div>
</Card>

// Mode selection
<Card variant="order" padding="spacious" className="hover:shadow-lg">
  <ModeHero mode="order" />
</Card>
```

---

## 3. Input Group

Year input with integrated BC/AD toggle for historical date entry.

### Structure

```
┌─────────────────────────────────────┐
│  Year Input Group                   │
│  ┌──────────────┐  ┌────┬────┐     │
│  │ YYYY         │  │ BC │ AD │     │
│  └──────────────┘  └────┴────┘     │
└─────────────────────────────────────┘
```

### Components

#### YearInput

```tsx
interface YearInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  era: "BC" | "AD";
  onEraChange: (era: "BC" | "AD") => void;
  error?: string;
}

function YearInput({ className, era, onEraChange, error, ...props }: YearInputProps) {
  return (
    <div className={cn("flex items-stretch", className)}>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        className={cn(
          "border-border h-11 w-full min-w-0 rounded-l border border-r-0",
          "bg-background px-3 font-mono text-base tabular-nums",
          "transition-[border-color,box-shadow] outline-none",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-feedback-error focus-visible:ring-feedback-error",
        )}
        {...props}
      />
      <EraToggle value={era} onChange={onEraChange} />
    </div>
  );
}
```

#### EraToggle

```tsx
const toggleContainerVariants = cva("inline-flex rounded-r border border-border overflow-hidden", {
  variants: {
    size: {
      sm: "h-8",
      default: "h-11",
      lg: "h-12",
    },
  },
  defaultVariants: { size: "default" },
});

const toggleButtonVariants = cva(
  "inline-flex items-center justify-center px-3 min-w-[3rem] " +
    "text-sm font-medium transition-all duration-150 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        active: "bg-[#4a9b7f] text-white dark:bg-[#4a9b7f]",
        inactive: "bg-white text-foreground hover:bg-muted/50 dark:bg-[#27272a] dark:text-white/90",
      },
    },
    defaultVariants: { variant: "inactive" },
  },
);

function EraToggle({
  value,
  onChange,
  size = "default",
  disabled = false,
}: {
  value: "BC" | "AD";
  onChange: (value: "BC" | "AD") => void;
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Select era" className={toggleContainerVariants({ size })}>
      {(["BC", "AD"] as const).map((era) => (
        <button
          key={era}
          type="button"
          role="radio"
          aria-checked={value === era}
          disabled={disabled}
          onClick={() => onChange(era)}
          className={cn(
            toggleButtonVariants({ variant: value === era ? "active" : "inactive" }),
            era === "BC" && "border-border border-r",
          )}
        >
          {era}
        </button>
      ))}
    </div>
  );
}
```

#### RangeDisplay

Shows current range selection (e.g., "1500 BC → 1600 AD").

```tsx
interface RangeDisplayProps {
  startYear: number;
  startEra: "BC" | "AD";
  endYear: number;
  endEra: "BC" | "AD";
}

function RangeDisplay({ startYear, startEra, endYear, endEra }: RangeDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <span className="font-mono font-medium">
        {startYear} {startEra}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className="font-mono font-medium">
        {endYear} {endEra}
      </span>
    </div>
  );
}
```

### Accessibility

- Year input: `inputMode="numeric"` for mobile keyboards
- Era toggle: `role="radiogroup"` with `aria-checked`
- Keyboard: Arrow keys navigate between BC/AD
- Never auto-select era based on answer (prevents cheating)

---

## 4. Badge

Compact status indicator for counts, labels, and metadata.

### Variants

| Variant    | Usage               | Colors                             |
| ---------- | ------------------- | ---------------------------------- |
| `default`  | Neutral labels      | bg-primary text-primary-foreground |
| `success`  | Correct, completed  | bg-feedback-success text-white     |
| `warning`  | Hints used, caution | bg-feedback-warning text-white     |
| `info`     | Informational       | bg-feedback-info text-white        |
| `numbered` | Puzzle #, counts    | Primary bg with shadow             |
| `new`      | New feature badge   | Red bg, pulse animation            |
| `outline`  | Subtle labels       | Border only, transparent bg        |

### Implementation

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 " +
    "text-xs font-semibold transition-colors " +
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success: "border-transparent bg-feedback-success text-white hover:bg-feedback-success/90",
        warning: "border-transparent bg-feedback-warning text-white hover:bg-feedback-warning/90",
        info: "border-transparent bg-feedback-info text-white hover:bg-feedback-info/90",
        destructive: "border-transparent bg-destructive text-white hover:bg-destructive/90",
        outline: "border-border text-foreground hover:bg-muted",
        new: "border-transparent bg-red-500 text-white animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

### Special: Numbered Badge (Puzzle Numbers)

```tsx
function NumberBadge({ number }: { number: number }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center",
        "bg-primary rounded text-white",
        "text-lg leading-none font-bold",
        "shadow-[0_2px_0_rgba(26,26,27,0.15)]",
        "dark:bg-[#4a9b7f] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
      )}
    >
      {number}
    </span>
  );
}
```

### Use Cases

```tsx
// Hint count
<Badge variant="warning">{hintsRemaining} left</Badge>

// Streak indicator
<Badge variant="success" className="gap-1">
  <Flame className="size-3" />
  {streak} day streak
</Badge>

// Puzzle number
<NumberBadge number={142} />

// NEW badge
<Badge variant="new">NEW</Badge>
```

---

## 5. Toggle Group

Segmented control for exclusive selection. Used for BC/AD, mode tabs.

### Variants

| Variant     | Usage          | Style                           |
| ----------- | -------------- | ------------------------------- |
| `default`   | BC/AD toggle   | Rounded container, solid active |
| `pills`     | Mode tabs      | Pill-shaped buttons             |
| `underline` | Secondary tabs | Bottom border indicator         |

### Implementation

```tsx
import { cva } from "class-variance-authority";

const toggleGroupVariants = cva("inline-flex rounded-lg border border-border bg-muted p-1", {
  variants: {
    variant: {
      default: "",
      pills: "rounded-full",
    },
    size: {
      sm: "h-9",
      default: "h-11",
      lg: "h-12",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const toggleItemVariants = cva(
  "inline-flex items-center justify-center rounded px-4 " +
    "text-sm font-medium transition-all duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: {
          active: "bg-background text-foreground shadow-sm",
          inactive: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        },
        pills: {
          active: "bg-primary text-primary-foreground rounded-full",
          inactive: "text-muted-foreground hover:text-foreground rounded-full",
        },
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface ToggleGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  variant?: "default" | "pills";
  size?: "sm" | "default" | "lg";
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  variant = "default",
  size = "default",
}: ToggleGroupProps<T>) {
  return (
    <div role="radiogroup" className={toggleGroupVariants({ variant, size })}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            toggleItemVariants({ variant })[value === option.value ? "active" : "inactive"],
            "flex-1",
          )}
        >
          {option.icon && <span className="mr-2">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

### Use Cases

```tsx
// Mode selection
<ToggleGroup
  value={mode}
  onChange={setMode}
  options={[
    { value: "classic", label: "Classic", icon: <Target /> },
    { value: "order", label: "Order", icon: <ArrowUpDown /> },
  ]}
/>

// Era toggle (simpler version)
<EraToggle value={era} onChange={setEra} />
```

---

## Light/Dark Mode Considerations

### Color Strategy

| Token    | Light   | Dark    |
| -------- | ------- | ------- |
| Surface  | #ffffff | #121213 |
| Elevated | #ffffff | #1e1e1f |
| Text     | #1a1a1b | #e4e5f1 |
| Muted    | #787c7e | #9ca3af |
| Border   | #d3d6da | #3a3a3c |
| Success  | #4a9b7f | #5fb899 |
| Warning  | #d4a84b | #fbbf24 |

### Implementation Pattern

```tsx
// Always specify both modes
<div className={cn(
  "bg-white text-[#1a1a1b]",
  "dark:bg-[#121213] dark:text-[#e4e5f1]"
)} />

// Use CSS custom properties when possible
<div className="bg-[var(--bg)] text-[var(--text)]" />

// Shadcn theme tokens automatically adapt
<div className="bg-background text-foreground" />
```

### Special Dark Mode Overrides

```tsx
// Hint button needs extra attention
"dark:border-amber-400/60 dark:from-amber-400/15 dark:to-amber-400/25";

// Cards need proper elevated surface
"dark:border-[#52525b] dark:bg-[#27272a]";

// Inputs need distinct borders
"dark:border-[#3a3a3c] dark:bg-[#1e1e1f]";
```

---

## Utility: cn() Helper

All components use the `cn()` utility for class merging:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Benefits:

- Handles conditional classes cleanly
- Merges Tailwind classes correctly (no duplicates)
- Type-safe with `ClassValue`

---

## File Organization

```
src/components/ui/
├── button.tsx          # Button component + variants
├── card.tsx            # Card + sub-components
├── input.tsx           # Base input
├── EraToggle.tsx       # Year input + era toggle
├── Badge.tsx           # Badge variants
├── toggle-group.tsx    # ToggleGroup component
├── index.ts            # Centralized exports
└── __tests__/          # Component tests
```

---

## Changelog

| Date       | Change                |
| ---------- | --------------------- |
| 2026-02-02 | Initial specification |
