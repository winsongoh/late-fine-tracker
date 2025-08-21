-- Fix the ambiguous column reference in accept_game_invite function
-- This time properly qualify ALL column references

CREATE OR REPLACE FUNCTION accept_game_invite(invite_code_param TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  game_id UUID
) AS $$
DECLARE
  invite_id_var UUID;
  target_game_id_var UUID;
  current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'User must be authenticated', NULL::UUID;
        RETURN;
    END IF;
    
    -- Get the invite with explicit column selection to avoid ambiguity
    SELECT 
        gi.id,
        gi.game_id
    INTO 
        invite_id_var,
        target_game_id_var
    FROM game_invites gi
    WHERE gi.invite_code = invite_code_param 
      AND gi.status = 'pending' 
      AND gi.expires_at > NOW()
    LIMIT 1;
      
    IF invite_id_var IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Invalid or expired invite code', NULL::UUID;
        RETURN;
    END IF;
    
    -- Check if already a member using explicit variables
    IF EXISTS (
        SELECT 1 FROM game_members 
        WHERE game_members.game_id = target_game_id_var 
        AND game_members.user_id = current_user_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'You are already a member of this game', target_game_id_var;
        RETURN;
    END IF;
    
    -- Add as member
    INSERT INTO game_members (game_id, user_id, role)
    VALUES (target_game_id_var, current_user_id, 'member');
    
    -- Update invite status
    UPDATE game_invites 
    SET status = 'accepted', 
        accepted_at = NOW(), 
        accepted_by = current_user_id
    WHERE game_invites.id = invite_id_var;
    
    RETURN QUERY SELECT TRUE, 'Successfully joined the game!', target_game_id_var;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM, target_game_id_var;
END;
$$ LANGUAGE plpgsql SECURITY definer;