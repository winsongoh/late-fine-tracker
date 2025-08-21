-- Allow members to see games they've joined, not just games they own

-- Drop the restrictive games policy
DROP POLICY IF EXISTS "games_basic_access" ON games;

-- Create separate policies for owners and members
CREATE POLICY "games_owner_access" ON games
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "games_member_view" ON games
  FOR SELECT USING (
    id IN (
      SELECT game_members.game_id 
      FROM game_members 
      WHERE game_members.user_id = auth.uid()
    )
  );

-- Also allow members to access players in games they're part of
DROP POLICY IF EXISTS "players_basic_access" ON players;

CREATE POLICY "players_owner_access" ON players
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "players_member_access" ON players
  FOR ALL USING (
    game_id IN (
      SELECT game_members.game_id 
      FROM game_members 
      WHERE game_members.user_id = auth.uid()
    )
  );

-- Allow members to access events in games they're part of
DROP POLICY IF EXISTS "events_basic_access" ON events;

CREATE POLICY "events_owner_access" ON events
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "events_member_access" ON events
  FOR ALL USING (
    game_id IN (
      SELECT game_members.game_id 
      FROM game_members 
      WHERE game_members.user_id = auth.uid()
    )
  );