-- Fix RLS policies to prevent infinite recursion

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view members of games they have access to" ON game_members;
DROP POLICY IF EXISTS "Game owners can manage members" ON game_members;
DROP POLICY IF EXISTS "Users can leave games" ON game_members;

-- Create fixed policies for game_members
CREATE POLICY "Users can view game members" ON game_members
  FOR SELECT USING (
    -- Users can see members of games they own
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR
    -- Users can see their own membership records
    user_id = auth.uid()
  );

CREATE POLICY "Game owners can insert members" ON game_members
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Game owners can delete members" ON game_members
  FOR DELETE USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR
    -- Users can remove themselves
    user_id = auth.uid()
  );

CREATE POLICY "Game owners can update members" ON game_members
  FOR UPDATE USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Update games policies to use a simpler approach
DROP POLICY IF EXISTS "Users can view games they own or are members of" ON games;

CREATE POLICY "Users can view accessible games" ON games
  FOR SELECT USING (
    -- Games they created
    created_by = auth.uid() 
    OR 
    -- Games where they are explicitly listed as members
    EXISTS (
      SELECT 1 FROM game_members 
      WHERE game_members.game_id = games.id 
      AND game_members.user_id = auth.uid()
    )
  );

-- Update players policies to use the same approach
DROP POLICY IF EXISTS "Users can view players in accessible games" ON players;
DROP POLICY IF EXISTS "Users can manage players in accessible games" ON players;

CREATE POLICY "Users can view players in accessible games" ON players
  FOR SELECT USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM game_members 
      WHERE game_members.game_id = players.game_id 
      AND game_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage players in accessible games" ON players
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM game_members 
      WHERE game_members.game_id = players.game_id 
      AND game_members.user_id = auth.uid()
    )
  );

-- Update events policies to use the same approach
DROP POLICY IF EXISTS "Users can view events in accessible games" ON events;
DROP POLICY IF EXISTS "Users can manage events in accessible games" ON events;

CREATE POLICY "Users can view events in accessible games" ON events
  FOR SELECT USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM game_members 
      WHERE game_members.game_id = events.game_id 
      AND game_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage events in accessible games" ON events
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM game_members 
      WHERE game_members.game_id = events.game_id 
      AND game_members.user_id = auth.uid()
    )
  );