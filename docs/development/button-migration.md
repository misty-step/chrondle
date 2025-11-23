# Button Component Migration Guide

## Overview

This guide documents the migration path from magicui button components to shadcn/ui buttons for the Chrondle project.

## Current State

### Remaining MagicUI Components

After cleanup, only **1 button component** remains:

- ✅ `RippleButton` - **ACTIVE** (used in 2 locations)

### Removed Components (Successfully Cleaned Up)

- ❌ `pulsating-button.tsx` - 1.1k lines
- ❌ `rainbow-button.tsx` - 3.5k lines
- ❌ `shimmer-button.tsx` - 2.9k lines
- ❌ `shiny-button.tsx` - 2.3k lines

**Total cleanup**: ~10.8k lines removed

## Current RippleButton Usage

### 1. GameInstructions.tsx

**Context**: Share game results button

```tsx
<RippleButton
  onClick={() => shareGame()}
  disabled={isSharing}
  className={getShareButtonStyles()}
  rippleColor="rgba(255, 255, 255, 0.3)"
  aria-label="Share your results"
>
  {getShareButtonContent()}
</RippleButton>
```

**Features Used**:

- Custom `rippleColor` prop
- Dynamic className based on share status
- Accessibility attributes
- Dynamic content with icons and text

### 2. ShareCard.tsx

**Context**: Share victory card button

```tsx
<RippleButton
  onClick={onShare}
  disabled={false}
  className={getShareButtonStyles()}
  rippleColor="rgba(255, 255, 255, 0.3)"
  aria-label="Copy results to clipboard and share"
>
  <div className="relative z-10">{getShareButtonContent()}</div>
</RippleButton>
```

**Features Used**:

- Custom `rippleColor` prop
- Complex nested content with animations
- Background overlays for color transitions
- Z-index management for layered content

## Migration Strategy

### Option 1: Enhance shadcn/ui Button (Recommended)

**Approach**: Extend the existing shadcn/ui Button component with ripple functionality.

**Implementation**:

```tsx
// src/components/ui/ripple-button.tsx
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React, { MouseEvent, useEffect, useState } from "react";

interface RippleButtonProps extends ButtonProps {
  rippleColor?: string;
  duration?: string;
}

export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  (
    { className, rippleColor = "#ffffff", duration = "600ms", onClick, children, ...props },
    ref,
  ) => {
    const [ripples, setRipples] = useState<
      Array<{ x: number; y: number; size: number; key: number }>
    >([]);

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      createRipple(event);
      onClick?.(event);
    };

    const createRipple = (event: MouseEvent<HTMLButtonElement>) => {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;

      const newRipple = { x, y, size, key: Date.now() };
      setRipples((prev) => [...prev, newRipple]);
    };

    useEffect(() => {
      if (ripples.length > 0) {
        const lastRipple = ripples[ripples.length - 1];
        const timeout = setTimeout(() => {
          setRipples((prev) => prev.filter((ripple) => ripple.key !== lastRipple.key));
        }, parseInt(duration));
        return () => clearTimeout(timeout);
      }
    }, [ripples, duration]);

    return (
      <Button
        className={cn("relative overflow-hidden", className)}
        onClick={handleClick}
        ref={ref}
        {...props}
      >
        <div className="relative z-10">{children}</div>
        <span className="pointer-events-none absolute inset-0">
          {ripples.map((ripple) => (
            <span
              className="animate-rippling bg-background absolute rounded-full opacity-30"
              key={ripple.key}
              style={{
                width: `${ripple.size}px`,
                height: `${ripple.size}px`,
                top: `${ripple.y}px`,
                left: `${ripple.x}px`,
                backgroundColor: rippleColor,
                transform: "scale(0)",
              }}
            />
          ))}
        </span>
      </Button>
    );
  },
);
```

**Benefits**:

