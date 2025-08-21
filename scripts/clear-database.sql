-- ============================================
-- Late Fine Tracker Database Clear Script
-- ============================================
-- 
-- This SQL script will completely clear all data from your database.
-- Use with extreme caution - this action cannot be undone!
--
-- To run this script:
-- 1. Connect to your Supabase database
-- 2. Execute these commands in order
-- 3. Or run: psql -h your-host -U your-user -d your-db -f scripts/clear-database.sql
--

-- Disable triggers temporarily to avoid cascading issues
SET session_replication_role = replica;

-- Clear all data in dependency order (children first, then parents)

-- 1. Clear events (references players and games)
DELETE FROM events;
SELECT 'Cleared events table' as status;

-- 2. Clear players (references games)
DELETE FROM players;
SELECT 'Cleared players table' as status;

-- 3. Clear game invites (references games and users)
DELETE FROM game_invites;
SELECT 'Cleared game_invites table' as status;

-- 4. Clear game members (references games and users)
DELETE FROM game_members;
SELECT 'Cleared game_members table' as status;

-- 5. Clear games (references users)
DELETE FROM games;
SELECT 'Cleared games table' as status;

-- 6. Clear profiles (references auth.users but we keep auth.users)
DELETE FROM profiles;
SELECT 'Cleared profiles table' as status;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset sequences (if any auto-increment columns exist)
-- Note: This database uses UUIDs, so no sequences to reset

-- Show final counts
SELECT 'events' as table_name, COUNT(*) as remaining_rows FROM events
UNION ALL
SELECT 'players' as table_name, COUNT(*) as remaining_rows FROM players
UNION ALL
SELECT 'game_invites' as table_name, COUNT(*) as remaining_rows FROM game_invites
UNION ALL
SELECT 'game_members' as table_name, COUNT(*) as remaining_rows FROM game_members
UNION ALL
SELECT 'games' as table_name, COUNT(*) as remaining_rows FROM games
UNION ALL
SELECT 'profiles' as table_name, COUNT(*) as remaining_rows FROM profiles
ORDER BY table_name;

SELECT 'Database cleared successfully!' as result;