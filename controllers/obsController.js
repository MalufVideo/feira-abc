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
        
        // Perform the Selenium click (non-blocking)
        performSeleniumClick().catch(error => {
            console.error('Error during Selenium click:', error);
            // This ensures that an error in the click doesn't stop the OSC/recording flow
        });

        // Send OSC message 1: /d3/showcontrol/cue Float 1
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 1.0);
        } catch (oscError) {
            console.error('Failed to send initial OSC message:', oscError);
        }
        
        // Wait for 3 seconds, then send OSC message 2
        await new Promise(resolve => setTimeout(resolve, 4000));
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 2.0);
        } catch (oscError) {
            console.error('Failed to send second OSC message:', oscError);
        }

        // Wait for another 3 seconds (total 6 seconds from start of OSC), then send OSC message 3
        await new Promise(resolve => setTimeout(resolve, 4000)); // 3 more seconds
        try {
            await sendOSCMessage('/d3/showcontrol/cue', 3.0);
        } catch (oscError) {
            console.error('Failed to send third OSC message:', oscError);
        }

        // Wait for the remainder of the 10-second recording period
        // Initial OSC was at 0s, second at 3s, third at 6s.
        // If total recording time is 10s, wait for 10 - 6 = 4 more seconds.
        await new Promise(resolve => setTimeout(resolve, 4000)); 
        
        // Stop recording
        const recordingStopped = await stopRecording();
        if (!recordingStopped) {
            // Disconnect from OBS if stopping recording fails but OBS is connected
            if (obs && obs.socket && obs.socket.readyState === 1) {
                await obs.disconnect();
            }
            return { success: false, message: 'Failed to stop recording' };
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
