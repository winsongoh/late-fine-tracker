# Database Scripts

This directory contains scripts for managing your Late Fine Tracker database.

## Clear Database Script

The `clear-database.js` script allows you to completely clear all data from your database.

### ⚠️ **WARNING** 
**These scripts will permanently delete all data. This action cannot be undone!**

### Usage Options

#### 1. Interactive Mode (Recommended)
```bash
npm run db:clear
```
- Shows current database stats
- Asks for confirmation before proceeding
- Safe default option

#### 2. Dry Run Mode
```bash
npm run db:clear:dry-run
```
- Shows what would be deleted without actually deleting
- Perfect for testing and verification

#### 3. Skip Confirmation
```bash
npm run db:clear:confirm
```
- Skips the confirmation prompt
- Use only in automated scripts

#### 4. Direct Node Execution
```bash
node scripts/clear-database.js [options]
```

#### 5. SQL Script (Advanced)
```bash
# Connect to your database and run:
psql -h your-host -U your-user -d your-db -f scripts/clear-database.sql
```

### Command Line Options

- `--confirm` - Skip confirmation prompt
- `--dry-run` - Show what would be deleted without deleting
- `--tables=table1,table2` - Clear only specific tables

### Examples

```bash
# Clear only events and players
node scripts/clear-database.js --tables=events,players

# Dry run for specific tables
node scripts/clear-database.js --dry-run --tables=games,players

# Clear everything without confirmation (dangerous!)
node scripts/clear-database.js --confirm
```

### What Gets Cleared

The script clears tables in the following order to respect foreign key constraints:

1. **events** - All late fine events
2. **players** - All game players
3. **game_invites** - All pending/completed invites
4. **game_members** - All game memberships
5. **games** - All game sessions
6. **profiles** - User profile data

**Note:** The script does NOT delete:
- User authentication data (`auth.users`)
- Database structure (tables, functions, triggers)
- RLS policies

### Requirements

- Node.js environment
- Authenticated Supabase session
- Proper database permissions

### Safety Features

- Shows current row counts before deletion
- Requires explicit confirmation (unless bypassed)
- Provides dry-run mode for testing
- Detailed logging and error handling
- Graceful handling of Ctrl+C interruption

### Authentication

You must be signed in to your Supabase account before running the script. The script will check your authentication status and refuse to run if not authenticated.

### Troubleshooting

**"You must be authenticated" error:**
- Make sure you're signed in to your Supabase account
- Check your environment variables are set correctly

**Permission denied errors:**
- Ensure your user has DELETE permissions on all tables
- Check RLS policies aren't blocking the deletion

**Foreign key constraint errors:**
- The script handles dependency order automatically
- If you see this error, there may be custom constraints

### Recovery

If you accidentally clear your database:
- **User accounts** will still exist (auth.users is preserved)
- **Database structure** remains intact
- **Data** must be manually recreated or restored from backups
- Consider implementing regular database backups for production use