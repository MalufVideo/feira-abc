import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra'; // Using fs-extra for easier file operations
import QRCode from 'qrcode';
import supabase from './supabaseClient.js'; // Assuming supabaseClient.js is configured

// --- Configuration ---
const OBS_OUTPUT_DIR = path.resolve('./obs-output');
const QRCODE_DIR = path.resolve('./qrcodes');
const BOOTH_PAGES_DIR = path.resolve('./public/booth');
const MOBILE_PAGES_DIR = path.resolve('./public/mobile');
const TEMPLATES_DIR = path.resolve('./templates');
const SUPABASE_BUCKET = 'videos'; // The name of your Supabase bucket

// Load environment variables if .env file exists
try {
    const dotenv = await import('dotenv');
    dotenv.config();
} catch (error) {
    console.log('dotenv not found, skipping .env loading');
}

// Base URL for the mobile pages - configurable via environment variable
// This should be your public website domain for the mobile pages
const MOBILE_BASE_URL = process.env.MOBILE_BASE_URL || 'http://192.168.1.36:3000/mobile';
// Base URL for QR codes (relative path from booth HTML to qrcodes folder)
const QRCODE_BASE_PATH_RELATIVE_TO_BOOTH = '../../qrcodes';

// Ensure necessary directories exist
fs.ensureDirSync(QRCODE_DIR);
fs.ensureDirSync(BOOTH_PAGES_DIR);
fs.ensureDirSync(MOBILE_PAGES_DIR);

// --- File Watcher Logic ---
console.log(`Watching for new video files in: ${OBS_OUTPUT_DIR}`);

// TEMPORARY: More aggressive watching for testing - TRY POLLING
const watcher = chokidar.watch(OBS_OUTPUT_DIR, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true, // Enable polling
    interval: 300,    // Poll every 300ms
    binaryInterval: 500, // Poll binary files every 500ms (adjust as needed)
    awaitWriteFinish: {
        stabilityThreshold: 5000, // Wait for 5 seconds of no file size changes
        pollInterval: 500,        // Check file size every 500ms
        minSize: 1024             // Minimum size (1KB) to consider the file not empty
    }
});

watcher
    .on('add', async (filePath) => {
        const fileName = path.basename(filePath);
        // Add a very prominent log here to ensure this event fires
        console.log(`\n\n🔥🔥🔥 CHOKIDAR 'ADD' EVENT FIRED! File: ${fileName} 🔥🔥🔥\n\n`);

        // Basic check for MP4 - could be more robust
        if (path.extname(fileName).toLowerCase() !== '.mp4') {
            console.log(`   Ignoring non-MP4 file: ${fileName}`);
            return;
        }

        try {
            // --- Generate Unique Slug ---
            // Simple slug based on filename without extension + timestamp
            const slug = `${path.parse(fileName).name}_${Date.now()}`;
            console.log(`   Generated Slug: ${slug}`);

            // --- 1. Upload to Supabase ---
            console.log(`   Uploading ${fileName} to Supabase...`);
            const fileContent = await fs.readFile(filePath);
            const supabasePath = `public/${fileName}`; // Store in a 'public' folder within the bucket

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(SUPABASE_BUCKET)
                .upload(supabasePath, fileContent, {
                    cacheControl: '3600',
                    upsert: false, // Don't overwrite existing files (optional)
                    contentType: 'video/mp4'
                });

            if (uploadError) {
                throw new Error(`Supabase Upload Error: ${uploadError.message}`);
            }
            console.log(`   Upload successful: ${uploadData.path}`);

            // --- 2. Get Public URL ---
            const { data: urlData } = supabase.storage
                .from(SUPABASE_BUCKET)
                .getPublicUrl(supabasePath);

            if (!urlData || !urlData.publicUrl) {
                 throw new Error('Could not get public URL from Supabase.');
            }
            const publicVideoUrl = urlData.publicUrl;
            console.log(`   Public Video URL: ${publicVideoUrl}`);

            // --- 3. Generate Mobile Page URL ---
            const mobilePageUrl = `${MOBILE_BASE_URL}/${slug}.html`;
            console.log(`   Mobile Page URL: ${mobilePageUrl}`);

            // --- 4. Generate QR Code ---
            const qrCodeFileName = `qr_${slug}.png`;
            const qrCodeFilePath = path.join(QRCODE_DIR, qrCodeFileName);
            await QRCode.toFile(qrCodeFilePath, mobilePageUrl, { errorCorrectionLevel: 'H' });
            console.log(`   QR Code generated: ${qrCodeFilePath}`);
            const qrCodeRelativePathForBooth = `${QRCODE_BASE_PATH_RELATIVE_TO_BOOTH}/${qrCodeFileName}`; // Path used inside booth HTML

            // --- 5. Generate HTML Pages from Templates ---
            await generateHtmlPages(slug, publicVideoUrl, qrCodeRelativePathForBooth);

            // --- 6. Optional: Cleanup Original File? ---
            // Decide if you want to delete the file from obs-output after processing
            // await fs.remove(filePath);
            // console.log(`   Removed original file: ${filePath}`);

            console.log(`--- Processing complete for ${fileName} ---`);

        } catch (error) {
            console.error(`Error processing file ${fileName}:`, error);
            // Decide how to handle errors (e.g., move file to an error folder)
        }
    })
    .on('error', error => console.error(`Watcher error: ${error}`))
    .on('ready', () => console.log('Initial scan complete. Ready for changes...'));


// --- Helper Function to Generate HTML ---
async function generateHtmlPages(slug, videoUrl, qrCodePath) {
    try {
        // Load templates
        const boothTemplatePath = path.join(TEMPLATES_DIR, 'booth_template.html');
        const mobileTemplatePath = path.join(TEMPLATES_DIR, 'mobile_template.html');

        let boothHtml = await fs.readFile(boothTemplatePath, 'utf8');
        let mobileHtml = await fs.readFile(mobileTemplatePath, 'utf8');

        // Replace placeholders
        // Use RegExp with 'g' flag to replace all occurrences
        boothHtml = boothHtml.replace(/\[VIDEO_URL\]/g, videoUrl)
                             .replace(/\[SLUG\]/g, slug)
                             .replace(/\[QR_CODE_PATH\]/g, qrCodePath); // Ensure template uses [QR_CODE_PATH] if needed, or adjust replacement

        mobileHtml = mobileHtml.replace(/\[VIDEO_URL\]/g, videoUrl)
                               .replace(/\[SLUG\]/g, slug);

        // Write new HTML files
        const boothOutputPath = path.join(BOOTH_PAGES_DIR, `${slug}.html`);
        const mobileOutputPath = path.join(MOBILE_PAGES_DIR, `${slug}.html`);

        await fs.writeFile(boothOutputPath, boothHtml);
        console.log(`   Booth page generated: ${boothOutputPath}`);
        await fs.writeFile(mobileOutputPath, mobileHtml);
        console.log(`   Mobile page generated: ${mobileOutputPath}`);

    } catch (error) {
        console.error(`Error generating HTML pages for slug ${slug}:`, error);
        throw error; // Re-throw error to be caught by the main handler
    }
}


// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Stopping watcher...');
    watcher.close().then(() => {
        console.log('Watcher stopped.');
        process.exit(0);
    });
});
