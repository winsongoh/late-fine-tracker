-- Fix invite acceptance by allowing the RPC function to bypass RLS temporarily

-- Update the accept_game_invite function to handle RLS properly
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
  target_game_id UUID;
BEGIN
  -- Get current user info
  SELECT id, email INTO current_user_id, user_email 
  FROM auth.users WHERE id = auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User must be authenticated', NULL::UUID;
    RETURN;
  END IF;
  
  -- Find the invite (bypass RLS by using security definer)
  SELECT * INTO invite_record 
  FROM game_invites 
  WHERE invite_code = invite_code_param 
    AND status = 'pending' 
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired invite code', NULL::UUID;
    RETURN;
  END IF;
  
  target_game_id := invite_record.game_id;
  
  -- Check if user is already a member (bypass RLS)
  IF EXISTS (
    SELECT 1 FROM game_members 
    WHERE game_id = target_game_id 
    AND user_id = current_user_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'You are already a member of this game', target_game_id;
    RETURN;
  END IF;
  
  -- Temporarily disable RLS for this operation
  SET LOCAL row_security = off;
  
  -- Add user as member
  INSERT INTO game_members (game_id, user_id, role)
  VALUES (target_game_id, current_user_id, 'member');
  
  -- Update invite status
  UPDATE game_invites 
  SET status = 'accepted', accepted_at = NOW(), accepted_by = current_user_id
  WHERE id = invite_record.id;
  
  -- Re-enable RLS
  SET LOCAL row_security = on;
  
  RETURN QUERY SELECT TRUE, 'Successfully joined the game!', target_game_id;
  
EXCEPTION WHEN OTHERS THEN
  -- Ensure RLS is re-enabled even if there's an error
  SET LOCAL row_security = on;
  RETURN QUERY SELECT FALSE, SQLERRM, NULL::UUID;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Also update the game_members insert policy to allow the function to work
DROP POLICY IF EXISTS "game_members_insert_any" ON game_members;

CREATE POLICY "game_members_insert_controlled" ON game_members
  FOR INSERT WITH CHECK (
    -- Allow if user is inserting themselves (via invite acceptance)
    user_id = auth.uid()
    OR
    -- Allow if game owner is adding someone
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );