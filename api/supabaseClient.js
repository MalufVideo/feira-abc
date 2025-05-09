import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_KEY environment variables are set in Vercel.');
  // In a serverless function context, you might not want to throw an error that crashes the cold start,
  // but rather handle it in the function that uses the client.
  // For simplicity here, we'll rely on the calling function to handle a null client.
}

// Only create client if URL and Key are present
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default supabase;
