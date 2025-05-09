import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://cgcpaactxmygmdxmqyhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnY3BhYWN0eG15Z21keG1xeWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0OTUzMzksImV4cCI6MjA2MjA3MTMzOX0.mHS5jzdA2UBK1cav1IYXirjcZu4uxIH5VERT0Nksoqc';

// The following check is no longer necessary if credentials are hardcoded
// if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
//   console.warn('⚠️ Supabase URL or Key not configured in supabaseClient.js. Please add your credentials.');
//   // Optionally exit or prevent further execution if credentials are required immediately
//   // process.exit(1);
// }

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
