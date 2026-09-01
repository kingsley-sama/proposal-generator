const { createClient } = require('@supabase/supabase-js')

// Get these from your Supabase project settings
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY is the name Supabase itself uses for this secret, and
// the name the project's .env carries; SUPABASE_SERVICE_KEY is the older name
// this file was written against. Both are accepted so a correctly-named key is
// not silently ignored — falling through to the anon key subjects every
// server-side write to RLS, which fails quietly rather than loudly.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let db = null

if (supabaseUrl && supabaseKey) {
  db = createClient(supabaseUrl, supabaseKey)
} else {
  console.warn('⚠️  Supabase credentials not found. Database features will be disabled.')
  db = null
}

module.exports = db