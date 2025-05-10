import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra'; // Using fs-extra for easier file operations
import QRCode from 'qrcode';
import supabase from './supabaseClient.js'; // Assuming supabaseClient.js is configured

// --- Configuration ---
const OBS_OUTPUT_DIR = path.resolve('./obs-output');
const PUBLIC_DIR = path.resolve('./public'); // Main public directory for Vercel
const QRCODE_DIR = path.resolve(PUBLIC_DIR, 'qrcodes'); // QR codes inside public
const LATEST_INFO_FILE = path.resolve(PUBLIC_DIR, 'latest_booth_info.json');
const SUPABASE_BUCKET = 'videos'; // The name of your Supabase bucket

// Load environment variables if .env file exists
try {
    const dotenv = await import('dotenv');
    dotenv.config();
} catch (error) {
    console.log('dotenv not found, skipping .env loading');
}

// Base URL for the mobile pages displayed on Vercel (for QR code)
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL;
// Base URL for the final share links (e.g., link in WhatsApp message)
const MOBILE_SHARE_LINK_BASE_URL = process.env.MOBILE_SHARE_LINK_BASE_URL;

if (!APP_PUBLIC_URL) {
    console.error('CRITICAL ERROR: APP_PUBLIC_URL is not set in environment variables. QR Codes will not work correctly. Set this to your Vercel app URL (e.g., https://yourapp.vercel.app)');
    // process.exit(1); // Optional: exit if critical env var is missing
}
if (!MOBILE_SHARE_LINK_BASE_URL) {
    console.error('CRITICAL ERROR: MOBILE_SHARE_LINK_BASE_URL is not set. Share links in mobile_template.js will be incorrect.');
}


// Ensure necessary directories exist
fs.ensureDirSync(QRCODE_DIR);

// --- File Watcher Logic ---
console.log(`Watching for new video files in: ${OBS_OUTPUT_DIR}`);

const watcher = chokidar.watch(OBS_OUTPUT_DIR, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true, 
    interval: 300,    
    binaryInterval: 500, 
    awaitWriteFinish: {
        stabilityThreshold: 5000, 
        pollInterval: 500,        
        minSize: 1024             
    }
});

watcher
    .on('add', async (filePath) => {
        const fileName = path.basename(filePath);
        console.log(`\n\n🔥🔥🔥 CHOKIDAR 'ADD' EVENT FIRED! File: ${fileName} 🔥🔥🔥\n\n`);

        if (path.extname(fileName).toLowerCase() !== '.mp4') {
            console.log(`   Ignoring non-MP4 file: ${fileName}`);
            return;
        }

        try {
            const videoNameWithoutExt = path.parse(fileName).name;
            const slug = `${videoNameWithoutExt}_${Date.now()}`;
            console.log(`   Generated Slug: ${slug}`);

            console.log(`   Uploading ${fileName} to Supabase...`);
            const fileContent = await fs.readFile(filePath);
            // Prepend 'public/' to the Supabase path to match RLS policy
            const supabasePath = `public/${slug}${path.extname(fileName)}`; // e.g., public/myvideo_timestamp123.mp4

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(SUPABASE_BUCKET)
                .upload(supabasePath, fileContent, {
                    cacheControl: '3600',
                    upsert: false, 
                    contentType: 'video/mp4'
                });

            if (uploadError) {
                throw new Error(`Supabase Upload Error: ${uploadError.message}`);
            }
            console.log(`   Upload successful: ${uploadData.path}`);

            const { data: urlData } = supabase.storage
                .from(SUPABASE_BUCKET)
                .getPublicUrl(supabasePath);

            if (!urlData || !urlData.publicUrl) {
                 throw new Error('Could not get public URL from Supabase.');
            }
            const publicVideoUrl = urlData.publicUrl;
            console.log(`   Public Video URL: ${publicVideoUrl}`);

            // URL for the QR code to encode: links to the Vercel-hosted mobile_template.html
            // The slug is passed as a query parameter
            const qrCodeDataUrl = `${APP_PUBLIC_URL}/mobile_template.html?video=${slug}`;
            console.log(`   QR Code Data URL (for encoding): ${qrCodeDataUrl}`);

            const qrCodeFileName = `qr_${slug}.png`;
            const qrCodeFilePath = path.join(QRCODE_DIR, qrCodeFileName);
            await QRCode.toFile(qrCodeFilePath, qrCodeDataUrl, { errorCorrectionLevel: 'H' });
            console.log(`   QR Code generated: ${qrCodeFilePath}`);
            
            // Relative path for the QR code to be used in latest_booth_info.json (served from public root)
            const qrCodeUrlForBoothJson = `/qrcodes/${qrCodeFileName}`; 

            // --- Update latest_booth_info.json ---
            const boothInfo = {
                videoUrl: publicVideoUrl,
                qrCodeUrl: qrCodeUrlForBoothJson, // This is relative to public root
                videoSlug: slug,
                timestamp: Date.now()
            };
            await fs.writeJson(LATEST_INFO_FILE, boothInfo);
            console.log(`   Updated ${LATEST_INFO_FILE} with new video info.`);
            
            console.log(`--- Processing complete for ${fileName} ---`);

        } catch (error) {
            console.error(`Error processing file ${fileName}:`, error);
        }
    })
    .on('error', error => console.error(`Watcher error: ${error}`))
    .on('ready', () => console.log('Initial scan complete. Ready for changes...'));


// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Stopping watcher...');
    watcher.close().then(() => {
        console.log('Watcher stopped.');
        process.exit(0);
    });
});
