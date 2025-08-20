-- Fix shared game access issues
-- Ensure recipients can see games they've been invited to

-- Drop and recreate the games policies to allow shared access
DROP POLICY IF EXISTS "games_owner_access" ON games;

-- Allow users to see games they own OR are members of
CREATE POLICY "games_owner_access" ON games
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "games_member_access" ON games
  FOR SELECT USING (
    id IN (
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

-- Allow game owners to manage their games
CREATE POLICY "games_owner_manage" ON games
  FOR ALL USING (created_by = auth.uid());

-- Fix the game_members policies to allow proper access
DROP POLICY IF EXISTS "game_members_own_view" ON game_members;
DROP POLICY IF EXISTS "game_members_insert" ON game_members;
DROP POLICY IF EXISTS "game_members_delete" ON game_members;

-- Allow users to see all memberships for games they can access
CREATE POLICY "game_members_view" ON game_members
  FOR SELECT USING (
    user_id = auth.uid() 
    OR game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Allow inserting members (this happens during invite acceptance)
CREATE POLICY "game_members_insert" ON game_members
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR user_id = auth.uid() -- Allow users to add themselves (via invite acceptance)
  );

-- Allow users to remove themselves, owners to remove anyone
CREATE POLICY "game_members_delete" ON game_members
  FOR DELETE USING (
    user_id = auth.uid() 
    OR game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Update players policies to work with shared games
DROP POLICY IF EXISTS "players_owner_access" ON players;

CREATE POLICY "players_access" ON players
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR game_id IN (SELECT game_id FROM game_members WHERE user_id = auth.uid())
  );

-- Update events policies to work with shared games  
DROP POLICY IF EXISTS "events_owner_access" ON events;

CREATE POLICY "events_access" ON events
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
    OR game_id IN (SELECT game_id FROM game_members WHERE user_id = auth.uid())
  );

-- Ensure the invite acceptance function works properly
-- Update the function to handle any issues with member insertion
CREATE OR REPLACE FUNCTION accept_game_invite(invite_code_param TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  game_id UUID
) AS $$
DECLARE
  invite_record game_invites;
  user_email TEXT;
  current_user_id UUID;
BEGIN
  -- Get current user info
  SELECT id, email INTO current_user_id, user_email 
  FROM auth.users WHERE id = auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User must be authenticated', NULL::UUID;
    RETURN;
  END IF;
  
  -- Find the invite
  SELECT * INTO invite_record 
  FROM game_invites 
  WHERE invite_code = invite_code_param 
    AND status = 'pending' 
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired invite code', NULL::UUID;
    RETURN;
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM game_members 
    WHERE game_id = invite_record.game_id 
    AND user_id = current_user_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'You are already a member of this game', invite_record.game_id;
    RETURN;
  END IF;
  
  -- Add user as member
  INSERT INTO game_members (game_id, user_id, role)
  VALUES (invite_record.game_id, current_user_id, 'member');
  
  -- Update invite status
  UPDATE game_invites 
  SET status = 'accepted', accepted_at = NOW(), accepted_by = current_user_id
  WHERE id = invite_record.id;
  
  RETURN QUERY SELECT TRUE, 'Successfully joined the game!', invite_record.game_id;
END;
$$ LANGUAGE plpgsql SECURITY definer;