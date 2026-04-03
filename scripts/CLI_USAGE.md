# Chrondle Events CLI Management

## Quick Start

The events CLI tool allows you to manage historical events in your Chrondle database.

```bash
# Verify all functions are deployed
bun run events verify

# Show all available commands
bun run events --help
```

## Common Commands

### Viewing Events

```bash
# List all years with event statistics
bun run events list

# Show all events for a specific year
bun run events show 1969

# Validate data integrity
bun run events validate
```

### Managing Individual Events

```bash
# Add a single event
bun run events add-one -y 1969 -e "Neil Armstrong walks on the moon"

# Update an event (use event number from 'show' command)
bun run events update-one -y 1969 -n 3 -t "Updated event text"

# Delete an event
bun run events delete-one -y 1969 -n 7
```

### Managing Year Events (Batch)

```bash
# Add 6 events for a year (required for puzzles)
bun run events add -y 1969 -e "Event 1" "Event 2" "Event 3" "Event 4" "Event 5" "Event 6"

# Update all events for a year (only if not used in puzzles)
bun run events update -y 1969 -e "New Event 1" "New Event 2" "New Event 3" "New Event 4" "New Event 5" "New Event 6"
```

## Important Notes

- **Production Safety**: Events used in published puzzles cannot be modified or deleted
- **Duplicate Prevention**: The system prevents adding duplicate events for the same year
- **Deployment Required**: After updating `convex/events.ts`, run `bunx convex deploy` to push changes to production
- **Event Count**: Each year needs exactly 6 events to be used for puzzle generation

## Troubleshooting

If you encounter errors:

1. **"Could not find function" error**: Run `bunx convex deploy` to deploy latest functions
2. **"Event already exists" error**: Check for duplicates with `bun run events show <year>`
3. **"Used in puzzle" error**: Events in published puzzles are protected from changes
4. **Verify deployment**: Run `bun run events verify` to check all functions are deployed

## Database Statistics

Check current database status:

```bash
# Get overall statistics
bun run events list

# Example output:
# Year  | Total | Used | Available
# ------|-------|------|----------
# 1969  | 6     | 0    | 6         ← Green: Ready for puzzles
# 1935  | 11    | 0    | 11        ← Green: Has extra events
# 2001  | 3     | 0    | 3         ← Yellow: Not enough for puzzle
```

## Environment Configuration

The CLI reads from `.env.local`:

- `NEXT_PUBLIC_CONVEX_URL`: Your Convex deployment URL
- Currently configured for production: `fleet-goldfish-183`
