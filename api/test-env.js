export default async function handler(req, res) {
  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'Not Set',
    SUPABASE_KEY: process.env.SUPABASE_KEY ? 'Set (value hidden for security)' : 'Not Set',
    MOBILE_BASE_URL: process.env.MOBILE_BASE_URL || 'Not Set',
  };

  // For SUPABASE_KEY, we'll just confirm if it's set rather than exposing the actual key.
  // If you need to verify a portion of the key, you could do something like:
  // SUPABASE_KEY_START: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 5) + '...' : 'Not Set',

  res.status(200).json(envVars);
}
