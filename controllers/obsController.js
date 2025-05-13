import OBSWebSocket from 'obs-websocket-js';
import { Builder, By } from 'selenium-webdriver';
import { Client as OSCClient, Message as OSCMessage } from 'node-osc';

// OBS WebSocket connection details from the image
const OBS_ADDRESS = '192.168.1.36';
const OBS_PORT = '4455';
const OBS_PASSWORD = 'Hh4OkXGkTV6ccA3v';

// Selenium click coordinates
const CLICK_X = 838; // Assuming this is still correct from your original file
const CLICK_Y = 769; // Assuming this is still correct from your original file

// OSC Connection Details
const OSC_HOST = '192.168.1.74';
const OSC_PORT = 7401;

// Initialize OBS WebSocket
const obs = new OBSWebSocket();

// Initialize OSC Client
const oscClient = new OSCClient(OSC_HOST, OSC_PORT);

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
                    resolve(false); // Resolve with false on error to not break the main flow critically
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
        return false; // Return false on error
    }
}

// Function to send OSC message
async function sendOSCMessage(address, value) {
    return new Promise((resolve, reject) => {
        console.log(`Sending OSC message: ${address} with value ${value}`);
        oscClient.send(address, value, (err) => {
            if (err) {
                console.error('Error sending OSC message:', err);
                return reject(err);
            }
            console.log(`OSC message ${address} with value ${value} sent successfully.`);
            resolve();
        });
    });
}

// Main controller function to handle the recording process
async function controlRecording(config = {}) {
    const {
        totalRecTime: totalRecTimeSec = 12, // Default total recording time in seconds
        osc1Time: osc1TimeSec = 0,         // Default OSC 1 time in seconds
        osc2Time: osc2TimeSec = 4,         // Default OSC 2 time in seconds
        osc3Time: osc3TimeSec = 8          // Default OSC 3 time in seconds
    } = config;

    // Convert all times to milliseconds
    const totalRecTimeMs = totalRecTimeSec * 1000;
    const osc1TimeMs = osc1TimeSec * 1000;
    const osc2TimeMs = osc2TimeSec * 1000;
    const osc3TimeMs = osc3TimeSec * 1000;

    console.log(`ControlRecording called with: totalRecTime=${totalRecTimeSec}s, osc1Time=${osc1TimeSec}s, osc2Time=${osc2TimeSec}s, osc3Time=${osc3TimeSec}s`);

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
        
        // Perform the Selenium click (non-blocking)
        performSeleniumClick().catch(error => {
            console.error('Error during Selenium click:', error);
            // This ensures that an error in the click doesn't stop the OSC/recording flow
        });

        let accumulatedDelayMs = 0;

        // Send OSC message 1
        const delayForOsc1 = Math.max(0, osc1TimeMs - accumulatedDelayMs);
        if (delayForOsc1 > 0) {
            await new Promise(resolve => setTimeout(resolve, delayForOsc1));
        }
        accumulatedDelayMs = osc1TimeMs; // Absolute time for OSC 1
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 1.0);
        } catch (oscError) {
            console.error('Failed to send initial OSC message:', oscError);
        }
        
        // Send OSC message 2
        const delayForOsc2 = Math.max(0, osc2TimeMs - accumulatedDelayMs);
        if (delayForOsc2 > 0) {
            await new Promise(resolve => setTimeout(resolve, delayForOsc2));
        }
        accumulatedDelayMs = osc2TimeMs; // Absolute time for OSC 2
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 2.0);
        } catch (oscError) {
            console.error('Failed to send second OSC message:', oscError);
        }

        // Send OSC message 3
        const delayForOsc3 = Math.max(0, osc3TimeMs - accumulatedDelayMs);
        if (delayForOsc3 > 0) {
            await new Promise(resolve => setTimeout(resolve, delayForOsc3));
        }
        accumulatedDelayMs = osc3TimeMs; // Absolute time for OSC 3
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 3.0);
        } catch (oscError) {
            console.error('Failed to send third OSC message:', oscError);
        }

        // Wait for the remainder of the recording period
        const finalWaitMs = Math.max(0, totalRecTimeMs - accumulatedDelayMs);
        if (finalWaitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, finalWaitMs));
        }
        
        // Stop recording
        const recordingStopped = await stopRecording();
        if (!recordingStopped) {
            // Even if stopping fails, we might still want to disconnect
            await obs.disconnect();
            return { success: false, message: 'Failed to stop recording' };
        }

        // Add a 1-second delay after stopping recording
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send OSC message to go back to Cue 1
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 1.0);
            console.log('Sent OSC message to return to Cue 1.');
        } catch (oscError) {
            console.error('Failed to send OSC message to return to Cue 1:', oscError);
            // Optionally, you might want to reflect this error in the response,
            // but for now, we'll just log it and proceed with success if recording was okay.
        }
        
        // Disconnect from OBS
        await obs.disconnect();
        
        return { success: true, message: 'Recording and OSC control completed successfully' };
    } catch (error) {
        console.error('Error in control recording process:', error);
        if (obs && obs.socket && obs.socket.readyState === 1) {
            try {
                await obs.disconnect();
                console.log('Disconnected from OBS due to error.');
            } catch (disconnectError) {
                console.error('Error disconnecting from OBS during error handling:', disconnectError);
            }
        }
        return { success: false, message: `Error: ${error.message || 'Unknown error'}` };
    }
}

export { controlRecording };
