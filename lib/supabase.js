const { createClient } = require('@supabase/supabase-js')

// Get these from your Supabase project settings
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let db = null

if (supabaseUrl && supabaseKey) {
  db = createClient(supabaseUrl, supabaseKey)
} else {
  console.warn('⚠️  Supabase credentials not found. Database features will be disabled.')
  // Create a mock client that returns null for all operations
  db = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    })
  }
}

module.exports = db