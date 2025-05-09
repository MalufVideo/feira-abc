# Deployment Instructions

## Booth Computer Setup

1. **Install Node.js**
   - Download and install Node.js from [nodejs.org](https://nodejs.org/) (LTS version recommended)

2. **Clone/Copy the Project**
   - Copy the entire project folder to the booth computer

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Configure Environment**
   - Create a `.env` file in the project root with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ```

5. **Start the Services**
   - Start the watcher (monitors for new videos):
   ```bash
   npm run start:watcher
   ```
   - Start the server (serves booth and mobile pages):
   ```bash
   npm run start:server
   ```

## Mobile Page Deployment

1. **Create a subdirectory on your website**
   - Create a directory on your web server for the mobile pages

2. **Update Configuration**
   - Update the `MOBILE_BASE_URL` in `watcher.js` to point to your website domain

3. **Configure Automatic Deployment**
   - Option 1: Set up a script to copy new mobile pages to your website
   - Option 2: Configure the watcher to directly upload mobile pages to your website

## Booth Page Auto-Reload

The booth page has been configured to automatically reload when a new video is processed.
