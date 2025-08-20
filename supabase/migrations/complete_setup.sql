-- Complete Late Fine Tracker Database Setup with Invites
-- Run this entire script in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create games table for different game sessions
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  season TEXT DEFAULT 'S1',
  fine_amount DECIMAL(10,2) DEFAULT 10.00,
  currency TEXT DEFAULT 'RM',
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table for late arrivals
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  reason TEXT DEFAULT 'Late',
  amount DECIMAL(10,2) NOT NULL,
  date_iso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_members table for shared access
CREATE TABLE IF NOT EXISTS game_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- Create game_invites table
CREATE TABLE IF NOT EXISTS game_invites (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_events_game_id ON events(game_id);
CREATE INDEX IF NOT EXISTS idx_events_player_id ON events(player_id);
CREATE INDEX IF NOT EXISTS idx_events_date_iso ON events(date_iso);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_game_members_game_id ON game_members(game_id);
CREATE INDEX IF NOT EXISTS idx_game_members_user_id ON game_members(user_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_game_id ON game_invites(game_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_code ON game_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_game_invites_email ON game_invites(invited_email);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own games" ON games;
DROP POLICY IF EXISTS "Users can insert own games" ON games;
DROP POLICY IF EXISTS "Users can update own games" ON games;
DROP POLICY IF EXISTS "Users can delete own games" ON games;
DROP POLICY IF EXISTS "Users can view games they own or are members of" ON games;
DROP POLICY IF EXISTS "Users can view accessible games" ON games;
DROP POLICY IF EXISTS "Users can view players in own games" ON players;
DROP POLICY IF EXISTS "Users can insert players in own games" ON players;
DROP POLICY IF EXISTS "Users can update players in own games" ON players;
DROP POLICY IF EXISTS "Users can delete players in own games" ON players;
DROP POLICY IF EXISTS "Users can view players in accessible games" ON players;
DROP POLICY IF EXISTS "Users can manage players in accessible games" ON players;
DROP POLICY IF EXISTS "Users can view events in own games" ON events;
DROP POLICY IF EXISTS "Users can insert events in own games" ON events;
DROP POLICY IF EXISTS "Users can update events in own games" ON events;
DROP POLICY IF EXISTS "Users can delete events in own games" ON events;
DROP POLICY IF EXISTS "Users can view events in accessible games" ON events;
DROP POLICY IF EXISTS "Users can manage events in accessible games" ON events;
DROP POLICY IF EXISTS "Users can view members of games they have access to" ON game_members;
DROP POLICY IF EXISTS "Game owners can manage members" ON game_members;
DROP POLICY IF EXISTS "Users can leave games" ON game_members;
DROP POLICY IF EXISTS "Users can view game members" ON game_members;
DROP POLICY IF EXISTS "Game owners can insert members" ON game_members;
DROP POLICY IF EXISTS "Game owners can delete members" ON game_members;
DROP POLICY IF EXISTS "Game owners can update members" ON game_members;
DROP POLICY IF EXISTS "Users can view invites for their games" ON game_invites;
DROP POLICY IF EXISTS "Game owners can manage invites" ON game_invites;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for games
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

CREATE POLICY "Users can insert own games" ON games
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own games" ON games
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own games" ON games
  FOR DELETE USING (created_by = auth.uid());

-- Create RLS policies for players
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

-- Create RLS policies for events
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

-- Create RLS policies for game_members (no recursion)
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

-- Create RLS policies for game_invites
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

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically add game owner as member
CREATE OR REPLACE FUNCTION add_game_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO game_members (game_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (game_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Trigger to add game owner as member when game is created
DROP TRIGGER IF EXISTS on_game_created ON games;
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
WHERE id NOT IN (
  SELECT game_id FROM game_members 
  WHERE game_members.game_id = games.id 
  AND game_members.user_id = games.created_by
)
ON CONFLICT (game_id, user_id) DO NOTHING;