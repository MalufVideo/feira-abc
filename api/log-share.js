import supabase from './supabaseClient.js';

export default async function handler(req, res) {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase client not initialized. Check Vercel environment variables.' });
    }

    const { platform, video: videoSlug } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!videoSlug || !platform) {
        return res.status(400).json({ error: 'Video slug and platform are required.' });
    }

    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .insert([{
                event_type: 'share',
                platform: platform,
                video_slug: videoSlug,
                ip_address: ip,
                user_agent: userAgent
            }]);

        if (error) {
            console.error('[SUPABASE SHARE LOG ERROR - VERCEL]', error);
            return res.status(500).json({ error: 'Error logging share to Supabase', details: error.message });
        }
        res.status(200).json({ message: 'Share event logged successfully.' });
    } catch (e) {
        console.error('[VERCEL SHARE LOG ERROR]', e);
        res.status(500).json({ error: 'Internal server error while logging share.', details: e.message });
    }
}
