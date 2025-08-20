-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user data
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create games table for different game sessions
CREATE TABLE games (
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
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table for late arrivals
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  reason TEXT DEFAULT 'Late',
  amount DECIMAL(10,2) NOT NULL,
  date_iso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_events_game_id ON events(game_id);
CREATE INDEX idx_events_player_id ON events(player_id);
CREATE INDEX idx_events_date_iso ON events(date_iso);
CREATE INDEX idx_games_created_by ON games(created_by);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles: Users can only see and edit their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Games: Users can see games they created
CREATE POLICY "Users can view own games" ON games
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own games" ON games
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own games" ON games
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own games" ON games
  FOR DELETE USING (auth.uid() = created_by);

-- Players: Users can manage players in their games
CREATE POLICY "Users can view players in own games" ON players
  FOR SELECT USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can insert players in own games" ON players
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update players in own games" ON players
  FOR UPDATE USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can delete players in own games" ON players
  FOR DELETE USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

-- Events: Users can manage events in their games
CREATE POLICY "Users can view events in own games" ON events
  FOR SELECT USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can insert events in own games" ON events
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update events in own games" ON events
  FOR UPDATE USING (
    game_id IN (SELECT id FROM games WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can delete events in own games" ON events
  FOR DELETE USING (
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
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();