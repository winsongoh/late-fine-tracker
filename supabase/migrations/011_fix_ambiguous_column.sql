-- Fix ambiguous column reference in accept_game_invite function

CREATE OR REPLACE FUNCTION accept_game_invite(invite_code_param TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  game_id UUID
) AS $$
DECLARE
  invite_record record;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User must be authenticated', NULL::UUID;
    RETURN;
  END IF;
  
  -- Find valid invite with proper column qualification
  SELECT 
    gi.id as invite_id,
    gi.game_id as target_game_id,
    gi.invited_email,
    gi.status,
    gi.expires_at,
    g.name as game_name
  INTO invite_record
  FROM game_invites gi
  JOIN games g ON g.id = gi.game_id
  WHERE gi.invite_code = invite_code_param 
    AND gi.status = 'pending' 
    AND gi.expires_at > NOW();
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired invite code', NULL::UUID;
    RETURN;
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM game_members 
    WHERE game_members.game_id = invite_record.target_game_id 
    AND game_members.user_id = current_user_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'You are already a member of this game', invite_record.target_game_id;
    RETURN;
  END IF;
  
  -- Add as member
  INSERT INTO game_members (game_id, user_id, role)
  VALUES (invite_record.target_game_id, current_user_id, 'member');
  
  -- Update invite status
  UPDATE game_invites 
  SET status = 'accepted', accepted_at = NOW(), accepted_by = current_user_id
  WHERE game_invites.id = invite_record.invite_id;
  
  RETURN QUERY SELECT TRUE, 'Successfully joined the game!', invite_record.target_game_id;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM, invite_record.target_game_id;
END;
$$ LANGUAGE plpgsql SECURITY definer;