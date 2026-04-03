# Chrondle Event Database Management Workflow

## 🚨 CRITICAL: Always Check Before Adding!

The #1 mistake is assuming a year is missing when it actually exists. This creates duplicates and wastes time.

### ⚠️ Golden Rule

**NEVER add a year without checking if it exists first!**

```bash
# WRONG ❌
bun run events add -y 1776 -e "Event 1" "Event 2" "Event 3" "Event 4" "Event 5" "Event 6"
# Error: Year 1776 already exists with 8 events.

# RIGHT ✅
bun run events show 1776  # Check first!
# If "Year not found" → Safe to add
# If events exist → Review quality instead
```

## 📋 Pre-Flight Checklist

### Step 1: Check What You're Working With

```bash
# Check specific years you think might be missing
bun run events check-years 1492 1776 1865 1453 1620 1783

# Find all missing years in a historical period
bun run events find-missing --from 1800 --to 1900

# Get overall database health report
bun run events audit
```

### Step 2: Decision Tree

```
Is the year missing?
├─ YES → Add new year with 6 events
│        bun run events add -y YEAR -e "..." (6 events)
│
└─ NO → Year exists
        │
        ├─ Has < 6 events? → Add more events
        │   bun run events add-one -y YEAR -e "..."
        │
        ├─ Has vague events? → Fix them
        │   bun run events show YEAR
        │   bun run events update-one -y YEAR -n NUMBER -t "Better event"
        │
        ├─ Has duplicates? → Remove them
        │   bun run events show YEAR
        │   bun run events delete-one -y YEAR -n NUMBER
        │
        └─ Has < 10 events? → Add variety
            bun run events add-one -y YEAR -e "..."
```

## 🎯 Prioritized Workflow

### Priority 1: Add Missing Years

```bash
# Find what's truly missing
bun run events find-missing --from 1400 --to 2000

# Add a missing year (ONLY if confirmed missing!)
bun run events add -y 1850 \
  -e "California becomes 31st state joining United States" \
  -e "Taiping Rebellion begins in Qing Dynasty China" \
  -e "Millard Fillmore becomes thirteenth President after Taylor dies" \
  -e "Compromise of 1850 attempts to settle slavery disputes" \
  -e "Louis Napoleon stages coup establishing Second French Empire" \
  -e "Telegraph cable laid under English Channel connecting Britain France"
```

### Priority 2: Fix Quality Issues

```bash
# Audit for quality problems
bun run events audit

# Review a year with issues
bun run events show 1776

# Fix vague events (add proper nouns!)
# BAD:  "A scientist makes a discovery"
# GOOD: "Marie Curie discovers radium"
bun run events update-one -y 1776 -n 1 -t "Adam Weishaupt founds Illuminati in Bavaria"
```

### Priority 3: Expand Depleted Years

```bash
# Find depleted years
bun run events audit  # Look for red/yellow years

# Add variety to depleted years
bun run events add-one -y 1969 -e "Sesame Street premieres on PBS television"
```

## 📝 Event Quality Standards

Every event MUST:

- ✅ Use proper nouns (people, places, organizations)
- ✅ Be factually accurate and verifiable
- ✅ Be unique within its year
- ✅ Not reveal the year in the text
- ✅ Be ≤ 20 words, present tense

### Good Events

- "Neil Armstrong walks on the moon" ✅
- "Constantinople falls to Ottoman Empire" ✅
- "Marie Curie wins Nobel Prize in Physics" ✅

### Bad Events

- "A space achievement occurs" ❌ (vague, no proper nouns)
- "The Y2K bug causes panic" ❌ (reveals year 2000)
- "Scientists make important discovery" ❌ (no specifics)

## 🔍 Common Mistakes to Avoid

### Mistake 1: Not Checking First

```bash
# ALWAYS run this first:
bun run events show 1492
# or
bun run events check-years 1492 1776 1865
```

### Mistake 2: Ignoring Warnings

```bash
# This warning means the year ALREADY EXISTS:
"⚠️  Warning: Year 1776 already has 8 events"
# STOP and check instead of continuing!
```

### Mistake 3: Creating Duplicates

```bash
# Check for similar events before adding
bun run events show 1492
# Look for events that might be worded differently but same fact
```

### Mistake 4: Vague Descriptions

```bash
# Always use proper nouns!
# ❌ "Explorer discovers new lands"
# ✅ "Christopher Columbus reaches San Salvador"
```

## 🛠️ Useful Command Reference

### Information Commands

```bash
bun run events list              # See all years with color coding
bun run events show 1969         # View all events for a year
bun run events check-years 1492 1776  # Check if specific years exist
bun run events find-missing      # Find gaps in coverage
bun run events audit             # Quality and priority report
bun run events validate          # Check data integrity
```

### Modification Commands

```bash
bun run events add -y YEAR -e "..." (x6)     # Add new year
bun run events add-one -y YEAR -e "..."      # Add single event
bun run events update-one -y YEAR -n NUM -t "..."  # Fix an event
bun run events delete-one -y YEAR -n NUM     # Remove duplicate
```

## 📊 Understanding Output Colors

- 🟢 **Green**: Ready for puzzles (6+ available events)
- 🟡 **Yellow**: Partially depleted (1-5 available)
- 🔴 **Red**: Fully depleted (0 available, all used)

## 🚀 Example Workflow Session

```bash
# 1. Start with audit to understand priorities
bun run events audit

# 2. Check years I think might be missing
bun run events check-years 1066 1215 1492 1776

# Output shows 1066 and 1215 are MISSING

# 3. Add truly missing year 1066
bun run events add -y 1066 \
  -e "William the Conqueror defeats Harold at Battle of Hastings" \
  -e "Halley's Comet appears before Norman invasion of England" \
  -e "Westminster Abbey construction begins under Edward Confessor" \
  -e "Harald Hardrada dies at Battle of Stamford Bridge" \
  -e "Norman French becomes language of English aristocracy" \
  -e "Domesday Book survey commissioned to catalog English holdings"

# 4. Review existing year 1492 for quality
bun run events show 1492
# Found vague event at position 2

# 5. Fix vague event
bun run events update-one -y 1492 -n 2 -t "Martin Behaim creates first terrestrial globe"

# 6. Validate everything looks good
bun run events validate
```

## ✨ Pro Tips

1. **Batch check years** before starting work:

   ```bash
   bun run events check-years 1066 1215 1415 1492 1588 1666 1776
   ```

2. **Use audit regularly** to prioritize work:

   ```bash
   bun run events audit | head -50
   ```

3. **Keep events diverse** - mix politics, science, culture, sports

4. **Verify with multiple sources** before adding events

5. **Run validation** after major changes:
   ```bash
   bun run events validate
   ```

Remember: **Quality > Quantity**. Better to have well-crafted events with proper nouns than many vague ones!
