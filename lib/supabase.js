import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file contains:\n' +
    'VITE_SUPABASE_URL=your-project-url\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}

if (supabaseUrl === 'your-project-url' || supabaseAnonKey === 'your-anon-key') {
  throw new Error(
    'Please replace the placeholder values in your .env file with your actual Supabase credentials'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)