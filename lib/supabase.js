const { createClient } = require('@supabase/supabase-js')

// Get these from your Supabase project settings
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let db = null

if (supabaseUrl && supabaseKey) {
  db = createClient(supabaseUrl, supabaseKey)
} else {
  console.warn('⚠️  Supabase credentials not found. Database features will be disabled.')
  db = null
}

module.exports = db