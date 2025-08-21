-- Complete database redesign to eliminate RLS recursion issues
-- New approach: Disable RLS and handle security in application layer

-- Drop all existing policies completely
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('games', 'game_members', 'players', 'events', 'game_invites', 'profiles')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Disable RLS on all tables to prevent recursion
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_invites DISABLE ROW LEVEL SECURITY;

-- Redesign: Add user_id to all tables for simple filtering
-- This eliminates the need for complex joins in RLS policies

-- Add user_id to players table for direct access control
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add user_id to events table for direct access control
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create indexes for the new user_id columns
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

-- Create a simple view that shows games accessible to a user
CREATE OR REPLACE VIEW user_accessible_games AS
SELECT DISTINCT
    g.*,
    CASE 
        WHEN g.created_by = auth.uid() THEN 'owner'
        ELSE 'member'
    END as user_role
FROM games g
LEFT JOIN game_members gm ON g.id = gm.game_id
WHERE g.created_by = auth.uid() 
   OR (gm.user_id = auth.uid() AND gm.user_id IS NOT NULL);

-- Create a function to get user's games (replaces complex RLS)
CREATE OR REPLACE FUNCTION get_user_games()
RETURNS TABLE (
    id UUID,
    name TEXT,
    season TEXT,
    fine_amount DECIMAL(10,2),
    currency TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    user_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        g.id,
        g.name,
        g.season,
        g.fine_amount,
        g.currency,
        g.created_by,
        g.created_at,
        g.updated_at,
        CASE 
            WHEN g.created_by = auth.uid() THEN 'owner'::TEXT
            ELSE 'member'::TEXT
        END as user_role
    FROM games g
    LEFT JOIN game_members gm ON g.id = gm.game_id
    WHERE g.created_by = auth.uid() 
       OR gm.user_id = auth.uid()
    ORDER BY g.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Create a function to check if user has access to a game
CREATE OR REPLACE FUNCTION user_has_game_access(game_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM games 
        WHERE id = game_id_param 
        AND created_by = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM game_members 
        WHERE game_id = game_id_param 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Simplify the invite acceptance function
CREATE OR REPLACE FUNCTION accept_game_invite(invite_code_param TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    game_id UUID
) AS $$
DECLARE
    invite_record RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'User must be authenticated', NULL::UUID;
        RETURN;
    END IF;
    
    -- Get the invite
    SELECT gi.id as invite_id, gi.game_id as target_game_id
    INTO invite_record
    FROM game_invites gi
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
        WHERE game_id = invite_record.target_game_id 
        AND user_id = current_user_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'You are already a member of this game', invite_record.target_game_id;
        RETURN;
    END IF;
    
    -- Add as member
    INSERT INTO game_members (game_id, user_id, role)
    VALUES (invite_record.target_game_id, current_user_id, 'member');
    
    -- Update invite
    UPDATE game_invites 
    SET status = 'accepted', accepted_at = NOW(), accepted_by = current_user_id
    WHERE id = invite_record.invite_id;
    
    RETURN QUERY SELECT TRUE, 'Successfully joined the game!', invite_record.target_game_id;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM, invite_record.target_game_id;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Update existing players and events to have user_id
UPDATE players SET user_id = (
    SELECT created_by FROM games WHERE games.id = players.game_id
) WHERE user_id IS NULL;

UPDATE events SET user_id = (
    SELECT created_by FROM games WHERE games.id = events.game_id
) WHERE user_id IS NULL;