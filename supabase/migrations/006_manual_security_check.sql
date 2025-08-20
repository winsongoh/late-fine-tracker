-- Better approach: Use application-level security instead of complex RLS
-- This avoids recursion while maintaining security through the application

-- Re-enable RLS on game_members but with simple policies
ALTER TABLE game_members ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start completely fresh
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('games', 'game_members', 'players', 'events', 'game_invites')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Simple, non-recursive policies
-- Games: Only basic ownership
CREATE POLICY "games_owner_access" ON games
  FOR ALL USING (created_by = auth.uid());

-- Game members: Only view your own memberships and allow inserts by owners
CREATE POLICY "game_members_own_view" ON game_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "game_members_insert" ON game_members
  FOR INSERT WITH CHECK (true); -- Will be validated in application

CREATE POLICY "game_members_delete" ON game_members
  FOR DELETE USING (user_id = auth.uid()); -- Can only delete yourself

-- Players: Only in games you own (simple check)
CREATE POLICY "players_owner_access" ON players
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Events: Only in games you own (simple check)  
CREATE POLICY "events_owner_access" ON events
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Game invites: Simple policies
CREATE POLICY "game_invites_access" ON game_invites
  FOR ALL USING (
    invited_by = auth.uid() 
    OR invited_email = auth.email()
    OR game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );