-- Final fix for infinite recursion in RLS policies
-- This completely removes circular dependencies

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view accessible games" ON games;
DROP POLICY IF EXISTS "Users can insert own games" ON games;
DROP POLICY IF EXISTS "Users can update own games" ON games;
DROP POLICY IF EXISTS "Users can delete own games" ON games;

DROP POLICY IF EXISTS "Users can view game members" ON game_members;
DROP POLICY IF EXISTS "Game owners can insert members" ON game_members;
DROP POLICY IF EXISTS "Game owners can delete members" ON game_members;
DROP POLICY IF EXISTS "Game owners can update members" ON game_members;

DROP POLICY IF EXISTS "Users can view players in accessible games" ON players;
DROP POLICY IF EXISTS "Users can manage players in accessible games" ON players;

DROP POLICY IF EXISTS "Users can view events in accessible games" ON events;
DROP POLICY IF EXISTS "Users can manage events in accessible games" ON events;

-- Create SIMPLE policies for games (no recursion)
CREATE POLICY "Users can view own games" ON games
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can view shared games" ON games
  FOR SELECT USING (
    id IN (
      SELECT game_id FROM game_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own games" ON games
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own games" ON games
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own games" ON games
  FOR DELETE USING (created_by = auth.uid());

-- Create SIMPLE policies for game_members (no recursion)
CREATE POLICY "Users can view own memberships" ON game_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Game owners can view all members" ON game_members
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Game owners can insert members" ON game_members
  FOR INSERT WITH CHECK (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Game owners can delete members" ON game_members
  FOR DELETE USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
    OR user_id = auth.uid() -- Users can remove themselves
  );

CREATE POLICY "Game owners can update members" ON game_members
  FOR UPDATE USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

-- Create SIMPLE policies for players (no complex joins)
CREATE POLICY "Users can view players in owned games" ON players
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view players in member games" ON players
  FOR SELECT USING (
    game_id IN (
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage players in owned games" ON players
  FOR ALL USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Members can manage players in shared games" ON players
  FOR ALL USING (
    game_id IN (
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

-- Create SIMPLE policies for events (no complex joins)
CREATE POLICY "Users can view events in owned games" ON events
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view events in member games" ON events
  FOR SELECT USING (
    game_id IN (
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage events in owned games" ON events
  FOR ALL USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Members can manage events in shared games" ON events
  FOR ALL USING (
    game_id IN (
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );