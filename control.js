import express from 'express';
import { controlRecording } from './controllers/obsController.js';

const app = express();
const PORT = process.env.PORT || 3001; // Use a different port if needed

app.use(express.json());

// API endpoint to trigger OBS recording and Selenium click
app.post('/api/control/start-recording', async (req, res) => {
    try {
        const result = await controlRecording();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: `Server error: ${error.message || 'Unknown error'}` });
    }
});

// (Optional) Serve your control.html for testing
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Control server running on http://localhost:${PORT}`);
});