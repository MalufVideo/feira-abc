import supabase from './supabaseClient.js';

export default async function handler(req, res) {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase client not initialized. Check Vercel environment variables.' });
    }

    const { video: videoSlug } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!videoSlug) {
        return res.status(400).json({ error: 'Video slug is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .insert([{
                event_type: 'scan',
                video_slug: videoSlug,
                ip_address: ip,
                user_agent: userAgent
            }]);

        if (error) {
            console.error('[SUPABASE SCAN LOG ERROR - VERCEL]', error);
            return res.status(500).json({ error: 'Error logging scan to Supabase', details: error.message });
        }
        res.status(200).json({ message: 'Scan event logged successfully.' });
    } catch (e) {
        console.error('[VERCEL SCAN LOG ERROR]', e);
        res.status(500).json({ error: 'Internal server error while logging scan.', details: e.message });
    }
}