- ✅ Inherits all shadcn/ui Button variants and styling
- ✅ Maintains existing ripple functionality
- ✅ Consistent with project design system
- ✅ Type-safe with full TypeScript support
- ✅ Accessible by default (inherits from shadcn/ui Button)

### Option 2: Pure shadcn/ui Button (Alternative)

**Approach**: Replace RippleButton with standard shadcn/ui Button and remove ripple effects.

**Pros**:

- ✅ Simpler implementation
- ✅ Smaller bundle size
- ✅ Fully standardized components

**Cons**:

- ❌ Loses visual feedback enhancement
- ❌ May impact user experience for share actions
- ❌ Requires UX evaluation

## Migration Steps

### Phase 1: Preparation

1. **Create enhanced Button component** (Option 1) or prepare standard Button usage (Option 2)
2. **Add ripple CSS animation** to globals.css if using Option 1:
   ```css
   @keyframes rippling {
     0% {
       transform: scale(0);
       opacity: 0.3;
     }
     100% {
       transform: scale(1);
       opacity: 0;
     }
   }
   ```

### Phase 2: Migration

1. **Update imports** in affected files:

   ```tsx
   // Before
   import { RippleButton } from "@/components/magicui/ripple-button";

   // After (Option 1)
   import { RippleButton } from "@/components/ui/ripple-button";

   // After (Option 2)
   import { Button } from "@/components/ui/button";
   ```

2. **Update component usage** (Option 2 only):

   ```tsx
   // Before
   <RippleButton
     onClick={() => shareGame()}
     className={getShareButtonStyles()}
     rippleColor="rgba(255, 255, 255, 0.3)"
   >
     {getShareButtonContent()}
   </RippleButton>

   // After (Option 2)
   <Button
     onClick={() => shareGame()}
     className={getShareButtonStyles()}
   >
     {getShareButtonContent()}
   </Button>
   ```

### Phase 3: Cleanup

1. **Remove old magicui RippleButton** component
2. **Update tests** to reference new component location
3. **Verify functionality** in both GameInstructions and ShareCard

## Testing Checklist

### Functional Testing

- [ ] Share button works in game completion state
- [ ] Share button works in ShareCard modal
- [ ] Ripple effect appears on click (Option 1)
- [ ] Button states (disabled, success, error) work correctly
- [ ] Accessibility attributes are preserved
- [ ] Keyboard navigation works

### Visual Testing

- [ ] Button styling matches design system
- [ ] Ripple animation is smooth and performant (Option 1)
- [ ] No visual regressions in share workflows
- [ ] Responsive behavior maintained

### Performance Testing

- [ ] No memory leaks from ripple animations
- [ ] Bundle size impact measured
- [ ] Animation performance acceptable on mobile

## Rollback Strategy

If issues arise during migration:

1. **Immediate rollback**: Revert import changes
2. **Keep old component**: Maintain magicui RippleButton until issues resolved
3. **Gradual migration**: Migrate one component at a time
4. **Feature flag**: Use conditional imports during transition

## Future Considerations

### Design System Consistency

- All future buttons should use shadcn/ui Button as base
- Custom button variants should extend shadcn/ui patterns
- Consider creating a button component library with common patterns

### Performance Optimization

- Evaluate need for ripple effects on mobile devices
- Consider prefers-reduced-motion support
- Optimize animation performance for low-end devices

### Accessibility

- Ensure all button variants meet WCAG 2.1 AA standards
- Test with screen readers and keyboard navigation
- Consider high contrast and focus indicators

## Recommendation

**Use Option 1 (Enhanced shadcn/ui Button)** for the following reasons:

1. **Preserves user experience** - Maintains visual feedback that users expect
2. **Design system compliance** - Built on shadcn/ui foundation
3. **Future-proof** - Can be extended with other effects as needed
4. **Minimal disruption** - Drop-in replacement with same API
5. **Performance** - Inherits shadcn/ui optimizations

This approach provides the best balance of standardization, user experience, and maintainability.
