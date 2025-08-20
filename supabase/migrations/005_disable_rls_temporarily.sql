-- Temporary fix: Disable RLS on game_members to break the cycle
-- This allows games to be created without circular dependency

-- Disable RLS on game_members temporarily
ALTER TABLE game_members DISABLE ROW LEVEL SECURITY;

-- Keep simple policies only on games table
DROP POLICY IF EXISTS "Users can view own games" ON games;
DROP POLICY IF EXISTS "Users can view shared games" ON games;
DROP POLICY IF EXISTS "Users can insert own games" ON games;
DROP POLICY IF EXISTS "Users can update own games" ON games;
DROP POLICY IF EXISTS "Users can delete own games" ON games;

-- Simple game policies that don't reference game_members
CREATE POLICY "Users can manage own games" ON games
  FOR ALL USING (created_by = auth.uid());

-- Drop all game_members policies since RLS is disabled
DROP POLICY IF EXISTS "Users can view own memberships" ON game_members;
DROP POLICY IF EXISTS "Game owners can view all members" ON game_members;
DROP POLICY IF EXISTS "Game owners can insert members" ON game_members;
DROP POLICY IF EXISTS "Game owners can delete members" ON game_members;
DROP POLICY IF EXISTS "Game owners can update members" ON game_members;

-- Keep simple policies for players and events that only check game ownership
DROP POLICY IF EXISTS "Users can view players in owned games" ON players;
DROP POLICY IF EXISTS "Users can view players in member games" ON players;
DROP POLICY IF EXISTS "Users can manage players in owned games" ON players;
DROP POLICY IF EXISTS "Members can manage players in shared games" ON players;

CREATE POLICY "Users can manage players" ON players
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view events in owned games" ON events;
DROP POLICY IF EXISTS "Users can view events in member games" ON events;
DROP POLICY IF EXISTS "Users can manage events in owned games" ON events;
DROP POLICY IF EXISTS "Members can manage events in shared games" ON events;

CREATE POLICY "Users can manage events" ON events
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );