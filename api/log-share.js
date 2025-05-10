import supabase from './supabaseClient.js';

export default async function handler(req, res) {
    // --- BEGIN DIAGNOSTIC DIRECT FETCH ---
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('[DIRECT FETCH PRE-CHECK] SUPABASE_URL or SUPABASE_KEY is not set in Vercel environment.');
        // Don't return yet, let the main logic try, but this is a critical log.
    } else {
        // Attempt to fetch the OpenAPI spec as a basic connectivity test
        const testUrl = `${supabaseUrl}/rest/v1/`; // Trying base REST URL
        console.log(`[DIRECT FETCH DIAGNOSTIC] Attempting direct fetch to: ${testUrl}`);
        try {
            const directResponse = await fetch(testUrl, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}` // Standard for Supabase REST
                }
            });
            console.log(`[DIRECT FETCH DIAGNOSTIC] Status: ${directResponse.status}`);
            const responseText = await directResponse.text();
            console.log(`[DIRECT FETCH DIAGNOSTIC] Response Text (first 100 chars): ${responseText.substring(0, 100)}...`);
            if (!directResponse.ok) {
                console.error(`[DIRECT FETCH DIAGNOSTIC] Error: Status ${directResponse.status}, Response: ${responseText}`);
            }
        } catch (fetchError) {
            console.error('[DIRECT FETCH DIAGNOSTIC] Fetch failed:', fetchError);
            // Log the full error object for more details
            console.error('[DIRECT FETCH DIAGNOSTIC] Full Fetch Error Object:', JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError)));
        }
    }
    // --- END DIAGNOSTIC DIRECT FETCH ---

    if (!supabase) {
        console.error('[SUPABASE CLIENT CHECK] Supabase client not initialized. Check Vercel environment variables.');
        return res.status(500).json({ error: 'Supabase client not initialized. Check Vercel environment variables.' });
    }

    const { platform, video: videoSlug } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!videoSlug || !platform) {
        return res.status(400).json({ error: 'Video slug and platform are required.' });
    }

    try {
        console.log(`[SUPABASE CLIENT] Attempting to insert log for video: ${videoSlug}, platform: ${platform}`);
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
            console.error('[SUPABASE CLIENT ERROR - VERCEL]', error);
            // Log the full error object for more details
            console.error('[SUPABASE CLIENT ERROR - VERCEL - FULL]', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            return res.status(500).json({
                error: 'Error logging share to Supabase via client',
                details: error.message,
                fullError: error // Send the full error object in response for debugging
            });
        }
        res.status(200).json({ message: 'Share event logged successfully via client.' });
    } catch (e) {
        console.error('[VERCEL SHARE LOG TRY-CATCH ERROR]', e);
        // Log the full error object for more details
        console.error('[VERCEL SHARE LOG TRY-CATCH ERROR - FULL]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        res.status(500).json({
            error: 'Internal server error while logging share (catch block).',
            details: e.message,
            fullError: e // Send the full error object in response
        });
    }
}
