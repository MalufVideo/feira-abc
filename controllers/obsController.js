import OBSWebSocket from 'obs-websocket-js';
import { Builder, By } from 'selenium-webdriver';

// OBS WebSocket connection details from the image
const OBS_ADDRESS = '172.21.112.1';
const OBS_PORT = '4455';
const OBS_PASSWORD = '1ESQ6Z3YOhNYuUn0';

// Selenium click coordinates
const CLICK_X = 838;
const CLICK_Y = 769; // Adjusted 20 pixels down from original 749

// Initialize OBS WebSocket
const obs = new OBSWebSocket();

// Function to connect to OBS WebSocket
async function connectToOBS() {
    try {
        await obs.connect(`ws://${OBS_ADDRESS}:${OBS_PORT}`, OBS_PASSWORD);
        console.log('Connected to OBS WebSocket');
        return true;
    } catch (error) {
        console.error('Failed to connect to OBS:', error);
        return false;
    }
}

// Function to start recording in OBS
async function startRecording() {
    try {
        await obs.call('StartRecord');
        console.log('Recording started');
        return true;
    } catch (error) {
        console.error('Failed to start recording:', error);
        return false;
    }
}

// Function to stop recording in OBS
async function stopRecording() {
    try {
        await obs.call('StopRecord');
        console.log('Recording stopped');
        return true;
    } catch (error) {
        console.error('Failed to stop recording:', error);
        return false;
    }
}

// Function to perform a click at specific coordinates using Python script
async function performSeleniumClick() {
    try {
        // Use child_process to execute the Python script
        const { exec } = await import('child_process');
        
        return new Promise((resolve, reject) => {
            // Execute the Python script with the coordinates
            const command = `python click_helper.py ${CLICK_X} ${CLICK_Y} 1`;
            console.log(`Executing command: ${command}`);
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing Python script: ${error.message}`);
                    console.error(`stderr: ${stderr}`);
                    resolve(false);
                    return;
                }
                
                if (stderr) {
                    console.error(`Python script stderr: ${stderr}`);
                }
                
                console.log(`Python script output: ${stdout}`);
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Failed to perform click using Python script:', error);
        return false;
    }
}

// Main controller function to handle the recording process
async function controlRecording() {
    try {
        // Connect to OBS
        const connected = await connectToOBS();
        if (!connected) {
            return { success: false, message: 'Failed to connect to OBS' };
        }
        
        // Start recording
        const recordingStarted = await startRecording();
        if (!recordingStarted) {
            return { success: false, message: 'Failed to start recording' };
        }
        
        // Perform the Selenium click
        performSeleniumClick().catch(error => {
            console.error('Error during Selenium click:', error);
        });
        
        // Wait for 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Stop recording
        const recordingStopped = await stopRecording();
        if (!recordingStopped) {
            return { success: false, message: 'Failed to stop recording' };
        }
        
        // Disconnect from OBS
        await obs.disconnect();
        
        return { success: true, message: 'Recording completed successfully' };
    } catch (error) {
        console.error('Error in control recording process:', error);
        return { success: false, message: `Error: ${error.message || 'Unknown error'}` };
    }
}

export { controlRecording };
