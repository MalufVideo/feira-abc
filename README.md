# 📹 OBS Video QR Sharing System

This project sets up a system to:
1. Watch an OBS output directory for new video files.
2. Upload the video to Supabase Storage.
3. Generate a QR code linking to a mobile-friendly page.
4. Create two HTML pages:
   - A booth display page with the video and QR code (served locally).
   - A mobile page with the video and social share buttons (served online).
5. (Optional) Log events like scans and shares using a simple Node.js backend.

## Folder Structure

```
project-root/
├── obs-output/                 # OBS writes MP4 files here
├── uploads/                    # Temp storage before upload (optional)
├── public/
│   ├── booth/                  # Generated HTML for booth display
│   └── mobile/                 # Generated HTML for mobile access
├── qrcodes/                    # Generated QR code images
├── templates/
│   ├── booth_template.html     # Template for booth page
│   └── mobile_template.html    # Template for mobile page
├── watcher.js                  # Main script: watches files, uploads, generates pages/QR
├── supabaseClient.js           # Supabase client setup
├── server.js                   # Optional: Node.js server for logging
├── package.json
├── package-lock.json
└── README.md
```

## Setup

1.  **Install OBS Studio:** Configure it to save MP4 videos to the `obs-output` directory.
2.  **Create Supabase Project:** Set up a 'videos' bucket in Supabase Storage.
3.  **Configure Supabase Client:** Add your Supabase URL and anon key to `supabaseClient.js`.
4.  **Install Dependencies:** `npm install`
5.  **Run Watcher:** `node watcher.js`
6.  **Run Server (Optional):** `node server.js` (if using the logging backend)
7.  **Serve Public Folder:** Use a simple HTTP server (like `npx serve public`) or integrate with `server.js` (using Express static middleware) to serve the `public/booth` and `public/mobile` directories.
    - Booth display uses `http://localhost:<port>/booth/[slug].html`
    - Mobile access uses `http://<your-internet-domain>/mobile/[slug].html` (or localhost for testing).

## Dependencies

- `chokidar`: Watches the `obs-output` directory.
- `qrcode`: Generates QR code images.
- `@supabase/supabase-js`: Interacts with Supabase Storage.
- `express` (optional, for `server.js`): Serves files and handles logging API endpoints.
