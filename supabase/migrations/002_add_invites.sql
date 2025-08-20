-- Add game invites functionality

-- Create game_members table for shared access
CREATE TABLE game_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- Create game_invites table
CREATE TABLE game_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'base64'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_game_members_game_id ON game_members(game_id);
CREATE INDEX idx_game_members_user_id ON game_members(user_id);
CREATE INDEX idx_game_invites_game_id ON game_invites(game_id);
CREATE INDEX idx_game_invites_code ON game_invites(invite_code);
CREATE INDEX idx_game_invites_email ON game_invites(invited_email);

-- Enable RLS
ALTER TABLE game_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_members
CREATE POLICY "Users can view members of games they have access to" ON game_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    game_id IN (
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Game owners can manage members" ON game_members
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can leave games" ON game_members
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for game_invites
CREATE POLICY "Users can view invites for their games" ON game_invites
  FOR SELECT USING (
    invited_by = auth.uid() OR
    invited_email = auth.email() OR
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Game owners can manage invites" ON game_invites
  FOR ALL USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Update existing RLS policies for games to include shared access
DROP POLICY "Users can view own games" ON games;
DROP POLICY "Users can update own games" ON games;
DROP POLICY "Users can delete own games" ON games;

CREATE POLICY "Users can view games they own or are members of" ON games
  FOR SELECT USING (
    created_by = auth.uid() OR 
    id IN (SELECT game_id FROM game_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update games they own" ON games
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete games they own" ON games
  FOR DELETE USING (created_by = auth.uid());

-- Update RLS policies for players to include shared access
DROP POLICY "Users can view players in own games" ON players;
DROP POLICY "Users can insert players in own games" ON players;
DROP POLICY "Users can update players in own games" ON players;
DROP POLICY "Users can delete players in own games" ON players;

CREATE POLICY "Users can view players in accessible games" ON players
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
      UNION
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage players in accessible games" ON players
  FOR ALL USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
      UNION
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

-- Update RLS policies for events to include shared access
DROP POLICY "Users can view events in own games" ON events;
DROP POLICY "Users can insert events in own games" ON events;
DROP POLICY "Users can update events in own games" ON events;
DROP POLICY "Users can delete events in own games" ON events;

CREATE POLICY "Users can view events in accessible games" ON events
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
      UNION
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage events in accessible games" ON events
  FOR ALL USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
      UNION
      SELECT game_id FROM game_members WHERE user_id = auth.uid()
    )
  );

-- Function to automatically add game owner as member
CREATE OR REPLACE FUNCTION add_game_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO game_members (game_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Trigger to add game owner as member when game is created
CREATE TRIGGER on_game_created
  AFTER INSERT ON games
  FOR EACH ROW EXECUTE FUNCTION add_game_owner_as_member();

-- Function to accept invite
CREATE OR REPLACE FUNCTION accept_game_invite(invite_code_param TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  game_id UUID
) AS $$
DECLARE
  invite_record game_invites;
  user_email TEXT;
BEGIN
  -- Get current user email
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  -- Find the invite
  SELECT * INTO invite_record 
  FROM game_invites 
  WHERE invite_code = invite_code_param 
    AND status = 'pending' 
    AND expires_at > NOW()
    AND invited_email = user_email;
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired invite code', NULL::UUID;
    RETURN;
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM game_members WHERE game_id = invite_record.game_id AND user_id = auth.uid()) THEN
    RETURN QUERY SELECT FALSE, 'You are already a member of this game', invite_record.game_id;
    RETURN;
  END IF;
  
  -- Add user as member
  INSERT INTO game_members (game_id, user_id, role)
  VALUES (invite_record.game_id, auth.uid(), 'member');
  
  -- Update invite status
  UPDATE game_invites 
  SET status = 'accepted', accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = invite_record.id;
  
  RETURN QUERY SELECT TRUE, 'Successfully joined the game!', invite_record.game_id;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Add existing game owners as members (for existing games)
INSERT INTO game_members (game_id, user_id, role)
SELECT id, created_by, 'owner'
FROM games
WHERE id NOT IN (SELECT game_id FROM game_members WHERE role = 'owner');