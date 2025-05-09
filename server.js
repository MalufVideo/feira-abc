import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra'; 
import supabase from './supabaseClient.js'; 
import { controlRecording } from './controllers/obsController.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
const PUBLIC_DIR = path.resolve('./public');
const QRCODE_DIR_SERVE = path.join(__dirname, 'qrcodes'); 
const LOGS_DIR = path.resolve('./logs'); 

// Ensure logs directory exists
fs.ensureDirSync(LOGS_DIR);

// --- Middleware ---
// Enable JSON body parsing for future POST requests (if any)
app.use(express.json());
// Enable URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));

// --- Static File Serving ---
// Serve files from the 'public' directory (e.g., public/mobile/slug.html -> /mobile/slug.html)
app.use(express.static(PUBLIC_DIR));
// Serve files from 'qrcodes' directory directly (e.g., /qrcodes/qr_slug.png) - useful for <img src="/qrcodes/...">
app.use('/qrcodes', express.static(QRCODE_DIR_SERVE));
console.log(`Serving QR codes from: ${QRCODE_DIR_SERVE} at /qrcodes`);

// --- API Routes for Logging ---

// Endpoint to log QR code scans (when mobile page loads)
app.get('/api/log-scan', async (req, res) => {
    const videoSlug = req.query.video;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date().toISOString();

    const logEntry = {
        event_type: 'scan',
        video_slug: videoSlug,
        timestamp: timestamp,
        ip_address: ip,
        user_agent: userAgent
    };

    console.log('[LOG SCAN]', logEntry);

    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .insert([{
                event_type: 'scan',
                video_slug: videoSlug,
                ip_address: ip,
                user_agent: userAgent
                // platform will be null for scans
            }]);

        if (error) {
            console.error('[SUPABASE SCAN LOG ERROR]', error);
            // Still send a 200 so the client doesn't see an error, but log it
            return res.status(200).send('Scan event received, logging error.');
        }
        console.log('[SUPABASE SCAN LOG SUCCESS]', data);
        res.status(200).send('Scan event logged successfully.');
    } catch (e) {
        console.error('[SERVER SCAN LOG ERROR]', e);
        res.status(500).send('Internal server error while logging scan.');
    }
});

// Endpoint to log share button clicks
app.get('/api/log-share', async (req, res) => {
    const platform = req.query.platform;
    const videoSlug = req.query.video;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date().toISOString();

    const logEntry = {
        event_type: 'share',
        platform: platform,
        video_slug: videoSlug,
        timestamp: timestamp,
        ip_address: ip,
        user_agent: userAgent
    };
    console.log('[LOG SHARE]', logEntry);

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
            console.error('[SUPABASE SHARE LOG ERROR]', error);
            return res.status(200).send('Share event received, logging error.');
        }
        console.log('[SUPABASE SHARE LOG SUCCESS]', data);
        res.status(200).send('Share event logged successfully.');
    } catch (e) {
        console.error('[SERVER SHARE LOG ERROR]', e);
        res.status(500).send('Internal server error while logging share.');
    }
});

// --- OBS Control API Endpoint ---
// API endpoint to trigger OBS recording and Selenium click
app.post('/api/control/start-recording', async (req, res) => {
    console.log('[OBS CONTROL] Starting recording process');
    
    try {
        const result = await controlRecording();
        console.log('[OBS CONTROL] Recording process result:', result);
        res.json(result);
    } catch (error) {
        console.error('[OBS CONTROL ERROR]', error);
        res.status(500).json({ success: false, message: `Server error: ${error.message || 'Unknown error'}` });
    }
});

// --- Latest Video API Endpoint ---
// API endpoint to get the latest video slug for auto-reload functionality
app.get('/api/latest-video', async (req, res) => {
    try {
        // Read the booth pages directory to find the most recent file
        const boothDir = path.join(__dirname, 'public', 'booth');
        const files = await fs.readdir(boothDir);
        
        // Filter for HTML files and sort by modification time (newest first)
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        
        if (htmlFiles.length === 0) {
            return res.json({ latestSlug: null });
        }
        
        // Get file stats for each HTML file
        const fileStats = await Promise.all(
            htmlFiles.map(async (file) => {
                const filePath = path.join(boothDir, file);
                const stats = await fs.stat(filePath);
                return { file, mtime: stats.mtime };
            })
        );
        
        // Sort by modification time (newest first)
        fileStats.sort((a, b) => b.mtime - a.mtime);
        
        // Extract the slug from the filename (remove .html extension)
        const latestFile = fileStats[0].file;
        const latestSlug = latestFile.replace('.html', '');
        
        res.json({ latestSlug });
    } catch (error) {
        console.error('Error getting latest video:', error);
        res.status(500).json({ error: 'Failed to get latest video' });
    }
});

// --- Simple "Latest Video" Redirect ---
// Redirect to the latest booth page
app.get('/', async (req, res) => {
    try {
        // Read the booth pages directory to find the most recent file
        const boothDir = path.join(__dirname, 'public', 'booth');
        const files = await fs.readdir(boothDir);
        
        // Filter for HTML files and sort by modification time (newest first)
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        
        if (htmlFiles.length === 0) {
            return res.send(`
                <h1>Video QR System</h1>
                <p>Server is running, but no videos have been processed yet.</p>
                <p>Videos will be accessible via:</p>
                <ul>
                    <li>Booth display (local): <code>/booth/[slug].html</code></li>
                    <li>Mobile access: <code>/mobile/[slug].html</code></li>
                </ul>
                <p>Watcher script (watcher.js) should be running separately to generate these files.</p>
            `);
        }
        
        // Get file stats for each HTML file
        const fileStats = await Promise.all(
            htmlFiles.map(async (file) => {
                const filePath = path.join(boothDir, file);
                const stats = await fs.stat(filePath);
                return { file, mtime: stats.mtime };
            })
        );
        
        // Sort by modification time (newest first)
        fileStats.sort((a, b) => b.mtime - a.mtime);
        
        // Redirect to the latest booth page
        const latestFile = fileStats[0].file;
        res.redirect(`/booth/${latestFile}`);
    } catch (error) {
        console.error('Error redirecting to latest video:', error);
        res.send(`
            <h1>Video QR System</h1>
            <p>Server is running. Videos will be accessible via:</p>
            <ul>
                <li>Booth display (local): <code>/booth/[slug].html</code></li>
                <li>Mobile access: <code>/mobile/[slug].html</code></li>
                <li>QR Codes images are in <code>/qrcodes/</code> folder and served at <code>/qrcodes/</code> path</li>
            </ul>
            <p>Watcher script (watcher.js) should be running separately to generate these files.</p>
            <p>Error: ${error.message}</p>
        `);
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${PUBLIC_DIR}`);
    console.log(`Serving QR codes from: ${QRCODE_DIR_SERVE} at /qrcodes`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process.exit(0);
});
