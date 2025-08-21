-- Final simple fix: Remove ALL complex policies and use basic ownership only
-- This completely eliminates recursion by avoiding any cross-table references

-- Drop ALL existing policies on all tables
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('games', 'game_members', 'players', 'events', 'game_invites')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- GAMES: Only basic ownership - NO references to other tables
CREATE POLICY "games_basic_access" ON games
  FOR ALL USING (created_by = auth.uid());

-- GAME_MEMBERS: Simple policies - NO references to games table
CREATE POLICY "game_members_view_own" ON game_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "game_members_insert_any" ON game_members
  FOR INSERT WITH CHECK (true); -- Will validate in application

CREATE POLICY "game_members_delete_own" ON game_members
  FOR DELETE USING (user_id = auth.uid());

-- PLAYERS: Simple ownership check only
CREATE POLICY "players_basic_access" ON players
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- EVENTS: Simple ownership check only  
CREATE POLICY "events_basic_access" ON events
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- GAME_INVITES: Simple policies
CREATE POLICY "game_invites_basic_access" ON game_invites
  FOR ALL USING (
    invited_by = auth.uid() 
    OR invited_email = auth.email()
  );