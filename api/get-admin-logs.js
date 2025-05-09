import supabase from './supabaseClient.js';

export default async function handler(req, res) {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase client not initialized. Check Vercel environment variables.' });
    }
    
    // Optional: Add authentication/security here if needed for admin access
    // For now, keeping it simple.

    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false }); // Show newest logs first

        if (error) {
            console.error('[SUPABASE GET LOGS ERROR - VERCEL]', error);
            return res.status(500).json({ error: 'Error fetching logs from Supabase', details: error.message });
        }
        res.status(200).json(data);
    } catch (e) {
        console.error('[VERCEL GET LOGS ERROR]', e);
        res.status(500).json({ error: 'Internal server error while fetching logs.', details: e.message });
    }
}
