import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra'; // Using fs-extra for easier file operations
import QRCode from 'qrcode';
import supabase from './supabaseClient.js'; // Assuming supabaseClient.js is configured

// --- Configuration ---
const OBS_OUTPUT_DIR = path.resolve('./obs-output');
const PUBLIC_DIR = path.resolve('./public'); // Main public directory for hosting
const QRCODE_DIR = path.resolve(PUBLIC_DIR, 'qrcodes'); // QR codes inside public
const SUPABASE_BUCKET = 'videos'; // The name of your Supabase bucket
const QR_CODE_LOCAL_PATH_PREFIX = path.join(process.cwd(), 'public', 'qrcodes');
const QR_CODE_SUPABASE_PATH_PREFIX = 'public/qrcodes_live'; // Store QRs in a 'public' prefixed folder for RLS

// Load environment variables if .env file exists
try {
    const dotenv = await import('dotenv');
    dotenv.config();
} catch (error) {
    console.log('dotenv not found, skipping .env loading');
}

// Base URL for the mobile pages displayed on our domain (for QR code)
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL;
// Base URL for the final share links (e.g., link in WhatsApp message)
const MOBILE_SHARE_LINK_BASE_URL = process.env.MOBILE_SHARE_LINK_BASE_URL;

if (!APP_PUBLIC_URL) {
    console.error('CRITICAL ERROR: APP_PUBLIC_URL is not set in environment variables. QR Codes will not work correctly. Set this to your domain URL (e.g., https://abc.onav.com.br)');
    // process.exit(1); // Optional: exit if critical env var is missing
}
if (!MOBILE_SHARE_LINK_BASE_URL) {
    console.error('CRITICAL ERROR: MOBILE_SHARE_LINK_BASE_URL is not set. Share links in mobile_template.js will be incorrect.');
}

// Ensure necessary directories exist
fs.ensureDirSync(QRCODE_DIR);
if (!fs.existsSync(QR_CODE_LOCAL_PATH_PREFIX)) {
    fs.mkdirSync(QR_CODE_LOCAL_PATH_PREFIX, { recursive: true });
}

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
                    upsert: true,
                    contentType: 'video/mp4'
                });

            if (uploadError) {
                throw new Error(`Supabase Upload Error: ${uploadError.message}`);
            }
            console.log(`   Upload successful: ${uploadData.path}`);

            const { data: publicUrlData } = supabase.storage
                .from(SUPABASE_BUCKET)
                .getPublicUrl(uploadData.path);

            const publicVideoUrl = publicUrlData.publicUrl;
            console.log(`   Public Video URL: ${publicVideoUrl}`);

            // --- QR Code Generation & Upload ---
            const qrCodeContent = `${process.env.APP_PUBLIC_URL}/mobile/${slug}.html`;
            const localQrCodeFilePath = path.join(QR_CODE_LOCAL_PATH_PREFIX, `qr_${slug}.png`);
            
            await QRCode.toFile(localQrCodeFilePath, qrCodeContent, {
                color: {
                    dark: '#000000', // Black dots
                    light: '#FFFFFF'  // White background
                },
                width: 256
            });
            console.log(`   QR Code generated locally: ${localQrCodeFilePath}`);

            const qrFileContent = await fs.readFile(localQrCodeFilePath);
            const supabaseQrPath = `${QR_CODE_SUPABASE_PATH_PREFIX}/qr_${slug}.png`;

            const { data: qrUploadData, error: qrUploadError } = await supabase.storage
                .from(SUPABASE_BUCKET) // Using the same 'videos' bucket for QR codes for simplicity
                .upload(supabaseQrPath, qrFileContent, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'image/png'
                });

            if (qrUploadError) {
                throw new Error(`Supabase QR Upload Error: ${qrUploadError.message}`);
            }
            console.log(`   QR Code upload successful: ${qrUploadData.path}`);

            const { data: publicQrUrlData } = supabase.storage
                .from(SUPABASE_BUCKET)
                .getPublicUrl(qrUploadData.path);
            const publicQrCodeUrl = publicQrUrlData.publicUrl;
            console.log(`   Public QR Code URL: ${publicQrCodeUrl}`);

            // --- Update Supabase 'booth_live_status' table ---
            const { data: dbData, error: dbError } = await supabase
                .from('booth_live_status')
                .upsert({
                    id: 'current_status', // Specific row to update
                    video_slug: slug,
                    video_url: publicVideoUrl,
                    qr_code_url: publicQrCodeUrl,
                    updated_at: new Date().toISOString() // Keep for now, or rely on DB default if preferred
                })
                .select();

            if (dbError) {
                console.error('Supabase DB update error:', dbError);
                throw new Error(`Supabase DB update error: ${dbError.message}`);
            }
            console.log('   Supabase booth_live_status table updated:', dbData);

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
