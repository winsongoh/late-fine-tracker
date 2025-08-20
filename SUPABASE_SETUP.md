# Supabase Integration Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be set up (usually takes 1-2 minutes)

## 2. Set Environment Variables

1. Copy `.env.example` to `.env`
2. In your Supabase dashboard, go to Settings > API
3. Copy your project URL and anon key to `.env`:

```bash
VITE_SUPABASE_URL=https://supabase.com/dashboard/project/wsmmxvvrpuufzuqkvscs
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbW14dnZycHV1Znp1cWt2c2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2Nzk0ODYsImV4cCI6MjA3MTI1NTQ4Nn0.Pm46X6Tstye_Jx9aOpvU2NCdy79nuGs7xNh7c9M463Q
```

## 3. Run Database Migrations

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Push the migration:
```bash
supabase db push
```

Alternatively, you can run the SQL migration manually:
1. Go to your Supabase dashboard > SQL Editor
2. Copy and paste the contents of `supabase/migrations/001_create_tables.sql`
3. Run the migration

## 4. Update Your Main App

Replace your current app entry point to use the new Supabase-enabled version:

```jsx
// In your main.jsx or wherever you render the app
import App from './components/App.jsx'

// Replace your current render with:
<App />
```

## 5. Features Included

### Authentication
- Email/password signup and login
- User sessions are managed automatically
- Each user gets their own isolated data

### Multi-Game Support
- Users can create multiple games
- Each game has its own players, events, and settings
- Games are private to the user who created them

### Real-time Updates
- Changes sync instantly across browser tabs
- Uses Supabase real-time subscriptions

### Cloud Storage
- All data is stored in Supabase (PostgreSQL)
- Automatic backups and scaling
- No more localStorage limitations

## 6. Data Migration (Optional)

If you have existing localStorage data you want to migrate:

1. Export your localStorage data before switching
2. Create a game in the new system
3. Manually add your players and recreate important events

## 7. Database Schema

The integration creates these tables:
- `profiles` - User profile information
- `games` - Game sessions with settings
- `players` - Players within each game
- `events` - Late arrival events

Each table has Row Level Security (RLS) enabled to ensure data privacy.

## 8. Development vs Production

- Development: Use your Supabase project URL and anon key
- Production: Same setup, just ensure your environment variables are properly set in your hosting platform

## Troubleshooting

1. **Can't connect to Supabase**: Check your URL and anon key in `.env`
2. **Database errors**: Ensure migrations ran successfully
3. **Auth issues**: Check that email confirmation is working (check Supabase Auth settings)
4. **Real-time not working**: Ensure your Supabase project has real-time enabled (it's on by default)